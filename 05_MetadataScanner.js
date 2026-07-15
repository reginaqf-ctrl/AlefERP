/**
 * ALEF ERP Metadata Engine 3.0
 * 05_MetadataScanner.gs
 */

function aerpGetRegisteredTables() {
  const data = aerpGetTable(AERP_SHEETS.CORE_TABLAS);
  const requiredHeaders = ['Codigo', 'Tabla_Fisica', 'Activo', 'Modulo'];

  requiredHeaders.forEach(header => {
    if (!data.headers.includes(header)) {
      throw new Error('CORE_TABLAS debe tener la columna obligatoria: ' + header);
    }
  });

  return data.rows
    .filter(row => row[0])
    .map(row => aerpRowToObject(data.headers, row))
    .filter(table => aerpToBoolDefault(table.Activo, true));
}

function aerpGetPhysicalTableName(tableRecord) {
  if (!tableRecord.Tabla_Fisica) {
    throw new Error('La tabla ' + tableRecord.Codigo + ' no tiene Tabla_Fisica');
  }

  return String(tableRecord.Tabla_Fisica).trim();
}

function aerpScanTable(tableName) {
  const ss = aerpGetSpreadsheet();
  const sheet = ss.getSheetByName(tableName);

  if (!sheet) {
    throw new Error('No existe la hoja física: ' + tableName);
  }

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .filter(h => String(h).trim() !== '');

  return headers.map((columnName, index) => {
    return aerpBuildColumnMetadata(tableName, columnName, index + 1);
  });
}

function aerpScanModule(moduleCode) {
  const tables = aerpGetRegisteredTables();

  const selectedTables = tables.filter(table => {
    return String(table.Modulo || '').toUpperCase() === String(moduleCode).toUpperCase();
  });

  let result = [];

  selectedTables.forEach(table => {
    const physicalName = aerpGetPhysicalTableName(table);
    const metadata = aerpScanTable(physicalName);
    result = result.concat(metadata);
  });

  return result;
}

function aerpScanAll() {
  const tables = aerpGetRegisteredTables();
  let result = [];

  tables.forEach(table => {
    const physicalName = aerpGetPhysicalTableName(table);

    try {
      const metadata = aerpScanTable(physicalName);
      result = result.concat(metadata);
    } catch (error) {
      Logger.log('ERROR en tabla ' + physicalName + ': ' + error.message);
    }
  });

  return result;
}

function testScanCAT_ESTADOS() {
  const metadata = aerpScanTable('CAT_ESTADOS');
  Logger.log('Columnas generadas: ' + metadata.length);
}
