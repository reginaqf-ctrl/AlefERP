/* global require, __dirname */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const sources = [
  'AERP-038A_MetadataBuilderEnterprise.js',
  '14_MetadataBuilder.js',
  '15_GeneratorEngine.js',
  '16_AppSheetGenerator.js',
  '12_DryRun.js',
  '20_BuildPipeline.js'
].map(file => fs.readFileSync(path.join(__dirname, file), 'utf8'));
const dryRunSource = sources[4];
const pipelineSource = sources[5];

function frameworkSchema() {
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
            Nombre_Campo: 'Clave',
            Nombre_Mostrar: 'Clave',
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertDeepFrozen(value) {
  const pending = [value];
  const seen = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    assert.equal(Object.isFrozen(current), true);
    pending.push(...Object.values(current));
  }
}

function load() {
  const context = vm.createContext({
    calls: { schema: 0, strict: 0, metadata: 0, generator: 0, appSheet: 0, validation: 0 },
    identities: {}
  });
  vm.runInContext(sources.join('\n'), context);
  context.schemaFixture = vm.runInContext('(' + JSON.stringify(frameworkSchema()) + ')', context);
  vm.runInContext(
    [
      'originalStrict = aerpBuildMetadataModelFromSchema;',
      'originalMetadata = aerpBuildMetadataModelFromFrameworkSchema;',
      'originalGenerator = aerpBuildGeneratorEngineMVPFromMetadataModel;',
      'originalAppSheet = aerpBuildAppSheetPackageFromGenerator;',
      'originalValidation = aerpValidateSingleBuildArtifacts;',
      'aerpBuildFrameworkSchema = function () { calls.schema += 1; return schemaFixture; };',
      'aerpBuildMetadataModelFromSchema = function (schema) { calls.strict += 1; identities.strictSchema = schema === schemaFixture; return originalStrict(schema); };',
      'aerpBuildMetadataModelFromFrameworkSchema = function (schema) { calls.metadata += 1; identities.metadataSchema = schema === schemaFixture; identities.metadataOutput = originalMetadata(schema); return identities.metadataOutput; };',
      'aerpBuildGeneratorEngineMVPFromMetadataModel = function (model) { calls.generator += 1; identities.generatorReceivesMetadata = model === identities.metadataOutput; identities.generatorOutput = originalGenerator(model); return identities.generatorOutput; };',
      'aerpBuildAppSheetPackageFromGenerator = function (generator) { calls.appSheet += 1; identities.appSheetReceivesGenerator = generator === identities.generatorOutput; identities.appSheetOutput = originalAppSheet(generator); return identities.appSheetOutput; };',
      'aerpValidateSingleBuildArtifacts = function (artifacts) { calls.validation += 1; identities.validationReceivesArtifacts = artifacts.metadataModel === identities.metadataOutput && artifacts.generatorResult === identities.generatorOutput && artifacts.appSheetResult === identities.appSheetOutput; return originalValidation(artifacts); };'
    ].join('\n'),
    context
  );
  return context;
}

function build(context) {
  return vm.runInContext(
    'aerpBuildSingleMetadataArtifactsFromFrameworkSchema(schemaFixture)',
    context
  );
}

function mutableBundle(context) {
  context.frozenBundleFixture = build(context);
  context.bundleFixture = vm.runInContext(
    'JSON.parse(JSON.stringify(frozenBundleFixture))',
    context
  );
  return context.bundleFixture;
}

function assertClosed(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.metadataModel, null);
  assert.equal(result.generatorResult, null);
  assert.equal(result.appSheetResult, null);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, code);
  assert.deepEqual(plain(result.summary), {
    contractVersion: '1.0.0',
    tables: 0,
    columns: 0,
    primaryKeys: 0,
    foreignKeys: 0,
    labels: 0,
    forms: 0,
    views: 0,
    menus: 0
  });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|stack|CORE_ITEMS|Clave/);
}

