/**
 * ============================================================
 * ALEF PLATFORM
 * Enterprise Layout Engine
 * ------------------------------------------------------------
 * Module : AERP-033
 * Name   : Layout Engine
 * Version: 1.0.0
 * Status : Phase 1 - Placement Foundation
 * ------------------------------------------------------------
 * Description:
 * Provides the declarative layout and automatic placement
 * engine used by Alef Platform dashboards.
 *
 * Responsibilities:
 * - Create declarative dashboard layouts.
 * - Register reusable components.
 * - Validate layout definitions.
 * - Calculate automatic component placements.
 * - Produce numeric coordinates and A1 ranges.
 *
 * This module does not render visual components.
 *
 * Public API:
 * - aerpCreateDashboardLayout(config)
 * - aerpAddLayoutComponent(layout, component, placement)
 * - aerpValidateDashboardLayout(layout)
 * - aerpCalculateDashboardLayout(layout)
 *
 * Compatibility API:
 * - aerpCreateDashboardGrid(config)
 * - aerpAddDashboardComponent(grid, component, placement)
 * - aerpValidateDashboardGrid(grid)
 *
 * Dependencies:
 * - AERP-034 Layout Foundation
 * ============================================================
 */


/* ============================================================
 * 1. MODULE CONSTANTS
 * ============================================================
 */

const AERP_LAYOUT_ENGINE_VERSION =
  '1.0.0';


const AERP_LAYOUT_ENGINE_DEFAULT = {
  columns: 12,
  gutterColumns: 0,
  gutterRows: 1,
  marginTop: 0,
  marginLeft: 0
};


/**
 * Backward-compatible constants.
 *
 * @deprecated Use AERP_LAYOUT_ENGINE_VERSION and
 * AERP_LAYOUT_ENGINE_DEFAULT.
 */
const AERP_DASHBOARD_GRID_VERSION =
  AERP_LAYOUT_ENGINE_VERSION;


const AERP_DASHBOARD_GRID_DEFAULT = {
  columns:
    AERP_LAYOUT_ENGINE_DEFAULT.columns,

  gutter:
    AERP_LAYOUT_ENGINE_DEFAULT.gutterRows,

  marginTop:
    AERP_LAYOUT_ENGINE_DEFAULT.marginTop,

  marginLeft:
    AERP_LAYOUT_ENGINE_DEFAULT.marginLeft
};

/* ============================================================
 * 2. PUBLIC API
 * ============================================================
 */

/**
 * Creates a declarative Dashboard Layout.
 *
 * @param {Object=} config Optional layout configuration.
 * @return {Object} Dashboard Layout model.
 */
function aerpCreateDashboardLayout(
  config
) {
  const options =
    aerpNormalizeLayoutOptions_(
      config
    );

  const columns =
    aerpNormalizeLayoutPositiveInteger_(
      options.columns,
      AERP_LAYOUT_ENGINE_DEFAULT.columns,
      'columns'
    );

  const gutterColumns =
    aerpNormalizeLayoutNonNegativeInteger_(
      options.gutterColumns,
      AERP_LAYOUT_ENGINE_DEFAULT.gutterColumns,
      'gutterColumns'
    );

  const gutterRows =
    aerpNormalizeLayoutNonNegativeInteger_(
      options.gutterRows,
      AERP_LAYOUT_ENGINE_DEFAULT.gutterRows,
      'gutterRows'
    );

  const marginTop =
    aerpNormalizeLayoutNonNegativeInteger_(
      options.marginTop,
      AERP_LAYOUT_ENGINE_DEFAULT.marginTop,
      'marginTop'
    );

  const marginLeft =
    aerpNormalizeLayoutNonNegativeInteger_(
      options.marginLeft,
      AERP_LAYOUT_ENGINE_DEFAULT.marginLeft,
      'marginLeft'
    );

  const id =
    aerpNormalizeLayoutIdentifier_(
      options.id ||
      'dashboard-layout',
      'layout id'
    );

  return {
    id:
      id,

    module:
      'AERP-033',

    version:
      AERP_LAYOUT_ENGINE_VERSION,

    strategy:
      'ROW_FLOW',

    columns:
      columns,

    gutterColumns:
      gutterColumns,

    gutterRows:
      gutterRows,

    marginTop:
      marginTop,

    marginLeft:
      marginLeft,

    components: [],

    metadata: {
      status:
        'DRAFT',

      componentCount:
        0,

      enabledComponentCount:
        0,

      totalRows:
        0,

      createdAt:
        new Date().toISOString(),

      calculatedAt:
        null
    }
  };
}


/**
 * Adds one component to a Dashboard Layout.
 *
 * Components are registered without Google Sheets coordinates.
 * Coordinates are calculated later by the Placement Engine.
 *
 * @param {Object} layout Dashboard Layout model.
 * @param {Object} component Component definition.
 * @param {Object=} placement Placement configuration.
 * @return {Object} Updated Dashboard Layout.
 */
