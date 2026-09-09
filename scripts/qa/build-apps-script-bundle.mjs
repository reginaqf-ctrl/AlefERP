import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '../..');
const MANIFEST_PATH = 'qa/manifests/apps-script-bundle.json';
const ROOT_KEYS = Object.freeze([
  'artifact',
  'canonicalNodeVersion',
  'clasp',
  'excludedJavaScriptFiles',
  'manifestFile',
  'policy',
  'requiredEntrypoints',
  'schemaVersion',
  'sourceFiles'
]);
const ARTIFACT_KEYS = Object.freeze([
  'claspIgnorePath',
  'claspProjectPath',
  'directory',
  'evidencePath'
]);
const CLASP_KEYS = Object.freeze([
  'allowSymlinks',
  'htmlExtensions',
  'jsonExtensions',
  'rootDir',
  'scriptExtensions',
  'skipSubdirectories',
  'workingDirectory'
]);
const POLICY_KEYS = Object.freeze([
  'allowSymlinks',
  'exactSourceBytes',
  'requirePositiveClaspIgnore',
  'requireV8',
  'rootFilesOnly'
]);
const EXPECTED_ARTIFACT = Object.freeze({
  directory: '.qa-output/apps-script-bundle',
  evidencePath: '.qa-output/bundle-evidence.json',
  claspProjectPath: '.qa-output/.clasp.bundle.json',
  claspIgnorePath: '.qa-output/.clasp.bundleignore'
});
const TRANSIENT_FILESYSTEM_ERROR_CODES = new Set([
  'EBUSY',
  'EMFILE',
  'ENFILE',
  'ENOTEMPTY',
  'EPERM'
]);
const FILESYSTEM_RETRY_ATTEMPTS = 6;
const FILESYSTEM_RETRY_BASE_DELAY_MS = 25;

export class BundleGateError extends Error {
  constructor(code) {
    super(code);
    this.name = 'BundleGateError';
    this.code = code;
  }
}

function fail(code) {
  throw new BundleGateError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, keys, code) {
  if (!isPlainObject(value)) fail(code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((item, index) => item !== expected[index])) {
    fail(code);
  }
}

function assertRootFileName(value, code) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value !== value.normalize('NFC') ||
    value.includes('\\') ||
    value.includes('/') ||
    value === '.' ||
    value === '..' ||
    path.isAbsolute(value)
  ) {
    fail(code);
  }
}

function assertUniqueStringList(value, code, validator = null) {
  if (!Array.isArray(value) || value.length === 0) fail(code);
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0 || seen.has(item)) fail(code);
    if (validator) validator(item, code);
    seen.add(item);
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function relativePath(value) {
  return value.split(path.sep).join('/');
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

async function readJson(filePath, code) {
  let text;
  try {
    text = await readFile(filePath, 'utf8');
    return { value: JSON.parse(text), text };
  } catch {
    fail(code);
  }
}

async function requireContainedFile(root, relativeFile, code) {
  if (
    typeof relativeFile !== 'string' ||
    relativeFile.length === 0 ||
    relativeFile !== relativeFile.normalize('NFC') ||
    relativeFile.includes('\\') ||
    path.isAbsolute(relativeFile) ||
    relativeFile.split('/').some(part => part === '' || part === '.' || part === '..')
  ) {
    fail(code);
  }
  const rootReal = await realpath(root);
  const absolute = path.join(root, ...relativeFile.split('/'));
  let stat;
  let fileReal;
  try {
    stat = await lstat(absolute);
    fileReal = await realpath(absolute);
  } catch {
    fail(code);
  }
  const expectedReal = path.join(rootReal, ...relativeFile.split('/'));
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    !isContained(rootReal, fileReal) ||
    path.resolve(fileReal).toLowerCase() !== path.resolve(expectedReal).toLowerCase()
  ) {
    fail(code);
  }
  return absolute;
}

