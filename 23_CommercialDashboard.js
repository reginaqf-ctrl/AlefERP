/**
 * ==========================================================
 * ALEF ERP
 * Launch Edition 1.0
 *
 * Módulo: Commercial Dashboard
 * ID: AERP-023
 * Autor: Alef Engineering
 * UI Kit: Alef UI Kit 1.0
 * Design System: Alef Design System 1.0
 * Estado: Release Candidate
 * ==========================================================
 *
 * Dashboard comercial construido mediante componentes
 * reutilizables de 26_UIComponents.gs.
 *
 * Consume:
 * - AERP_BRAND
 * - AERP_THEME
 * - AERP_TYPOGRAPHY
 * - AERP_LAYOUT
 * - AERP_ICONS
 * - Alef UI Components MVP
 * ==========================================================
 */


/* ==========================================================
 * 1. CONSTRUCTOR PRINCIPAL
 * ==========================================================
 */

/**
 * Construye o actualiza el Dashboard Comercial.
 */
function aerpBuildCommercialDashboard() {
  const ss = aerpGetSpreadsheet();
  const sheetName = 'AERP_DASHBOARD';

  let stage = 'INICIO';
  let sheet = null;

  try {
    /* ------------------------------------------------------
     * 1. Obtener o crear la hoja
     * ------------------------------------------------------
     */

    stage = 'OBTENER_HOJA';

    sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    /* ------------------------------------------------------
     * 2. Preparar el lienzo
     * ------------------------------------------------------
     */

    stage = 'PREPARAR_HOJA';

    aerpEnsureSheetSize_(
      sheet,
      30,
      AERP_LAYOUT.DASHBOARD_COLUMNS
    );

    aerpRestoreSheetView_(sheet);

    /*
     * Eliminamos únicamente imágenes oficiales de branding
     * insertadas anteriormente.
     */
    aerpRemoveBrandAssetsFromSheet_(sheet);

    const visualRange =
      sheet.getRange('A1:H30');

    visualRange.breakApart();
    visualRange.clear();

    sheet.setConditionalFormatRules([]);

    aerpPrepareUiSheet_(
      sheet,
      30,
      AERP_LAYOUT.DASHBOARD_COLUMNS,
      AERP_LAYOUT.STANDARD_COLUMN_WIDTH
    );

    sheet.setFrozenRows(4);

    sheet.setRowHeights(
      1,
      3,
      AERP_LAYOUT.ROW_HEIGHT.HERO
    );

    /* ------------------------------------------------------
     * 3. Obtener métricas reales
     * ------------------------------------------------------
     */

    stage = 'OBTENER_METRICAS';

    const metrics =
      aerpGetCommercialDashboardMetrics_();

    /* ------------------------------------------------------
     * 4. Encabezado
     * ------------------------------------------------------
     */

    stage = 'CREAR_ENCABEZADO';

    aerpCreateHeader_(
      sheet,
      'A1:B3',
      'C1:H3',
      AERP_BRAND.PRODUCT,
      {
        insertLogo: true,
        alignment: 'left',
        logoColumn: 1,
        logoRow: 1,
        logoWidth: 68,
        logoHeight: 68
      }
    );

    aerpCreateSubHeader_(
      sheet,
      'A4:H4',
      AERP_BRAND.EDITION +
        ' | ' +
        AERP_BRAND.TAGLINE
    );

    /* ------------------------------------------------------
     * 5. Estado general
     * ------------------------------------------------------
     */

    stage = 'CREAR_ESTADO';

    const uiStatus =
      aerpResolveDashboardUiStatus_(
        metrics.status
      );

    aerpCreateStatusBanner_(
      sheet,
      'A6:H7',
      uiStatus,
      aerpDashboardStatusText_(
        metrics.status
      )
    );

    /* ------------------------------------------------------
     * 6. KPIs principales
     * ------------------------------------------------------
     */

    stage = 'CREAR_KPIS';

aerpRenderDashboardKpi_(
  sheet,
  'A9:B12',
  AERP_ICONS.TABLE,
  'TABLAS',
  metrics.tables,
  {
    valueFontSize: 26
  }
);

    aerpCreateKpiCard_(
      sheet,
      'C9:D12',
      AERP_ICONS.COLUMN,
      'COLUMNAS',
      metrics.columns
    );

    aerpCreateKpiCard_(
      sheet,
      'E9:F12',
      AERP_ICONS.FORM,
      'FORMULARIOS',
      metrics.forms
    );

    aerpCreateKpiCard_(
      sheet,
      'G9:H12',
      AERP_ICONS.VIEW,
      'VISTAS',
      metrics.views
    );

    aerpCreateKpiCard_(
      sheet,
      'A14:B17',
      AERP_ICONS.MENU,
      'MENÚS',
      metrics.menus
    );

    aerpCreateKpiCard_(
      sheet,
      'C14:D17',
      AERP_ICONS.WARNING,
      'ADVERTENCIAS',
      metrics.warnings,
      {
        borderColor:
          metrics.warnings > 0
            ? AERP_THEME.COLORS.WARNING
            : AERP_THEME.COLORS.BORDER
      }
    );

    aerpCreateKpiCard_(
      sheet,
      'E14:F17',
      AERP_ICONS.ERROR,
      'ERRORES',
      metrics.errors,
      {
        borderColor:
          metrics.errors > 0
            ? AERP_THEME.COLORS.ERROR
            : AERP_THEME.COLORS.BORDER
      }
    );

    aerpCreateKpiCard_(
      sheet,
      'G14:H17',
      AERP_ICONS.TIME,
      'DURACIÓN',
      aerpFormatDuration_(
        metrics.durationMs
      )
    );

    /* ------------------------------------------------------
     * 7. Información del Build
     * ------------------------------------------------------
     */

    stage = 'CREAR_RESUMEN_BUILD';

    aerpCreateSection_(
      sheet,
      'A19:H20',
      AERP_BRAND.ENGINE_NAME
    );

    const buildInfoRange =
      aerpUiMergeRange_(
        sheet,
        'A21:H22'
      );

    buildInfoRange
      .setValue(
        [
          'Última generación: ' +
            aerpFormatDashboardDate_(
              metrics.lastBuildDate
            ),

          'Build ID: ' +
            aerpUiText_(
              metrics.buildId ||
              'No disponible'
            ),

          'Metadata → Generator Engine → AppSheet Package → Deployment'
        ].join('\n')
      )
      .setBackground(
        AERP_THEME.COLORS.SURFACE
      )
      .setFontColor(
        AERP_THEME.COLORS.TEXT_SECONDARY
      )
      .setFontFamily(
        AERP_TYPOGRAPHY.FAMILY
      )
      .setFontSize(
        AERP_TYPOGRAPHY.SIZES.BODY
      )
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true);

    aerpApplyBorder_(
      buildInfoRange,
      AERP_THEME.COLORS.BORDER,
      SpreadsheetApp.BorderStyle.SOLID
    );

    /* ------------------------------------------------------
     * 8. Pie institucional
     * ------------------------------------------------------
     */

    stage = 'CREAR_PIE';

    aerpCreateFooter_(
      sheet,
      'A24:H26',
      AERP_BRAND.TAGLINE +
        '\n' +
        AERP_BRAND.POWERED_BY
    );

    const versionRange =
      aerpUiMergeRange_(
        sheet,
        'A28:H29'
      );

    versionRange
      .setValue(
        AERP_BRAND.PRODUCT +
          ' ' +
          AERP_BRAND.VERSION +
          ' | Design System ' +
          AERP_BRAND.DESIGN_SYSTEM_VERSION
      )
      .setBackground(
        AERP_THEME.COLORS.SURFACE
      )
      .setFontColor(
        AERP_THEME.COLORS.TEXT_MUTED
      )
      .setFontFamily(
        AERP_TYPOGRAPHY.FAMILY
      )
      .setFontSize(
        AERP_TYPOGRAPHY.SIZES.CAPTION
      )
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');

    /* ------------------------------------------------------
     * 9. Finalizar
     * ------------------------------------------------------
     */

    stage = 'FINALIZAR';

    aerpConstrainSheetView_(
      sheet,
      30,
      AERP_LAYOUT.DASHBOARD_COLUMNS
    );

    sheet.activate();
    sheet.getRange('A1').activate();

    SpreadsheetApp.flush();

    return {
      ok: true,
      stage: stage,
      sheet: sheetName,
      metrics: metrics,
      uiKit: 'Alef UI Kit 1.0',
      designSystem:
        AERP_BRAND.DESIGN_SYSTEM_VERSION
    };

  } catch (error) {
    const message =
      error && error.message
        ? error.message
        : String(error);

    console.error(
      [
        'Commercial Dashboard falló.',
        'Etapa: ' + stage,
        'Mensaje: ' + message,
        error && error.stack
          ? error.stack
          : ''
      ].join('\n')
    );

    return {
      ok: false,
      stage: stage,
      sheet: sheetName,
      message: message,
      stack:
        error && error.stack
          ? error.stack
          : ''
    };
  }
}

