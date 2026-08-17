/* global require, __dirname */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const metadataWrapperSource = fs.readFileSync(
  path.join(__dirname, '14_MetadataBuilder.js'),
  'utf8'
);
const generatorSource = fs.readFileSync(path.join(__dirname, '15_GeneratorEngine.js'), 'utf8');
const appSheetSource = fs.readFileSync(path.join(__dirname, '16_AppSheetGenerator.js'), 'utf8');

function column(overrides = {}) {
  return {
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
    Placeholder: '',
    ...overrides
  };
}

function metadataTable(overrides = {}) {
  const columns = overrides.columns || [column()];
  const primaryKey = overrides.primaryKey === undefined ? { ...columns[0] } : overrides.primaryKey;
  return {
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
    primaryKey,
    labelColumn: null,
    foreignKeys: [],
    columns,
    visibleColumns: columns.filter(item => item.Visible).map(item => ({ ...item })),
    editableColumns: columns.filter(item => item.Editable).map(item => ({ ...item })),
    requiredColumns: columns.filter(item => item.Es_Requerido).map(item => ({ ...item })),
    searchableColumns: [],
    filterableColumns: [],
    sortableColumns: [],
    indexedColumns: [],
    virtualColumns: [],
    auditColumns: [],
    systemColumns: [],
    businessColumns: columns.map(item => ({ ...item })),
    appSheet: {
      tableName: 'CORE_ITEMS',
      keyColumn: 'ID_Item',
      labelColumn: '',
      refs: []
    },
    sql: {
      tableName: 'CORE_ITEMS',
      primaryKey: 'ID_Item',
      foreignKeys: []
    },
    api: {
      resource: 'item',
      tableName: 'CORE_ITEMS',
      idField: 'ID_Item',
      displayField: ''
    },
    ...overrides
  };
}

function metadataModel(tables = [metadataTable()]) {
  return {
    version: '1.0.0',
    generatedAt: '2026-08-17T00:00:00.000Z',
    tables,
    summary: {
      ok: true,
      contractVersion: '1.0.0',
      tables: tables.length,
      columns: tables.reduce((total, table) => total + table.columns.length, 0),
      primaryKeys: tables.filter(table => table.primaryKey).length,
      foreignKeys: 0,
      labels: tables.filter(table => table.labelColumn).length,
      warnings: [],
      errors: [],
      diagnostics: [],
      durationMs: 0
    }
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function load(options = {}) {
  const context = vm.createContext({
    calls: { metadata: 0, generator: 0, appSheet: 0, publicGenerator: 0 },
    logs: [],
    Logger: {
      log(value) {
        context.logs.push(String(value));
      }
    }
  });
  vm.runInContext(metadataWrapperSource + '\n' + generatorSource + '\n' + appSheetSource, context);
  context.metadataFixture = vm.runInContext(
    '(' + JSON.stringify(options.metadata || metadataModel()) + ')',
    context
  );
  vm.runInContext(
    [
      'aerpBuildMetadataModel = function () { calls.metadata += 1; return metadataFixture; };',
      'originalInjectedGenerator = aerpBuildGeneratorEngineMVPFromMetadataModel;',
      'originalInjectedAppSheet = aerpBuildAppSheetPackageFromGenerator;'
    ].join('\n'),
    context
  );
  return context;
}

function generatorCore(context, expression = 'metadataFixture') {
  return vm.runInContext(
    'aerpBuildGeneratorEngineMVPFromMetadataModel(' + expression + ')',
    context
  );
}

function appSheetCore(context, expression = 'generatorFixture') {
  return vm.runInContext('aerpBuildAppSheetPackageFromGenerator(' + expression + ')', context);
}

function assertGeneratorClosed(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.lineage, null);
  assert.equal(result.application, null);
  for (const field of ['tables', 'forms', 'views', 'menus']) {
    assert.deepEqual(plain(result[field]), []);
  }
  assert.equal(result.diagnostics[0].code, code);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|stack|Formula_App/);
}

function assertAppSheetClosed(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.lineage, null);
  assert.equal(result.package, null);
  assert.equal(result.diagnostics[0].code, code);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|stack|Formula_App|CORE_PRIVATE/);
}

