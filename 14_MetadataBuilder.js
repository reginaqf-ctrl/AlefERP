/**
 * ALEF ERP Framework
 * 14_MetadataBuilder.gs
 *
 * AERP-014 / AERP-038A - Metadata Builder strict legacy wrapper.
 * Adapta el contrato neutral validado a los consumidores legacy existentes.
 */

const AERP_METADATA_WRAPPER_CONTRACT_VERSION_ = '1.0.0';
const AERP_METADATA_WRAPPER_ERROR_MESSAGE_ = 'No fue posible construir el modelo de metadata.';
const AERP_METADATA_WRAPPER_WARNING_MESSAGES_ = Object.freeze({
  MBE_SUMMARY_MISMATCH: 'El resumen no coincide con el contenido y será recalculado.',
  MBE_NORMALIZED_LEGACY_ALIAS: 'Se normalizó un alias de tipo de dato permitido.',
  MBE_SAFE_DEFAULT_APPLIED: 'Se aplicó un valor seguro por defecto.'
});
const AERP_METADATA_WRAPPER_DATA_TYPES_ = Object.freeze([
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
const AERP_METADATA_WRAPPER_SUMMARY_FIELDS_ = [
  'tables',
  'activeTables',
  'inactiveTables',
  'columns',
  'activeColumns',
  'primaryKeys',
  'foreignKeys',
  'labels',
  'errors',
  'warnings'
];
const AERP_METADATA_WRAPPER_CAPABILITIES_ = [
  ['visibleColumnIds', 'visibleColumns', 'visible'],
  ['editableColumnIds', 'editableColumns', 'editable'],
  ['requiredColumnIds', 'requiredColumns', 'required'],
  ['searchableColumnIds', 'searchableColumns', 'searchable'],
  ['filterableColumnIds', 'filterableColumns', 'filterable'],
  ['sortableColumnIds', 'sortableColumns', 'sortable'],
  ['indexedColumnIds', 'indexedColumns', 'indexed'],
  ['virtualColumnIds', 'virtualColumns', 'virtual']
];

function aerpBuildMetadataModel() {
  try {
    const start = new Date();
    const schema = aerpBuildFrameworkSchema();
    if (typeof aerpBuildMetadataModelFromSchema !== 'function') {
      return aerpBuildLegacyMetadataFailure_();
    }
    const strictResult = aerpBuildMetadataModelFromSchema(schema);
    const validation = aerpValidateStrictMetadataResult_(strictResult);
    if (!validation.ok) {
      return aerpBuildLegacyMetadataFailure_();
    }
    const tables = strictResult.model.tables.map(aerpAdaptStrictTableToLegacy_);
    const generatedAt = new Date();
    const durationMs = new Date() - start;
    const diagnostics = aerpCopyStrictDiagnostics_(strictResult.diagnostics);
    return {
      version: strictResult.model.sourceSchemaVersion,
      generatedAt,
      tables,
      summary: {
        ok: true,
        contractVersion: AERP_METADATA_WRAPPER_CONTRACT_VERSION_,
        tables: strictResult.summary.tables,
        columns: strictResult.summary.columns,
        primaryKeys: strictResult.summary.primaryKeys,
        foreignKeys: strictResult.summary.foreignKeys,
        labels: strictResult.summary.labels,
        warnings: aerpDiagnosticMessagesBySeverity_(diagnostics, 'WARNING'),
        errors: [],
        diagnostics,
        durationMs
      }
    };
  } catch (_error) {
    return aerpBuildLegacyMetadataFailure_();
  }
}

function aerpValidateStrictMetadataResult_(result) {
  if (
    !aerpHasExactDataFields_(result, ['ok', 'contractVersion', 'model', 'diagnostics', 'summary'])
  ) {
    return { ok: false, contractFailure: false };
  }
  if (
    typeof result.ok !== 'boolean' ||
    result.contractVersion !== AERP_METADATA_WRAPPER_CONTRACT_VERSION_
  ) {
    return { ok: false };
  }
  if (!result.ok) return { ok: false };
  if (
    !aerpIsValidStrictDiagnostics_(result.diagnostics) ||
    !aerpIsValidStrictSummary_(result.summary)
  ) {
    return { ok: false };
  }
  const errors = result.diagnostics.filter(function (item) {
    return item.severity === 'ERROR';
  }).length;
  const warnings = result.diagnostics.length - errors;
  if (result.summary.errors !== errors || result.summary.warnings !== warnings) {
    return { ok: false };
  }
  if (
    result.model === null ||
    errors !== 0 ||
    !aerpIsValidStrictModel_(result.model, result.summary)
  ) {
    return { ok: false };
  }
  return { ok: true };
}

function aerpIsValidStrictDiagnostics_(diagnostics) {
  if (!aerpIsSafeDenseArray_(diagnostics)) return false;
  return diagnostics.every(function (diagnostic) {
    return (
      aerpHasExactDataFields_(diagnostic, ['code', 'severity', 'path', 'message']) &&
      Object.prototype.hasOwnProperty.call(
        AERP_METADATA_WRAPPER_WARNING_MESSAGES_,
        diagnostic.code
      ) &&
      diagnostic.severity === 'WARNING' &&
      diagnostic.message === AERP_METADATA_WRAPPER_WARNING_MESSAGES_[diagnostic.code] &&
      aerpIsSafeContractPath_(diagnostic.path)
    );
  });
}

function aerpIsValidStrictSummary_(summary) {
  return (
    aerpHasExactDataFields_(summary, AERP_METADATA_WRAPPER_SUMMARY_FIELDS_) &&
    AERP_METADATA_WRAPPER_SUMMARY_FIELDS_.every(function (field) {
      return Number.isInteger(summary[field]) && summary[field] >= 0;
    })
  );
}

function aerpIsValidStrictModel_(model, summary) {
  if (!aerpHasExactDataFields_(model, ['contractVersion', 'sourceSchemaVersion', 'tables']))
    return false;
  if (
    model.contractVersion !== AERP_METADATA_WRAPPER_CONTRACT_VERSION_ ||
    typeof model.sourceSchemaVersion !== 'string' ||
    model.sourceSchemaVersion === '' ||
    !aerpIsSafeDenseArray_(model.tables) ||
    model.tables.length !== summary.tables
  )
    return false;

  const tableIds = new Set();
  const physicalNames = new Set();
  const counts = {
    columns: 0,
    activeTables: 0,
    activeColumns: 0,
    primaryKeys: 0,
    foreignKeys: 0,
    labels: 0
  };
  for (let index = 0; index < model.tables.length; index += 1) {
    const table = model.tables[index];
    if (
      !aerpIsValidStrictTable_(table) ||
      tableIds.has(table.id) ||
      physicalNames.has(table.physicalName)
    ) {
      return false;
    }
    tableIds.add(table.id);
    physicalNames.add(table.physicalName);
    counts.columns += table.columns.length;
    counts.activeTables += table.active ? 1 : 0;
    counts.activeColumns += table.columns.filter(function (column) {
      return column.active;
    }).length;
    counts.primaryKeys += table.primaryKey ? 1 : 0;
    counts.foreignKeys += table.foreignKeys.length;
    counts.labels += table.labelColumn ? 1 : 0;
  }
  if (
    summary.activeTables !== counts.activeTables ||
    summary.inactiveTables !== model.tables.length - counts.activeTables ||
    summary.columns !== counts.columns ||
    summary.activeColumns !== counts.activeColumns ||
    summary.primaryKeys !== counts.primaryKeys ||
    summary.foreignKeys !== counts.foreignKeys ||
    summary.labels !== counts.labels
  )
    return false;

  const tablesById = new Map(
    model.tables.map(function (table) {
      return [table.id, table];
    })
  );
  return model.tables.every(function (table) {
    return table.foreignKeys.every(function (foreignKey) {
      const target = tablesById.get(foreignKey.targetTableId);
      const source = table.columns.find(function (column) {
        return column.id === foreignKey.sourceColumnId;
      });
      return Boolean(
        source &&
        target &&
        target.active &&
        target.physicalName === foreignKey.targetPhysicalName &&
        aerpIsFullyValidStrictPrimaryKey_(target) &&
        target.primaryKey.id === foreignKey.targetPrimaryKeyColumnId &&
        target.primaryKey.name === foreignKey.targetPrimaryKeyColumnName &&
        foreignKey.storageType === target.primaryKey.dataType &&
        (source.dataType === 'Ref' || source.dataType === foreignKey.storageType)
      );
    });
  });
}

function aerpIsValidStrictTable_(table) {
  const fields = [
    'id',
    'code',
    'name',
    'entity',
    'module',
    'category',
    'type',
    'classification',
    'physicalName',
    'prefix',
    'active',
    'primaryKey',
    'labelColumn',
    'foreignKeys',
    'columns',
    'capabilities'
  ];
  const strings = [
    'id',
    'code',
    'name',
    'entity',
    'module',
    'category',
    'type',
    'classification',
    'physicalName',
    'prefix'
  ];
  if (
    !aerpHasExactDataFields_(table, fields) ||
    !aerpIsNormalizedNonEmptyString_(table.id) ||
    !aerpIsNormalizedNonEmptyString_(table.code) ||
    !aerpIsNormalizedNonEmptyString_(table.physicalName) ||
    table.classification !== 'UNCLASSIFIED' ||
    !strings.every(function (field) {
      return typeof table[field] === 'string';
    }) ||
    typeof table.active !== 'boolean' ||
    !aerpIsSafeDenseArray_(table.columns) ||
    !aerpIsSafeDenseArray_(table.foreignKeys)
  )
    return false;

  const columnsById = new Map();
  const columnNames = new Set();
  const columnOrders = new Set();
  for (let index = 0; index < table.columns.length; index += 1) {
    const column = table.columns[index];
    if (
      !aerpIsValidStrictColumn_(column) ||
      column.table !== table.physicalName ||
      columnsById.has(column.id) ||
      columnNames.has(column.name) ||
      columnOrders.has(column.order)
    ) {
      return false;
    }
    columnsById.set(column.id, column);
    columnNames.add(column.name);
    columnOrders.add(column.order);
  }
  if (!aerpIsValidStrictCapabilities_(table.capabilities, columnsById)) return false;

  const keys = table.columns.filter(function (column) {
    return column.isKey;
  });
  const labels = table.columns.filter(function (column) {
    return column.isLabel;
  });
  if (table.active) {
    if (
      keys.length !== 1 ||
      !aerpMatchesStrictColumnIdentity_(table.primaryKey, columnsById, true) ||
      table.primaryKey.id !== keys[0].id ||
      !aerpIsFullyValidStrictPrimaryKey_(table)
    ) {
      return false;
    }
    if (labels.length > 1) return false;
    if (labels.length === 0 && table.labelColumn !== null) return false;
    if (
      labels.length === 1 &&
      (!aerpMatchesStrictColumnIdentity_(table.labelColumn, columnsById, true) ||
        table.labelColumn.id !== labels[0].id ||
        !labels[0].active ||
        labels[0].dataType === 'EnumList')
    ) {
      return false;
    }
  } else if (
    table.primaryKey !== null ||
    table.labelColumn !== null ||
    table.foreignKeys.length !== 0 ||
    keys.length !== 0 ||
    labels.length !== 0 ||
    AERP_METADATA_WRAPPER_CAPABILITIES_.some(function (definition) {
      return table.capabilities[definition[0]].length !== 0;
    })
  ) {
    return false;
  }

  const sources = new Set();
  const validForeignKeys = table.foreignKeys.every(function (foreignKey) {
    if (
      !aerpIsValidStrictForeignKey_(foreignKey, columnsById) ||
      sources.has(foreignKey.sourceColumnId)
    ) {
      return false;
    }
    sources.add(foreignKey.sourceColumnId);
    return true;
  });
  if (!validForeignKeys) return false;
  const expectedSources = table.active
    ? table.columns.filter(function (column) {
        return column.active && column.isRef;
      })
    : [];
  return (
    expectedSources.length === sources.size &&
    expectedSources.every(function (column) {
      return sources.has(column.id);
    })
  );
}

function aerpIsValidStrictColumn_(column) {
  const fields = [
    'id',
    'table',
    'name',
    'displayName',
    'dataType',
    'controlType',
    'isKey',
    'isLabel',
    'required',
    'nullable',
    'initialValue',
    'appFormula',
    'referenceTable',
    'length',
    'order',
    'active',
    'state',
    'createdAt',
    'updatedAt',
    'visible',
    'editable',
    'isRef',
    'virtual',
    'searchable',
    'filterable',
    'sortable',
    'indexed',
    'formGroup',
    'help',
    'placeholder'
  ];
  const strings = [
    'id',
    'table',
    'name',
    'displayName',
    'dataType',
    'controlType',
    'appFormula',
    'referenceTable',
    'state',
    'formGroup',
    'help',
    'placeholder'
  ];
  const booleans = [
    'isKey',
    'isLabel',
    'required',
    'nullable',
    'active',
    'visible',
    'editable',
    'isRef',
    'virtual',
    'searchable',
    'filterable',
    'sortable',
    'indexed'
  ];
  return (
    aerpHasExactDataFields_(column, fields) &&
    aerpIsNormalizedNonEmptyString_(column.id) &&
    aerpIsNormalizedNonEmptyString_(column.table) &&
    aerpIsNormalizedNonEmptyString_(column.name) &&
    aerpIsNormalizedNonEmptyString_(column.dataType) &&
    AERP_METADATA_WRAPPER_DATA_TYPES_.includes(column.dataType) &&
    strings.every(function (field) {
      return typeof column[field] === 'string';
    }) &&
    booleans.every(function (field) {
      return typeof column[field] === 'boolean';
    }) &&
    (column.length === null || (Number.isInteger(column.length) && column.length > 0)) &&
    Number.isInteger(column.order) &&
    column.order >= 1 &&
    (column.createdAt === null || aerpIsIsoDateString_(column.createdAt)) &&
    (column.updatedAt === null || aerpIsIsoDateString_(column.updatedAt)) &&
    (column.initialValue === null ||
      typeof column.initialValue === 'string' ||
      typeof column.initialValue === 'boolean' ||
      (typeof column.initialValue === 'number' && Number.isFinite(column.initialValue)))
  );
}

function aerpIsFullyValidStrictPrimaryKey_(table) {
  const key = table.primaryKey;
  return Boolean(
    table.active &&
    key &&
    key.isKey &&
    key.active &&
    ['Text', 'Number'].includes(key.dataType) &&
    key.required &&
    !key.nullable &&
    !key.virtual &&
    !key.isRef
  );
}

function aerpIsNormalizedNonEmptyString_(value) {
  return typeof value === 'string' && value !== '' && value === value.trim();
}

function aerpIsIsoDateString_(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function aerpMatchesStrictColumnIdentity_(identity, columnsById, required) {
  if (identity === null) return !required;
  if (!aerpIsValidStrictColumn_(identity)) return false;
  const column = columnsById.get(identity.id);
  return Boolean(
    column &&
    Reflect.ownKeys(column).every(function (key) {
      return Object.is(column[key], identity[key]);
    })
  );
}

function aerpIsValidStrictForeignKey_(foreignKey, columnsById) {
  const fields = [
    'sourceColumnId',
    'sourceColumnName',
    'storageType',
    'targetTableId',
    'targetPhysicalName',
    'targetPrimaryKeyColumnId',
    'targetPrimaryKeyColumnName'
  ];
  if (
    !aerpHasExactDataFields_(foreignKey, fields) ||
    !fields.every(function (field) {
      return typeof foreignKey[field] === 'string';
    })
  )
    return false;
  const source = columnsById.get(foreignKey.sourceColumnId);
  return Boolean(
    source &&
    source.name === foreignKey.sourceColumnName &&
    source.isRef &&
    source.referenceTable === foreignKey.targetPhysicalName
  );
}

function aerpIsValidStrictCapabilities_(capabilities, columnsById) {
  const fields = AERP_METADATA_WRAPPER_CAPABILITIES_.map(function (item) {
    return item[0];
  });
  if (!aerpHasExactDataFields_(capabilities, fields)) return false;
  return AERP_METADATA_WRAPPER_CAPABILITIES_.every(function (definition) {
    const ids = capabilities[definition[0]];
    if (!aerpIsSafeDenseArray_(ids)) return false;
    const seen = new Set();
    const validIds = ids.every(function (id) {
      const column = columnsById.get(id);
      if (typeof id !== 'string' || seen.has(id) || !column || column[definition[2]] !== true)
        return false;
      seen.add(id);
      return true;
    });
    return (
      validIds &&
      Array.from(columnsById.values()).every(function (column) {
        return column[definition[2]] === seen.has(column.id);
      })
    );
  });
}

function aerpIsSafeDenseArray_(value) {
  if (!Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || keys[keys.length - 1] !== 'length') return false;
  for (let index = 0; index < value.length; index += 1) {
    if (keys[index] !== String(index)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return false;
  }
  return true;
}

function aerpIsSafeContractPath_(path) {
  return (
    typeof path === 'string' &&
    path.length > 0 &&
    path.length <= 256 &&
    /^\$(?:(?:\.[A-Za-z_][A-Za-z0-9_]*)|(?:\[\d+\]))*$/.test(path)
  );
}

function aerpHasExactDataFields_(value, expectedFields) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedFields.length ||
    keys.some(function (key) {
      return typeof key !== 'string';
    })
  )
    return false;
  const expected = new Set(expectedFields);
  return keys.every(function (key) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return (
      expected.has(key) && descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
    );
  });
}

function aerpAdaptStrictTableToLegacy_(table) {
  const columnsById = new Map(
    table.columns.map(function (column) {
      return [column.id, column];
    })
  );
  const primaryKey = table.primaryKey
    ? aerpAdaptStrictColumnToLegacy_(columnsById.get(table.primaryKey.id))
    : null;
  const labelColumn = table.labelColumn
    ? aerpAdaptStrictColumnToLegacy_(columnsById.get(table.labelColumn.id))
    : null;
  const result = {
    id: table.id,
    code: table.code,
    name: table.name,
    entity: table.entity,
    module: table.module,
    category: table.category,
    type: table.type,
    physicalName: table.physicalName,
    prefix: table.prefix,
    active: table.active,
    primaryKey,
    labelColumn,
    foreignKeys: table.foreignKeys.map(function (foreignKey) {
      return aerpAdaptStrictColumnToLegacy_(columnsById.get(foreignKey.sourceColumnId));
    }),
    columns: table.columns.map(aerpAdaptStrictColumnToLegacy_)
  };
  AERP_METADATA_WRAPPER_CAPABILITIES_.forEach(function (definition) {
    result[definition[1]] = table.capabilities[definition[0]].map(function (id) {
      return aerpAdaptStrictColumnToLegacy_(columnsById.get(id));
    });
  });
  // Compatibilidad legacy fuera del contrato neutral; no ampliar estas listas historicas.
  result.auditColumns = table.columns
    .filter(function (column) {
      return aerpIsAuditColumn_(column.name);
    })
    .map(aerpAdaptStrictColumnToLegacy_);
  result.systemColumns = table.columns
    .filter(function (column) {
      return aerpIsSystemColumn_(column.name);
    })
    .map(aerpAdaptStrictColumnToLegacy_);
  result.businessColumns = table.columns
    .filter(function (column) {
      return !aerpIsAuditColumn_(column.name) && !aerpIsSystemColumn_(column.name);
    })
    .map(aerpAdaptStrictColumnToLegacy_);
  result.appSheet = aerpPrepareAppSheetMetadata_(table, primaryKey, labelColumn);
  result.sql = aerpPrepareSQLMetadata_(table, primaryKey);
  result.api = aerpPrepareAPIMetadata_(table, primaryKey, labelColumn);
  return result;
}

function aerpAdaptStrictColumnToLegacy_(column) {
  return {
    ID_Columna: column.id,
    Tabla: column.table,
    Nombre_Campo: column.name,
    Nombre_Mostrar: column.displayName,
    Tipo_Dato: column.dataType,
    Tipo_Control: column.controlType,
    Es_Key: column.isKey,
    Es_Label: column.isLabel,
    Es_Requerido: column.required,
    Permite_Nulos: column.nullable,
    Valor_Inicial: column.initialValue,
    Formula_App: column.appFormula,
    Tabla_Referencia: column.referenceTable,
    Longitud: column.length === null ? '' : column.length,
    Orden: column.order,
    Activo: column.active,
    Estado: column.state,
    Fecha_Creacion: column.createdAt === null ? '' : column.createdAt,
    Fecha_Actualizacion: column.updatedAt === null ? '' : column.updatedAt,
    Visible: column.visible,
    Editable: column.editable,
    Es_Ref: column.isRef,
    Es_Virtual: column.virtual,
    Es_Buscable: column.searchable,
    Es_Filtrable: column.filterable,
    Es_Ordenable: column.sortable,
    Es_Indexado: column.indexed,
    Grupo_Formulario: column.formGroup,
    Ayuda: column.help,
    Placeholder: column.placeholder
  };
}

function aerpCopyStrictDiagnostics_(diagnostics) {
  return diagnostics.map(function (diagnostic) {
    return {
      code: diagnostic.code,
      severity: 'WARNING',
      path: diagnostic.path,
      message: AERP_METADATA_WRAPPER_WARNING_MESSAGES_[diagnostic.code]
    };
  });
}

function aerpDiagnosticMessagesBySeverity_(diagnostics, severity) {
  return diagnostics
    .filter(function (diagnostic) {
      return diagnostic.severity === severity;
    })
    .map(function (diagnostic) {
      return diagnostic.message;
    });
}

function aerpBuildLegacyMetadataFailure_() {
  const safeDiagnostics = [
    {
      code: 'MBE_INTERNAL_ERROR',
      severity: 'ERROR',
      path: '$',
      message: AERP_METADATA_WRAPPER_ERROR_MESSAGE_
    }
  ];
  return {
    version: typeof AERP_VERSION === 'string' ? AERP_VERSION : '',
    generatedAt: null,
    tables: [],
    summary: {
      ok: false,
      contractVersion: AERP_METADATA_WRAPPER_CONTRACT_VERSION_,
      tables: 0,
      columns: 0,
      primaryKeys: 0,
      foreignKeys: 0,
      labels: 0,
      warnings: aerpDiagnosticMessagesBySeverity_(safeDiagnostics, 'WARNING'),
      errors: aerpDiagnosticMessagesBySeverity_(safeDiagnostics, 'ERROR'),
      diagnostics: safeDiagnostics,
      durationMs: 0
    }
  };
}

function aerpBoolFromMetadata_(value) {
  return value === true || String(value).toUpperCase() === 'TRUE';
}

function aerpIsAuditColumn_(name) {
  const n = String(name || '');
  return ['Fecha_Creacion', 'Fecha_Actualizacion', 'Creado_Por', 'Modificado_Por'].includes(n);
}

function aerpIsSystemColumn_(name) {
  const n = String(name || '');
  return ['Activo', 'Estado', 'Version', 'Orden', 'Observaciones'].includes(n);
}

function aerpPrepareAppSheetMetadata_(table, primaryKey, labelColumn) {
  return {
    tableName: table.physicalName,
    keyColumn: primaryKey ? primaryKey.Nombre_Campo : '',
    labelColumn: labelColumn ? labelColumn.Nombre_Campo : '',
    refs: table.foreignKeys.map(function (foreignKey) {
      return { column: foreignKey.sourceColumnName, refTable: foreignKey.targetPhysicalName };
    })
  };
}

function aerpPrepareSQLMetadata_(table, primaryKey) {
  return {
    tableName: table.physicalName,
    primaryKey: primaryKey ? primaryKey.Nombre_Campo : '',
    foreignKeys: table.foreignKeys.map(function (foreignKey) {
      return { column: foreignKey.sourceColumnName, referenceTable: foreignKey.targetPhysicalName };
    })
  };
}

function aerpPrepareAPIMetadata_(table, primaryKey, labelColumn) {
  return {
    resource: String(table.entity || table.physicalName || '').toLowerCase(),
    tableName: table.physicalName,
    idField: primaryKey ? primaryKey.Nombre_Campo : '',
    displayField: labelColumn ? labelColumn.Nombre_Campo : ''
  };
}

function aerpMetadataModelToJSON() {
  return JSON.stringify(aerpBuildMetadataModel(), null, 2);
}

function testMetadataBuilder() {
  const model = aerpBuildMetadataModel();
  const sanitizedSummary = {
    ok: model.summary.ok,
    contractVersion: model.summary.contractVersion,
    tables: model.summary.tables,
    columns: model.summary.columns,
    primaryKeys: model.summary.primaryKeys,
    foreignKeys: model.summary.foreignKeys,
    labels: model.summary.labels,
    errors: model.summary.errors.length,
    warnings: model.summary.warnings.length,
    diagnosticCodes: model.summary.diagnostics.map(function (diagnostic) {
      return diagnostic.code;
    }),
    durationMs: model.summary.durationMs
  };
  try {
    if (typeof Logger !== 'undefined' && Logger && typeof Logger.log === 'function') {
      Logger.log(JSON.stringify(sanitizedSummary));
    }
  } catch (_error) {
    // El logging es best effort y no altera el resultado construido.
  }
  if (!model.summary.ok) {
    throw new Error('Metadata Builder genero errores. Revisa el resumen sanitizado.');
  }
}
