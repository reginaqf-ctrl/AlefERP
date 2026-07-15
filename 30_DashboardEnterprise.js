// @ts-nocheck
/**
 * ============================================================
 * ALEF ERP
 * Enterprise Dashboard
 * ------------------------------------------------------------
 * Module : AERP-030
 * Name   : Dashboard Enterprise 2.0
 * Version: 1.0.0
 * Status : Phase 1 - Enterprise KPI Layout
 * ------------------------------------------------------------
 * Description:
 * Builds the declarative Enterprise Dashboard using:
 *
 * - AERP-023 Commercial Metrics
 * - AERP-027 Theme, Registry and Component Factory
 * - AERP-029 Sheet Renderer and Layout Engine
 *
 * Public API:
 * - aerpBuildEnterpriseDashboard()
 * - testDashboardEnterprise()
 *
 * Output sheet:
 * - AERP_DASHBOARD_ENTERPRISE
 * ============================================================
 */


/* ============================================================
 * 1. MODULE CONSTANTS
 * ============================================================
 */

const AERP_ENTERPRISE_DASHBOARD_VERSION =
  '1.0.0';

const AERP_ENTERPRISE_DASHBOARD_SHEET =
  'AERP_DASHBOARD_ENTERPRISE';

const AERP_ENTERPRISE_DASHBOARD_COLUMN_WIDTH =
  95;

/**
 * Official Enterprise Dashboard Layout configuration.
 *
 * The Dashboard declares component dimensions but never
 * declares Google Sheets A1 ranges.
 */
const AERP_ENTERPRISE_LAYOUT_CONFIG = {
  id:
    'alef-enterprise-dashboard',

  columns:
    12,

  gutterColumns:
    0,

  gutterRows:
    1,

  marginTop:
    0,

  marginLeft:
    0,

  hero: {
    columnSpan:
      12,

    rowSpan:
      5,

    order:
      10,

    region:
      'hero',

    fullWidth:
      true
  },

  kpi: {
    columnSpan:
      6,

    rowSpan:
      8,

    region:
      'main'
  }
};

/**
 * Official Enterprise Dashboard layout.
 *
 * All visual regions must be declared here.
 * Dashboard renderers must not contain scattered A1 ranges.
 *
 * @type {Object}
 */
const AERP_ENTERPRISE_DASHBOARD_LAYOUT =
  aerpDeepFreeze_({
    canvas: {
      range: 'A1:L56',
      rows: 56,
      columns: 12
    },

    header: {
      logo: 'A1:B3',
      title: 'C1:K3',
      subtitle: 'A4:K4'
    },

    status: {
      banner: 'A6:K7'
    },

    kpis: {
      ranges: [
        'A9:E15',
        'G9:K15',

        'A17:E23',
        'G17:K23',

        'A25:E31',
        'G25:K31',

        'A33:E39',
        'G33:K39'
      ],

      separatorColumns: [
        6,
        12
      ],

      startRows: [
        9,
        17,
        25,
        33
      ],

      rowsPerCard: 7
    },

    build: {
      title: 'A42:K43',
      information: 'A45:K48'
    },

    footer: {
      institutional: 'A50:K53',
      version: 'A55:K56'
    },

    navigation: {
      initialCell: 'A1',
      frozenRows: 4
    }
  });


/**
 * Canvas dimensions derived from the Layout Manager.
 */
const AERP_ENTERPRISE_DASHBOARD_ROWS =
  AERP_ENTERPRISE_DASHBOARD_LAYOUT
    .canvas
    .rows;

const AERP_ENTERPRISE_DASHBOARD_COLUMNS =
  AERP_ENTERPRISE_DASHBOARD_LAYOUT
    .canvas
    .columns;


/**
 * Backward-compatible KPI range alias.
 *
 * @deprecated Use AERP_ENTERPRISE_DASHBOARD_LAYOUT.kpis.ranges.
 */
const AERP_ENTERPRISE_KPI_RANGES =
  AERP_ENTERPRISE_DASHBOARD_LAYOUT
    .kpis
    .ranges;

/**
 * Official Enterprise Dashboard section configuration.
 *
 * Sections are rendered in the declared order.
 * Disabled sections are skipped automatically.
 *
 * @type {Array<Object>}
 */
const AERP_ENTERPRISE_DASHBOARD_SECTIONS =
  aerpDeepFreeze_([
    {
      id: 'header',
      enabled: true,
      order: 10
    },

    {
      id: 'status',
      enabled: true,
      order: 20
    },

    {
      id: 'kpis',
      enabled: true,
      order: 30
    },

    {
      id: 'build',
      enabled: true,
      order: 40
    },

    {
      id: 'footer',
      enabled: true,
      order: 50
    }
  ]);


/* ============================================================
 * 2. PUBLIC API
 * ============================================================
 */

/**
 * Builds or updates Dashboard Enterprise 2.0.
 *
 * @return {Object} Build result.
 */
