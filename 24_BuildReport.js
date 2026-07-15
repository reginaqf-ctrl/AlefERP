/**
 * ==========================================================
 * ALEF ERP
 * Launch Edition 1.0
 *
 * Módulo: Build Report
 * ID: AERP-024
 * Autor: Alef Engineering
 * Arquitectura: Metadata Engine 3.0
 * Estado: Release Candidate
 * ==========================================================
 *
 * Genera un informe profesional del último Build registrado.
 *
 * No ejecuta Scanner, Generator ni AppSheet Package.
 * Utiliza CORE_TABLAS, CORE_COLUMNAS y AERP_DEPLOY_LOG
 * como fuentes de información.
 * ==========================================================
 */

/**
 * Construye el reporte del último Build.
 *
 * @return {Object} Resultado y métricas del reporte.
 */
function aerpBuildReport() {
  const ss = aerpGetSpreadsheet();
  const sheetName = 'AERP_BUILD_REPORT';

  let stage = 'INICIO';

  try {
    stage = 'OBTENER_METRICAS';

    const metrics = aerpGetBuildReportMetrics_();

    stage = 'PREPARAR_HOJA';

    const oldSheet = ss.getSheetByName(sheetName);

    if (oldSheet) {
      ss.deleteSheet(oldSheet);
      SpreadsheetApp.flush();
    }

    const sheet = ss.insertSheet(sheetName);

    aerpPrepareBuildReportSheet_(sheet);

    stage = 'DIBUJAR_REPORTE';

    aerpRenderBuildReport_(sheet, metrics);

    stage = 'FINALIZAR';

    SpreadsheetApp.flush();

    return {
      ok: true,
      status: 'SUCCESS',
      stage: stage,
      sheet: sheetName,
      metrics: metrics
    };

  } catch (error) {
    const message =
      error && error.message
        ? error.message
        : String(error);

    Logger.log(
      'Build Report falló en [' +
      stage +
      ']: ' +
      message
    );

    return {
      ok: false,
      status: 'FAILED',
      stage: stage,
      sheet: sheetName,
      message: message,
      errors: [message]
    };
  }
}

/**
 * Obtiene las métricas del último Build.
 */
function aerpGetBuildReportMetrics_() {
  const ss = aerpGetSpreadsheet();

  const coreTablas = aerpGetTable(
    AERP_SHEETS.CORE_TABLAS
  );

  const coreColumnas = aerpGetTable(
    AERP_SHEETS.CORE_COLUMNAS
  );

  const totalTables =
    aerpCountBuildReportRows_(coreTablas.rows);

  const totalColumns =
    aerpCountBuildReportRows_(coreColumnas.rows);

  const deploySheet =
    ss.getSheetByName('AERP_DEPLOY_LOG');

  let buildDate = new Date();
  let buildStatus = 'SUCCESS';

  let forms = totalTables;
  let views = totalTables;
  let menus = totalTables;

  let warnings = 0;
  let errors = 0;
  let durationMs = 0;

  if (
    deploySheet &&
    deploySheet.getLastRow() > 1
  ) {
    const lastRow = deploySheet.getLastRow();
    const lastColumn = deploySheet.getLastColumn();

    const values = deploySheet
      .getRange(
        lastRow,
        1,
        1,
        lastColumn
      )
      .getValues()[0];

    buildDate = values[0] || buildDate;

    buildStatus =
      String(values[1] || '').toUpperCase() === 'OK'
        ? 'SUCCESS'
        : 'FAILED';

    forms = Number(values[4] || forms);
    views = Number(values[5] || views);
    menus = Number(values[6] || menus);

    warnings = Number(values[7] || 0);
    durationMs = Number(values[8] || 0);

    errors =
      buildStatus === 'SUCCESS'
        ? 0
        : 1;
  }

  return {
    product: AERP_UI.APP_NAME,
    edition: AERP_UI.EDITION,
    version: AERP_VERSION,
    engine: 'Metadata Engine 3.0',

    status: buildStatus,
    buildDate: buildDate,

    tables: totalTables,
    columns: totalColumns,
    forms: forms,
    views: views,
    menus: menus,

    warnings: warnings,
    errors: errors,

    durationMs: durationMs,
    durationText:
      aerpFormatDuration_(durationMs)
  };
}