async function requireRegularFile(root, fileName, code) {
  assertRootFileName(fileName, code);
  return requireContainedFile(root, fileName, code);
}

function expectedPositiveIgnoreLines(manifest) {
  return ['**/**', `!${manifest.manifestFile}`, ...manifest.sourceFiles.map(file => `!${file}`)];
}

export async function loadBundleManifest(root = DEFAULT_ROOT) {
  const absolute = await requireContainedFile(root, MANIFEST_PATH, 'MANIFEST_READ_FAILED');
  const { value, text } = await readJson(absolute, 'MANIFEST_READ_FAILED');
  assertExactKeys(value, ROOT_KEYS, 'MANIFEST_SCHEMA_INVALID');
  if (value.schemaVersion !== '1.0.0') fail('MANIFEST_VERSION_INVALID');
  if (value.canonicalNodeVersion !== process.versions.node) fail('NODE_VERSION_MISMATCH');
  assertRootFileName(value.manifestFile, 'MANIFEST_FILE_INVALID');
  if (value.manifestFile !== 'appsscript.json') fail('MANIFEST_FILE_INVALID');

  assertExactKeys(value.artifact, ARTIFACT_KEYS, 'ARTIFACT_SCHEMA_INVALID');
  for (const [key, expected] of Object.entries(EXPECTED_ARTIFACT)) {
    if (value.artifact[key] !== expected) fail('ARTIFACT_PATH_INVALID');
  }

  assertUniqueStringList(value.sourceFiles, 'SOURCE_LIST_INVALID', assertRootFileName);
  assertUniqueStringList(
    value.excludedJavaScriptFiles,
    'EXCLUSION_LIST_INVALID',
    assertRootFileName
  );
  assertUniqueStringList(value.requiredEntrypoints, 'ENTRYPOINT_LIST_INVALID');
  if (!value.requiredEntrypoints.every(item => /^[A-Za-z_$][\w$]*$/u.test(item))) {
    fail('ENTRYPOINT_LIST_INVALID');
  }
  const sourceSet = new Set(value.sourceFiles);
  if (value.excludedJavaScriptFiles.some(file => sourceSet.has(file))) fail('INVENTORY_OVERLAP');
  if (value.sourceFiles.some(file => !file.endsWith('.js'))) fail('SOURCE_EXTENSION_INVALID');
  if (value.excludedJavaScriptFiles.some(file => !file.endsWith('.js'))) {
    fail('EXCLUSION_EXTENSION_INVALID');
  }

  assertExactKeys(value.clasp, CLASP_KEYS, 'CLASP_SCHEMA_INVALID');
  if (
    value.clasp.workingDirectory !== '.qa-output' ||
    value.clasp.rootDir !== 'apps-script-bundle' ||
    JSON.stringify(value.clasp.scriptExtensions) !== JSON.stringify(['.js']) ||
    JSON.stringify(value.clasp.htmlExtensions) !== JSON.stringify(['.html']) ||
    JSON.stringify(value.clasp.jsonExtensions) !== JSON.stringify(['.json']) ||
    value.clasp.skipSubdirectories !== true ||
    value.clasp.allowSymlinks !== false
  ) {
    fail('CLASP_POLICY_INVALID');
  }

  assertExactKeys(value.policy, POLICY_KEYS, 'POLICY_SCHEMA_INVALID');
  if (
    value.policy.rootFilesOnly !== true ||
    value.policy.allowSymlinks !== false ||
    value.policy.exactSourceBytes !== true ||
    value.policy.requireV8 !== true ||
    value.policy.requirePositiveClaspIgnore !== true
  ) {
    fail('POLICY_INVALID');
  }

  return { manifest: value, manifestText: text, manifestHash: sha256(text) };
}