function aerpBuildEnterpriseDashboard() {
  const ss =
    aerpGetSpreadsheet();

  let stage =
    'INICIO';

  let sheet =
    null;

  try {
    /* --------------------------------------------------------
     * 1. Validate dependencies
     * --------------------------------------------------------
     */

    stage =
      'VALIDAR_DEPENDENCIAS';

    aerpValidateEnterpriseDashboardDependencies_();

    /* --------------------------------------------------------
     * 2. Create or reuse sheet
     * --------------------------------------------------------
     */

    stage =
      'PREPARAR_HOJA';

    sheet =
      ss.getSheetByName(
        AERP_ENTERPRISE_DASHBOARD_SHEET
      );

    if (!sheet) {
      sheet =
        ss.insertSheet(
          AERP_ENTERPRISE_DASHBOARD_SHEET
        );
    }

    aerpPrepareEnterpriseDashboardSheet_(
      sheet
    );

    /* --------------------------------------------------------
     * 3. Obtain real metrics
     * --------------------------------------------------------
     */

    stage =
      'OBTENER_METRICAS';

    const metrics =
      aerpGetCommercialDashboardMetrics_();

    /* --------------------------------------------------------
     * 4. Create declarative specification
     * --------------------------------------------------------
     */

    stage =
      'CREAR_ESPECIFICACION';

    const specification =
      aerpCreateEnterpriseDashboardSpecification_(
        metrics
      );

    /* --------------------------------------------------------
     * 5. Render complete dashboard
     * --------------------------------------------------------
     */

    stage =
  'RENDERIZAR_DASHBOARD';

const pipeline =
  aerpRenderEnterpriseDashboardWithLayout_(
    sheet,
    specification,
    {
      clearBeforeRender:
        true,

      activateSheet:
        true,

      flushAfterRender:
        true,

      stopOnError:
        true,

      hiddenGridlines:
        true
    }
  );

    /* --------------------------------------------------------
     * 6. Finalize
     * --------------------------------------------------------
     */

    stage =
      'FINALIZAR';

    aerpConstrainSheetView_(
      sheet,
      AERP_ENTERPRISE_DASHBOARD_ROWS,
      AERP_ENTERPRISE_DASHBOARD_COLUMNS
    );

    sheet.activate();

    sheet
      .getRange('A1')
      .activate();

    SpreadsheetApp.flush();

    return {
  ok: true,

  module:
    'AERP-030',

  version:
    AERP_ENTERPRISE_DASHBOARD_VERSION,

  phase:
    'Enterprise KPI Layout',

  stage:
    stage,

  sheet:
    AERP_ENTERPRISE_DASHBOARD_SHEET,

  metrics:
    metrics,

  components:
    specification.kpis.length,

  specification:
    specification.meta,

  layoutEngine: {
    ok:
      pipeline.ok,

    layoutId:
      pipeline
        .calculatedLayout
        .layoutId,

    placements:
      pipeline
        .calculatedLayout
        .componentCount,

    rendered:
      pipeline
        .renderingReport
        .renderedCount,

    skipped:
      pipeline
        .renderingReport
        .skippedCount,

    failed:
      pipeline
        .renderingReport
        .failedCount
  }
};
} catch (error) {

  const message =
    error && error.message
      ? error.message
      : String(error);

  console.error(
    [
      'Dashboard Enterprise falló.',
      'Etapa: ' + stage,
      'Mensaje: ' + message,
      error && error.stack
        ? error.stack
        : ''
    ].join('\n')
  );

  return {
    ok: false,

    module:
      'AERP-030',

    version:
      AERP_ENTERPRISE_DASHBOARD_VERSION,

    stage:
      stage,

    sheet:
      AERP_ENTERPRISE_DASHBOARD_SHEET,

    message:
      message,

    stack:
      error && error.stack
        ? error.stack
        : ''
  };
}
}


/* ============================================================
 * 3. DASHBOARD DECLARATIVE SPECIFICATION
 * ============================================================
 */

/**
 * Creates the complete declarative Dashboard specification.
 *
 * @param {Object} metrics Commercial Dashboard metrics.
 * @return {Object} Dashboard specification.
 * @private
 */
