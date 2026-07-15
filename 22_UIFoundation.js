/**
 * ==========================================================
 * ALEF ERP
 * Launch Edition 1.0
 *
 * Módulo: UI Foundation
 * Autor: Alef Engineering
 * Arquitectura: Metadata Engine 3.0
 * Estado: Production Ready
 * ==========================================================
 */

/**
 * Configuración visual y verbal centralizada.
 */
const AERP_UI = Object.freeze({
  APP_NAME: 'Alef ERP',
  EDITION: 'Launch Edition 1.0',

  ICONS: Object.freeze({
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    BUILD: '🚀',
    PACKAGE: '📦',
    SETTINGS: '⚙️',
    TABLE: '📋',
    FORM: '📝',
    VIEW: '👁️'
  }),

  COLORS: Object.freeze({
    PRIMARY: '#12372A',
    SECONDARY: '#436850',
    ACCENT: '#ADBC9F',
    BACKGROUND: '#FBFADA',
    SUCCESS: '#2E7D32',
    WARNING: '#ED6C02',
    ERROR: '#D32F2F',
    INFO: '#0288D1',
    TEXT_LIGHT: '#FFFFFF',
    TEXT_DARK: '#1F2937'
  }),

  TOAST_SECONDS: 5
});

/**
 * Mensajes oficiales del producto.
 */
const AERP_MESSAGES = Object.freeze({
  BUILD_START: 'Alef ERP está generando la aplicación.',
  BUILD_SUCCESS: 'Alef ERP se generó correctamente.',
  BUILD_ERROR: 'No pudimos completar la generación del ERP.',
  INSTALL_SUCCESS: 'La instalación de Alef ERP es correcta.',
  INSTALL_ERROR: 'La instalación presenta errores.',
  DRY_RUN_SUCCESS: 'La simulación finalizó correctamente.',
  PACKAGE_SUCCESS: 'El paquete AppSheet se generó correctamente.',
  VALIDATION_SUCCESS: 'La validación finalizó sin errores.',
  GENERIC_ERROR: 'Se produjo un error inesperado.'
});

/**
 * Devuelve la interfaz activa de Google Sheets.
 */
function aerpGetUI_() {
  return SpreadsheetApp.getUi();
}

/**
 * Construye el título oficial de un diálogo.
 */
function aerpBuildTitle_(icon, title) {
  return icon + ' ' + AERP_UI.APP_NAME +
    (title ? ' | ' + title : '');
}

/**
 * Normaliza cualquier valor para mostrarlo como texto.
 */
function aerpNormalizeMessage_(message) {
  if (message === null || message === undefined) {
    return '';
  }

  if (typeof message === 'object') {
    return JSON.stringify(message, null, 2);
  }

  return String(message);
}

/**
 * Muestra un diálogo informativo.
 */
function aerpInfo(message, title) {
  aerpGetUI_().alert(
    aerpBuildTitle_(AERP_UI.ICONS.INFO, title || 'Información'),
    aerpNormalizeMessage_(message),
    aerpGetUI_().ButtonSet.OK
  );
}

/**
 * Muestra un diálogo de éxito.
 */
function aerpSuccess(message, title) {
  aerpGetUI_().alert(
    aerpBuildTitle_(AERP_UI.ICONS.SUCCESS, title || 'Proceso completado'),
    aerpNormalizeMessage_(message),
    aerpGetUI_().ButtonSet.OK
  );
}

/**
 * Muestra un diálogo de advertencia.
 */
function aerpWarning(message, title) {
  aerpGetUI_().alert(
    aerpBuildTitle_(AERP_UI.ICONS.WARNING, title || 'Advertencia'),
    aerpNormalizeMessage_(message),
    aerpGetUI_().ButtonSet.OK
  );
}

/**
 * Muestra un diálogo de error.
 */
