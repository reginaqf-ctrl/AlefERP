// @ts-nocheck
/**
 * Alef ERP - AERP-038A Metadata Builder Enterprise
 * Pure MetadataModel contract builder and strict validator.
 */

const AERP_METADATA_MODEL_CONTRACT_VERSION = '1.0.0';

const AERP_MBE_SEVERITY_ = Object.freeze({
  ERROR: 'ERROR',
  WARNING: 'WARNING'
});

const AERP_MBE_MESSAGES_ = Object.freeze({
  MBE_INVALID_INPUT: 'FrameworkSchema no es una entrada válida.',
  MBE_UNKNOWN_FIELD: 'El contrato contiene un campo desconocido.',
  MBE_INVALID_VERSION: 'La versión del FrameworkSchema no es válida.',
  MBE_INVALID_GENERATED_AT: 'La fecha de generación del FrameworkSchema no es válida.',
  MBE_INVALID_TABLES: 'La colección de tablas no es válida.',
  MBE_INVALID_SUMMARY: 'El resumen del FrameworkSchema no es válido.',
  MBE_INVALID_SUMMARY_FIELD: 'Un campo del resumen no es válido.',
  MBE_UPSTREAM_SCHEMA_ERROR: 'FrameworkSchema contiene errores previos.',
  MBE_SUMMARY_MISMATCH: 'El resumen no coincide con el contenido y será recalculado.',
  MBE_NORMALIZED_LEGACY_ALIAS: 'Se normalizó un alias de tipo de dato permitido.',
  MBE_SAFE_DEFAULT_APPLIED: 'Se aplicó un valor seguro por defecto.',
  MBE_MISSING_TABLE_ID: 'La tabla no tiene un identificador válido.',
  MBE_MISSING_TABLE_CODE: 'La tabla no tiene un código válido.',
  MBE_MISSING_PHYSICAL_NAME: 'La tabla no tiene un nombre físico válido.',
  MBE_INVALID_TABLE_FIELD: 'Un campo de la tabla no es válido.',
  MBE_DUPLICATE_TABLE_ID: 'El identificador de tabla está duplicado.',
  MBE_DUPLICATE_TABLE_CODE: 'El código de tabla está duplicado.',
  MBE_DUPLICATE_PHYSICAL_NAME: 'El nombre físico de tabla está duplicado.',
  MBE_INVALID_BOOLEAN: 'El valor booleano no es válido.',
  MBE_INVALID_COLUMNS: 'La colección de columnas no es válida.',
  MBE_ACTIVE_TABLE_WITHOUT_COLUMNS: 'La tabla activa no contiene columnas activas.',
  MBE_MISSING_COLUMN_ID: 'La columna no tiene un identificador válido.',
  MBE_MISSING_COLUMN_NAME: 'La columna no tiene un nombre válido.',
  MBE_INVALID_COLUMN_TABLE: 'La columna declara una tabla contenedora inválida.',
  MBE_INVALID_COLUMN_FIELD: 'Un campo de la columna no es válido.',
  MBE_DUPLICATE_COLUMN_ID: 'El identificador de columna está duplicado.',
  MBE_DUPLICATE_COLUMN_NAME: 'El nombre de columna está duplicado en la tabla.',
  MBE_INVALID_DATA_TYPE: 'El tipo de dato no está soportado.',
  MBE_INVALID_COLUMN_ORDER: 'El orden de columna no es válido.',
  MBE_MISSING_PRIMARY_KEY: 'La tabla activa no declara una Primary Key.',
  MBE_MULTIPLE_PRIMARY_KEYS: 'La tabla declara más de una Primary Key.',
  MBE_INVALID_PRIMARY_KEY_TYPE: 'El tipo de la Primary Key no es válido.',
  MBE_NULLABLE_PRIMARY_KEY: 'La Primary Key no puede permitir valores nulos.',
  MBE_OPTIONAL_PRIMARY_KEY: 'La Primary Key debe ser obligatoria.',
  MBE_VIRTUAL_PRIMARY_KEY: 'La Primary Key no puede ser virtual.',
  MBE_INACTIVE_PRIMARY_KEY: 'La Primary Key debe estar activa.',
  MBE_PRIMARY_KEY_FOREIGN_KEY_CONFLICT:
    'Una Primary Key no puede ser Foreign Key en esta versión del contrato.',
  MBE_MULTIPLE_LABELS: 'La tabla declara más de una columna Label.',
  MBE_INVALID_LABEL_TYPE: 'El tipo de la columna Label no es válido.',
  MBE_INACTIVE_LABEL: 'La columna Label debe estar activa.',
  MBE_UNRESOLVABLE_FOREIGN_KEY: 'La Foreign Key no tiene un destino resoluble.',
  MBE_INACTIVE_FOREIGN_KEY_TARGET: 'La Foreign Key apunta a una tabla inactiva.',
  MBE_FOREIGN_KEY_TARGET_WITHOUT_PK: 'La Foreign Key apunta a una tabla sin Primary Key válida.',
  MBE_INCOMPATIBLE_FOREIGN_KEY_TYPE: 'El tipo de la Foreign Key no es compatible con su destino.',
  MBE_INACTIVE_FOREIGN_KEY: 'Una columna inactiva no puede declarar una Foreign Key activa.',
  MBE_REQUIRED_NULLABLE_CONFLICT: 'La nulabilidad contradice la obligatoriedad de la columna.',
  MBE_VIRTUAL_EDITABLE_CONFLICT: 'Una columna virtual no puede ser editable.',
  MBE_INACTIVE_CAPABILITY_CONFLICT: 'Una columna inactiva no puede exponer capacidades activas.',
  MBE_INTERNAL_ERROR: 'No fue posible construir el modelo de metadata.'
});

