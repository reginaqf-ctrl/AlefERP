function aerpGetSpreadsheet() {
  return SpreadsheetApp.openById(AERP_SPREADSHEET_ID);
}

function aerpGetSheet(name) {
  const ss = aerpGetSpreadsheet();
  const sheet = ss.getSheetByName(name);

  if (!sheet) {
    throw new Error('No existe la hoja: ' + name);
  }

  return sheet;
}

function aerpGetTable(name) {
  const sheet = aerpGetSheet(name);
  const values = sheet.getDataRange().getValues();

  if (values.length === 0) {
    return { sheet, headers: [], rows: [] };
  }

  return {
    sheet,
    headers: values[0].map(h => String(h).trim()),
    rows: values.slice(1)
  };
}

function aerpRowToObject(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = row[index];
  });
  return obj;
}

function aerpToBool(value) {
  return String(value).toUpperCase() === 'TRUE';
}

function aerpToBoolDefault(value, defaultValue) {
  if (value === '' || value === null || value === undefined) return defaultValue;
  return aerpToBool(value);
}

function aerpHumanize(name) {
  return String(name || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, function(c) {
      return c.toUpperCase();
    });
}

function aerpNormalizeTipoDato(value) {
  const v = String(value || '').trim();
  const map = {
    'Yes/No': 'YesNo',
    'Long Text': 'LongText'
  };
  return map[v] || v || AERP_DEFAULTS.TIPO_DATO;
}

function aerpNormalizeTipoControl(value) {
  const v = String(value || '').trim();
  const map = {
    'TextArea': 'Textarea',
    'textarea': 'Textarea',
    'DateTime': 'DateTimePicker',
    'Date': 'DatePicker'
  };
  return map[v] || v || AERP_DEFAULTS.TIPO_CONTROL;
}