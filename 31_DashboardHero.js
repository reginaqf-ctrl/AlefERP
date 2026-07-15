// @ts-nocheck
/**
 * ============================================================
 * ALEF ERP
 * Enterprise Dashboard Hero
 * ------------------------------------------------------------
 * Module : AERP-031
 * Name   : Dashboard Hero
 * Version: 1.0.0
 * Status : Phase 1 - Hero Foundation
 * ------------------------------------------------------------
 * Description:
 * Renders the official Enterprise Hero section for the
 * Alef ERP Dashboard.
 *
 * Public API:
 * - aerpRenderDashboardHero(sheet, heroSpecification)
 * - aerpCreateDashboardHeroSpecification(metrics)
 * - testDashboardHero()
 *
 * Dependencies:
 * - AERP-023 Commercial Dashboard metrics
 * - AERP-027 UI Theme
 * - AERP-030 Dashboard Enterprise layout
 * ============================================================
 */


/* ============================================================
 * 1. MODULE CONSTANTS
 * ============================================================
 */

const AERP_DASHBOARD_HERO_VERSION =
  '1.0.0';


/* ============================================================
 * 2. PUBLIC API
 * ============================================================
 */

/**
 * Creates the declarative Hero specification.
 *
 * @param {Object} metrics Commercial Dashboard metrics.
 * @return {Object} Hero specification.
 */
function aerpCreateDashboardHeroSpecification(
  metrics
) {
  if (
    !metrics ||
    typeof metrics !== 'object'
  ) {
    throw new Error(
      '[AERP-031] Dashboard metrics are required.'
    );
  }

  const successfulBuild =
    String(metrics.status || '')
      .toUpperCase() ===
    'BUILD EXITOSO';

  return {
    id: 'enterprise-dashboard-hero',

    product:
      AERP_BRAND.PRODUCT,

    edition:
      AERP_BRAND.EDITION,

    engine:
      AERP_BRAND.ENGINE_NAME,

    status:
      metrics.status,

    statusLabel:
  successfulBuild
    ? 'BUILD OK'
    : 'BUILD ERROR',

   statusIcon:
  successfulBuild
    ? '🟢'
    : '⚠️',

    tables:
      metrics.tables,

    columns:
      metrics.columns,

    duration:
      aerpFormatDuration_(
        metrics.durationMs
      ),

    buildId:
      metrics.buildId ||
      'No disponible',

    lastBuild:
      aerpFormatDashboardDate_(
        metrics.lastBuildDate
      )
  };
}


/**
 * Renders the Enterprise Hero section.
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {Object} hero Hero specification.
 * @return {Object} Rendered ranges.
 */
function aerpRenderDashboardHero(
  sheet,
  hero
) {
  if (!sheet) {
    throw new Error(
      '[AERP-031] A valid sheet is required.'
    );
  }

  if (
    !hero ||
    typeof hero !== 'object'
  ) {
    throw new Error(
      '[AERP-031] Hero specification is required.'
    );
  }

  const theme =
    aerpGetTheme();

  const layout =
    aerpGetDashboardHeroLayout_();

  /*
   * Main surface.
   */
  const heroRange =
    sheet.getRange(
      layout.surface
    );

  heroRange.breakApart();
  heroRange.clear();

  /*
   * Title region.
   */
  const titleRange =
    sheet.getRange(
      layout.title
    );

  titleRange.merge();

  titleRange
    .setValue(
      hero.product +
      ' Enterprise'
    )
    .setBackground(
      theme.colors
        .brand
        .secondary
    )
    .setFontColor(
      theme.colors
        .text
        .inverse
    )
    .setFontFamily(
      theme.typography
        .fontFamily
        .primary
    )
    .setFontSize(22)
    .setFontWeight('bold')
    .setHorizontalAlignment(
      'left'
    )
    .setVerticalAlignment(
      'middle'
    );

  /*
   * Subtitle region.
   */
  const subtitleRange =
    sheet.getRange(
      layout.subtitle
    );

  subtitleRange.merge();

  subtitleRange
    .setValue(
      hero.engine +
      ' | ' +
      hero.edition
    )
    .setBackground('#FFFFFF')
    
  .setFontColor(
    theme.colors
        .text
        .primary
)
    .setFontFamily(
      theme.typography
        .fontFamily
        .primary
    )
    .setFontSize(
      theme.typography
        .styles
        .bodyLarge
        .fontSize
    )
    .setFontWeight('bold')
    .setHorizontalAlignment(
      'left'
    )
    .setVerticalAlignment(
      'middle'
    );

  /*
   * Status region.
   */
  const statusRange =
    sheet.getRange(
      layout.status
    );

  statusRange.merge();

  statusRange
    .setValue(
      hero.statusIcon +
      ' ' +
      hero.statusLabel
    )
    .setBackground(
      theme.colors
        .brand
        .secondary
    )
    .setFontColor(
      hero.statusIcon === '✅'
        ? theme.colors
            .semantic
            .success
        : theme.colors
            .semantic
            .warning
    )
    .setFontFamily(
      theme.typography
        .fontFamily
        .primary
    )
    .setFontSize(
      theme.typography
        .styles
        .headingSmall
        .fontSize
    )
    .setFontWeight('bold')
    .setHorizontalAlignment(
      'right'
    )
    .setVerticalAlignment(
      'middle'
    );

  /*
   * Metrics strip.
   */
  const metricsRange =
    sheet.getRange(
      layout.metrics
    );

  metricsRange.merge();

  metricsRange
    .setValue(
      [
    '⚡ ' + hero.duration,

    '📄 ' + hero.tables + ' tablas',

    '🧩 ' + hero.columns + ' columnas'

].join('     •     ')
    )
    .setBackground('#EAF2FF')
    .setFontColor(
    theme.colors
        .text
        .primary
)
    .setFontFamily(
      theme.typography
        .fontFamily
        .primary
    )
    .setFontSize(
      theme.typography
        .styles
        .body
        .fontSize
    )
    .setFontWeight('bold')
    .setHorizontalAlignment(
      'center'
    )
    .setVerticalAlignment(
      'middle'
    );

  /*
   * Build information.
   */
  const buildRange =
  sheet.getRange(
    layout.build
  );

buildRange.merge();

buildRange
  .setValue(
    'Build ' +
    aerpFormatDashboardHeroDate_(
      hero.lastBuild
    )
  )
  .setBackground('#FFFFFF')
  .setFontColor(
    theme.colors
      .text
      .secondary
  )
  .setFontFamily(
    theme.typography
      .fontFamily
      .primary
  )
  .setFontSize(11)
  .setFontWeight('normal')
  .setHorizontalAlignment(
    'center'
  )
  .setVerticalAlignment(
    'middle'
  );

  /*
   * Outer border.
   */
  heroRange.setBorder(
    true,
    true,
    true,
    true,
    false,
    false,
    theme.colors
      .border
      .strong,
    SpreadsheetApp
      .BorderStyle
      .SOLID
  );

  return {
    surface: heroRange,
    title: titleRange,
    subtitle: subtitleRange,
    status: statusRange,
    metrics: metricsRange,
    build: buildRange
  };
}