function aerpError(message, title) {
  aerpGetUI_().alert(
    aerpBuildTitle_(AERP_UI.ICONS.ERROR, title || 'Error'),
    aerpNormalizeMessage_(message),
    aerpGetUI_().ButtonSet.OK
  );
}

/**
 * Muestra un diálogo de confirmación.
 *
 * Devuelve true cuando el usuario pulsa Sí.
 */
function aerpConfirm(message, title) {
  const response = aerpGetUI_().alert(
    aerpBuildTitle_(AERP_UI.ICONS.WARNING, title || 'Confirmación'),
    aerpNormalizeMessage_(message),
    aerpGetUI_().ButtonSet.YES_NO
  );

  return response === aerpGetUI_().Button.YES;
}

/**
 * Muestra una notificación no bloqueante en Google Sheets.
 */
function aerpToast(message, title, seconds) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  spreadsheet.toast(
    aerpNormalizeMessage_(message),
    aerpBuildTitle_(AERP_UI.ICONS.INFO, title || ''),
    seconds || AERP_UI.TOAST_SECONDS
  );
}

/**
 * Notificación de inicio del proceso Generar ERP.
 */
function aerpBuildStartedToast() {
  aerpToast(
    AERP_MESSAGES.BUILD_START,
    'Generando ERP',
    5
  );
}

/**
 * Notificación final del proceso Generar ERP.
 */
function aerpBuildSuccessDialog(summary) {
  const data = summary || {};

  const message = [
    AERP_MESSAGES.BUILD_SUCCESS,
    '',
    'Tablas: ' + Number(data.tables || 0),
    'Columnas: ' + Number(data.columns || 0),
    'Formularios: ' + Number(data.forms || 0),
    'Vistas: ' + Number(data.views || 0),
    'Menús: ' + Number(data.menus || 0),
    'Duración: ' + aerpFormatDuration_(data.durationMs || 0)
  ].join('\n');

  aerpSuccess(message, 'Generación finalizada');
}

/**
 * Muestra los errores del proceso Generar ERP.
 */
function aerpBuildErrorDialog(error) {
  const message = error && error.message
    ? error.message
    : aerpNormalizeMessage_(error);

  aerpError(
    AERP_MESSAGES.BUILD_ERROR + '\n\n' + message,
    'Generación interrumpida'
  );
}

/**
 * Convierte milisegundos a un formato legible.
 */
function aerpFormatDuration_(durationMs) {
  const milliseconds = Number(durationMs || 0);

  if (milliseconds < 1000) {
    return milliseconds + ' ms';
  }

  return (milliseconds / 1000).toFixed(2) + ' s';
}

/**
 * Construye un resumen estándar para cualquier proceso.
 */
function aerpBuildSummaryMessage_(title, values) {
  const lines = [title || 'Resumen', ''];

  Object.keys(values || {}).forEach(function(key) {
    lines.push(key + ': ' + values[key]);
  });

  return lines.join('\n');
}

/**
 * Prueba técnica.
 * No abre ventanas ni detiene la ejecución.
 */
function testUIFoundation() {
  const result = {
    ok: true,
    appName: AERP_UI.APP_NAME,
    edition: AERP_UI.EDITION,
    primaryColor: AERP_UI.COLORS.PRIMARY,
    successIcon: AERP_UI.ICONS.SUCCESS,
    formattedDuration: aerpFormatDuration_(3250)
  };

  Logger.log(JSON.stringify(result, null, 2));
  Logger.log('UI Foundation OK');

  return result;
}

/**
 * Demostración visual.
 * Debe ejecutarse desde el menú de Google Sheets.
 */
function demoUIFoundation() {
  aerpToast(
    'Probando la identidad visual de Alef ERP.',
    'UI Foundation',
    3
  );

  aerpSuccess(
    [
      'UI Foundation funciona correctamente.',
      '',
      'Producto: ' + AERP_UI.APP_NAME,
      'Edición: ' + AERP_UI.EDITION,
      'Estado: Production Ready'
    ].join('\n'),
    'Prueba completada'
  );
}
