/**
 * ALEF ERP Framework
 * 17_DeploymentMVP.gs
 *
 * AERP-017 - Deployment MVP
 * Primer flujo "Generar ERP".
 * No crea AppSheet todavía. Genera el paquete y lo registra.
 */

/**
 * Ejecuta la generación comercial usando la metadata
 * previamente sincronizada en CORE_COLUMNAS.
 */
function runGenerarERP() {
  const start = new Date();
  const monitor = aerpStartBuildMonitor();
  const sheet = monitor.sheet;

  try {
    aerpWorkflowBuildStep_(
      sheet,
      'Installer',
      '⏳ RUNNING',
      'Validando instalación...',
      start
    );

    const install = aerpInstallCheck();

    if (!install || !install.ok) {
      throw new Error(
        'La instalación de Alef ERP presenta errores.'
      );
    }

    aerpWorkflowBuildStep_(
      sheet,
      'Installer',
      '✅ OK',
      'Instalación validada',
      start
    );

    aerpWorkflowBuildStep_(
      sheet,
      'AppSheet Package',
      '⏳ RUNNING',
      'Generando aplicación desde CORE_COLUMNAS...',
      start
    );

    const packageResult = aerpBuildAppSheetPackage();

    if (!packageResult || !packageResult.ok) {
      throw new Error(
        'El paquete AppSheet no pudo generarse.'
      );
    }

    aerpWorkflowBuildStep_(
      sheet,
      'AppSheet Package',
      '✅ OK',
      packageResult.summary.tables +
        ' tablas, ' +
        packageResult.summary.columns +
        ' columnas',
      start
    );

    aerpWorkflowBuildStep_(
      sheet,
      'Deployment',
      '⏳ RUNNING',
      'Registrando resultado...',
      start
    );

    aerpWriteDeploymentLog_(packageResult, start);
    aerpWriteAppSheetPackageSummary_(packageResult);

    const durationMs = new Date() - start;
    packageResult.summary.durationMs = durationMs;

    aerpWorkflowBuildStep_(
      sheet,
      'Deployment',
      '✅ OK',
      'ERP generado correctamente',
      start
    );

    aerpBuildPipelineSummary_(
      sheet,
      packageResult,
      start
    );

    return {
      ok: true,
      status: 'SUCCESS',
      message: 'Alef ERP generado correctamente.',
      summary: packageResult.summary,
      warnings: packageResult.warnings || [],
      errors: [],
      durationMs: durationMs
    };

  } catch (error) {
    aerpWorkflowBuildStep_(
      sheet,
      'Generar ERP',
      '❌ ERROR',
      error.message,
      start
    );

    throw error;
  }
}
/**
 * Reconstruye CORE_COLUMNAS desde las tablas físicas.
 * Se ejecuta de forma independiente al botón Generar ERP.
 */
function runSincronizarMetadata() {
  const start = new Date();

  try {
    const result = aerpGenerate(AERP_MODES.REBUILD);

    if (!result || Number(result.inserted || 0) === 0) {
      throw new Error(
        'La sincronización no escribió metadata en CORE_COLUMNAS.'
      );
    }

    return {
      ok: true,
      status: 'SUCCESS',
      message: 'Metadata sincronizada correctamente.',
      summary: {
        inserted: Number(result.inserted || 0),
        updated: Number(result.updated || 0),
        skipped: Number(result.skipped || 0),
        total: Number(result.total || 0),
        warnings: Number((result.warnings || []).length),
        durationMs: new Date() - start
      },
      warnings: result.warnings || [],
      errors: []
    };

  } catch (error) {
    return {
      ok: false,
      status: 'FAILED',
      message: error.message,
      summary: {},
      warnings: [],
      errors: [error.message],
      durationMs: new Date() - start
    };
  }
}

function aerpWriteDeploymentLog_(packageResult, start) {
  const ss = aerpGetSpreadsheet();
  let sheet = ss.getSheetByName('AERP_DEPLOY_LOG');

  if (!sheet) {
    sheet = ss.insertSheet('AERP_DEPLOY_LOG');
    sheet.appendRow([
      'Fecha',
      'Resultado',
      'Tablas',
      'Columnas',
      'Formularios',
      'Vistas',
      'Menus',
      'Warnings',
      'DuracionMs'
    ]);
  }

  sheet.appendRow([
    new Date(),
    packageResult.ok ? 'OK' : 'ERROR',
    packageResult.summary.tables,
    packageResult.summary.columns,
    packageResult.summary.forms,
    packageResult.summary.views,
    packageResult.summary.menus,
    packageResult.warnings.length,
    new Date() - start
  ]);
}

function aerpWriteAppSheetPackageSummary_(packageResult) {
  const ss = aerpGetSpreadsheet();
  let sheet = ss.getSheetByName('AERP_APPSHEET_PACKAGE');

  if (!sheet) {
    sheet = ss.insertSheet('AERP_APPSHEET_PACKAGE');
  }

  sheet.clearContents();

  sheet.appendRow(['Seccion', 'ID', 'Nombre', 'Tabla', 'Tipo', 'Detalle']);

  packageResult.package.tables.forEach(function(table) {
    sheet.appendRow([
      'TABLE',
      table.id,
      table.name,
      table.sourceName,
      'Table',
      'Key: ' + table.keyColumn + ' | Label: ' + table.labelColumn
    ]);
  });

  packageResult.package.forms.forEach(function(form) {
    sheet.appendRow([
      'FORM',
      form.id,
      form.name,
      form.table,
      form.type,
      form.columns.join(', ')
    ]);
  });

  packageResult.package.views.forEach(function(view) {
    sheet.appendRow([
      'VIEW',
      view.id,
      view.name,
      view.table,
      view.type,
      view.columns.join(', ')
    ]);
  });

  packageResult.package.menus.forEach(function(menu) {
    sheet.appendRow([
      'MENU',
      menu.id,
      menu.name,
      menu.table,
      'Menu',
      'View: ' + menu.view
    ]);
  });
}

function testGenerarERP() {
  const result = runGenerarERP();
  Logger.log(JSON.stringify(result, null, 2));
}

