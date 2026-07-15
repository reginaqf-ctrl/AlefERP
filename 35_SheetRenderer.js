/**
 * ============================================================
 * ALEF PLATFORM
 * Enterprise Sheet Renderer
 * ------------------------------------------------------------
 * Module : AERP-035
 * Name   : Sheet Renderer
 * Version: 1.0.0
 * Status : Phase 1 - Renderer Foundation
 * ------------------------------------------------------------
 * Description:
 * Renders calculated Alef Platform layouts into Google Sheets.
 *
 * Responsibilities:
 * - Receive a calculated Layout Engine result.
 * - Iterate through calculated placements.
 * - Resolve the renderer assigned to each component type.
 * - Render each component into its calculated A1 range.
 * - Return a complete rendering report.
 *
 * This module does not:
 * - Calculate component positions.
 * - Modify placement coordinates.
 * - Define visual component styles.
 * - Create component specifications.
 *
 * Public API:
 * - aerpRenderDashboardLayout(sheet, layoutResult, options)
 * - aerpRenderLayoutPlacement(sheet, placement, options)
 * - aerpValidateSheetRendererDependencies()
 *
 * Dependencies:
 * - AERP-027 UI Theme
 * - AERP-029 Base Sheet Renderer
 * - AERP-031 Dashboard Hero
 * - AERP-032 Dashboard KPI
 * - AERP-033 Layout Engine
 * ============================================================
 */


/* ============================================================
 * 1. MODULE CONSTANTS
 * ============================================================
 */

const AERP_LAYOUT_SHEET_RENDERER_VERSION =
  '1.0.0';


const AERP_SHEET_RENDERER_DEFAULT = {
  clearBeforeRender: true,
  activateSheet: true,
  flushAfterRender: true,
  stopOnError: true
};


/**
 * Renderer registry.
 *
 * The registry maps Layout Engine component types to their
 * official rendering functions.
 *
 * Additional component renderers may be registered later
 * without changing the public rendering API.
 */
const AERP_SHEET_RENDERER_REGISTRY = {
  hero: {
    renderer:
      'aerpRenderDashboardHero',

    specificationFactory:
      'aerpCreateDashboardHeroSpecification'
  },

  kpi: {
    renderer:
      'aerpRenderDashboardKpi',

    specificationFactory:
      'aerpCreateDashboardKpiSpecification'
  }
};

/* ============================================================
 * 2. PUBLIC API
 * ============================================================
 */

/**
 * Renders a complete calculated Dashboard Layout.
 *
 * The Layout Engine must calculate all placements before this
 * function is called.
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {Object} layoutResult Calculated Layout result.
 * @param {Object=} options Optional rendering configuration.
 * @return {Object} Complete rendering report.
 */
function aerpRenderDashboardLayout(
  sheet,
  layoutResult,
  options
) {
  const renderOptions =
    aerpNormalizeSheetRendererOptions_(
      options
    );

  aerpRequireSheetRendererSheet_(
    sheet
  );

  aerpRequireCalculatedLayout_(
    layoutResult
  );

  const dependencyValidation =
    aerpValidateSheetRendererDependencies();

  if (!dependencyValidation.ok) {
    throw new Error(
      '[AERP-035] Renderer dependencies are incomplete: ' +
      dependencyValidation.errors.join(' | ')
    );
  }

  const report = {
    ok: false,

    module:
      'AERP-035',

    version:
      AERP_LAYOUT_SHEET_RENDERER_VERSION,

    layoutId:
      layoutResult.layoutId ||
      '',

    sheet:
      sheet.getName(),

    startedAt:
      new Date().toISOString(),

    completedAt:
      null,

    totalPlacements:
      layoutResult.placements.length,

    renderedCount:
      0,

    skippedCount:
      0,

    failedCount:
      0,

    placements: [],

    errors: []
  };

  try {
    if (
      renderOptions.clearBeforeRender ===
      true
    ) {
      aerpPrepareSheetForLayoutRender_(
        sheet,
        layoutResult,
        renderOptions
      );
    }

    layoutResult.placements.forEach(
      function(placement, index) {
        try {
          const placementReport =
            aerpRenderLayoutPlacement(
              sheet,
              placement,
              {
                placementIndex:
                  index,

                stopOnError:
                  renderOptions.stopOnError,

                parentOptions:
                  renderOptions
              }
            );

          report.placements.push(
            placementReport
          );

          if (
            placementReport.status ===
            'RENDERED'
          ) {
            report.renderedCount += 1;
          } else if (
            placementReport.status ===
            'SKIPPED'
          ) {
            report.skippedCount += 1;
          } else {
            report.failedCount += 1;
          }

        } catch (error) {
          const message =
            error &&
            error.message
              ? error.message
              : String(error);

          report.failedCount += 1;

          report.errors.push(
            message
          );

          report.placements.push({
            ok: false,

            id:
              placement &&
              placement.id
                ? placement.id
                : (
                    'placement-' +
                    String(index + 1)
                  ),

            type:
              placement &&
              placement.type
                ? placement.type
                : 'unknown',

            rangeA1:
              placement &&
              placement.rangeA1
                ? placement.rangeA1
                : '',

            status:
              'FAILED',

            error:
              message
          });

          if (
            renderOptions.stopOnError ===
            true
          ) {
            throw error;
          }
        }
      }
    );

    if (
      renderOptions.activateSheet ===
      true
    ) {
      sheet.activate();
    }

    if (
      renderOptions.flushAfterRender ===
      true
    ) {
      SpreadsheetApp.flush();
    }

  } catch (error) {
    const message =
      error &&
      error.message
        ? error.message
        : String(error);

    if (
      report.errors.indexOf(
        message
      ) === -1
    ) {
      report.errors.push(
        message
      );
    }
  }

  report.completedAt =
    new Date().toISOString();

  report.ok =
    report.errors.length === 0 &&
    report.failedCount === 0 &&
    (
      report.renderedCount +
      report.skippedCount
    ) ===
      report.totalPlacements;

  if (
    !report.ok &&
    renderOptions.stopOnError ===
      true
  ) {
    throw new Error(
      '[AERP-035] Dashboard Layout rendering failed: ' +
      report.errors.join(' | ')
    );
  }

  return report;
}


