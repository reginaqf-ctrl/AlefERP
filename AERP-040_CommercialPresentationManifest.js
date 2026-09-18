// @ts-nocheck
/**
 * Alef ERP 1.0 - AERP-040 Commercial Presentation Manifest.
 *
 * Declares views, navigation and dashboards for the approved commercial
 * blueprint. This module is pure: it does not authorize principals, grant
 * permissions, read or write spreadsheets, or integrate with the installer.
 * Authorization remains an external AERP-036/AERP-037 responsibility.
 */

const AERP_PRESENTATION_MANIFEST_VERSION_ = '1.0.0';

const AERP_PRESENTATION_METADATA_TABLES_ = aerpPresentationDeepFreeze_({
  views: 'CORE_VISTAS',
  menus: 'CORE_MENU',
  menuItems: 'CORE_MENU_ITEM',
  dashboards: 'CORE_DASHBOARDS'
});

const AERP_PRESENTATION_SEPARATION_ = aerpPresentationDeepFreeze_({
  authorizationEngine: 'AERP-036',
  metadataRepository: 'AERP-037',
  authorizationDecision: 'EXTERNAL_REQUIRED',
  defaultVisibility: 'HIDDEN',
  visibilityGrantsAuthorization: false,
  denyPrecedence: true
});

const AERP_PRESENTATION_MENU_SPECS_ = aerpPresentationDeepFreeze_([
  ['ADMINISTRACION', 'Administración'],
  ['CLIENTES', 'Clientes'],
  ['PROVEEDORES', 'Proveedores'],
  ['PRODUCTOS', 'Productos'],
  ['INVENTARIO', 'Inventario'],
  ['PEDIDOS', 'Pedidos'],
  ['VENTAS', 'Ventas'],
  ['CONFIGURACION', 'Configuración']
]);

const AERP_PRESENTATION_DASHBOARD_SPECS_ = aerpPresentationDeepFreeze_([
  {
    id: 'DASHBOARD_VENTAS',
    name: 'Panel de ventas',
    module: 'VENTAS',
    layout: 'COMMERCIAL_SUMMARY',
    tableReferences: ['ERP_VENTAS', 'ERP_VENTA_DETALLE', 'ERP_CLIENTES'],
    widgets: [
      ['WIDGET_VENTAS_TOTAL', 'KPI_SUM', 'ERP_VENTAS', 'Total'],
      ['WIDGET_VENTAS_LINEAS', 'KPI_SUM', 'ERP_VENTA_DETALLE', 'Total_Linea'],
      ['WIDGET_CLIENTES_CREDITO', 'KPI_SUM', 'ERP_CLIENTES', 'Limite_Credito']
    ]
  },
  {
    id: 'DASHBOARD_PEDIDOS',
    name: 'Panel de pedidos',
    module: 'PEDIDOS',
    layout: 'COMMERCIAL_SUMMARY',
    tableReferences: ['ERP_PEDIDOS', 'ERP_PEDIDO_DETALLE', 'ERP_CLIENTES'],
    widgets: [
      ['WIDGET_PEDIDOS_TOTAL', 'KPI_SUM', 'ERP_PEDIDOS', 'Total'],
      ['WIDGET_PEDIDOS_LINEAS', 'KPI_SUM', 'ERP_PEDIDO_DETALLE', 'Total_Linea'],
      ['WIDGET_CLIENTES_DIAS_CREDITO', 'KPI_AVERAGE', 'ERP_CLIENTES', 'Dias_Credito']
    ]
  },
  {
    id: 'DASHBOARD_INVENTARIO',
    name: 'Panel de inventario',
    module: 'INVENTARIO',
    layout: 'OPERATIONAL_SUMMARY',
    tableReferences: ['ERP_INVENTARIO', 'ERP_MOVIMIENTOS_INVENTARIO', 'ERP_PRODUCTOS'],
    widgets: [
      ['WIDGET_INVENTARIO_STOCK', 'KPI_SUM', 'ERP_INVENTARIO', 'Stock_Actual'],
      ['WIDGET_INVENTARIO_RESERVADO', 'KPI_SUM', 'ERP_INVENTARIO', 'Stock_Reservado'],
      ['WIDGET_INVENTARIO_MOVIMIENTOS', 'KPI_SUM', 'ERP_MOVIMIENTOS_INVENTARIO', 'Cantidad'],
      ['WIDGET_PRODUCTOS_STOCK_MINIMO', 'KPI_SUM', 'ERP_PRODUCTOS', 'Stock_Minimo']
    ]
  }
]);

