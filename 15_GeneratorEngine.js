/**
 * ALEF ERP Framework
 * 15_GeneratorEngine.gs
 *
 * AERP-015 / AERP-038B - In-memory Generator consumer.
 */

const AERP_GEN_ERROR_MESSAGE_ = 'No fue posible construir el resultado Generator.';
const AERP_GEN_METADATA_ERROR_MESSAGE_ = 'El MetadataModel no es válido para Generator.';
const AERP_GEN_TYPES_ = Object.freeze([
  'Text',
  'LongText',
  'Number',
  'Decimal',
  'Price',
  'Percent',
  'Date',
  'DateTime',
  'Time',
  'YesNo',
  'Email',
  'Phone',
  'URL',
  'Image',
  'File',
  'Enum',
  'EnumList',
  'Ref',
  'LatLong',
  'Color'
]);
const AERP_GEN_TABLE_FIELDS_ = Object.freeze([
  'id',
  'code',
  'name',
  'entity',
  'module',
  'category',
  'type',
  'physicalName',
  'prefix',
  'active',
  'primaryKey',
  'labelColumn',
  'foreignKeys',
  'columns',
  'visibleColumns',
  'editableColumns',
  'requiredColumns',
  'searchableColumns',
  'filterableColumns',
  'sortableColumns',
  'indexedColumns',
  'virtualColumns',
  'auditColumns',
  'systemColumns',
  'businessColumns',
  'appSheet',
  'sql',
  'api'
]);
const AERP_GEN_COLUMN_FIELDS_ = Object.freeze([
  'ID_Columna',
  'Tabla',
  'Nombre_Campo',
  'Nombre_Mostrar',
  'Tipo_Dato',
  'Tipo_Control',
  'Es_Key',
  'Es_Label',
  'Es_Requerido',
  'Permite_Nulos',
  'Valor_Inicial',
  'Formula_App',
  'Tabla_Referencia',
  'Longitud',
  'Orden',
  'Activo',
  'Estado',
  'Fecha_Creacion',
  'Fecha_Actualizacion',
  'Visible',
  'Editable',
  'Es_Ref',
  'Es_Virtual',
  'Es_Buscable',
  'Es_Filtrable',
  'Es_Ordenable',
  'Es_Indexado',
  'Grupo_Formulario',
  'Ayuda',
  'Placeholder'
]);
const AERP_GEN_CAPABILITY_LISTS_ = Object.freeze([
  Object.freeze(['visibleColumns', 'Visible']),
  Object.freeze(['editableColumns', 'Editable']),
  Object.freeze(['requiredColumns', 'Es_Requerido']),
  Object.freeze(['searchableColumns', 'Es_Buscable']),
  Object.freeze(['filterableColumns', 'Es_Filtrable']),
  Object.freeze(['sortableColumns', 'Es_Ordenable']),
  Object.freeze(['indexedColumns', 'Es_Indexado']),
  Object.freeze(['virtualColumns', 'Es_Virtual'])
]);
const AERP_GEN_AUDIT_COLUMN_NAMES_ = Object.freeze([
  'Fecha_Creacion',
  'Fecha_Actualizacion',
  'Creado_Por',
  'Modificado_Por'
]);
const AERP_GEN_SYSTEM_COLUMN_NAMES_ = Object.freeze([
  'Activo',
  'Estado',
  'Version',
  'Orden',
  'Observaciones'
]);

