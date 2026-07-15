/**
 * ============================================================
 * Alef ERP
 * Enterprise Sheet Renderer
 * ------------------------------------------------------------
 * Module : AERP-029
 * Name   : Sheet Renderer
 * Version: 1.0.0
 * Status : Phase 2 - Layout Engine
 * ------------------------------------------------------------
 * Description:
 * Converts declarative UI components created by AERP-027
 * into visual components rendered in Google Sheets.
 *
 * Public API:
 *   - aerpRenderComponent(sheet, rangeA1, component, options)
 *   - aerpValidateRenderableComponent(component)
 *   - testAerpSheetRenderer()
 *
 * Dependencies:
 *   - AERP-026_UIComponents.gs
 *   - AERP-027_UITheme.gs
 * ============================================================
 */


/* ============================================================
 * 1. MODULE CONSTANTS
 * ============================================================
 */

const AERP_SHEET_RENDERER_VERSION = '1.0.0';


/**
 * Registered renderer handlers.
 *
 * The key follows:
 *
 * component.variant
 *
 * Example:
 *   card.kpi
 *
 * @type {Object}
 */
const AERP_SHEET_RENDERERS = {
  'card.kpi': aerpRenderKpiCard_
};


/* ============================================================
 * 2. PUBLIC API
 * ============================================================
 */

/**
 * Renders a declarative UI component in Google Sheets.
 *
 * Example:
 *
 * const component =
 *   aerpCreateComponent(
 *     'card',
 *     'kpi',
 *     {
 *       title: 'Ventas',
 *       value: '€58.240',
 *       icon: '📊'
 *     }
 *   );
 *
 * aerpRenderComponent(
 *   sheet,
 *   'A1:D5',
 *   component
 * );
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {string} rangeA1 Target range in A1 notation.
 * @param {Object} component Declarative component definition.
 * @param {Object=} options Rendering overrides.
 * @return {*} Rendered range.
 */
function aerpRenderComponent(
  sheet,
  rangeA1,
  component,
  options
) {
  aerpRendererRequireSheet_(sheet);

  const normalizedRange =
    aerpRendererNormalizeRange_(rangeA1);

  const validation =
    aerpValidateRenderableComponent(
      component
    );

  if (!validation.ok) {
    throw new Error(
      '[AERP-029] Invalid renderable component: ' +
      validation.errors.join(' | ')
    );
  }

  const rendererKey =
    component.component +
    '.' +
    component.variant;

  const renderer =
    AERP_SHEET_RENDERERS[
      rendererKey
    ];

  if (
    typeof renderer !== 'function'
  ) {
    throw new Error(
      '[AERP-029] Renderer not registered: ' +
      rendererKey
    );
  }

  const renderContext = {
    sheet: sheet,
    rangeA1: normalizedRange,
    component: component,
    preset: component.preset,
    properties: component.properties,
    state: component.state,
    options: options || {}
  };

  const renderedRange =
    renderer(
      renderContext
    );

  SpreadsheetApp.flush();

  return renderedRange;
}


/**
 * Validates whether a component can be rendered.
 *
 * @param {Object} component Declarative component.
 * @return {Object} Validation result.
 */
function aerpValidateRenderableComponent(
  component
) {
  const errors = [];

  if (
    component === null ||
    typeof component !== 'object' ||
    Array.isArray(component)
  ) {
    errors.push(
      'Component must be an object.'
    );

    return {
      ok: false,
      rendererKey: null,
      errors: errors
    };
  }

  if (
    typeof component.component !== 'string' ||
    component.component.trim() === ''
  ) {
    errors.push(
      'Component type is required.'
    );
  }

  if (
    typeof component.variant !== 'string' ||
    component.variant.trim() === ''
  ) {
    errors.push(
      'Component variant is required.'
    );
  }

  if (
    component.preset === null ||
    typeof component.preset !== 'object'
  ) {
    errors.push(
      'Resolved component preset is required.'
    );
  }

  if (
    component.properties === null ||
    typeof component.properties !== 'object'
  ) {
    errors.push(
      'Component properties are required.'
    );
  }

  if (
    component.state === null ||
    typeof component.state !== 'object'
  ) {
    errors.push(
      'Component state is required.'
    );
  }

  const rendererKey =
    (
      component.component &&
      component.variant
    )
      ? component.component +
        '.' +
        component.variant
      : null;

  if (
    rendererKey &&
    typeof AERP_SHEET_RENDERERS[
      rendererKey
    ] !== 'function'
  ) {
    errors.push(
      'No renderer registered for: ' +
      rendererKey
    );
  }

  return {
    ok: errors.length === 0,
    rendererKey: rendererKey,
    errors: errors
  };
}