const AERP_MBE_ROOT_FIELDS_ = Object.freeze(['version', 'generatedAt', 'tables', 'summary']);
const AERP_MBE_SUMMARY_FIELDS_ = Object.freeze([
  'tables',
  'columns',
  'relations',
  'views',
  'warnings',
  'errors',
  'durationMs'
]);
const AERP_MBE_TABLE_FIELDS_ = Object.freeze([
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
  'columns'
]);
const AERP_MBE_COLUMN_FIELDS_ = Object.freeze([
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
const AERP_MBE_DATA_TYPES_ = Object.freeze([
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
const AERP_MBE_PRIMARY_KEY_TYPES_ = Object.freeze(['Text', 'Number']);
const AERP_MBE_OPTIONAL_BOOLEAN_FIELDS_ = Object.freeze([
  'Es_Buscable',
  'Es_Filtrable',
  'Es_Ordenable',
  'Es_Indexado'
]);
const AERP_MBE_REQUIRED_BOOLEAN_FIELDS_ = Object.freeze([
  'Es_Key',
  'Es_Label',
  'Es_Requerido',
  'Permite_Nulos',
  'Activo',
  'Visible',
  'Editable',
  'Es_Ref',
  'Es_Virtual'
]);

function aerpMbeDiagnostic_(code, severity, path) {
  return {
    code,
    severity,
    path,
    message: AERP_MBE_MESSAGES_[code]
  };
}

function aerpMbeCompareOrdinal_(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function aerpMbeIsPlainObject_(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

function aerpMbeInspectObject_(value, allowedFields, path, diagnostics, invalidCode) {
  if (!aerpMbeIsPlainObject_(value)) {
    diagnostics.push(aerpMbeDiagnostic_(invalidCode, AERP_MBE_SEVERITY_.ERROR, path));
    return null;
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);
  Reflect.ownKeys(descriptors).forEach(field => {
    if (typeof field !== 'string') {
      diagnostics.push(
        aerpMbeDiagnostic_('MBE_UNKNOWN_FIELD', AERP_MBE_SEVERITY_.ERROR, path + '[symbol]')
      );
      return;
    }
    const descriptor = descriptors[field];
    const fieldPath = path === '$' ? '$.' + field : path + '.' + field;
    if (!allowedFields.includes(field)) {
      diagnostics.push(
        aerpMbeDiagnostic_('MBE_UNKNOWN_FIELD', AERP_MBE_SEVERITY_.ERROR, fieldPath)
      );
    }
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      diagnostics.push(
        aerpMbeDiagnostic_('MBE_INVALID_INPUT', AERP_MBE_SEVERITY_.ERROR, fieldPath)
      );
    }
  });
  return descriptors;
}

function aerpMbeInspectArray_(value, path, diagnostics, invalidCode) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    diagnostics.push(aerpMbeDiagnostic_(invalidCode, AERP_MBE_SEVERITY_.ERROR, path));
    return null;
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  let invalid = false;
  keys.forEach(key => {
    if (typeof key !== 'string') {
      diagnostics.push(
        aerpMbeDiagnostic_('MBE_UNKNOWN_FIELD', AERP_MBE_SEVERITY_.ERROR, path + '[symbol]')
      );
      return;
    }
    if (key === 'length') return;
    const descriptor = descriptors[key];
    if (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length) {
      diagnostics.push(
        aerpMbeDiagnostic_('MBE_UNKNOWN_FIELD', AERP_MBE_SEVERITY_.ERROR, path + '.' + key)
      );
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) invalid = true;
  });
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(descriptors, String(index))) invalid = true;
  }
  if (invalid) {
    diagnostics.push(aerpMbeDiagnostic_(invalidCode, AERP_MBE_SEVERITY_.ERROR, path));
    return null;
  }
  return descriptors;
}

function aerpMbeDescriptorValue_(descriptors, field) {
  const descriptor = descriptors && descriptors[field];
  return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ? descriptor.value
    : undefined;
}

function aerpMbeNormalizeString_(value) {
  return typeof value === 'string' ? value.trim() : null;
}

function aerpMbeNormalizeDate_(value) {
  if (value instanceof Date && Object.getPrototypeOf(value) === Date.prototype) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value !== 'string' || value.trim() === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function aerpMbeNormalizeDataType_(value) {
  if (typeof value !== 'string') return { value: null, alias: false };
  const trimmed = value.trim();
  const aliases = { 'Yes/No': 'YesNo', 'Long Text': 'LongText' };
  return { value: aliases[trimmed] || trimmed, alias: Boolean(aliases[trimmed]) };
}

function aerpMbeValidateStringArray_(value, path, diagnostics) {
  const descriptors = aerpMbeInspectArray_(value, path, diagnostics, 'MBE_INVALID_SUMMARY_FIELD');
  if (!descriptors) return [];
  const result = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = aerpMbeDescriptorValue_(descriptors, String(index));
    if (typeof item !== 'string') {
      diagnostics.push(
        aerpMbeDiagnostic_(
          'MBE_INVALID_SUMMARY_FIELD',
          AERP_MBE_SEVERITY_.ERROR,
          path + '[' + index + ']'
        )
      );
    } else {
      result.push(item);
    }
  }
  return result;
}

function aerpMbeValidateSummary_(value, diagnostics) {
  const descriptors = aerpMbeInspectObject_(
    value,
    AERP_MBE_SUMMARY_FIELDS_,
    '$.summary',
    diagnostics,
    'MBE_INVALID_SUMMARY'
  );
  if (!descriptors) return null;

  const result = {};
  ['tables', 'columns', 'relations', 'views', 'durationMs'].forEach(field => {
    const fieldValue = aerpMbeDescriptorValue_(descriptors, field);
    const valid =
      typeof fieldValue === 'number' &&
      Number.isFinite(fieldValue) &&
      fieldValue >= 0 &&
      (field === 'durationMs' || Number.isInteger(fieldValue));
    if (!valid) {
      diagnostics.push(
        aerpMbeDiagnostic_(
          'MBE_INVALID_SUMMARY_FIELD',
          AERP_MBE_SEVERITY_.ERROR,
          '$.summary.' + field
        )
      );
    }
    result[field] = valid ? fieldValue : 0;
  });
  result.warnings = aerpMbeValidateStringArray_(
    aerpMbeDescriptorValue_(descriptors, 'warnings'),
    '$.summary.warnings',
    diagnostics
  );
  result.errors = aerpMbeValidateStringArray_(
    aerpMbeDescriptorValue_(descriptors, 'errors'),
    '$.summary.errors',
    diagnostics
  );
  if (result.errors.length > 0) {
    diagnostics.push(
      aerpMbeDiagnostic_('MBE_UPSTREAM_SCHEMA_ERROR', AERP_MBE_SEVERITY_.ERROR, '$.summary.errors')
    );
  }
  return result;
}

function aerpMbeValidateOptionalValue_(value, path, diagnostics) {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return value;
  }
  const date = aerpMbeNormalizeDate_(value);
  if (date !== null) return date;
  diagnostics.push(aerpMbeDiagnostic_('MBE_INVALID_COLUMN_FIELD', AERP_MBE_SEVERITY_.ERROR, path));
  return null;
}

function aerpMbeColumnString_(descriptors, field, path, diagnostics, required) {
  const raw = aerpMbeDescriptorValue_(descriptors, field);
  if (raw === undefined && !required) return '';
  const value = aerpMbeNormalizeString_(raw);
  if (value === null || (required && value === '')) {
    diagnostics.push(
      aerpMbeDiagnostic_('MBE_INVALID_COLUMN_FIELD', AERP_MBE_SEVERITY_.ERROR, path + '.' + field)
    );
    return '';
  }
  return value;
}

function aerpMbeColumnBoolean_(descriptors, field, path, diagnostics, optional) {
  const raw = aerpMbeDescriptorValue_(descriptors, field);
  if (raw === undefined && optional) {
    diagnostics.push(
      aerpMbeDiagnostic_('MBE_SAFE_DEFAULT_APPLIED', AERP_MBE_SEVERITY_.WARNING, path + '.' + field)
    );
    return false;
  }
  if (typeof raw !== 'boolean') {
    diagnostics.push(
      aerpMbeDiagnostic_('MBE_INVALID_BOOLEAN', AERP_MBE_SEVERITY_.ERROR, path + '.' + field)
    );
    return false;
  }
  return raw;
}

function aerpMbeNormalizeColumn_(value, table, tableIndex, columnIndex, diagnostics) {
  const path = '$.tables[' + tableIndex + '].columns[' + columnIndex + ']';
  const descriptors = aerpMbeInspectObject_(
    value,
    AERP_MBE_COLUMN_FIELDS_,
    path,
    diagnostics,
    'MBE_INVALID_COLUMN_FIELD'
  );
  if (!descriptors) return null;

  const id = aerpMbeColumnString_(descriptors, 'ID_Columna', path, diagnostics, true);
  const tableName = aerpMbeColumnString_(descriptors, 'Tabla', path, diagnostics, true);
  const name = aerpMbeColumnString_(descriptors, 'Nombre_Campo', path, diagnostics, true);
  if (!id) {
    diagnostics.push(
      aerpMbeDiagnostic_('MBE_MISSING_COLUMN_ID', AERP_MBE_SEVERITY_.ERROR, path + '.ID_Columna')
    );
  }
  if (!name) {
    diagnostics.push(
      aerpMbeDiagnostic_(
        'MBE_MISSING_COLUMN_NAME',
        AERP_MBE_SEVERITY_.ERROR,
        path + '.Nombre_Campo'
      )
    );
  }
  if (tableName !== table.physicalName) {
    diagnostics.push(
      aerpMbeDiagnostic_('MBE_INVALID_COLUMN_TABLE', AERP_MBE_SEVERITY_.ERROR, path + '.Tabla')
    );
  }

  const normalizedType = aerpMbeNormalizeDataType_(
    aerpMbeDescriptorValue_(descriptors, 'Tipo_Dato')
  );
  if (!normalizedType.value || !AERP_MBE_DATA_TYPES_.includes(normalizedType.value)) {
    diagnostics.push(
      aerpMbeDiagnostic_('MBE_INVALID_DATA_TYPE', AERP_MBE_SEVERITY_.ERROR, path + '.Tipo_Dato')
    );
  } else if (normalizedType.alias) {
    diagnostics.push(
      aerpMbeDiagnostic_(
        'MBE_NORMALIZED_LEGACY_ALIAS',
        AERP_MBE_SEVERITY_.WARNING,
        path + '.Tipo_Dato'
      )
    );
  }

  const flags = {};
  AERP_MBE_REQUIRED_BOOLEAN_FIELDS_.forEach(field => {
    flags[field] = aerpMbeColumnBoolean_(descriptors, field, path, diagnostics, false);
  });
  AERP_MBE_OPTIONAL_BOOLEAN_FIELDS_.forEach(field => {
    flags[field] = aerpMbeColumnBoolean_(descriptors, field, path, diagnostics, true);
  });

  const order = aerpMbeDescriptorValue_(descriptors, 'Orden');
  if (!Number.isInteger(order) || order < 1) {
    diagnostics.push(
      aerpMbeDiagnostic_('MBE_INVALID_COLUMN_ORDER', AERP_MBE_SEVERITY_.ERROR, path + '.Orden')
    );
  }

  const lengthRaw = aerpMbeDescriptorValue_(descriptors, 'Longitud');
  let length = null;
  if (lengthRaw !== undefined && lengthRaw !== '') {
    if (!Number.isInteger(lengthRaw) || lengthRaw <= 0) {
      diagnostics.push(
        aerpMbeDiagnostic_('MBE_INVALID_COLUMN_FIELD', AERP_MBE_SEVERITY_.ERROR, path + '.Longitud')
      );
    } else {
      length = lengthRaw;
    }
  }

  const createdAtRaw = aerpMbeDescriptorValue_(descriptors, 'Fecha_Creacion');
  const updatedAtRaw = aerpMbeDescriptorValue_(descriptors, 'Fecha_Actualizacion');
  const createdAt =
    createdAtRaw === undefined || createdAtRaw === '' ? null : aerpMbeNormalizeDate_(createdAtRaw);
  const updatedAt =
    updatedAtRaw === undefined || updatedAtRaw === '' ? null : aerpMbeNormalizeDate_(updatedAtRaw);
  if (createdAtRaw !== undefined && createdAtRaw !== '' && createdAt === null) {
    diagnostics.push(
      aerpMbeDiagnostic_(
        'MBE_INVALID_COLUMN_FIELD',
        AERP_MBE_SEVERITY_.ERROR,
        path + '.Fecha_Creacion'
      )
    );
  }
  if (updatedAtRaw !== undefined && updatedAtRaw !== '' && updatedAt === null) {
    diagnostics.push(
      aerpMbeDiagnostic_(
        'MBE_INVALID_COLUMN_FIELD',
        AERP_MBE_SEVERITY_.ERROR,
        path + '.Fecha_Actualizacion'
      )
    );
  }

  const column = {
    id,
    table: tableName,
    name,
    displayName: aerpMbeColumnString_(descriptors, 'Nombre_Mostrar', path, diagnostics, false),
    dataType: normalizedType.value || '',
    controlType: aerpMbeColumnString_(descriptors, 'Tipo_Control', path, diagnostics, false),
    isKey: flags.Es_Key,
    isLabel: flags.Es_Label,
    required: flags.Es_Requerido,
    nullable: flags.Permite_Nulos,
    initialValue: aerpMbeValidateOptionalValue_(
      aerpMbeDescriptorValue_(descriptors, 'Valor_Inicial'),
      path + '.Valor_Inicial',
      diagnostics
    ),
    appFormula: aerpMbeColumnString_(descriptors, 'Formula_App', path, diagnostics, false),
    referenceTable: aerpMbeColumnString_(descriptors, 'Tabla_Referencia', path, diagnostics, false),
    length,
    order: Number.isInteger(order) && order >= 1 ? order : 0,
    active: flags.Activo,
    state: aerpMbeColumnString_(descriptors, 'Estado', path, diagnostics, false),
    createdAt,
    updatedAt,
    visible: flags.Visible,
    editable: flags.Editable,
    isRef: flags.Es_Ref,
    virtual: flags.Es_Virtual,
    searchable: flags.Es_Buscable,
    filterable: flags.Es_Filtrable,
    sortable: flags.Es_Ordenable,
    indexed: flags.Es_Indexado,
    formGroup: aerpMbeColumnString_(descriptors, 'Grupo_Formulario', path, diagnostics, false),
    help: aerpMbeColumnString_(descriptors, 'Ayuda', path, diagnostics, false),
    placeholder: aerpMbeColumnString_(descriptors, 'Placeholder', path, diagnostics, false),
    contractPath: path
  };

  if (column.required && column.nullable) {
    diagnostics.push(
      aerpMbeDiagnostic_(
        'MBE_REQUIRED_NULLABLE_CONFLICT',
        AERP_MBE_SEVERITY_.ERROR,
        path + '.Permite_Nulos'
      )
    );
  }
  if (column.virtual && column.editable) {
    diagnostics.push(
      aerpMbeDiagnostic_(
        'MBE_VIRTUAL_EDITABLE_CONFLICT',
        AERP_MBE_SEVERITY_.ERROR,
        path + '.Editable'
      )
    );
  }
  if (
    !column.active &&
    (column.visible ||
      column.editable ||
      column.required ||
      column.searchable ||
      column.filterable ||
      column.sortable ||
      column.indexed)
  ) {
    diagnostics.push(
      aerpMbeDiagnostic_(
        'MBE_INACTIVE_CAPABILITY_CONFLICT',
        AERP_MBE_SEVERITY_.ERROR,
        path + '.Activo'
      )
    );
  }
  if (!column.active && column.isKey) {
    diagnostics.push(
      aerpMbeDiagnostic_('MBE_INACTIVE_PRIMARY_KEY', AERP_MBE_SEVERITY_.ERROR, path + '.Activo')
    );
  }
  if (!column.active && column.isLabel) {
    diagnostics.push(
      aerpMbeDiagnostic_('MBE_INACTIVE_LABEL', AERP_MBE_SEVERITY_.ERROR, path + '.Activo')
    );
  }
  if (!column.active && column.isRef) {
    diagnostics.push(
      aerpMbeDiagnostic_('MBE_INACTIVE_FOREIGN_KEY', AERP_MBE_SEVERITY_.ERROR, path + '.Activo')
    );
  }
  return column;
}

function aerpMbeNormalizeTable_(value, tableIndex, diagnostics, globalColumnIds) {
  const path = '$.tables[' + tableIndex + ']';
  const descriptors = aerpMbeInspectObject_(
    value,
    AERP_MBE_TABLE_FIELDS_,
    path,
    diagnostics,
    'MBE_INVALID_TABLE_FIELD'
  );
  if (!descriptors) return null;

  function tableString(field, required, code) {
    const normalized = aerpMbeNormalizeString_(aerpMbeDescriptorValue_(descriptors, field));
    if (normalized === null || (required && normalized === '')) {
      diagnostics.push(aerpMbeDiagnostic_(code, AERP_MBE_SEVERITY_.ERROR, path + '.' + field));
      return '';
    }
    return normalized;
  }

  const activeRaw = aerpMbeDescriptorValue_(descriptors, 'active');
  if (typeof activeRaw !== 'boolean') {
    diagnostics.push(
      aerpMbeDiagnostic_('MBE_INVALID_BOOLEAN', AERP_MBE_SEVERITY_.ERROR, path + '.active')
    );
  }
  const table = {
    id: tableString('id', true, 'MBE_MISSING_TABLE_ID'),
    code: tableString('code', true, 'MBE_MISSING_TABLE_CODE'),
    name: tableString('name', false, 'MBE_INVALID_TABLE_FIELD'),
    entity: tableString('entity', false, 'MBE_INVALID_TABLE_FIELD'),
    module: tableString('module', false, 'MBE_INVALID_TABLE_FIELD'),
    category: tableString('category', false, 'MBE_INVALID_TABLE_FIELD'),
    type: tableString('type', false, 'MBE_INVALID_TABLE_FIELD'),
    classification: 'UNCLASSIFIED',
    physicalName: tableString('physicalName', true, 'MBE_MISSING_PHYSICAL_NAME'),
    prefix: tableString('prefix', false, 'MBE_INVALID_TABLE_FIELD'),
    active: typeof activeRaw === 'boolean' ? activeRaw : false,
    columns: [],
    primaryKey: null,
    primaryKeyValid: false,
    labelColumn: null,
    foreignKeys: [],
    capabilities: {
      visibleColumnIds: [],
      editableColumnIds: [],
      requiredColumnIds: [],
      searchableColumnIds: [],
      filterableColumnIds: [],
      sortableColumnIds: [],
      indexedColumnIds: [],
      virtualColumnIds: []
    },
    contractPath: path
  };

  const columnsRaw = aerpMbeDescriptorValue_(descriptors, 'columns');
  const columnDescriptors = aerpMbeInspectArray_(
    columnsRaw,
    path + '.columns',
    diagnostics,
    'MBE_INVALID_COLUMNS'
  );
  if (!columnDescriptors) return table;

  const localNames = new Map();
  const localOrders = new Map();
  for (let index = 0; index < columnsRaw.length; index += 1) {
    const column = aerpMbeNormalizeColumn_(
      aerpMbeDescriptorValue_(columnDescriptors, String(index)),
      table,
      tableIndex,
      index,
      diagnostics
    );
    if (!column) continue;
    table.columns.push(column);

    if (globalColumnIds.has(column.id)) {
      diagnostics.push(
        aerpMbeDiagnostic_(
          'MBE_DUPLICATE_COLUMN_ID',
          AERP_MBE_SEVERITY_.ERROR,
          column.contractPath + '.ID_Columna'
        )
      );
    } else {
      globalColumnIds.set(column.id, column.contractPath);
    }
    if (localNames.has(column.name)) {
      diagnostics.push(
        aerpMbeDiagnostic_(
          'MBE_DUPLICATE_COLUMN_NAME',
          AERP_MBE_SEVERITY_.ERROR,
          column.contractPath + '.Nombre_Campo'
        )
      );
    } else {
      localNames.set(column.name, column.contractPath);
    }
    if (localOrders.has(column.order)) {
      diagnostics.push(
        aerpMbeDiagnostic_(
          'MBE_INVALID_COLUMN_ORDER',
          AERP_MBE_SEVERITY_.ERROR,
          column.contractPath + '.Orden'
        )
      );
    } else {
      localOrders.set(column.order, column.contractPath);
    }
  }

  table.columns.sort(
    (left, right) =>
      left.order - right.order ||
      aerpMbeCompareOrdinal_(left.name, right.name) ||
      aerpMbeCompareOrdinal_(left.id, right.id)
  );
  const activeColumns = table.columns.filter(column => column.active);
  if (table.active && activeColumns.length === 0) {
    diagnostics.push(
      aerpMbeDiagnostic_(
        'MBE_ACTIVE_TABLE_WITHOUT_COLUMNS',
        AERP_MBE_SEVERITY_.ERROR,
        path + '.columns'
      )
    );
  }

  if (table.active) {
    const keys = activeColumns.filter(column => column.isKey);
    if (keys.length === 0) {
      diagnostics.push(
        aerpMbeDiagnostic_('MBE_MISSING_PRIMARY_KEY', AERP_MBE_SEVERITY_.ERROR, path + '.columns')
      );
    } else if (keys.length > 1) {
      diagnostics.push(
        aerpMbeDiagnostic_('MBE_MULTIPLE_PRIMARY_KEYS', AERP_MBE_SEVERITY_.ERROR, path + '.columns')
      );
    } else {
      const key = keys[0];
      table.primaryKey = key;
      let keyValid = true;
      if (!AERP_MBE_PRIMARY_KEY_TYPES_.includes(key.dataType)) {
        keyValid = false;
        diagnostics.push(
          aerpMbeDiagnostic_(
            'MBE_INVALID_PRIMARY_KEY_TYPE',
            AERP_MBE_SEVERITY_.ERROR,
            key.contractPath + '.Tipo_Dato'
          )
        );
      }
      if (key.nullable) {
        keyValid = false;
        diagnostics.push(
          aerpMbeDiagnostic_(
            'MBE_NULLABLE_PRIMARY_KEY',
            AERP_MBE_SEVERITY_.ERROR,
            key.contractPath + '.Permite_Nulos'
          )
        );
      }
      if (!key.required) {
        keyValid = false;
        diagnostics.push(
          aerpMbeDiagnostic_(
            'MBE_OPTIONAL_PRIMARY_KEY',
            AERP_MBE_SEVERITY_.ERROR,
            key.contractPath + '.Es_Requerido'
          )
        );
      }
      if (key.virtual) {
        keyValid = false;
        diagnostics.push(
          aerpMbeDiagnostic_(
            'MBE_VIRTUAL_PRIMARY_KEY',
            AERP_MBE_SEVERITY_.ERROR,
            key.contractPath + '.Es_Virtual'
          )
        );
      }
      if (key.isRef) {
        keyValid = false;
        diagnostics.push(
          aerpMbeDiagnostic_(
            'MBE_PRIMARY_KEY_FOREIGN_KEY_CONFLICT',
            AERP_MBE_SEVERITY_.ERROR,
            key.contractPath + '.Es_Ref'
          )
        );
      }
      table.primaryKeyValid = keyValid;
    }

    const labels = activeColumns.filter(column => column.isLabel);
    if (labels.length > 1) {
      diagnostics.push(
        aerpMbeDiagnostic_('MBE_MULTIPLE_LABELS', AERP_MBE_SEVERITY_.ERROR, path + '.columns')
      );
    } else if (labels.length === 1) {
      table.labelColumn = labels[0];
      if (labels[0].dataType === 'EnumList') {
        diagnostics.push(
          aerpMbeDiagnostic_(
            'MBE_INVALID_LABEL_TYPE',
            AERP_MBE_SEVERITY_.ERROR,
            labels[0].contractPath + '.Tipo_Dato'
          )
        );
      }
    }
  }

  const capabilityMap = [
    ['visible', 'visibleColumnIds'],
    ['editable', 'editableColumnIds'],
    ['required', 'requiredColumnIds'],
    ['searchable', 'searchableColumnIds'],
    ['filterable', 'filterableColumnIds'],
    ['sortable', 'sortableColumnIds'],
    ['indexed', 'indexedColumnIds'],
    ['virtual', 'virtualColumnIds']
  ];
  activeColumns.forEach(column => {
    capabilityMap.forEach(([property, collection]) => {
      if (column[property]) table.capabilities[collection].push(column.id);
    });
  });
  return table;
}

function aerpMbeResolveForeignKeys_(tables, physicalNameIndex, diagnostics) {
  tables.forEach(table => {
    if (!table.active) return;
    table.columns
      .filter(column => column.active && column.isRef && !column.isKey)
      .forEach(column => {
        const path = column.contractPath + '.Tabla_Referencia';
        const targets = physicalNameIndex.get(column.referenceTable) || [];
        if (!column.referenceTable || targets.length !== 1) {
          diagnostics.push(
            aerpMbeDiagnostic_('MBE_UNRESOLVABLE_FOREIGN_KEY', AERP_MBE_SEVERITY_.ERROR, path)
          );
          return;
        }
        const target = targets[0];
        if (!target.active) {
          diagnostics.push(
            aerpMbeDiagnostic_('MBE_INACTIVE_FOREIGN_KEY_TARGET', AERP_MBE_SEVERITY_.ERROR, path)
          );
          return;
        }
        if (!target.primaryKey || !target.primaryKeyValid) {
          diagnostics.push(
            aerpMbeDiagnostic_('MBE_FOREIGN_KEY_TARGET_WITHOUT_PK', AERP_MBE_SEVERITY_.ERROR, path)
          );
          return;
        }
        const storageType =
          column.dataType === 'Ref' ? target.primaryKey.dataType : column.dataType;
        if (storageType !== target.primaryKey.dataType) {
          diagnostics.push(
            aerpMbeDiagnostic_(
              'MBE_INCOMPATIBLE_FOREIGN_KEY_TYPE',
              AERP_MBE_SEVERITY_.ERROR,
              column.contractPath + '.Tipo_Dato'
            )
          );
          return;
        }
        table.foreignKeys.push({
          sourceColumnId: column.id,
          sourceColumnName: column.name,
          storageType,
          targetTableId: target.id,
          targetPhysicalName: target.physicalName,
          targetPrimaryKeyColumnId: target.primaryKey.id,
          targetPrimaryKeyColumnName: target.primaryKey.name
        });
      });
    table.foreignKeys.sort(
      (left, right) =>
        aerpMbeCompareOrdinal_(left.sourceColumnName, right.sourceColumnName) ||
        aerpMbeCompareOrdinal_(left.targetPhysicalName, right.targetPhysicalName)
    );
  });
}

function aerpMbePublicColumn_(column) {
  const result = {};
  Object.keys(column).forEach(key => {
    if (key !== 'contractPath') result[key] = column[key];
  });
  return result;
}

function aerpMbePublicTable_(table) {
  return {
    id: table.id,
    code: table.code,
    name: table.name,
    entity: table.entity,
    module: table.module,
    category: table.category,
    type: table.type,
    classification: table.classification,
    physicalName: table.physicalName,
    prefix: table.prefix,
    active: table.active,
    primaryKey: table.primaryKey ? aerpMbePublicColumn_(table.primaryKey) : null,
    labelColumn: table.labelColumn ? aerpMbePublicColumn_(table.labelColumn) : null,
    foreignKeys: table.foreignKeys.map(foreignKey => ({ ...foreignKey })),
    columns: table.columns.map(aerpMbePublicColumn_),
    capabilities: {
      visibleColumnIds: [...table.capabilities.visibleColumnIds],
      editableColumnIds: [...table.capabilities.editableColumnIds],
      requiredColumnIds: [...table.capabilities.requiredColumnIds],
      searchableColumnIds: [...table.capabilities.searchableColumnIds],
      filterableColumnIds: [...table.capabilities.filterableColumnIds],
      sortableColumnIds: [...table.capabilities.sortableColumnIds],
      indexedColumnIds: [...table.capabilities.indexedColumnIds],
      virtualColumnIds: [...table.capabilities.virtualColumnIds]
    }
  };
}

function aerpMbeSortDiagnostics_(diagnostics) {
  const severityOrder = { ERROR: 0, WARNING: 1 };
  diagnostics.sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      aerpMbeCompareOrdinal_(left.code, right.code) ||
      aerpMbeCompareOrdinal_(left.path, right.path) ||
      aerpMbeCompareOrdinal_(left.message, right.message)
  );
}