function aerpCreateEnterpriseDashboardSpecification_(
  metrics
) {
  const theme =
    aerpGetTheme();

  return {
    meta: {
      id:
        'ALEF_ENTERPRISE_DASHBOARD',
      module:
        'AERP-030',
      version:
        AERP_ENTERPRISE_DASHBOARD_VERSION,
      schemaVersion:
        '1.0',
      title:
        'Dashboard Enterprise',
      generatedAt:
        new Date().toISOString()
    },

    header: {
      product:
        AERP_BRAND.PRODUCT,

      subtitle:
        AERP_BRAND.EDITION +
        ' | ' +
        AERP_BRAND.TAGLINE
    },

    status: {
      buildStatus:
        metrics.status,

      uiStatus:
        aerpResolveDashboardUiStatus_(
          metrics.status
        ),

      text:
        aerpDashboardStatusText_(
          metrics.status
        )
    },

    kpis: [
      {
        id:
          'dashboard-tables',

        icon:
          AERP_ICONS.TABLE,

        title:
          'TABLAS',

        value:
          metrics.tables,

        subtitle:
          'Tablas registradas en CORE_TABLAS',

        options: {
          valueFontSize: 28
        }
      },

      {
        id:
          'dashboard-columns',

        icon:
          AERP_ICONS.COLUMN,

        title:
          'COLUMNAS',

        value:
          metrics.columns,

        subtitle:
          'Columnas activas en metadata',

        options: {
          valueFontSize: 28
        }
      },

      {
        id:
          'dashboard-forms',

        icon:
          AERP_ICONS.FORM,

        title:
          'FORMULARIOS',

        value:
          metrics.forms,

        subtitle:
          'Formularios generados',

        options: {
          valueFontSize: 28
        }
      },

      {
        id:
          'dashboard-views',

        icon:
          AERP_ICONS.VIEW,

        title:
          'VISTAS',

        value:
          metrics.views,

        subtitle:
          'Vistas disponibles',

        options: {
          valueFontSize: 28
        }
      },

      {
        id:
          'dashboard-menus',

        icon:
          AERP_ICONS.MENU,

        title:
          'MENÚS',

        value:
          metrics.menus,

        subtitle:
          'Menús configurados',

        options: {
          valueFontSize: 28
        }
      },

      {
        id:
          'dashboard-warnings',

        icon:
          AERP_ICONS.WARNING,

        title:
          'ADVERTENCIAS',

        value:
          metrics.warnings,

        subtitle:
          metrics.warnings > 0
            ? 'Requieren revisión'
            : 'Sin advertencias',

        options: {
          valueFontSize: 28,

          borderColor:
            metrics.warnings > 0
              ? theme.colors
                  .semantic
                  .warning
              : theme.colors
                  .border
                  .subtle
        }
      },

      {
        id:
          'dashboard-errors',

        icon:
          AERP_ICONS.ERROR,

        title:
          'ERRORES',

        value:
          metrics.errors,

        subtitle:
          metrics.errors > 0
            ? 'Errores pendientes'
            : 'Sin errores detectados',

        options: {
          valueFontSize: 28,

          borderColor:
            metrics.errors > 0
              ? theme.colors
                  .semantic
                  .error
              : theme.colors
                  .border
                  .subtle
        }
      },

      {
        id:
          'dashboard-duration',

        icon:
          AERP_ICONS.TIME,

        title:
          'DURACIÓN',

        value:
          aerpFormatDuration_(
            metrics.durationMs
          ),

        subtitle:
          'Duración del último Build',

        options: {
          valueFontSize: 24
        }
      }
    ],

    build: {
      title:
        AERP_BRAND.ENGINE_NAME,

      lastBuildDate:
        aerpFormatDashboardDate_(
          metrics.lastBuildDate
        ),

      buildId:
        metrics.buildId ||
        'No disponible',

      pipeline:
        'Metadata → Generator Engine → ' +
        'AppSheet Package → Deployment'
    },

    footer: {
      text:
        AERP_BRAND.TAGLINE +
        '\n' +
        AERP_BRAND.POWERED_BY,

      versionText:
        AERP_BRAND.PRODUCT +
        ' ' +
        AERP_BRAND.VERSION +
        ' | Enterprise Dashboard ' +
        AERP_ENTERPRISE_DASHBOARD_VERSION
    }
  };
}

/**
 * Creates the declarative Enterprise Dashboard Layout.
 *
 * This function declares:
 * - which components exist;
 * - their dimensions;
 * - their order;
 * - their logical regions.
 *
 * It does not calculate coordinates and does not render.
 *
 * @param {Object} specification Enterprise Dashboard specification.
 * @return {Object} Declarative Dashboard Layout.
 * @private
 */
function aerpCreateEnterpriseDashboardLayout_(
  specification
) {
  if (
    !specification ||
    typeof specification !== 'object' ||
    Array.isArray(specification)
  ) {
    throw new Error(
      '[AERP-030] Enterprise Dashboard specification is required.'
    );
  }

  const layout =
    aerpCreateDashboardLayout({
      id:
        AERP_ENTERPRISE_LAYOUT_CONFIG.id,

      columns:
        AERP_ENTERPRISE_LAYOUT_CONFIG.columns,

      gutterColumns:
        AERP_ENTERPRISE_LAYOUT_CONFIG
          .gutterColumns,

      gutterRows:
        AERP_ENTERPRISE_LAYOUT_CONFIG
          .gutterRows,

      marginTop:
        AERP_ENTERPRISE_LAYOUT_CONFIG
          .marginTop,

      marginLeft:
        AERP_ENTERPRISE_LAYOUT_CONFIG
          .marginLeft
    });

  /*
   * Hero specification.
   */
  const heroSpecification =
    aerpResolveEnterpriseHeroSpecification_(
      specification
    );

  aerpAddLayoutComponent(
    layout,
    {
      id:
        'enterprise-dashboard-hero',

      type:
        'hero',

      specification:
        heroSpecification
    },
    {
      type:
        'hero',

      columnSpan:
        AERP_ENTERPRISE_LAYOUT_CONFIG
          .hero
          .columnSpan,

      rowSpan:
        AERP_ENTERPRISE_LAYOUT_CONFIG
          .hero
          .rowSpan,

      order:
        AERP_ENTERPRISE_LAYOUT_CONFIG
          .hero
          .order,

      region:
        AERP_ENTERPRISE_LAYOUT_CONFIG
          .hero
          .region,

      fullWidth:
        AERP_ENTERPRISE_LAYOUT_CONFIG
          .hero
          .fullWidth
    }
  );

  /*
   * KPI specifications.
   */
  const kpis =
  aerpBuildEnterpriseKpiComponents_(
    specification
  );

  kpis.forEach(
    function(kpiSpecification, index) {
      const kpiId =
        String(
          kpiSpecification.id ||
          (
            'enterprise-dashboard-kpi-' +
            String(index + 1)
          )
        ).trim();

      aerpAddLayoutComponent(
        layout,
        {
          id:
            kpiId,

          type:
            'kpi',

          specification:
            kpiSpecification,

          visible:
            kpiSpecification.visible !==
            false
        },
        {
          type:
            'kpi',

          columnSpan:
            AERP_ENTERPRISE_LAYOUT_CONFIG
              .kpi
              .columnSpan,

          rowSpan:
            AERP_ENTERPRISE_LAYOUT_CONFIG
              .kpi
              .rowSpan,

          order:
            20 +
            (
              index * 10
            ),

          region:
            AERP_ENTERPRISE_LAYOUT_CONFIG
              .kpi
              .region,

          fullWidth:
            false,

          enabled:
            kpiSpecification.enabled !==
            false
        }
      );
    }
  );

  return layout;
}