function aerpBuildGeneratorEngineMVPFromMetadataModel(metadataModel) {
  try {
    if (!aerpGenValidateMetadataModel_(metadataModel)) {
      return aerpGenFailure_('GEN_METADATA_MODEL_INVALID', AERP_GEN_METADATA_ERROR_MESSAGE_);
    }

    const tables = metadataModel.tables.map(aerpBuildGeneratorTable_);
    const forms = metadataModel.tables.map(aerpBuildGeneratorForm_);
    const views = metadataModel.tables.map(aerpBuildGeneratorView_);
    const menus = metadataModel.tables.map(aerpBuildGeneratorMenu_);
    const application = aerpBuildApplicationObjectFromMetadata_(metadataModel);
    const lineage = aerpBuildMetadataLineage_(metadataModel);
    if (!aerpIsValidMetadataLineage_(lineage)) {
      return aerpGenFailure_('GEN_METADATA_MODEL_INVALID', AERP_GEN_METADATA_ERROR_MESSAGE_);
    }

    const builtResult = {
      ok: true,
      lineage,
      application,
      tables,
      forms,
      views,
      menus,
      summary: {
        tables: tables.length,
        forms: forms.length,
        views: views.length,
        menus: menus.length,
        errors: [],
        warnings: [],
        durationMs: 0
      },
      diagnostics: []
    };
    if (!aerpGenValidateBuiltResult_(builtResult, metadataModel)) {
      return aerpGenFailure_('GEN_INTERNAL_ERROR', AERP_GEN_ERROR_MESSAGE_);
    }
    return builtResult;
  } catch (_error) {
    return aerpGenFailure_('GEN_INTERNAL_ERROR', AERP_GEN_ERROR_MESSAGE_);
  }
}

function aerpBuildGeneratorEngineMVP() {
  try {
    const start = new Date();
    const metadataModel = aerpBuildMetadataModel();
    const result = aerpBuildGeneratorEngineMVPFromMetadataModel(metadataModel);
    const wrapped = aerpGenCopyResult_(result);
    if (wrapped.ok) wrapped.application.generatedAt = new Date();
    wrapped.summary.durationMs = new Date() - start;
    aerpGenLogSummaryBestEffort_(wrapped);
    return wrapped;
  } catch (_error) {
    return aerpGenFailure_('GEN_INTERNAL_ERROR', AERP_GEN_ERROR_MESSAGE_);
  }
}

function aerpGenValidateMetadataModel_(model) {
  if (!aerpGenHasDataFields_(model, ['version', 'generatedAt', 'tables', 'summary'])) return false;
  if (
    !aerpGenRequiredString_(model.version) ||
    !aerpGenValidGeneratedAt_(model.generatedAt) ||
    !aerpGenSafeArray_(model.tables)
  ) {
    return false;
  }
  const summaryFields = [
    'ok',
    'contractVersion',
    'tables',
    'columns',
    'primaryKeys',
    'foreignKeys',
    'labels',
    'warnings',
    'errors',
    'diagnostics',
    'durationMs'
  ];
  if (!aerpGenHasDataFields_(model.summary, summaryFields)) return false;
  if (
    model.summary.ok !== true ||
    !aerpGenSafeArray_(model.summary.errors) ||
    model.summary.errors.length !== 0 ||
    !aerpGenSafeArray_(model.summary.warnings) ||
    !aerpGenSafeArray_(model.summary.diagnostics) ||
    !aerpGenValidateStringArray_(model.summary.errors) ||
    !aerpGenValidateStringArray_(model.summary.warnings) ||
    !aerpGenValidateDiagnostics_(model.summary.diagnostics) ||
    model.summary.diagnostics.some(function (diagnostic) {
      return diagnostic.severity !== 'WARNING';
    }) ||
    model.summary.warnings.length !== model.summary.diagnostics.length ||
    !model.summary.warnings.every(function (warning, index) {
      return warning === model.summary.diagnostics[index].message;
    }) ||
    !Number.isInteger(model.summary.tables) ||
    !Number.isInteger(model.summary.columns) ||
    !Number.isInteger(model.summary.primaryKeys) ||
    !Number.isInteger(model.summary.foreignKeys) ||
    !Number.isInteger(model.summary.labels) ||
    !Number.isFinite(model.summary.durationMs) ||
    model.summary.durationMs < 0 ||
    model.summary.tables !== model.tables.length
  ) {
    return false;
  }

  const tableIds = new Set();
  const physicalNames = new Set();
  let columnCount = 0;
  let primaryKeyCount = 0;
  let foreignKeyCount = 0;
  let labelCount = 0;
  for (let index = 0; index < model.tables.length; index += 1) {
    const table = model.tables[index];
    if (!aerpGenValidateMetadataTable_(table)) return false;
    if (tableIds.has(table.id) || physicalNames.has(table.physicalName)) return false;
    tableIds.add(table.id);
    physicalNames.add(table.physicalName);
    columnCount += table.columns.length;
    primaryKeyCount += table.primaryKey === null ? 0 : 1;
    foreignKeyCount += table.foreignKeys.length;
    labelCount += table.labelColumn === null ? 0 : 1;
  }
  if (
    columnCount !== model.summary.columns ||
    primaryKeyCount !== model.summary.primaryKeys ||
    foreignKeyCount !== model.summary.foreignKeys ||
    labelCount !== model.summary.labels
  ) {
    return false;
  }

  return model.tables.every(function (table) {
    return table.columns.every(function (column) {
      return !column.Es_Ref || physicalNames.has(column.Tabla_Referencia);
    });
  });
}

