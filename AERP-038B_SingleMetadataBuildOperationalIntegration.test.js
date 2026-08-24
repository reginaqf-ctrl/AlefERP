/* global require, __dirname */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const fileNames = [
  'AERP-038A_MetadataBuilderEnterprise.js',
  '14_MetadataBuilder.js',
  '15_GeneratorEngine.js',
  '16_AppSheetGenerator.js',
  '12_DryRun.js',
  '20_BuildPipeline.js',
  '17_DeploymentMVP.js',
  '21_BuildWorkflow.js',
  '10_Main.js'
];
const sourceByFile = Object.fromEntries(
  fileNames.map(file => [file, fs.readFileSync(path.join(__dirname, file), 'utf8')])
);

function frameworkSchema() {
  return {
    version: '2.0.0',
    generatedAt: '2026-08-17T00:00:00.000Z',
    tables: [
      {
        id: 'TABLE_PRIVATE',
        code: 'PRIVATE',
        name: 'Private Business Table',
        entity: 'PrivateEntity',
        module: 'CORE',
        category: '',
        type: '',
        physicalName: 'CORE_PRIVATE',
        prefix: '',
        active: true,
        columns: [
          {
            ID_Columna: 'COL_PRIVATE_PK',
            Tabla: 'CORE_PRIVATE',
            Nombre_Campo: 'PrivateKey',
            Nombre_Mostrar: 'Private Key',
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

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function load() {
  const context = vm.createContext({
    events: [],
    calls: {
      install: 0,
      schema: 0,
      strict: 0,
      metadata: 0,
      generator: 0,
      appSheet: 0,
      validation: 0,
      finalValidation: 0,
      deploymentLog: 0,
      packageWrite: 0,
      buildSummary: 0,
      finalize: 0,
      pipeline: 0,
      generate: 0,
      dryRun: 0,
      lock: 0,
      release: 0
    },
    lockState: { held: false }
  });
  vm.runInContext(fileNames.map(file => sourceByFile[file]).join('\n'), context);
  context.schemaFixture = vm.runInContext('(' + JSON.stringify(frameworkSchema()) + ')', context);
  vm.runInContext(
    [
      'originalStrict = aerpBuildMetadataModelFromSchema;',
      'originalMetadata = aerpBuildMetadataModelFromFrameworkSchema;',
      'originalGenerator = aerpBuildGeneratorEngineMVPFromMetadataModel;',
      'originalAppSheet = aerpBuildAppSheetPackageFromGenerator;',
      'originalValidation = aerpValidateSingleBuildArtifacts;',
      'originalBundle = aerpBuildSingleMetadataArtifactsFromFrameworkSchema;',
      'originalFrozenValidation = aerpValidateFrozenSingleBuildBundle_;',
      'originalDeploymentWriter = aerpWriteDeploymentLog_;',
      'originalFinalizeWriter = aerpFinalizeDeploymentLog_;',
      'aerpStartBuildMonitor = function () { events.push("MONITOR"); return { sheet: {}, start: new Date(0) }; };',
      'aerpBuildStep = function (_sheet, step, status) { events.push("STEP:" + step + ":" + status); };',
      'aerpInstallCheck = function () { calls.install += 1; events.push("INSTALL"); return { ok: true, warnings: [], errors: [] }; };',
      'aerpBuildFrameworkSchema = function () { calls.schema += 1; events.push("SCHEMA"); return schemaFixture; };',
      'aerpBuildMetadataModelFromSchema = function (schema) { calls.strict += 1; events.push("STRICT"); return originalStrict(schema); };',
      'aerpBuildMetadataModelFromFrameworkSchema = function (schema) { calls.metadata += 1; events.push("METADATA"); return originalMetadata(schema); };',
      'aerpBuildGeneratorEngineMVPFromMetadataModel = function (model) { calls.generator += 1; events.push("GENERATOR"); return originalGenerator(model); };',
      'aerpBuildAppSheetPackageFromGenerator = function (generator) { calls.appSheet += 1; events.push("APPSHEET"); return originalAppSheet(generator); };',
      'aerpValidateSingleBuildArtifacts = function (artifacts) { calls.validation += 1; events.push("VALIDATION"); return originalValidation(artifacts); };',
      'aerpValidateFrozenSingleBuildBundle_ = function (bundle) { calls.finalValidation += 1; events.push("FINAL_VALIDATION"); return originalFrozenValidation(bundle); };',
      'aerpWriteDeploymentLog_ = function (bundle) { calls.deploymentLog += 1; events.push("WRITE:PENDING"); if (!originalFrozenValidation(bundle)) throw new Error("PRIVATE_INVALID_LOG"); return { sheet: {}, row: 2 }; };',
      'aerpWriteAppSheetPackageSummary_ = function (bundle) { calls.packageWrite += 1; events.push("WRITE:PACKAGE"); if (!originalFrozenValidation(bundle)) throw new Error("PRIVATE_INVALID_PACKAGE"); };',
      'aerpBuildPipelineSummary_ = function (_sheet, bundle) { calls.buildSummary += 1; events.push("WRITE:SUMMARY_READY"); if (!originalFrozenValidation(bundle)) throw new Error("PRIVATE_INVALID_SUMMARY"); };',
      'aerpFinalizeDeploymentLog_ = function (_receipt, status) { calls.finalize += 1; events.push("WRITE:" + status); };',
      'runAlefERPDryRun = function () { calls.dryRun += 1; throw new Error("PRIVATE_DRY_RUN"); };',
      'aerpGenerate = function () { calls.generate += 1; throw new Error("PRIVATE_REBUILD"); };',
      'LockService = { getDocumentLock: function () { calls.lock += 1; events.push("LOCK:GET"); return { tryLock: function () { events.push("LOCK:TRY"); if (lockState.held) return false; lockState.held = true; return true; }, hasLock: function () { return lockState.held; }, releaseLock: function () { calls.release += 1; events.push("LOCK:RELEASE"); lockState.held = false; } }; } };',
      'Logger = { log: function (value) { events.push({ logger: String(value) }); } };',
      'SpreadsheetApp = { flush: function () {} };'
    ].join('\n'),
    context
  );
  return context;
}

function pipeline(context) {
  return vm.runInContext('aerpRunBuildPipeline()', context);
}

function assertNoDeployment(context) {
  assert.equal(context.calls.deploymentLog, 0);
  assert.equal(context.calls.packageWrite, 0);
  assert.equal(context.calls.buildSummary, 0);
}

test('Pipeline performs every single-build stage exactly once and writes only after validation', () => {
  const context = load();
  const result = pipeline(context);
  assert.equal(result.ok, true);
  assert.deepEqual(plain(context.calls), {
    install: 1,
    schema: 1,
    strict: 1,
    metadata: 1,
    generator: 1,
    appSheet: 1,
    validation: 1,
    finalValidation: 1,
    deploymentLog: 1,
    packageWrite: 1,
    buildSummary: 1,
    finalize: 1,
    pipeline: 0,
    generate: 0,
    dryRun: 0,
    lock: 1,
    release: 1
  });
  assert.deepEqual(plain(context.events), [
    'LOCK:GET',
    'LOCK:TRY',
    'MONITOR',
    'STEP:Installer:⏳ RUNNING',
    'INSTALL',
    'STEP:Installer:VALIDADO',
    'STEP:FrameworkSchema:⏳ RUNNING',
    'SCHEMA',
    'STEP:FrameworkSchema:VALIDADO',
    'STEP:Single Build:⏳ RUNNING',
    'METADATA',
    'STRICT',
    'GENERATOR',
    'APPSHEET',
    'VALIDATION',
    'FINAL_VALIDATION',
    'STEP:Single Build:VALIDADO',
    'STEP:Deployment:⏳ RUNNING',
    'WRITE:PENDING',
    'WRITE:PACKAGE',
    'STEP:Deployment:LISTO_PARA_CONFIRMAR',
    'WRITE:SUMMARY_READY',
    'WRITE:OK',
    'LOCK:RELEASE'
  ]);
});

test('Pipeline rejects overlapping execution before monitor, build or writes', () => {
  const context = load();
  context.lockState.held = true;
  const result = pipeline(context);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'BUILD_BUSY');
  assert.deepEqual(plain(context.events), ['LOCK:GET', 'LOCK:TRY']);
  assert.equal(context.calls.release, 0);
  assert.equal(context.calls.install, 0);
  assertNoDeployment(context);
});

test('Pipeline sanitizes lock infrastructure failure before any operational effect', () => {
  const context = load();
  vm.runInContext(
    'LockService.getDocumentLock = function () { throw new Error("PRIVATE_LOCK_STACK"); };',
    context
  );
  const result = pipeline(context);
  assert.equal(result.status, 'BUILD_LOCK_FAILED');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|STACK|stack/);
  assert.equal(context.calls.install, 0);
  assertNoDeployment(context);
});

test('internal locked helper fails closed unless the caller already owns the lock', () => {
  const context = load();
  const result = vm.runInContext('aerpRunBuildPipelineLocked_(null)', context);
  assert.equal(result.status, 'BUILD_LOCK_FAILED');
  assert.deepEqual(plain(context.events), []);
  assertNoDeployment(context);
});

test('two simulated executions allow only the lock owner to build and write', () => {
  const context = load();
  vm.runInContext(
    [
      'nestedResult = null;',
      'nestedStarted = false;',
      'aerpStartBuildMonitor = function () {',
      '  events.push("MONITOR");',
      '  if (!nestedStarted) { nestedStarted = true; nestedResult = aerpRunBuildPipeline(); }',
      '  return { sheet: {}, start: new Date(0) };',
      '};'
    ].join('\n'),
    context
  );
  const outer = pipeline(context);
  assert.equal(outer.ok, true);
  assert.equal(context.nestedResult.status, 'BUILD_BUSY');
  assert.equal(context.calls.schema, 1);
  assert.equal(context.calls.deploymentLog, 1);
  assert.equal(context.calls.release, 1);
});

test('Pipeline never calls reconstructive wrappers, physical DryRun or metadata rebuild', () => {
  const context = load();
  vm.runInContext(
    [
      'aerpBuildMetadataModel = function () { throw new Error("PRIVATE_METADATA_WRAPPER"); };',
      'aerpBuildGeneratorEngineMVP = function () { throw new Error("PRIVATE_GENERATOR_WRAPPER"); };',
      'aerpBuildAppSheetPackage = function () { throw new Error("PRIVATE_APPSHEET_WRAPPER"); };'
    ].join('\n'),
    context
  );
  assert.equal(pipeline(context).ok, true);
  assert.equal(context.calls.dryRun, 0);
  assert.equal(context.calls.generate, 0);
});

test('installation failure stops schema, artifacts and deployment', () => {
  const context = load();
  vm.runInContext(
    'aerpInstallCheck = function () { calls.install += 1; return { ok: false }; };',
    context
  );
  const result = pipeline(context);
  assert.equal(result.ok, false);
  assert.equal(context.calls.schema, 0);
  assert.equal(context.calls.metadata, 0);
  assertNoDeployment(context);
});

test('FrameworkSchema failure stops every in-memory stage and deployment', () => {
  const context = load();
  vm.runInContext(
    'aerpBuildFrameworkSchema = function () { calls.schema += 1; return null; };',
    context
  );
  const result = pipeline(context);
  assert.equal(result.ok, false);
  assert.equal(context.calls.metadata, 0);
  assert.equal(context.calls.generator, 0);
  assertNoDeployment(context);
});

test('bundle failure prevents all deployment writes', () => {
  const context = load();
  vm.runInContext(
    'aerpBuildSingleMetadataArtifactsFromFrameworkSchema = function () { return aerpSbpFailure_("SB_INTERNAL_ERROR"); };',
    context
  );
  assert.equal(pipeline(context).ok, false);
  assertNoDeployment(context);
});

test('invalid lineage and failed frozen validation prevent all writes', () => {
  for (const replacement of [
    'aerpBuildSingleMetadataArtifactsFromFrameworkSchema = function (schema) { var valid = originalBundle(schema); var copy = JSON.parse(JSON.stringify(valid)); copy.lineage.metadataFingerprint = "0".repeat(64); return aerpSbpCloneAndDeepFreeze_(copy); };',
    'aerpValidateFrozenSingleBuildBundle_ = function () { return false; };'
  ]) {
    const context = load();
    vm.runInContext(replacement, context);
    assert.equal(pipeline(context).ok, false);
    assertNoDeployment(context);
  }
});

test('writer failure returns sanitized failure and never declares success', () => {
  const context = load();
  vm.runInContext(
    'aerpWriteAppSheetPackageSummary_ = function () { calls.packageWrite += 1; throw new Error("PRIVATE_WRITE_CORE_PRIVATE"); };',
    context
  );
  const result = pipeline(context);
  assert.equal(result.ok, false);
  assert.equal(result.message, 'No fue posible completar las escrituras operativas.');
  assert.doesNotMatch(
    JSON.stringify({ result, events: context.events }),
    /PRIVATE|CORE_PRIVATE|metadataFingerprint|stack/
  );
});

test('every pre-success failure releases once, fails closed and never marks deployment OK', () => {
  const failures = [
    'aerpStartBuildMonitor = function () { throw new Error("PRIVATE_MONITOR"); };',
    'aerpInstallCheck = function () { calls.install += 1; throw new Error("PRIVATE_INSTALL"); };',
    'aerpBuildFrameworkSchema = function () { calls.schema += 1; throw new Error("PRIVATE_SCHEMA"); };',
    'aerpBuildSingleMetadataArtifactsFromFrameworkSchema = function () { throw new Error("PRIVATE_BUNDLE"); };',
    'aerpValidateFrozenSingleBuildBundle_ = function () { calls.finalValidation += 1; return false; };',
    'aerpWriteDeploymentLog_ = function () { calls.deploymentLog += 1; throw new Error("PRIVATE_PENDING"); };',
    'aerpWriteAppSheetPackageSummary_ = function () { calls.packageWrite += 1; throw new Error("PRIVATE_PACKAGE"); };',
    'aerpBuildStep = function (_sheet, step, status) { events.push("STEP:" + step + ":" + status); if (step === "Deployment" && status === "LISTO_PARA_CONFIRMAR") throw new Error("PRIVATE_MONITOR_STEP"); };',
    'aerpBuildPipelineSummary_ = function () { calls.buildSummary += 1; throw new Error("PRIVATE_SUMMARY"); };'
  ];
  for (const replacement of failures) {
    const context = load();
    vm.runInContext(replacement, context);
    const result = pipeline(context);
    assert.equal(result.ok, false);
    assert.equal(Object.hasOwn(result, 'status'), false);
    assert.equal(context.calls.release, 1);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE|stack|metadataFingerprint/);
    assert.equal(context.events.includes('WRITE:OK'), false);
  }
});

test('failed final OK transition returns failure and attempts ERROR without later writes', () => {
  const context = load();
  vm.runInContext(
    [
      'aerpFinalizeDeploymentLog_ = function (_receipt, status) {',
      '  calls.finalize += 1;',
      '  events.push("WRITE:" + status + "_ATTEMPT");',
      '  if (status === "OK") throw new Error("PRIVATE_OK_WRITE");',
      '};'
    ].join('\n'),
    context
  );
  const result = pipeline(context);
  assert.equal(result.ok, false);
  assert.equal(context.calls.release, 1);
  const events = plain(context.events);
  const okAttempt = events.indexOf('WRITE:OK_ATTEMPT');
  const errorAttempt = events.indexOf('WRITE:ERROR_ATTEMPT');
  assert.ok(okAttempt >= 0);
  assert.ok(errorAttempt > okAttempt);
  assert.equal(events.at(-1), 'LOCK:RELEASE');
});

test('authoritative deployment status is the final physical write in the finalizer', () => {
  const context = load();
  vm.runInContext(
    [
      'physicalWrites = [];',
      'receipt = { row: 2, sheet: { getRange: function (_row, column) {',
      '  return { setValue: function (value) { physicalWrites.push({ column: column, value: value }); } };',
      '} } };',
      'originalFinalizeWriter(receipt, "OK", new Date(0));'
    ].join('\n'),
    context
  );
  assert.equal(context.physicalWrites.length, 2);
  assert.equal(context.physicalWrites[0].column, 9);
  assert.deepEqual(plain(context.physicalWrites[1]), { column: 2, value: 'OK' });
});

test('failure remains sanitized when best-effort ERROR transition also fails', () => {
  const context = load();
  vm.runInContext(
    [
      'aerpWriteAppSheetPackageSummary_ = function () { throw new Error("PRIVATE_PACKAGE"); };',
      'aerpFinalizeDeploymentLog_ = function () { throw new Error("PRIVATE_ERROR_MARK"); };'
    ].join('\n'),
    context
  );
  const result = pipeline(context);
  assert.equal(result.ok, false);
  assert.equal(context.calls.release, 1);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|stack/);
});

test('operational writer rejects an invalid bundle before spreadsheet access', () => {
  const context = load();
  vm.runInContext(
    [
      'spreadsheetCalls = 0;',
      'aerpGetSpreadsheet = function () { spreadsheetCalls += 1; throw new Error("PRIVATE_SHEET"); };',
      'invalidBundle = aerpSbpCloneAndDeepFreeze_({ ok: true });'
    ].join('\n'),
    context
  );
  assert.throws(
    () => vm.runInContext('originalDeploymentWriter(invalidBundle, new Date(0))', context),
    /AERP_DEPLOYMENT_BUNDLE_INVALID/
  );
  assert.equal(context.spreadsheetCalls, 0);
});

test('Deployment delegates once to Pipeline and performs no writes of its own', () => {
  const context = load();
  vm.runInContext(
    'aerpRunBuildPipeline = function () { calls.pipeline += 1; return { ok: true, message: "OK", summary: { contractVersion: "1.0.0", tables: 1, columns: 1, primaryKeys: 1, foreignKeys: 0, labels: 0, forms: 1, views: 1, menus: 1, warnings: 0, errors: 0, durationMs: 1 }, warnings: [] }; };',
    context
  );
  const result = vm.runInContext('runGenerarERP()', context);
  assert.equal(result.ok, true);
  assert.equal(context.calls.pipeline, 1);
  assertNoDeployment(context);
  assert.deepEqual(Object.keys(plain(result)).sort(), [
    'durationMs',
    'errors',
    'message',
    'ok',
    'status',
    'summary',
    'warnings'
  ]);
});

test('Deployment and Workflow public routes acquire only Pipeline document lock', () => {
  for (const expression of ['runGenerarERP()', 'aerpRunBuildWorkflow()']) {
    const context = load();
    const result = vm.runInContext(expression, context);
    assert.equal(result.ok, true);
    assert.equal(context.calls.lock, 1);
    assert.equal(context.calls.release, 1);
    assert.equal(context.calls.schema, 1);
    assert.equal(context.calls.deploymentLog, 1);
  }
});

test('Deployment preserves its complete fail-closed public shape when Pipeline fails', () => {
  const context = load();
  vm.runInContext(
    'aerpRunBuildPipeline = function () { calls.pipeline += 1; return { ok: false, message: "PRIVATE_PIPELINE" }; };',
    context
  );
  const result = vm.runInContext('runGenerarERP()', context);
  assert.equal(result.ok, false);
  assert.equal(context.calls.pipeline, 1);
  assert.deepEqual(Object.keys(plain(result)).sort(), [
    'durationMs',
    'errors',
    'message',
    'ok',
    'status',
    'summary',
    'warnings'
  ]);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_PIPELINE/);
  assertNoDeployment(context);
});

test('Workflow delegates once without acquiring a second lock', () => {
  const context = load();
  vm.runInContext(
    'aerpRunBuildPipeline = function () { calls.pipeline += 1; return { ok: true, message: "OK", summary: { contractVersion: "1.0.0", tables: 2, columns: 3, primaryKeys: 2, foreignKeys: 1, labels: 1, forms: 2, views: 2, menus: 2, warnings: 0, errors: 0, durationMs: 1 }, warnings: [] }; };',
    context
  );
  const result = vm.runInContext('aerpRunBuildWorkflow()', context);
  assert.equal(result.ok, true);
  assert.equal(context.calls.lock, 0);
  assert.equal(context.calls.pipeline, 1);
  assert.equal(context.calls.release, 0);
  assert.deepEqual(plain(result.metadata), {
    tables: 2,
    columns: 3,
    primaryKeys: 2,
    foreignKeys: 1,
    labels: 1
  });
  assert.equal(context.calls.generate, 0);
  assertNoDeployment(context);
});

test('Workflow sanitizes Pipeline exceptions without owning a lock', () => {
  const context = load();
  vm.runInContext(
    'aerpRunBuildPipeline = function () { calls.pipeline += 1; throw new Error("PRIVATE_WORKFLOW_CORE_PRIVATE"); };',
    context
  );
  const result = vm.runInContext('aerpRunBuildWorkflow()', context);
  assert.equal(result.ok, false);
  assert.equal(result.metadata, null);
  assert.equal(context.calls.release, 0);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|CORE_PRIVATE|stack/);
});