/**
 * Cuenta únicamente filas que contienen datos.
 */
function aerpCountBuildReportRows_(rows) {
  return (rows || []).filter(function(row) {
    return row.some(function(value) {
      const normalized =
        value === null ||
        value === undefined
          ? ''
          : String(value).trim();

      return normalized !== '';
    });
  }).length;
}

/**
 * Configura la hoja del reporte.
 */
function aerpPrepareBuildReportSheet_(sheet) {
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(4);

  sheet.setColumnWidths(1, 8, 110);

  for (let row = 1; row <= 42; row++) {
    sheet.setRowHeight(row, 28);
  }

  sheet.getRange('A1:H42')
    .setFontFamily('Arial')
    .setVerticalAlignment('middle')
    .setBackground('#FFFFFF');
}

/**
 * Dibuja todo el contenido del reporte.
 */
function aerpRenderBuildReport_(sheet, metrics) {
  aerpRenderBuildReportHeader_(
    sheet,
    metrics
  );

  aerpRenderBuildReportStatus_(
    sheet,
    metrics
  );

  aerpRenderBuildReportExecutiveSummary_(
    sheet,
    metrics
  );

  aerpRenderBuildReportMetrics_(
    sheet,
    metrics
  );

  aerpRenderBuildReportTechnicalInfo_(
    sheet,
    metrics
  );

  aerpRenderBuildReportFooter_(
    sheet
  );
}

/**
 * Cabecera del reporte.
 */
function aerpRenderBuildReportHeader_(
  sheet,
  metrics
) {
  const titleRange =
    sheet.getRange('A1:H3');

  titleRange.merge();

  titleRange
    .setValue('🚀 ' + metrics.product)
    .setBackground(
      AERP_UI.COLORS.PRIMARY
    )
    .setFontColor(
      AERP_UI.COLORS.TEXT_LIGHT
    )
    .setFontSize(24)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  const subtitleRange =
    sheet.getRange('A4:H4');

  subtitleRange.merge();

  subtitleRange
    .setValue(
      'Generation Report | ' +
      metrics.edition
    )
    .setBackground(
      AERP_UI.COLORS.SECONDARY
    )
    .setFontColor(
      AERP_UI.COLORS.TEXT_LIGHT
    )
    .setFontSize(12)
    .setHorizontalAlignment('center');
}

/**
 * Estado principal.
 */
function aerpRenderBuildReportStatus_(
  sheet,
  metrics
) {
  const success =
    metrics.status === 'SUCCESS';

  const statusRange =
    sheet.getRange('A6:H8');

  statusRange.merge();

  statusRange
    .setValue(
      success
        ? '✅ BUILD COMPLETADO'
        : '❌ BUILD CON ERRORES'
    )
    .setBackground(
      success
        ? AERP_UI.COLORS.SUCCESS
        : AERP_UI.COLORS.ERROR
    )
    .setFontColor(
      AERP_UI.COLORS.TEXT_LIGHT
    )
    .setFontSize(20)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
}

/**
 * Resumen ejecutivo.
 */
function aerpRenderBuildReportExecutiveSummary_(
  sheet,
  metrics
) {
  const date = new Date(metrics.buildDate);

  const dateText =
    isNaN(date.getTime())
      ? 'Fecha no disponible'
      : Utilities.formatDate(
          date,
          Session.getScriptTimeZone(),
          'dd/MM/yyyy HH:mm:ss'
        );

  const labels = [
    ['A10:B10', 'Producto'],
    ['A11:B11', 'Edición'],
    ['A12:B12', 'Versión'],
    ['A13:B13', 'Fecha del Build'],
    ['A14:B14', 'Estado']
  ];

  const values = [
    ['C10:H10', metrics.product],
    ['C11:H11', metrics.edition],
    ['C12:H12', metrics.version],
    ['C13:H13', dateText],
    ['C14:H14', metrics.status]
  ];

  labels.forEach(function(item) {
    const range = sheet.getRange(item[0]);

    range.merge()
      .setValue(item[1])
      .setBackground('#E8EFEA')
      .setFontWeight('bold')
      .setFontColor(
        AERP_UI.COLORS.TEXT_DARK
      );
  });

  values.forEach(function(item) {
    const range = sheet.getRange(item[0]);

    range.merge()
      .setValue(item[1])
      .setHorizontalAlignment('left')
      .setFontColor(
        AERP_UI.COLORS.TEXT_DARK
      );
  });
}

