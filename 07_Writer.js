/**
 * ALEF ERP Metadata Engine 3.0
 * 07_Writer.gs
 */

function aerpWriteCoreColumnas(metadataList, mode) {
  mode = mode || 'incremental';

  const validation = aerpValidateMetadata(metadataList);
  if (!validation.ok) {
    throw new Error('Metadata inválida: ' + JSON.stringify(validation.errors));
  }

  const data = aerpGetTable(AERP_SHEETS.CORE_COLUMNAS);
  const sheet = data.sheet;
  const headers = data.headers;

  if (mode === 'dry-run') {
    return {
      mode,
      inserted: 0,
      updated: 0,
      skipped: 0,
      total: metadataList.length,
      warnings: validation.warnings
    };
  }

  if (mode === 'rebuild') {
    aerpClearCoreColumnas(sheet, headers);
    return aerpInsertAllMetadata(sheet, headers, metadataList, validation);
  }

  if (mode === 'incremental') {
    return aerpWriteIncremental(sheet, headers, data.rows, metadataList, validation);
  }

  if (mode === 'update') {
    return aerpWriteUpdate(sheet, headers, data.rows, metadataList, validation);
  }

  throw new Error('Modo no soportado: ' + mode);
}

function aerpClearCoreColumnas(sheet, headers) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }
}

function aerpInsertAllMetadata(sheet, headers, metadataList, validation) {
  const rows = metadataList.map(item => aerpMetadataToRow(item, headers));

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  return {
    mode: 'rebuild',
    inserted: rows.length,
    updated: 0,
    skipped: 0,
    total: metadataList.length,
    warnings: validation.warnings
  };
}

function aerpWriteIncremental(sheet, headers, existingRows, metadataList, validation) {
  const existingIndex = aerpBuildExistingColumnIndex(existingRows, headers);
  const rowsToInsert = [];
  let skipped = 0;

  metadataList.forEach(item => {
    const key = item.Tabla + '|' + item.Nombre_Campo;

    if (existingIndex[key]) {
      skipped++;
      return;
    }

    rowsToInsert.push(aerpMetadataToRow(item, headers));
  });

  if (rowsToInsert.length > 0) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, rowsToInsert.length, rowsToInsert[0].length)
      .setValues(rowsToInsert);
  }

  return {
    mode: 'incremental',
    inserted: rowsToInsert.length,
    updated: 0,
    skipped,
    total: metadataList.length,
    warnings: validation.warnings
  };
}

function aerpWriteUpdate(sheet, headers, existingRows, metadataList, validation) {
  const existingIndex = aerpBuildExistingRowIndex(existingRows, headers);
  const rowsToInsert = [];
  let updated = 0;
  let skipped = 0;

  metadataList.forEach(item => {
    const key = item.Tabla + '|' + item.Nombre_Campo;
    const newRow = aerpMetadataToRow(item, headers);

    if (existingIndex[key]) {
      const rowNumber = existingIndex[key];
      sheet.getRange(rowNumber, 1, 1, newRow.length).setValues([newRow]);
      updated++;
    } else {
      rowsToInsert.push(newRow);
    }
  });

  if (rowsToInsert.length > 0) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, rowsToInsert.length, rowsToInsert[0].length)
      .setValues(rowsToInsert);
  }

  return {
    mode: 'update',
    inserted: rowsToInsert.length,
    updated,
    skipped,
    total: metadataList.length,
    warnings: validation.warnings
  };
}

function aerpBuildExistingColumnIndex(rows, headers) {
  const index = {};
  const idxTabla = headers.indexOf('Tabla');
  const idxCampo = headers.indexOf('Nombre_Campo');

  rows.forEach(row => {
    const key =
      String(row[idxTabla] || '').trim() +
      '|' +
      String(row[idxCampo] || '').trim();

    if (key !== '|') index[key] = true;
  });

  return index;
}

function aerpBuildExistingRowIndex(rows, headers) {
  const index = {};
  const idxTabla = headers.indexOf('Tabla');
  const idxCampo = headers.indexOf('Nombre_Campo');

  rows.forEach((row, i) => {
    const key =
      String(row[idxTabla] || '').trim() +
      '|' +
      String(row[idxCampo] || '').trim();

    if (key !== '|') index[key] = i + 2;
  });

  return index;
}

function aerpMetadataToRow(metadata, headers) {
  return headers.map(header => {
    const key = String(header).trim();
    return Object.prototype.hasOwnProperty.call(metadata, key)
      ? metadata[key]
      : '';
  });
}