/**
 * Resolves the official Hero specification.
 *
 * Supports:
 * - specification.hero as an already-created specification;
 * - specification.heroSpecification;
 * - specification.metrics;
 * - the complete Dashboard specification as fallback.
 *
 * @param {Object} specification Dashboard specification.
 * @return {Object} Hero specification.
 * @private
 */
function aerpResolveEnterpriseHeroSpecification_(
  specification
) {
  if (
    specification.heroSpecification &&
    typeof specification
      .heroSpecification ===
      'object' &&
    !Array.isArray(
      specification.heroSpecification
    )
  ) {
    return specification
      .heroSpecification;
  }

  if (
    specification.hero &&
    typeof specification.hero ===
      'object' &&
    !Array.isArray(
      specification.hero
    )
  ) {
    /*
     * If the Hero is already normalized, use it directly.
     */
    if (
      specification.hero.product ||
      specification.hero.title ||
      specification.hero.metrics ||
      specification.hero.lastBuild
    ) {
      return specification.hero;
    }

    return aerpCreateDashboardHeroSpecification(
      specification.hero
    );
  }

  if (
    specification.metrics &&
    typeof specification.metrics ===
      'object' &&
    !Array.isArray(
      specification.metrics
    )
  ) {
    return aerpCreateDashboardHeroSpecification(
      specification.metrics
    );
  }

  return aerpCreateDashboardHeroSpecification(
    specification
  );
}

/**
 * Resolves all Enterprise KPI specifications.
 *
 * Supports KPI definitions located in:
 * - specification.kpis;
 * - specification.metrics.kpis.
 *
 * Each item may be:
 * - an already-created KPI specification;
 * - a raw KPI configuration.
 *
 * @param {Object} specification Dashboard specification.
 * @return {Array<Object>} KPI specifications.
 * @private
 */
function aerpResolveEnterpriseKpiSpecifications_(
  specification
) {
  let sourceKpis = [];

  if (
    Array.isArray(
      specification.kpis
    )
  ) {
    sourceKpis =
      specification.kpis;

  } else if (
    specification.metrics &&
    Array.isArray(
      specification.metrics.kpis
    )
  ) {
    sourceKpis =
      specification.metrics.kpis;
  }

  if (
    sourceKpis.length === 0
  ) {
    throw new Error(
      '[AERP-030] Enterprise Dashboard KPIs are required.'
    );
  }

  return sourceKpis.map(
    function(kpi, index) {
      if (
        !kpi ||
        typeof kpi !== 'object' ||
        Array.isArray(kpi)
      ) {
        throw new Error(
          '[AERP-030] Invalid KPI at index ' +
          index +
          '.'
        );
      }

      if (
        kpi.specification &&
        typeof kpi.specification ===
          'object' &&
        !Array.isArray(
          kpi.specification
        )
      ) {
        return kpi.specification;
      }

      /*
       * The factory is idempotent for the properties used by
       * the current KPI component.
       */
      return aerpCreateDashboardKpiSpecification(
        kpi
      );
    }
  );
}

/**
 * Builds all Enterprise KPI component specifications.
 *
 * Supports KPI definitions located in:
 * - specification.kpis;
 * - specification.metrics.kpis.
 *
 * Each item may contain:
 * - specification: already normalized KPI specification;
 * - config: raw KPI configuration;
 * - raw KPI properties.
 *
 * @param {Object} specification Dashboard specification.
 * @return {Array<Object>} Enterprise KPI specifications.
 * @private
 */
function aerpBuildEnterpriseKpiComponents_(
  specification
) {
  let sourceKpis = [];

  if (
    specification &&
    Array.isArray(
      specification.kpis
    )
  ) {
    sourceKpis =
      specification.kpis;

  } else if (
    specification &&
    specification.metrics &&
    Array.isArray(
      specification.metrics.kpis
    )
  ) {
    sourceKpis =
      specification.metrics.kpis;
  }

  if (
    sourceKpis.length === 0
  ) {
    throw new Error(
      '[AERP-030] Enterprise Dashboard KPIs are required.'
    );
  }

  return sourceKpis.map(
    function(kpi, index) {
      if (
        !kpi ||
        typeof kpi !== 'object' ||
        Array.isArray(kpi)
      ) {
        throw new Error(
          '[AERP-030] Invalid KPI at index ' +
          index +
          '.'
        );
      }

      if (
        kpi.specification &&
        typeof kpi.specification ===
          'object' &&
        !Array.isArray(
          kpi.specification
        )
      ) {
        return kpi.specification;
      }

      if (
        kpi.config &&
        typeof kpi.config ===
          'object' &&
        !Array.isArray(
          kpi.config
        )
      ) {
        return aerpCreateDashboardKpiSpecification(
          kpi.config
        );
      }

      return aerpCreateDashboardKpiSpecification(
        kpi
      );
    }
  );
}

