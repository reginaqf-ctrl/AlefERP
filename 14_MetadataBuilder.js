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
const AERP_METADATA_WRAPPER_SUMMARY_FIELDS_ = Object.freeze([
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
]);
const AERP_METADATA_WRAPPER_CAPABILITIES_ = Object.freeze([
  Object.freeze(['visibleColumnIds', 'visibleColumns', 'visible']),
  Object.freeze(['editableColumnIds', 'editableColumns', 'editable']),
  Object.freeze(['requiredColumnIds', 'requiredColumns', 'required']),
  Object.freeze(['searchableColumnIds', 'searchableColumns', 'searchable']),
  Object.freeze(['filterableColumnIds', 'filterableColumns', 'filterable']),
  Object.freeze(['sortableColumnIds', 'sortableColumns', 'sortable']),
  Object.freeze(['indexedColumnIds', 'indexedColumns', 'indexed']),
  Object.freeze(['virtualColumnIds', 'virtualColumns', 'virtual'])
]);
const AERP_METADATA_LINEAGE_ALGORITHM_ = 'SHA-256';
const AERP_METADATA_LINEAGE_VERSION_ = '1.0.0';

function aerpBuildMetadataLineage_(metadataModel) {
  try {
    const canonical = aerpLineageCanonicalize_(metadataModel, '$', new WeakSet(), 0);
    if (canonical === null) return null;
    return {
      algorithm: AERP_METADATA_LINEAGE_ALGORITHM_,
      version: AERP_METADATA_LINEAGE_VERSION_,
      metadataFingerprint: aerpLineageSha256_(canonical)
    };
  } catch (_error) {
    return null;
  }
}

function aerpIsValidMetadataLineage_(lineage) {
  return Boolean(
    aerpHasExactDataFields_(lineage, ['algorithm', 'version', 'metadataFingerprint']) &&
    lineage.algorithm === AERP_METADATA_LINEAGE_ALGORITHM_ &&
    lineage.version === AERP_METADATA_LINEAGE_VERSION_ &&
    typeof lineage.metadataFingerprint === 'string' &&
    /^[0-9a-f]{64}$/.test(lineage.metadataFingerprint)
  );
}

function aerpMetadataLineageEquals_(left, right) {
  return Boolean(
    aerpIsValidMetadataLineage_(left) &&
    aerpIsValidMetadataLineage_(right) &&
    left.algorithm === right.algorithm &&
    left.version === right.version &&
    left.metadataFingerprint === right.metadataFingerprint
  );
}

function aerpLineageCanonicalize_(value, path, seen, depth) {
  if (depth > 128) return null;
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : null;
  if (typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) return null;
      const keys = Reflect.ownKeys(value);
      if (keys.length !== value.length + 1 || keys[keys.length - 1] !== 'length') return null;
      const entries = [];
      for (let index = 0; index < value.length; index += 1) {
        if (keys[index] !== String(index)) return null;
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
        const canonical = aerpLineageCanonicalize_(
          descriptor.value,
          path + '[' + index + ']',
          seen,
          depth + 1
        );
        if (canonical === null) return null;
        entries.push(canonical);
      }
      return '[' + entries.join(',') + ']';
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.some(function (key) {
        return typeof key !== 'string';
      })
    ) {
      return null;
    }
    if (
      keys.some(function (key) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return !descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value');
      })
    ) {
      return null;
    }
    const includedKeys = keys
      .filter(function (key) {
        return !(
          (path === '$' && key === 'generatedAt') ||
          (path === '$.summary' && key === 'durationMs')
        );
      })
      .sort(aerpLineageCompareOrdinal_);
    const entries = [];
    for (let index = 0; index < includedKeys.length; index += 1) {
      const key = includedKeys[index];
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
      const canonical = aerpLineageCanonicalize_(
        descriptor.value,
        path + '.' + key,
        seen,
        depth + 1
      );
      if (canonical === null) return null;
      entries.push(JSON.stringify(key) + ':' + canonical);
    }
    return '{' + entries.join(',') + '}';
  } finally {
    seen.delete(value);
  }
}