/**
 * Renders one calculated Layout placement.
 *
 * The renderer is resolved from the official Renderer Registry
 * using placement.type.
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {Object} placement Calculated placement.
 * @param {Object=} options Optional rendering configuration.
 * @return {Object} Placement rendering report.
 */
function aerpRenderLayoutPlacement(
  sheet,
  placement,
  options
) {
  aerpRequireSheetRendererSheet_(
    sheet
  );

  aerpRequireLayoutPlacement_(
    placement
  );

  const renderOptions =
    aerpNormalizeSheetRendererOptions_(
      options
    );

  const report = {
    ok: false,

    id:
      placement.id,

    type:
      placement.type,

    rangeA1:
      placement.rangeA1,

    status:
      'PENDING',

    renderer:
      '',

    specificationFactory:
      '',

    startedAt:
      new Date().toISOString(),

    completedAt:
      null,

    error:
      null
  };

  /*
   * Disabled components should normally be removed by the
   * Layout Engine. This remains as a defensive safeguard.
   */
  if (
    placement.component &&
    placement.component.visible === false
  ) {
    report.ok =
      true;

    report.status =
      'SKIPPED';

    report.completedAt =
      new Date().toISOString();

    return report;
  }

  try {
    const registryEntry =
      aerpResolveSheetRendererEntry_(
        placement.type
      );

    report.renderer =
      registryEntry.renderer;

    report.specificationFactory =
      registryEntry.specificationFactory;

    const renderer =
      aerpResolveSheetRendererFunction_(
        registryEntry.renderer
      );

    const specification =
      aerpBuildPlacementSpecification_(
        placement,
        registryEntry
      );

    aerpInvokeLayoutRenderer_(
  renderer,
  registryEntry,
  sheet,
  placement,
  specification,
  renderOptions.parentOptions ||
  renderOptions
);

    report.ok =
      true;

    report.status =
      'RENDERED';

  } catch (error) {
    report.ok =
      false;

    report.status =
      'FAILED';

    report.error =
      error &&
      error.message
        ? error.message
        : String(error);

    if (
      renderOptions.stopOnError ===
      true
    ) {
      throw error;
    }
  }

  report.completedAt =
    new Date().toISOString();

  return report;
}


/**
 * Validates the Enterprise Sheet Renderer dependencies.
 *
 * @return {Object} Dependency validation result.
 */