test('Generator injectable builds a valid compatible result', () => {
  const result = generatorCore(load());
  assert.equal(result.ok, true);
  assert.match(result.lineage.metadataFingerprint, /^[0-9a-f]{64}$/);
  assert.equal(result.tables[0].physicalName, 'CORE_ITEMS');
  assert.equal(result.tables[0].primaryKey, 'ID_Item');
  assert.equal(result.summary.tables, 1);
  assert.equal(result.summary.durationMs, 0);
});

test('Generator injectable never calls Metadata Builder', () => {
  const context = load();
  generatorCore(context);
  assert.equal(context.calls.metadata, 0);
});

test('Generator wrapper calls Metadata Builder and injectable API exactly once with same instance', () => {
  const context = load();
  vm.runInContext(
    [
      'aerpBuildGeneratorEngineMVPFromMetadataModel = function (model) {',
      ' calls.generator += 1; calls.sameMetadata = model === metadataFixture;',
      ' return originalInjectedGenerator(model);',
      '};'
    ].join('\n'),
    context
  );
  const result = vm.runInContext('aerpBuildGeneratorEngineMVP()', context);
  assert.equal(result.ok, true);
  assert.match(result.lineage.metadataFingerprint, /^[0-9a-f]{64}$/);
  assert.equal(context.calls.metadata, 1);
  assert.equal(context.calls.generator, 1);
  assert.equal(context.calls.sameMetadata, true);
});

for (const [name, mutate] of [
  [
    'summary.ok false',
    model => {
      model.summary.ok = false;
    }
  ],
  [
    'summary errors',
    model => {
      model.summary.errors = ['PRIVATE_ERROR'];
    }
  ],
  [
    'inconsistent table count',
    model => {
      model.summary.tables = 2;
    }
  ],
  [
    'duplicate table ID',
    model => {
      model.tables.push(clone(model.tables[0]));
      model.summary.tables = 2;
      model.summary.columns = 2;
    }
  ],
  [
    'missing PK',
    model => {
      model.tables[0].primaryKey = null;
    }
  ],
  [
    'inconsistent visible list',
    model => {
      model.tables[0].visibleColumns = [];
    }
  ]
]) {
  test('Generator rejects ' + name, () => {
    const model = metadataModel();
    mutate(model);
    const context = load({ metadata: model });
    assertGeneratorClosed(generatorCore(context), 'GEN_METADATA_MODEL_INVALID');
  });
}

test('Generator rejects sparse arrays', () => {
  const context = load();
  vm.runInContext('metadataFixture.tables = new Array(1)', context);
  assertGeneratorClosed(generatorCore(context), 'GEN_METADATA_MODEL_INVALID');
});

test('Generator rejects accessors without executing them', () => {
  const context = load();
  vm.runInContext(
    'Object.defineProperty(metadataFixture, "summary", { get: function () { throw new Error("PRIVATE_ACCESSOR"); } })',
    context
  );
  assertGeneratorClosed(generatorCore(context), 'GEN_METADATA_MODEL_INVALID');
});

test('Generator rejects Symbols at root, table, column and array levels', () => {
  for (const expression of [
    'metadataFixture[Symbol("x")] = true',
    'metadataFixture.tables[0][Symbol("x")] = true',
    'metadataFixture.tables[0].columns[0][Symbol("x")] = true',
    'metadataFixture.tables[Symbol("x")] = true'
  ]) {
    const context = load();
    vm.runInContext(expression, context);
    assertGeneratorClosed(generatorCore(context), 'GEN_METADATA_MODEL_INVALID');
  }
});

test('Generator sanitizes unexpected helper exceptions and returns no partial objects', () => {
  const context = load();
  vm.runInContext(
    'aerpBuildGeneratorTable_ = function () { throw new Error("PRIVATE_GENERATOR_HELPER"); }',
    context
  );
  assertGeneratorClosed(generatorCore(context), 'GEN_INTERNAL_ERROR');
});

test('Generator rejects partial structures returned by internal helpers without throwing', () => {
  for (const helper of [
    'aerpBuildApplicationObjectFromMetadata_ = function () { return {}; };',
    'aerpBuildGeneratorTable_ = function () { return {}; };',
    'aerpBuildGeneratorForm_ = function () { return {}; };',
    'aerpBuildGeneratorView_ = function () { return {}; };',
    'aerpBuildGeneratorMenu_ = function () { return {}; };'
  ]) {
    const context = load();
    vm.runInContext(helper, context);
    assertGeneratorClosed(generatorCore(context), 'GEN_INTERNAL_ERROR');
  }
});

