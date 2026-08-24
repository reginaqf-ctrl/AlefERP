/**
 * ALEF ERP Framework
 * 21_BuildWorkflow.gs
 *
 * AERP-038B - Locked compatibility adapter for the single-build Pipeline.
 */

function aerpRunBuildWorkflow() {
  const start = new Date();
  try {
    const pipelineResult = aerpRunBuildPipeline();
    if (!pipelineResult || pipelineResult.ok !== true) {
      return aerpWorkflowFailureResponse_(new Date() - start);
    }

    const summary = aerpWorkflowCopySummary_(pipelineResult.summary);
    return {
      ok: true,
      status: 'SUCCESS',
      message: 'Alef ERP generado correctamente.',
      summary,
      metadata: {
        tables: summary.tables,
        columns: summary.columns,
        primaryKeys: summary.primaryKeys,
        foreignKeys: summary.foreignKeys,
        labels: summary.labels
      },
      warnings: aerpWorkflowCopyStrings_(pipelineResult.warnings),
      errors: [],
      durationMs: new Date() - start
    };
  } catch (_error) {
    return aerpWorkflowFailureResponse_(new Date() - start);
  }
}

function aerpWorkflowFailureResponse_(durationMs) {
  const message = 'No fue posible completar el workflow de Alef ERP.';
  return {
    ok: false,
    status: 'FAILED',
    message,
    summary: {},
    metadata: null,
    warnings: [],
    errors: [message],
    durationMs
  };
}

function aerpWorkflowCopySummary_(summary) {
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

function aerpWorkflowCopyStrings_(values) {
  return Array.isArray(values)
    ? values.filter(function (value) {
        return typeof value === 'string';
      })
    : [];
}

/** Preserved compatibility helper for external technical callers. */
function aerpWorkflowBuildStep_(sheet, step, status, message, startTime) {
  aerpBuildStep(sheet, step, status, message, startTime);
  SpreadsheetApp.flush();
}

function testBuildWorkflow() {
  const result = aerpRunBuildWorkflow();
  Logger.log(JSON.stringify(result, null, 2));
  if (!result.ok) throw new Error('Build Workflow falló.');
  if (Number(result.summary.columns || 0) !== Number(result.metadata.columns || 0)) {
    throw new Error('Inconsistencia final entre Pipeline y Workflow.');
  }
  return result;
}
