import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import {
  appendFile,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { afterEach } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildAppsScriptBundle,
  loadBundleManifest,
  prepareClaspConfig,
  retryTransientFilesystemOperation,
  transformSourceForArtifact,
  validateRepositoryInventory,
  verifyArtifact
} from '../build-apps-script-bundle.mjs';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const temporaryRoots = new Set();

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aerp-bundle-gate-'));
  temporaryRoots.add(root);
  await mkdir(path.join(root, 'qa/manifests'), { recursive: true });
  await copyFile(
    path.join(REPOSITORY_ROOT, 'qa/manifests/apps-script-bundle.json'),
    path.join(root, 'qa/manifests/apps-script-bundle.json')
  );
  const manifest = JSON.parse(
    await readFile(path.join(root, 'qa/manifests/apps-script-bundle.json'), 'utf8')
  );
  const files = [
    manifest.manifestFile,
    '.claspignore',
    ...manifest.sourceFiles,
    ...manifest.excludedJavaScriptFiles
  ];
  for (const file of files) {
    await copyFile(path.join(REPOSITORY_ROOT, file), path.join(root, file));
  }
  await writeFile(path.join(root, '.clasp.json'), '{"scriptId":"fixture-script-id"}\n');
  return { root, manifest };
}

afterEach(async () => {
  for (const root of temporaryRoots) {
    const resolved = path.resolve(root);
    if (!resolved.startsWith(path.resolve(os.tmpdir()))) {
      throw new Error('Refusing to clean a fixture outside the temporary directory.');
    }
    await rm(resolved, { recursive: true, force: true });
    temporaryRoots.delete(root);
  }
});

test('transient Windows filesystem contention is retried without hiding permanent failures', async () => {
  let transientAttempts = 0;
  const result = await retryTransientFilesystemOperation(
    async () => {
      transientAttempts += 1;
      if (transientAttempts < 3)
        throw Object.assign(new Error('controlled contention'), { code: 'EPERM' });
      return 'completed';
    },
    { attempts: 3, baseDelayMs: 1 }
  );
  assert.equal(result, 'completed');
  assert.equal(transientAttempts, 3);

  let permanentAttempts = 0;
  await assert.rejects(
    retryTransientFilesystemOperation(
      async () => {
        permanentAttempts += 1;
        throw Object.assign(new Error('controlled permanent failure'), { code: 'EACCES' });
      },
      { attempts: 3, baseDelayMs: 1 }
    ),
    error => error.code === 'EACCES'
  );
  assert.equal(permanentAttempts, 1);
});

test('positive manifest defines 37 ordered scripts and eight explicit exclusions', async () => {
  const { manifest } = await loadBundleManifest(REPOSITORY_ROOT);
  assert.equal(manifest.schemaVersion, '1.1.0');
  assert.equal(manifest.sourceFiles.length, 37);
  assert.equal(manifest.excludedJavaScriptFiles.length, 8);
  assert.equal(manifest.sourceFiles.includes('09_Tests.js'), false);
  assert.equal(manifest.excludedJavaScriptFiles.includes('09_Tests.js'), true);
  assert.equal(
    manifest.sourceFiles.some(file => file.endsWith('.test.js')),
    false
  );
  assert.deepEqual(manifest.embeddedTestEntrypoints.prefixes, ['test', 'runTest']);
  assert.equal(manifest.embeddedTestEntrypoints.requireNoRetainedReferences, true);
  assert.equal(manifest.policy.removeEmbeddedTestEntrypoints, true);
  assert.equal(manifest.policy.preserveRetainedSourceBytes, true);
});

test('repository inventory and positive clasp ignore agree exactly', async () => {
  const { manifest } = await loadBundleManifest(REPOSITORY_ROOT);
  const inventory = await validateRepositoryInventory(REPOSITORY_ROOT, manifest);
  assert.equal(inventory.discoveredJavaScript.length, 45);
  assert.deepEqual(inventory.expectedIgnoreLines.slice(0, 2), ['**/**', '!appsscript.json']);
  assert.equal(inventory.expectedIgnoreLines.length, 39);
});