function aerpGenValidateMetadataTable_(table) {
  if (!aerpGenHasDataFields_(table, AERP_GEN_TABLE_FIELDS_)) return false;
  if (
    !aerpGenRequiredString_(table.id) ||
    !aerpGenRequiredString_(table.code) ||
    !aerpGenRequiredString_(table.physicalName) ||
    !['name', 'entity', 'module', 'category', 'type', 'prefix'].every(function (field) {
      return typeof table[field] === 'string';
    }) ||
    typeof table.active !== 'boolean' ||
    !aerpGenSafeArray_(table.columns) ||
    !aerpGenSafeArray_(table.foreignKeys)
  ) {
    return false;
  }

  const columnsById = new Map();
  const columnNames = new Set();
  for (let index = 0; index < table.columns.length; index += 1) {
    const column = table.columns[index];
    if (
      !aerpGenValidateMetadataColumn_(column, table.physicalName) ||
      columnsById.has(column.ID_Columna) ||
      columnNames.has(column.Nombre_Campo)
    ) {
      return false;
    }
    columnsById.set(column.ID_Columna, column);
    columnNames.add(column.Nombre_Campo);
  }

  const keys = table.columns.filter(function (column) {
    return column.Es_Key;
  });
  if (table.active) {
    if (
      keys.length !== 1 ||
      !aerpGenMatchesColumn_(table.primaryKey, columnsById) ||
      table.primaryKey.ID_Columna !== keys[0].ID_Columna ||
      !['Text', 'Number'].includes(keys[0].Tipo_Dato) ||
      !keys[0].Activo ||
      !keys[0].Es_Requerido ||
      keys[0].Permite_Nulos ||
      keys[0].Es_Virtual ||
      keys[0].Es_Ref
    ) {
      return false;
    }
  } else if (table.primaryKey !== null) {
    return false;
  }

  const labels = table.columns.filter(function (column) {
    return column.Es_Label;
  });
  if (labels.length > 1) return false;
  if (labels.length === 0 && table.labelColumn !== null) return false;
  if (
    labels.length === 1 &&
    (!aerpGenMatchesColumn_(table.labelColumn, columnsById) ||
      table.labelColumn.ID_Columna !== labels[0].ID_Columna ||
      !labels[0].Activo)
  ) {
    return false;
  }

  if (
    !AERP_GEN_CAPABILITY_LISTS_.every(function (definition) {
      return aerpGenValidateColumnList_(table[definition[0]], columnsById, definition[1]);
    }) ||
    !aerpGenValidateClassifiedColumnList_(
      table.auditColumns,
      columnsById,
      AERP_GEN_AUDIT_COLUMN_NAMES_,
      true
    ) ||
    !aerpGenValidateClassifiedColumnList_(
      table.systemColumns,
      columnsById,
      AERP_GEN_SYSTEM_COLUMN_NAMES_,
      true
    ) ||
    !aerpGenValidateClassifiedColumnList_(
      table.businessColumns,
      columnsById,
      AERP_GEN_AUDIT_COLUMN_NAMES_.concat(AERP_GEN_SYSTEM_COLUMN_NAMES_),
      false
    ) ||
    !aerpGenValidateForeignKeys_(table.foreignKeys, columnsById) ||
    !aerpGenValidateLegacyProjections_(table)
  ) {
    return false;
  }
  return true;
}