function aerpAddLayoutComponent(
  layout,
  component,
  placement
) {
  aerpRequireDashboardLayout_(
    layout
  );

  if (
    !component ||
    typeof component !== 'object' ||
    Array.isArray(component)
  ) {
    throw new Error(
      '[AERP-033] Layout component must be an object.'
    );
  }

  const options =
    aerpNormalizeLayoutOptions_(
      placement
    );

  const componentId =
    aerpResolveLayoutComponentId_(
      component,
      layout.components.length
    );

  const duplicated =
    layout.components.some(
      function(entry) {
        return (
          entry &&
          entry.id === componentId
        );
      }
    );

  if (duplicated) {
    throw new Error(
      '[AERP-033] Duplicated component id: ' +
      componentId
    );
  }

  const fullWidth =
    options.fullWidth === true;

  const columnSpan =
    fullWidth
      ? layout.columns
      : aerpNormalizeLayoutPositiveInteger_(
          options.columnSpan,
          layout.columns,
          'columnSpan'
        );

  if (
    columnSpan >
    layout.columns
  ) {
    throw new Error(
      '[AERP-033] Component columnSpan cannot exceed layout columns.'
    );
  }

  const rowSpan =
    aerpNormalizeLayoutPositiveInteger_(
      options.rowSpan,
      1,
      'rowSpan'
    );

  const order =
    options.order === undefined ||
    options.order === null ||
    options.order === ''
      ? layout.components.length + 1
      : Number(options.order);

  if (
    !Number.isFinite(order)
  ) {
    throw new Error(
      '[AERP-033] Component order must be numeric.'
    );
  }

  const entry = {
    id:
      componentId,

    type:
      aerpNormalizeLayoutIdentifier_(
        options.type ||
        component.type ||
        component.component ||
        'component',
        'component type'
      ),

    component:
      component,

    placement: {
      columnSpan:
        columnSpan,

      rowSpan:
        rowSpan,

      order:
        order,

      region:
        aerpNormalizeLayoutIdentifier_(
          options.region ||
          'main',
          'component region'
        ),

      fullWidth:
        fullWidth,

      enabled:
        options.enabled !== false
    },

    calculated:
      null
  };

  layout.components.push(
    entry
  );

  layout.metadata.componentCount =
    layout.components.length;

  layout.metadata.enabledComponentCount =
    layout.components.filter(
      function(item) {
        return (
          item &&
          item.placement &&
          item.placement.enabled === true
        );
      }
    ).length;

  layout.metadata.status =
    'DRAFT';

  layout.metadata.calculatedAt =
    null;

  return layout;
}


/**
 * Validates a Dashboard Layout model.
 *
 * @param {*} layout Dashboard Layout candidate.
 * @return {Object} Validation result.
 */
function aerpValidateDashboardLayout(
  layout
) {
  const errors = [];

  if (
    !layout ||
    typeof layout !== 'object' ||
    Array.isArray(layout)
  ) {
    return {
      ok: false,
      module: 'AERP-033',
      version: AERP_LAYOUT_ENGINE_VERSION,
      componentCount: 0,
      errors: [
        'Layout must be an object.'
      ]
    };
  }

  if (
    typeof layout.id !== 'string' ||
    layout.id.trim() === ''
  ) {
    errors.push(
      'Layout id is required.'
    );
  }

  if (
    !Number.isInteger(
      layout.columns
    ) ||
    layout.columns < 1
  ) {
    errors.push(
      'Layout columns must be a positive integer.'
    );
  }

  if (
    !Number.isInteger(
      layout.gutterColumns
    ) ||
    layout.gutterColumns < 0
  ) {
    errors.push(
      'Layout gutterColumns must be a non-negative integer.'
    );
  }

  if (
    !Number.isInteger(
      layout.gutterRows
    ) ||
    layout.gutterRows < 0
  ) {
    errors.push(
      'Layout gutterRows must be a non-negative integer.'
    );
  }

  if (
    !Number.isInteger(
      layout.marginTop
    ) ||
    layout.marginTop < 0
  ) {
    errors.push(
      'Layout marginTop must be a non-negative integer.'
    );
  }

  if (
    !Number.isInteger(
      layout.marginLeft
    ) ||
    layout.marginLeft < 0
  ) {
    errors.push(
      'Layout marginLeft must be a non-negative integer.'
    );
  }

  if (
    !Array.isArray(
      layout.components
    )
  ) {
    errors.push(
      'Layout components must be an array.'
    );
  } else {
    const registeredIds = {};

    layout.components.forEach(
      function(entry, index) {
        if (
          !entry ||
          typeof entry !== 'object' ||
          Array.isArray(entry)
        ) {
          errors.push(
            'Invalid component entry at index ' +
            index +
            '.'
          );

          return;
        }

        if (
          typeof entry.id !== 'string' ||
          entry.id.trim() === ''
        ) {
          errors.push(
            'Component id is required at index ' +
            index +
            '.'
          );
        } else {
          if (
            registeredIds[
              entry.id
            ]
          ) {
            errors.push(
              'Duplicated component id: ' +
              entry.id
            );
          }

          registeredIds[
            entry.id
          ] =
            true;
        }

        if (
          !entry.component ||
          typeof entry.component !== 'object'
        ) {
          errors.push(
            'Component definition is required: ' +
            String(entry.id || index)
          );
        }

        if (
          !entry.placement ||
          typeof entry.placement !== 'object'
        ) {
          errors.push(
            'Component placement is required: ' +
            String(entry.id || index)
          );

          return;
        }

        if (
          !Number.isInteger(
            entry.placement.columnSpan
          ) ||
          entry.placement.columnSpan < 1 ||
          entry.placement.columnSpan >
            layout.columns
        ) {
          errors.push(
            'Invalid columnSpan: ' +
            String(entry.id || index)
          );
        }

        if (
          !Number.isInteger(
            entry.placement.rowSpan
          ) ||
          entry.placement.rowSpan < 1
        ) {
          errors.push(
            'Invalid rowSpan: ' +
            String(entry.id || index)
          );
        }

        if (
          !Number.isFinite(
            Number(
              entry.placement.order
            )
          )
        ) {
          errors.push(
            'Invalid order: ' +
            String(entry.id || index)
          );
        }

        if (
          typeof entry.placement.enabled !==
          'boolean'
        ) {
          errors.push(
            'Component enabled must be boolean: ' +
            String(entry.id || index)
          );
        }

        if (
          typeof entry.placement.fullWidth !==
          'boolean'
        ) {
          errors.push(
            'Component fullWidth must be boolean: ' +
            String(entry.id || index)
          );
        }
      }
    );
  }

  return {
    ok:
      errors.length === 0,

    module:
      'AERP-033',

    version:
      AERP_LAYOUT_ENGINE_VERSION,

    componentCount:
      Array.isArray(
        layout.components
      )
        ? layout.components.length
        : 0,

    errors:
      errors
  };
}


