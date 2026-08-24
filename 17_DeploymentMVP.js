/**
 * ALEF ERP Framework
 * 17_DeploymentMVP.gs
 *
 * AERP-017 / AERP-038B - Compatible deployment adapter and operational writers.
 */

function runGenerarERP() {
  const start = new Date();
  try {
    const pipelineResult = aerpRunBuildPipeline();
    const durationMs = new Date() - start;
    if (!pipelineResult || pipelineResult.ok !== true) {
      return aerpDeploymentFailureResponse_(durationMs);
    }
    return {
      ok: true,
      status: 'SUCCESS',
      message: 'Alef ERP generado correctamente.',
      summary: aerpDeploymentCopySummary_(pipelineResult.summary),
      warnings: aerpDeploymentCopyStrings_(pipelineResult.warnings),
      errors: [],
      durationMs
    };
  } catch (_error) {
    return aerpDeploymentFailureResponse_(new Date() - start);
  }
}

function aerpDeploymentFailureResponse_(durationMs) {
  const message = 'No fue posible completar la generación de Alef ERP.';
  return {
    ok: false,
    status: 'FAILED',
    message,
    summary: {},
    warnings: [],
    errors: [message],
    durationMs
  };
}

function aerpDeploymentCopySummary_(summary) {
  return {
    contractVersion: summary.contractVersion,
    tables: summary.tables,
    columns: summary.columns,
    primaryKeys: summary.primaryKeys,
    foreignKeys: summary.foreignKeys,
    labels: summary.labels,
    forms: summary.forms,
    views: summary.views,
    menus: summary.menus,
    warnings: summary.warnings,
    errors: summary.errors,
    durationMs: summary.durationMs
  };
}

function aerpDeploymentCopyStrings_(values) {
  return Array.isArray(values)
    ? values.filter(function (value) {
        return typeof value === 'string';
      })
    : [];
}

/** Explicit metadata synchronization remains separate from build/deployment. */
function runSincronizarMetadata() {
  const start = new Date();
  try {
    const result = aerpGenerate(AERP_MODES.REBUILD);
    if (!result || Number(result.inserted || 0) === 0) {
      throw new Error('La sincronización no escribió metadata en CORE_COLUMNAS.');
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
    const message = error && error.message ? error.message : 'No fue posible sincronizar metadata.';
    return {
      ok: false,
      status: 'FAILED',
      message,
      summary: {},
      warnings: [],
      errors: [message],
      durationMs: new Date() - start
    };
  }
}

function aerpWriteDeploymentLog_(bundle, start) {
  if (!aerpValidateFrozenSingleBuildBundle_(bundle)) {
    throw new Error('AERP_DEPLOYMENT_BUNDLE_INVALID');
  }
  const packageResult = bundle.appSheetResult;
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
    'PENDING',
    packageResult.summary.tables,
    packageResult.summary.columns,
    packageResult.summary.forms,
    packageResult.summary.views,
    packageResult.summary.menus,
    packageResult.warnings.length,
    new Date() - start
  ]);
  return { sheet, row: sheet.getLastRow() };
}

function aerpFinalizeDeploymentLog_(receipt, status, start) {
  if (!receipt || !receipt.sheet || !Number.isInteger(receipt.row) || receipt.row < 2) return;
  receipt.sheet.getRange(receipt.row, 9).setValue(new Date() - start);
  receipt.sheet.getRange(receipt.row, 2).setValue(status === 'OK' ? 'OK' : 'ERROR');
}

function aerpWriteAppSheetPackageSummary_(bundle) {
  if (!aerpValidateFrozenSingleBuildBundle_(bundle)) {
    throw new Error('AERP_DEPLOYMENT_BUNDLE_INVALID');
  }
  const packageResult = bundle.appSheetResult;
  const ss = aerpGetSpreadsheet();
  let sheet = ss.getSheetByName('AERP_APPSHEET_PACKAGE');
  if (!sheet) sheet = ss.insertSheet('AERP_APPSHEET_PACKAGE');
  sheet.clearContents();
  sheet.appendRow(['Seccion', 'ID', 'Nombre', 'Tabla', 'Tipo', 'Detalle']);
  packageResult.package.tables.forEach(function (table) {
    sheet.appendRow([
      'TABLE',
      table.id,
      table.name,
      table.sourceName,
      'Table',
      'Key: ' + table.keyColumn + ' | Label: ' + table.labelColumn
    ]);
  });
  packageResult.package.forms.forEach(function (form) {
    sheet.appendRow(['FORM', form.id, form.name, form.table, form.type, form.columns.join(', ')]);
  });
  packageResult.package.views.forEach(function (view) {
    sheet.appendRow(['VIEW', view.id, view.name, view.table, view.type, view.columns.join(', ')]);
  });
  packageResult.package.menus.forEach(function (menu) {
    sheet.appendRow(['MENU', menu.id, menu.name, menu.table, 'Menu', 'View: ' + menu.view]);
  });
}

function testGenerarERP() {
  const result = runGenerarERP();
  Logger.log(JSON.stringify(result, null, 2));
}