function aerpRenderDashboardKpi_(
  sheet,
  range,
  icon,
  title,
  value,
  options
) {

  const component =
    aerpCreateComponent(
      'card',
      'kpi',
      {
        icon: icon,
        title: title,
        value: value,
        subtitle: '',
        id:
          'dashboard-' +
          title
            .toLowerCase()
            .replace(/\s+/g, '-')
      }
    );

  return aerpRenderComponent(
    sheet,
    range,
    component,
    options || {}
  );

}

/* ==========================================================
 * 2. MÉTRICAS DEL DASHBOARD
 * ==========================================================
 */

/**
 * Obtiene las métricas reales del último Build.
 */
function aerpGetCommercialDashboardMetrics_() {
  const totalColumns =
    aerpCountNonEmptyTableRows_(
      AERP_SHEETS.CORE_COLUMNAS
    );

  const totalTables =
    aerpCountCoreTables_();

  const defaults = {
    lastBuildDate: new Date(),
    buildId: '',
    status: 'BUILD EXITOSO',
    forms: totalTables,
    views: totalTables,
    menus: totalTables,
    warnings: 0,
    errors: 0,
    durationMs: 0
  };

  const deployData =
    aerpReadLastDeployLog_();

  if (deployData) {
    defaults.lastBuildDate =
      deployData.date ||
      defaults.lastBuildDate;

    defaults.buildId =
      deployData.buildId || '';

    defaults.status =
      deployData.ok
        ? 'BUILD EXITOSO'
        : 'REVISIÓN NECESARIA';

    defaults.forms =
      aerpNumberOrFallback_(
        deployData.forms,
        defaults.forms
      );

    defaults.views =
      aerpNumberOrFallback_(
        deployData.views,
        defaults.views
      );

    defaults.menus =
      aerpNumberOrFallback_(
        deployData.menus,
        defaults.menus
      );

    defaults.warnings =
      aerpNumberOrFallback_(
        deployData.warnings,
        0
      );

    defaults.errors =
      aerpNumberOrFallback_(
        deployData.errors,
        defaults.status === 'BUILD EXITOSO'
          ? 0
          : 1
      );

    defaults.durationMs =
      aerpNumberOrFallback_(
        deployData.durationMs,
        0
      );
  }

  return {
    product: AERP_BRAND.PRODUCT,
    edition: AERP_BRAND.EDITION,
    version: AERP_BRAND.VERSION,

    status: defaults.status,

    tables: totalTables,
    columns: totalColumns,
    forms: defaults.forms,
    views: defaults.views,
    menus: defaults.menus,

    warnings: defaults.warnings,
    errors: defaults.errors,

    durationMs: defaults.durationMs,
    lastBuildDate: defaults.lastBuildDate,
    buildId: defaults.buildId
  };
}


