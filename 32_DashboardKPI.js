/**
 * ============================================================
 * ALEF ERP
 * Enterprise Dashboard KPI
 * ------------------------------------------------------------
 * Module : AERP-032
 * Name   : Dashboard KPI
 * Version: 1.0.0
 * Status : Phase 1 - KPI Foundation
 * ------------------------------------------------------------
 * Description:
 * Creates and renders reusable Enterprise KPI components for
 * Alef ERP dashboards.
 *
 * Public API:
 * - aerpCreateDashboardKpiSpecification(config)
 * - aerpRenderDashboardKpi(sheet, rangeA1, specification)
 * - testDashboardKpi()
 *
 * Dependencies:
 * - AERP-027 UI Theme
 * - AERP-029 Sheet Renderer helpers
 * ============================================================
 */


/* ============================================================
 * 1. MODULE CONSTANTS
 * ============================================================
 */

const AERP_DASHBOARD_KPI_VERSION =
  '1.0.0';
/**
 * Official relative KPI layout.
 *
 * Regions are calculated from the target range received by
 * aerpRenderDashboardKpi().
 */
const AERP_DASHBOARD_KPI_LAYOUT = {
  titleRows: 1,
  valueRows: 4,
  subtitleRows: 1,
  footerRows: 1,
  minimumRows: 7
};


/* ============================================================
 * 2. PUBLIC API
 * ============================================================
 */

/**
 * Creates a normalized Dashboard KPI specification.
 *
 * @param {Object} config KPI configuration.
 * @return {Object} Normalized KPI specification.
 */
function aerpCreateDashboardKpiSpecification(
  config
) {
  if (
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config)
  ) {
    throw new Error(
      '[AERP-032] KPI configuration must be an object.'
    );
  }

  const title =
    String(config.title || '')
      .trim();

  if (!title) {
    throw new Error(
      '[AERP-032] KPI title is required.'
    );
  }

  return {
    id:
      config.id ||
      (
        'dashboard-kpi-' +
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      ),

    icon:
      config.icon || '📊',

    title:
      title,

    value:
      config.value === null ||
      config.value === undefined
        ? ''
        : String(config.value),

    subtitle:
      String(
        config.subtitle || ''
      ),

    trend:
      String(
        config.trend || ''
      ),

    trendDirection:
      aerpNormalizeDashboardKpiTrendDirection_(
        config.trendDirection
      ),

    status:
      String(
        config.status || ''
      ),

    visible:
      config.visible !== false,

    enabled:
      config.enabled !== false,

    loading:
      config.loading === true,

    options:
      config.options &&
      typeof config.options === 'object'
        ? config.options
        : {}
  };
}


/**
 * Renders one Enterprise Dashboard KPI.
 *
 * Phase 1 intentionally uses the existing card.kpi renderer.
 * AERP-032 will add trend and status regions in the next step.
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {string} rangeA1 Target range.
 * @param {Object} specification KPI specification.
 * @return {*} Rendered range.
 */
/**
 * Renders one reusable Enterprise Dashboard KPI.
 *
 * The KPI is divided into:
 * - title
 * - value
 * - subtitle
 * - footer
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {string} rangeA1 Target range.
 * @param {Object} specification KPI specification.
 * @return {*} Complete rendered KPI range.
 */