test('security validation configuration is immutable', () => {
  const context = load();
  assert.equal(vm.runInContext('Object.isFrozen(AERP_GEN_TABLE_FIELDS_)', context), true);
  assert.equal(vm.runInContext('Object.isFrozen(AERP_GEN_COLUMN_FIELDS_)', context), true);
  assert.equal(vm.runInContext('Object.isFrozen(AERP_GEN_CAPABILITY_LISTS_)', context), true);
  assert.equal(vm.runInContext('Object.isFrozen(AERP_ASG_TYPES_)', context), true);
  assert.equal(vm.runInContext('Object.isFrozen(AERP_ASG_TYPE_MAP_)', context), true);
});

test('Generator output is deeply independent from MetadataModel', () => {
  const context = load();
  const result = generatorCore(context);
  result.tables[0].columns[0].name = 'CHANGED';
  result.forms[0].columns.push('CHANGED');
  assert.equal(context.metadataFixture.tables[0].columns[0].Nombre_Campo, 'ID_Item');
  assert.equal(context.metadataFixture.tables[0].editableColumns.length, 0);
});

test('Generator injectable is deterministic and JSON serializable', () => {
  const context = load();
  const first = plain(generatorCore(context));
  const second = plain(generatorCore(context));
  assert.deepEqual(first, second);
  assert.doesNotThrow(() => JSON.stringify(first));
});

test('Generator injectable works with infrastructure, clock and version globals unavailable', () => {
  const context = load();
  vm.runInContext(
    [
      'Date = function () { throw new Error("PRIVATE_CLOCK"); };',
      'Logger = { log: function () { throw new Error("PRIVATE_LOGGER"); } };',
      'SpreadsheetApp = new Proxy({}, { get: function () { throw new Error("PRIVATE_SHEET"); } });',
      'PropertiesService = new Proxy({}, { get: function () { throw new Error("PRIVATE_PROPERTIES"); } });'
    ].join('\n'),
    context
  );
  assert.equal(generatorCore(context).ok, true);
});

function contextWithGenerator() {
  const context = load();
  vm.runInContext('generatorFixture = originalInjectedGenerator(metadataFixture)', context);
  return context;
}

test('AppSheet injectable builds the compatible public success shape', () => {
  const result = appSheetCore(contextWithGenerator());
  assert.equal(result.ok, true);
  assert.match(result.lineage.metadataFingerprint, /^[0-9a-f]{64}$/);
  assert.equal(result.package.tables.length, 1);
  assert.equal(result.package.columns.length, 1);
  assert.equal(result.package.tables[0].keyColumn, 'ID_Item');
  assert.equal(result.summary.durationMs, 0);
  assert.deepEqual(plain(result.diagnostics), []);
});

test('Generator derives lineage internally and AppSheet propagates the accepted lineage', () => {
  const context = load();
  const generator = generatorCore(context);
  assert.match(generator.lineage.metadataFingerprint, /^[0-9a-f]{64}$/);
  context.generatorFixture = generator;
  context.generatorFixture.lineage.metadataFingerprint = '0'.repeat(64);
  const appSheet = appSheetCore(context);
  assert.equal(appSheet.ok, true);
  assert.equal(appSheet.lineage.metadataFingerprint, '0'.repeat(64));
});

test('AppSheet injectable never calls Generator or Metadata Builder', () => {
  const context = contextWithGenerator();
  appSheetCore(context);
  assert.equal(context.calls.metadata, 0);
  assert.equal(context.calls.generator, 0);
});