export async function validateRepositoryInventory(root, manifest) {
  const entries = await readdir(root, { withFileTypes: true });
  const discoveredJavaScript = entries
    .filter(entry => entry.name.endsWith('.js'))
    .map(entry => entry.name)
    .sort();
  const expectedJavaScript = [...manifest.sourceFiles, ...manifest.excludedJavaScriptFiles].sort();
  if (
    discoveredJavaScript.length !== expectedJavaScript.length ||
    discoveredJavaScript.some((item, index) => item !== expectedJavaScript[index])
  ) {
    fail('ROOT_JAVASCRIPT_INVENTORY_MISMATCH');
  }

  for (const file of expectedJavaScript) {
    await requireRegularFile(root, file, 'SOURCE_FILE_INVALID');
  }
  await requireRegularFile(root, manifest.manifestFile, 'APPS_SCRIPT_MANIFEST_INVALID');

  const ignorePath = path.join(root, '.claspignore');
  let ignoreText;
  try {
    const stat = await lstat(ignorePath);
    if (!stat.isFile() || stat.isSymbolicLink()) fail('CLASP_IGNORE_INVALID');
    ignoreText = await readFile(ignorePath, 'utf8');
  } catch (error) {
    if (error instanceof BundleGateError) throw error;
    fail('CLASP_IGNORE_INVALID');
  }
  const actualIgnoreLines = ignoreText
    .replaceAll('\r', '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const expectedIgnoreLines = expectedPositiveIgnoreLines(manifest);
  if (
    actualIgnoreLines.length !== expectedIgnoreLines.length ||
    actualIgnoreLines.some((item, index) => item !== expectedIgnoreLines[index])
  ) {
    fail('CLASP_IGNORE_MISMATCH');
  }

  const { value: appsScriptManifest } = await readJson(
    path.join(root, manifest.manifestFile),
    'APPS_SCRIPT_MANIFEST_INVALID'
  );
  if (
    !isPlainObject(appsScriptManifest) ||
    appsScriptManifest.runtimeVersion !== 'V8' ||
    typeof appsScriptManifest.timeZone !== 'string' ||
    appsScriptManifest.timeZone.length === 0
  ) {
    fail('APPS_SCRIPT_MANIFEST_INVALID');
  }

  return { discoveredJavaScript, expectedIgnoreLines };
}

async function readSourceRecords(root, manifest) {
  const records = [];
  for (const file of [manifest.manifestFile, ...manifest.sourceFiles]) {
    const absolute = await requireRegularFile(root, file, 'SOURCE_FILE_INVALID');
    const bytes = await readFile(absolute);
    records.push({ path: file, bytes, bytesLength: bytes.length, sha256: sha256(bytes) });
  }
  return records;
}

async function requireSafeOutputRoot(root) {
  const rootAbsolute = path.resolve(root);
  const rootReal = await realpath(rootAbsolute);
  const outputRoot = path.join(rootAbsolute, '.qa-output');
  if (!isContained(rootAbsolute, outputRoot)) fail('OUTPUT_ROOT_INVALID');
  try {
    const stat = await lstat(outputRoot);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail('OUTPUT_ROOT_INVALID');
  } catch (error) {
    if (error instanceof BundleGateError) throw error;
    if (!error || error.code !== 'ENOENT') fail('OUTPUT_ROOT_INVALID');
    await mkdir(outputRoot, { recursive: false });
  }
  const outputReal = await realpath(outputRoot);
  if (!isContained(rootReal, outputReal)) fail('OUTPUT_ROOT_INVALID');
  return outputRoot;
}

function validateCombinedRuntime(records, manifest) {
  const sourceRecords = records.filter(record => record.path.endsWith('.js'));
  const combinedSource = sourceRecords
    .map(record => `\n/* ${record.path} */\n${record.bytes.toString('utf8')}\n;`)
    .join('');
  const context = vm.createContext({
    console: Object.freeze({ log() {}, warn() {}, error() {} })
  });
  try {
    vm.runInContext(combinedSource, context, {
      filename: 'alef-erp-exact-bundle.js',
      timeout: 10000
    });
  } catch {
    fail('BUNDLE_RUNTIME_LOAD_FAILED');
  }
  for (const entrypoint of manifest.requiredEntrypoints) {
    if (typeof context[entrypoint] !== 'function') fail('BUNDLE_ENTRYPOINT_MISSING');
  }
}

function calculateArtifactHash(records) {
  return sha256(records.map(record => `${record.path}\0${record.sha256}\n`).join(''));
}

async function writeFileExclusive(filePath, contents, mode = 0o600) {
  await writeFile(filePath, contents, { flag: 'wx', mode });
}

export async function retryTransientFilesystemOperation(
  operation,
  { attempts = FILESYSTEM_RETRY_ATTEMPTS, baseDelayMs = FILESYSTEM_RETRY_BASE_DELAY_MS } = {}
) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const code = error && typeof error === 'object' ? error.code : null;
      if (!TRANSIENT_FILESYSTEM_ERROR_CODES.has(code) || attempt === attempts - 1) throw error;
      await delay(Math.min(baseDelayMs * 2 ** attempt, 400));
    }
  }
  throw lastError;
}