test('pure MetadataModel API uses the supplied FrameworkSchema exactly once without rebuilding it', () => {
  const context = load();
  const result = vm.runInContext(
    'aerpBuildMetadataModelFromFrameworkSchema(schemaFixture)',
    context
  );
  assert.equal(result.summary.ok, true);
  assert.equal(context.calls.schema, 0);
  assert.equal(context.calls.strict, 1);
  assert.equal(context.identities.strictSchema, true);
  assert.equal(result.generatedAt, null);
  assert.equal(result.summary.durationMs, 0);
});

test('public MetadataModel wrapper remains compatible and builds FrameworkSchema once', () => {
  const context = load();
  const result = vm.runInContext('aerpBuildMetadataModel()', context);
  assert.equal(result.summary.ok, true);
  assert.equal(context.calls.schema, 1);
  assert.equal(context.calls.metadata, 1);
  assert.equal(context.calls.strict, 1);
  assert.equal(Object.prototype.toString.call(result.generatedAt), '[object Date]');
});

test('pure MetadataModel API fails closed for invalid schema and strict builder exceptions', () => {
  for (const expression of [
    'schemaFixture = null',
    'aerpBuildMetadataModelFromSchema = function () { throw new Error("PRIVATE_STRICT"); }'
  ]) {
    const context = load();
    vm.runInContext(expression, context);
    const result = vm.runInContext(
      'aerpBuildMetadataModelFromFrameworkSchema(schemaFixture)',
      context
    );
    assert.equal(result.summary.ok, false);
    assert.deepEqual(plain(result.tables), []);
    assert.equal(result.generatedAt, null);
    assert.equal(result.summary.durationMs, 0);
    assert.equal(result.summary.diagnostics[0].code, 'MBE_INTERNAL_ERROR');
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|stack/);
  }
});

test('pure MetadataModel API does not execute a hostile FrameworkSchema version accessor', () => {
  const context = load();
  context.getterCalls = 0;
  vm.runInContext(
    'Object.defineProperty(schemaFixture, "version", { get: function () { getterCalls += 1; throw new Error("PRIVATE_GETTER"); } })',
    context
  );
  const result = vm.runInContext(
    'aerpBuildMetadataModelFromFrameworkSchema(schemaFixture)',
    context
  );
  assert.equal(result.summary.ok, false);
  assert.equal(context.getterCalls, 0);
});

test('single-build calls each stage and validation exactly once', () => {
  const context = load();
  const result = build(context);
  assert.equal(result.ok, true);
  assert.deepEqual(plain(context.calls), {
    schema: 0,
    strict: 1,
    metadata: 1,
    generator: 1,
    appSheet: 1,
    validation: 1
  });
});

test('each stage and validation receive the exact immediately preceding artifact', () => {
  const context = load();
  const result = build(context);
  assert.equal(context.identities.metadataSchema, true);
  assert.equal(context.identities.generatorReceivesMetadata, true);
  assert.equal(context.identities.appSheetReceivesGenerator, true);
  assert.equal(context.identities.validationReceivesArtifacts, true);
  assert.notEqual(context.identities.metadataOutput, result.metadataModel);
});

test('single-build never calls public Generator or AppSheet wrappers', () => {
  const context = load();
  vm.runInContext(
    [
      'aerpBuildGeneratorEngineMVP = function () { throw new Error("PRIVATE_PUBLIC_GENERATOR"); };',
      'aerpBuildAppSheetPackage = function () { throw new Error("PRIVATE_PUBLIC_APPSHEET"); };'
    ].join('\n'),
    context
  );
  assert.equal(build(context).ok, true);
});

test('MetadataModel failure stops Generator, AppSheet and validation', () => {
  const context = load();
  vm.runInContext(
    'aerpBuildMetadataModelFromFrameworkSchema = function () { calls.metadata += 1; return aerpBuildLegacyMetadataFailureFromVersion_("2.0.0"); };',
    context
  );
  assertClosed(build(context), 'SB_METADATA_MODEL_FAILED');
  assert.equal(context.calls.generator, 0);
  assert.equal(context.calls.appSheet, 0);
  assert.equal(context.calls.validation, 0);
});