test('AppSheet wrapper composes each stage once and never calls public Generator wrapper', () => {
  const context = load();
  vm.runInContext(
    [
      'aerpBuildGeneratorEngineMVP = function () { calls.publicGenerator += 1; throw new Error("NESTED"); };',
      'aerpBuildGeneratorEngineMVPFromMetadataModel = function (model) {',
      ' calls.generator += 1; calls.sameMetadata = model === metadataFixture;',
      ' calls.generatorResult = originalInjectedGenerator(model); return calls.generatorResult;',
      '};',
      'aerpBuildAppSheetPackageFromGenerator = function (generator) {',
      ' calls.appSheet += 1; calls.sameGenerator = generator === calls.generatorResult;',
      ' return originalInjectedAppSheet(generator);',
      '};'
    ].join('\n'),
    context
  );
  const result = vm.runInContext('aerpBuildAppSheetPackage()', context);
  assert.equal(result.ok, true);
  assert.equal(context.calls.metadata, 1);
  assert.equal(context.calls.generator, 1);
  assert.equal(context.calls.appSheet, 1);
  assert.equal(context.calls.publicGenerator, 0);
  assert.equal(context.calls.sameMetadata, true);
  assert.equal(context.calls.sameGenerator, true);
});

for (const [name, mutate] of [
  [
    'ok false',
    generator => {
      generator.ok = false;
    }
  ],
  [
    'summary errors',
    generator => {
      generator.summary.errors = ['PRIVATE_ERROR'];
    }
  ],
  [
    'inconsistent counts',
    generator => {
      generator.summary.tables = 2;
    }
  ],
  [
    'duplicate table',
    generator => {
      generator.tables.push(clone(generator.tables[0]));
      generator.summary.tables = 2;
    }
  ],
  [
    'duplicate column',
    generator => {
      generator.tables[0].columns.push(clone(generator.tables[0].columns[0]));
    }
  ],
  [
    'invalid form reference',
    generator => {
      generator.forms[0].table = 'CORE_PRIVATE';
    }
  ],
  [
    'invalid view column',
    generator => {
      generator.views[0].columns = ['MISSING'];
    }
  ],
  [
    'invalid menu view',
    generator => {
      generator.menus[0].view = 'MISSING';
    }
  ],
  [
    'unknown type',
    generator => {
      generator.tables[0].columns[0].type = 'Unknown';
    }
  ]
]) {
  test('AppSheet rejects Generator with ' + name, () => {
    const context = contextWithGenerator();
    const generator = plain(vm.runInContext('generatorFixture', context));
    mutate(generator);
    context.badGenerator = vm.runInContext('(' + JSON.stringify(generator) + ')', context);
    assertAppSheetClosed(appSheetCore(context, 'badGenerator'), 'ASG_GENERATOR_RESULT_INVALID');
  });
}

test('AppSheet rejects sparse arrays, accessors and Symbols', () => {
  for (const expression of [
    'generatorFixture.tables = new Array(1)',
    'Object.defineProperty(generatorFixture, "summary", { get: function () { throw new Error("PRIVATE_ACCESSOR"); } })',
    'generatorFixture.tables[0][Symbol("x")] = true'
  ]) {
    const context = contextWithGenerator();
    vm.runInContext(expression, context);
    assertAppSheetClosed(appSheetCore(context), 'ASG_GENERATOR_RESULT_INVALID');
  }
});

test('Generator rejects hostile structures in every legacy metadata projection', () => {
  const expressions = [
    'metadataFixture.tables[0].foreignKeys = new Array(1)',
    'metadataFixture.tables[0].foreignKeys[Symbol("x")] = true',
    'Object.setPrototypeOf(metadataFixture.tables[0].foreignKeys, {})',
    'metadataFixture.tables[0].requiredColumns = new Array(1)',
    'metadataFixture.tables[0].searchableColumns[Symbol("x")] = true',
    'Object.setPrototypeOf(metadataFixture.tables[0].filterableColumns, {})',
    'metadataFixture.tables[0].appSheet[Symbol("x")] = true',
    'metadataFixture.tables[0].appSheet.refs = new Array(1)',
    'Object.setPrototypeOf(metadataFixture.tables[0].sql, null)',
    'metadataFixture.tables[0].api.extra = true'
  ];
  for (const expression of expressions) {
    const context = load();
    vm.runInContext(expression, context);
    assertGeneratorClosed(generatorCore(context), 'GEN_METADATA_MODEL_INVALID');
  }
});