async function renameWithRetry(sourcePath, targetPath) {
  await retryTransientFilesystemOperation(() => rename(sourcePath, targetPath));
}

async function removeWithRetry(targetPath, options) {
  await retryTransientFilesystemOperation(() => rm(targetPath, options));
}

async function replaceArtifactDirectory(root, manifest, records, runId) {
  const outputRoot = await requireSafeOutputRoot(root);
  const artifactPath = path.join(root, manifest.artifact.directory);
  const temporaryPath = path.join(outputRoot, `.apps-script-bundle.${runId}.tmp`);
  const backupPath = path.join(outputRoot, `.apps-script-bundle.${runId}.bak`);
  await mkdir(temporaryPath, { recursive: false });
  let previousMoved = false;
  try {
    for (const record of records) {
      await writeFileExclusive(path.join(temporaryPath, record.path), record.bytes);
    }
    try {
      const stat = await lstat(artifactPath);
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail('ARTIFACT_TARGET_INVALID');
      await renameWithRetry(artifactPath, backupPath);
      previousMoved = true;
    } catch (error) {
      if (error instanceof BundleGateError) throw error;
      if (error && error.code !== 'ENOENT') throw error;
    }
    await renameWithRetry(temporaryPath, artifactPath);
    if (previousMoved) await removeWithRetry(backupPath, { recursive: true, force: true });
  } catch (error) {
    await removeWithRetry(temporaryPath, { recursive: true, force: true }).catch(() => {});
    if (previousMoved) {
      await removeWithRetry(artifactPath, { recursive: true, force: true }).catch(() => {});
      await renameWithRetry(backupPath, artifactPath).catch(() => {});
    }
    if (error instanceof BundleGateError) throw error;
    fail('ARTIFACT_WRITE_FAILED');
  }
  return artifactPath;
}

export async function verifyArtifact(root, manifest, records) {
  const artifactPath = path.join(root, manifest.artifact.directory);
  let entries;
  try {
    const stat = await lstat(artifactPath);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail('ARTIFACT_INVALID');
    entries = await readdir(artifactPath, { withFileTypes: true });
  } catch (error) {
    if (error instanceof BundleGateError) throw error;
    fail('ARTIFACT_INVALID');
  }
  const actualNames = entries.map(entry => entry.name).sort();
  const expectedNames = records.map(record => record.path).sort();
  if (
    entries.some(entry => !entry.isFile() || entry.isSymbolicLink()) ||
    actualNames.length !== expectedNames.length ||
    actualNames.some((item, index) => item !== expectedNames[index])
  ) {
    fail('ARTIFACT_FILE_SET_MISMATCH');
  }
  for (const record of records) {
    const bytes = await readFile(path.join(artifactPath, record.path));
    if (bytes.length !== record.bytesLength || sha256(bytes) !== record.sha256) {
      fail('ARTIFACT_HASH_MISMATCH');
    }
  }
  return true;
}