function aerpRenderDashboardKpi(
  sheet,
  rangeA1,
  specification
) {
  if (!sheet) {
    throw new Error(
      '[AERP-032] A valid sheet is required.'
    );
  }

  if (
    !specification ||
    typeof specification !== 'object'
  ) {
    throw new Error(
      '[AERP-032] KPI specification is required.'
    );
  }

  const layout =
    aerpCreateDashboardKpiLayout_(
      sheet,
      rangeA1
    );

  const theme =
    aerpGetTheme();

  const options =
    specification.options || {};

  /*
   * Main KPI surface.
   */
  layout.source
    .setBackground(
      options.background ||
      theme.colors
        .surface
        .default
    )
  .setBorder(
    true,
    true,
    true,
    true,
    false,
    false,
    '#E5E7EB',
    SpreadsheetApp.BorderStyle.SOLID
)
    .setFontFamily(
      theme.typography
        .fontFamily
        .primary
    );

  /*
   * Invisible state.
   */
  if (
    specification.visible === false
  ) {
    layout.source.clearContent();

    return layout.source;
  }

  /*
   * Loading state.
   */
  if (
    specification.loading === true
  ) {
    layout.title.clearContent();
    layout.subtitle.clearContent();
    layout.footer.clearContent();

    layout.value
      .setValue(
        options.loadingText ||
        'Cargando...'
      )
      .setFontColor(
        theme.colors
          .text
          .secondary
      )
      .setFontSize(
        theme.typography
          .styles
          .bodyLarge
          .fontSize
      )
      .setFontWeight('bold')
      .setHorizontalAlignment(
        'center'
      )
     .setVerticalAlignment(
  'top'
)
.setWrap(false);

    return layout.source;
  }

  /*
   * Title.
   */
  layout.title
    .setValue(
      [
        specification.icon || '',
        specification.title || ''
      ]
        .filter(function(value) {
          return String(value).trim() !== '';
        })
        .join(' ')
    )
    .setFontColor(
      options.titleColor ||
      theme.colors
        .text
        .primary
    )
    .setFontSize(
    Number(
        options.titleFontSize || 11
    )
)
    .setFontWeight('bold')
    .setHorizontalAlignment(
      options.titleAlignment ||
      'left'
    )
    .setVerticalAlignment(
      'middle'
    )
    .setWrap(true);

  /*
   * Value.
   */
  layout.value
    .setValue(
      specification.value
    )
    .setFontColor(
      options.valueColor ||
      theme.colors
        .text
        .primary
    )
    .setFontSize(
      Number(
        options.valueFontSize ||
        28
      )
    )
    .setFontWeight(
      options.valueFontWeight ||
      'bold'
    )
    .setHorizontalAlignment(
      options.valueAlignment ||
      'center'
    )
    .setVerticalAlignment(
      'middle'
    )
    .setWrap(true);

  /*
   * Subtitle.
   */
  layout.subtitle
    .setValue(
      specification.subtitle || ''
    )
    .setFontColor(
      options.subtitleColor ||
      theme.colors
        .text
        .secondary
    )
    .setFontSize(
      Number(
        options.subtitleFontSize ||
        theme.typography
          .styles
          .bodySmall
          .fontSize
      )
    )
    .setFontWeight('normal')
    .setHorizontalAlignment(
      options.subtitleAlignment ||
      'left'
    )
    .setVerticalAlignment(
      'middle'
    )
    .setWrap(true);

  /*
   * Footer: trend + status.
   */
  const footerText =
    aerpBuildDashboardKpiFooterText_(
      specification
    );

  layout.footer
    .setValue(
      footerText
    )
    .setFontColor(
      aerpResolveDashboardKpiFooterColor_(
        specification,
        theme
      )
    )
    .setFontSize(
      Number(
        options.footerFontSize ||
        theme.typography
          .styles
          .caption
          .fontSize
      )
    )
    .setFontWeight('bold')
    .setHorizontalAlignment(
      options.footerAlignment ||
      'left'
    )
    .setVerticalAlignment(
      'middle'
    )
    .setWrap(true);

  /*
   * Disabled state.
   */
  if (
    specification.enabled === false
  ) {
    layout.source
      .setBackground(
        theme.colors
          .surface
          .disabled
      )
      .setFontColor(
        theme.colors
          .text
          .disabled
      );
  }

  return layout.source;
}


/* ============================================================
 * 3. PRIVATE HELPERS
 * ============================================================
 */
/**
 * Creates the internal KPI regions from a target range.
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {string} rangeA1 Target range.
 * @return {Object} Calculated KPI regions.
 * @private
 */