function aerpGenValidateMetadataColumn_(column, physicalName) {
  if (!aerpGenHasDataFields_(column, AERP_GEN_COLUMN_FIELDS_)) return false;
  const booleans = [
    'Es_Key',
    'Es_Label',
    'Es_Requerido',
    'Permite_Nulos',
    'Activo',
    'Visible',
    'Editable',
    'Es_Ref',
    'Es_Virtual',
    'Es_Buscable',
    'Es_Filtrable',
    'Es_Ordenable',
    'Es_Indexado'
  ];
  const strings = [
    'Nombre_Mostrar',
    'Tipo_Control',
    'Formula_App',
    'Tabla_Referencia',
    'Estado',
    'Fecha_Creacion',
    'Fecha_Actualizacion',
    'Grupo_Formulario',
    'Ayuda',
    'Placeholder'
  ];
  return (
    aerpGenRequiredString_(column.ID_Columna) &&
    aerpGenRequiredString_(column.Tabla) &&
    aerpGenRequiredString_(column.Nombre_Campo) &&
    aerpGenRequiredString_(column.Tipo_Dato) &&
    AERP_GEN_TYPES_.includes(column.Tipo_Dato) &&
    column.Tabla === physicalName &&
    strings.every(function (field) {
      return typeof column[field] === 'string';
    }) &&
    (column.Valor_Inicial === null ||
      typeof column.Valor_Inicial === 'string' ||
      typeof column.Valor_Inicial === 'boolean' ||
      (typeof column.Valor_Inicial === 'number' && Number.isFinite(column.Valor_Inicial))) &&
    (column.Longitud === '' || (Number.isInteger(column.Longitud) && column.Longitud >= 0)) &&
    Number.isInteger(column.Orden) &&
    column.Orden >= 0 &&
    booleans.every(function (field) {
      return typeof column[field] === 'boolean';
    })
  );
}

function aerpGenValidateColumnList_(list, columnsById, flag) {
  if (!aerpGenSafeArray_(list)) return false;
  const seen = new Set();
  for (let index = 0; index < list.length; index += 1) {
    const entry = list[index];
    if (!aerpGenHasDataFields_(entry, AERP_GEN_COLUMN_FIELDS_)) return false;
    const source = columnsById.get(entry.ID_Columna);
    if (
      !source ||
      !aerpGenValidateMetadataColumn_(entry, source.Tabla) ||
      seen.has(entry.ID_Columna) ||
      source[flag] !== true ||
      !aerpGenSameDataObject_(source, entry)
    ) {
      return false;
    }
    seen.add(entry.ID_Columna);
  }
  return Array.from(columnsById.values()).every(function (column) {
    return column[flag] === seen.has(column.ID_Columna);
  });
}

function aerpGenValidateClassifiedColumnList_(list, columnsById, names, included) {
  if (!aerpGenSafeArray_(list)) return false;
  const expected = Array.from(columnsById.values()).filter(function (column) {
    return names.includes(column.Nombre_Campo) === included;
  });
  return aerpGenValidateExactColumnSequence_(list, expected, columnsById);
}

function aerpGenValidateExactColumnSequence_(list, expected, columnsById) {
  if (!aerpGenSafeArray_(list) || list.length !== expected.length) return false;
  for (let index = 0; index < list.length; index += 1) {
    const entry = list[index];
    if (
      !aerpGenHasDataFields_(entry, AERP_GEN_COLUMN_FIELDS_) ||
      !aerpGenValidateMetadataColumn_(entry, expected[index].Tabla) ||
      !columnsById.has(entry.ID_Columna) ||
      !aerpGenSameDataObject_(entry, expected[index])
    ) {
      return false;
    }
  }
  return true;
}