test('build creates the exact isolated artifact and excludes all non-production JavaScript', async () => {
  const { root, manifest } = await createFixture();
  const evidence = await buildAppsScriptBundle({ root, persistEvidence: true });
  assert.equal(evidence.result.ok, true);
  assert.equal(evidence.result.code, 'BUNDLE_VALID');
  assert.equal(evidence.inventory.includedJavaScript, 37);
  assert.equal(evidence.inventory.excludedJavaScript, 8);
  assert.equal(evidence.artifact.files.length, 38);
  assert.equal(evidence.runtime.compiled, true);
  assert.equal(evidence.runtime.loaded, true);
  assert.equal(evidence.runtime.retainedTestEntrypoints, 0);
  assert.deepEqual(evidence.runtime.smokeChecks, [
    'single-build-contract',
    'authorization-fail-closed',
    'enterprise-authorization-fail-closed',
    'pipeline-lock-contention',
    'deployment-failure-sanitization',
    'workflow-failure-sanitization'
  ]);
  assert.ok(evidence.inventory.embeddedTestEntrypointsRemoved > 0);
  assert.equal(
    evidence.transformation.files.reduce(
      (total, file) => total + file.removedEntrypoints.length,
      0
    ),
    evidence.inventory.embeddedTestEntrypointsRemoved
  );
  assert.equal(
    evidence.transformation.files.reduce(
      (total, file) => total + file.removedSelfExports.length,
      0
    ),
    evidence.inventory.embeddedTestSelfExportsRemoved
  );

  const artifactFiles = (
    await readdir(path.join(root, manifest.artifact.directory), { withFileTypes: true })
  )
    .map(entry => entry.name)
    .sort();
  assert.deepEqual(artifactFiles, [manifest.manifestFile, ...manifest.sourceFiles].sort());
  for (const excluded of manifest.excludedJavaScriptFiles) {
    assert.equal(artifactFiles.includes(excluded), false);
  }
});

test('artifact bytes exactly match the approved parser-backed source transformation', async () => {
  const { root, manifest } = await createFixture();
  const evidence = await buildAppsScriptBundle({ root, persistEvidence: false });
  for (const record of evidence.artifact.files) {
    const source = await readFile(path.join(root, record.path));
    const artifact = await readFile(path.join(root, manifest.artifact.directory, record.path));
    const expected = record.path.endsWith('.js')
      ? Buffer.from(
          transformSourceForArtifact(
            source.toString('utf8'),
            record.path,
            manifest.embeddedTestEntrypoints
          ).source,
          'utf8'
        )
      : source;
    assert.deepEqual(artifact, expected);
    assert.equal(artifact.length, record.bytes);
    assert.match(record.sha256, /^[a-f0-9]{64}$/u);
  }
});

test('embedded test entrypoints are removed without changing retained code or line numbers', async () => {
  const { manifest } = await loadBundleManifest(REPOSITORY_ROOT);
  const source = [
    'const retainedValue = 1;',
    'function testRemoved() { return retainedValue; }',
    'function runTestRemoved() { return testRemoved(); }',
    'globalThis.testRemoved = testRemoved;',
    'function testerRemains() { return retainedValue; }',
    'function retainedLocalName() { const testCase = 1; return testCase; }',
    ''
  ].join('\n');
  const transformed = transformSourceForArtifact(
    source,
    'controlled.js',
    manifest.embeddedTestEntrypoints
  );
  assert.deepEqual(
    transformed.removedEntrypoints.map(entrypoint => entrypoint.name),
    ['testRemoved', 'runTestRemoved']
  );
  assert.deepEqual(
    transformed.removedSelfExports.map(entrypoint => entrypoint.name),
    ['testRemoved']
  );
  assert.equal(transformed.source.includes('function testRemoved'), false);
  assert.equal(transformed.source.includes('function runTestRemoved'), false);
  assert.equal(transformed.source.includes('globalThis.testRemoved'), false);
  assert.equal(transformed.source.includes('function testerRemains'), true);
  assert.equal(transformed.source.includes('const testCase = 1;'), true);
  assert.equal(transformed.source.includes('const retainedValue = 1;'), true);
  assert.equal(transformed.source.split('\n').length, source.split('\n').length);
});