function aerpMbeEmptySummary_() {
  return {
    tables: 0,
    activeTables: 0,
    inactiveTables: 0,
    columns: 0,
    activeColumns: 0,
    primaryKeys: 0,
    foreignKeys: 0,
    labels: 0,
    errors: 0,
    warnings: 0
  };
}

function aerpMbeBuildResult_(schema) {
  const diagnostics = [];
  const summary = aerpMbeEmptySummary_();
  const rootDescriptors = aerpMbeInspectObject_(
    schema,
    AERP_MBE_ROOT_FIELDS_,
    '$',
    diagnostics,
    'MBE_INVALID_INPUT'
  );
  if (!rootDescriptors) {
    aerpMbeSortDiagnostics_(diagnostics);
    summary.errors = diagnostics.length;
    return {
      ok: false,
      contractVersion: AERP_METADATA_MODEL_CONTRACT_VERSION,
      model: null,
      diagnostics,
      summary
    };
  }

  const version = aerpMbeNormalizeString_(aerpMbeDescriptorValue_(rootDescriptors, 'version'));
  if (!version) {
    diagnostics.push(
      aerpMbeDiagnostic_('MBE_INVALID_VERSION', AERP_MBE_SEVERITY_.ERROR, '$.version')
    );
  }
  const generatedAt = aerpMbeNormalizeDate_(
    aerpMbeDescriptorValue_(rootDescriptors, 'generatedAt')
  );
  if (!generatedAt) {
    diagnostics.push(
      aerpMbeDiagnostic_('MBE_INVALID_GENERATED_AT', AERP_MBE_SEVERITY_.ERROR, '$.generatedAt')
    );
  }
  const inputSummary = aerpMbeValidateSummary_(
    aerpMbeDescriptorValue_(rootDescriptors, 'summary'),
    diagnostics
  );
  const tablesRaw = aerpMbeDescriptorValue_(rootDescriptors, 'tables');
  const tableDescriptors = aerpMbeInspectArray_(
    tablesRaw,
    '$.tables',
    diagnostics,
    'MBE_INVALID_TABLES'
  );

  const tables = [];
  const globalColumnIds = new Map();
  if (tableDescriptors) {
    for (let index = 0; index < tablesRaw.length; index += 1) {
      const table = aerpMbeNormalizeTable_(
        aerpMbeDescriptorValue_(tableDescriptors, String(index)),
        index,
        diagnostics,
        globalColumnIds
      );
      if (table) tables.push(table);
    }
  }

  const identityMaps = {
    id: new Map(),
    code: new Map(),
    physicalName: new Map()
  };
  const duplicateCodes = {
    id: 'MBE_DUPLICATE_TABLE_ID',
    code: 'MBE_DUPLICATE_TABLE_CODE',
    physicalName: 'MBE_DUPLICATE_PHYSICAL_NAME'
  };
  tables.forEach(table => {
    Object.keys(identityMaps).forEach(field => {
      const map = identityMaps[field];
      const value = table[field];
      const list = map.get(value) || [];
      list.push(table);
      map.set(value, list);
      if (value && list.length > 1) {
        diagnostics.push(
          aerpMbeDiagnostic_(
            duplicateCodes[field],
            AERP_MBE_SEVERITY_.ERROR,
            table.contractPath + '.' + field
          )
        );
      }
    });
  });

  aerpMbeResolveForeignKeys_(tables, identityMaps.physicalName, diagnostics);
  tables.sort(
    (left, right) =>
      aerpMbeCompareOrdinal_(left.physicalName, right.physicalName) ||
      aerpMbeCompareOrdinal_(left.id, right.id)
  );

  summary.tables = tables.length;
  summary.activeTables = tables.filter(table => table.active).length;
  summary.inactiveTables = tables.length - summary.activeTables;
  summary.columns = tables.reduce((total, table) => total + table.columns.length, 0);
  summary.activeColumns = tables.reduce(
    (total, table) => total + table.columns.filter(column => column.active).length,
    0
  );
  summary.primaryKeys = tables.filter(table => table.primaryKey !== null).length;
  summary.foreignKeys = tables.reduce((total, table) => total + table.foreignKeys.length, 0);
  summary.labels = tables.filter(table => table.labelColumn !== null).length;

  if (
    inputSummary &&
    (inputSummary.tables !== summary.tables || inputSummary.columns !== summary.columns)
  ) {
    diagnostics.push(
      aerpMbeDiagnostic_('MBE_SUMMARY_MISMATCH', AERP_MBE_SEVERITY_.WARNING, '$.summary')
    );
  }

  aerpMbeSortDiagnostics_(diagnostics);
  summary.errors = diagnostics.filter(item => item.severity === AERP_MBE_SEVERITY_.ERROR).length;
  summary.warnings = diagnostics.filter(
    item => item.severity === AERP_MBE_SEVERITY_.WARNING
  ).length;
  const ok = summary.errors === 0;
  return {
    ok,
    contractVersion: AERP_METADATA_MODEL_CONTRACT_VERSION,
    model: ok
      ? {
          contractVersion: AERP_METADATA_MODEL_CONTRACT_VERSION,
          sourceSchemaVersion: version,
          tables: tables.map(aerpMbePublicTable_)
        }
      : null,
    diagnostics,
    summary
  };
}

