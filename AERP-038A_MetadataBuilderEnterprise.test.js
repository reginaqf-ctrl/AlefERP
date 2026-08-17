/* global require */

const assert = require('node:assert/strict');
const test = require('node:test');

require('./AERP-038A_MetadataBuilderEnterprise');

const build = globalThis.aerpBuildMetadataModelFromSchema;

function createColumn(overrides = {}) {
  return {
    ID_Columna: 'COL_ID',
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
    Placeholder: '',
    ...overrides
  };
}

function createTable(overrides = {}) {
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
    columns: [createColumn()],
    ...overrides
  };
}

function createSchema(tables = [createTable()], overrides = {}) {
  const columns = tables.reduce((total, table) => total + table.columns.length, 0);
  return {
    version: '1.0.0',
    generatedAt: '2026-08-17T00:00:00.000Z',
    tables,
    summary: {
      tables: tables.length,
      columns,
      relations: 0,
      views: 0,
      warnings: [],
      errors: [],
      durationMs: 0
    },
    ...overrides
  };
}

function codes(result) {
  return result.diagnostics.map(diagnostic => diagnostic.code);
}

function assertError(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.model, null);
  assert.ok(codes(result).includes(code), `Expected ${code}: ${codes(result).join(', ')}`);
}

function assertContractDiagnostic(result, expected, blocking = true) {
  assert.deepEqual(
    result.diagnostics.find(diagnostic => diagnostic.code === expected.code),
    expected
  );
  if (blocking) {
    assert.equal(result.ok, false);
    assert.equal(result.model, null);
  } else {
    assert.equal(result.ok, true);
    assert.notEqual(result.model, null);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

test('rejects null, primitive and malformed inputs', () => {
  for (const input of [null, undefined, 7, 'schema', [], new Date()]) {
    assertError(build(input), 'MBE_INVALID_INPUT');
  }
  assertError(build({}), 'MBE_INVALID_VERSION');
});

test('builds the valid minimum neutral model', () => {
  const result = build(createSchema());
  assert.equal(result.ok, true);
  assert.equal(result.contractVersion, '1.0.0');
  assert.equal(result.model.contractVersion, '1.0.0');
  assert.equal(result.model.tables[0].classification, 'UNCLASSIFIED');
  assert.equal(result.model.tables[0].primaryKey.name, 'ID_Item');
  assert.equal(result.model.tables[0].labelColumn, null);
});

test('keeps inactive tables without requiring columns, PK or label', () => {
  const inactive = createTable({
    id: 'OFF',
    code: 'OFF',
    physicalName: 'OFF',
    active: false,
    columns: []
  });
  const result = build(createSchema([inactive]));
  assert.equal(result.ok, true);
  assert.equal(result.model.tables[0].active, false);
  assert.equal(result.model.tables[0].primaryKey, null);
});

test('rejects sparse arrays, array accessors and extra array properties', () => {
  const sparse = createSchema();
  sparse.tables = new Array(1);
  assertError(build(sparse), 'MBE_INVALID_TABLES');

  const accessor = createSchema();
  Object.defineProperty(accessor.tables, '0', {
    get() {
      return createTable();
    },
    enumerable: true
  });
  assertError(build(accessor), 'MBE_INVALID_TABLES');

  const extra = createSchema();
  extra.tables.extra = true;
  assertError(build(extra), 'MBE_UNKNOWN_FIELD');
});

test('rejects object accessors and custom prototypes', () => {
  const accessor = createSchema();
  Object.defineProperty(accessor, 'version', {
    get() {
      return '1.0.0';
    },
    enumerable: true
  });
  assertError(build(accessor), 'MBE_INVALID_INPUT');

  const custom = createSchema();
  custom.tables[0] = Object.assign(Object.create({ inherited: true }), custom.tables[0]);
  assertError(build(custom), 'MBE_INVALID_TABLE_FIELD');
});

test('rejects unknown fields at every contract level', () => {
  for (const mutate of [
    schema => {
      schema.unknown = true;
    },
    schema => {
      schema.summary.unknown = true;
    },
    schema => {
      schema.tables[0].unknown = true;
    },
    schema => {
      schema.tables[0].columns[0].unknown = true;
    }
  ]) {
    const schema = createSchema();
    mutate(schema);
    assertError(build(schema), 'MBE_UNKNOWN_FIELD');
  }
});

test('rejects Symbol data properties at every object and array level', () => {
  const targets = [
    schema => schema,
    schema => schema.summary,
    schema => schema.tables[0],
    schema => schema.tables[0].columns[0],
    schema => schema.tables,
    schema => schema.tables[0].columns,
    schema => schema.summary.warnings,
    schema => schema.summary.errors
  ];
  targets.forEach(selectTarget => {
    const schema = createSchema();
    selectTarget(schema)[Symbol('unknown')] = 'hidden';
    const result = build(schema);
    assertError(result, 'MBE_UNKNOWN_FIELD');
    assert.equal(codes(result).includes('MBE_INTERNAL_ERROR'), false);
  });
});

test('rejects Symbol accessors without executing them at every object and array level', () => {
  const targets = [
    schema => schema,
    schema => schema.summary,
    schema => schema.tables[0],
    schema => schema.tables[0].columns[0],
    schema => schema.tables,
    schema => schema.tables[0].columns,
    schema => schema.summary.warnings,
    schema => schema.summary.errors
  ];
  targets.forEach(selectTarget => {
    const schema = createSchema();
    let accessed = false;
    Object.defineProperty(selectTarget(schema), Symbol('unknown'), {
      get() {
        accessed = true;
        throw new Error('must not execute');
      }
    });
    const result = build(schema);
    assertError(result, 'MBE_UNKNOWN_FIELD');
    assert.equal(accessed, false);
    assert.equal(codes(result).includes('MBE_INTERNAL_ERROR'), false);
  });
});

test('fails closed when upstream summary contains errors without copying them', () => {
  const schema = createSchema();
  schema.summary.errors = ['secret upstream text'];
  const result = build(schema);
  assertError(result, 'MBE_UPSTREAM_SCHEMA_ERROR');
  assert.doesNotMatch(JSON.stringify(result), /secret upstream text/);
});

test('recalculates summary and reports counter mismatch', () => {
  const schema = createSchema();
  schema.summary.tables = 99;
  const result = build(schema);
  assert.equal(result.ok, true);
  assert.ok(codes(result).includes('MBE_SUMMARY_MISMATCH'));
  assert.equal(result.summary.tables, 1);
});

test('rejects duplicate table identities', () => {
  const duplicate = createTable({ columns: [createColumn({ ID_Columna: 'COL_2' })] });
  const result = build(createSchema([createTable(), duplicate]));
  assertError(result, 'MBE_DUPLICATE_TABLE_ID');
  assert.ok(codes(result).includes('MBE_DUPLICATE_TABLE_CODE'));
  assert.ok(codes(result).includes('MBE_DUPLICATE_PHYSICAL_NAME'));
});

test('rejects duplicate column ids, names and orders', () => {
  const second = createColumn({ Tabla: 'CORE_OTHER', Nombre_Campo: 'Other' });
  const other = createTable({
    id: 'OTHER',
    code: 'OTHER',
    physicalName: 'CORE_OTHER',
    columns: [second]
  });
  const globalDuplicate = build(createSchema([createTable(), other]));
  assertError(globalDuplicate, 'MBE_DUPLICATE_COLUMN_ID');

  const local = createTable({
    columns: [createColumn(), createColumn({ ID_Columna: 'COL_2', Es_Key: false })]
  });
  const localDuplicate = build(createSchema([local]));
  assertError(localDuplicate, 'MBE_DUPLICATE_COLUMN_NAME');
  assert.ok(codes(localDuplicate).includes('MBE_INVALID_COLUMN_ORDER'));
});

test('rejects invalid booleans without coercion', () => {
  for (const value of ['TRUE', 1, 0, null]) {
    const schema = createSchema();
    schema.tables[0].columns[0].Es_Key = value;
    assertError(build(schema), 'MBE_INVALID_BOOLEAN');
  }
});

test('accepts approved data types and normalizes only approved aliases', () => {
  for (const type of ['Text', 'Number']) {
    const schema = createSchema();
    schema.tables[0].columns[0].Tipo_Dato = type;
    assert.equal(build(schema).ok, true);
  }
  const aliasTable = createTable({
    columns: [
      createColumn(),
      createColumn({
        ID_Columna: 'COL_TEXT',
        Nombre_Campo: 'Notes',
        Tipo_Dato: 'Long Text',
        Es_Key: false,
        Orden: 2
      })
    ]
  });
  const alias = build(createSchema([aliasTable]));
  assert.equal(alias.ok, true);
  assert.ok(codes(alias).includes('MBE_NORMALIZED_LEGACY_ALIAS'));
  assert.equal(alias.model.tables[0].columns[1].dataType, 'LongText');
});

test('requires exactly one explicit primary key for active tables', () => {
  const missing = createSchema();
  missing.tables[0].columns[0].Es_Key = false;
  assertError(build(missing), 'MBE_MISSING_PRIMARY_KEY');

  const multiple = createTable({
    columns: [
      createColumn(),
      createColumn({ ID_Columna: 'COL_2', Nombre_Campo: 'Second', Orden: 2 })
    ]
  });
  assertError(build(createSchema([multiple])), 'MBE_MULTIPLE_PRIMARY_KEYS');
});

test('accepts Text and Number PK but rejects Email PK', () => {
  for (const type of ['Text', 'Number']) {
    const schema = createSchema();
    schema.tables[0].columns[0].Tipo_Dato = type;
    assert.equal(build(schema).ok, true);
  }
  const email = createSchema();
  email.tables[0].columns[0].Tipo_Dato = 'Email';
  assertError(build(email), 'MBE_INVALID_PRIMARY_KEY_TYPE');
});

test('rejects nullable, optional, virtual, inactive and PK+FK keys', () => {
  const cases = [
    ['Permite_Nulos', true, 'MBE_NULLABLE_PRIMARY_KEY'],
    ['Es_Requerido', false, 'MBE_OPTIONAL_PRIMARY_KEY'],
    ['Es_Virtual', true, 'MBE_VIRTUAL_PRIMARY_KEY'],
    ['Activo', false, 'MBE_INACTIVE_PRIMARY_KEY'],
    ['Es_Ref', true, 'MBE_PRIMARY_KEY_FOREIGN_KEY_CONFLICT']
  ];
  cases.forEach(([field, value, code]) => {
    const schema = createSchema();
    schema.tables[0].columns[0][field] = value;
    if (field === 'Es_Ref') schema.tables[0].columns[0].Tabla_Referencia = 'CORE_ITEMS';
    assertError(build(schema), code);
  });
});

test('allows zero or one label and rejects multiple labels', () => {
  assert.equal(build(createSchema()).ok, true);
  const labeled = createTable({
    columns: [
      createColumn(),
      createColumn({
        ID_Columna: 'LABEL',
        Nombre_Campo: 'Display',
        Es_Key: false,
        Es_Label: true,
        Orden: 2
      })
    ]
  });
  const one = build(createSchema([labeled]));
  assert.equal(one.ok, true);
  assert.equal(one.model.tables[0].labelColumn.name, 'Display');

  labeled.columns.push(
    createColumn({
      ID_Columna: 'LABEL_2',
      Nombre_Campo: 'Display2',
      Es_Key: false,
      Es_Label: true,
      Orden: 3
    })
  );
  assertError(build(createSchema([labeled])), 'MBE_MULTIPLE_LABELS');
});

test('does not infer PK or label from ID_, Nombre or Codigo', () => {
  const table = createTable({
    columns: [
      createColumn({ Es_Key: false }),
      createColumn({
        ID_Columna: 'NAME',
        Nombre_Campo: 'Nombre',
        Es_Key: false,
        Es_Label: false,
        Orden: 2
      }),
      createColumn({
        ID_Columna: 'CODE',
        Nombre_Campo: 'Codigo',
        Es_Key: false,
        Es_Label: false,
        Orden: 3
      })
    ]
  });
  assertError(build(createSchema([table])), 'MBE_MISSING_PRIMARY_KEY');
});

function createReferenceSchema(sourceType = 'Ref', targetOverrides = {}) {
  const target = createTable({
    id: 'TARGET',
    code: 'TARGET',
    physicalName: 'TARGET_TABLE',
    columns: [createColumn({ ID_Columna: 'TARGET_ID', Tabla: 'TARGET_TABLE' })],
    ...targetOverrides
  });
  const source = createTable({
    id: 'SOURCE',
    code: 'SOURCE',
    physicalName: 'SOURCE_TABLE',
    columns: [
      createColumn({ ID_Columna: 'SOURCE_ID', Tabla: 'SOURCE_TABLE' }),
      createColumn({
        ID_Columna: 'SOURCE_FK',
        Tabla: 'SOURCE_TABLE',
        Nombre_Campo: 'Target',
        Tipo_Dato: sourceType,
        Es_Key: false,
        Es_Ref: true,
        Tabla_Referencia: 'TARGET_TABLE',
        Orden: 2
      })
    ]
  });
  return createSchema([source, target]);
}

test('resolves Ref storage type from the target PK', () => {
  const result = build(createReferenceSchema('Ref'));
  assert.equal(result.ok, true);
  const source = result.model.tables.find(table => table.id === 'SOURCE');
  assert.equal(source.foreignKeys[0].storageType, 'Text');
  assert.equal(source.foreignKeys[0].targetPrimaryKeyColumnName, 'ID_Item');
});

test('accepts compatible non-Ref FK and rejects incompatible type', () => {
  assert.equal(build(createReferenceSchema('Text')).ok, true);
  assertError(build(createReferenceSchema('Number')), 'MBE_INCOMPATIBLE_FOREIGN_KEY_TYPE');
});

test('rejects empty, missing, duplicate, inactive and keyless FK targets', () => {
  const empty = createReferenceSchema();
  empty.tables[0].columns[1].Tabla_Referencia = '';
  assertError(build(empty), 'MBE_UNRESOLVABLE_FOREIGN_KEY');

  const missing = createReferenceSchema();
  missing.tables[0].columns[1].Tabla_Referencia = 'UNKNOWN';
  assertError(build(missing), 'MBE_UNRESOLVABLE_FOREIGN_KEY');

  const duplicate = createReferenceSchema();
  duplicate.tables.push(
    createTable({
      id: 'TARGET_2',
      code: 'TARGET_2',
      physicalName: 'TARGET_TABLE',
      columns: [createColumn({ ID_Columna: 'TARGET_2_ID', Tabla: 'TARGET_TABLE' })]
    })
  );
  duplicate.summary.tables += 1;
  duplicate.summary.columns += 1;
  assertError(build(duplicate), 'MBE_UNRESOLVABLE_FOREIGN_KEY');

  assertError(
    build(createReferenceSchema('Ref', { active: false, columns: [] })),
    'MBE_INACTIVE_FOREIGN_KEY_TARGET'
  );

  const keyless = createReferenceSchema();
  keyless.tables[1].columns[0].Es_Key = false;
  assertError(build(keyless), 'MBE_FOREIGN_KEY_TARGET_WITHOUT_PK');
});

test('never resolves an FK against a structurally invalid target PK', () => {
  const cases = [
    {
      ownCode: 'MBE_NULLABLE_PRIMARY_KEY',
      mutate(schema) {
        schema.tables[1].columns[0].Permite_Nulos = true;
      }
    },
    {
      ownCode: 'MBE_OPTIONAL_PRIMARY_KEY',
      mutate(schema) {
        schema.tables[1].columns[0].Es_Requerido = false;
      }
    },
    {
      ownCode: 'MBE_VIRTUAL_PRIMARY_KEY',
      mutate(schema) {
        schema.tables[1].columns[0].Es_Virtual = true;
      }
    },
    {
      ownCode: 'MBE_PRIMARY_KEY_FOREIGN_KEY_CONFLICT',
      mutate(schema) {
        schema.tables[1].columns[0].Es_Ref = true;
        schema.tables[1].columns[0].Tabla_Referencia = 'SOURCE_TABLE';
      }
    },
    {
      ownCode: 'MBE_INVALID_PRIMARY_KEY_TYPE',
      mutate(schema) {
        schema.tables[1].columns[0].Tipo_Dato = 'Email';
      }
    },
    {
      ownCode: 'MBE_MULTIPLE_PRIMARY_KEYS',
      mutate(schema) {
        schema.tables[1].columns.push(
          createColumn({
            ID_Columna: 'TARGET_ID_2',
            Tabla: 'TARGET_TABLE',
            Nombre_Campo: 'ID_Second',
            Orden: 2
          })
        );
        schema.summary.columns += 1;
      }
    }
  ];

  cases.forEach(testCase => {
    const schema = createReferenceSchema();
    testCase.mutate(schema);
    const result = build(schema);
    assertError(result, testCase.ownCode);
    assert.ok(codes(result).includes('MBE_FOREIGN_KEY_TARGET_WITHOUT_PK'));
    assert.equal(result.summary.foreignKeys, 0);
  });
});

test('supports self references without recursion', () => {
  const table = createTable({
    columns: [
      createColumn(),
      createColumn({
        ID_Columna: 'PARENT',
        Nombre_Campo: 'Parent',
        Tipo_Dato: 'Ref',
        Es_Key: false,
        Es_Ref: true,
        Tabla_Referencia: 'CORE_ITEMS',
        Orden: 2
      })
    ]
  });
  const result = build(createSchema([table]));
  assert.equal(result.ok, true);
  assert.equal(result.model.tables[0].foreignKeys[0].targetTableId, 'TABLE_ITEMS');
});

test('supports cyclic references without recursive traversal', () => {
  const schema = createReferenceSchema();
  schema.tables[1].columns.push(
    createColumn({
      ID_Columna: 'BACK_REF',
      Tabla: 'TARGET_TABLE',
      Nombre_Campo: 'Source',
      Tipo_Dato: 'Ref',
      Es_Key: false,
      Es_Ref: true,
      Tabla_Referencia: 'SOURCE_TABLE',
      Orden: 2
    })
  );
  schema.summary.columns += 1;
  const result = build(schema);
  assert.equal(result.ok, true);
  assert.equal(result.summary.foreignKeys, 2);
});

test('rejects contradictory capabilities', () => {
  const requiredNullable = createSchema();
  requiredNullable.tables[0].columns[0].Permite_Nulos = true;
  assertError(build(requiredNullable), 'MBE_REQUIRED_NULLABLE_CONFLICT');

  const virtualEditable = createSchema();
  virtualEditable.tables[0].columns[0].Es_Virtual = true;
  virtualEditable.tables[0].columns[0].Editable = true;
  assertError(build(virtualEditable), 'MBE_VIRTUAL_EDITABLE_CONFLICT');

  const inactiveVisible = createSchema();
  inactiveVisible.tables[0].columns[0].Activo = false;
  inactiveVisible.tables[0].columns[0].Visible = true;
  assertError(build(inactiveVisible), 'MBE_INACTIVE_CAPABILITY_CONFLICT');
});

test('does not mutate deeply frozen input', () => {
  const schema = deepFreeze(createSchema());
  const before = JSON.stringify(schema);
  const result = build(schema);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(schema), before);
});

test('does not share mutable references with input', () => {
  const schema = createSchema();
  const result = build(schema);
  result.model.tables[0].columns[0].name = 'Changed';
  assert.equal(schema.tables[0].columns[0].Nombre_Campo, 'ID_Item');
});

test('is deterministic across input order and repeated execution', () => {
  const first = createTable();
  const second = createTable({
    id: 'AAA',
    code: 'AAA',
    physicalName: 'AAA_TABLE',
    columns: [createColumn({ ID_Columna: 'AAA_ID', Tabla: 'AAA_TABLE' })]
  });
  const schemaA = createSchema([first, second]);
  const schemaB = createSchema([clone(second), clone(first)]);
  assert.deepEqual(build(schemaA), build(schemaA));
  assert.deepEqual(build(schemaA).model, build(schemaB).model);
});

test('uses ordinal ordering for case, accents, ñ and Unicode characters', () => {
  const names = ['ñ_TABLE', 'a_TABLE', '😀_TABLE', 'A_TABLE', 'á_TABLE', 'Ω_TABLE'];
  const tables = names.map((physicalName, index) =>
    createTable({
      id: 'TABLE_' + index,
      code: 'CODE_' + index,
      physicalName,
      columns: [
        createColumn({
          ID_Columna: 'COLUMN_' + index,
          Tabla: physicalName
        })
      ]
    })
  );
  const schema = createSchema(tables);
  const expected = [...names].sort((left, right) => {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  });
  const first = build(schema);
  const second = build(schema);
  assert.equal(first.ok, true);
  assert.deepEqual(
    first.model.tables.map(table => table.physicalName),
    expected
  );
  assert.deepEqual(first, second);
});

test('produces fully JSON-serializable output', () => {
  const result = build(createSchema());
  assert.doesNotThrow(() => JSON.stringify(result));
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

test('sanitizes unexpected internal exceptions', () => {
  const hostile = new Proxy(
    {},
    {
      ownKeys() {
        throw new Error('secret internal failure');
      }
    }
  );
  const result = build(hostile);
  assert.deepEqual(codes(result), ['MBE_INTERNAL_ERROR']);
  assert.doesNotMatch(JSON.stringify(result), /secret internal failure/);
  assert.equal(result.model, null);
});

test('every error produces model null', () => {
  const schemas = [null, {}, createSchema()];
  schemas[2].tables[0].columns[0].Tipo_Dato = 'Unknown';
  schemas.forEach(schema => {
    const result = build(schema);
    assert.ok(result.diagnostics.some(item => item.severity === 'ERROR'));
    assert.equal(result.model, null);
  });
});

test('pure API contains no Apps Script service access', () => {
  const source = build.toString();
  for (const forbidden of [
    'SpreadsheetApp',
    'Logger',
    'Utilities',
    'PropertiesService',
    'aerpBuildFrameworkSchema',
    'new Date'
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test('pure API transitively avoids all Apps Script service doubles', () => {
  const serviceNames = [
    'SpreadsheetApp',
    'Logger',
    'Utilities',
    'PropertiesService',
    'LockService',
    'Session',
    'aerpBuildFrameworkSchema'
  ];
  const originalDescriptors = new Map();
  const accessed = [];
  serviceNames.forEach(name => {
    originalDescriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get() {
        accessed.push(name);
        throw new Error('service access forbidden');
      }
    });
  });
  try {
    const result = build(createSchema());
    assert.equal(result.ok, true);
    assert.deepEqual(accessed, []);
  } finally {
    serviceNames.forEach(name => {
      const descriptor = originalDescriptors.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    });
  }
});

test('Apps Script audit returns and logs only the sanitized audit shape', () => {
  const schema = createSchema();
  const entries = [];
  globalThis.aerpBuildFrameworkSchema = () => schema;
  globalThis.Logger = { log: value => entries.push(value) };
  try {
    const audit = globalThis.testMetadataBuilderEnterpriseCompatibilityAudit();
    assert.deepEqual(Object.keys(audit), ['ok', 'contractVersion', 'summary', 'diagnostics']);
    assert.equal(entries.length, 1);
    assert.deepEqual(JSON.parse(entries[0]), audit);
    assert.equal(JSON.stringify(audit).includes('CORE_ITEMS'), false);
  } finally {
    delete globalThis.aerpBuildFrameworkSchema;
    delete globalThis.Logger;
  }
});

test('Apps Script compatibility audit sanitizes scanner and builder failures', () => {
  const failures = [
    () => {
      throw new Error('private scanner failure');
    },
    () =>
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error('private builder failure');
          }
        }
      )
  ];
  failures.forEach(buildSchema => {
    const logs = [];
    globalThis.aerpBuildFrameworkSchema = buildSchema;
    globalThis.Logger = { log: value => logs.push(value) };
    try {
      const audit = globalThis.testMetadataBuilderEnterpriseCompatibilityAudit();
      assert.equal(audit.ok, false);
      assert.equal(audit.contractVersion, '1.0.0');
      assert.equal(audit.summary.tables, 0);
      assert.equal(audit.summary.errors, 1);
      assert.deepEqual(audit.diagnostics, [
        { code: 'MBE_INTERNAL_ERROR', severity: 'ERROR', path: '$' }
      ]);
      assert.doesNotMatch(JSON.stringify({ audit, logs }), /private .* failure/);
    } finally {
      delete globalThis.aerpBuildFrameworkSchema;
      delete globalThis.Logger;
    }
  });
});

test('Apps Script compatibility audit treats Logger as best effort', () => {
  const schema = createSchema();
  globalThis.aerpBuildFrameworkSchema = () => schema;
  try {
    delete globalThis.Logger;
    const withoutLogger = globalThis.testMetadataBuilderEnterpriseCompatibilityAudit();
    assert.equal(withoutLogger.ok, true);

    globalThis.Logger = {
      log() {
        throw new Error('private logger failure');
      }
    };
    const failingLogger = globalThis.testMetadataBuilderEnterpriseCompatibilityAudit();
    assert.deepEqual(failingLogger, withoutLogger);
  } finally {
    delete globalThis.aerpBuildFrameworkSchema;
    delete globalThis.Logger;
  }
});

test('asserts the previously uncovered diagnostic contract matrix directly', () => {
  const errorCases = [
    {
      expected: {
        code: 'MBE_ACTIVE_TABLE_WITHOUT_COLUMNS',
        severity: 'ERROR',
        path: '$.tables[0].columns',
        message: 'La tabla activa no contiene columnas activas.'
      },
      schema() {
        const value = createSchema();
        value.tables[0].columns = [];
        value.summary.columns = 0;
        return value;
      }
    },
    {
      expected: {
        code: 'MBE_INACTIVE_LABEL',
        severity: 'ERROR',
        path: '$.tables[0].columns[1].Activo',
        message: 'La columna Label debe estar activa.'
      },
      schema() {
        const table = createTable({
          columns: [
            createColumn(),
            createColumn({
              ID_Columna: 'INACTIVE_LABEL',
              Nombre_Campo: 'InactiveLabel',
              Es_Key: false,
              Es_Label: true,
              Es_Requerido: false,
              Activo: false,
              Orden: 2
            })
          ]
        });
        return createSchema([table]);
      }
    },
    {
      expected: {
        code: 'MBE_INVALID_COLUMN_FIELD',
        severity: 'ERROR',
        path: '$.tables[0].columns[0].Nombre_Mostrar',
        message: 'Un campo de la columna no es válido.'
      },
      schema() {
        const value = createSchema();
        value.tables[0].columns[0].Nombre_Mostrar = 7;
        return value;
      }
    },
    {
      expected: {
        code: 'MBE_INVALID_COLUMN_TABLE',
        severity: 'ERROR',
        path: '$.tables[0].columns[0].Tabla',
        message: 'La columna declara una tabla contenedora inválida.'
      },
      schema() {
        const value = createSchema();
        value.tables[0].columns[0].Tabla = 'OTHER';
        return value;
      }
    },
    {
      expected: {
        code: 'MBE_INVALID_COLUMNS',
        severity: 'ERROR',
        path: '$.tables[0].columns',
        message: 'La colección de columnas no es válida.'
      },
      schema() {
        const value = createSchema();
        value.tables[0].columns = {};
        return value;
      }
    },
    {
      expected: {
        code: 'MBE_INVALID_DATA_TYPE',
        severity: 'ERROR',
        path: '$.tables[0].columns[0].Tipo_Dato',
        message: 'El tipo de dato no está soportado.'
      },
      schema() {
        const value = createSchema();
        value.tables[0].columns[0].Tipo_Dato = 'Unknown';
        return value;
      }
    },
    {
      expected: {
        code: 'MBE_INVALID_GENERATED_AT',
        severity: 'ERROR',
        path: '$.generatedAt',
        message: 'La fecha de generación del FrameworkSchema no es válida.'
      },
      schema() {
        return createSchema(undefined, { generatedAt: 'invalid' });
      }
    },
    {
      expected: {
        code: 'MBE_INVALID_LABEL_TYPE',
        severity: 'ERROR',
        path: '$.tables[0].columns[1].Tipo_Dato',
        message: 'El tipo de la columna Label no es válido.'
      },
      schema() {
        const table = createTable({
          columns: [
            createColumn(),
            createColumn({
              ID_Columna: 'LABEL',
              Nombre_Campo: 'Label',
              Tipo_Dato: 'EnumList',
              Es_Key: false,
              Es_Label: true,
              Orden: 2
            })
          ]
        });
        return createSchema([table]);
      }
    },
    {
      expected: {
        code: 'MBE_INVALID_SUMMARY',
        severity: 'ERROR',
        path: '$.summary',
        message: 'El resumen del FrameworkSchema no es válido.'
      },
      schema() {
        return createSchema(undefined, { summary: [] });
      }
    },
    {
      expected: {
        code: 'MBE_INVALID_SUMMARY_FIELD',
        severity: 'ERROR',
        path: '$.summary.tables',
        message: 'Un campo del resumen no es válido.'
      },
      schema() {
        const value = createSchema();
        value.summary.tables = -1;
        return value;
      }
    },
    {
      expected: {
        code: 'MBE_MISSING_COLUMN_ID',
        severity: 'ERROR',
        path: '$.tables[0].columns[0].ID_Columna',
        message: 'La columna no tiene un identificador válido.'
      },
      schema() {
        const value = createSchema();
        value.tables[0].columns[0].ID_Columna = '';
        return value;
      }
    },
    {
      expected: {
        code: 'MBE_MISSING_COLUMN_NAME',
        severity: 'ERROR',
        path: '$.tables[0].columns[0].Nombre_Campo',
        message: 'La columna no tiene un nombre válido.'
      },
      schema() {
        const value = createSchema();
        value.tables[0].columns[0].Nombre_Campo = '';
        return value;
      }
    },
    {
      expected: {
        code: 'MBE_MISSING_PHYSICAL_NAME',
        severity: 'ERROR',
        path: '$.tables[0].physicalName',
        message: 'La tabla no tiene un nombre físico válido.'
      },
      schema() {
        const value = createSchema();
        value.tables[0].physicalName = '';
        value.tables[0].columns[0].Tabla = '';
        return value;
      }
    },
    {
      expected: {
        code: 'MBE_MISSING_TABLE_CODE',
        severity: 'ERROR',
        path: '$.tables[0].code',
        message: 'La tabla no tiene un código válido.'
      },
      schema() {
        const value = createSchema();
        value.tables[0].code = '';
        return value;
      }
    },
    {
      expected: {
        code: 'MBE_MISSING_TABLE_ID',
        severity: 'ERROR',
        path: '$.tables[0].id',
        message: 'La tabla no tiene un identificador válido.'
      },
      schema() {
        const value = createSchema();
        value.tables[0].id = '';
        return value;
      }
    }
  ];

  errorCases.forEach(testCase => {
    assertContractDiagnostic(build(testCase.schema()), testCase.expected);
  });

  const safeDefaultSchema = createSchema();
  delete safeDefaultSchema.tables[0].columns[0].Es_Buscable;
  assertContractDiagnostic(
    build(safeDefaultSchema),
    {
      code: 'MBE_SAFE_DEFAULT_APPLIED',
      severity: 'WARNING',
      path: '$.tables[0].columns[0].Es_Buscable',
      message: 'Se aplicó un valor seguro por defecto.'
    },
    false
  );
});

test('diagnostics expose only the frozen public shape and deterministic order', () => {
  const schema = createSchema();
  schema.tables[0].columns[0].Es_Key = 'TRUE';
  schema.extra = true;
  const first = build(schema);
  const second = build(schema);
  assert.deepEqual(first.diagnostics, second.diagnostics);
  first.diagnostics.forEach(diagnostic => {
    assert.deepEqual(Object.keys(diagnostic), ['code', 'severity', 'path', 'message']);
  });
});