/**
 * Cuenta únicamente registros válidos de CORE_TABLAS
 * usando su columna clave real.
 */
function aerpCountCoreTables_() {
  const table =
    aerpGetTable(
      AERP_SHEETS.CORE_TABLAS
    );

  const headers =
    table.headers.map(function(header) {
      return String(header || '').trim();
    });

  const possibleKeyHeaders = [
    'ID_Tabla',
    'ID_TABLA',
    'Id_Tabla',
    'Tabla',
    'Nombre_Tabla'
  ];

  let keyIndex = -1;

  for (
    let i = 0;
    i < possibleKeyHeaders.length;
    i++
  ) {
    keyIndex =
      headers.indexOf(
        possibleKeyHeaders[i]
      );

    if (keyIndex !== -1) {
      break;
    }
  }

  if (keyIndex === -1) {
    throw new Error(
      'CORE_TABLAS no contiene una columna clave reconocida. ' +
      'Encabezados encontrados: ' +
      headers.join(', ')
    );
  }

  const uniqueIds = {};

  table.rows.forEach(function(row) {
    const id =
      String(row[keyIndex] || '').trim();

    if (!id) {
      return;
    }

    const normalizedId =
      id.toUpperCase();

    if (
      normalizedId ===
      headers[keyIndex].toUpperCase()
    ) {
      return;
    }

    uniqueIds[normalizedId] = true;
  });

  return Object.keys(uniqueIds).length;
}