function aerpGenValidateForeignKeys_(foreignKeys, columnsById) {
  if (!aerpGenSafeArray_(foreignKeys)) return false;
  const expected = Array.from(columnsById.values()).filter(function (column) {
    return column.Activo && column.Es_Ref;
  });
  expected.sort(function (left, right) {
    return aerpGenCompareOrdinal_(left.Nombre_Campo, right.Nombre_Campo);
  });
  if (!aerpGenValidateExactColumnSequence_(foreignKeys, expected, columnsById)) return false;
  return foreignKeys.every(function (column) {
    return aerpGenRequiredString_(column.Tabla_Referencia);
  });
}

function aerpGenValidateLegacyProjections_(table) {
  const expectedRefs = table.foreignKeys.map(function (column) {
    return { column: column.Nombre_Campo, refTable: column.Tabla_Referencia };
  });
  const expectedSqlRefs = table.foreignKeys.map(function (column) {
    return { column: column.Nombre_Campo, referenceTable: column.Tabla_Referencia };
  });
  return (
    aerpGenHasDataFields_(table.appSheet, ['tableName', 'keyColumn', 'labelColumn', 'refs']) &&
    table.appSheet.tableName === table.physicalName &&
    table.appSheet.keyColumn === (table.primaryKey ? table.primaryKey.Nombre_Campo : '') &&
    table.appSheet.labelColumn === (table.labelColumn ? table.labelColumn.Nombre_Campo : '') &&
    aerpGenValidateReferenceProjection_(table.appSheet.refs, expectedRefs, 'refTable') &&
    aerpGenHasDataFields_(table.sql, ['tableName', 'primaryKey', 'foreignKeys']) &&
    table.sql.tableName === table.physicalName &&
    table.sql.primaryKey === (table.primaryKey ? table.primaryKey.Nombre_Campo : '') &&
    aerpGenValidateReferenceProjection_(table.sql.foreignKeys, expectedSqlRefs, 'referenceTable') &&
    aerpGenHasDataFields_(table.api, ['resource', 'tableName', 'idField', 'displayField']) &&
    typeof table.api.resource === 'string' &&
    table.api.resource === String(table.entity || table.physicalName).toLowerCase() &&
    table.api.tableName === table.physicalName &&
    table.api.idField === (table.primaryKey ? table.primaryKey.Nombre_Campo : '') &&
    table.api.displayField === (table.labelColumn ? table.labelColumn.Nombre_Campo : '')
  );
}

function aerpGenValidateReferenceProjection_(actual, expected, targetField) {
  if (!aerpGenSafeArray_(actual) || actual.length !== expected.length) return false;
  for (let index = 0; index < actual.length; index += 1) {
    if (
      !aerpGenHasDataFields_(actual[index], ['column', targetField]) ||
      actual[index].column !== expected[index].column ||
      actual[index][targetField] !== expected[index][targetField]
    ) {
      return false;
    }
  }
  return true;
}

function aerpGenMatchesColumn_(pointer, columnsById) {
  if (pointer === null || !aerpGenHasDataFields_(pointer, AERP_GEN_COLUMN_FIELDS_)) return false;
  const source = columnsById.get(pointer.ID_Columna);
  return Boolean(
    source &&
    aerpGenValidateMetadataColumn_(pointer, source.Tabla) &&
    aerpGenSameDataObject_(source, pointer)
  );
}

function aerpGenSameDataObject_(left, right) {
  return AERP_GEN_COLUMN_FIELDS_.every(function (field) {
    return Object.is(left[field], right[field]);
  });
}

function aerpGenHasDataFields_(value, fields) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== fields.length ||
    keys.some(function (key) {
      return typeof key !== 'string';
    })
  ) {
    return false;
  }
  const expected = new Set(fields);
  return keys.every(function (key) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return (
      expected.has(key) && descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
    );
  });
}

function aerpGenSafeArray_(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || keys[keys.length - 1] !== 'length') return false;
  for (let index = 0; index < value.length; index += 1) {
    if (keys[index] !== String(index)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return false;
  }
  return true;
}