/**
 * Calculates automatic placements for enabled components.
 *
 * Placement strategy:
 * - Components flow from left to right.
 * - Components wrap automatically when they do not fit.
 * - Components are ordered by placement.order.
 * - Disabled components do not consume space.
 * - Full-width components always occupy a complete row.
 *
 * The function calculates coordinates but does not render
 * anything in Google Sheets.
 *
 * @param {Object} layout Dashboard Layout model.
 * @return {Object} Calculated Layout result.
 */
function aerpCalculateDashboardLayout(
  layout
) {
  const validation =
    aerpValidateDashboardLayout(
      layout
    );

  if (!validation.ok) {
    throw new Error(
      '[AERP-033] Invalid Dashboard Layout: ' +
      validation.errors.join(' | ')
    );
  }

  const enabledComponents =
    layout.components
      .filter(function(entry) {
        return (
          entry &&
          entry.placement &&
          entry.placement.enabled === true
        );
      })
      .slice()
      .sort(function(first, second) {
        const orderDifference =
          Number(
            first.placement.order
          ) -
          Number(
            second.placement.order
          );

        if (orderDifference !== 0) {
          return orderDifference;
        }

        return (
          layout.components.indexOf(
            first
          ) -
          layout.components.indexOf(
            second
          )
        );
      });

  const placements = [];

  const firstColumn =
    layout.marginLeft + 1;

  const lastColumn =
    layout.marginLeft +
    layout.columns;

  let currentRow =
    layout.marginTop + 1;

  let currentColumn =
    firstColumn;

  let activeRowHeight =
    0;

  enabledComponents.forEach(
    function(entry) {
      const placement =
        entry.placement;

      const fullWidth =
        placement.fullWidth === true;

      const columnSpan =
        fullWidth
          ? layout.columns
          : placement.columnSpan;

      const rowSpan =
        placement.rowSpan;

      /*
       * Full-width components begin on a fresh logical row.
       */
      if (
        fullWidth &&
        currentColumn !== firstColumn
      ) {
        currentRow +=
          activeRowHeight +
          layout.gutterRows;

        currentColumn =
          firstColumn;

        activeRowHeight =
          0;
      }

      /*
       * Wrap when the component does not fit.
       */
      const projectedEndColumn =
        currentColumn +
        columnSpan -
        1;

      if (
        projectedEndColumn >
        lastColumn
      ) {
        currentRow +=
          activeRowHeight +
          layout.gutterRows;

        currentColumn =
          firstColumn;

        activeRowHeight =
          0;
      }

      const startRow =
        currentRow;

      const endRow =
        startRow +
        rowSpan -
        1;

      const startColumn =
        currentColumn;

      const endColumn =
        startColumn +
        columnSpan -
        1;

      const calculatedPlacement = {
        id:
          entry.id,

        type:
          entry.type,

        component:
          entry.component,

        region:
          placement.region,

        order:
          placement.order,

        fullWidth:
          fullWidth,

        startRow:
          startRow,

        endRow:
          endRow,

        startColumn:
          startColumn,

        endColumn:
          endColumn,

        rowSpan:
          rowSpan,

        columnSpan:
          columnSpan,

        rangeA1:
          aerpLayoutCoordinatesToA1_(
            startRow,
            startColumn,
            endRow,
            endColumn
          )
      };

      placements.push(
        calculatedPlacement
      );

      entry.calculated =
        aerpCloneLayoutPlacement_(
          calculatedPlacement
        );

      activeRowHeight =
        Math.max(
          activeRowHeight,
          rowSpan
        );

      if (fullWidth) {
        currentRow +=
          rowSpan +
          layout.gutterRows;

        currentColumn =
          firstColumn;

        activeRowHeight =
          0;

        return;
      }

      currentColumn +=
        columnSpan +
        layout.gutterColumns;
    }
  );

  const totalRows =
    placements.length === 0
      ? 0
      : Math.max.apply(
          null,
          placements.map(
            function(item) {
              return item.endRow;
            }
          )
        );

  layout.metadata.status =
    'CALCULATED';

  layout.metadata.calculatedAt =
    new Date().toISOString();

  layout.metadata.totalRows =
    totalRows;

  layout.metadata.enabledComponentCount =
    placements.length;

  return {
    ok: true,

    module:
      'AERP-033',

    version:
      AERP_LAYOUT_ENGINE_VERSION,

    layoutId:
      layout.id,

    strategy:
      layout.strategy,

    columns:
      layout.columns,

    totalRows:
      totalRows,

    componentCount:
      placements.length,

    placements:
      placements,

    errors: []
  };
}