test('a retained production reference to a removed test entrypoint fails closed', async () => {
  const { root, manifest } = await createFixture();
  await appendFile(
    path.join(root, '11_Installer.js'),
    '\nfunction retainedCommercialCaller() { return testInstaller(); }\n'
  );
  await assert.rejects(
    buildAppsScriptBundle({ root, persistEvidence: false }),
    /EMBEDDED_TEST_REFERENCE_RETAINED/u
  );
  assert.equal(manifest.embeddedTestEntrypoints.requireNoRetainedReferences, true);
});

test('cross-file test references and retained global test members fail closed', async () => {
  const { manifest } = await loadBundleManifest(REPOSITORY_ROOT);
  assert.throws(
    () =>
      transformSourceForArtifact(
        'function retainedCaller() { return testExternalHelper(); }\n',
        'cross-file.js',
        manifest.embeddedTestEntrypoints
      ),
    /EMBEDDED_TEST_REFERENCE_RETAINED/u
  );
  assert.throws(
    () =>
      transformSourceForArtifact(
        'function retainedCaller() { return globalThis.testExternalHelper(); }\n',
        'global-member.js',
        manifest.embeddedTestEntrypoints
      ),
    /EMBEDDED_TEST_GLOBAL_MEMBER_RETAINED/u
  );
});

test('unexpected, missing and symbolic-link JavaScript fail closed', async t => {
  const unexpected = await createFixture();
  await writeFile(path.join(unexpected.root, '99_Unexpected.js'), 'function unexpected() {}\n');
  await assert.rejects(
    validateRepositoryInventory(unexpected.root, unexpected.manifest),
    /ROOT_JAVASCRIPT_INVENTORY_MISMATCH/u
  );

  const missing = await createFixture();
  await rm(path.join(missing.root, missing.manifest.sourceFiles[0]));
  await assert.rejects(
    validateRepositoryInventory(missing.root, missing.manifest),
    /ROOT_JAVASCRIPT_INVENTORY_MISMATCH/u
  );

  const linked = await createFixture();
  const target = path.join(linked.root, linked.manifest.sourceFiles[1]);
  const link = path.join(linked.root, linked.manifest.sourceFiles[0]);
  await rm(link);
  try {
    await symlink(target, link, 'file');
  } catch {
    t.diagnostic('File symlink creation is not permitted on this platform');
    return;
  }
  await assert.rejects(
    validateRepositoryInventory(linked.root, linked.manifest),
    /SOURCE_FILE_INVALID/u
  );
});

test('manifest and clasp allowlist schemas are closed', async () => {
  const unknownKey = await createFixture();
  const manifestPath = path.join(unknownKey.root, 'qa/manifests/apps-script-bundle.json');
  const changedManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  changedManifest.unknown = true;
  await writeFile(manifestPath, `${JSON.stringify(changedManifest, null, 2)}\n`);
  await assert.rejects(loadBundleManifest(unknownKey.root), /MANIFEST_SCHEMA_INVALID/u);

  const ignoreMismatch = await createFixture();
  await appendFile(path.join(ignoreMismatch.root, '.claspignore'), '!99_Unexpected.js\n');
  await assert.rejects(
    validateRepositoryInventory(ignoreMismatch.root, ignoreMismatch.manifest),
    /CLASP_IGNORE_MISMATCH/u
  );
});

test('Apps Script manifest must use the V8 runtime', async () => {
  const { root, manifest } = await createFixture();
  const appsScriptPath = path.join(root, manifest.manifestFile);
  const appsScriptManifest = JSON.parse(await readFile(appsScriptPath, 'utf8'));
  appsScriptManifest.runtimeVersion = 'DEPRECATED_RUNTIME';
  await writeFile(appsScriptPath, `${JSON.stringify(appsScriptManifest, null, 2)}\n`);
  await assert.rejects(
    validateRepositoryInventory(root, manifest),
    /APPS_SCRIPT_MANIFEST_INVALID/u
  );
});

test('tampered artifacts fail exact hash verification', async () => {
  const { root, manifest } = await createFixture();
  const evidence = await buildAppsScriptBundle({ root, persistEvidence: false });
  const firstScript = manifest.sourceFiles[0];
  await appendFile(path.join(root, manifest.artifact.directory, firstScript), '\n// tampered\n');
  const records = evidence.artifact.files.map(record => ({
    path: record.path,
    bytesLength: record.bytes,
    sha256: record.sha256
  }));
  await assert.rejects(verifyArtifact(root, manifest, records), /ARTIFACT_HASH_MISMATCH/u);
});