function aerpValidateSheetRendererDependencies() {
  const errors = [];

  const requiredFunctions = [
    'aerpRenderDashboardHero',
    'aerpCreateDashboardHeroSpecification',
    'aerpRenderDashboardKpi',
    'aerpCreateDashboardKpiSpecification',
    'aerpCalculateDashboardLayout'
  ];

  requiredFunctions.forEach(
    function(functionName) {
      try {
        const resolvedFunction =
          eval(functionName);

        if (
          typeof resolvedFunction !==
          'function'
        ) {
          errors.push(
            'Function not available: ' +
            functionName
          );
        }

      } catch (error) {
        errors.push(
          'Function not available: ' +
          functionName
        );
      }
    }
  );

  Object.keys(
    AERP_SHEET_RENDERER_REGISTRY
  ).forEach(function(componentType) {
    const registryEntry =
      AERP_SHEET_RENDERER_REGISTRY[
        componentType
      ];

    if (
      !registryEntry ||
      typeof registryEntry !== 'object'
    ) {
      errors.push(
        'Invalid renderer registry entry: ' +
        componentType
      );

      return;
    }

    if (
      typeof registryEntry.renderer !==
        'string' ||
      registryEntry.renderer.trim() === ''
    ) {
      errors.push(
        'Renderer is required for type: ' +
        componentType
      );
    }

    if (
      typeof registryEntry
        .specificationFactory !==
        'string' ||
      registryEntry
        .specificationFactory
        .trim() === ''
    ) {
      errors.push(
        'Specification factory is required for type: ' +
        componentType
      );
    }
  });

  return {
    ok:
      errors.length === 0,

    module:
      'AERP-035',

    version:
      AERP_LAYOUT_SHEET_RENDERER_VERSION,

    registeredTypes:
      Object.keys(
        AERP_SHEET_RENDERER_REGISTRY
      ),

    errors:
      errors
  };
}

/* ============================================================
 * 3. PRIVATE HELPERS
 * ============================================================
 */

/**
 * Normalizes Sheet Renderer options.
 *
 * Unknown options are preserved so they may be forwarded to
 * individual component renderers.
 *
 * @param {*} options Rendering options.
 * @return {Object} Normalized options.
 * @private
 */
function aerpNormalizeSheetRendererOptions_(
  options
) {
  if (
    options !== undefined &&
    options !== null &&
    (
      typeof options !== 'object' ||
      Array.isArray(options)
    )
  ) {
    throw new Error(
      '[AERP-035] Renderer options must be an object.'
    );
  }

  const source =
    options || {};

  const normalized = {};

  Object.keys(source)
    .forEach(function(key) {
      normalized[key] =
        source[key];
    });

  normalized.clearBeforeRender =
    source.clearBeforeRender ===
      undefined
      ? AERP_SHEET_RENDERER_DEFAULT
          .clearBeforeRender
      : source.clearBeforeRender === true;

  normalized.activateSheet =
    source.activateSheet ===
      undefined
      ? AERP_SHEET_RENDERER_DEFAULT
          .activateSheet
      : source.activateSheet === true;

  normalized.flushAfterRender =
    source.flushAfterRender ===
      undefined
      ? AERP_SHEET_RENDERER_DEFAULT
          .flushAfterRender
      : source.flushAfterRender === true;

  normalized.stopOnError =
    source.stopOnError ===
      undefined
      ? AERP_SHEET_RENDERER_DEFAULT
          .stopOnError
      : source.stopOnError === true;

  return normalized;
}


/**
 * Requires a valid Google Sheets sheet.
 *
 * @param {*} sheet Sheet candidate.
 * @return {*} Valid sheet.
 * @private
 */
function aerpRequireSheetRendererSheet_(
  sheet
) {
  if (
    !sheet ||
    typeof sheet.getRange !==
      'function' ||
    typeof sheet.getName !==
      'function'
  ) {
    throw new Error(
      '[AERP-035] A valid Google Sheets sheet is required.'
    );
  }

  return sheet;
}


/**
 * Requires a valid calculated Layout result.
 *
 * @param {*} layoutResult Calculated Layout candidate.
 * @return {Object} Valid calculated Layout.
 * @private
 */
function aerpRequireCalculatedLayout_(
  layoutResult
) {
  if (
    !layoutResult ||
    typeof layoutResult !== 'object' ||
    Array.isArray(layoutResult)
  ) {
    throw new Error(
      '[AERP-035] A calculated Layout result is required.'
    );
  }

  if (
    layoutResult.ok !== true
  ) {
    throw new Error(
      '[AERP-035] Layout result must have ok:true.'
    );
  }

  if (
    !Array.isArray(
      layoutResult.placements
    )
  ) {
    throw new Error(
      '[AERP-035] Layout placements must be an array.'
    );
  }

  layoutResult.placements
    .forEach(function(placement, index) {
      try {
        aerpRequireLayoutPlacement_(
          placement
        );

      } catch (error) {
        throw new Error(
          '[AERP-035] Invalid placement at index ' +
          index +
          ': ' +
          (
            error &&
            error.message
              ? error.message
              : String(error)
          )
        );
      }
    });

  return layoutResult;
}


/**
 * Requires a valid calculated placement.
 *
 * @param {*} placement Placement candidate.
 * @return {Object} Valid placement.
 * @private
 */