/* ============================================================
 * 3. KPI CARD RENDERER
 * ============================================================
 */

/**
 * Renders a KPI Card.
 *
 * @param {Object} context Rendering context.
 * @return {*} Rendered range.
 * @private
 */
/**
 * Renders an Enterprise KPI Card using the Sheet Layout Engine.
 *
 * @param {Object} context Rendering context.
 * @return {*} Complete rendered card range.
 * @private
 */
function aerpRenderKpiCard_(
  context
) {
  const sheet =
    context.sheet;

  const preset =
    context.preset;

  const properties =
    context.properties || {};

  const state =
    context.state || {};

  const options =
    context.options || {};

  const layout =
    aerpCreateKpiLayout_(
      sheet,
      context.rangeA1
    );

  aerpApplyKpiLayoutContainer_(
    layout,
    preset.container,
    options
  );

  /*
   * Invisible components preserve their geometry but do not
   * render visible content.
   */
  if (
    state.visible === false
  ) {
    layout.source.clearContent();

    return layout.source;
  }

  /*
   * Loading state occupies the body region.
   */
  if (
    state.loading === true
  ) {
    layout.header.clearContent();
    layout.footer.clearContent();

    layout.body
      .setValue(
        String(
          options.loadingText ||
          'Cargando...'
        )
      );

    aerpApplyLayoutTextStyle_(
      layout.body,
      preset.subtitle,
      {
        horizontalAlignment:
          'center'
      }
    );

    return layout.source;
  }

  const icon =
    aerpRendererText_(
      properties.icon
    );

  const title =
    aerpRendererText_(
      properties.title
    );

  const value =
    aerpRendererText_(
      properties.value
    );

  const subtitle =
    aerpRendererText_(
      properties.subtitle
    );

  const headerText =
    [icon, title]
      .filter(function(item) {
        return item !== '';
      })
      .join(' ');

  layout.header
    .setValue(
      headerText
    );

  layout.body
    .setValue(
      value
    );

  layout.footer
    .setValue(
      subtitle
    );

  aerpApplyLayoutTextStyle_(
    layout.header,
    preset.label,
    {
      fontSize:
        options.titleFontSize,

      textColor:
        options.titleColor,

      horizontalAlignment:
        options.headerAlignment ||
        'left'
    }
  );

  aerpApplyLayoutTextStyle_(
    layout.body,
    preset.value,
    {
      fontSize:
        options.valueFontSize ||
        options.fontSize,

      textColor:
        options.valueColor ||
        options.textColor,

      fontWeight:
        options.valueFontWeight ||
        'bold',

      horizontalAlignment:
        options.valueAlignment ||
        'center'
    }
  );

  aerpApplyLayoutTextStyle_(
    layout.footer,
    preset.subtitle,
    {
      fontSize:
        options.subtitleFontSize,

      textColor:
        options.subtitleColor,

      horizontalAlignment:
        options.footerAlignment ||
        'left'
    }
  );

  /*
   * Disabled state.
   */
  if (
    state.enabled === false
  ) {
    const theme =
      aerpGetTheme();

    layout.source
      .setBackground(
        options.disabledBackground ||
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


/**
 * Builds the visible KPI text.
 *
 * @param {Object} properties Component properties.
 * @param {Object} state Component state.
 * @param {Object} options Rendering options.
 * @return {string} Visible content.
 * @private
 */
function aerpRendererBuildKpiContent_(
  properties,
  state,
  options
) {
  if (
    state.visible === false
  ) {
    return '';
  }

  if (
    state.loading === true
  ) {
    return String(
      options.loadingText ||
      'Cargando...'
    );
  }

  const lines = [];

  const icon =
    aerpRendererText_(
      properties.icon
    );

  const title =
    aerpRendererText_(
      properties.title
    );

  const value =
    aerpRendererText_(
      properties.value
    );

  const subtitle =
    aerpRendererText_(
      properties.subtitle
    );

  const heading =
    [
      icon,
      title
    ]
      .filter(function(item) {
        return item !== '';
      })
      .join(' ');

  if (heading) {
    lines.push(heading);
  }

  if (value) {
    if (lines.length > 0) {
      lines.push('');
    }

    lines.push(value);
  }

  if (subtitle) {
    lines.push('');
    lines.push(subtitle);
  }

  return lines.join('\n');
}

/* ============================================================
 * 4. SHEET LAYOUT ENGINE
 * ============================================================
 */

/**
 * Creates the internal regions used by an Enterprise KPI Card.
 *
 * The target range is divided vertically into:
 *
 *   header
 *   body
 *   footer
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {string} rangeA1 Target range.
 * @return {Object} KPI layout regions.
 * @private
 */
function aerpCreateKpiLayout_(
  sheet,
  rangeA1
) {
  aerpRendererRequireSheet_(
    sheet
  );

  const normalizedRange =
    aerpRendererNormalizeRange_(
      rangeA1
    );

  const sourceRange =
    sheet.getRange(
      normalizedRange
    );

  sourceRange.breakApart();
  sourceRange.clear();

  const startRow =
    sourceRange.getRow();

  const startColumn =
    sourceRange.getColumn();

  const rowCount =
    sourceRange.getNumRows();

  const columnCount =
    sourceRange.getNumColumns();

  if (rowCount < 3) {
    throw new Error(
      '[AERP-029] KPI layout requires at least 3 rows.'
    );
  }

  /*
   * Layout distribution:
   *
   * Header: approximately 25 %
   * Body:   approximately 50 %
   * Footer: remaining rows
   */
  const headerRows =
    Math.max(
      1,
      Math.floor(
        rowCount * 0.25
      )
    );

  const footerRows =
    Math.max(
      1,
      Math.floor(
        rowCount * 0.25
      )
    );

  const bodyRows =
    rowCount -
    headerRows -
    footerRows;

  if (bodyRows < 1) {
    throw new Error(
      '[AERP-029] KPI layout does not have enough rows for its body.'
    );
  }

  const headerRange =
    sheet.getRange(
      startRow,
      startColumn,
      headerRows,
      columnCount
    );

  const bodyRange =
    sheet.getRange(
      startRow + headerRows,
      startColumn,
      bodyRows,
      columnCount
    );

  const footerRange =
    sheet.getRange(
      startRow +
      headerRows +
      bodyRows,
      startColumn,
      footerRows,
      columnCount
    );

  headerRange.merge();
  bodyRange.merge();
  footerRange.merge();

  return {
    source: sourceRange,
    header: headerRange,
    body: bodyRange,
    footer: footerRange,

    geometry: {
      startRow: startRow,
      startColumn: startColumn,
      rows: rowCount,
      columns: columnCount,
      headerRows: headerRows,
      bodyRows: bodyRows,
      footerRows: footerRows
    }
  };
}


/**
 * Applies the shared card surface to every KPI layout region.
 *
 * Outer borders are applied to the complete card.
 * Internal regions share the same background.
 *
 * @param {Object} layout KPI layout.
 * @param {Object=} container Container preset.
 * @param {Object=} options Rendering overrides.
 * @return {Object} Styled layout.
 * @private
 */
function aerpApplyKpiLayoutContainer_(
  layout,
  container,
  options
) {
  const preset =
    container || {};

  const config =
    options || {};

  const background =
    config.background ||
    preset.background ||
    '#FFFFFF';

  const borderColor =
    config.borderColor ||
    preset.borderColor ||
    '#E2E8F0';

  const borderWidth =
    Number(
      config.borderWidth ||
      preset.borderWidth ||
      1
    );

  const borderStyle =
    aerpRendererResolveBorderStyle_(
      config.borderStyle ||
      preset.borderStyle ||
      'solid',

      borderWidth
    );

  layout.source
    .setBackground(
      background
    )
    .setBorder(
      true,
      true,
      true,
      true,
      false,
      false,
      borderColor,
      borderStyle
    );

  return layout;
}


/**
 * Applies typography directly to a layout region.
 *
 * @param {*} range Google Sheets range.
 * @param {Object=} textPreset Resolved text preset.
 * @param {Object=} overrides Rendering overrides.
 * @return {*} Styled range.
 * @private
 */
function aerpApplyLayoutTextStyle_(
  range,
  textPreset,
  overrides
) {
  const preset =
    textPreset || {};

  const config =
    overrides || {};

  const typography =
    preset.typography || {};

  const theme =
    aerpGetTheme();

  range
    .setFontFamily(
      config.fontFamily ||
      theme.typography
        .fontFamily
        .primary
    )
    .setFontSize(
      Number(
        config.fontSize ||
        typography.fontSize ||
        theme.typography
          .fontSize
          .md
      )
    )
    .setFontWeight(
      config.fontWeight ||
      aerpRendererNormalizeFontWeight_(
        typography.fontWeight
      )
    )
    .setFontColor(
      config.textColor ||
      preset.color ||
      theme.colors
        .text
        .primary
    )
    .setWrap(true)
    .setVerticalAlignment(
      config.verticalAlignment ||
      'middle'
    )
    .setHorizontalAlignment(
      config.horizontalAlignment ||
      'center'
    );

  return range;
}

/* ============================================================
 * 5. STYLE APPLICATION
 * ============================================================
 */

/**
 * Applies container styles.
 *
 * @param {*} range Google Sheets range.
 * @param {Object=} container Container preset.
 * @param {Object=} options Rendering overrides.
 * @return {*} Styled range.
 * @private
 */
function aerpRendererApplyContainer_(
  range,
  container,
  options
) {
  const preset =
    container || {};

  const config =
    options || {};

  const background =
    config.background ||
    preset.background ||
    '#FFFFFF';

  const borderColor =
    config.borderColor ||
    preset.borderColor ||
    '#E2E8F0';

  const borderWidth =
    Number(
      config.borderWidth ||
      preset.borderWidth ||
      1
    );

  const borderStyle =
    config.borderStyle ||
    preset.borderStyle ||
    'solid';

  range.setBackground(
    background
  );

  range.setBorder(
    true,
    true,
    true,
    true,
    false,
    false,
    borderColor,
    aerpRendererResolveBorderStyle_(
      borderStyle,
      borderWidth
    )
  );

  return range;
}


/**
 * Applies typography from the resolved preset.
 *
 * @param {*} range Google Sheets range.
 * @param {Object=} textPreset Resolved text preset.
 * @param {Object=} options Rendering overrides.
 * @return {*} Styled range.
 * @private
 */
function aerpRendererApplyTypography_(
  range,
  textPreset,
  options
) {
  const preset =
    textPreset || {};

  const config =
    options || {};

  const typography =
    preset.typography || {};

  const theme =
    aerpGetTheme();

  const fontFamily =
    config.fontFamily ||
    theme.typography
      .fontFamily
      .primary;

  const fontSize =
    Number(
      config.fontSize ||
      typography.fontSize ||
      theme.typography
        .fontSize
        .md
    );

  const fontWeight =
    config.fontWeight ||
    aerpRendererNormalizeFontWeight_(
      typography.fontWeight
    );

  const fontColor =
    config.textColor ||
    preset.color ||
    theme.colors
      .text
      .primary;

  range
    .setFontFamily(
      fontFamily
    )
    .setFontSize(
      fontSize
    )
    .setFontWeight(
      fontWeight
    )
    .setFontColor(
      fontColor
    );

  return range;
}


/**
 * Applies component state styling.
 *
 * @param {*} range Google Sheets range.
 * @param {Object} state Component state.
 * @param {Object=} options Rendering options.
 * @return {*} Styled range.
 * @private
 */
function aerpRendererApplyKpiState_(
  range,
  state,
  options
) {
  const componentState =
    state || {};

  const config =
    options || {};

  if (
    componentState.enabled === false
  ) {
    const theme =
      aerpGetTheme();

    range
      .setFontColor(
        theme.colors
          .text
          .disabled
      )
      .setBackground(
        config.disabledBackground ||
        theme.colors
          .surface
          .disabled
      );
  }

  return range;
}


/* ============================================================
 * 6. PRIVATE HELPERS
 * ============================================================
 */

/**
 * Requires a valid sheet.
 *
 * @param {*} sheet Google Sheets sheet.
 * @return {*} Valid sheet.
 * @private
 */
function aerpRendererRequireSheet_(
  sheet
) {
  if (!sheet) {
    throw new Error(
      '[AERP-029] A valid sheet is required.'
    );
  }

  return sheet;
}


/**
 * Normalizes a range in A1 notation.
 *
 * @param {*} rangeA1 Range value.
 * @return {string} Normalized range.
 * @private
 */
function aerpRendererNormalizeRange_(
  rangeA1
) {
  const normalizedRange =
    String(rangeA1 || '')
      .trim();

  if (!normalizedRange) {
    throw new Error(
      '[AERP-029] A valid A1 range is required.'
    );
  }

  return normalizedRange;
}


/**
 * Clears, separates and merges a target range.
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {string} rangeA1 Target range.
 * @return {*} Prepared range.
 * @private
 */
function aerpRendererPrepareRange_(
  sheet,
  rangeA1
) {
  const range =
    sheet.getRange(
      rangeA1
    );

  range.breakApart();
  range.clear();
  range.merge();

  return range;
}


/**
 * Converts any value to visible text.
 *
 * @param {*} value Value.
 * @return {string} Text.
 * @private
 */
function aerpRendererText_(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value);
}


/**
 * Converts a numeric font weight into a value supported by
 * Google Sheets.
 *
 * @param {*} fontWeight Font weight.
 * @return {string} normal or bold.
 * @private
 */
function aerpRendererNormalizeFontWeight_(
  fontWeight
) {
  return Number(fontWeight) >= 600
    ? 'bold'
    : 'normal';
}


/**
 * Converts semantic border values to Google Sheets styles.
 *
 * @param {string} borderStyle Border style.
 * @param {number} borderWidth Border width.
 * @return {*} SpreadsheetApp.BorderStyle.
 * @private
 */
function aerpRendererResolveBorderStyle_(
  borderStyle,
  borderWidth
) {
  const normalizedStyle =
    String(
      borderStyle || 'solid'
    ).toLowerCase();

  const normalizedWidth =
    Number(
      borderWidth || 1
    );

  if (
    normalizedStyle === 'dashed'
  ) {
    return SpreadsheetApp
      .BorderStyle
      .DASHED;
  }

  if (
    normalizedStyle === 'dotted'
  ) {
    return SpreadsheetApp
      .BorderStyle
      .DOTTED;
  }

  if (
    normalizedWidth >= 2
  ) {
    return SpreadsheetApp
      .BorderStyle
      .SOLID_MEDIUM;
  }

  return SpreadsheetApp
    .BorderStyle
    .SOLID;
}


/* ============================================================
 * 7. TESTS
 * ============================================================
 */

/**
 * Tests the AERP-029 Sheet Renderer.
 *
 * Creates or replaces:
 *   AERP_TEST_RENDERER
 *
 * @return {Object} Test result.
 */
function testAerpSheetRenderer() {
  const result = {
    ok: false,
    module: 'AERP-029',
    phase: 'Phase 2 - Layout Engine',
    version:
      AERP_SHEET_RENDERER_VERSION,

    tests: {
      factoryAvailable: false,
      rendererRegistered: false,
      componentCreated: false,
      validationPassed: false,
      sheetCreated: false,
      rangeRendered: false,
      contentRendered: false,
      backgroundApplied: false,
      typographyApplied: false,
      customOptionsApplied: false,
      invalidRendererRejected: false
    },

    sheet: null,
    errors: []
  };

  try {
    result.tests.factoryAvailable =
      typeof aerpCreateComponent ===
      'function';

    result.tests.rendererRegistered =
      typeof AERP_SHEET_RENDERERS[
        'card.kpi'
      ] === 'function';

    const component =
      aerpCreateComponent(
        'card',
        'kpi',
        {
          id: 'renderer-test-kpi',
          icon: '📊',
          title: 'VENTAS DEL MES',
          value: '€58.240',
          subtitle:
            'Facturación acumulada'
        }
      );

    result.tests.componentCreated =
      component.component === 'card' &&
      component.variant === 'kpi';

    const validation =
      aerpValidateRenderableComponent(
        component
      );

    result.tests.validationPassed =
      validation.ok === true;

    const ss =
      aerpGetSpreadsheet();

    const sheetName =
      'AERP_TEST_RENDERER';

    const existingSheet =
      ss.getSheetByName(
        sheetName
      );

    if (existingSheet) {
      ss.deleteSheet(
        existingSheet
      );

      SpreadsheetApp.flush();
    }

    const sheet =
      ss.insertSheet(
        sheetName
      );

    result.sheet =
      sheetName;

    result.tests.sheetCreated =
      Boolean(sheet);

    sheet.setColumnWidths(
      1,
      8,
      110
    );

   sheet.setRowHeights(
  1,
  12,
  32
);

    const renderedRange =
      aerpRenderComponent(
        sheet,
        'A1:D6',
        component
      );

    result.tests.rangeRendered =
      Boolean(renderedRange);

 const mainHeaderRange =
  sheet.getRange(
    'A1:D1'
  );

const mainBodyRange =
  sheet.getRange(
    'A2:D5'
  );

const mainFooterRange =
  sheet.getRange(
    'A6:D6'
  );

result.tests.contentRendered =
  mainHeaderRange
    .getDisplayValue()
    .indexOf(
      'VENTAS DEL MES'
    ) !== -1 &&

  mainBodyRange
    .getDisplayValue()
    .indexOf(
      '€58.240'
    ) !== -1 &&

  mainFooterRange
    .getDisplayValue()
    .indexOf(
      'Facturación acumulada'
    ) !== -1;

    Logger.log(
  'Theme background: ' +
  component.preset.container.background
);

Logger.log(
  'Sheet background: ' +
  renderedRange.getBackground()
);

result.tests.backgroundApplied =
  renderedRange
    .getBackground()
    .toLowerCase() ===
  component.preset
    .container
    .background
    .toLowerCase();



result.tests.typographyApplied =
  mainBodyRange
    .getFontSize() ===
  component.preset
    .value
    .typography
    .fontSize;

    const customComponent =
      aerpCreateComponent(
        'card',
        'kpi',
        {
          id: 'renderer-custom-kpi',
          icon: '📦',
          title: 'INVENTARIO',
          value: '1.248'
        }
      );

    const customRange =
      aerpRenderComponent(
        sheet,
        'F1:H6',
        customComponent,
        {
          background: '#FFFFFF',
          textColor: '#0F172A',
          fontSize: 18,
          borderWidth: 2
        }
      );

 const customBodyRange =
  sheet.getRange(
    'F2:H5'
  );

result.tests.customOptionsApplied =
  customRange
    .getBackground()
    .toLowerCase() ===
    '#ffffff' &&

  customBodyRange
    .getFontColor()
    .toLowerCase() ===
    '#0f172a' &&

  customBodyRange
    .getFontSize() ===
    18;

  } catch (error) {
    result.errors.push(
      error && error.message
        ? error.message
        : String(error)
    );
  }

  try {
    const invalidComponent = {
      component: 'table',
      variant: 'enterprise',
      preset: {},
      properties: {},
      state: {}
    };

    aerpRenderComponent(
      SpreadsheetApp
        .getActiveSpreadsheet()
        .getActiveSheet(),
      'J1:L4',
      invalidComponent
    );

  } catch (error) {
    result.tests.invalidRendererRejected =
      true;
  }

  const testValues =
    Object.keys(
      result.tests
    ).map(function(testName) {
      return result.tests[
        testName
      ];
    });

  result.ok =
    result.errors.length === 0 &&
    testValues.every(function(value) {
      return value === true;
    });

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}
