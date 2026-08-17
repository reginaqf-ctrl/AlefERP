/* global require, __dirname */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const wrapperSource = fs.readFileSync(path.join(__dirname, '14_MetadataBuilder.js'), 'utf8');
const strictBuilderSource = fs.readFileSync(
  path.join(__dirname, 'AERP-038A_MetadataBuilderEnterprise.js'),
  'utf8'
);

function column(overrides = {}) {
  return {
    id: 'COL_PK',
    table: 'CORE_ITEMS',
    name: 'Clave',
    displayName: 'Clave',
    dataType: 'Text',
    controlType: 'Text',
    isKey: true,
    isLabel: false,
    required: true,
    nullable: false,
    initialValue: '',
    appFormula: '',
    referenceTable: '',
    length: null,
    order: 1,
    active: true,
    state: '',
    createdAt: null,
    updatedAt: null,
    visible: false,
    editable: false,
    isRef: false,
    virtual: false,
    searchable: false,
    filterable: false,
    sortable: false,
    indexed: false,
    formGroup: '',
    help: '',
    placeholder: '',
    ...overrides
  };
}

function capabilities(columns) {
  const definitions = [
    ['visible', 'visibleColumnIds'],
    ['editable', 'editableColumnIds'],
    ['required', 'requiredColumnIds'],
    ['searchable', 'searchableColumnIds'],
    ['filterable', 'filterableColumnIds'],
    ['sortable', 'sortableColumnIds'],
    ['indexed', 'indexedColumnIds'],
    ['virtual', 'virtualColumnIds']
  ];
  return Object.fromEntries(
    definitions.map(([flag, name]) => [
      name,
      columns.filter(item => item.active && item[flag]).map(item => item.id)
    ])
  );
}

function table(overrides = {}) {
  const columns = overrides.columns || [column()];
  return {
    id: 'TABLE_ITEMS',
    code: 'ITEMS',
    name: 'Items',
    entity: 'Item',
    module: 'CORE',
    category: '',
    type: '',
    classification: 'UNCLASSIFIED',
    physicalName: 'CORE_ITEMS',
    prefix: '',
    active: true,
    primaryKey: { ...columns[0] },
    labelColumn: null,
    foreignKeys: [],
    columns,
    capabilities: capabilities(columns),
    ...overrides
  };
}