function aerpGenValidateStringArray_(value) {
  return (
    aerpGenSafeArray_(value) &&
    value.every(function (entry) {
      return typeof entry === 'string';
    })
  );
}

function aerpGenValidateDiagnostics_(diagnostics) {
  return diagnostics.every(function (diagnostic) {
    return (
      aerpGenHasDataFields_(diagnostic, ['code', 'severity', 'path', 'message']) &&
      aerpGenRequiredString_(diagnostic.code) &&
      (diagnostic.severity === 'WARNING' || diagnostic.severity === 'ERROR') &&
      typeof diagnostic.path === 'string' &&
      typeof diagnostic.message === 'string'
    );
  });
}

function aerpGenValidGeneratedAt_(value) {
  return (
    value === null ||
    (typeof value === 'string' && value !== '') ||
    (value instanceof Date && Number.isFinite(value.getTime()))
  );
}

function aerpGenCompareOrdinal_(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function aerpGenRequiredString_(value) {
  return typeof value === 'string' && value !== '' && value === value.trim();
}

function aerpGenValidateBuiltResult_(result, model) {
  if (
    !aerpGenHasDataFields_(result, [
      'ok',
      'lineage',
      'application',
      'tables',
      'forms',
      'views',
      'menus',
      'summary',
      'diagnostics'
    ]) ||
    result.ok !== true ||
    !aerpIsValidMetadataLineage_(result.lineage) ||
    !aerpMetadataLineageEquals_(result.lineage, aerpBuildMetadataLineage_(model)) ||
    !aerpGenSafeArray_(result.tables) ||
    !aerpGenSafeArray_(result.forms) ||
    !aerpGenSafeArray_(result.views) ||
    !aerpGenSafeArray_(result.menus) ||
    !aerpGenSafeArray_(result.diagnostics) ||
    result.diagnostics.length !== 0 ||
    result.tables.length !== model.tables.length ||
    result.forms.length !== model.tables.length ||
    result.views.length !== model.tables.length ||
    result.menus.length !== model.tables.length ||
    !aerpGenHasDataFields_(result.application, [
      'name',
      'edition',
      'version',
      'generatedAt',
      'platform',
      'status'
    ]) ||
    result.application.name !== 'Alef ERP' ||
    result.application.edition !== 'Launch Edition' ||
    result.application.version !== model.version ||
    result.application.generatedAt !== null ||
    result.application.platform !== 'AppSheet' ||
    result.application.status !== 'MVP'
  ) {
    return false;
  }
  for (let index = 0; index < model.tables.length; index += 1) {
    if (
      !aerpGenValidateBuiltTable_(result.tables[index], model.tables[index]) ||
      !aerpGenValidateBuiltFormOrView_(result.forms[index], model.tables[index], true) ||
      !aerpGenValidateBuiltFormOrView_(result.views[index], model.tables[index], false) ||
      !aerpGenValidateBuiltMenu_(result.menus[index], model.tables[index])
    ) {
      return false;
    }
  }
  return (
    aerpGenHasDataFields_(result.summary, [
      'tables',
      'forms',
      'views',
      'menus',
      'errors',
      'warnings',
      'durationMs'
    ]) &&
    result.summary.tables === result.tables.length &&
    result.summary.forms === result.forms.length &&
    result.summary.views === result.views.length &&
    result.summary.menus === result.menus.length &&
    aerpGenSafeArray_(result.summary.errors) &&
    result.summary.errors.length === 0 &&
    aerpGenSafeArray_(result.summary.warnings) &&
    result.summary.warnings.length === 0 &&
    result.summary.durationMs === 0
  );
}

function aerpGenValidateBuiltTable_(table, source) {
  if (
    !aerpGenHasDataFields_(table, [
      'code',
      'name',
      'entity',
      'physicalName',
      'module',
      'category',
      'primaryKey',
      'labelColumn',
      'columns'
    ]) ||
    table.code !== source.code ||
    table.name !== source.name ||
    table.entity !== source.entity ||
    table.physicalName !== source.physicalName ||
    table.module !== source.module ||
    table.category !== source.category ||
    table.primaryKey !== (source.primaryKey ? source.primaryKey.Nombre_Campo : '') ||
    table.labelColumn !== (source.labelColumn ? source.labelColumn.Nombre_Campo : '') ||
    !aerpGenSafeArray_(table.columns) ||
    table.columns.length !== source.columns.length
  ) {
    return false;
  }
  return table.columns.every(function (column, index) {
    const expected = source.columns[index];
    return (
      aerpGenHasDataFields_(column, [
        'name',
        'displayName',
        'type',
        'control',
        'required',
        'visible',
        'editable',
        'isKey',
        'isLabel',
        'isRef',
        'refTable'
      ]) &&
      column.name === expected.Nombre_Campo &&
      column.displayName === expected.Nombre_Mostrar &&
      column.type === expected.Tipo_Dato &&
      column.control === expected.Tipo_Control &&
      column.required === expected.Es_Requerido &&
      column.visible === expected.Visible &&
      column.editable === expected.Editable &&
      column.isKey === expected.Es_Key &&
      column.isLabel === expected.Es_Label &&
      column.isRef === expected.Es_Ref &&
      column.refTable === expected.Tabla_Referencia
    );
  });
}

function aerpGenValidateBuiltFormOrView_(item, source, isForm) {
  const sourceColumns = isForm ? source.editableColumns : source.visibleColumns;
  return (
    aerpGenHasDataFields_(item, [
      'id',
      'name',
      'table',
      'type',
      'columns',
      'primaryKey',
      'labelColumn'
    ]) &&
    item.id === (isForm ? 'FORM_' : 'VIEW_') + source.physicalName &&
    item.name ===
      (isForm
        ? 'Formulario ' + (source.entity || source.name || source.physicalName)
        : source.name || source.physicalName) &&
    item.table === source.physicalName &&
    item.type === (isForm ? 'Form' : 'Table') &&
    aerpGenSameStringSequence_(
      item.columns,
      sourceColumns.map(function (column) {
        return column.Nombre_Campo;
      })
    ) &&
    item.primaryKey === (source.primaryKey ? source.primaryKey.Nombre_Campo : '') &&
    item.labelColumn === (source.labelColumn ? source.labelColumn.Nombre_Campo : '')
  );
}

function aerpGenValidateBuiltMenu_(menu, source) {
  return (
    aerpGenHasDataFields_(menu, ['id', 'name', 'module', 'table', 'view', 'order', 'visible']) &&
    menu.id === 'MENU_' + source.physicalName &&
    menu.name === (source.name || source.physicalName) &&
    menu.module === (source.module || '') &&
    menu.table === source.physicalName &&
    menu.view === 'VIEW_' + source.physicalName &&
    menu.order === 1 &&
    menu.visible === true
  );
}

function aerpGenSameStringSequence_(actual, expected) {
  if (!aerpGenSafeArray_(actual) || actual.length !== expected.length) return false;
  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] !== expected[index]) return false;
  }
  return true;
}

