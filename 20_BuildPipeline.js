/**
 * ALEF ERP Framework
 * 20_BuildPipeline.gs
 *
 * AERP-019 - Build Pipeline
 * Orquestador central del proceso "Generar ERP".
 */

function aerpRunBuildPipeline() {
  const monitor = aerpStartBuildMonitor();
  const sheet = monitor.sheet;
  const globalStart = monitor.start;

  let packageResult;

  try {
    aerpBuildStep(sheet, 'Installer', '⏳ RUNNING', 'Validando instalación...', globalStart);
    const install = aerpInstallCheck();

    if (!install.ok) {
      aerpBuildStep(sheet, 'Installer', '❌ ERROR', install.errors.join(' | '), globalStart);
      throw new Error('Instalación inválida.');
    }

    aerpBuildStep(sheet, 'Installer', '✅ OK', 'Instalación validada', globalStart);

    aerpBuildStep(sheet, 'DryRun', '⏳ RUNNING', 'Validando metadata...', globalStart);
    const dryRun = runAlefERPDryRun();
    aerpBuildStep(
      sheet,
      'DryRun',
      '✅ OK',
      dryRun.columnasDetectadas + ' columnas detectadas',
      globalStart
    );

    aerpBuildStep(sheet, 'Metadata Builder', '⏳ RUNNING', 'Construyendo modelo...', globalStart);
    const metadataModel = aerpBuildMetadataModel();

    if (metadataModel.summary.errors.length > 0) {
      aerpBuildStep(
        sheet,
        'Metadata Builder',
        '❌ ERROR',
        metadataModel.summary.errors.join(' | '),
        globalStart
      );
      throw new Error('Metadata Builder generó errores.');
    }

    aerpBuildStep(
      sheet,
      'Metadata Builder',
      '✅ OK',
      metadataModel.summary.tables + ' tablas procesadas',
      globalStart
    );

    aerpBuildStep(sheet, 'Generator Engine', '⏳ RUNNING', 'Generando objetos...', globalStart);
    const generator = aerpBuildGeneratorEngineMVP();

    aerpBuildStep(
      sheet,
      'Generator Engine',
      '✅ OK',
      generator.summary.tables + ' tablas, ' + generator.summary.views + ' vistas',
      globalStart
    );

    aerpBuildStep(sheet, 'AppSheet Package', '⏳ RUNNING', 'Construyendo package...', globalStart);
    packageResult = aerpBuildAppSheetPackage();

    if (!packageResult.ok) {
      aerpBuildStep(
        sheet,
        'AppSheet Package',
        '❌ ERROR',
        packageResult.errors.join(' | '),
        globalStart
      );
      throw new Error('AppSheet Package inválido.');
    }

    aerpBuildStep(
      sheet,
      'AppSheet Package',
      '✅ OK',
      packageResult.summary.tables + ' tablas listas para AppSheet',
      globalStart
    );

    aerpBuildStep(sheet, 'Deployment', '⏳ RUNNING', 'Registrando resultado...', globalStart);
    aerpWriteDeploymentLog_(packageResult, globalStart);
    aerpWriteAppSheetPackageSummary_(packageResult);

    aerpBuildStep(
      sheet,
      'Deployment',
      '✅ OK',
      'ERP generado correctamente',
      globalStart
    );

    aerpBuildPipelineSummary_(sheet, packageResult, globalStart);

    return {
      ok: true,
      message: 'Alef ERP generado correctamente.',
      summary: packageResult.summary,
      warnings: packageResult.warnings
    };

  } catch (error) {
    aerpBuildStep(
      sheet,
      'Pipeline',
      '❌ ERROR',
      error.message,
      globalStart
    );

    throw error;
  }
}

function aerpBuildPipelineSummary_(sheet, packageResult, start) {
  const row = sheet.getLastRow() + 2;

  sheet.getRange(row, 1).setValue('🚀 ALEF ERP BUILD SUMMARY');
  sheet.getRange(row, 1, 1, 5).merge();
  sheet.getRange(row, 1)
    .setFontWeight('bold')
    .setFontSize(14)
    .setBackground('#12372A')
    .setFontColor('#FFFFFF');

  const data = [
    ['Estado', 'COMPLETADO'],
    ['Versión', AERP_VERSION],
    ['Tablas', packageResult.summary.tables],
    ['Columnas', packageResult.summary.columns],
    ['Formularios', packageResult.summary.forms],
    ['Vistas', packageResult.summary.views],
    ['Menús', packageResult.summary.menus],
    ['Warnings', packageResult.warnings.length],
    ['Duración total ms', new Date() - start]
  ];

  sheet.getRange(row + 1, 1, data.length, 2).setValues(data);
  sheet.autoResizeColumns(1, 5);
}

function testBuildPipeline() {
  const result = aerpRunBuildPipeline();
  Logger.log(JSON.stringify(result, null, 2));
}
