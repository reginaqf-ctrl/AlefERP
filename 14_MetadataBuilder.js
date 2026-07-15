/**
 * ALEF ERP Framework
 * 14_MetadataBuilder.gs
 *
 * AERP-014 - Metadata Builder
 * Convierte FrameworkSchema en un modelo enriquecido
 * listo para AppSheet, SQL, API y documentación.
 */

function aerpBuildMetadataModel() {
  const start = new Date();
  const schema = aerpBuildFrameworkSchema();
  const validation = aerpValidateFrameworkSchema(schema);

  const model = {
    version: AERP_VERSION,
    generatedAt: new Date(),
    tables: [],
    summary: {
      tables: 0,
      columns: 0,
      primaryKeys: 0,
      foreignKeys: 0,
      labels: 0,
      warnings: [],
      errors: [],
      durationMs: 0
    }
  };

  if (!validation.ok) {
    model.summary.errors = validation.errors;
    return model;
  }

  schema.tables.forEach(function(table) {
    const enrichedTable = aerpEnrichTable_(table);
    model.tables.push(enrichedTable);
  });

  model.summary.tables = model.tables.length;
  model.summary.columns = model.tables.reduce(function(total, table) {
    return total + table.columns.length;
  }, 0);

  model.summary.primaryKeys = model.tables.reduce(function(total, table) {
    return total + (table.primaryKey ? 1 : 0);
  }, 0);

  model.summary.foreignKeys = model.tables.reduce(function(total, table) {
    return total + table.foreignKeys.length;
  }, 0);

  model.summary.labels = model.tables.reduce(function(total, table) {
    return total + (table.labelColumn ? 1 : 0);
  }, 0);

  model.tables.forEach(function(table) {
    if (!table.primaryKey) {
      model.summary.warnings.push('Tabla sin Primary Key: ' + table.physicalName);
    }

    if (!table.labelColumn) {
      model.summary.warnings.push('Tabla sin Label: ' + table.physicalName);
    }
  });

  model.summary.durationMs = new Date() - start;

  return model;
}

function aerpEnrichTable_(table) {
  const columns = table.columns || [];

  const primaryKey = aerpResolvePrimaryKey_(columns);
  const labelColumn = aerpResolveLabelColumn_(columns);

  const foreignKeys = columns.filter(function(col) {
    return aerpBoolFromMetadata_(col.Es_Ref) === true;
  });

  const visibleColumns = columns.filter(function(col) {
    return aerpBoolFromMetadata_(col.Visible) === true;
  });

  const editableColumns = columns.filter(function(col) {
    return aerpBoolFromMetadata_(col.Editable) === true;
  });

  const requiredColumns = columns.filter(function(col) {
    return aerpBoolFromMetadata_(col.Es_Requerido) === true;
  });

  const searchableColumns = columns.filter(function(col) {
    return aerpBoolFromMetadata_(col.Es_Buscable) === true;
  });

  const filterableColumns = columns.filter(function(col) {
    return aerpBoolFromMetadata_(col.Es_Filtrable) === true;
  });

  const sortableColumns = columns.filter(function(col) {
    return aerpBoolFromMetadata_(col.Es_Ordenable) === true;
  });

  const indexedColumns = columns.filter(function(col) {
    return aerpBoolFromMetadata_(col.Es_Indexado) === true;
  });

  const virtualColumns = columns.filter(function(col) {
    return aerpBoolFromMetadata_(col.Es_Virtual) === true;
  });

  const auditColumns = columns.filter(function(col) {
    return aerpIsAuditColumn_(col.Nombre_Campo);
  });

  const systemColumns = columns.filter(function(col) {
    return aerpIsSystemColumn_(col.Nombre_Campo);
  });

  const businessColumns = columns.filter(function(col) {
    return !aerpIsAuditColumn_(col.Nombre_Campo) &&
           !aerpIsSystemColumn_(col.Nombre_Campo);
  });

  return {
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

    primaryKey: primaryKey,
    labelColumn: labelColumn,
    foreignKeys: foreignKeys,

    columns: columns,
    visibleColumns: visibleColumns,
    editableColumns: editableColumns,
    requiredColumns: requiredColumns,
    searchableColumns: searchableColumns,
    filterableColumns: filterableColumns,
    sortableColumns: sortableColumns,
    indexedColumns: indexedColumns,
    virtualColumns: virtualColumns,
    auditColumns: auditColumns,
    systemColumns: systemColumns,
    businessColumns: businessColumns,

    appSheet: aerpPrepareAppSheetMetadata_(table, primaryKey, labelColumn, foreignKeys),
    sql: aerpPrepareSQLMetadata_(table, primaryKey, foreignKeys),
    api: aerpPrepareAPIMetadata_(table, primaryKey, labelColumn)
  };
}