const AERP_PRESENTATION_ROLE_VISIBILITY_ = aerpPresentationDeepFreeze_([
  {
    roleCode: 'ADMINISTRADOR',
    modules: [
      'ADMINISTRACION',
      'CLIENTES',
      'CONFIGURACION',
      'INVENTARIO',
      'PEDIDOS',
      'PRODUCTOS',
      'PROVEEDORES',
      'VENTAS'
    ],
    dashboards: ['DASHBOARD_INVENTARIO', 'DASHBOARD_PEDIDOS', 'DASHBOARD_VENTAS']
  },
  {
    roleCode: 'LECTOR',
    modules: ['CLIENTES', 'INVENTARIO', 'PEDIDOS', 'PRODUCTOS', 'VENTAS'],
    dashboards: ['DASHBOARD_INVENTARIO', 'DASHBOARD_PEDIDOS', 'DASHBOARD_VENTAS']
  },
  {
    roleCode: 'OPERADOR',
    modules: ['CLIENTES', 'INVENTARIO', 'PEDIDOS', 'PRODUCTOS', 'PROVEEDORES', 'VENTAS'],
    dashboards: ['DASHBOARD_INVENTARIO', 'DASHBOARD_PEDIDOS', 'DASHBOARD_VENTAS']
  }
]);

function aerpPresentationDeepFreeze_(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) {
    aerpPresentationDeepFreeze_(value[key]);
  });
  return Object.freeze(value);
}

function aerpPresentationClone_(value) {
  return JSON.parse(JSON.stringify(value));
}