test('Generator failure stops AppSheet and validation', () => {
  const context = load();
  vm.runInContext(
    'aerpBuildGeneratorEngineMVPFromMetadataModel = function () { calls.generator += 1; return aerpGenFailure_("GEN_INTERNAL_ERROR", AERP_GEN_ERROR_MESSAGE_); };',
    context
  );
  assertClosed(build(context), 'SB_GENERATOR_FAILED');
  assert.equal(context.calls.appSheet, 0);
  assert.equal(context.calls.validation, 0);
});

test('AppSheet failure stops validation', () => {
  const context = load();
  vm.runInContext(
    'aerpBuildAppSheetPackageFromGenerator = function () { calls.appSheet += 1; return aerpAsgFailure_("ASG_INTERNAL_ERROR", AERP_ASG_ERROR_MESSAGE_); };',
    context
  );
  assertClosed(build(context), 'SB_APPSHEET_FAILED');
  assert.equal(context.calls.validation, 0);
});

test('validation failure removes every artifact', () => {
  const context = load();
  vm.runInContext(
    'aerpValidateSingleBuildArtifacts = function () { calls.validation += 1; return aerpSbValidationFailure_(); };',
    context
  );
  assertClosed(build(context), 'SB_VALIDATION_FAILED');
});

test('unexpected exceptions are fixed, sanitized and fail closed', () => {
  for (const replacement of [
    'aerpBuildMetadataModelFromFrameworkSchema = function () { throw new Error("PRIVATE_METADATA"); };',
    'aerpBuildGeneratorEngineMVPFromMetadataModel = function () { throw new Error("PRIVATE_GENERATOR"); };',
    'aerpBuildAppSheetPackageFromGenerator = function () { throw new Error("PRIVATE_APPSHEET"); };',
    'aerpValidateSingleBuildArtifacts = function () { throw new Error("PRIVATE_VALIDATION"); };'
  ]) {
    const context = load();
    vm.runInContext(replacement, context);
    assertClosed(build(context), 'SB_INTERNAL_ERROR');
  }
});

test('pure flow does not use Apps Script services, clocks, UUID or global build state', () => {
  const context = load();
  vm.runInContext(
    [
      'var NativeDate = Date;',
      'Date = function (value) { if (arguments.length === 0) throw new Error("PRIVATE_CLOCK"); return new NativeDate(value); };',
      'Date.prototype = NativeDate.prototype;',
      'Object.defineProperty(this, "SpreadsheetApp", { get: function () { throw new Error("PRIVATE_SHEETS"); } });',
      'Object.defineProperty(this, "Logger", { get: function () { throw new Error("PRIVATE_LOGGER"); } });',
      'Object.defineProperty(this, "Utilities", { get: function () { throw new Error("PRIVATE_UUID"); } });',
      'Object.defineProperty(this, "LockService", { get: function () { throw new Error("PRIVATE_LOCK"); } });',
      'Object.defineProperty(this, "PropertiesService", { get: function () { throw new Error("PRIVATE_PROPERTIES"); } });'
    ].join('\n'),
    context
  );
  assert.equal(build(context).ok, true);
});

test('input remains unchanged and output shares no mutable references with FrameworkSchema', () => {
  const context = load();
  const before = plain(context.schemaFixture);
  const result = build(context);
  const serializedResult = JSON.stringify(result);
  assertDeepFrozen(result);
  assert.deepEqual(plain(context.schemaFixture), before);
  assert.notEqual(result.metadataModel, context.identities.metadataOutput);
  assert.notEqual(result.generatorResult, context.identities.generatorOutput);
  assert.notEqual(result.appSheetResult, context.identities.appSheetOutput);
  assert.equal(context.schemaFixture.tables[0].columns[0].Nombre_Campo, 'Clave');
  context.schemaFixture.tables[0].columns[0].Nombre_Campo = 'ChangedAfterBuild';
  context.schemaFixture.tables.push(clone(context.schemaFixture.tables[0]));
  assert.equal(JSON.stringify(result), serializedResult);
});

test('single-build output is deterministic and JSON serializable', () => {
  const first = plain(build(load()));
  const second = plain(build(load()));
  assert.deepEqual(first, second);
  assert.doesNotThrow(() => JSON.stringify(first));
});