function aerpRequireLayoutPlacement_(
  placement
) {
  if (
    !placement ||
    typeof placement !== 'object' ||
    Array.isArray(placement)
  ) {
    throw new Error(
      '[AERP-035] A calculated placement is required.'
    );
  }

  if (
    typeof placement.id !== 'string' ||
    placement.id.trim() === ''
  ) {
    throw new Error(
      '[AERP-035] Placement id is required.'
    );
  }

  if (
    typeof placement.type !== 'string' ||
    placement.type.trim() === ''
  ) {
    throw new Error(
      '[AERP-035] Placement type is required: ' +
      placement.id
    );
  }

  if (
    typeof placement.rangeA1 !==
      'string' ||
    placement.rangeA1.trim() === ''
  ) {
    throw new Error(
      '[AERP-035] Placement rangeA1 is required: ' +
      placement.id
    );
  }

  if (
    !placement.component ||
    typeof placement.component !==
      'object' ||
    Array.isArray(
      placement.component
    )
  ) {
    throw new Error(
      '[AERP-035] Component definition is required: ' +
      placement.id
    );
  }

  return placement;
}


/**
 * Resolves a Renderer Registry entry.
 *
 * @param {*} componentType Component type.
 * @return {Object} Registry entry.
 * @private
 */
function aerpResolveSheetRendererEntry_(
  componentType
) {
  const normalizedType =
    String(
      componentType || ''
    )
      .trim()
      .toLowerCase();

  if (!normalizedType) {
    throw new Error(
      '[AERP-035] Component type is required.'
    );
  }

  const registryEntry =
    AERP_SHEET_RENDERER_REGISTRY[
      normalizedType
    ];

  if (
    !registryEntry ||
    typeof registryEntry !== 'object'
  ) {
    throw new Error(
      '[AERP-035] Renderer not registered for component type: ' +
      normalizedType
    );
  }

  return registryEntry;
}


/**
 * Resolves a globally available rendering function.
 *
 * @param {*} functionName Function name.
 * @return {Function} Resolved function.
 * @private
 */
function aerpResolveSheetRendererFunction_(
  functionName
) {
  const normalizedName =
    String(
      functionName || ''
    ).trim();

  if (!normalizedName) {
    throw new Error(
      '[AERP-035] Renderer function name is required.'
    );
  }

  let resolvedFunction = null;

  try {
    resolvedFunction =
      eval(normalizedName);

  } catch (error) {
    resolvedFunction =
      null;
  }

  if (
    typeof resolvedFunction !==
      'function'
  ) {
    throw new Error(
      '[AERP-035] Renderer function is not available: ' +
      normalizedName
    );
  }

  return resolvedFunction;
}


/**
 * Resolves a globally available specification factory.
 *
 * @param {*} functionName Factory function name.
 * @return {Function} Resolved factory.
 * @private
 */
function aerpResolveSpecificationFactory_(
  functionName
) {
  const normalizedName =
    String(
      functionName || ''
    ).trim();

  if (!normalizedName) {
    throw new Error(
      '[AERP-035] Specification factory name is required.'
    );
  }

  let resolvedFactory = null;

  try {
    resolvedFactory =
      eval(normalizedName);

  } catch (error) {
    resolvedFactory =
      null;
  }

  if (
    typeof resolvedFactory !==
      'function'
  ) {
    throw new Error(
      '[AERP-035] Specification factory is not available: ' +
      normalizedName
    );
  }

  return resolvedFactory;
}


/**
 * Builds the normalized specification for one placement.
 *
 * Supported component payloads:
 *
 * component.specification
 *   Already normalized specification.
 *
 * component.config
 *   Raw configuration passed to the registered factory.
 *
 * component.metrics
 *   Metrics passed to factories such as Dashboard Hero.
 *
 * component.properties
 *   Raw component properties.
 *
 * component
 *   Final fallback source.
 *
 * @param {Object} placement Calculated placement.
 * @param {Object} registryEntry Renderer Registry entry.
 * @return {Object} Component specification.
 * @private
 */
function aerpBuildPlacementSpecification_(
  placement,
  registryEntry
) {
  const component =
    placement.component || {};

  if (
    component.specification &&
    typeof component.specification ===
      'object' &&
    !Array.isArray(
      component.specification
    )
  ) {
    return component.specification;
  }

  const factory =
    aerpResolveSpecificationFactory_(
      registryEntry
        .specificationFactory
    );

  let factoryInput =
    component;

  if (
    component.config &&
    typeof component.config ===
      'object' &&
    !Array.isArray(component.config)
  ) {
    factoryInput =
      component.config;

  } else if (
    component.metrics &&
    typeof component.metrics ===
      'object' &&
    !Array.isArray(component.metrics)
  ) {
    factoryInput =
      component.metrics;

  } else if (
    component.properties &&
    typeof component.properties ===
      'object' &&
    !Array.isArray(
      component.properties
    )
  ) {
    factoryInput =
      component.properties;

  } else if (
    component.data &&
    typeof component.data ===
      'object' &&
    !Array.isArray(component.data)
  ) {
    factoryInput =
      component.data;
  }

  const specification =
    factory(
      factoryInput
    );

  if (
    !specification ||
    typeof specification !==
      'object' ||
    Array.isArray(specification)
  ) {
    throw new Error(
      '[AERP-035] Specification factory returned an invalid result: ' +
      registryEntry
        .specificationFactory
    );
  }

  return specification;
}


