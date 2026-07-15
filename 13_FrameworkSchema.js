/**
 * ALEF ERP Framework
 * 13_FrameworkSchema.gs
 *
 * AERP-013 - Framework Schema
 * Construye el modelo interno del ERP en memoria.
 */

function aerpBuildFrameworkSchema() {
  const start = new Date();

  const tables = aerpGetRegisteredTables();
  const columnasData = aerpGetTable(AERP_SHEETS.CORE_COLUMNAS);

  const schema = {
    version: AERP_VERSION,
    generatedAt: new Date(),
    tables: [],
    summary: {
      tables: 0,
      columns: 0,
      relations: 0,
      views: 0,
      warnings: [],
      errors: [],
      durationMs: 0
    }
  };

  tables.forEach(table => {
    const tableName = table.Tabla_Fisica;
    const tableSchema = {
      id: table.ID_Tabla || '',
      code: table.Codigo || '',
      name: table.Nombre || '',
      entity: table.Entidad || '',
      module: table.Modulo || '',
      category: table.Categoria || '',
      type: table.Tipo_Tabla || '',
      physicalName: tableName,
      prefix: table.Prefijo || '',
      active: aerpToBoolDefault(table.Activo, true),
      columns: []
    };

    const columns = aerpGetColumnsForTable_(
      columnasData.headers,
      columnasData.rows,
      tableName
    );

    tableSchema.columns = columns;

    if (columns.length === 0) {
      schema.summary.warnings.push(
        'La tabla ' + tableName + ' no tiene columnas en CORE_COLUMNAS.'
      );
    }

    schema.tables.push(tableSchema);
  });

  schema.summary.tables = schema.tables.length;
  schema.summary.columns = schema.tables.reduce(function(total, table) {
    return total + table.columns.length;
  }, 0);
  schema.summary.durationMs = new Date() - start;

  return schema;
}

function aerpGetColumnsForTable_(headers, rows, tableName) {
  const idxTabla = headers.indexOf('Tabla');

  if (idxTabla === -1) {
    throw new Error('CORE_COLUMNAS no tiene la columna Tabla');
  }

  return rows
    .filter(row => String(row[idxTabla] || '').trim() === String(tableName).trim())
    .map(row => aerpRowToObject(headers, row))
    .sort(function(a, b) {
      return Number(a.Orden || 999) - Number(b.Orden || 999);
    });
}

function aerpValidateFrameworkSchema(schema) {
  const errors = [];
  const warnings = [];

  if (!schema) {
    errors.push('Schema vacío.');
  }

  if (!schema.tables || schema.tables.length === 0) {
    errors.push('El schema no contiene tablas.');
  }

  schema.tables.forEach(function(table) {
    if (!table.physicalName) {
      errors.push('Tabla sin physicalName: ' + table.code);
    }

    if (!table.columns || table.columns.length === 0) {
      warnings.push('Tabla sin columnas: ' + table.physicalName);
    }

    const keys = table.columns.filter(function(col) {
      return col.Es_Key === true || String(col.Es_Key).toUpperCase() === 'TRUE';
    });

    if (keys.length === 0) {
      warnings.push('Tabla sin Key detectada: ' + table.physicalName);
    }

    if (keys.length > 1) {
      warnings.push('Tabla con más de una Key: ' + table.physicalName);
    }
  });

  return {
    ok: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

function aerpFrameworkSchemaToJSON() {
  const schema = aerpBuildFrameworkSchema();
  return JSON.stringify(schema, null, 2);
}

function testFrameworkSchema() {
  const schema = aerpBuildFrameworkSchema();
  const validation = aerpValidateFrameworkSchema(schema);

  Logger.log(JSON.stringify({
    ok: validation.ok,
    tables: schema.summary.tables,
    columns: schema.summary.columns,
    errors: validation.errors,
    warnings: validation.warnings,
    durationMs: schema.summary.durationMs
  }, null, 2));

  if (!validation.ok) {
    throw new Error('Framework Schema inválido. Revisa el log.');
  }

  Logger.log('Framework Schema OK');
}