function aerpCreateDashboardKpiLayout_(
  sheet,
  rangeA1
) {
  if (!sheet) {
    throw new Error(
      '[AERP-032] A valid sheet is required.'
    );
  }

  const targetRange =
    sheet.getRange(
      String(rangeA1 || '').trim()
    );

  targetRange.breakApart();
  targetRange.clear();

  const startRow =
    targetRange.getRow();

  const startColumn =
    targetRange.getColumn();

  const rowCount =
    targetRange.getNumRows();

  const columnCount =
    targetRange.getNumColumns();

  const layout =
    AERP_DASHBOARD_KPI_LAYOUT;

  if (
    rowCount <
    layout.minimumRows
  ) {
    throw new Error(
      '[AERP-032] KPI range requires at least ' +
      layout.minimumRows +
      ' rows.'
    );
  }

  const titleRows =
    layout.titleRows;

  const subtitleRows =
    layout.subtitleRows;

  const footerRows =
    layout.footerRows;

  const valueRows =
    rowCount -
    titleRows -
    subtitleRows -
    footerRows;

  if (valueRows < 1) {
    throw new Error(
      '[AERP-032] KPI range does not have enough rows.'
    );
  }

  const titleRange =
    sheet.getRange(
      startRow,
      startColumn,
      titleRows,
      columnCount
    );

  const valueRange =
    sheet.getRange(
      startRow + titleRows,
      startColumn,
      valueRows,
      columnCount
    );

  const subtitleRange =
    sheet.getRange(
      startRow +
      titleRows +
      valueRows,
      startColumn,
      subtitleRows,
      columnCount
    );

  const footerRange =
    sheet.getRange(
      startRow +
      titleRows +
      valueRows +
      subtitleRows,
      startColumn,
      footerRows,
      columnCount
    );

  titleRange.merge();
  valueRange.merge();
  subtitleRange.merge();
  footerRange.merge();

  return {
    source: targetRange,
    title: titleRange,
    value: valueRange,
    subtitle: subtitleRange,
    footer: footerRange,

    geometry: {
      startRow: startRow,
      startColumn: startColumn,
      rows: rowCount,
      columns: columnCount,
      titleRows: titleRows,
      valueRows: valueRows,
      subtitleRows: subtitleRows,
      footerRows: footerRows
    }
  };
}

/**
 * Normalizes the KPI trend direction.
 *
 * Supported values:
 * - up
 * - down
 * - neutral
 *
 * @param {*} value Trend direction.
 * @return {string} Normalized direction.
 * @private
 */
/**
 * Builds the KPI footer text.
 *
 * @param {Object} specification KPI specification.
 * @return {string} Footer text.
 * @private
 */
function aerpBuildDashboardKpiFooterText_(
  specification
) {
  const parts = [];

  const trend =
    String(
      specification.trend || ''
    ).trim();

  const status =
    String(
      specification.status || ''
    ).trim();

  if (trend) {
    let trendIcon = '•';

    if (
      specification.trendDirection === 'up'
    ) {
      trendIcon = '▲';
    }

    if (
      specification.trendDirection === 'down'
    ) {
      trendIcon = '▼';
    }

    parts.push(
      trendIcon + ' ' + trend
    );
  }

 parts.push(
  'Actualizado'
);

  return parts.join('     ');
}


/**
 * Resolves the KPI footer color.
 *
 * @param {Object} specification KPI specification.
 * @param {Object} theme UI Theme.
 * @return {string} Footer color.
 * @private
 */
function aerpResolveDashboardKpiFooterColor_(
  specification,
  theme
) {
  if (
    specification.trendDirection === 'up'
  ) {
    return theme.colors
      .semantic
      .success;
  }

  if (
    specification.trendDirection === 'down'
  ) {
    return theme.colors
      .semantic
      .error;
  }

  return theme.colors
    .text
    .secondary;
}
function aerpNormalizeDashboardKpiTrendDirection_(
  value
) {
  const normalized =
    String(value || 'neutral')
      .trim()
      .toLowerCase();

  if (
    ['up', 'down', 'neutral']
      .indexOf(normalized) === -1
  ) {
    return 'neutral';
  }

  return normalized;
}


/* ============================================================
 * 4. VALIDATION
 * ============================================================
 */