/**
 * Invokes a component renderer using its supported signature.
 *
 * Dashboard Hero currently receives:
 *   sheet, specification
 *
 * Dashboard KPI receives:
 *   sheet, rangeA1, specification
 *
 * This adapter keeps those differences outside the public API.
 *
 * @param {Function} renderer Resolved renderer.
 * @param {Object} registryEntry Registry entry.
 * @param {*} sheet Google Sheets sheet.
 * @param {Object} placement Calculated placement.
 * @param {Object} specification Component specification.
 * @param {Object=} options Rendering options.
 * @return {*} Renderer result.
 * @private
 */
function aerpInvokeLayoutRenderer_(
  renderer,
  registryEntry,
  sheet,
  placement,
  specification,
  options
) {
  if (
    registryEntry.renderer ===
      'aerpRenderDashboardHero'
  ) {
    return renderer(
      sheet,
      specification
    );
  }

  return renderer(
    sheet,
    placement.rangeA1,
    specification,
    options || {}
  );
}


/**
 * Prepares the calculated Dashboard canvas before rendering.
 *
 * Only the calculated canvas is cleared. Rows and columns
 * outside that canvas remain untouched.
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {Object} layoutResult Calculated Layout result.
 * @param {Object} options Rendering options.
 * @return {*} Prepared sheet.
 * @private
 */
function aerpPrepareSheetForLayoutRender_(
  sheet,
  layoutResult,
  options
) {
  aerpRequireSheetRendererSheet_(
    sheet
  );

  aerpRequireCalculatedLayout_(
    layoutResult
  );

  const placements =
    layoutResult.placements;

  if (
    placements.length === 0
  ) {
    return sheet;
  }

  const maximumRow =
    Math.max.apply(
      null,
      placements.map(
        function(placement) {
          return Number(
            placement.endRow || 1
          );
        }
      )
    );

  const maximumColumn =
    Math.max.apply(
      null,
      placements.map(
        function(placement) {
          return Number(
            placement.endColumn || 1
          );
        }
      )
    );

  aerpEnsureSheetRendererSize_(
    sheet,
    maximumRow,
    maximumColumn
  );

  const canvas =
    sheet.getRange(
      1,
      1,
      maximumRow,
      maximumColumn
    );

  canvas.breakApart();
  canvas.clear();

  if (
    typeof sheet
      .setConditionalFormatRules ===
      'function'
  ) {
    sheet.setConditionalFormatRules(
      []
    );
  }

  if (
    typeof sheet
      .setHiddenGridlines ===
      'function' &&
    options.hiddenGridlines !== false
  ) {
    sheet.setHiddenGridlines(
      true
    );
  }

  return sheet;
}


/**
 * Ensures that the target sheet has enough rows and columns.
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {number} requiredRows Required row count.
 * @param {number} requiredColumns Required column count.
 * @return {*} Resized sheet.
 * @private
 */
function aerpEnsureSheetRendererSize_(
  sheet,
  requiredRows,
  requiredColumns
) {
  const rows =
    Number(requiredRows);

  const columns =
    Number(requiredColumns);

  if (
    !Number.isInteger(rows) ||
    rows < 1 ||
    !Number.isInteger(columns) ||
    columns < 1
  ) {
    throw new Error(
      '[AERP-035] Required sheet dimensions must be positive integers.'
    );
  }

  const currentRows =
    sheet.getMaxRows();

  const currentColumns =
    sheet.getMaxColumns();

  if (
    currentRows < rows
  ) {
    sheet.insertRowsAfter(
      currentRows,
      rows - currentRows
    );
  }

  if (
    currentColumns < columns
  ) {
    sheet.insertColumnsAfter(
      currentColumns,
      columns - currentColumns
    );
  }

  return sheet;
}

/* ============================================================
 * 4. TESTS
 * ============================================================
 */

/**
 * Validates the Sheet Renderer Registry and dependencies.
 *
 * This test does not create a Google Sheets sheet.
 *
 * @return {Object} Test result.
 */