function aerpBuildApplicationObjectFromMetadata_(metadataModel) {
  return {
    name: 'Alef ERP',
    edition: 'Launch Edition',
    version: metadataModel.version,
    generatedAt: null,
    platform: 'AppSheet',
    status: 'MVP'
  };
}

function aerpBuildGeneratorTable_(table) {
  return {
    code: table.code,
    name: table.name,
    entity: table.entity,
    physicalName: table.physicalName,
    module: table.module,
    category: table.category,
    primaryKey: table.primaryKey ? table.primaryKey.Nombre_Campo : '',
    labelColumn: table.labelColumn ? table.labelColumn.Nombre_Campo : '',
    columns: table.columns.map(function (column) {
      return {
        name: column.Nombre_Campo,
        displayName: column.Nombre_Mostrar,
        type: column.Tipo_Dato,
        control: column.Tipo_Control,
        required: column.Es_Requerido,
        visible: column.Visible,
        editable: column.Editable,
        isKey: column.Es_Key,
        isLabel: column.Es_Label,
        isRef: column.Es_Ref,
        refTable: column.Tabla_Referencia
      };
    })
  };
}

function aerpBuildGeneratorForm_(table) {
  return {
    id: 'FORM_' + table.physicalName,
    name: 'Formulario ' + (table.entity || table.name || table.physicalName),
    table: table.physicalName,
    type: 'Form',
    columns: table.editableColumns.map(function (column) {
      return column.Nombre_Campo;
    }),
    primaryKey: table.primaryKey ? table.primaryKey.Nombre_Campo : '',
    labelColumn: table.labelColumn ? table.labelColumn.Nombre_Campo : ''
  };
}