/**
 * Validates AERP-032 dependencies.
 *
 * @return {Object} Validation result.
 */
function aerpValidateDashboardKpi_() {
  const errors = [];

  const requiredFunctions = [
    'aerpCreateComponent',
    'aerpRenderComponent',
    'aerpGetTheme'
  ];

  requiredFunctions.forEach(
    function(functionName) {
      try {
        const fn =
          eval(functionName);

        if (
          typeof fn !== 'function'
        ) {
          errors.push(
            'Función no disponible: ' +
            functionName
          );
        }

      } catch (error) {
        errors.push(
          'Función no disponible: ' +
          functionName
        );
      }
    }
  );

  return {
    ok:
      errors.length === 0,

    module:
      'AERP-032',

    version:
      AERP_DASHBOARD_KPI_VERSION,

    errors:
      errors
  };
}


/* ============================================================
 * 5. TEST
 * ============================================================
 */

/**
 * Tests the Dashboard KPI independently.
 *
 * Creates or replaces:
 * AERP_TEST_DASHBOARD_KPI
 *
 * @return {Object} Test result.
 */
function testDashboardKpi() {
  const validation =
    aerpValidateDashboardKpi_();

  if (!validation.ok) {
    throw new Error(
      '[AERP-032] Dependencias incompletas: ' +
      validation.errors.join(' | ')
    );
  }

  const ss =
    aerpGetSpreadsheet();

  const sheetName =
    'AERP_TEST_DASHBOARD_KPI';

  const previousSheet =
    ss.getSheetByName(
      sheetName
    );

  if (previousSheet) {
    ss.deleteSheet(
      previousSheet
    );

    SpreadsheetApp.flush();
  }

  const sheet =
    ss.insertSheet(
      sheetName
    );

  aerpEnsureSheetSize_(
    sheet,
    12,
    12
  );

  sheet.setHiddenGridlines(
    true
  );

  sheet.setColumnWidths(
    1,
    11,
    95
  );

 sheet.setRowHeights(
  1,
  8,
  32
);

  const specification =
    aerpCreateDashboardKpiSpecification({
      id:
        'test-dashboard-kpi',

      icon:
        '📄',

      title:
        'TABLAS',

      value:
        23,

      subtitle:
        'Tablas registradas',

      trend:
        '+2',

      trendDirection:
        'up',

      status:
        'OK',

      options: {
        valueFontSize: 28
      }
    });

  const renderedRange =
    aerpRenderDashboardKpi(
      sheet,
      'A1:E8',
      specification
    );

  SpreadsheetApp.flush();

  const displayText =
    sheet
      .getRange('A1:E8')
      .getDisplayValues()
      .flat()
      .join(' ');

  const tests = {
    validationPassed:
      validation.ok === true,

    sheetCreated:
      Boolean(sheet),

    specificationCreated:
      specification.title ===
        'TABLAS' &&
      specification.value ===
        '23',

    trendNormalized:
      specification
        .trendDirection ===
      'up',

    rangeRendered:
      Boolean(renderedRange),

    titleRendered:
      displayText.indexOf(
        'TABLAS'
      ) !== -1,

    valueRendered:
      displayText.indexOf(
        '23'
      ) !== -1,

    subtitleRendered:
      displayText.indexOf(
        'Tablas registradas'
      ) !== -1,

          trendRendered:
      displayText.indexOf(
        '+2'
      ) !== -1,

    statusRendered:
      displayText.indexOf(
        'OK'
      ) !== -1
  };

  const testValues =
    Object.keys(
      tests
    ).map(function(testName) {
      return tests[testName];
    });

  const result = {
    ok:
      testValues.every(function(value) {
        return value === true;
      }),

    module:
      'AERP-032',

    version:
      AERP_DASHBOARD_KPI_VERSION,

    phase:
      'KPI Foundation',

    sheet:
      sheetName,

    tests:
      tests,

    errors:
      []
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  if (!result.ok) {
    throw new Error(
      'Dashboard KPI no superó todas las pruebas.'
    );
  }

  return result;
}