test('pure SHA-256 lineage is standard, propagated and excludes only approved telemetry', () => {
  const context = load();
  assert.equal(
    vm.runInContext('aerpLineageSha256_("abc")', context),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
  const result = build(context);
  assert.deepEqual(plain(result.lineage), plain(result.generatorResult.lineage));
  assert.deepEqual(plain(result.lineage), plain(result.appSheetResult.lineage));
  context.metadataFixture = vm.runInContext(
    'JSON.parse(JSON.stringify(identities.metadataOutput))',
    context
  );
  const original = vm.runInContext('aerpBuildMetadataLineage_(metadataFixture)', context);
  vm.runInContext(
    'metadataFixture.generatedAt = "2099-01-01T00:00:00.000Z"; metadataFixture.summary.durationMs = 999;',
    context
  );
  const telemetryChanged = vm.runInContext('aerpBuildMetadataLineage_(metadataFixture)', context);
  assert.deepEqual(plain(telemetryChanged), plain(original));
  vm.runInContext('metadataFixture.tables[0].prefix = "ALTERED";', context);
  const contractualChanged = vm.runInContext('aerpBuildMetadataLineage_(metadataFixture)', context);
  assert.notEqual(contractualChanged.metadataFingerprint, original.metadataFingerprint);
});

test('product SHA-256 matches fixed standard vectors across UTF-8 and padding boundaries', () => {
  const context = load();
  const vectors = [
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['ñ', '024bb90888ca89a15a19e9bdd8c712bfb070465fce1ef25e43c170ea44fc5e5f'],
    ['😀', 'f0443a342c5ef54783a111b51ba56c938e474c32324d90c3a60c9c8e3a37e2d9'],
    ['A😀ñ𝄞', '4bd4d360949bbcc4ea5c6b8f5f7e969452f36599d1407175261b47035d03bd83'],
    ['a'.repeat(55), '9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318'],
    ['a'.repeat(56), 'b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a'],
    ['a'.repeat(63), '7d3e74a05d7db15bce4ad9ec0658ea98e3f06eeecf16b4c6fff2da457ddc2f34'],
    ['a'.repeat(64), 'ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb'],
    ['a'.repeat(65), '635361c48bb9eab14198e76ea8ab7f1a41685d6ad62aa9146d301d4f17eb0ae0'],
    ['a'.repeat(1000000), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0']
  ];
  for (const [input, expected] of vectors) {
    context.shaInput = input;
    const actual = vm.runInContext('aerpLineageSha256_(shaInput)', context);
    assert.equal(actual, expected);
    assert.equal(actual.length, 64);
    assert.match(actual, /^[0-9a-f]{64}$/);
  }
});

test('product canonicalization excludes telemetry only at its contractual paths', () => {
  const context = load();
  vm.runInContext(
    [
      'canonicalFixture = {',
      ' generatedAt: "ROOT_TELEMETRY",',
      ' summary: { durationMs: 10, generatedAt: "SUMMARY_BUSINESS" },',
      ' business: { generatedAt: "BUSINESS_GENERATED", durationMs: "BUSINESS_DURATION" },',
      ' nested: { summary: { durationMs: "NESTED_DURATION" } }',
      '};'
    ].join('\n'),
    context
  );
  const canonical = vm.runInContext(
    'aerpLineageCanonicalize_(canonicalFixture, "$", new WeakSet(), 0)',
    context
  );
  const parsed = JSON.parse(canonical);
  assert.equal(Object.hasOwn(parsed, 'generatedAt'), false);
  assert.equal(Object.hasOwn(parsed.summary, 'durationMs'), false);
  assert.equal(parsed.summary.generatedAt, 'SUMMARY_BUSINESS');
  assert.equal(parsed.business.generatedAt, 'BUSINESS_GENERATED');
  assert.equal(parsed.business.durationMs, 'BUSINESS_DURATION');
  assert.equal(parsed.nested.summary.durationMs, 'NESTED_DURATION');

  const baseline = vm.runInContext('aerpBuildMetadataLineage_(canonicalFixture)', context);
  vm.runInContext(
    'canonicalFixture.generatedAt = "OTHER_ROOT"; canonicalFixture.summary.durationMs = 999;',
    context
  );
  const telemetryOnly = vm.runInContext('aerpBuildMetadataLineage_(canonicalFixture)', context);
  assert.equal(telemetryOnly.metadataFingerprint, baseline.metadataFingerprint);
  vm.runInContext('canonicalFixture.business.generatedAt = "OTHER_BUSINESS";', context);
  const businessGeneratedAt = vm.runInContext(
    'aerpBuildMetadataLineage_(canonicalFixture)',
    context
  );
  assert.notEqual(businessGeneratedAt.metadataFingerprint, baseline.metadataFingerprint);
  vm.runInContext(
    'canonicalFixture.business.generatedAt = "BUSINESS_GENERATED"; canonicalFixture.nested.summary.durationMs = "OTHER_NESTED";',
    context
  );
  const businessDuration = vm.runInContext('aerpBuildMetadataLineage_(canonicalFixture)', context);
  assert.notEqual(businessDuration.metadataFingerprint, baseline.metadataFingerprint);
});

test('product canonicalization rejects unsupported root and nested values fail closed', () => {
  const context = load();
  const hostileExpressions = [
    'NaN',
    'Infinity',
    '-Infinity',
    'undefined',
    '(function () {})',
    '1n',
    'new Date(0)',
    '/private/'
  ];
  for (const expression of hostileExpressions) {
    assert.equal(
      vm.runInContext(
        'aerpLineageCanonicalize_((' + expression + '), "$", new WeakSet(), 0)',
        context
      ),
      null
    );
    assert.equal(
      vm.runInContext(
        'aerpLineageCanonicalize_({ nested: { value: (' +
          expression +
          ') } }, "$", new WeakSet(), 0)',
        context
      ),
      null
    );
  }
});

test('lineage rejects mixed builds and inconsistent fingerprints', () => {
  const firstContext = load();
  const first = plain(build(firstContext));
  const secondContext = load();
  vm.runInContext('schemaFixture.tables[0].prefix = "ALT";', secondContext);
  const second = plain(build(secondContext));
  assert.notEqual(first.lineage.metadataFingerprint, second.lineage.metadataFingerprint);

  const context = load();
  context.bundleFixture = vm.runInContext('(' + JSON.stringify(first) + ')', context);
  context.foreignGenerator = vm.runInContext(
    '(' + JSON.stringify(second.generatorResult) + ')',
    context
  );
  context.foreignAppSheet = vm.runInContext(
    '(' + JSON.stringify(second.appSheetResult) + ')',
    context
  );
  vm.runInContext(
    'bundleFixture.generatorResult = foreignGenerator; bundleFixture.appSheetResult = foreignAppSheet;',
    context
  );
  assert.equal(vm.runInContext('originalValidation(bundleFixture).ok', context), false);
  vm.runInContext(
    'bundleFixture.generatorResult.lineage.metadataFingerprint = "0".repeat(64);',
    context
  );
  assert.equal(vm.runInContext('originalValidation(bundleFixture).ok', context), false);
});

test('lineage distinguishes projected and non-projected model changes with equal versions and counts', () => {
  const baseContext = load();
  const base = plain(build(baseContext));
  const identical = plain(build(load()));
  assert.equal(base.lineage.metadataFingerprint, identical.lineage.metadataFingerprint);

  const projectedContext = load();
  vm.runInContext(
    'schemaFixture.tables[0].columns[0].Nombre_Mostrar = "Clave visible";',
    projectedContext
  );
  const projected = plain(build(projectedContext));
  const nonProjectedContext = load();
  vm.runInContext('schemaFixture.tables[0].prefix = "ALT";', nonProjectedContext);
  const nonProjected = plain(build(nonProjectedContext));
  for (const changed of [projected, nonProjected]) {
    assert.equal(changed.metadataModel.version, base.metadataModel.version);
    assert.deepEqual(changed.summary, base.summary);
    assert.notEqual(changed.lineage.metadataFingerprint, base.lineage.metadataFingerprint);
  }
});

test('validator rejects every cross-stage build mixture and invalid lineage shape', () => {
  const first = plain(build(load()));
  const secondContext = load();
  vm.runInContext('schemaFixture.tables[0].prefix = "ALT";', secondContext);
  const second = plain(build(secondContext));
  const mixtures = [
    {
      metadataModel: first.metadataModel,
      generatorResult: second.generatorResult,
      appSheetResult: second.appSheetResult
    },
    {
      metadataModel: first.metadataModel,
      generatorResult: first.generatorResult,
      appSheetResult: second.appSheetResult
    },
    {
      metadataModel: second.metadataModel,
      generatorResult: first.generatorResult,
      appSheetResult: second.appSheetResult
    }
  ];
  for (const mixture of mixtures) {
    const context = load();
    const candidate = { ...first, ...mixture };
    context.bundleFixture = vm.runInContext('(' + JSON.stringify(candidate) + ')', context);
    assertClosed(
      vm.runInContext('originalValidation(bundleFixture)', context),
      'SBV_ARTIFACTS_INVALID'
    );
  }

  for (const expression of [
    'delete bundleFixture.lineage',
    'bundleFixture.lineage.metadataFingerprint = "bad"',
    'bundleFixture.lineage.algorithm = "UNKNOWN"',
    'bundleFixture.lineage.version = "2.0.0"',
    'delete bundleFixture.generatorResult.lineage',
    'bundleFixture.appSheetResult.lineage.metadataFingerprint = "0".repeat(64)'
  ]) {
    const context = load();
    mutableBundle(context);
    vm.runInContext(expression, context);
    assertClosed(
      vm.runInContext('originalValidation(bundleFixture)', context),
      'SBV_ARTIFACTS_INVALID'
    );
  }
});

test('lineage canonicalization rejects accessors, Symbols, sparse arrays, altered prototypes and cycles', () => {
  const expressions = [
    'Object.defineProperty(metadataFixture.tables[0], "prefix", { get: function () { getterCalls += 1; throw new Error("PRIVATE"); } })',
    'metadataFixture.tables[0][Symbol("x")] = true',
    'metadataFixture.tables = new Array(1)',
    'metadataFixture.tables.extra = true',
    'Object.setPrototypeOf(metadataFixture.tables[0], null)',
    'metadataFixture.tables[0].unknown = Object.create(null)',
    'metadataFixture.tables[0].cycle = metadataFixture'
  ];
  for (const expression of expressions) {
    const context = load();
    build(context);
    context.metadataFixture = vm.runInContext(
      'JSON.parse(JSON.stringify(identities.metadataOutput))',
      context
    );
    context.getterCalls = 0;
    vm.runInContext(expression, context);
    assert.equal(vm.runInContext('aerpBuildMetadataLineage_(metadataFixture)', context), null);
    assert.equal(context.getterCalls, 0);
  }
});

test('artifact validation accepts the nominal bundle and returns sanitized summary only', () => {
  const context = load();
  const result = build(context);
  context.bundleFixture = result;
  const validation = vm.runInContext('originalValidation(bundleFixture)', context);
  assert.equal(validation.ok, true);
  assert.deepEqual(Object.keys(plain(validation)).sort(), ['diagnostics', 'ok', 'summary']);
  assert.doesNotMatch(JSON.stringify(validation), /CORE_ITEMS|Clave/);
});

test('artifact validation rejects accessors without executing getters', () => {
  const context = load();
  mutableBundle(context);
  context.getterCalls = 0;
  vm.runInContext(
    'Object.defineProperty(bundleFixture, "summary", { get: function () { getterCalls += 1; throw new Error("PRIVATE_GETTER"); } })',
    context
  );
  const validation = vm.runInContext('originalValidation(bundleFixture)', context);
  assert.equal(validation.ok, false);
  assert.equal(context.getterCalls, 0);
});

test('artifact validation never executes a nested AppSheet package accessor and fails closed', () => {
  const context = load();
  mutableBundle(context);
  context.getterCalls = 0;
  vm.runInContext(
    [
      'var hostileApp = { ok: true, lineage: bundleFixture.appSheetResult.lineage, summary: bundleFixture.appSheetResult.summary, warnings: [], errors: [], diagnostics: [] };',
      'Object.defineProperty(hostileApp, "package", { get: function () { getterCalls += 1; throw new Error("PRIVATE_PACKAGE"); }, enumerable: true });',
      'bundleFixture.appSheetResult = hostileApp;'
    ].join('\n'),
    context
  );
  const validation = vm.runInContext('originalValidation(bundleFixture)', context);
  assertClosed(validation, 'SBV_ARTIFACTS_INVALID');
  assert.equal(context.getterCalls, 0);
});

test('all single-build failures are deeply frozen and contain no partial artifacts', () => {
  const context = load();
  vm.runInContext(
    'aerpBuildGeneratorEngineMVPFromMetadataModel = function () { return aerpGenFailure_("GEN_INTERNAL_ERROR", AERP_GEN_ERROR_MESSAGE_); };',
    context
  );
  const result = build(context);
  assertClosed(result, 'SB_GENERATOR_FAILED');
  assertDeepFrozen(result);
});

test('artifact validation rejects Symbols, sparse arrays and altered prototypes', () => {
  for (const expression of [
    'bundleFixture[Symbol("x")] = true',
    'bundleFixture.diagnostics = new Array(1)',
    'Object.setPrototypeOf(bundleFixture.summary, null)',
    'bundleFixture.generatorResult.forms[Symbol("x")] = true'
  ]) {
    const context = load();
    mutableBundle(context);
    vm.runInContext(expression, context);
    assert.equal(vm.runInContext('originalValidation(bundleFixture).ok', context), false);
  }
});

test('artifact validator hostile matrix fails closed without executing accessors', () => {
  const expressions = [
    'Object.defineProperty(bundleFixture, "summary", { get: function () { getterCalls += 1; throw new Error("PRIVATE_ROOT"); }, enumerable: true })',
    'bundleFixture.summary[Symbol("x")] = true',
    'bundleFixture.metadataModel[Symbol("x")] = true',
    'bundleFixture.generatorResult[Symbol("x")] = true',
    'bundleFixture.appSheetResult[Symbol("x")] = true',
    'Object.defineProperty(bundleFixture.metadataModel.tables[0], "columns", { get: function () { getterCalls += 1; throw new Error("PRIVATE_MODEL"); }, enumerable: true })',
    'Object.defineProperty(bundleFixture.generatorResult.tables[0], "columns", { get: function () { getterCalls += 1; throw new Error("PRIVATE_GENERATOR"); }, enumerable: true })',
    'Object.defineProperty(bundleFixture.appSheetResult, "package", { get: function () { getterCalls += 1; throw new Error("PRIVATE_APPSHEET"); }, enumerable: true })',
    'bundleFixture.generatorResult.tables = new Array(1)',
    'bundleFixture.appSheetResult.package.tables = new Array(1)',
    'bundleFixture.generatorResult.forms.extra = true',
    'bundleFixture.metadataModel.tables.extra = true',
    'bundleFixture.appSheetResult.package.columns.extra = true',
    'Object.setPrototypeOf(bundleFixture.generatorResult.views[0], null)',
    'bundleFixture.metadataModel.unknown = true',
    'bundleFixture.generatorResult.unknown = true',
    'bundleFixture.appSheetResult.unknown = true',
    'bundleFixture.appSheetResult.package.columns[0].unknown = true',
    'bundleFixture.metadataModel.tables[0].plain = Object.create(null)',
    'bundleFixture.appSheetResult.package.menus[0][Symbol("x")] = true',
    'bundleFixture.appSheetResult.package.forms[0].cycle = bundleFixture'
  ];
  for (const expression of expressions) {
    const context = load();
    mutableBundle(context);
    context.getterCalls = 0;
    vm.runInContext(expression, context);
    const validation = vm.runInContext('originalValidation(bundleFixture)', context);
    assertClosed(validation, 'SBV_ARTIFACTS_INVALID');
    assert.equal(context.getterCalls, 0);
  }
});

test('artifact validation rejects modified counts, versions and cross references', () => {
  for (const expression of [
    'bundleFixture.summary.tables += 1',
    'bundleFixture.metadataModel.summary.columns += 1',
    'bundleFixture.generatorResult.application.version = "OTHER"',
    'bundleFixture.generatorResult.views[0].columns = ["MISSING"]',
    'bundleFixture.appSheetResult.package.menus[0].view = "MISSING"'
  ]) {
    const context = load();
    mutableBundle(context);
    vm.runInContext(expression, context);
    const validation = vm.runInContext('originalValidation(bundleFixture)', context);
    assert.equal(validation.ok, false);
    assert.equal(validation.diagnostics[0].code, 'SBV_ARTIFACTS_INVALID');
  }
});

test('physical DryRun remains the canonical legacy read-only implementation in this module', () => {
  assert.match(dryRunSource, /function runAlefERPDryRun\(\)/);
  assert.match(dryRunSource, /const metadata = aerpScanAll\(\)/);
  assert.match(dryRunSource, /const currentData = aerpGetTable\(AERP_SHEETS\.CORE_COLUMNAS\)/);
  assert.doesNotMatch(
    dryRunSource.slice(
      dryRunSource.indexOf('function aerpValidateSingleBuildArtifacts'),
      dryRunSource.indexOf('function runAlefERPDryRun()')
    ),
    /aerpScanAll|aerpGetTable|SpreadsheetApp|Logger|new Date|Utilities|LockService|PropertiesService/
  );
});

test('canonical physical DryRun keeps its public legacy response behavior', () => {
  const context = load();
  vm.runInContext(
    [
      'AERP_VERSION = "2.0.0";',
      'AERP_SHEETS = { CORE_COLUMNAS: "CORE_COLUMNAS" };',
      'Logger = { log: function () {} };',
      'aerpInstallCheck = function () { return { ok: true }; };',
      'aerpScanAll = function () { return [{ Tabla: "T", Nombre_Campo: "A" }, { Tabla: "T", Nombre_Campo: "B" }]; };',
      'aerpValidateMetadata = function () { return { ok: true, errors: [], warnings: [] }; };',
      'aerpGetTable = function () { return { rows: [], headers: [] }; };',
      'aerpBuildExistingColumnIndex = function () { return { "T|A": true }; };',
      'aerpGetRegisteredTables = function () { return [{}]; };'
    ].join('\n'),
    context
  );
  const result = vm.runInContext('runAlefERPDryRun()', context);
  assert.equal(result.ok, true);
  assert.equal(result.modo, 'dry-run');
  assert.equal(result.tablasRegistradas, 1);
  assert.equal(result.columnasDetectadas, 2);
  assert.equal(result.columnasNuevas, 1);
  assert.equal(result.columnasExistentes, 1);
  assert.deepEqual(plain(result.errores), []);
  assert.deepEqual(plain(result.advertencias), []);
});

test('operational Pipeline remains deliberately disconnected in Phase 2A', () => {
  const operational = pipelineSource.slice(
    pipelineSource.indexOf('function aerpRunBuildPipeline()'),
    pipelineSource.indexOf('function aerpBuildPipelineSummary_')
  );
  assert.doesNotMatch(operational, /aerpBuildSingleMetadataArtifactsFromFrameworkSchema/);
  assert.match(operational, /runAlefERPDryRun\(\)/);
  assert.match(operational, /aerpBuildGeneratorEngineMVP\(\)/);
  assert.match(operational, /aerpBuildAppSheetPackage\(\)/);
});

test('static pure APIs contain no forbidden operational calls or callback injection', () => {
  const metadataPure = sources[1].slice(
    sources[1].indexOf('function aerpBuildMetadataModelFromFrameworkSchema'),
    sources[1].indexOf('function aerpGetFrameworkSchemaVersion_')
  );
  const bundlePure = pipelineSource.slice(
    pipelineSource.indexOf('function aerpBuildSingleMetadataArtifactsFromFrameworkSchema'),
    pipelineSource.indexOf('function aerpRunBuildPipeline()')
  );
  assert.doesNotMatch(
    metadataPure,
    /aerpBuildFrameworkSchema|SpreadsheetApp|Logger|new Date|Utilities|LockService|PropertiesService/
  );
  assert.doesNotMatch(
    bundlePure,
    /aerpBuildMetadataModel\(|aerpBuildGeneratorEngineMVP\(|aerpBuildAppSheetPackage\(|SpreadsheetApp|Logger|new Date|Utilities|LockService|PropertiesService|callback/
  );
});