function aerpPresentationIsPlainObject_(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

function aerpPresentationEmptySummary_() {
  return {
    views: 0,
    menus: 0,
    menuItems: 0,
    dashboards: 0,
    roleVisibilityRules: 0
  };
}

function aerpPresentationSummary_(manifest) {
  const summary = aerpPresentationEmptySummary_();
  if (!aerpPresentationIsPlainObject_(manifest)) return summary;
  summary.views = Array.isArray(manifest.views) ? manifest.views.length : 0;
  summary.menus = Array.isArray(manifest.menus) ? manifest.menus.length : 0;
  summary.menuItems = Array.isArray(manifest.menuItems) ? manifest.menuItems.length : 0;
  summary.dashboards = Array.isArray(manifest.dashboards) ? manifest.dashboards.length : 0;
  summary.roleVisibilityRules = Array.isArray(manifest.roleVisibility)
    ? manifest.roleVisibility.length
    : 0;
  return summary;
}

function aerpPresentationPushDuplicateErrors_(values, code, errors) {
  const seen = new Set();
  values.forEach(function (value) {
    if (typeof value !== 'string' || !value) return;
    if (seen.has(value)) errors.push(code + ':' + value);
    seen.add(value);
  });
}

function aerpPresentationSameSet_(left, right) {
  if (left.length !== right.length) return false;
  return JSON.stringify(left.slice().sort()) === JSON.stringify(right.slice().sort());
}

function aerpPresentationBuildView_(table, order) {
  const visibleColumns = table.columns
    .filter(function (column) {
      return column && column.Visible === true;
    })
    .map(function (column) {
      return column.Nombre_Campo;
    });
  const keyColumn = table.columns.find(function (column) {
    return column && column.Es_Key === true;
  });
  const labelColumn = table.columns.find(function (column) {
    return column && column.Es_Label === true;
  });

  return {
    id: 'VIEW_' + table.physicalName,
    name: table.name,
    module: table.module,
    table: table.physicalName,
    type: 'Table',
    columns: visibleColumns,
    primaryKey: keyColumn ? keyColumn.Nombre_Campo : '',
    labelColumn: labelColumn ? labelColumn.Nombre_Campo : keyColumn ? keyColumn.Nombre_Campo : '',
    order: order,
    active: true
  };
}

function aerpPresentationBuildMenus_() {
  return AERP_PRESENTATION_MENU_SPECS_.map(function (spec, index) {
    return {
      menuId: 'MENU_' + spec[0],
      menuCode: spec[0],
      name: spec[1],
      moduleCode: spec[0],
      order: index + 1,
      active: true
    };
  });
}

function aerpPresentationBuildDashboards_() {
  return AERP_PRESENTATION_DASHBOARD_SPECS_.map(function (spec, index) {
    return {
      id: spec.id,
      name: spec.name,
      module: spec.module,
      layout: spec.layout,
      tableReferences: spec.tableReferences.slice(),
      viewReferences: spec.tableReferences.map(function (tableName) {
        return 'VIEW_' + tableName;
      }),
      widgets: spec.widgets.map(function (widget, widgetIndex) {
        return {
          id: widget[0],
          type: widget[1],
          table: widget[2],
          field: widget[3],
          order: widgetIndex + 1
        };
      }),
      order: index + 1,
      active: true
    };
  });
}

function aerpPresentationBuildMenuItems_(views, dashboards) {
  const moduleOrder = {};
  AERP_PRESENTATION_MENU_SPECS_.forEach(function (spec) {
    moduleOrder[spec[0]] = 0;
  });

  const viewItems = views.map(function (view) {
    moduleOrder[view.module] += 1;
    return {
      itemId: 'MENU_ITEM_' + view.id,
      itemCode: view.id,
      menuId: 'MENU_' + view.module,
      moduleCode: view.module,
      actionCode: 'VIEW',
      targetType: 'VIEW',
      targetId: view.id,
      order: moduleOrder[view.module],
      active: true
    };
  });

  const dashboardItems = dashboards.map(function (dashboard) {
    moduleOrder[dashboard.module] += 1;
    return {
      itemId: 'MENU_ITEM_' + dashboard.id,
      itemCode: dashboard.id,
      menuId: 'MENU_' + dashboard.module,
      moduleCode: dashboard.module,
      actionCode: 'VIEW',
      targetType: 'DASHBOARD',
      targetId: dashboard.id,
      order: moduleOrder[dashboard.module],
      active: true
    };
  });

  return viewItems.concat(dashboardItems);
}

function aerpPresentationInvalidBuild_(errorCode) {
  return {
    ok: false,
    contractVersion: AERP_PRESENTATION_MANIFEST_VERSION_,
    manifest: null,
    errors: [errorCode],
    summary: aerpPresentationEmptySummary_()
  };
}

function aerpBuildCommercialPresentationManifestFromBlueprint(blueprint) {
  try {
    if (typeof aerpValidateCommercialBlueprint !== 'function') {
      return aerpPresentationInvalidBuild_('AERP_PM_BLUEPRINT_VALIDATOR_UNAVAILABLE');
    }
    const blueprintValidation = aerpValidateCommercialBlueprint(blueprint);
    if (!blueprintValidation.ok) {
      return aerpPresentationInvalidBuild_('AERP_PM_INVALID_BLUEPRINT');
    }

    const views = blueprint.tables.map(aerpPresentationBuildView_);
    const menus = aerpPresentationBuildMenus_();
    const dashboards = aerpPresentationBuildDashboards_();
    const manifest = {
      contractVersion: AERP_PRESENTATION_MANIFEST_VERSION_,
      metadataTables: aerpPresentationClone_(AERP_PRESENTATION_METADATA_TABLES_),
      separation: aerpPresentationClone_(AERP_PRESENTATION_SEPARATION_),
      views: views,
      menus: menus,
      menuItems: aerpPresentationBuildMenuItems_(views, dashboards),
      dashboards: dashboards,
      roleVisibility: aerpPresentationClone_(AERP_PRESENTATION_ROLE_VISIBILITY_)
    };
    const validation = aerpValidateCommercialPresentationManifest(manifest, blueprint);

    return {
      ok: validation.ok,
      contractVersion: AERP_PRESENTATION_MANIFEST_VERSION_,
      manifest: validation.ok ? manifest : null,
      errors: validation.errors,
      summary: validation.summary
    };
  } catch (_error) {
    return aerpPresentationInvalidBuild_('AERP_PM_INVALID_BLUEPRINT');
  }
}

function aerpBuildCommercialPresentationManifest() {
  if (typeof aerpBuildCommercialBlueprint !== 'function') {
    return aerpPresentationInvalidBuild_('AERP_PM_BLUEPRINT_BUILDER_UNAVAILABLE');
  }
  return aerpBuildCommercialPresentationManifestFromBlueprint(aerpBuildCommercialBlueprint());
}

function aerpPresentationValidateRoot_(manifest, errors) {
  if (manifest.contractVersion !== AERP_PRESENTATION_MANIFEST_VERSION_) {
    errors.push('AERP_PM_VERSION_MISMATCH');
  }
  if (
    JSON.stringify(manifest.metadataTables) !== JSON.stringify(AERP_PRESENTATION_METADATA_TABLES_)
  ) {
    errors.push('AERP_PM_METADATA_TABLES_MISMATCH');
  }
  if (JSON.stringify(manifest.separation) !== JSON.stringify(AERP_PRESENTATION_SEPARATION_)) {
    errors.push('AERP_PM_SEPARATION_MISMATCH');
  }
}

function aerpPresentationValidateViews_(manifest, tableIndex, errors) {
  const viewIds = manifest.views.map(function (view) {
    return view && view.id;
  });
  aerpPresentationPushDuplicateErrors_(viewIds, 'AERP_PM_DUPLICATE_VIEW', errors);

  manifest.views.forEach(function (view) {
    if (!aerpPresentationIsPlainObject_(view) || !Array.isArray(view.columns)) {
      errors.push('AERP_PM_INVALID_VIEW');
      return;
    }
    const table = tableIndex[view.table];
    if (!table) {
      errors.push('AERP_PM_UNKNOWN_VIEW_TABLE:' + String(view.id || ''));
      return;
    }
    if (view.module !== table.module) errors.push('AERP_PM_VIEW_MODULE_MISMATCH:' + view.id);
    if (view.type !== 'Table' || view.active !== true) {
      errors.push('AERP_PM_INVALID_VIEW_CONTRACT:' + view.id);
    }
    const columnNames = table.columns.map(function (column) {
      return column.Nombre_Campo;
    });
    view.columns.concat([view.primaryKey, view.labelColumn]).forEach(function (columnName) {
      if (!columnNames.includes(columnName)) {
        errors.push('AERP_PM_UNKNOWN_VIEW_FIELD:' + view.id + '.' + String(columnName || ''));
      }
    });
  });

  if (
    !aerpPresentationSameSet_(
      manifest.views.map(view => view.table),
      Object.keys(tableIndex)
    )
  ) {
    errors.push('AERP_PM_VIEW_TABLE_SET_MISMATCH');
  }
}

function aerpPresentationValidateMenus_(manifest, modules, errors) {
  const menuIds = manifest.menus.map(function (menu) {
    return menu && menu.menuId;
  });
  aerpPresentationPushDuplicateErrors_(menuIds, 'AERP_PM_DUPLICATE_MENU', errors);

  manifest.menus.forEach(function (menu) {
    if (!aerpPresentationIsPlainObject_(menu)) {
      errors.push('AERP_PM_INVALID_MENU');
      return;
    }
    if (!modules.has(menu.moduleCode)) errors.push('AERP_PM_UNKNOWN_MENU_MODULE:' + menu.menuId);
    if (
      menu.menuId !== 'MENU_' + menu.moduleCode ||
      menu.menuCode !== menu.moduleCode ||
      typeof menu.name !== 'string' ||
      !menu.name ||
      menu.active !== true
    ) {
      errors.push('AERP_PM_INVALID_MENU_CONTRACT:' + String(menu.menuId || ''));
    }
  });

  if (
    !aerpPresentationSameSet_(
      manifest.menus.map(menu => menu.moduleCode),
      Array.from(modules)
    )
  ) {
    errors.push('AERP_PM_MENU_MODULE_SET_MISMATCH');
  }
}

function aerpPresentationValidateDashboards_(manifest, tableIndex, viewIndex, modules, errors) {
  const dashboardIds = manifest.dashboards.map(function (dashboard) {
    return dashboard && dashboard.id;
  });
  aerpPresentationPushDuplicateErrors_(dashboardIds, 'AERP_PM_DUPLICATE_DASHBOARD', errors);

  manifest.dashboards.forEach(function (dashboard) {
    if (
      !aerpPresentationIsPlainObject_(dashboard) ||
      !Array.isArray(dashboard.tableReferences) ||
      !Array.isArray(dashboard.viewReferences) ||
      !Array.isArray(dashboard.widgets)
    ) {
      errors.push('AERP_PM_INVALID_DASHBOARD');
      return;
    }
    if (!modules.has(dashboard.module)) {
      errors.push('AERP_PM_UNKNOWN_DASHBOARD_MODULE:' + dashboard.id);
    }
    dashboard.tableReferences.forEach(function (tableName) {
      if (!tableIndex[tableName]) {
        errors.push('AERP_PM_UNKNOWN_DASHBOARD_TABLE:' + dashboard.id + '.' + tableName);
      }
    });
    dashboard.viewReferences.forEach(function (viewId) {
      if (!viewIndex[viewId]) {
        errors.push('AERP_PM_UNKNOWN_DASHBOARD_VIEW:' + dashboard.id + '.' + viewId);
      }
    });
    dashboard.widgets.forEach(function (widget) {
      if (!aerpPresentationIsPlainObject_(widget)) {
        errors.push('AERP_PM_INVALID_WIDGET:' + dashboard.id);
        return;
      }
      const table = tableIndex[widget.table];
      if (!table || !dashboard.tableReferences.includes(widget.table)) {
        errors.push('AERP_PM_UNKNOWN_WIDGET_TABLE:' + widget.id);
        return;
      }
      if (
        !table.columns.some(function (column) {
          return column.Nombre_Campo === widget.field;
        })
      ) {
        errors.push('AERP_PM_UNKNOWN_WIDGET_FIELD:' + widget.id);
      }
    });
    if (dashboard.active !== true) {
      errors.push('AERP_PM_INACTIVE_DASHBOARD:' + dashboard.id);
    }
  });
}

function aerpPresentationValidateMenuItems_(
  manifest,
  menuIndex,
  viewIndex,
  dashboardIndex,
  errors
) {
  const itemIds = manifest.menuItems.map(function (item) {
    return item && item.itemId;
  });
  aerpPresentationPushDuplicateErrors_(itemIds, 'AERP_PM_DUPLICATE_MENU_ITEM', errors);
  const targetedViews = [];
  const targetedDashboards = [];

  manifest.menuItems.forEach(function (item) {
    if (!aerpPresentationIsPlainObject_(item)) {
      errors.push('AERP_PM_INVALID_MENU_ITEM');
      return;
    }
    const menu = menuIndex[item.menuId];
    if (!menu) {
      errors.push('AERP_PM_UNKNOWN_MENU_ITEM_MENU:' + item.itemId);
    } else if (menu.moduleCode !== item.moduleCode) {
      errors.push('AERP_PM_MENU_ITEM_MODULE_MISMATCH:' + item.itemId);
    }

    let target = null;
    if (item.targetType === 'VIEW') {
      target = viewIndex[item.targetId];
      targetedViews.push(item.targetId);
    } else if (item.targetType === 'DASHBOARD') {
      target = dashboardIndex[item.targetId];
      targetedDashboards.push(item.targetId);
    }
    if (!target) {
      errors.push('AERP_PM_UNKNOWN_MENU_ITEM_TARGET:' + item.itemId);
    } else {
      if (target.module !== item.moduleCode) {
        errors.push('AERP_PM_MENU_ITEM_TARGET_MODULE_MISMATCH:' + item.itemId);
      }
    }
    if (item.actionCode !== 'VIEW' || item.active !== true) {
      errors.push('AERP_PM_INVALID_MENU_ITEM_CONTRACT:' + item.itemId);
    }
  });

  if (!aerpPresentationSameSet_(targetedViews, Object.keys(viewIndex))) {
    errors.push('AERP_PM_ORPHAN_VIEW');
  }
  if (!aerpPresentationSameSet_(targetedDashboards, Object.keys(dashboardIndex))) {
    errors.push('AERP_PM_ORPHAN_DASHBOARD');
  }
}

function aerpPresentationValidateRoleVisibility_(manifest, modules, dashboardIndex, errors) {
  const roleCodes = manifest.roleVisibility.map(function (rule) {
    return rule && rule.roleCode;
  });
  aerpPresentationPushDuplicateErrors_(roleCodes, 'AERP_PM_DUPLICATE_ROLE_VISIBILITY', errors);

  manifest.roleVisibility.forEach(function (rule) {
    if (
      !aerpPresentationIsPlainObject_(rule) ||
      !Array.isArray(rule.modules) ||
      !Array.isArray(rule.dashboards)
    ) {
      errors.push('AERP_PM_INVALID_ROLE_VISIBILITY');
      return;
    }
    rule.modules.forEach(function (moduleCode) {
      if (!modules.has(moduleCode)) {
        errors.push('AERP_PM_UNKNOWN_ROLE_MODULE:' + rule.roleCode + '.' + moduleCode);
      }
    });
    rule.dashboards.forEach(function (dashboardId) {
      if (!dashboardIndex[dashboardId]) {
        errors.push('AERP_PM_UNKNOWN_ROLE_DASHBOARD:' + rule.roleCode + '.' + dashboardId);
      }
    });
  });

  if (!aerpPresentationSameSet_(roleCodes, ['ADMINISTRADOR', 'LECTOR', 'OPERADOR'])) {
    errors.push('AERP_PM_ROLE_SET_MISMATCH');
  }
}

function aerpValidateCommercialPresentationManifest_(manifest, blueprint) {
  const summary = aerpPresentationSummary_(manifest);
  const errors = [];
  if (
    !aerpPresentationIsPlainObject_(manifest) ||
    !Array.isArray(manifest.views) ||
    !Array.isArray(manifest.menus) ||
    !Array.isArray(manifest.menuItems) ||
    !Array.isArray(manifest.dashboards) ||
    !Array.isArray(manifest.roleVisibility)
  ) {
    return { ok: false, errors: ['AERP_PM_INVALID_MANIFEST'], summary: summary };
  }
  if (
    typeof aerpValidateCommercialBlueprint !== 'function' ||
    !aerpValidateCommercialBlueprint(blueprint).ok
  ) {
    return { ok: false, errors: ['AERP_PM_INVALID_BLUEPRINT'], summary: summary };
  }

  const tableIndex = {};
  const modules = new Set();
  blueprint.tables.forEach(function (table) {
    tableIndex[table.physicalName] = table;
    modules.add(table.module);
  });

  aerpPresentationValidateRoot_(manifest, errors);
  aerpPresentationValidateViews_(manifest, tableIndex, errors);
  aerpPresentationValidateMenus_(manifest, modules, errors);

  const viewIndex = {};
  manifest.views.forEach(function (view) {
    if (view && typeof view.id === 'string') viewIndex[view.id] = view;
  });
  aerpPresentationValidateDashboards_(manifest, tableIndex, viewIndex, modules, errors);

  const menuIndex = {};
  manifest.menus.forEach(function (menu) {
    if (menu && typeof menu.menuId === 'string') menuIndex[menu.menuId] = menu;
  });
  const dashboardIndex = {};
  manifest.dashboards.forEach(function (dashboard) {
    if (dashboard && typeof dashboard.id === 'string') dashboardIndex[dashboard.id] = dashboard;
  });
  aerpPresentationValidateMenuItems_(manifest, menuIndex, viewIndex, dashboardIndex, errors);
  aerpPresentationValidateRoleVisibility_(manifest, modules, dashboardIndex, errors);

  errors.sort();
  return { ok: errors.length === 0, errors: errors, summary: summary };
}

function aerpValidateCommercialPresentationManifest(manifest, blueprint) {
  try {
    return aerpValidateCommercialPresentationManifest_(manifest, blueprint);
  } catch (_error) {
    return {
      ok: false,
      errors: ['AERP_PM_INVALID_MANIFEST'],
      summary: aerpPresentationEmptySummary_()
    };
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.aerpBuildCommercialPresentationManifest = aerpBuildCommercialPresentationManifest;
  globalThis.aerpBuildCommercialPresentationManifestFromBlueprint =
    aerpBuildCommercialPresentationManifestFromBlueprint;
  globalThis.aerpValidateCommercialPresentationManifest =
    aerpValidateCommercialPresentationManifest;
}