/**
 * Renders the Enterprise Dashboard through the official
 * Layout Engine and Sheet Renderer pipeline.
 *
 * Pipeline:
 * Dashboard specification
 * -> Declarative Layout
 * -> Calculated placements
 * -> Sheet Renderer
 * -> Hero and KPI component renderers
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {Object} specification Dashboard specification.
 * @param {Object=} options Rendering options.
 * @return {Object} Complete pipeline report.
 * @private
 */
function aerpRenderEnterpriseDashboardWithLayout_(
  sheet,
  specification,
  options
) {
  if (
    !sheet ||
    typeof sheet.getRange !==
      'function'
  ) {
    throw new Error(
      '[AERP-030] A valid Dashboard sheet is required.'
    );
  }

  const layout =
    aerpCreateEnterpriseDashboardLayout_(
      specification
    );

  const layoutValidation =
    aerpValidateDashboardLayout(
      layout
    );

  if (!layoutValidation.ok) {
    throw new Error(
      '[AERP-030] Enterprise Layout validation failed: ' +
      layoutValidation.errors.join(' | ')
    );
  }

  const calculatedLayout =
    aerpCalculateDashboardLayout(
      layout
    );

  const renderingReport =
    aerpRenderDashboardLayout(
      sheet,
      calculatedLayout,
      Object.assign(
        {
          clearBeforeRender:
            true,

          activateSheet:
            true,

          flushAfterRender:
            true,

          stopOnError:
            true,

          hiddenGridlines:
            true
        },
        options || {}
      )
    );

  return {
    ok:
      calculatedLayout.ok === true &&
      renderingReport.ok === true,

    module:
      'AERP-030',

    version:
      AERP_ENTERPRISE_DASHBOARD_VERSION,

    phase:
      'Layout Engine Integration',

    sheet:
      sheet.getName(),

    layout:
      layout,

    calculatedLayout:
      calculatedLayout,

    renderingReport:
      renderingReport,

    tests: {
      layoutCreated:
        Boolean(layout),

      layoutValidated:
        layoutValidation.ok === true,

      placementsCalculated:
        calculatedLayout.ok === true,

      heroPlacementCalculated:
        calculatedLayout
          .placements
          .some(function(placement) {
            return (
              placement.type ===
              'hero'
            );
          }),

      kpiPlacementsCalculated:
        calculatedLayout
          .placements
          .filter(function(placement) {
            return (
              placement.type ===
              'kpi'
            );
          })
          .length ===
          layout.components
            .filter(function(entry) {
              return (
                entry.type ===
                'kpi' &&
                entry.placement.enabled ===
                  true
              );
            })
            .length,

      sheetRendered:
        renderingReport.ok === true
    },

    errors:
      renderingReport.errors || []
  };
}

/* ============================================================
 * 4. DASHBOARD RENDERER
 * ============================================================
 */

/**
 * Renders all Dashboard sections.
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {Object} specification Dashboard specification.
 * @return {*} Rendered sheet.
 * @private
 */
/* ============================================================
 * DASHBOARD SECTION ROUTER
 * ============================================================
 */

/**
 * Renders one Enterprise Dashboard section.
 *
 * @param {*} sheet
 * @param {Object} specification
 * @param {String} section
 * @private
 */
function aerpRenderDashboardSection_(
  sheet,
  specification,
  section
) {

  switch (section) {

    case 'header':

      return aerpRenderEnterpriseHeader_(
        sheet,
        specification.header
      );

    case 'status':

      return aerpRenderEnterpriseStatus_(
        sheet,
        specification.status
      );

    case 'kpis':

      return aerpRenderEnterpriseKpiGrid_(
        sheet,
        specification.kpis
      );

    case 'build':

      return aerpRenderEnterpriseBuildSection_(
        sheet,
        specification.build
      );

    case 'footer':

      return aerpRenderEnterpriseFooter_(
        sheet,
        specification.footer
      );

    default:

      throw new Error(
        '[AERP-030] Unknown Dashboard section: ' +
        section
      );

  }

}
/**
 * Renders all enabled Enterprise Dashboard sections.
 *
 * Section order and visibility are controlled by
 * AERP_ENTERPRISE_DASHBOARD_SECTIONS.
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {Object} specification Dashboard specification.
 * @return {*} Rendered sheet.
 * @private
 */
function aerpRenderEnterpriseDashboard_(
  sheet,
  specification
) {
  const sections =
    AERP_ENTERPRISE_DASHBOARD_SECTIONS
      .filter(function(section) {
        return (
          section &&
          section.enabled === true
        );
      })
      .slice()
      .sort(function(first, second) {
        return (
          Number(first.order || 0) -
          Number(second.order || 0)
        );
      });

  sections.forEach(
    function(section) {
      aerpRenderDashboardSection_(
        sheet,
        specification,
        section.id
      );
    }
  );

  return sheet;
}


/**
 * Renders the product header.
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {Object} header Header specification.
 * @private
 */
function aerpRenderEnterpriseHeader_(
  sheet,
  header
) {
  aerpCreateHeader_(
    sheet,
    'A1:B3',
    'C1:K3',
    header.product,
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
    'A4:K4',
    header.subtitle
  );
}