/* ------------------------------------------------------------
 * BACKWARD-COMPATIBILITY API
 * ------------------------------------------------------------
 */

/**
 * @deprecated Use aerpCreateDashboardLayout().
 */
function aerpCreateDashboardGrid(
  config
) {
  const options =
    aerpNormalizeLayoutOptions_(
      config
    );

  return aerpCreateDashboardLayout({
    id:
      options.id,

    columns:
      options.columns,

    gutterColumns:
      options.gutterColumns,

    gutterRows:
      options.gutterRows !== undefined
        ? options.gutterRows
        : options.gutter,

    marginTop:
      options.marginTop,

    marginLeft:
      options.marginLeft
  });
}


/**
 * @deprecated Use aerpAddLayoutComponent().
 */
function aerpAddDashboardComponent(
  grid,
  component,
  placement
) {
  return aerpAddLayoutComponent(
    grid,
    component,
    placement
  );
}


/**
 * @deprecated Use aerpValidateDashboardLayout().
 */
function aerpValidateDashboardGrid(
  grid
) {
  return aerpValidateDashboardLayout(
    grid
  );
}

/* ============================================================
 * 3. PRIVATE HELPERS
 * ============================================================
 */

/**
 * Normalizes an optional configuration object.
 *
 * @param {*} value Configuration candidate.
 * @return {Object} Normalized configuration.
 * @private
 */
function aerpNormalizeLayoutOptions_(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return {};
  }

  if (
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(
      '[AERP-033] Layout configuration must be an object.'
    );
  }

  return value;
}


/**
 * Requires a valid Dashboard Layout model.
 *
 * @param {*} layout Layout candidate.
 * @return {Object} Valid Layout model.
 * @private
 */
function aerpRequireDashboardLayout_(
  layout
) {
  if (
    !layout ||
    typeof layout !== 'object' ||
    Array.isArray(layout) ||
    !Array.isArray(layout.components)
  ) {
    throw new Error(
      '[AERP-033] A valid Dashboard Layout is required.'
    );
  }

  return layout;
}


/**
 * Resolves a stable component identifier.
 *
 * Resolution order:
 * - component.id
 * - component.properties.id
 * - generated sequential id
 *
 * @param {Object} component Component definition.
 * @param {number} index Current component index.
 * @return {string} Component identifier.
 * @private
 */
function aerpResolveLayoutComponentId_(
  component,
  index
) {
  const candidate =
    component.id ||
    (
      component.properties &&
      component.properties.id
    ) ||
    (
      'layout-component-' +
      String(index + 1)
    );

  return aerpNormalizeLayoutIdentifier_(
    candidate,
    'component id'
  );
}


/**
 * Normalizes a textual identifier.
 *
 * @param {*} value Identifier candidate.
 * @param {string} fieldName Field name.
 * @return {string} Normalized identifier.
 * @private
 */
function aerpNormalizeLayoutIdentifier_(
  value,
  fieldName
) {
  const normalized =
    String(
      value === undefined ||
      value === null
        ? ''
        : value
    ).trim();

  if (!normalized) {
    throw new Error(
      '[AERP-033] ' +
      fieldName +
      ' is required.'
    );
  }

  return normalized;
}


/**
 * Normalizes a positive integer.
 *
 * @param {*} value Input value.
 * @param {number} fallback Fallback value.
 * @param {string} fieldName Field name.
 * @return {number} Normalized positive integer.
 * @private
 */
function aerpNormalizeLayoutPositiveInteger_(
  value,
  fallback,
  fieldName
) {
  const candidate =
    value === undefined ||
    value === null ||
    value === ''
      ? fallback
      : Number(value);

  if (
    !Number.isInteger(candidate) ||
    candidate < 1
  ) {
    throw new Error(
      '[AERP-033] ' +
      fieldName +
      ' must be a positive integer.'
    );
  }

  return candidate;
}


/**
 * Normalizes a non-negative integer.
 *
 * @param {*} value Input value.
 * @param {number} fallback Fallback value.
 * @param {string} fieldName Field name.
 * @return {number} Normalized non-negative integer.
 * @private
 */
function aerpNormalizeLayoutNonNegativeInteger_(
  value,
  fallback,
  fieldName
) {
  const candidate =
    value === undefined ||
    value === null ||
    value === ''
      ? fallback
      : Number(value);

  if (
    !Number.isInteger(candidate) ||
    candidate < 0
  ) {
    throw new Error(
      '[AERP-033] ' +
      fieldName +
      ' must be a non-negative integer.'
    );
  }

  return candidate;
}


/**
 * Converts numeric spreadsheet coordinates to A1 notation.
 *
 * Example:
 * 1, 1, 5, 12 -> A1:L5
 *
 * @param {number} startRow Starting row.
 * @param {number} startColumn Starting column.
 * @param {number} endRow Ending row.
 * @param {number} endColumn Ending column.
 * @return {string} A1 range.
 * @private
 */
function aerpLayoutCoordinatesToA1_(
  startRow,
  startColumn,
  endRow,
  endColumn
) {
  aerpValidateLayoutCoordinates_(
    startRow,
    startColumn,
    endRow,
    endColumn
  );

  return (
    aerpLayoutColumnToLetter_(
      startColumn
    ) +
    startRow +
    ':' +
    aerpLayoutColumnToLetter_(
      endColumn
    ) +
    endRow
  );
}