function testLayoutSheetRendererDependencies() {
  const validation =
    aerpValidateSheetRendererDependencies();

  const tests = {
    validationPassed:
      validation.ok === true,

    heroRegistered:
      validation.registeredTypes
        .indexOf('hero') !== -1,

    kpiRegistered:
      validation.registeredTypes
        .indexOf('kpi') !== -1,

    heroRendererAvailable:
      typeof aerpRenderDashboardHero ===
        'function',

    heroFactoryAvailable:
      typeof aerpCreateDashboardHeroSpecification ===
        'function',

    kpiRendererAvailable:
      typeof aerpRenderDashboardKpi ===
        'function',

    kpiFactoryAvailable:
      typeof aerpCreateDashboardKpiSpecification ===
        'function',

    layoutEngineAvailable:
      typeof aerpCalculateDashboardLayout ===
        'function'
  };

  const testValues =
    Object.keys(
      tests
    ).map(function(testName) {
      return tests[
        testName
      ];
    });

  const result = {
    ok:
      validation.errors.length === 0 &&
      testValues.every(function(value) {
        return value === true;
      }),

    module:
      'AERP-035',

    version:
      AERP_LAYOUT_SHEET_RENDERER_VERSION,

    phase:
      'Dependency Validation',

    tests:
      tests,

    validation:
      validation,

    errors:
      validation.errors
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
      'Sheet Renderer dependencies no superó todas las pruebas.'
    );
  }

  return result;
}


/**
 * Tests one KPI placement independently.
 *
 * Creates or replaces:
 * AERP_TEST_LAYOUT_RENDERER_KPI
 *
 * @return {Object} Test result.
 */