function aerpResolvePrimaryKey_(columns) {
  const keys = columns.filter(function(col) {
    return aerpBoolFromMetadata_(col.Es_Key) === true;
  });

  if (keys.length > 0) return keys[0];

  const firstId = columns.find(function(col) {
    return String(col.Nombre_Campo || '').startsWith('ID_');
  });

  return firstId || null;
}

function aerpResolveLabelColumn_(columns) {
  const labels = columns.filter(function(col) {
    return aerpBoolFromMetadata_(col.Es_Label) === true;
  });

  if (labels.length > 0) return labels[0];

  const nombre = columns.find(function(col) {
    return String(col.Nombre_Campo || '') === 'Nombre';
  });

  if (nombre) return nombre;

  const codigo = columns.find(function(col) {
    return String(col.Nombre_Campo || '') === 'Codigo';
  });

  return codigo || null;
}

function aerpBoolFromMetadata_(value) {
  return value === true || String(value).toUpperCase() === 'TRUE';
}

function aerpIsAuditColumn_(name) {
  const n = String(name || '');

  return [
    'Fecha_Creacion',
    'Fecha_Actualizacion',
    'Creado_Por',
    'Modificado_Por'
  ].includes(n);
}

function aerpIsSystemColumn_(name) {
  const n = String(name || '');

  return [
    'Activo',
    'Estado',
    'Version',
    'Orden',
    'Observaciones'
  ].includes(n);
}

function aerpPrepareAppSheetMetadata_(table, primaryKey, labelColumn, foreignKeys) {
  return {
    tableName: table.physicalName,
    keyColumn: primaryKey ? primaryKey.Nombre_Campo : '',
    labelColumn: labelColumn ? labelColumn.Nombre_Campo : '',
    refs: foreignKeys.map(function(col) {
      return {
        column: col.Nombre_Campo,
        refTable: col.Tabla_Referencia || ''
      };
    })
  };
}

function aerpPrepareSQLMetadata_(table, primaryKey, foreignKeys) {
  return {
    tableName: table.physicalName,
    primaryKey: primaryKey ? primaryKey.Nombre_Campo : '',
    foreignKeys: foreignKeys.map(function(col) {
      return {
        column: col.Nombre_Campo,
        referenceTable: col.Tabla_Referencia || ''
      };
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
  const model = aerpBuildMetadataModel();
  return JSON.stringify(model, null, 2);
}

function testMetadataBuilder() {
  const model = aerpBuildMetadataModel();

  Logger.log(JSON.stringify({
    tables: model.summary.tables,
    columns: model.summary.columns,
    primaryKeys: model.summary.primaryKeys,
    foreignKeys: model.summary.foreignKeys,
    labels: model.summary.labels,
    errors: model.summary.errors,
    warnings: model.summary.warnings,
    durationMs: model.summary.durationMs
  }, null, 2));

  if (model.summary.errors.length > 0) {
    throw new Error('Metadata Builder generó errores. Revisa el log.');
  }

  Logger.log('Metadata Builder OK');
}