/**
 * Renders the global Build status.
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {Object} status Status specification.
 * @private
 */
function aerpRenderEnterpriseStatus_(
  sheet,
  status
) {
  aerpCreateStatusBanner_(
    sheet,
    'A6:K7',
    status.uiStatus,
    status.text
  );
}


/**
 * Renders all Enterprise KPI components.
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {Array<Object>} kpis KPI specifications.
 * @return {*} Google Sheets sheet.
 * @private
 */
function aerpRenderEnterpriseKpiGrid_(
  sheet,
  kpis
) {
  if (
    !Array.isArray(kpis)
  ) {
    throw new Error(
      '[AERP-030] KPI specification must be an array.'
    );
  }

  if (
    kpis.length >
    AERP_ENTERPRISE_KPI_RANGES.length
  ) {
    throw new Error(
      '[AERP-030] More KPIs were received than available ranges.'
    );
  }

  kpis.forEach(function(kpi, index) {
    const rangeA1 =
      AERP_ENTERPRISE_KPI_RANGES[
        index
      ];

    const specification =
      aerpCreateDashboardKpiSpecification({
        id:
          kpi.id,

        icon:
          kpi.icon,

        title:
          kpi.title,

        value:
          kpi.value,

        subtitle:
          kpi.subtitle,

        trend:
          kpi.trend || '',

        trendDirection:
          kpi.trendDirection ||
          'neutral',

        status:
          kpi.status ||
          'Actualizado',

        visible:
          kpi.visible !== false,

        enabled:
          kpi.enabled !== false,

        loading:
          kpi.loading === true,

        options:
          kpi.options || {}
      });

    aerpRenderDashboardKpi(
      sheet,
      rangeA1,
      specification
    );
  });

  return sheet;
}



/**
 * Renders Build information.
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {Object} build Build specification.
 * @private
 */
function aerpRenderEnterpriseBuildSection_(
  sheet,
  build
) {
  const theme =
    aerpGetTheme();

  const titleRange =
    sheet.getRange(
      'A42:K43'
    );

  titleRange.breakApart();
  titleRange.merge();

  titleRange
    .setValue(
      build.title
    )
    .setBackground(
      theme.colors
        .surface
        .muted
    )
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
        .headingMedium
        .fontSize
    )
    .setFontWeight('bold')
    .setHorizontalAlignment(
      'center'
    )
    .setVerticalAlignment(
      'middle'
    );

  const infoRange =
    sheet.getRange(
      'A45:K48'
    );

  infoRange.breakApart();
  infoRange.merge();

  infoRange
    .setValue(
      [
        'Última generación: ' +
          build.lastBuildDate,

        'Build ID: ' +
          build.buildId,

        build.pipeline
      ].join('\n')
    )
    .setBackground(
      theme.colors
        .surface
        .default
    )
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
    )
    .setWrap(true);

  infoRange.setBorder(
    true,
    true,
    true,
    true,
    false,
    false,
    theme.colors
      .border
      .subtle,
    SpreadsheetApp
      .BorderStyle
      .SOLID
  );
}


/**
 * Renders institutional footer and version.
 *
 * @param {*} sheet Google Sheets sheet.
 * @param {Object} footer Footer specification.
 * @private
 */
function aerpRenderEnterpriseFooter_(
  sheet,
  footer
) {
  const theme =
    aerpGetTheme();

  aerpCreateFooter_(
    sheet,
    'A50:K53',
    footer.text
  );

  const versionRange =
    sheet.getRange(
      'A55:K56'
    );

  versionRange.breakApart();
  versionRange.merge();

  versionRange
    .setValue(
      footer.versionText
    )
    .setBackground(
      theme.colors
        .surface
        .default
    )
    .setFontColor(
      theme.colors
        .text
        .muted
    )
    .setFontFamily(
      theme.typography
        .fontFamily
        .primary
    )
    .setFontSize(
      theme.typography
        .styles
        .caption
        .fontSize
    )
    .setHorizontalAlignment(
      'center'
    )
    .setVerticalAlignment(
      'middle'
    );
}


/* ============================================================
 * 5. SHEET PREPARATION
 * ============================================================
 */

/**
 * Prepares the Enterprise Dashboard canvas.
 *
 * @param {*} sheet Google Sheets sheet.
 * @return {*} Prepared sheet.
 * @private
 */