/**
 * Validates numeric spreadsheet coordinates.
 *
 * @param {*} startRow Starting row.
 * @param {*} startColumn Starting column.
 * @param {*} endRow Ending row.
 * @param {*} endColumn Ending column.
 * @return {boolean} True when valid.
 * @private
 */
function aerpValidateLayoutCoordinates_(
  startRow,
  startColumn,
  endRow,
  endColumn
) {
  const values = [
    startRow,
    startColumn,
    endRow,
    endColumn
  ];

  const valid =
    values.every(function(value) {
      return (
        Number.isInteger(
          Number(value)
        ) &&
        Number(value) >= 1
      );
    });

  if (!valid) {
    throw new Error(
      '[AERP-033] Layout coordinates must be positive integers.'
    );
  }

  if (
    Number(endRow) <
      Number(startRow)
  ) {
    throw new Error(
      '[AERP-033] endRow cannot be lower than startRow.'
    );
  }

  if (
    Number(endColumn) <
      Number(startColumn)
  ) {
    throw new Error(
      '[AERP-033] endColumn cannot be lower than startColumn.'
    );
  }

  return true;
}


/**
 * Converts a numeric column index to spreadsheet letters.
 *
 * Examples:
 * - 1 -> A
 * - 12 -> L
 * - 26 -> Z
 * - 27 -> AA
 *
 * @param {*} column Column index.
 * @return {string} Column letters.
 * @private
 */
function aerpLayoutColumnToLetter_(
  column
) {
  let number =
    Number(column);

  if (
    !Number.isInteger(number) ||
    number < 1
  ) {
    throw new Error(
      '[AERP-033] Column index must be a positive integer.'
    );
  }

  let result = '';

  while (number > 0) {
    const remainder =
      (number - 1) % 26;

    result =
      String.fromCharCode(
        65 + remainder
      ) +
      result;

    number =
      Math.floor(
        (number - 1) / 26
      );
  }

  return result;
}


/**
 * Creates a detached copy of a calculated placement.
 *
 * The component object is intentionally not copied into the
 * stored placement metadata.
 *
 * @param {Object} placement Calculated placement.
 * @return {Object} Cloned placement.
 * @private
 */
function aerpCloneLayoutPlacement_(
  placement
) {
  if (
    !placement ||
    typeof placement !== 'object'
  ) {
    throw new Error(
      '[AERP-033] A calculated placement is required.'
    );
  }

  return {
    id:
      placement.id,

    type:
      placement.type,

    region:
      placement.region,

    order:
      placement.order,

    fullWidth:
      placement.fullWidth,

    startRow:
      placement.startRow,

    endRow:
      placement.endRow,

    startColumn:
      placement.startColumn,

    endColumn:
      placement.endColumn,

    rowSpan:
      placement.rowSpan,

    columnSpan:
      placement.columnSpan,

    rangeA1:
      placement.rangeA1
  };
}


/**
 * Returns all enabled layout entries ordered deterministically.
 *
 * @param {Object} layout Dashboard Layout.
 * @return {Array<Object>} Ordered enabled entries.
 * @private
 */
function aerpGetOrderedEnabledLayoutComponents_(
  layout
) {
  aerpRequireDashboardLayout_(
    layout
  );

  return layout.components
    .filter(function(entry) {
      return (
        entry &&
        entry.placement &&
        entry.placement.enabled === true
      );
    })
    .map(function(entry, index) {
      return {
        entry:
          entry,

        sourceIndex:
          index
      };
    })
    .sort(function(first, second) {
      const orderDifference =
        Number(
          first.entry
            .placement
            .order
        ) -
        Number(
          second.entry
            .placement
            .order
        );

      if (orderDifference !== 0) {
        return orderDifference;
      }

      return (
        first.sourceIndex -
        second.sourceIndex
      );
    })
    .map(function(item) {
      return item.entry;
    });
}


/**
 * Detects collisions between calculated placements.
 *
 * Current ROW_FLOW placement should not create collisions.
 * This helper protects future layout strategies.
 *
 * @param {Array<Object>} placements Calculated placements.
 * @return {Object} Collision validation result.
 * @private
 */
function aerpValidateLayoutCollisions_(
  placements
) {
  if (!Array.isArray(placements)) {
    throw new Error(
      '[AERP-033] Placements must be an array.'
    );
  }

  const collisions = [];

  for (
    let firstIndex = 0;
    firstIndex <
      placements.length;
    firstIndex += 1
  ) {
    const first =
      placements[firstIndex];

    for (
      let secondIndex =
        firstIndex + 1;
      secondIndex <
        placements.length;
      secondIndex += 1
    ) {
      const second =
        placements[secondIndex];

      const rowsOverlap =
        first.startRow <=
          second.endRow &&
        first.endRow >=
          second.startRow;

      const columnsOverlap =
        first.startColumn <=
          second.endColumn &&
        first.endColumn >=
          second.startColumn;

      if (
        rowsOverlap &&
        columnsOverlap
      ) {
        collisions.push({
          firstId:
            first.id,

          secondId:
            second.id
        });
      }
    }
  }

  return {
    ok:
      collisions.length === 0,

    collisionCount:
      collisions.length,

    collisions:
      collisions
  };
}


