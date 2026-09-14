import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { Linter } from 'eslint';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '../..');
const MANIFEST_PATH = 'qa/manifests/apps-script-bundle.json';
const ROOT_KEYS = Object.freeze([
  'artifact',
  'canonicalNodeVersion',
  'clasp',
  'embeddedTestEntrypoints',
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
const EMBEDDED_TEST_ENTRYPOINT_KEYS = Object.freeze([
  'prefixes',
  'preserveLineNumbers',
  'requireNoRetainedReferences'
]);
const POLICY_KEYS = Object.freeze([
  'allowSymlinks',
  'preserveRetainedSourceBytes',
  'removeEmbeddedTestEntrypoints',
  'requirePositiveClaspIgnore',
  'requireV8',
  'rootFilesOnly'
]);
const APPS_SCRIPT_MANIFEST_KEYS = Object.freeze([
  'dependencies',
  'exceptionLogging',
  'oauthScopes',
  'runtimeVersion',
  'timeZone'
]);
const EXPECTED_OAUTH_SCOPES = Object.freeze([
  'https://www.googleapis.com/auth/script.container.ui',
  'https://www.googleapis.com/auth/spreadsheets.currentonly'
]);
const FORBIDDEN_OAUTH_SERVICE_GLOBALS = new Set([
  'CalendarApp',
  'ContactsApp',
  'DocumentApp',
  'DriveApp',
  'FormApp',
  'GmailApp',
  'GroupsApp',
  'Jdbc',
  'LanguageApp',
  'MailApp',
  'Maps',
  'SlidesApp',
  'UrlFetchApp'
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
  if (value.schemaVersion !== '1.1.0') fail('MANIFEST_VERSION_INVALID');
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
  assertExactKeys(
    value.embeddedTestEntrypoints,
    EMBEDDED_TEST_ENTRYPOINT_KEYS,
    'EMBEDDED_TEST_POLICY_SCHEMA_INVALID'
  );
  assertUniqueStringList(value.embeddedTestEntrypoints.prefixes, 'EMBEDDED_TEST_PREFIXES_INVALID');
  if (
    JSON.stringify(value.embeddedTestEntrypoints.prefixes) !==
      JSON.stringify(['test', 'runTest']) ||
    value.embeddedTestEntrypoints.requireNoRetainedReferences !== true ||
    value.embeddedTestEntrypoints.preserveLineNumbers !== true
  ) {
    fail('EMBEDDED_TEST_POLICY_INVALID');
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
    value.policy.preserveRetainedSourceBytes !== true ||
    value.policy.removeEmbeddedTestEntrypoints !== true ||
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
  assertExactKeys(appsScriptManifest, APPS_SCRIPT_MANIFEST_KEYS, 'APPS_SCRIPT_MANIFEST_INVALID');
  assertUniqueStringList(appsScriptManifest.oauthScopes, 'APPS_SCRIPT_OAUTH_SCOPES_INVALID');
  if (
    appsScriptManifest.runtimeVersion !== 'V8' ||
    appsScriptManifest.exceptionLogging !== 'STACKDRIVER' ||
    !isPlainObject(appsScriptManifest.dependencies) ||
    Object.keys(appsScriptManifest.dependencies).length !== 0 ||
    typeof appsScriptManifest.timeZone !== 'string' ||
    appsScriptManifest.timeZone.length === 0
  ) {
    fail('APPS_SCRIPT_MANIFEST_INVALID');
  }
  if (
    appsScriptManifest.oauthScopes.length !== EXPECTED_OAUTH_SCOPES.length ||
    appsScriptManifest.oauthScopes.some((scope, index) => scope !== EXPECTED_OAUTH_SCOPES[index])
  ) {
    fail('APPS_SCRIPT_OAUTH_SCOPES_INVALID');
  }

  return {
    discoveredJavaScript,
    expectedIgnoreLines,
    oauthScopes: [...appsScriptManifest.oauthScopes]
  };
}

function parseScript(source, file) {
  const captured = { ast: null, sourceCode: null };
  const captureRule = {
    create(context) {
      return {
        Program(node) {
          captured.ast = node;
          captured.sourceCode = context.sourceCode;
        }
      };
    }
  };
  const linter = new Linter();
  const messages = linter.verify(
    source,
    [
      {
        languageOptions: { ecmaVersion: 'latest', sourceType: 'script' },
        plugins: { local: { rules: { capture: captureRule } } },
        rules: { 'local/capture': 'error' }
      }
    ],
    { filename: file }
  );
  if (
    !captured.ast ||
    !captured.sourceCode?.scopeManager ||
    messages.some(message => message.fatal)
  ) {
    fail('SOURCE_PARSE_FAILED');
  }
  return captured;
}

function isEmbeddedTestEntrypoint(name, prefixes) {
  return prefixes.some(prefix => {
    if (name === prefix) return true;
    if (!name.startsWith(prefix)) return false;
    return /^[A-Z0-9_$]/u.test(name.slice(prefix.length, prefix.length + 1));
  });
}

function containsRange(outer, innerStart) {
  return innerStart >= outer[0] && innerStart < outer[1];
}

function preserveLineBreaksOnly(source) {
  const lineBreaks = source.match(/\r\n|\r|\n/gu) || [];
  return ` ${lineBreaks.join('')}`;
}

export function transformSourceForArtifact(source, file, policy) {
  if (typeof source !== 'string' || typeof file !== 'string' || !isPlainObject(policy)) {
    fail('EMBEDDED_TEST_TRANSFORM_INPUT_INVALID');
  }
  const byteOrderMark = source.startsWith('\uFEFF') ? '\uFEFF' : '';
  const parseableSource = byteOrderMark ? source.slice(1) : source;
  const captured = parseScript(parseableSource, file);
  const declarationNodes = captured.ast.body.filter(
    statement =>
      statement.type === 'FunctionDeclaration' &&
      statement.id &&
      isEmbeddedTestEntrypoint(statement.id.name, policy.prefixes)
  );
  const globalScope =
    captured.sourceCode.scopeManager.globalScope || captured.sourceCode.scopeManager.scopes[0];
  const referenceByIdentifier = new WeakMap();
  for (const scope of captured.sourceCode.scopeManager.scopes) {
    for (const reference of [...scope.references, ...(scope.through || [])]) {
      referenceByIdentifier.set(reference.identifier, reference);
    }
  }
  const removableVariables = new Set();
  for (const node of declarationNodes) {
    const variable = globalScope?.variables.find(
      candidate =>
        candidate.name === node.id.name &&
        candidate.defs.some(
          definition =>
            [definition.node, definition.name, definition.parent].includes(node) ||
            [definition.node, definition.name, definition.parent].includes(node.id)
        )
    );
    if (!variable) fail('EMBEDDED_TEST_BINDING_UNRESOLVED');
    removableVariables.add(variable);
  }
  const selfExportNodes = captured.ast.body.filter(statement => {
    const assignment = statement.type === 'ExpressionStatement' ? statement.expression : null;
    const left = assignment?.type === 'AssignmentExpression' ? assignment.left : null;
    const right = assignment?.type === 'AssignmentExpression' ? assignment.right : null;
    if (
      assignment?.operator !== '=' ||
      left?.type !== 'MemberExpression' ||
      left.object?.type !== 'Identifier' ||
      left.object.name !== 'globalThis' ||
      right?.type !== 'Identifier'
    ) {
      return false;
    }
    const globalThisReference = referenceByIdentifier.get(left.object);
    if (globalThisReference?.resolved?.defs?.length > 0) return false;
    const property = left.computed
      ? left.property?.type === 'Literal' && typeof left.property.value === 'string'
        ? left.property.value
        : null
      : left.property?.type === 'Identifier'
        ? left.property.name
        : null;
    if (
      !property ||
      property !== right.name ||
      !isEmbeddedTestEntrypoint(property, policy.prefixes)
    ) {
      return false;
    }
    const rightReference = referenceByIdentifier.get(right);
    return Boolean(rightReference?.resolved && removableVariables.has(rightReference.resolved));
  });
  const removalNodes = [...declarationNodes, ...selfExportNodes];
  const removalRanges = removalNodes
    .map(node => node.range)
    .sort((left, right) => left[0] - right[0]);
  if (
    removalRanges.some(
      (range, index) =>
        !Array.isArray(range) ||
        range.length !== 2 ||
        range[0] < 0 ||
        range[1] <= range[0] ||
        (index > 0 && range[0] < removalRanges[index - 1][1])
    )
  ) {
    fail('EMBEDDED_TEST_RANGE_INVALID');
  }

  if (declarationNodes.length > 0 && policy.requireNoRetainedReferences === true) {
    const references = new Set();
    for (const scope of captured.sourceCode.scopeManager.scopes) {
      for (const reference of [...scope.references, ...(scope.through || [])]) {
        if (reference.resolved && removableVariables.has(reference.resolved)) {
          references.add(reference.identifier);
        }
      }
    }
    for (const identifier of references) {
      if (!removalRanges.some(range => containsRange(range, identifier.range[0]))) {
        fail('EMBEDDED_TEST_REFERENCE_RETAINED');
      }
    }
  }

  let transformed = '';
  let cursor = 0;
  for (const range of removalRanges) {
    transformed += parseableSource.slice(cursor, range[0]);
    transformed += preserveLineBreaksOnly(parseableSource.slice(range[0], range[1]));
    cursor = range[1];
  }
  transformed += parseableSource.slice(cursor);

  const transformedCapture = parseScript(transformed, file);
  const transformedProgram = transformedCapture.ast;
  if (
    transformedProgram.body.some(
      statement =>
        statement.type === 'FunctionDeclaration' &&
        statement.id &&
        isEmbeddedTestEntrypoint(statement.id.name, policy.prefixes)
    )
  ) {
    fail('EMBEDDED_TEST_ENTRYPOINT_RETAINED');
  }
  const transformedReferenceByIdentifier = new WeakMap();
  for (const scope of transformedCapture.sourceCode.scopeManager.scopes) {
    for (const reference of [...scope.references, ...(scope.through || [])]) {
      transformedReferenceByIdentifier.set(reference.identifier, reference);
      if (
        (!reference.resolved || reference.resolved.defs.length === 0) &&
        isEmbeddedTestEntrypoint(reference.identifier.name, policy.prefixes)
      ) {
        fail('EMBEDDED_TEST_REFERENCE_RETAINED');
      }
      if (
        (!reference.resolved || reference.resolved.defs.length === 0) &&
        FORBIDDEN_OAUTH_SERVICE_GLOBALS.has(reference.identifier.name)
      ) {
        fail('UNDECLARED_OAUTH_SERVICE_REFERENCE');
      }
    }
  }
  const pendingNodes = [transformedProgram];
  while (pendingNodes.length > 0) {
    const node = pendingNodes.pop();
    if (node.type === 'MemberExpression' && node.object?.type === 'Identifier') {
      const property = node.computed
        ? node.property?.type === 'Literal' && typeof node.property.value === 'string'
          ? node.property.value
          : null
        : node.property?.type === 'Identifier'
          ? node.property.name
          : null;
      const objectReference = transformedReferenceByIdentifier.get(node.object);
      const isRuntimeGlobal = !objectReference?.resolved?.defs?.length;
      if (
        isRuntimeGlobal &&
        node.object.name === 'globalThis' &&
        property &&
        isEmbeddedTestEntrypoint(property, policy.prefixes)
      ) {
        fail('EMBEDDED_TEST_GLOBAL_MEMBER_RETAINED');
      }
      if (
        isRuntimeGlobal &&
        node.object.name === 'globalThis' &&
        property &&
        FORBIDDEN_OAUTH_SERVICE_GLOBALS.has(property)
      ) {
        fail('UNDECLARED_OAUTH_SERVICE_REFERENCE');
      }
    }
    for (const visitorKey of transformedCapture.sourceCode.visitorKeys[node.type] || []) {
      const child = node[visitorKey];
      if (Array.isArray(child)) pendingNodes.push(...child.filter(Boolean));
      else if (child) pendingNodes.push(child);
    }
  }
  if (
    policy.preserveLineNumbers === true &&
    (parseableSource.match(/\r\n|\r|\n/gu) || []).length !==
      (transformed.match(/\r\n|\r|\n/gu) || []).length
  ) {
    fail('EMBEDDED_TEST_LINE_MAP_CHANGED');
  }

  return {
    source: byteOrderMark + transformed,
    removedEntrypoints: declarationNodes.map(node => ({
      name: node.id.name,
      line: node.loc.start.line
    })),
    removedSelfExports: selfExportNodes.map(node => {
      const left = node.expression.left;
      return {
        name: left.computed ? left.property.value : left.property.name,
        line: node.loc.start.line
      };
    })
  };
}

async function readSourceRecords(root, manifest) {
  const records = [];
  for (const file of [manifest.manifestFile, ...manifest.sourceFiles]) {
    const absolute = await requireRegularFile(root, file, 'SOURCE_FILE_INVALID');
    const sourceBytes = await readFile(absolute);
    if (file === manifest.manifestFile) {
      records.push({
        path: file,
        bytes: sourceBytes,
        bytesLength: sourceBytes.length,
        sha256: sha256(sourceBytes),
        sourceBytesLength: sourceBytes.length,
        sourceSha256: sha256(sourceBytes),
        removedEntrypoints: [],
        removedSelfExports: []
      });
      continue;
    }
    const transformed = transformSourceForArtifact(
      sourceBytes.toString('utf8'),
      file,
      manifest.embeddedTestEntrypoints
    );
    if (!Buffer.from(sourceBytes.toString('utf8'), 'utf8').equals(sourceBytes)) {
      fail('SOURCE_ENCODING_INVALID');
    }
    const bytes = Buffer.from(transformed.source, 'utf8');
    records.push({
      path: file,
      bytes,
      bytesLength: bytes.length,
      sha256: sha256(bytes),
      sourceBytesLength: sourceBytes.length,
      sourceSha256: sha256(sourceBytes),
      removedEntrypoints: transformed.removedEntrypoints,
      removedSelfExports: transformed.removedSelfExports
    });
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

function frameworkSchemaSmokeFixture() {
  return {
    version: '2.0.0',
    generatedAt: '2026-08-17T00:00:00.000Z',
    tables: [
      {
        id: 'TABLE_ITEMS',
        code: 'ITEMS',
        name: 'Items',
        entity: 'Item',
        module: 'CORE',
        category: '',
        type: '',
        physicalName: 'CORE_ITEMS',
        prefix: '',
        active: true,
        columns: [
          {
            ID_Columna: 'COL_PK',
            Tabla: 'CORE_ITEMS',
            Nombre_Campo: 'ID_Item',
            Nombre_Mostrar: 'ID Item',
            Tipo_Dato: 'Text',
            Tipo_Control: 'Text',
            Es_Key: true,
            Es_Label: false,
            Es_Requerido: true,
            Permite_Nulos: false,
            Valor_Inicial: '',
            Formula_App: '',
            Tabla_Referencia: '',
            Longitud: '',
            Orden: 1,
            Activo: true,
            Estado: '',
            Fecha_Creacion: '',
            Fecha_Actualizacion: '',
            Visible: true,
            Editable: false,
            Es_Ref: false,
            Es_Virtual: false,
            Es_Buscable: false,
            Es_Filtrable: false,
            Es_Ordenable: false,
            Es_Indexado: false,
            Grupo_Formulario: '',
            Ayuda: '',
            Placeholder: ''
          }
        ]
      }
    ],
    summary: {
      tables: 1,
      columns: 1,
      relations: 0,
      views: 0,
      warnings: [],
      errors: [],
      durationMs: 0
    }
  };
}

function runExactArtifactSmoke(context) {
  context.aerpExactArtifactFrameworkSchema = vm.runInContext(
    `(${JSON.stringify(frameworkSchemaSmokeFixture())})`,
    context,
    { timeout: 10000 }
  );
  const singleBuild = vm.runInContext(
    'aerpBuildSingleMetadataArtifactsFromFrameworkSchema(aerpExactArtifactFrameworkSchema)',
    context,
    { timeout: 10000 }
  );
  if (!singleBuild || singleBuild.ok !== true) {
    fail('EXACT_ARTIFACT_SINGLE_BUILD_RESULT_FAILED');
  }
  if (
    singleBuild.summary?.tables !== 1 ||
    singleBuild.summary?.columns !== 1 ||
    singleBuild.summary?.primaryKeys !== 1 ||
    singleBuild.summary?.foreignKeys !== 0 ||
    singleBuild.summary?.forms !== 1 ||
    singleBuild.summary?.views !== 1 ||
    singleBuild.summary?.menus !== 1
  ) {
    fail('EXACT_ARTIFACT_SINGLE_BUILD_SUMMARY_FAILED');
  }
  if (!Object.isFrozen(singleBuild)) fail('EXACT_ARTIFACT_SINGLE_BUILD_FREEZE_FAILED');

  const authorization = vm.runInContext('aerpAuthorize(null)', context, { timeout: 10000 });
  const enterpriseAuthorization = vm.runInContext('aerpAuthorizeEnterprise(null, null)', context, {
    timeout: 10000
  });
  if (
    !authorization ||
    authorization.allowed !== false ||
    authorization.decision !== 'DENY' ||
    !enterpriseAuthorization ||
    enterpriseAuthorization.allowed !== false ||
    enterpriseAuthorization.decisionType !== 'DENY'
  ) {
    fail('EXACT_ARTIFACT_AUTHORIZATION_SMOKE_FAILED');
  }

  context.LockService = Object.freeze({
    getDocumentLock() {
      return Object.freeze({
        tryLock() {
          return false;
        },
        releaseLock() {
          throw new Error('UNEXPECTED_RELEASE');
        }
      });
    }
  });
  const pipeline = vm.runInContext('aerpRunBuildPipeline()', context, { timeout: 10000 });
  const deployment = vm.runInContext('runGenerarERP()', context, { timeout: 10000 });
  const workflow = vm.runInContext('aerpRunBuildWorkflow()', context, { timeout: 10000 });
  if (
    !pipeline ||
    pipeline.ok !== false ||
    pipeline.status !== 'BUILD_BUSY' ||
    !deployment ||
    deployment.ok !== false ||
    deployment.status !== 'FAILED' ||
    !workflow ||
    workflow.ok !== false ||
    workflow.status !== 'FAILED'
  ) {
    fail('EXACT_ARTIFACT_OPERATIONAL_SMOKE_FAILED');
  }

  delete context.aerpExactArtifactFrameworkSchema;
  delete context.LockService;
  return Object.freeze([
    'single-build-contract',
    'authorization-fail-closed',
    'enterprise-authorization-fail-closed',
    'pipeline-lock-contention',
    'deployment-failure-sanitization',
    'workflow-failure-sanitization'
  ]);
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
  const retainedTestEntrypoints = Object.getOwnPropertyNames(context).filter(
    name =>
      typeof context[name] === 'function' &&
      isEmbeddedTestEntrypoint(name, manifest.embeddedTestEntrypoints.prefixes)
  );
  if (retainedTestEntrypoints.length > 0) fail('EMBEDDED_TEST_ENTRYPOINT_RETAINED');
  return runExactArtifactSmoke(context);
}

async function readExactArtifactRecords(root, manifest, records) {
  const artifactPath = path.join(root, manifest.artifact.directory);
  const exactRecords = [];
  for (const record of records) {
    const bytes = await readFile(path.join(artifactPath, record.path));
    exactRecords.push({ ...record, bytes, bytesLength: bytes.length, sha256: sha256(bytes) });
  }
  return exactRecords;
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
  const exactArtifactRecords = await readExactArtifactRecords(root, manifest, records);
  const runtimeSmokeChecks = validateCombinedRuntime(exactArtifactRecords, manifest);

  const claspPreparation = prepareClasp
    ? await prepareClaspConfig(root, manifest, runId)
    : {
        projectPath: manifest.artifact.claspProjectPath,
        ignorePath: manifest.artifact.claspIgnorePath,
        filePushOrder: claspFilePushOrder(manifest)
      };
  const artifactHash = calculateArtifactHash(exactArtifactRecords);
  const transformedFiles = exactArtifactRecords.filter(
    record => record.removedEntrypoints.length > 0
  );
  const removedEntrypoints = transformedFiles.flatMap(record =>
    record.removedEntrypoints.map(entrypoint => ({ path: record.path, ...entrypoint }))
  );
  const removedSelfExports = transformedFiles.flatMap(record =>
    record.removedSelfExports.map(entrypoint => ({ path: record.path, ...entrypoint }))
  );
  const evidence = {
    schemaVersion: '1.2.0',
    runId,
    generatedAt,
    revision: currentRevision(root),
    nodeVersion: process.versions.node,
    manifest: { path: MANIFEST_PATH, sha256: manifestHash },
    inventory: {
      discoveredJavaScript: inventory.discoveredJavaScript.length,
      includedJavaScript: manifest.sourceFiles.length,
      excludedJavaScript: manifest.excludedJavaScriptFiles.length,
      embeddedTestEntrypointsRemoved: removedEntrypoints.length,
      embeddedTestSelfExportsRemoved: removedSelfExports.length
    },
    artifact: {
      directory: manifest.artifact.directory,
      sha256: artifactHash,
      files: exactArtifactRecords.map(record => ({
        path: record.path,
        bytes: record.bytesLength,
        sha256: record.sha256
      }))
    },
    transformation: {
      strategy: 'parser-backed-top-level-test-function-removal',
      preserveRetainedSourceBytes: true,
      preserveLineNumbers: true,
      files: transformedFiles.map(record => ({
        path: record.path,
        sourceBytes: record.sourceBytesLength,
        sourceSha256: record.sourceSha256,
        artifactBytes: record.bytesLength,
        artifactSha256: record.sha256,
        removedEntrypoints: record.removedEntrypoints,
        removedSelfExports: record.removedSelfExports
      }))
    },
    authorization: {
      oauthScopes: inventory.oauthScopes,
      spreadsheetAccess: 'CURRENT_DOCUMENT_ONLY',
      driveAccess: false
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
      requiredEntrypoints: manifest.requiredEntrypoints,
      retainedTestEntrypoints: 0,
      smokeChecks: runtimeSmokeChecks
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