function aerpPrepareEnterpriseDashboardSheet_(
  sheet
) {
  if (!sheet) {
    throw new Error(
      '[AERP-030] A valid sheet is required.'
    );
  }

  aerpEnsureSheetSize_(
    sheet,
    AERP_ENTERPRISE_DASHBOARD_ROWS,
    AERP_ENTERPRISE_DASHBOARD_COLUMNS
  );

  aerpRestoreSheetView_(
    sheet
  );

  aerpRemoveBrandAssetsFromSheet_(
    sheet
  );

  const dashboardRange =
    sheet.getRange(
      1,
      1,
      AERP_ENTERPRISE_DASHBOARD_ROWS,
      AERP_ENTERPRISE_DASHBOARD_COLUMNS
    );

  dashboardRange.breakApart();
  dashboardRange.clear();

  sheet.setConditionalFormatRules(
    []
  );

  sheet.setHiddenGridlines(
    true
  );

  sheet.setColumnWidths(
    1,
    AERP_ENTERPRISE_DASHBOARD_COLUMNS,
    AERP_ENTERPRISE_DASHBOARD_COLUMN_WIDTH
  );

  /*
   * Separator columns.
   */
  sheet.setColumnWidth(
    6,
    24
  );

  sheet.setColumnWidth(
    12,
    24
  );

  /*
   * General row height.
   */
  sheet.setRowHeights(
    1,
    AERP_ENTERPRISE_DASHBOARD_ROWS,
    30
  );

  /*
   * Header.
   */
  sheet.setRowHeights(
    1,
    3,
    42
  );

  /*
   * Subheader.
   */
  sheet.setRowHeight(
    4,
    32
  );

  /*
   * Status.
   */
  sheet.setRowHeights(
    6,
    2,
    34
  );

  /*
   * KPI cards.
   */
  [
    9,
    17,
    25,
    33
  ].forEach(function(startRow) {
    sheet.setRowHeights(
      startRow,
      7,
      32
    );
  });

  /*
   * Build and footer.
   */
  sheet.setRowHeights(
    42,
    2,
    32
  );

  sheet.setRowHeights(
    45,
    4,
    30
  );

  sheet.setRowHeights(
    50,
    4,
    34
  );

  sheet.setFrozenRows(
    4
  );

  /*
   * Apply official Enterprise page background.
   */
  const theme =
    aerpGetTheme();

  dashboardRange
    .setBackground(
      theme.colors
        .surface
        .page
    )
    .setFontFamily(
      theme.typography
        .fontFamily
        .primary
    );

  return sheet;
}


/* ============================================================
 * 6. VALIDATION
 * ============================================================
 */

/**
 * Validates required modules and public functions.
 *
 * @private
 */
/**
 * Validates the Enterprise Dashboard section configuration.
 *
 * @return {Object} Validation result.
 * @private
 */
function aerpValidateEnterpriseDashboardSections_() {
  const errors = [];

  const supportedSections = [
    'header',
    'status',
    'kpis',
    'build',
    'footer'
  ];

  const registeredIds = {};

  if (
    !Array.isArray(
      AERP_ENTERPRISE_DASHBOARD_SECTIONS
    )
  ) {
    errors.push(
      'Dashboard section configuration must be an array.'
    );

    return {
      ok: false,
      errors: errors
    };
  }

  AERP_ENTERPRISE_DASHBOARD_SECTIONS
    .forEach(function(section, index) {
      if (
        !section ||
        typeof section !== 'object'
      ) {
        errors.push(
          'Invalid section definition at index ' +
          index +
          '.'
        );

        return;
      }

      if (
        typeof section.id !== 'string' ||
        section.id.trim() === ''
      ) {
        errors.push(
          'Section id is required at index ' +
          index +
          '.'
        );

        return;
      }

      if (
        supportedSections.indexOf(
          section.id
        ) === -1
      ) {
        errors.push(
          'Unsupported Dashboard section: ' +
          section.id
        );
      }

      if (
        registeredIds[section.id]
      ) {
        errors.push(
          'Duplicated Dashboard section: ' +
          section.id
        );
      }

      registeredIds[section.id] =
        true;

      if (
        typeof section.enabled !==
        'boolean'
      ) {
        errors.push(
          'Section enabled must be boolean: ' +
          section.id
        );
      }

      if (
        !Number.isFinite(
          Number(section.order)
        )
      ) {
        errors.push(
          'Section order must be numeric: ' +
          section.id
        );
      }
    });

  return {
    ok: errors.length === 0,
    sectionCount:
      AERP_ENTERPRISE_DASHBOARD_SECTIONS
        .length,
    errors: errors
  };
}
function aerpValidateEnterpriseDashboardDependencies_() {
  const requiredFunctions = [
    'aerpGetTheme',
    'aerpCreateComponent',
    'aerpRenderComponent',
    'aerpGetCommercialDashboardMetrics_',
    'aerpCreateHeader_',
    'aerpCreateSubHeader_',
    'aerpCreateStatusBanner_',
    'aerpCreateFooter_',
    'aerpCreateDashboardLayout',
    'aerpAddLayoutComponent',
    'aerpValidateDashboardLayout',
    'aerpCalculateDashboardLayout',
    'aerpRenderDashboardLayout',
    'aerpCreateDashboardHeroSpecification',
    'aerpCreateDashboardKpiSpecification',
  ];

  const errors = [];

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

  if (
    errors.length > 0
  ) {
    throw new Error(
      '[AERP-030] Dependencias incompletas: ' +
      errors.join(' | ')
    );
  }
  const sectionValidation =
    aerpValidateEnterpriseDashboardSections_();

  if (!sectionValidation.ok) {
    throw new Error(
      '[AERP-030] Invalid section configuration: ' +
      sectionValidation.errors.join(' | ')
    );
  }
}


/* ============================================================
 * 7. TEST
 * ============================================================
 */

/**
 * Executes the official Dashboard Enterprise test.
 *
 * @return {Object} Test result.
 */