function aerpBuildGeneratorView_(table) {
  return {
    id: 'VIEW_' + table.physicalName,
    name: table.name || table.physicalName,
    table: table.physicalName,
    type: 'Table',
    columns: table.visibleColumns.map(function (column) {
      return column.Nombre_Campo;
    }),
    primaryKey: table.primaryKey ? table.primaryKey.Nombre_Campo : '',
    labelColumn: table.labelColumn ? table.labelColumn.Nombre_Campo : ''
  };
}

function aerpBuildGeneratorMenu_(table) {
  return {
    id: 'MENU_' + table.physicalName,
    name: table.name || table.physicalName,
    module: table.module || '',
    table: table.physicalName,
    view: 'VIEW_' + table.physicalName,
    order: 1,
    visible: true
  };
}

function aerpGenFailure_(code, message) {
  return {
    ok: false,
    lineage: null,
    application: null,
    tables: [],
    forms: [],
    views: [],
    menus: [],
    summary: {
      tables: 0,
      forms: 0,
      views: 0,
      menus: 0,
      errors: [message],
      warnings: [],
      durationMs: 0
    },
    diagnostics: [{ code, severity: 'ERROR', stage: 'GENERATOR', message }]
  };
}

function aerpGenCopyResult_(result) {
  return {
    ok: result.ok,
    lineage: result.lineage ? { ...result.lineage } : null,
    application: result.application ? { ...result.application } : null,
    tables: result.tables.map(function (table) {
      return {
        ...table,
        columns: table.columns.map(function (column) {
          return { ...column };
        })
      };
    }),
    forms: result.forms.map(function (form) {
      return { ...form, columns: [...form.columns] };
    }),
    views: result.views.map(function (view) {
      return { ...view, columns: [...view.columns] };
    }),
    menus: result.menus.map(function (menu) {
      return { ...menu };
    }),
    summary: {
      ...result.summary,
      errors: [...result.summary.errors],
      warnings: [...result.summary.warnings]
    },
    diagnostics: result.diagnostics.map(function (diagnostic) {
      return { ...diagnostic };
    })
  };
}

function aerpGenLogSummaryBestEffort_(result) {
  try {
    if (typeof Logger !== 'undefined' && Logger && typeof Logger.log === 'function') {
      Logger.log(
        JSON.stringify({
          ok: result.ok,
          tables: result.summary.tables,
          forms: result.summary.forms,
          views: result.summary.views,
          menus: result.summary.menus,
          errors: result.summary.errors.length,
          warnings: result.summary.warnings.length,
          diagnosticCodes: result.diagnostics.map(function (item) {
            return item.code;
          }),
          durationMs: result.summary.durationMs
        })
      );
    }
  } catch (_error) {
    // Logging is best effort and cannot replace the constructed result.
  }
}

function aerpGeneratorEngineToJSON() {
  return JSON.stringify(aerpBuildGeneratorEngineMVP(), null, 2);
}

function testGeneratorEngineMVP() {
  const result = aerpBuildGeneratorEngineMVP();
  aerpGenLogSummaryBestEffort_(result);
  if (!result.ok) {
    throw new Error('Generator Engine no pudo construir un resultado válido.');
  }
  return result;
}