async function writeTextAtomic(
  filePath,
  text,
  runId,
  {
    writeFailureCode = 'ATOMIC_WRITE_FAILED',
    verificationFailureCode = 'ATOMIC_VERIFY_FAILED'
  } = {}
) {
  const temporaryPath = `${filePath}.${runId}.tmp`;
  const backupPath = `${filePath}.${runId}.bak`;
  await mkdir(path.dirname(filePath), { recursive: true });
  let previousMoved = false;
  try {
    await writeFileExclusive(temporaryPath, text);
    try {
      const stat = await lstat(filePath);
      if (!stat.isFile() || stat.isSymbolicLink()) fail('ATOMIC_TARGET_INVALID');
      await renameWithRetry(filePath, backupPath);
      previousMoved = true;
    } catch (error) {
      if (error instanceof BundleGateError) throw error;
      if (error && error.code !== 'ENOENT') throw error;
    }
    await renameWithRetry(temporaryPath, filePath);
    if (previousMoved) await removeWithRetry(backupPath, { force: true });
  } catch (error) {
    await removeWithRetry(temporaryPath, { force: true }).catch(() => {});
    if (previousMoved) {
      await removeWithRetry(filePath, { force: true }).catch(() => {});
      await renameWithRetry(backupPath, filePath).catch(() => {});
    }
    if (error instanceof BundleGateError) throw error;
    fail(writeFailureCode);
  }
  const persisted = await readFile(filePath, 'utf8');
  if (persisted !== text) fail(verificationFailureCode);
}