/**
 * Métricas principales.
 */
function aerpRenderBuildReportMetrics_(
  sheet,
  metrics
) {
  const cards = [
    ['A17:B20', '📋 TABLAS', metrics.tables],
    ['C17:D20', '🧩 COLUMNAS', metrics.columns],
    ['E17:F20', '📝 FORMULARIOS', metrics.forms],
    ['G17:H20', '👁️ VISTAS', metrics.views],

    ['A22:B25', '🧭 MENÚS', metrics.menus],
    ['C22:D25', '⚠️ WARNINGS', metrics.warnings],
    ['E22:F25', '❌ ERRORES', metrics.errors],
    [
      'G22:H25',
      '⏱️ DURACIÓN',
      metrics.durationText
    ]
  ];

  cards.forEach(function(card) {
    aerpRenderBuildReportCard_(
      sheet,
      card[0],
      card[1],
      card[2]
    );
  });
}

/**
 * Tarjeta de métrica.
 */
function aerpRenderBuildReportCard_(
  sheet,
  rangeA1,
  title,
  value
) {
  const range = sheet.getRange(rangeA1);

  range.merge();

  range
    .setValue(
      title +
      '\n\n' +
      value
    )
    .setBackground(
      AERP_UI.COLORS.BACKGROUND
    )
    .setFontColor(
      AERP_UI.COLORS.TEXT_DARK
    )
    .setFontWeight('bold')
    .setFontSize(14)
    .setHorizontalAlignment('center')
    .setWrap(true);

  range.setBorder(
    true,
    true,
    true,
    true,
    false,
    false
  );
}

/**
 * Información técnica y trazabilidad.
 */
function aerpRenderBuildReportTechnicalInfo_(
  sheet,
  metrics
) {
  const titleRange =
    sheet.getRange('A28:H29');

  titleRange.merge();

  titleRange
    .setValue('Información técnica')
    .setBackground(
      AERP_UI.COLORS.ACCENT
    )
    .setFontWeight('bold')
    .setFontSize(14)
    .setHorizontalAlignment('center');

  const technicalData = [
    ['A31:B31', 'Motor'],
    ['A32:B32', 'Arquitectura'],
    ['A33:B33', 'Plataforma objetivo'],
    ['A34:B34', 'Flujo']
  ];

  const technicalValues = [
    ['C31:H31', metrics.engine],
    ['C32:H32', 'Metadata Driven Architecture'],
    ['C33:H33', 'Google AppSheet'],
    [
      'C34:H34',
      'Metadata → Generator → Package → Deployment'
    ]
  ];

  technicalData.forEach(function(item) {
    sheet.getRange(item[0])
      .merge()
      .setValue(item[1])
      .setBackground('#E8EFEA')
      .setFontWeight('bold');
  });

  technicalValues.forEach(function(item) {
    sheet.getRange(item[0])
      .merge()
      .setValue(item[1])
      .setWrap(true);
  });
}

/**
 * Pie institucional.
 */
function aerpRenderBuildReportFooter_(sheet) {
  const footerRange =
    sheet.getRange('A38:H40');

  footerRange.merge();

  footerRange
    .setValue(
      'Reporte generado automáticamente por Alef ERP\n' +
      'Powered by Alef Engineering'
    )
    .setBackground(
      AERP_UI.COLORS.PRIMARY
    )
    .setFontColor(
      AERP_UI.COLORS.TEXT_LIGHT
    )
    .setFontStyle('italic')
    .setHorizontalAlignment('center')
    .setWrap(true);
}

/**
 * Prueba técnica del Build Report.
 */
function testBuildReport() {
  const result = aerpBuildReport();

  Logger.log(
    JSON.stringify(result, null, 2)
  );

  if (!result.ok) {
    throw new Error(
      'Build Report falló en la etapa [' +
      result.stage +
      ']: ' +
      result.message
    );
  }

  Logger.log(
    'Build Report OK | ' +
    result.metrics.tables +
    ' tablas | ' +
    result.metrics.columns +
    ' columnas | ' +
    result.metrics.status
  );

  return result;
}