function testLayoutSheetRendererPlacement() {
  const result = {
    ok: false,

    module:
      'AERP-035',

    version:
      AERP_LAYOUT_SHEET_RENDERER_VERSION,

    phase:
      'Single Placement Rendering',

    sheet:
      'AERP_TEST_LAYOUT_RENDERER_KPI',

    tests: {
      sheetCreated: false,
      placementAccepted: false,
      rendererResolved: false,
      factoryResolved: false,
      placementRendered: false,
      titleRendered: false,
      valueRendered: false,
      subtitleRendered: false,
      footerRendered: false,
      reportCompleted: false
    },

    placementReport:
      null,

    errors: []
  };

  try {
    const ss =
      aerpGetSpreadsheet();

    const sheetName =
      result.sheet;

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

    result.tests.sheetCreated =
      Boolean(sheet);

    aerpEnsureSheetRendererSize_(
      sheet,
      10,
      6
    );

    sheet.setHiddenGridlines(
      true
    );

    sheet.setColumnWidths(
      1,
      5,
      95
    );

    sheet.setRowHeights(
      1,
      8,
      32
    );

    const placement = {
      id:
        'renderer-kpi-tables',

      type:
        'kpi',

      component: {
        id:
          'renderer-kpi-tables',

        type:
          'kpi',

        config: {
          id:
            'renderer-kpi-tables',

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
            'Actualizado',

          options: {
            titleFontSize:
              11,

            valueFontSize:
              28,

            borderColor:
              '#E5E7EB'
          }
        }
      },

      region:
        'main',

      order:
        10,

      fullWidth:
        false,

      startRow:
        1,

      endRow:
        8,

      startColumn:
        1,

      endColumn:
        5,

      rowSpan:
        8,

      columnSpan:
        5,

      rangeA1:
        'A1:E8'
    };

    result.tests.placementAccepted =
      aerpRequireLayoutPlacement_(
        placement
      ) === placement;

    const placementReport =
      aerpRenderLayoutPlacement(
        sheet,
        placement,
        {
          stopOnError:
            true,

          activateSheet:
            false,

          flushAfterRender:
            true
        }
      );

    result.placementReport =
      placementReport;

    SpreadsheetApp.flush();

    result.tests.rendererResolved =
      placementReport.renderer ===
        'aerpRenderDashboardKpi';

    result.tests.factoryResolved =
      placementReport
        .specificationFactory ===
        'aerpCreateDashboardKpiSpecification';

    result.tests.placementRendered =
      placementReport.ok === true &&
      placementReport.status ===
        'RENDERED';

    const displayText =
      sheet
        .getRange(
          'A1:E8'
        )
        .getDisplayValues()
        .flat()
        .join(' ');

    result.tests.titleRendered =
      displayText.indexOf(
        'TABLAS'
      ) !== -1;

    result.tests.valueRendered =
      displayText.indexOf(
        '23'
      ) !== -1;

    result.tests.subtitleRendered =
      displayText.indexOf(
        'Tablas registradas'
      ) !== -1;

    result.tests.footerRendered =
      displayText.indexOf(
        '+2'
      ) !== -1 &&
      displayText.indexOf(
        'Actualizado'
      ) !== -1;

    result.tests.reportCompleted =
      typeof placementReport
        .startedAt ===
        'string' &&
      typeof placementReport
        .completedAt ===
        'string' &&
      placementReport.completedAt
        .length > 0;

  } catch (error) {
    result.errors.push(
      error &&
      error.message
        ? error.message
        : String(error)
    );
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

  if (!result.ok) {
    throw new Error(
      'Single Placement Rendering no superó todas las pruebas.'
    );
  }

  return result;
}


/**
 * Tests a complete calculated Dashboard Layout.
 *
 * Expected placements:
 *
 * KPI 1:
 * A1:F8
 *
 * KPI 2:
 * G1:L8
 *
 * Hidden KPI:
 * A10:F17
 *
 * The hidden KPI is calculated but skipped by the renderer.
 *
 * Creates or replaces:
 * AERP_TEST_LAYOUT_RENDERER
 *
 * @return {Object} Test result.
 */
function testLayoutSheetRendererLayout() {
  const result = {
    ok: false,

    module:
      'AERP-035',

    version:
      AERP_LAYOUT_SHEET_RENDERER_VERSION,

    phase:
      'Complete Layout Rendering',

    sheet:
      'AERP_TEST_LAYOUT_RENDERER',

    tests: {
      sheetCreated: false,
      layoutCreated: false,
      placementsCalculated: false,
      rangesCalculated: false,
      renderingReportCreated: false,
      twoComponentsRendered: false,
      hiddenComponentSkipped: false,
      noComponentsFailed: false,
      firstKpiRendered: false,
      secondKpiRendered: false,
      canvasPrepared: false,
      reportCompleted: false
    },

    layoutResult:
      null,

    renderingReport:
      null,

    errors: []
  };

  try {
    const ss =
      aerpGetSpreadsheet();

    const sheetName =
      result.sheet;

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

    result.tests.sheetCreated =
      Boolean(sheet);

    const layout =
      aerpCreateDashboardLayout({
        id:
          'sheet-renderer-layout-test',

        columns:
          12,

        gutterColumns:
          0,

        gutterRows:
          1,

        marginTop:
          0,

        marginLeft:
          0
      });

    result.tests.layoutCreated =
      Boolean(
        layout &&
        layout.id ===
          'sheet-renderer-layout-test'
      );

    aerpAddLayoutComponent(
      layout,
      {
        id:
          'kpi-tables',

        type:
          'kpi',

        config: {
          id:
            'kpi-tables',

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
            'Actualizado',

          options: {
            valueFontSize:
              28,

            borderColor:
              '#E5E7EB'
          }
        }
      },
      {
        type:
          'kpi',

        columnSpan:
          6,

        rowSpan:
          8,

        order:
          10,

        region:
          'main'
      }
    );

    aerpAddLayoutComponent(
      layout,
      {
        id:
          'kpi-columns',

        type:
          'kpi',

        config: {
          id:
            'kpi-columns',

          icon:
            '🧩',

          title:
            'COLUMNAS',

          value:
            276,

          subtitle:
            'Columnas registradas',

          trend:
            '+12',

          trendDirection:
            'up',

          status:
            'Actualizado',

          options: {
            valueFontSize:
              28,

            borderColor:
              '#E5E7EB'
          }
        }
      },
      {
        type:
          'kpi',

        columnSpan:
          6,

        rowSpan:
          8,

        order:
          20,

        region:
          'main'
      }
    );

    aerpAddLayoutComponent(
      layout,
      {
        id:
          'kpi-hidden',

        type:
          'kpi',

        visible:
          false,

        config: {
          id:
            'kpi-hidden',

          title:
            'OCULTO',

          value:
            0
        }
      },
      {
        type:
          'kpi',

        columnSpan:
          6,

        rowSpan:
          8,

        order:
          30,

        region:
          'main'
      }
    );

    const layoutResult =
      aerpCalculateDashboardLayout(
        layout
      );

    result.layoutResult =
      layoutResult;

    result.tests.placementsCalculated =
      layoutResult.ok === true &&
      layoutResult.componentCount === 3;

    result.tests.rangesCalculated =
      layoutResult.placements[0]
        .rangeA1 ===
        'A1:F8' &&
      layoutResult.placements[1]
        .rangeA1 ===
        'G1:L8' &&
      layoutResult.placements[2]
        .rangeA1 ===
        'A10:F17';

    sheet.setColumnWidths(
      1,
      12,
      95
    );

    sheet.setRowHeights(
      1,
      17,
      32
    );

    const renderingReport =
      aerpRenderDashboardLayout(
        sheet,
        layoutResult,
        {
          clearBeforeRender:
            true,

          activateSheet:
            false,

          flushAfterRender:
            true,

          stopOnError:
            true,

          hiddenGridlines:
            true
        }
      );

    result.renderingReport =
      renderingReport;

    result.tests.renderingReportCreated =
      Boolean(
        renderingReport &&
        renderingReport.layoutId ===
          'sheet-renderer-layout-test'
      );

    result.tests.twoComponentsRendered =
      renderingReport.renderedCount ===
        2;

    result.tests.hiddenComponentSkipped =
      renderingReport.skippedCount ===
        1 &&
      renderingReport.placements[2]
        .status ===
        'SKIPPED';

    result.tests.noComponentsFailed =
      renderingReport.failedCount ===
        0 &&
      renderingReport.errors.length ===
        0;

    const firstKpiText =
      sheet
        .getRange(
          'A1:F8'
        )
        .getDisplayValues()
        .flat()
        .join(' ');

    const secondKpiText =
      sheet
        .getRange(
          'G1:L8'
        )
        .getDisplayValues()
        .flat()
        .join(' ');

    result.tests.firstKpiRendered =
      firstKpiText.indexOf(
        'TABLAS'
      ) !== -1 &&
      firstKpiText.indexOf(
        '23'
      ) !== -1;

    result.tests.secondKpiRendered =
      secondKpiText.indexOf(
        'COLUMNAS'
      ) !== -1 &&
      secondKpiText.indexOf(
        '276'
      ) !== -1;

    result.tests.canvasPrepared =
      sheet.getMaxRows() >=
        17 &&
      sheet.getMaxColumns() >=
        12;

    result.tests.reportCompleted =
      renderingReport.ok === true &&
      typeof renderingReport
        .completedAt ===
        'string' &&
      renderingReport.completedAt
        .length > 0;

  } catch (error) {
    result.errors.push(
      error &&
      error.message
        ? error.message
        : String(error)
    );
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

  if (!result.ok) {
    throw new Error(
      'Complete Layout Rendering no superó todas las pruebas.'
    );
  }

  return result;
}


/**
 * Tests controlled renderer failures.
 *
 * This test confirms that an unregistered component type:
 * - Produces a FAILED placement report.
 * - Does not throw when stopOnError is false.
 *
 * @return {Object} Test result.
 */
function testLayoutSheetRendererErrors() {
  const result = {
    ok: false,

    module:
      'AERP-035',

    version:
      AERP_LAYOUT_SHEET_RENDERER_VERSION,

    phase:
      'Renderer Error Handling',

    tests: {
      sheetCreated: false,
      unknownRendererRejected: false,
      failureReportReturned: false,
      stopOnErrorFalseRespected: false
    },

    errorReport:
      null,

    errors: []
  };

  try {
    const ss =
      aerpGetSpreadsheet();

    const sheetName =
      'AERP_TEST_LAYOUT_RENDERER_ERROR';

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

    result.tests.sheetCreated =
      Boolean(sheet);

    const invalidPlacement = {
      id:
        'unknown-component',

      type:
        'unknown-widget',

      component: {
        id:
          'unknown-component',

        type:
          'unknown-widget'
      },

      region:
        'main',

      order:
        10,

      fullWidth:
        false,

      startRow:
        1,

      endRow:
        4,

      startColumn:
        1,

      endColumn:
        4,

      rowSpan:
        4,

      columnSpan:
        4,

      rangeA1:
        'A1:D4'
    };

    const errorReport =
      aerpRenderLayoutPlacement(
        sheet,
        invalidPlacement,
        {
          stopOnError:
            false
        }
      );

    result.errorReport =
      errorReport;

    result.tests.unknownRendererRejected =
      errorReport.error &&
      errorReport.error.indexOf(
        'Renderer not registered'
      ) !== -1;

    result.tests.failureReportReturned =
      errorReport.ok === false &&
      errorReport.status ===
        'FAILED';

    result.tests.stopOnErrorFalseRespected =
      Boolean(errorReport) &&
      errorReport.completedAt !==
        null;

  } catch (error) {
    result.errors.push(
      error &&
      error.message
        ? error.message
        : String(error)
    );
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

  if (!result.ok) {
    throw new Error(
      'Renderer Error Handling no superó todas las pruebas.'
    );
  }

  return result;
}


/**
 * Runs the complete AERP-035 Sheet Renderer test suite.
 *
 * @return {Object} Complete test-suite result.
 */
function testLayoutSheetRenderer() {
  const dependencies =
    testLayoutSheetRendererDependencies();

  const placement =
    testLayoutSheetRendererPlacement();

  const completeLayout =
    testLayoutSheetRendererLayout();

  const errorHandling =
    testLayoutSheetRendererErrors();

  const result = {
    ok:
      dependencies.ok === true &&
      placement.ok === true &&
      completeLayout.ok === true &&
      errorHandling.ok === true,

    module:
      'AERP-035',

    version:
      AERP_LAYOUT_SHEET_RENDERER_VERSION,

    phase:
      'Complete Sheet Renderer Suite',

    tests: {
      dependencies:
        dependencies.ok,

      placement:
        placement.ok,

      completeLayout:
        completeLayout.ok,

      errorHandling:
        errorHandling.ok
    },

    errors: []
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
      'Sheet Renderer no superó la suite completa.'
    );
  }

  return result;
}