test('Generator rejects nested accessors without executing hostile getters', () => {
  for (const expression of [
    'Object.defineProperty(metadataFixture.tables[0], "foreignKeys", { get: function () { getterCalls += 1; throw new Error("PRIVATE"); } })',
    'Object.defineProperty(metadataFixture.tables[0], "requiredColumns", { get: function () { getterCalls += 1; throw new Error("PRIVATE"); } })',
    'Object.defineProperty(metadataFixture.tables[0].appSheet, "refs", { get: function () { getterCalls += 1; throw new Error("PRIVATE"); } })',
    'Object.defineProperty(metadataFixture.tables[0].sql, "foreignKeys", { get: function () { getterCalls += 1; throw new Error("PRIVATE"); } })',
    'Object.defineProperty(metadataFixture.tables[0].api, "resource", { get: function () { getterCalls += 1; throw new Error("PRIVATE"); } })'
  ]) {
    const context = load();
    context.getterCalls = 0;
    vm.runInContext(expression, context);
    assertGeneratorClosed(generatorCore(context), 'GEN_METADATA_MODEL_INVALID');
    assert.equal(context.getterCalls, 0);
  }
});

test('Generator validates all contractual summary counts', () => {
  for (const field of ['columns', 'primaryKeys', 'foreignKeys', 'labels']) {
    const context = load();
    vm.runInContext('metadataFixture.summary.' + field + ' += 1', context);
    assertGeneratorClosed(generatorCore(context), 'GEN_METADATA_MODEL_INVALID');
  }
});

test('AppSheet rejects missing or incomplete artifact collections', () => {
  for (const expression of [
    'delete generatorFixture.application',
    'delete generatorFixture.forms',
    'delete generatorFixture.views',
    'delete generatorFixture.menus',
    'generatorFixture.forms = []',
    'generatorFixture.views = []',
    'generatorFixture.menus = []'
  ]) {
    const context = contextWithGenerator();
    vm.runInContext(expression, context);
    assertAppSheetClosed(appSheetCore(context), 'ASG_GENERATOR_RESULT_INVALID');
  }
});

test('AppSheet rejects every altered Generator summary count', () => {
  for (const field of ['tables', 'forms', 'views', 'menus']) {
    const context = contextWithGenerator();
    vm.runInContext('generatorFixture.summary.' + field + ' += 1', context);
    assertAppSheetClosed(appSheetCore(context), 'ASG_GENERATOR_RESULT_INVALID');
  }
});

test('AppSheet validates its constructed public summary against the complete package', () => {
  const context = contextWithGenerator();
  context.resultFixture = appSheetCore(context);
  assert.equal(vm.runInContext('aerpAsgValidateBuiltResult_(resultFixture)', context), true);
  vm.runInContext('resultFixture.summary.tables += 1', context);
  assert.equal(vm.runInContext('aerpAsgValidateBuiltResult_(resultFixture)', context), false);
});

test('AppSheet rejects duplicated, missing, additional and reordered form or view columns', () => {
  const mutations = [
    'generatorFixture.forms[0].columns = ["ID_Item", "ID_Item"]',
    'generatorFixture.forms[0].columns = []',
    'generatorFixture.forms[0].columns = ["ID_Item", "MISSING"]',
    'generatorFixture.views[0].columns = ["ID_Item", "ID_Item"]',
    'generatorFixture.views[0].columns = []',
    'generatorFixture.views[0].columns = ["MISSING", "ID_Item"]'
  ];
  for (const mutation of mutations) {
    const context = contextWithGenerator();
    vm.runInContext(
      'generatorFixture.tables[0].columns[0].editable = true; generatorFixture.forms[0].columns = ["ID_Item"]; ' +
        mutation,
      context
    );
    assertAppSheetClosed(appSheetCore(context), 'ASG_GENERATOR_RESULT_INVALID');
  }
});

test('AppSheet rejects reordered otherwise valid form and view column sequences', () => {
  for (const target of ['forms', 'views']) {
    const context = contextWithGenerator();
    vm.runInContext(
      [
        'var secondColumn = JSON.parse(JSON.stringify(generatorFixture.tables[0].columns[0]));',
        'secondColumn.name = "Name"; secondColumn.displayName = "Name";',
        'secondColumn.isKey = false; secondColumn.required = false;',
        'secondColumn.visible = true; secondColumn.editable = true;',
        'generatorFixture.tables[0].columns[0].editable = true;',
        'generatorFixture.tables[0].columns.push(secondColumn);',
        'generatorFixture.forms[0].columns = ["ID_Item", "Name"];',
        'generatorFixture.views[0].columns = ["ID_Item", "Name"];',
        'generatorFixture.' + target + '[0].columns = ["Name", "ID_Item"];'
      ].join('\n'),
      context
    );
    assertAppSheetClosed(appSheetCore(context), 'ASG_GENERATOR_RESULT_INVALID');
  }
});