function aerpBuildMetadataModelFromSchema(schema) {
  try {
    return aerpMbeBuildResult_(schema);
  } catch (_error) {
    const diagnostic = aerpMbeDiagnostic_('MBE_INTERNAL_ERROR', AERP_MBE_SEVERITY_.ERROR, '$');
    const summary = aerpMbeEmptySummary_();
    summary.errors = 1;
    return {
      ok: false,
      contractVersion: AERP_METADATA_MODEL_CONTRACT_VERSION,
      model: null,
      diagnostics: [diagnostic],
      summary
    };
  }
}

function testMetadataBuilderEnterpriseCompatibilityAudit() {
  let audit;
  try {
    const result = aerpBuildMetadataModelFromSchema(aerpBuildFrameworkSchema());
    audit = {
      ok: result.ok,
      contractVersion: result.contractVersion,
      summary: { ...result.summary },
      diagnostics: result.diagnostics.map(diagnostic => ({
        code: diagnostic.code,
        severity: diagnostic.severity,
        path: diagnostic.path
      }))
    };
  } catch (_error) {
    const summary = aerpMbeEmptySummary_();
    summary.errors = 1;
    audit = {
      ok: false,
      contractVersion: AERP_METADATA_MODEL_CONTRACT_VERSION,
      summary,
      diagnostics: [
        {
          code: 'MBE_INTERNAL_ERROR',
          severity: AERP_MBE_SEVERITY_.ERROR,
          path: '$'
        }
      ]
    };
  }
  try {
    if (typeof Logger !== 'undefined' && Logger && typeof Logger.log === 'function') {
      Logger.log(JSON.stringify(audit));
    }
  } catch (_error) {
    // Logging is best effort and never changes the sanitized audit result.
  }
  return audit;
}

globalThis.aerpBuildMetadataModelFromSchema = aerpBuildMetadataModelFromSchema;
globalThis.testMetadataBuilderEnterpriseCompatibilityAudit =
  testMetadataBuilderEnterpriseCompatibilityAudit;
globalThis.AERP_METADATA_MODEL_CONTRACT_VERSION = AERP_METADATA_MODEL_CONTRACT_VERSION;