test('Workflow fails closed without nested locking for a failed Pipeline result', () => {
  const context = load();
  vm.runInContext(
    'aerpRunBuildPipeline = function () { calls.pipeline += 1; return { ok: false, message: "PRIVATE_FAILED" }; };',
    context
  );
  const result = vm.runInContext('aerpRunBuildWorkflow()', context);
  assert.equal(result.ok, false);
  assert.equal(result.metadata, null);
  assert.equal(context.calls.pipeline, 1);
  assert.equal(context.calls.release, 0);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_FAILED/);
});

test('public Pipeline response and monitor telemetry expose no artifacts or sensitive values', () => {
  const context = load();
  const result = pipeline(context);
  assert.deepEqual(Object.keys(plain(result)).sort(), ['message', 'ok', 'summary', 'warnings']);
  const serialized = JSON.stringify({ result, events: context.events });
  assert.doesNotMatch(serialized, /CORE_PRIVATE|PrivateKey|metadataFingerprint|COL_PRIVATE_PK/);
});

test('repeated Pipeline calls rebuild all artifacts and reuse no prior execution', () => {
  const context = load();
  assert.equal(pipeline(context).ok, true);
  assert.equal(pipeline(context).ok, true);
  assert.equal(context.calls.schema, 2);
  assert.equal(context.calls.metadata, 2);
  assert.equal(context.calls.generator, 2);
  assert.equal(context.calls.appSheet, 2);
  assert.equal(context.calls.validation, 2);
});