test('AppSheet rejects a valid view belonging to a different menu table', () => {
  const context = contextWithGenerator();
  vm.runInContext(
    [
      'var secondTable = JSON.parse(JSON.stringify(generatorFixture.tables[0]));',
      'secondTable.code = "OTHER"; secondTable.name = "Other"; secondTable.entity = "Other";',
      'secondTable.physicalName = "CORE_OTHER";',
      'generatorFixture.tables.push(secondTable);',
      'var secondForm = JSON.parse(JSON.stringify(generatorFixture.forms[0]));',
      'secondForm.id = "FORM_CORE_OTHER"; secondForm.table = "CORE_OTHER";',
      'generatorFixture.forms.push(secondForm);',
      'var secondView = JSON.parse(JSON.stringify(generatorFixture.views[0]));',
      'secondView.id = "VIEW_CORE_OTHER"; secondView.table = "CORE_OTHER";',
      'generatorFixture.views.push(secondView);',
      'var secondMenu = JSON.parse(JSON.stringify(generatorFixture.menus[0]));',
      'secondMenu.id = "MENU_CORE_OTHER"; secondMenu.table = "CORE_OTHER"; secondMenu.view = "VIEW_CORE_OTHER";',
      'generatorFixture.menus.push(secondMenu);',
      'generatorFixture.summary.tables = 2; generatorFixture.summary.forms = 2;',
      'generatorFixture.summary.views = 2; generatorFixture.summary.menus = 2;',
      'generatorFixture.menus[0].view = "VIEW_CORE_OTHER";'
    ].join('\n'),
    context
  );
  assertAppSheetClosed(appSheetCore(context), 'ASG_GENERATOR_RESULT_INVALID');
});

test('AppSheet rejects partial structures returned by internal helpers without throwing', () => {
  for (const helper of [
    'aerpBuildAppSheetApp_ = function () { return undefined; };',
    'aerpBuildAppSheetTable_ = function () { return { sourceName: "CORE_ITEMS" }; };',
    'aerpBuildAppSheetColumns_ = function () { return []; };',
    'aerpBuildAppSheetForm_ = function () { return {}; };',
    'aerpBuildAppSheetView_ = function () { return {}; };',
    'aerpBuildAppSheetMenu_ = function () { return {}; };'
  ]) {
    const context = contextWithGenerator();
    vm.runInContext(helper, context);
    assertAppSheetClosed(appSheetCore(context), 'ASG_PACKAGE_INVALID');
  }
});

test('AppSheet final validation does not execute hostile helper accessors', () => {
  const context = contextWithGenerator();
  context.getterCalls = 0;
  vm.runInContext(
    [
      'aerpBuildAppSheetForm_ = function () {',
      '  var value = {};',
      '  Object.defineProperty(value, "id", { get: function () { getterCalls += 1; throw new Error("PRIVATE"); } });',
      '  return value;',
      '};'
    ].join('\n'),
    context
  );
  assertAppSheetClosed(appSheetCore(context), 'ASG_PACKAGE_INVALID');
  assert.equal(context.getterCalls, 0);
});

test('legacy AppSheet validator restores sanitized key, label, table and Ref checks', () => {
  const context = contextWithGenerator();
  const successful = plain(appSheetCore(context));
  context.packageFixture = vm.runInContext('(' + JSON.stringify(successful.package) + ')', context);
  vm.runInContext(
    [
      'packageFixture.tables[0].keyColumn = "";',
      'packageFixture.tables[0].labelColumn = "";',
      'packageFixture.columns[0].table = "MISSING";',
      'packageFixture.columns[0].isRef = true;',
      'packageFixture.columns[0].refTable = "";'
    ].join('\n'),
    context
  );
  const validation = vm.runInContext('aerpValidateAppSheetPackage(packageFixture)', context);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes('Columna asociada a tabla inexistente.'));
  assert.ok(validation.warnings.includes('Tabla sin keyColumn.'));
  assert.ok(validation.warnings.includes('Tabla sin labelColumn.'));
  assert.doesNotMatch(JSON.stringify(validation), /CORE_ITEMS|ID_Item|MISSING/);

  vm.runInContext('packageFixture.columns[0].table = "CORE_ITEMS"', context);
  const refValidation = vm.runInContext('aerpValidateAppSheetPackage(packageFixture)', context);
  assert.ok(refValidation.warnings.includes('Referencia sin destino.'));
});