function result(tables = [table()], diagnostics = []) {
  const summary = {
    tables: tables.length,
    activeTables: tables.filter(item => item.active).length,
    inactiveTables: tables.filter(item => !item.active).length,
    columns: tables.reduce((total, item) => total + item.columns.length, 0),
    activeColumns: tables.reduce(
      (total, item) => total + item.columns.filter(entry => entry.active).length,
      0
    ),
    primaryKeys: tables.filter(item => item.primaryKey).length,
    foreignKeys: tables.reduce((total, item) => total + item.foreignKeys.length, 0),
    labels: tables.filter(item => item.labelColumn).length,
    errors: diagnostics.filter(item => item.severity === 'ERROR').length,
    warnings: diagnostics.filter(item => item.severity === 'WARNING').length
  };
  const ok = summary.errors === 0;
  return {
    ok,
    contractVersion: '1.0.0',
    model: ok ? { contractVersion: '1.0.0', sourceSchemaVersion: '2.0.0', tables } : null,
    diagnostics,
    summary
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

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
            Visible: false,
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

function load(options = {}) {
  const context = vm.createContext({
    calls: { schema: 0, builder: 0, validation: 0 },
    logs: [],
    AERP_VERSION: '2.0.0',
    Logger: {
      log(value) {
        context.logs.push(String(value));
      }
    }
  });
  vm.runInContext(wrapperSource, context);
  context.strictFixture = vm.runInContext(
    '(' + JSON.stringify(options.strictResult || result()) + ')',
    context
  );
  context.schemaFixture = vm.runInContext('({ marker: "schema" })', context);
  vm.runInContext(
    [
      'aerpBuildFrameworkSchema = function () {',
      '  calls.schema += 1;',
      options.scannerThrows ? '  throw new Error("PRIVATE_SCHEMA");' : '  return schemaFixture;',
      '};',
      'aerpValidateFrameworkSchema = function () { calls.validation += 1; throw new Error("LEGACY"); };',
      options.builderAbsent
        ? 'aerpBuildMetadataModelFromSchema = undefined;'
        : [
            'aerpBuildMetadataModelFromSchema = function (schema) {',
            '  calls.builder += 1; calls.sameSchema = schema === schemaFixture;',
            options.builderThrows
              ? '  throw new Error("PRIVATE_BUILDER");'
              : '  return strictFixture;',
            '};'
          ].join('\n')
    ].join('\n'),
    context
  );
  return context;
}

function build(context) {
  return vm.runInContext('aerpBuildMetadataModel()', context);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertClosed(model) {
  assert.equal(model.summary.ok, false);
  assert.deepEqual(plain(model.tables), []);
  assert.equal(model.generatedAt, null);
  assert.equal(model.summary.durationMs, 0);
  assert.ok(model.summary.errors.length > 0);
  assert.equal(model.summary.diagnostics.length, 1);
  assert.equal(model.summary.diagnostics[0].code, 'MBE_INTERNAL_ERROR');
  assert.doesNotMatch(JSON.stringify(model), /PRIVATE_|stack|Formula_App/);
}

test('builds schema once, invokes strict builder once and passes the same schema', () => {
  const context = load();
  assert.equal(build(context).summary.ok, true);
  assert.deepEqual(plain(context.calls), {
    schema: 1,
    builder: 1,
    validation: 0,
    sameSchema: true
  });
});

test('integrates with the real strict builder without infrastructure access', () => {
  const context = vm.createContext({ AERP_VERSION: '2.0.0' });
  vm.runInContext(strictBuilderSource + '\n' + wrapperSource, context);
  context.schemaFixture = vm.runInContext('(' + JSON.stringify(frameworkSchema()) + ')', context);
  vm.runInContext('aerpBuildFrameworkSchema = function () { return schemaFixture; }', context);
  const model = build(context);
  assert.equal(model.summary.ok, true);
  assert.equal(model.tables[0].primaryKey.Nombre_Campo, 'Clave');
});

test('never invokes legacy validation', () => {
  const context = load();
  build(context);
  assert.equal(context.calls.validation, 0);
});

test('preserves the exact legacy fields consumed by Generator', () => {
  const legacy = build(load()).tables[0];
  assert.equal(legacy.primaryKey.Nombre_Campo, 'Clave');
  assert.equal(legacy.columns[0].Tipo_Dato, 'Text');
  assert.ok(Array.isArray(legacy.visibleColumns));
  assert.ok(Array.isArray(legacy.editableColumns));
});

test('preserves Pipeline summary compatibility', () => {
  const summary = build(load()).summary;
  assert.equal(summary.tables, 1);
  assert.deepEqual(plain(summary.errors), []);
});

test('derives primary key identity without ID-name fallback', () => {
  const legacy = build(load()).tables[0];
  assert.equal(legacy.primaryKey.Nombre_Campo, 'Clave');
});

test('keeps an absent label null without Nombre or Codigo fallback', () => {
  const item = table();
  item.columns.push(column({ id: 'COL_NAME', name: 'Nombre', isKey: false, order: 2 }));
  item.capabilities = capabilities(item.columns);
  assert.equal(build(load({ strictResult: result([item]) })).tables[0].labelColumn, null);
});

test('uses only the strict label identity', () => {
  const label = column({ id: 'COL_LABEL', name: 'Titulo', isKey: false, isLabel: true, order: 2 });
  const item = table({ columns: [column(), label] });
  item.labelColumn = { ...label };
  assert.equal(
    build(load({ strictResult: result([item]) })).tables[0].labelColumn.Nombre_Campo,
    'Titulo'
  );
});

function relationalResult() {
  const targetPk = column({ table: 'CORE_TARGETS' });
  const target = table({
    id: 'TABLE_TARGETS',
    code: 'TARGETS',
    name: 'Targets',
    entity: 'Target',
    physicalName: 'CORE_TARGETS',
    columns: [targetPk],
    primaryKey: { ...targetPk },
    capabilities: capabilities([targetPk])
  });
  const sourcePk = column();
  const sourceRef = column({
    id: 'COL_REF',
    name: 'Target',
    isKey: false,
    isRef: true,
    referenceTable: 'CORE_TARGETS',
    order: 2
  });
  const source = table({ columns: [sourcePk, sourceRef] });
  source.foreignKeys = [
    {
      sourceColumnId: 'COL_REF',
      sourceColumnName: 'Target',
      storageType: 'Text',
      targetTableId: 'TABLE_TARGETS',
      targetPhysicalName: 'CORE_TARGETS',
      targetPrimaryKeyColumnId: 'COL_PK',
      targetPrimaryKeyColumnName: 'Clave'
    }
  ];
  return result([source, target]);
}

test('derives foreign keys only from strict normalized foreign keys', () => {
  const tables = build(load({ strictResult: relationalResult() })).tables;
  assert.equal(tables[0].foreignKeys.length, 1);
  assert.equal(tables[0].foreignKeys[0].Nombre_Campo, 'Target');
});

test('derives capability lists only from strict IDs', () => {
  const visible = column({ visible: true });
  const item = table({ columns: [visible] });
  assert.equal(build(load({ strictResult: result([item]) })).tables[0].visibleColumns.length, 1);
});

test('fails closed for an unknown capability ID', () => {
  const item = table();
  item.capabilities.visibleColumnIds = ['MISSING'];
  assertClosed(build(load({ strictResult: result([item]) })));
});

test('fails closed for a duplicated capability ID', () => {
  const visible = column({ visible: true });
  const item = table({ columns: [visible] });
  item.capabilities.visibleColumnIds.push(visible.id);
  assertClosed(build(load({ strictResult: result([item]) })));
});

test('creates no mutable references shared with the strict result', () => {
  const context = load();
  const legacy = build(context);
  legacy.tables[0].columns[0].Nombre_Campo = 'CHANGED';
  assert.equal(context.strictFixture.model.tables[0].columns[0].name, 'Clave');
});

test('creates independent copies for every legacy list', () => {
  const visible = column({ visible: true, editable: true });
  const item = table({ columns: [visible] });
  const legacy = build(load({ strictResult: result([item]) })).tables[0];
  legacy.visibleColumns[0].Nombre_Campo = 'CHANGED';
  assert.equal(legacy.columns[0].Nombre_Campo, 'Clave');
  assert.equal(legacy.editableColumns[0].Nombre_Campo, 'Clave');
  assert.equal(legacy.primaryKey.Nombre_Campo, 'Clave');
});

test('builds AppSheet, SQL and API projections from strict identities', () => {
  const legacy = build(load({ strictResult: relationalResult() })).tables[0];
  assert.deepEqual(plain(legacy.appSheet.refs), [{ column: 'Target', refTable: 'CORE_TARGETS' }]);
  assert.equal(legacy.sql.primaryKey, 'Clave');
  assert.equal(legacy.api.idField, 'Clave');
});

test('fails closed when the scanner throws', () => {
  assertClosed(build(load({ scannerThrows: true })));
});

test('fails closed when the strict builder is absent', () => {
  assertClosed(build(load({ builderAbsent: true })));
});

test('fails closed when the strict builder throws', () => {
  assertClosed(build(load({ builderThrows: true })));
});

test('fails closed for an unexpected contractVersion', () => {
  const strict = result();
  strict.contractVersion = '9.0.0';
  assertClosed(build(load({ strictResult: strict })));
});

test('fails closed for a non-object result', () => {
  const context = load();
  vm.runInContext('strictFixture = 7', context);
  assertClosed(build(context));
});

test('replaces contractual error diagnostics with one generic sanitized error', () => {
  const diagnostic = {
    code: 'MBE_INVALID_INPUT',
    severity: 'ERROR',
    path: '$.private.Customer',
    message: 'PRIVATE_CUSTOMER_VALUE'
  };
  const model = build(load({ strictResult: result([], [diagnostic]) }));
  assertClosed(model);
  assert.equal(
    model.summary.diagnostics[0].message,
    'No fue posible construir el modelo de metadata.'
  );
  assert.doesNotMatch(JSON.stringify(model), /PRIVATE_CUSTOMER_VALUE|Customer/);
});

test('fails internally for ok:false with a model', () => {
  const strict = result(
    [],
    [
      {
        code: 'MBE_INVALID_INPUT',
        severity: 'ERROR',
        path: '$',
        message: 'Contract error.'
      }
    ]
  );
  strict.model = { contractVersion: '1.0.0', sourceSchemaVersion: '2.0.0', tables: [] };
  const model = build(load({ strictResult: strict }));
  assertClosed(model);
  assert.equal(model.summary.diagnostics[0].code, 'MBE_INTERNAL_ERROR');
});

test('fails internally for ok:true without a model', () => {
  const strict = result();
  strict.model = null;
  assertClosed(build(load({ strictResult: strict })));
});

test('fails closed for malformed diagnostics', () => {
  const strict = result();
  strict.diagnostics = [
    { code: 'MBE_BAD', severity: 'ERROR', path: '$', message: 'x', details: 'secret' }
  ];
  strict.summary.errors = 1;
  assertClosed(build(load({ strictResult: strict })));
});

test('fails closed for a malformed summary', () => {
  const strict = result();
  strict.summary.tables = '1';
  assertClosed(build(load({ strictResult: strict })));
});

function assertInvalidTableMutation(mutate, initial = table()) {
  const item = clone(initial);
  mutate(item);
  assertClosed(build(load({ strictResult: result([item]) })));
}

function changePrimaryKey(item, changes) {
  Object.assign(item.columns[0], changes);
  item.primaryKey = { ...item.columns[0] };
  item.capabilities = capabilities(item.columns);
}

test('rejects a primaryKey pointer whose isKey is false', () => {
  assertInvalidTableMutation(item => {
    item.primaryKey.isKey = false;
  });
});

test('rejects multiple columns marked as primary keys', () => {
  assertInvalidTableMutation(item => {
    item.columns.push(column({ id: 'COL_PK_2', name: 'OtherKey', order: 2 }));
    item.capabilities = capabilities(item.columns);
  });
});

for (const [name, changes] of [
  ['nullable', { nullable: true }],
  ['optional', { required: false }],
  ['virtual', { virtual: true }],
  ['inactive', { active: false }],
  ['PK plus FK', { isRef: true, referenceTable: 'CORE_ITEMS' }],
  ['invalid type', { dataType: 'Email' }]
]) {
  test('rejects a ' + name + ' primary key', () => {
    assertInvalidTableMutation(item => changePrimaryKey(item, changes));
  });
}

test('rejects a primaryKey pointer inconsistent with its column', () => {
  assertInvalidTableMutation(item => {
    item.primaryKey.displayName = 'Different';
  });
});

test('rejects a labelColumn whose isLabel is false', () => {
  assertInvalidTableMutation(item => {
    item.labelColumn = { ...item.columns[0], isKey: false, isLabel: false };
  });
});

test('rejects multiple label columns', () => {
  assertInvalidTableMutation(item => {
    const first = column({
      id: 'LABEL_1',
      name: 'LabelOne',
      isKey: false,
      isLabel: true,
      order: 2
    });
    const second = column({
      id: 'LABEL_2',
      name: 'LabelTwo',
      isKey: false,
      isLabel: true,
      order: 3
    });
    item.columns.push(first, second);
    item.labelColumn = { ...first };
    item.capabilities = capabilities(item.columns);
  });
});

test('rejects an inconsistent label pointer', () => {
  assertInvalidTableMutation(item => {
    const label = column({ id: 'LABEL', name: 'Label', isKey: false, isLabel: true, order: 2 });
    item.columns.push(label);
    item.labelColumn = { ...label, help: 'Different' };
    item.capabilities = capabilities(item.columns);
  });
});

test('rejects an invalid contractual label type', () => {
  assertInvalidTableMutation(item => {
    const label = column({
      id: 'LABEL',
      name: 'Label',
      dataType: 'EnumList',
      isKey: false,
      isLabel: true,
      order: 2
    });
    item.columns.push(label);
    item.labelColumn = { ...label };
    item.capabilities = capabilities(item.columns);
  });
});

test('rejects deployable PK or capabilities on an inactive table', () => {
  assertInvalidTableMutation(item => {
    item.active = false;
  });
});

function assertInvalidRelation(mutate) {
  const strict = relationalResult();
  const tables = clone(strict.model.tables);
  mutate(tables);
  assertClosed(build(load({ strictResult: result(tables) })));
}

test('rejects incompatible FK storage', () => {
  assertInvalidRelation(tables => {
    tables[0].foreignKeys[0].storageType = 'Number';
  });
});

test('rejects an inactive FK target', () => {
  assertInvalidRelation(tables => {
    tables[1].active = false;
  });
});

test('rejects an FK target with an invalid primary key', () => {
  assertInvalidRelation(tables => {
    changePrimaryKey(tables[1], { nullable: true });
  });
});

test('rejects a duplicated FK', () => {
  assertInvalidRelation(tables => {
    tables[0].foreignKeys.push({ ...tables[0].foreignKeys[0] });
  });
});

test('rejects an orphan FK', () => {
  assertInvalidRelation(tables => {
    tables[0].foreignKeys[0].sourceColumnId = 'MISSING';
  });
});

test('rejects a missing normalized FK', () => {
  assertInvalidRelation(tables => {
    tables[0].foreignKeys = [];
  });
});

test('rejects a column assigned to another table', () => {
  assertInvalidTableMutation(item => {
    changePrimaryKey(item, { table: 'OTHER_TABLE' });
  });
});

for (const [name, field] of [
  ['column ID', 'id'],
  ['column name', 'name'],
  ['column type', 'dataType']
]) {
  test('rejects an empty ' + name, () => {
    assertInvalidTableMutation(item => changePrimaryKey(item, { [field]: '' }));
  });
}

test('rejects duplicate column orders', () => {
  assertInvalidTableMutation(item => {
    item.columns.push(column({ id: 'COL_2', name: 'Second', isKey: false }));
    item.capabilities = capabilities(item.columns);
  });
});

test('rejects an inconsistent summary even when the model shape is valid', () => {
  const strict = result();
  strict.summary.columns += 1;
  assertClosed(build(load({ strictResult: strict })));
});

function warningResult(diagnostic) {
  return result([table()], [diagnostic]);
}

test('rejects an invented warning code', () => {
  const strict = warningResult({
    code: 'MBE_PRIVATE_WARNING',
    severity: 'WARNING',
    path: '$',
    message: 'PRIVATE_WARNING'
  });
  assertClosed(build(load({ strictResult: strict })));
});

test('rejects a canonical warning with an altered message', () => {
  const strict = warningResult({
    code: 'MBE_SUMMARY_MISMATCH',
    severity: 'WARNING',
    path: '$.summary',
    message: 'PRIVATE_ALTERED_MESSAGE'
  });
  assertClosed(build(load({ strictResult: strict })));
});

test('rejects a warning path containing a private name or value', () => {
  const strict = warningResult({
    code: 'MBE_SUMMARY_MISMATCH',
    severity: 'WARNING',
    path: '$.tables[ACME_PRIVATE]',
    message: 'El resumen no coincide con el contenido y será recalculado.'
  });
  assertClosed(build(load({ strictResult: strict })));
});

test('reconstructs a valid canonical warning from the wrapper constant', () => {
  const strict = warningResult({
    code: 'MBE_SUMMARY_MISMATCH',
    severity: 'WARNING',
    path: '$.summary',
    message: 'El resumen no coincide con el contenido y será recalculado.'
  });
  const model = build(load({ strictResult: strict }));
  assert.equal(model.summary.ok, true);
  assert.deepEqual(plain(model.summary.diagnostics), [
    {
      code: 'MBE_SUMMARY_MISMATCH',
      severity: 'WARNING',
      path: '$.summary',
      message: 'El resumen no coincide con el contenido y será recalculado.'
    }
  ]);
});

for (const [code, path, message] of [
  [
    'MBE_NORMALIZED_LEGACY_ALIAS',
    '$.tables[0].columns[0].Tipo_Dato',
    'Se normalizó un alias de tipo de dato permitido.'
  ],
  [
    'MBE_SAFE_DEFAULT_APPLIED',
    '$.tables[0].columns[0].Es_Buscable',
    'Se aplicó un valor seguro por defecto.'
  ]
]) {
  test('accepts and reconstructs canonical warning ' + code, () => {
    const strict = warningResult({ code, severity: 'WARNING', path, message });
    const model = build(load({ strictResult: strict }));
    assert.equal(model.summary.ok, true);
    assert.equal(model.summary.diagnostics[0].message, message);
  });
}

test('maps every strict column field to an independent legacy field', () => {
  const strictColumn = column({
    displayName: 'Display',
    controlType: 'Input',
    initialValue: 'opaque initial',
    appFormula: 'OPAQUE_FORMULA()',
    length: 48,
    state: 'ACTIVE',
    createdAt: '2026-01-02T03:04:05.000Z',
    updatedAt: '2026-02-03T04:05:06.000Z',
    visible: true,
    editable: true,
    searchable: true,
    filterable: true,
    sortable: true,
    indexed: true,
    formGroup: 'Main',
    help: 'Help',
    placeholder: 'Placeholder'
  });
  const item = table({
    columns: [strictColumn],
    primaryKey: { ...strictColumn },
    capabilities: capabilities([strictColumn])
  });
  const legacy = build(load({ strictResult: result([item]) })).tables[0].columns[0];
  assert.deepEqual(plain(legacy), {
    ID_Columna: 'COL_PK',
    Tabla: 'CORE_ITEMS',
    Nombre_Campo: 'Clave',
    Nombre_Mostrar: 'Display',
    Tipo_Dato: 'Text',
    Tipo_Control: 'Input',
    Es_Key: true,
    Es_Label: false,
    Es_Requerido: true,
    Permite_Nulos: false,
    Valor_Inicial: 'opaque initial',
    Formula_App: 'OPAQUE_FORMULA()',
    Tabla_Referencia: '',
    Longitud: 48,
    Orden: 1,
    Activo: true,
    Estado: 'ACTIVE',
    Fecha_Creacion: '2026-01-02T03:04:05.000Z',
    Fecha_Actualizacion: '2026-02-03T04:05:06.000Z',
    Visible: true,
    Editable: true,
    Es_Ref: false,
    Es_Virtual: false,
    Es_Buscable: true,
    Es_Filtrable: true,
    Es_Ordenable: true,
    Es_Indexado: true,
    Grupo_Formulario: 'Main',
    Ayuda: 'Help',
    Placeholder: 'Placeholder'
  });
  legacy.Formula_App = 'CHANGED';
  assert.equal(item.columns[0].appFormula, 'OPAQUE_FORMULA()');
});

test('maps nullable optional values without sharing references', () => {
  const optional = column({
    id: 'OPTIONAL',
    name: 'Optional',
    isKey: false,
    required: false,
    initialValue: null,
    order: 2
  });
  const item = table({ columns: [column(), optional] });
  const legacy = build(load({ strictResult: result([item]) })).tables[0].columns[1];
  assert.equal(legacy.Valor_Inicial, null);
  assert.equal(legacy.Longitud, '');
  assert.equal(legacy.Fecha_Creacion, '');
  assert.equal(legacy.Fecha_Actualizacion, '');
  assert.notEqual(legacy, item.columns[1]);
});

test('fails closed if any adapter throws and exposes no partial table', () => {
  const context = load();
  vm.runInContext(
    'aerpAdaptStrictTableToLegacy_ = function () { throw new Error("PRIVATE_ADAPTER"); }',
    context
  );
  assertClosed(build(context));
});

test('serializes the complete success and failure results', () => {
  const success = build(load());
  assert.deepEqual(JSON.parse(JSON.stringify(success)).tables.length, 1);
  const failure = build(load({ builderThrows: true }));
  assert.equal(JSON.parse(JSON.stringify(failure)).summary.ok, false);
});

test('preserves aerpBoolFromMetadata_ behavior for Generator', () => {
  const context = load();
  assert.equal(vm.runInContext('aerpBoolFromMetadata_(true)', context), true);
  assert.equal(vm.runInContext('aerpBoolFromMetadata_("TRUE")', context), true);
  assert.equal(vm.runInContext('aerpBoolFromMetadata_("false")', context), false);
});

test('testMetadataBuilder logs only a sanitized summary', () => {
  const context = load();
  vm.runInContext('testMetadataBuilder()', context);
  const output = context.logs.join('\n');
  assert.match(output, /"tables":1/);
  assert.doesNotMatch(output, /Clave|Formula_App|CORE_ITEMS|metadata/);
});

test('static production flow contains no legacy resolvers or validation', () => {
  assert.doesNotMatch(wrapperSource, /aerpResolvePrimaryKey_|aerpResolveLabelColumn_/);
  assert.doesNotMatch(wrapperSource, /aerpValidateFrameworkSchema\s*\(/);
  assert.doesNotMatch(wrapperSource, /startsWith\(['"]ID_/);
  assert.doesNotMatch(wrapperSource, /===\s*['"](?:Nombre|Codigo)['"]/);
  assert.doesNotMatch(wrapperSource, /columns\.filter\([^)]*Es_Ref/s);
});

test('telemetry failure returns a sanitized fail-closed model', () => {
  const context = load();
  vm.runInContext('Date = function () { throw new Error("PRIVATE_CLOCK"); }', context);
  assertClosed(build(context));
});

test('rejects array accessors and extra array fields without executing them', () => {
  const context = load();
  vm.runInContext(
    'Object.defineProperty(strictFixture.model.tables, "extra", { get: function () { throw new Error("PRIVATE_ACCESSOR"); } })',
    context
  );
  assertClosed(build(context));
});