test('clasp preparation is isolated, ordered and does not expose the target in evidence', async () => {
  const { root, manifest } = await createFixture();
  const evidence = await buildAppsScriptBundle({
    root,
    prepareClasp: true,
    persistEvidence: true
  });
  assert.equal(evidence.clasp.prepared, true);
  assert.equal(JSON.stringify(evidence).includes('fixture-script-id'), false);

  const project = JSON.parse(
    await readFile(path.join(root, manifest.artifact.claspProjectPath), 'utf8')
  );
  assert.equal(project.scriptId, 'fixture-script-id');
  assert.equal(project.rootDir, 'apps-script-bundle');
  assert.equal(project.skipSubdirectories, true);
  assert.equal(project.allowSymlinks, false);
  assert.deepEqual(
    project.filePushOrder,
    manifest.sourceFiles.map(file => path.join('apps-script-bundle', file))
  );
  const projectDirectory = path.dirname(path.join(root, manifest.artifact.claspProjectPath));
  assert.equal(path.relative(root, projectDirectory), manifest.clasp.workingDirectory);
  for (const [index, orderedFile] of project.filePushOrder.entries()) {
    assert.equal(
      path.resolve(projectDirectory, orderedFile),
      path.resolve(root, manifest.artifact.directory, manifest.sourceFiles[index])
    );
  }

  const ignore = await readFile(path.join(root, manifest.artifact.claspIgnorePath), 'utf8');
  assert.equal(
    ignore,
    `${['**/**', '!appsscript.json', ...manifest.sourceFiles.map(file => `!${file}`)].join('\n')}\n`
  );
});

test('manifest checking is independent from local clasp credentials', async () => {
  const { root, manifest } = await createFixture();
  await rm(path.join(root, '.clasp.json'));
  const evidence = await buildAppsScriptBundle({ root, persistEvidence: false });
  assert.equal(evidence.clasp.prepared, false);
  await assert.rejects(prepareClaspConfig(root, manifest), /LOCAL_CLASP_PROJECT_REQUIRED/u);
});

test('repeated builds replace artifacts and evidence without temporary residue', async () => {
  const { root, manifest } = await createFixture();
  const first = await buildAppsScriptBundle({ root, prepareClasp: true });
  const second = await buildAppsScriptBundle({ root, prepareClasp: true });
  assert.notEqual(first.runId, second.runId);
  const persisted = JSON.parse(
    await readFile(path.join(root, manifest.artifact.evidencePath), 'utf8')
  );
  assert.equal(persisted.runId, second.runId);
  const outputEntries = await readdir(path.join(root, '.qa-output'));
  assert.deepEqual(outputEntries.sort(), [
    '.clasp.bundle.json',
    '.clasp.bundleignore',
    'apps-script-bundle',
    'bundle-evidence.json'
  ]);
});

test('artifact target cannot be a symbolic link when the platform permits links', async t => {
  const { root, manifest } = await createFixture();
  const outputRoot = path.join(root, '.qa-output');
  const external = path.join(root, 'external-artifact');
  await mkdir(outputRoot, { recursive: true });
  await mkdir(external);
  try {
    await symlink(external, path.join(root, manifest.artifact.directory), 'junction');
  } catch {
    t.diagnostic('Directory junction creation is not permitted on this platform');
    return;
  }
  await assert.rejects(
    buildAppsScriptBundle({ root, persistEvidence: false }),
    /ARTIFACT_TARGET_INVALID/u
  );
  assert.equal((await lstat(external)).isDirectory(), true);
});

test('output root cannot be a symbolic link when the platform permits links', async t => {
  const { root } = await createFixture();
  const external = path.join(root, 'external-output');
  await mkdir(external);
  try {
    await symlink(external, path.join(root, '.qa-output'), 'junction');
  } catch {
    t.diagnostic('Output junction creation is not permitted on this platform');
    return;
  }
  await assert.rejects(
    buildAppsScriptBundle({ root, persistEvidence: false }),
    /OUTPUT_ROOT_INVALID/u
  );
  assert.equal((await lstat(external)).isDirectory(), true);
});