async function writeJsonAtomic(filePath, value, runId, failureCodes = {}) {
  await writeTextAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`, runId, failureCodes);
}

function currentRevision(root) {
  try {
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return /^[a-f0-9]{40}$/u.test(revision) ? revision : 'UNVERSIONED';
  } catch {
    return 'UNVERSIONED';
  }
}

function claspFilePushOrder(manifest) {
  return manifest.sourceFiles.map(file => path.join(manifest.clasp.rootDir, file));
}

export async function prepareClaspConfig(root, manifest, runId = randomUUID()) {
  await requireSafeOutputRoot(root);
  const localProjectPath = path.join(root, '.clasp.json');
  await requireRegularFile(root, '.clasp.json', 'LOCAL_CLASP_PROJECT_REQUIRED');
  const { value: localProject } = await readJson(localProjectPath, 'LOCAL_CLASP_PROJECT_REQUIRED');
  if (
    !isPlainObject(localProject) ||
    typeof localProject.scriptId !== 'string' ||
    !localProject.scriptId
  ) {
    fail('LOCAL_CLASP_PROJECT_INVALID');
  }
  const project = {
    scriptId: localProject.scriptId,
    rootDir: manifest.clasp.rootDir,
    scriptExtensions: manifest.clasp.scriptExtensions,
    htmlExtensions: manifest.clasp.htmlExtensions,
    jsonExtensions: manifest.clasp.jsonExtensions,
    filePushOrder: claspFilePushOrder(manifest),
    skipSubdirectories: manifest.clasp.skipSubdirectories,
    allowSymlinks: manifest.clasp.allowSymlinks
  };
  const projectPath = path.join(root, manifest.artifact.claspProjectPath);
  const ignorePath = path.join(root, manifest.artifact.claspIgnorePath);
  await writeJsonAtomic(projectPath, project, runId, {
    writeFailureCode: 'CLASP_PROJECT_WRITE_FAILED',
    verificationFailureCode: 'CLASP_PROJECT_VERIFY_FAILED'
  });
  await writeTextAtomic(
    ignorePath,
    `${expectedPositiveIgnoreLines(manifest).join('\n')}\n`,
    runId,
    {
      writeFailureCode: 'CLASP_IGNORE_WRITE_FAILED',
      verificationFailureCode: 'CLASP_IGNORE_VERIFY_FAILED'
    }
  );
  return {
    projectPath: relativePath(path.relative(root, projectPath)),
    ignorePath: relativePath(path.relative(root, ignorePath)),
    filePushOrder: project.filePushOrder
  };
}

export async function buildAppsScriptBundle({
  root = DEFAULT_ROOT,
  prepareClasp = false,
  persistEvidence = true
} = {}) {
  const runId = randomUUID();
  const generatedAt = new Date().toISOString();
  const { manifest, manifestHash } = await loadBundleManifest(root);
  const inventory = await validateRepositoryInventory(root, manifest);
  const records = await readSourceRecords(root, manifest);
  validateCombinedRuntime(records, manifest);
  await replaceArtifactDirectory(root, manifest, records, runId);
  await verifyArtifact(root, manifest, records);

  const claspPreparation = prepareClasp
    ? await prepareClaspConfig(root, manifest, runId)
    : {
        projectPath: manifest.artifact.claspProjectPath,
        ignorePath: manifest.artifact.claspIgnorePath,
        filePushOrder: claspFilePushOrder(manifest)
      };
  const artifactHash = calculateArtifactHash(records);
  const evidence = {
    schemaVersion: '1.0.0',
    runId,
    generatedAt,
    revision: currentRevision(root),
    nodeVersion: process.versions.node,
    manifest: { path: MANIFEST_PATH, sha256: manifestHash },
    inventory: {
      discoveredJavaScript: inventory.discoveredJavaScript.length,
      includedJavaScript: manifest.sourceFiles.length,
      excludedJavaScript: manifest.excludedJavaScriptFiles.length
    },
    artifact: {
      directory: manifest.artifact.directory,
      sha256: artifactHash,
      files: records.map(record => ({
        path: record.path,
        bytes: record.bytesLength,
        sha256: record.sha256
      }))
    },
    clasp: {
      prepared: prepareClasp,
      projectPath: claspPreparation.projectPath,
      ignorePath: claspPreparation.ignorePath,
      workingDirectory: manifest.clasp.workingDirectory,
      rootDir: manifest.clasp.rootDir,
      filePushOrder: claspPreparation.filePushOrder,
      filePushOrderHash: sha256(`${claspPreparation.filePushOrder.join('\n')}\n`)
    },
    runtime: {
      compiled: true,
      loaded: true,
      requiredEntrypoints: manifest.requiredEntrypoints
    },
    result: { ok: true, code: 'BUNDLE_VALID' }
  };
  if (persistEvidence) {
    await writeJsonAtomic(path.join(root, manifest.artifact.evidencePath), evidence, runId, {
      writeFailureCode: 'EVIDENCE_WRITE_FAILED',
      verificationFailureCode: 'EVIDENCE_VERIFICATION_FAILED'
    });
  }
  return evidence;
}

function parseCliArguments(argv) {
  if (argv.length !== 1 || !['--check', '--prepare-clasp'].includes(argv[0])) {
    fail('CLI_ARGUMENT_INVALID');
  }
  return { prepareClasp: argv[0] === '--prepare-clasp' };
}

async function main() {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    const evidence = await buildAppsScriptBundle(options);
    process.stdout.write(
      `AERP-QA-001 bundle: ${evidence.inventory.includedJavaScript} scripts; ` +
        `${evidence.artifact.files.length} files; artifact=${evidence.artifact.directory}; ` +
        `claspPrepared=${evidence.clasp.prepared}\n`
    );
  } catch (error) {
    const code = error instanceof BundleGateError ? error.code : 'INTERNAL_ERROR';
    process.stderr.write(`AERP-QA-001 bundle: BLOCKED ${code}\n`);
    process.exitCode = error instanceof BundleGateError ? 1 : 2;
  }
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) await main();