test('there is one canonical DryRun declaration and no persistent single-build state', () => {
  const allProduction = fs
    .readdirSync(__dirname)
    .filter(file => /^\d+_.+\.js$/.test(file))
    .map(file => fs.readFileSync(path.join(__dirname, file), 'utf8'))
    .join('\n');
  assert.equal((allProduction.match(/function\s+runAlefERPDryRun\s*\(/g) || []).length, 1);
  const operational = [
    sourceByFile['20_BuildPipeline.js'],
    sourceByFile['17_DeploymentMVP.js'],
    sourceByFile['21_BuildWorkflow.js']
  ].join('\n');
  assert.doesNotMatch(operational, /PropertiesService|CacheService|singleton/i);
});

test('legacy build entrypoints are disabled and cannot generate, run Pipeline or write', () => {
  for (const entrypoint of ['runAlefERP()', 'runAlefERPRebuild()', 'runAlefERPUpdate()']) {
    const context = load();
    const result = vm.runInContext(entrypoint, context);
    assert.equal(result.ok, false);
    assert.equal(result.status, 'LEGACY_ENTRYPOINT_DISABLED');
    assert.equal(context.calls.pipeline, 0);
    assert.equal(context.calls.generate, 0);
    assertNoDeployment(context);
  }
});

test('runSincronizarMetadata remains the unique explicit rebuild route', () => {
  const context = load();
  vm.runInContext(
    'AERP_MODES = { REBUILD: "rebuild" }; aerpGenerate = function (mode) { calls.generate += 1; return { mode: mode, inserted: 1, updated: 0, skipped: 0, total: 1, warnings: [] }; };',
    context
  );
  const result = vm.runInContext('runSincronizarMetadata()', context);
  assert.equal(result.ok, true);
  assert.equal(context.calls.generate, 1);
  assert.equal(context.calls.pipeline, 0);
  assertNoDeployment(context);
});

test('all Generar ERP routes are statically separated from CORE_COLUMNAS synchronization', () => {
  const pipelineSource = sourceByFile['20_BuildPipeline.js'];
  const pipelineFlow = pipelineSource.slice(
    pipelineSource.indexOf('function aerpRunBuildPipeline()'),
    pipelineSource.indexOf('function aerpBuildPipelineSummary_')
  );
  const deploymentSource = sourceByFile['17_DeploymentMVP.js'];
  const deploymentFlow = deploymentSource.slice(
    deploymentSource.indexOf('function runGenerarERP()'),
    deploymentSource.indexOf('function runSincronizarMetadata()')
  );
  const workflowSource = sourceByFile['21_BuildWorkflow.js'];
  for (const source of [pipelineFlow, deploymentFlow, workflowSource]) {
    assert.doesNotMatch(source, /aerpGenerate\(|CORE_COLUMNAS|runAlefERPDryRun\(/);
  }
  assert.match(deploymentSource, /function runSincronizarMetadata\(\)/);
  assert.match(deploymentSource, /aerpGenerate\(AERP_MODES\.REBUILD\)/);
});