/* ------------------------------------------------------------
 * BACKWARD-COMPATIBILITY HELPERS
 * ------------------------------------------------------------
 */

/**
 * @deprecated Use aerpRequireDashboardLayout_().
 */
function aerpRequireDashboardGrid_(
  grid
) {
  return aerpRequireDashboardLayout_(
    grid
  );
}


/**
 * @deprecated Use aerpResolveLayoutComponentId_().
 */
function aerpResolveDashboardGridComponentId_(
  component,
  index
) {
  return aerpResolveLayoutComponentId_(
    component,
    index
  );
}


/**
 * @deprecated Use aerpNormalizeLayoutPositiveInteger_().
 */
function aerpNormalizeDashboardGridPositiveInteger_(
  value,
  fallback,
  fieldName
) {
  return aerpNormalizeLayoutPositiveInteger_(
    value,
    fallback,
    fieldName
  );
}


/**
 * @deprecated Use aerpNormalizeLayoutNonNegativeInteger_().
 */
function aerpNormalizeDashboardGridNonNegativeInteger_(
  value,
  fallback,
  fieldName
) {
  return aerpNormalizeLayoutNonNegativeInteger_(
    value,
    fallback,
    fieldName
  );
}


/**
 * @deprecated Use aerpLayoutCoordinatesToA1_().
 */
function aerpDashboardGridCoordinatesToA1_(
  startRow,
  startColumn,
  endRow,
  endColumn
) {
  return aerpLayoutCoordinatesToA1_(
    startRow,
    startColumn,
    endRow,
    endColumn
  );
}


/**
 * @deprecated Use aerpLayoutColumnToLetter_().
 */
function aerpDashboardGridColumnToLetter_(
  column
) {
  return aerpLayoutColumnToLetter_(
    column
  );
}


/**
 * @deprecated Use aerpCloneLayoutPlacement_().
 */
function aerpCloneDashboardGridPlacement_(
  placement
) {
  return aerpCloneLayoutPlacement_(
    placement
  );
}

/* ============================================================
 * 4. TESTS
 * ============================================================
 */

/**
 * Tests the Layout Engine foundation.
 *
 * This test validates:
 * - Layout creation.
 * - Default configuration.
 * - Custom configuration.
 * - Component registration.
 * - Duplicate protection.
 * - Span validation.
 * - Model validation.
 *
 * This test does not render a Google Sheets sheet.
 *
 * @return {Object} Test result.
 */