function testDashboardEnterprise() {
  const result =
    aerpBuildEnterpriseDashboard();

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  if (!result.ok) {
    throw new Error(
      'Dashboard Enterprise falló en [' +
      result.stage +
      ']: ' +
      result.message
    );
  }

  const ss =
    aerpGetSpreadsheet();

  const sheet =
    ss.getSheetByName(
      AERP_ENTERPRISE_DASHBOARD_SHEET
    );

  const tests = {
        sectionConfigurationValid:
      aerpValidateEnterpriseDashboardSections_()
        .ok === true,

    fiveSectionsRegistered:
      AERP_ENTERPRISE_DASHBOARD_SECTIONS
        .length === 5,
    sheetAvailable:
      Boolean(sheet),

    eightKpisRendered:
      result.components === 8,

    tablesRendered:
      sheet
        .getRange('A9:E15')
        .getDisplayValues()
        .flat()
        .join(' ')
        .indexOf('TABLAS') !== -1,

    columnsRendered:
      sheet
        .getRange('G9:K15')
        .getDisplayValues()
        .flat()
        .join(' ')
        .indexOf('COLUMNAS') !== -1,

    buildSectionRendered:
      sheet
        .getRange('A42:K48')
        .getDisplayValues()
        .flat()
        .join(' ')
        .indexOf(
          AERP_BRAND.ENGINE_NAME
        ) !== -1
  };

  const testValues =
    Object.keys(
      tests
    ).map(function(testName) {
      return tests[testName];
    });

  const testResult = {
    ok:
      result.ok &&
      testValues.every(function(value) {
        return value === true;
      }),

    module:
      'AERP-030',

    version:
      AERP_ENTERPRISE_DASHBOARD_VERSION,

    phase:
      'Enterprise KPI Layout',

    sheet:
      AERP_ENTERPRISE_DASHBOARD_SHEET,

    tests:
      tests,

    build:
      result
  };

  Logger.log(
    JSON.stringify(
      testResult,
      null,
      2
    )
  );

  if (!testResult.ok) {
    throw new Error(
      'Dashboard Enterprise no superó todas las pruebas.'
    );
  }

  return testResult;
}

/**
 * Tests the Enterprise Dashboard integration with:
 * - AERP-033 Layout Engine
 * - AERP-035 Sheet Renderer
 *
 * Creates or replaces:
 * AERP_TEST_ENTERPRISE_LAYOUT
 *
 * @return {Object} Test result.
 */
function testEnterpriseDashboardLayoutPipeline() {
  const result = {
    ok: false,

    module:
      'AERP-030',

    version:
      AERP_ENTERPRISE_DASHBOARD_VERSION,

    phase:
      'Layout Engine Integration',

    sheet:
      'AERP_TEST_ENTERPRISE_LAYOUT',

    tests: {
      sheetCreated: false,
      dependenciesAvailable: false,
      specificationCreated: false,
      layoutCreated: false,
      placementsCalculated: false,
      heroCalculated: false,
      eightKpisCalculated: false,
      sheetRendered: false,
      heroRendered: false,
      kpisRendered: false,
      reportCompleted: false
    },

    pipeline:
      null,

    errors: []
  };

  try {
    aerpValidateEnterpriseDashboardDependencies_();

result.tests.dependenciesAvailable =
  true;

    const ss =
      aerpGetSpreadsheet();

    const existingSheet =
      ss.getSheetByName(
        result.sheet
      );

    if (existingSheet) {
      ss.deleteSheet(
        existingSheet
      );

      SpreadsheetApp.flush();
    }

    const sheet =
      ss.insertSheet(
        result.sheet
      );

    result.tests.sheetCreated =
      Boolean(sheet);

    const metrics =
      aerpGetCommercialDashboardMetrics_();

    const specification =
      aerpCreateEnterpriseDashboardSpecification_(
        metrics
      );

    result.tests.specificationCreated =
      Boolean(
        specification &&
        typeof specification ===
          'object'
      );

    const pipeline =
      aerpRenderEnterpriseDashboardWithLayout_(
        sheet,
        specification,
        {
          activateSheet:
            true
        }
      );

    result.pipeline =
      pipeline;

    result.tests.layoutCreated =
      pipeline.tests.layoutCreated ===
        true;

    result.tests.placementsCalculated =
      pipeline.tests
        .placementsCalculated ===
        true;

    const heroPlacements =
      pipeline
        .calculatedLayout
        .placements
        .filter(function(placement) {
          return (
            placement.type ===
            'hero'
          );
        });

    const kpiPlacements =
      pipeline
        .calculatedLayout
        .placements
        .filter(function(placement) {
          return (
            placement.type ===
            'kpi'
          );
        });

    result.tests.heroCalculated =
      heroPlacements.length === 1;

    result.tests.eightKpisCalculated =
      kpiPlacements.length === 8;

    result.tests.sheetRendered =
      pipeline.renderingReport.ok ===
        true;

    const displayText =
      sheet
        .getDataRange()
        .getDisplayValues()
        .flat()
        .join(' ');

    result.tests.heroRendered =
      displayText.indexOf(
        'Alef ERP'
      ) !== -1 ||
      displayText.indexOf(
        'Enterprise'
      ) !== -1;

    result.tests.kpisRendered =
      pipeline
        .renderingReport
        .renderedCount >= 9;

    result.tests.reportCompleted =
      typeof pipeline
        .renderingReport
        .completedAt ===
        'string' &&
      pipeline
        .renderingReport
        .completedAt
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
      'Enterprise Dashboard Layout Pipeline no superó todas las pruebas.'
    );
  }

  return result;
}


