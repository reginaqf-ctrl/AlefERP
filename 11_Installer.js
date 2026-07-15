/**
 * ALEF ERP Metadata Engine 3.0
 * 11_Installer.gs
 *
 * Validador de instalación.
 * No modifica hojas todavía.
 */

function aerpInstallCheck() {
  const result = {
    ok: true,
    version: AERP_VERSION,
    checkedAt: new Date(),
    errors: [],
    warnings: [],
    sheets: []
  };

  aerpCheckRequiredSheet_(result, AERP_SHEETS.CORE_TABLAS, [
    'ID_Tabla',
    'Codigo',
    'Nombre',
    'Entidad',
    'Modulo',
    'Categoria',
    'Tipo_Tabla',
    'Origen_Datos',
    'Tabla_Fisica',
    'Activo'
  ]);

  aerpCheckRequiredSheet_(result, AERP_SHEETS.CORE_COLUMNAS, [
    'ID_Columna',
    'Tabla',
    'Nombre_Campo',
    'Nombre_Mostrar',
    'Tipo_Dato',
    'Es_Key',
    'Es_Label',
    'Es_Requerido',
    'Permite_Nulos',
    'Valor_Inicial',
    'Formula_App',
    'Tabla_Referencia',
    'Orden',
    'Activo',
    'Estado',
    'Visible',
    'Editable',
    'Es_Ref',
    'Es_Virtual',
    'Tipo_Control',
    
  ]);

  aerpCheckRequiredSheet_(result, AERP_SHEETS.GEN_REGLAS, [
    'ID_Regla',
    'Version',
    'Prioridad',
    'Nivel',
    'Activo',
    'Nombre_Regla',
    'Patron',
    'Tipo_Patron',
    'Categoria',
    'Categoria_App',
    'Motor',
    'Aplica_A',
    'Tipo_Dato',
    'Tipo_Control',
    'Requerido',
    'Permite_Nulos',
    'Es_Key',
    'Es_Label',
    'Es_Ref',
    'Visible',
    'Editable',
    'ID_TablaReferencia',
    'Formula',
    'Descripcion'
  ]);

  aerpCheckRequiredSheet_(result, AERP_SHEETS.GEN_ACCIONES, [
    'ID_Accion',
    'Version',
    'Activo',
    'ID_Regla',
    'Orden',
    'Nombre_Accion',
    'Tipo_Accion',
    'Campo_Destino',
    'Valor',
    'Condicion',
    'Descripcion'
  ]);

  aerpCheckRequiredSheet_(result, AERP_SHEETS.CAT_ESTADOS, [
    'ID_Estado',
    'Codigo',
    'Nombre',
    'Descripcion',
    'Activo'
  ]);

  result.ok = result.errors.length === 0;

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function aerpCheckRequiredSheet_(result, sheetName, requiredHeaders) {
  let sheet;

  try {
    sheet = aerpGetSheet(sheetName);
  } catch (error) {
    result.errors.push('Falta hoja obligatoria: ' + sheetName);
    result.sheets.push({
      sheet: sheetName,
      ok: false,
      error: 'No existe'
    });
    return;
  }

  const values = sheet.getDataRange().getValues();
  const headers = values.length > 0
    ? values[0].map(h => String(h).trim())
    : [];

  const missing = requiredHeaders.filter(header => !headers.includes(header));

  if (missing.length > 0) {
    result.errors.push(
      'La hoja ' + sheetName + ' no tiene columnas obligatorias: ' + missing.join(', ')
    );
  }

  result.sheets.push({
    sheet: sheetName,
    ok: missing.length === 0,
    missingHeaders: missing,
    totalRows: Math.max(values.length - 1, 0),
    totalColumns: headers.length
  });
}

function testInstaller() {
  const result = aerpInstallCheck();

  if (!result.ok) {
    throw new Error('Instalación inválida. Revisa el log.');
  }

  Logger.log('Instalación Alef ERP OK');
}
function testInstallerErrores() {
  const result = aerpInstallCheck();

  Logger.log('ERRORES:');
  Logger.log(JSON.stringify(result.errors, null, 2));

  Logger.log('WARNINGS:');
  Logger.log(JSON.stringify(result.warnings, null, 2));
}