function testLayoutEngineFoundation() {
  const result = {
    ok: false,

    module:
      'AERP-033',

    version:
      AERP_LAYOUT_ENGINE_VERSION,

    phase:
      'Layout Engine Foundation',

    tests: {
      layoutCreated: false,
      defaultsApplied: false,
      customConfigurationApplied: false,
      heroAdded: false,
      kpiAdded: false,
      componentCountUpdated: false,
      enabledComponentCountUpdated: false,
      componentOrderPreserved: false,
      validationPassed: false,
      duplicatedIdRejected: false,
      invalidSpanRejected: false,
      invalidConfigurationRejected: false,
      compatibilityApiAvailable: false
    },

    layout: null,

    errors: []
  };

  try {
    /*
     * Default configuration.
     */
    const defaultLayout =
      aerpCreateDashboardLayout();

    result.tests.layoutCreated =
      Boolean(
        defaultLayout &&
        defaultLayout.id
      );

    result.tests.defaultsApplied =
      defaultLayout.columns ===
        AERP_LAYOUT_ENGINE_DEFAULT.columns &&
      defaultLayout.gutterColumns ===
        AERP_LAYOUT_ENGINE_DEFAULT.gutterColumns &&
      defaultLayout.gutterRows ===
        AERP_LAYOUT_ENGINE_DEFAULT.gutterRows &&
      defaultLayout.marginTop ===
        AERP_LAYOUT_ENGINE_DEFAULT.marginTop &&
      defaultLayout.marginLeft ===
        AERP_LAYOUT_ENGINE_DEFAULT.marginLeft &&
      Array.isArray(
        defaultLayout.components
      );

    /*
     * Custom configuration.
     */
    const layout =
      aerpCreateDashboardLayout({
        id:
          'enterprise-dashboard-layout',

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

    result.tests.customConfigurationApplied =
      layout.id ===
        'enterprise-dashboard-layout' &&
      layout.columns === 12 &&
      layout.gutterColumns === 0 &&
      layout.gutterRows === 1 &&
      layout.marginTop === 0 &&
      layout.marginLeft === 0;

    /*
     * Hero component.
     */
    aerpAddLayoutComponent(
      layout,
      {
        id:
          'dashboard-hero',

        type:
          'hero'
      },
      {
        type:
          'hero',

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
      }
    );

    result.tests.heroAdded =
      layout.components.length >= 1 &&
      layout.components[0].id ===
        'dashboard-hero' &&
      layout.components[0]
        .placement
        .fullWidth === true;

    /*
     * KPI component.
     */
    aerpAddLayoutComponent(
      layout,
      {
        id:
          'dashboard-kpi-tables',

        type:
          'kpi'
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

    result.tests.kpiAdded =
      layout.components.length >= 2 &&
      layout.components[1].id ===
        'dashboard-kpi-tables' &&
      layout.components[1]
        .placement
        .columnSpan === 6;

    result.tests.componentCountUpdated =
      layout.metadata.componentCount === 2 &&
      layout.components.length === 2;

    result.tests.enabledComponentCountUpdated =
      layout.metadata
        .enabledComponentCount === 2;

    result.tests.componentOrderPreserved =
      layout.components[0]
        .placement
        .order === 10 &&
      layout.components[1]
        .placement
        .order === 20;

    /*
     * Full model validation.
     */
    const validation =
      aerpValidateDashboardLayout(
        layout
      );

    result.tests.validationPassed =
      validation.ok === true &&
      validation.errors.length === 0 &&
      validation.componentCount === 2;

    /*
     * Duplicate id protection.
     */
    try {
      aerpAddLayoutComponent(
        layout,
        {
          id:
            'dashboard-hero',

          type:
            'hero'
        },
        {
          columnSpan:
            12,

          rowSpan:
            5
        }
      );

    } catch (error) {
      result.tests.duplicatedIdRejected =
        String(
          error &&
          error.message
            ? error.message
            : error
        ).indexOf(
          'Duplicated component id'
        ) !== -1;
    }

    /*
     * Invalid span protection.
     */
    try {
      aerpAddLayoutComponent(
        layout,
        {
          id:
            'invalid-component',

          type:
            'kpi'
        },
        {
          columnSpan:
            13,

          rowSpan:
            4
        }
      );

    } catch (error) {
      result.tests.invalidSpanRejected =
        String(
          error &&
          error.message
            ? error.message
            : error
        ).indexOf(
          'columnSpan'
        ) !== -1;
    }

    /*
     * Invalid configuration protection.
     */
    try {
      aerpCreateDashboardLayout({
        columns:
          0
      });

    } catch (error) {
      result.tests
        .invalidConfigurationRejected =
        true;
    }

    /*
     * Backward-compatible API.
     */
    const compatibilityGrid =
      aerpCreateDashboardGrid({
        id:
          'compatibility-grid',

        columns:
          12,

        gutter:
          1,

        marginTop:
          0,

        marginLeft:
          0
      });

    result.tests.compatibilityApiAvailable =
      Boolean(
        compatibilityGrid &&
        compatibilityGrid.id ===
          'compatibility-grid'
      ) &&
      typeof aerpAddDashboardComponent ===
        'function' &&
      typeof aerpValidateDashboardGrid ===
        'function';

    result.layout = {
      id:
        layout.id,

      strategy:
        layout.strategy,

      columns:
        layout.columns,

      gutterColumns:
        layout.gutterColumns,

      gutterRows:
        layout.gutterRows,

      componentCount:
        layout.components.length,

      enabledComponentCount:
        layout.metadata
          .enabledComponentCount,

      components:
        layout.components.map(
          function(entry) {
            return {
              id:
                entry.id,

              type:
                entry.type,

              placement:
                entry.placement
            };
          }
        )
    };

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
      'Layout Engine Foundation no superó todas las pruebas.'
    );
  }

  return result;
}


/**
 * Tests the automatic Placement Engine.
 *
 * Expected placement:
 *
 * Hero:
 * A1:L5
 *
 * KPI 1:
 * A7:F14
 *
 * KPI 2:
 * G7:L14
 *
 * KPI 3:
 * A16:F23
 *
 * Disabled components must not consume space.
 *
 * @return {Object} Test result.
 */
function testLayoutEnginePlacement() {
  const result = {
    ok: false,

    module:
      'AERP-033',

    version:
      AERP_LAYOUT_ENGINE_VERSION,

    phase:
      'Placement Engine',

    tests: {
      layoutCreated: false,
      heroCalculated: false,
      firstKpiCalculated: false,
      secondKpiCalculated: false,
      thirdKpiWrapped: false,
      disabledComponentIgnored: false,
      orderPreserved: false,
      totalRowsCalculated: false,
      componentLayoutsUpdated: false,
      numericCoordinatesCorrect: false,
      a1ConversionWorks: false,
      columnConversionWorks: false,
      collisionValidationPassed: false,
      artificialCollisionDetected: false,
      calculationMetadataUpdated: false
    },

    calculated: null,

    errors: []
  };

  try {
    const layout =
      aerpCreateDashboardLayout({
        id:
          'placement-test-layout',

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
          'placement-test-layout'
      );

    /*
     * Full-width Hero.
     */
    aerpAddLayoutComponent(
      layout,
      {
        id:
          'hero',

        type:
          'hero'
      },
      {
        type:
          'hero',

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
      }
    );

    /*
     * First KPI.
     */
    aerpAddLayoutComponent(
      layout,
      {
        id:
          'kpi-1',

        type:
          'kpi'
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

    /*
     * Second KPI.
     */
    aerpAddLayoutComponent(
      layout,
      {
        id:
          'kpi-2',

        type:
          'kpi'
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

    /*
     * Disabled component.
     */
    aerpAddLayoutComponent(
      layout,
      {
        id:
          'disabled-kpi',

        type:
          'kpi'
      },
      {
        type:
          'kpi',

        columnSpan:
          6,

        rowSpan:
          8,

        order:
          35,

        region:
          'main',

        enabled:
          false
      }
    );

    /*
     * Third KPI must wrap.
     */
    aerpAddLayoutComponent(
      layout,
      {
        id:
          'kpi-3',

        type:
          'kpi'
      },
      {
        type:
          'kpi',

        columnSpan:
          6,

        rowSpan:
          8,

        order:
          40,

        region:
          'main'
      }
    );

    const calculated =
      aerpCalculateDashboardLayout(
        layout
      );

    result.calculated =
      calculated;

    const hero =
      calculated.placements[0];

    const kpi1 =
      calculated.placements[1];

    const kpi2 =
      calculated.placements[2];

    const kpi3 =
      calculated.placements[3];

    result.tests.heroCalculated =
      hero.id === 'hero' &&
      hero.rangeA1 ===
        'A1:L5';

    result.tests.firstKpiCalculated =
      kpi1.id === 'kpi-1' &&
      kpi1.rangeA1 ===
        'A7:F14';

    result.tests.secondKpiCalculated =
      kpi2.id === 'kpi-2' &&
      kpi2.rangeA1 ===
        'G7:L14';

    result.tests.thirdKpiWrapped =
      kpi3.id === 'kpi-3' &&
      kpi3.rangeA1 ===
        'A16:F23';

    result.tests.disabledComponentIgnored =
      calculated.componentCount === 4 &&
      calculated.placements
        .every(function(item) {
          return item.id !==
            'disabled-kpi';
        });

    result.tests.orderPreserved =
      calculated.placements
        .map(function(item) {
          return item.id;
        })
        .join('|') ===
      'hero|kpi-1|kpi-2|kpi-3';

    result.tests.totalRowsCalculated =
      calculated.totalRows === 23;

    result.tests.componentLayoutsUpdated =
      layout.components[0]
        .calculated
        .rangeA1 ===
        'A1:L5' &&
      layout.components[1]
        .calculated
        .rangeA1 ===
        'A7:F14' &&
      layout.components[2]
        .calculated
        .rangeA1 ===
        'G7:L14' &&
      layout.components[4]
        .calculated
        .rangeA1 ===
        'A16:F23' &&
      layout.components[3]
        .calculated === null;

    result.tests.numericCoordinatesCorrect =
      hero.startRow === 1 &&
      hero.endRow === 5 &&
      hero.startColumn === 1 &&
      hero.endColumn === 12 &&
      kpi3.startRow === 16 &&
      kpi3.endRow === 23 &&
      kpi3.startColumn === 1 &&
      kpi3.endColumn === 6;

    result.tests.a1ConversionWorks =
      aerpLayoutCoordinatesToA1_(
        1,
        1,
        5,
        12
      ) === 'A1:L5' &&
      aerpLayoutCoordinatesToA1_(
        16,
        1,
        23,
        6
      ) === 'A16:F23';

    result.tests.columnConversionWorks =
      aerpLayoutColumnToLetter_(
        1
      ) === 'A' &&
      aerpLayoutColumnToLetter_(
        12
      ) === 'L' &&
      aerpLayoutColumnToLetter_(
        26
      ) === 'Z' &&
      aerpLayoutColumnToLetter_(
        27
      ) === 'AA' &&
      aerpLayoutColumnToLetter_(
        52
      ) === 'AZ' &&
      aerpLayoutColumnToLetter_(
        53
      ) === 'BA';

    const collisionValidation =
      aerpValidateLayoutCollisions_(
        calculated.placements
      );

    result.tests.collisionValidationPassed =
      collisionValidation.ok === true &&
      collisionValidation
        .collisionCount === 0;

    const artificialCollision =
      aerpValidateLayoutCollisions_([
        {
          id:
            'collision-a',

          startRow:
            1,

          endRow:
            5,

          startColumn:
            1,

          endColumn:
            6
        },

        {
          id:
            'collision-b',

          startRow:
            4,

          endRow:
            8,

          startColumn:
            5,

          endColumn:
            10
        }
      ]);

    result.tests.artificialCollisionDetected =
      artificialCollision.ok ===
        false &&
      artificialCollision
        .collisionCount === 1 &&
      artificialCollision
        .collisions[0]
        .firstId ===
        'collision-a' &&
      artificialCollision
        .collisions[0]
        .secondId ===
        'collision-b';

    result.tests.calculationMetadataUpdated =
      layout.metadata.status ===
        'CALCULATED' &&
      typeof layout.metadata
        .calculatedAt ===
        'string' &&
      layout.metadata
        .calculatedAt.length > 0 &&
      layout.metadata.totalRows ===
        23 &&
      layout.metadata
        .enabledComponentCount === 4;

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
      'Layout Engine Placement no superó todas las pruebas.'
    );
  }

  return result;
}


/**
 * Runs the complete AERP-033 test suite.
 *
 * @return {Object} Test-suite result.
 */
function testLayoutEngine() {
  const foundation =
    testLayoutEngineFoundation();

  const placement =
    testLayoutEnginePlacement();

  const result = {
    ok:
      foundation.ok === true &&
      placement.ok === true,

    module:
      'AERP-033',

    version:
      AERP_LAYOUT_ENGINE_VERSION,

    phase:
      'Complete Layout Engine Suite',

    tests: {
      foundation:
        foundation.ok,

      placement:
        placement.ok
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
      'Layout Engine no superó la suite completa.'
    );
  }

  return result;
}


/* ------------------------------------------------------------
 * BACKWARD-COMPATIBILITY TESTS
 * ------------------------------------------------------------
 */

/**
 * @deprecated Use testLayoutEngineFoundation().
 *
 * @return {Object} Test result.
 */
function testDashboardGrid() {
  return testLayoutEngineFoundation();
}


/**
 * @deprecated Use testLayoutEnginePlacement().
 *
 * @return {Object} Test result.
 */
function testDashboardLayoutPlacement() {
  return testLayoutEnginePlacement();
}