/* ============================================================
 * 3. PRIVATE LAYOUT
 * ============================================================
 */

/**
 * Returns the compact Enterprise Hero layout.
 *
 * @return {Object} Hero ranges.
 * @private
 */
function aerpGetDashboardHeroLayout_() {
  return {
    surface: 'A1:K5',

    title: 'A1:G1',

    subtitle: 'A2:G2',

    status: 'H1:K2',

    metrics: 'A3:K4',

    build: 'A5:K5'
  };
}

/**
 * Formats the Hero Build date as:
 * 10 Jul 17:40
 *
 * @param {*} value Build date.
 * @return {string} Compact formatted date.
 * @private
 */
function aerpFormatDashboardHeroDate_(
  value
) {
  if (!value) {
    return 'No disponible';
  }

  const match =
    String(value).match(
      /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/
    );

  if (!match) {
    return String(value);
  }

  const monthNames = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic'
  ];

  const day =
    match[1];

  const monthIndex =
    Number(match[2]) - 1;

  const hour =
    match[4];

  const minute =
    match[5];

  return (
    day +
    ' ' +
    monthNames[monthIndex] +
    ' ' +
    hour +
    ':' +
    minute
  );
}

/* ============================================================
 * 4. VALIDATION
 * ============================================================
 */

/**
 * Validates AERP-031 dependencies.
 *
 * @return {Object} Validation result.
 */
function aerpValidateDashboardHero_() {
  const errors = [];

  const requiredFunctions = [
    'aerpGetTheme',
    'aerpGetCommercialDashboardMetrics_',
    'aerpFormatDuration_',
    'aerpFormatDashboardDate_'
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
      'AERP-031',

    version:
      AERP_DASHBOARD_HERO_VERSION,

    errors:
      errors
  };
}


/* ============================================================
 * 5. TEST
 * ============================================================
 */

/**
 * Tests the Enterprise Hero independently.
 *
 * Creates or replaces:
 * AERP_TEST_HERO
 *
 * @return {Object} Test result.
 */
function testDashboardHero() {
  const validation =
    aerpValidateDashboardHero_();

  if (!validation.ok) {
    throw new Error(
      '[AERP-031] Dependencias incompletas: ' +
      validation.errors.join(' | ')
    );
  }

  const ss =
    aerpGetSpreadsheet();

  const sheetName =
    'AERP_TEST_HERO';

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
  5,
  32
);

  const metrics =
    aerpGetCommercialDashboardMetrics_();

  const specification =
    aerpCreateDashboardHeroSpecification(
      metrics
    );

  const rendered =
    aerpRenderDashboardHero(
      sheet,
      specification
    );

  SpreadsheetApp.flush();

  const tests = {
    validationPassed:
      validation.ok === true,

    sheetCreated:
      Boolean(sheet),

    titleRendered:
      sheet
        .getRange('A1:G1')
        .getDisplayValue()
        .indexOf(
          AERP_BRAND.PRODUCT
        ) !== -1,

    metricsRendered:
      sheet
        .getRange('A3:K4')
        .getDisplayValue()
        .indexOf(
          String(metrics.tables)
        ) !== -1,

    buildRendered:
  sheet
    .getRange('A5:K5')
    .getDisplayValue()
    .indexOf(
      'Build '
    ) === 0,

    rangesReturned:
      Boolean(
        rendered &&
        rendered.surface &&
        rendered.title &&
        rendered.metrics
      )
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
      'AERP-031',

    version:
      AERP_DASHBOARD_HERO_VERSION,

    phase:
      'Hero Foundation',

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
      'Dashboard Hero no superó todas las pruebas.'
    );
  }

  return result;
}
