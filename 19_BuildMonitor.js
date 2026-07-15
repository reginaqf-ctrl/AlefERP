/**
 * ALEF ERP Framework
 * 19_BuildMonitor.gs
 *
 * AERP-018 - Build Monitor
 * Monitor visual del proceso "Generar ERP".
 */

function aerpStartBuildMonitor() {
  const sheet = aerpGetOrCreateBuildSheet_();
  sheet.clearContents();

  sheet.appendRow(['Paso', 'Estado', 'Mensaje', 'Fecha', 'DuracionMs']);

  aerpFormatBuildSheet_(sheet);

  return {
    sheet: sheet,
    start: new Date()
  };
}

function aerpBuildStep(sheet, step, status, message, startTime) {
  sheet.appendRow([
    step,
    status,
    message || '',
    new Date(),
    startTime ? new Date() - startTime : ''
  ]);
}

function aerpGetOrCreateBuildSheet_() {
  const ss = aerpGetSpreadsheet();
  let sheet = ss.getSheetByName('AERP_BUILD');

  if (!sheet) {
    sheet = ss.insertSheet('AERP_BUILD');
  }

  return sheet;
}

function aerpFormatBuildSheet_(sheet) {
  const header = sheet.getRange(1, 1, 1, 5);
  header.setFontWeight('bold');
  header.setBackground('#12372A');
  header.setFontColor('#FFFFFF');

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 5);
}

function testBuildMonitor() {
  const monitor = aerpStartBuildMonitor();
  const sheet = monitor.sheet;

  aerpBuildStep(sheet, 'Installer', '✅ OK', 'Instalación validada', monitor.start);
  aerpBuildStep(sheet, 'Metadata', '✅ OK', 'Metadata procesada', monitor.start);
  aerpBuildStep(sheet, 'Generator Engine', '✅ OK', 'Objetos generados', monitor.start);
  aerpBuildStep(sheet, 'AppSheet Package', '✅ OK', 'Package generado', monitor.start);
  aerpBuildStep(sheet, 'Deployment', '✅ OK', 'ERP generado correctamente', monitor.start);

  Logger.log('Build Monitor OK');
}