function aerpLineageCompareOrdinal_(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function aerpLineageSha256_(text) {
  const bytes = aerpLineageUtf8Bytes_(text);
  const bitLength = bytes.length * 8;
  bytes.push(128);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 4294967296);
  const low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((high >>> shift) & 255);
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((low >>> shift) & 255);

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const words = new Array(64);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4;
      words[index] =
        ((bytes[start] << 24) |
          (bytes[start + 1] << 16) |
          (bytes[start + 2] << 8) |
          bytes[start + 3]) >>>
        0;
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 =
        (aerpLineageRotateRight_(words[index - 15], 7) ^
          aerpLineageRotateRight_(words[index - 15], 18) ^
          (words[index - 15] >>> 3)) >>>
        0;
      const s1 =
        (aerpLineageRotateRight_(words[index - 2], 17) ^
          aerpLineageRotateRight_(words[index - 2], 19) ^
          (words[index - 2] >>> 10)) >>>
        0;
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 =
        (aerpLineageRotateRight_(e, 6) ^
          aerpLineageRotateRight_(e, 11) ^
          aerpLineageRotateRight_(e, 25)) >>>
        0;
      const choice = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + sum1 + choice + constants[index] + words[index]) >>> 0;
      const sum0 =
        (aerpLineageRotateRight_(a, 2) ^
          aerpLineageRotateRight_(a, 13) ^
          aerpLineageRotateRight_(a, 22)) >>>
        0;
      const majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return hash
    .map(function (value) {
      return ('00000000' + value.toString(16)).slice(-8);
    })
    .join('');
}

function aerpLineageRotateRight_(value, bits) {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

function aerpLineageUtf8Bytes_(text) {
  const bytes = [];
  for (let index = 0; index < text.length; index += 1) {
    let code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) throw new Error('Invalid UTF-16');
      code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error('Invalid UTF-16');
    }
    if (code < 128) bytes.push(code);
    else if (code < 2048) bytes.push(192 | (code >> 6), 128 | (code & 63));
    else if (code < 65536)
      bytes.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63));
    else
      bytes.push(
        240 | (code >> 18),
        128 | ((code >> 12) & 63),
        128 | ((code >> 6) & 63),
        128 | (code & 63)
      );
  }
  return bytes;
}

function aerpBuildMetadataModel() {
  try {
    const start = new Date();
    const schema = aerpBuildFrameworkSchema();
    const result = aerpBuildMetadataModelFromFrameworkSchema(schema);
    if (result.summary.ok) {
      result.generatedAt = new Date();
      result.summary.durationMs = new Date() - start;
    }
    return result;
  } catch (_error) {
    return aerpBuildLegacyMetadataFailure_();
  }
}

function aerpBuildMetadataModelFromFrameworkSchema(frameworkSchema) {
  try {
    const version = aerpGetFrameworkSchemaVersion_(frameworkSchema);
    if (typeof aerpBuildMetadataModelFromSchema !== 'function') {
      return aerpBuildLegacyMetadataFailureFromVersion_(version);
    }
    const strictResult = aerpBuildMetadataModelFromSchema(frameworkSchema);
    const validation = aerpValidateStrictMetadataResult_(strictResult);
    if (!validation.ok) {
      return aerpBuildLegacyMetadataFailureFromVersion_(version);
    }
    const tables = strictResult.model.tables.map(aerpAdaptStrictTableToLegacy_);
    const diagnostics = aerpCopyStrictDiagnostics_(strictResult.diagnostics);
    return {
      version: strictResult.model.sourceSchemaVersion,
      generatedAt: null,
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
        durationMs: 0
      }
    };
  } catch (_error) {
    return aerpBuildLegacyMetadataFailureFromVersion_(
      aerpGetFrameworkSchemaVersion_(frameworkSchema)
    );
  }
}

function aerpGetFrameworkSchemaVersion_(frameworkSchema) {
  try {
    if (frameworkSchema === null || typeof frameworkSchema !== 'object') return '';
    const descriptor = Object.getOwnPropertyDescriptor(frameworkSchema, 'version');
    return descriptor &&
      Object.prototype.hasOwnProperty.call(descriptor, 'value') &&
      typeof descriptor.value === 'string'
      ? descriptor.value
      : '';
  } catch (_error) {
    return '';
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
  return aerpBuildLegacyMetadataFailureFromVersion_(
    typeof AERP_VERSION === 'string' ? AERP_VERSION : ''
  );
}

function aerpBuildLegacyMetadataFailureFromVersion_(version) {
  const safeDiagnostics = [
    {
      code: 'MBE_INTERNAL_ERROR',
      severity: 'ERROR',
      path: '$',
      message: AERP_METADATA_WRAPPER_ERROR_MESSAGE_
    }
  ];
  return {
    version: typeof version === 'string' ? version : '',
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