test('AppSheet sanitizes helper exceptions and returns package null', () => {
  const context = contextWithGenerator();
  vm.runInContext(
    'aerpBuildAppSheetTable_ = function () { throw new Error("PRIVATE_APPSHEET_HELPER"); }',
    context
  );
  assertAppSheetClosed(appSheetCore(context), 'ASG_INTERNAL_ERROR');
});

test('AppSheet output is deeply independent from Generator', () => {
  const context = contextWithGenerator();
  const result = appSheetCore(context);
  result.package.tables[0].columns.push('CHANGED');
  result.package.forms[0].columns.push('CHANGED');
  assert.equal(vm.runInContext('generatorFixture.tables[0].columns.length', context), 1);
  assert.equal(vm.runInContext('generatorFixture.forms[0].columns.length', context), 0);
});

test('AppSheet injectable is deterministic and JSON serializable', () => {
  const context = contextWithGenerator();
  const first = plain(appSheetCore(context));
  const second = plain(appSheetCore(context));
  assert.deepEqual(first, second);
  assert.doesNotThrow(() => JSON.stringify(first));
});

test('AppSheet injectable works with infrastructure and clock unavailable', () => {
  const context = contextWithGenerator();
  vm.runInContext(
    [
      'Date = function () { throw new Error("PRIVATE_CLOCK"); };',
      'Logger = { log: function () { throw new Error("PRIVATE_LOGGER"); } };',
      'SpreadsheetApp = new Proxy({}, { get: function () { throw new Error("PRIVATE_SHEET"); } });',
      'PropertiesService = new Proxy({}, { get: function () { throw new Error("PRIVATE_PROPERTIES"); } });'
    ].join('\n'),
    context
  );
  assert.equal(appSheetCore(context).ok, true);
});

test('AppSheet wrapper stops before injectable AppSheet when Generator fails', () => {
  const context = load({ metadata: { bad: true } });
  vm.runInContext(
    [
      'aerpBuildAppSheetPackageFromGenerator = function () { calls.appSheet += 1; return null; };'
    ].join('\n'),
    context
  );
  const result = vm.runInContext('aerpBuildAppSheetPackage()', context);
  assertAppSheetClosed(result, 'ASG_GENERATOR_RESULT_INVALID');
  assert.equal(context.calls.metadata, 1);
  assert.equal(context.calls.appSheet, 0);
});

test('public manual tests log sanitized summaries only', () => {
  const context = load();
  vm.runInContext('testGeneratorEngineMVP(); testAppSheetGeneratorMVP();', context);
  const output = context.logs.join('\n');
  assert.match(output, /"ok":true/);
  assert.doesNotMatch(output, /CORE_ITEMS|ID_Item|Formula_App/);
});

test('static injectable flows contain no forbidden nested calls or package MVP alias', () => {
  const generatorCoreSource = generatorSource.slice(
    generatorSource.indexOf('function aerpBuildGeneratorEngineMVPFromMetadataModel'),
    generatorSource.indexOf('function aerpBuildGeneratorEngineMVP()')
  );
  const appSheetCoreSource = appSheetSource.slice(
    appSheetSource.indexOf('function aerpBuildAppSheetPackageFromGenerator'),
    appSheetSource.indexOf('function aerpBuildAppSheetPackage()')
  );
  assert.doesNotMatch(generatorCoreSource, /aerpBuildMetadataModel|Logger|Date|AERP_VERSION/);
  assert.doesNotMatch(
    appSheetCoreSource,
    /aerpBuildGeneratorEngineMVP|aerpBuildMetadataModel|Logger|Date|AERP_VERSION/
  );
  assert.doesNotMatch(appSheetSource, /function\s+aerpBuildAppSheetPackageMVP/);
  assert.match(
    appSheetSource,
    /aerpMapToAppSheetType_[\s\S]*Object\.prototype\.hasOwnProperty\.call\(AERP_ASG_TYPE_MAP_/
  );
});