/**
 * Cuenta filas no vacías de una tabla registrada.
 */
function aerpCountNonEmptyTableRows_(
  sheetName
) {
  try {
    const table =
      aerpGetTable(sheetName);

    return table.rows.filter(
      function(row) {
        return row.some(
          function(value) {
            return (
              value !== null &&
              value !== undefined &&
              String(value).trim() !== ''
            );
          }
        );
      }
    ).length;

  } catch (error) {
    console.warn(
      'No se pudo contar la tabla ' +
      sheetName +
      ': ' +
      (
        error && error.message
          ? error.message
          : String(error)
      )
    );

    return 0;
  }
}


/* ==========================================================
 * 3. LECTURA SEGURA DEL DEPLOY LOG
 * ==========================================================
 */

/**
 * Lee la última fila válida de AERP_DEPLOY_LOG.
 *
 * Admite encabezados conocidos y conserva compatibilidad
 * con la estructura utilizada previamente.
 */
function aerpReadLastDeployLog_() {
  const ss = aerpGetSpreadsheet();

  const sheet =
    ss.getSheetByName(
      'AERP_DEPLOY_LOG'
    );

  if (
    !sheet ||
    sheet.getLastRow() <= 1 ||
    sheet.getLastColumn() === 0
  ) {
    return null;
  }

  const lastColumn =
    sheet.getLastColumn();

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getValues()[0]
      .map(function(value) {
        return String(value || '')
          .trim()
          .toLowerCase();
      });

  const values =
    sheet
      .getRange(
        sheet.getLastRow(),
        1,
        1,
        lastColumn
      )
      .getValues()[0];

  function valueByHeaders_(
    possibleNames,
    fallbackIndex
  ) {
    for (
      let index = 0;
      index < possibleNames.length;
      index++
    ) {
      const headerIndex =
        headers.indexOf(
          possibleNames[index]
            .toLowerCase()
        );

      if (headerIndex !== -1) {
        return values[headerIndex];
      }
    }

    if (
      fallbackIndex !== undefined &&
      fallbackIndex >= 0 &&
      fallbackIndex < values.length
    ) {
      return values[fallbackIndex];
    }

    return '';
  }

  const rawStatus =
    valueByHeaders_(
      [
        'estado',
        'status',
        'resultado'
      ],
      1
    );

  const normalizedStatus =
    String(rawStatus || '')
      .trim()
      .toUpperCase();

  return {
    date:
      valueByHeaders_(
        [
          'fecha',
          'date',
          'timestamp'
        ],
        0
      ),

    buildId:
  aerpNormalizeBuildId_(
    valueByHeaders_(
      [
        'build_id',
        'buildid',
        'id_build',
        'id_build_log'
      ]
    )
  ),

    ok:
      [
        'OK',
        'SUCCESS',
        'EXITOSO',
        'COMPLETADO',
        'COMPLETADA'
      ].indexOf(normalizedStatus) !== -1,

    forms:
      valueByHeaders_(
        [
          'formularios',
          'forms'
        ],
        4
      ),

    views:
      valueByHeaders_(
        [
          'vistas',
          'views'
        ],
        5
      ),

    menus:
      valueByHeaders_(
        [
          'menus',
          'menús'
        ],
        6
      ),

    warnings:
      valueByHeaders_(
        [
          'warnings',
          'advertencias'
        ],
        7
      ),

    durationMs:
      valueByHeaders_(
        [
          'duracionms',
          'duraciónms',
          'durationms',
          'duracion_ms',
          'duration_ms'
        ],
        8
      ),

    errors:
      valueByHeaders_(
        [
          'errors',
          'errores'
        ],
        9
      )
  };
}
/**
 * Normaliza el identificador del Build.
 * Evita interpretar métricas numéricas como Build ID.
 */
function aerpNormalizeBuildId_(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '';
  }

  const normalized =
    String(value).trim();

  if (!normalized) {
    return '';
  }

  if (/^\d+$/.test(normalized)) {
    return '';
  }

  return normalized;
}


/* ==========================================================
 * 4. HELPERS DEL DASHBOARD
 * ==========================================================
 */

/**
 * Convierte un valor en número o devuelve un respaldo.
 */
function aerpNumberOrFallback_(
  value,
  fallback
) {
  if (
    value === '' ||
    value === null ||
    value === undefined
  ) {
    return Number(fallback || 0);
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : Number(fallback || 0);
}


/**
 * Traduce el estado del Build al estado visual del UI Kit.
 */
function aerpResolveDashboardUiStatus_(
  buildStatus
) {
  const normalized =
    String(buildStatus || '')
      .trim()
      .toUpperCase();

  if (
    normalized === 'BUILD EXITOSO'
  ) {
    return 'SUCCESS';
  }

  if (
    normalized.indexOf('ERROR') !== -1
  ) {
    return 'ERROR';
  }

  if (
    normalized.indexOf('GENERANDO') !== -1 ||
    normalized.indexOf('RUNNING') !== -1
  ) {
    return 'RUNNING';
  }

  return 'WARNING';
}


/**
 * Devuelve el texto visual del estado.
 */
function aerpDashboardStatusText_(
  buildStatus
) {
  const status =
    aerpResolveDashboardUiStatus_(
      buildStatus
    );

  const theme =
    AERP_THEME.STATUS[status] ||
    AERP_THEME.STATUS.INFO;

  return (
    theme.icon +
    ' ' +
    String(
      buildStatus ||
      theme.label
    )
  );
}


/**
 * Formatea la fecha del último Build.
 */
function aerpFormatDashboardDate_(
  value
) {
  try {
    const date =
      value instanceof Date
        ? value
        : new Date(value);

    if (
      Number.isNaN(date.getTime())
    ) {
      return 'No disponible';
    }

    return Utilities.formatDate(
      date,
      Session.getScriptTimeZone() ||
        'Europe/Madrid',
      'dd/MM/yyyy HH:mm:ss'
    );

  } catch (error) {
    return 'No disponible';
  }
}


/* ==========================================================
 * 5. PRUEBA TÉCNICA
 * ==========================================================
 */

/**
 * Prueba completa del Dashboard Comercial.
 */
function testCommercialDashboard() {
  const result =
    aerpBuildCommercialDashboard();

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  if (!result.ok) {
    throw new Error(
      'Dashboard falló en la etapa [' +
      result.stage +
      ']: ' +
      result.message
    );
  }

  if (
    !result.metrics ||
    result.metrics.tables < 0 ||
    result.metrics.columns < 0
  ) {
    throw new Error(
      'El Dashboard devolvió métricas inválidas.'
    );
  }

  Logger.log(
    [
      'Commercial Dashboard UI Kit OK',
      result.metrics.tables +
        ' tablas',
      result.metrics.columns +
        ' columnas',
      aerpFormatDuration_(
        result.metrics.durationMs
      )
    ].join(' | ')
  );

  return result;
}
