/**
 * ALEF ERP Metadata Engine 3.0
 * 11_Installer.gs
 *
 * Validador de instalación.
 * No modifica hojas todavía.
 */

const AERP_COMMERCIAL_INSTALLER_PLAN_VERSION_ = '1.0.0';

function aerpInstallerEmptySummary_() {
  return {
    tables: 0,
    columns: 0,
    tenantScopedTables: 0,
    modules: 0,
    views: 0,
    menus: 0,
    menuItems: 0,
    dashboards: 0,
    roleVisibilityRules: 0
  };
}

function aerpInstallerFailurePlan_(code) {
  return aerpInstallerDeepFreeze_({
    ok: false,
    contractVersion: AERP_COMMERCIAL_INSTALLER_PLAN_VERSION_,
    blueprintVersion: null,
    presentationVersion: null,
    blueprint: null,
    presentationManifest: null,
    security: null,
    summary: aerpInstallerEmptySummary_(),
    errors: [code]
  });
}

function aerpInstallerDeepFreeze_(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) {
    aerpInstallerDeepFreeze_(value[key]);
  });
  return Object.freeze(value);
}

function aerpInstallerValidationPassed_(validation) {
  return Boolean(
    validation &&
    validation.ok === true &&
    Array.isArray(validation.errors) &&
    validation.errors.length === 0 &&
    validation.summary &&
    typeof validation.summary === 'object'
  );
}

function aerpInstallerSecurityContractValid_(manifest) {
  const separation = manifest && manifest.separation;
  return Boolean(
    separation &&
    separation.authorizationEngine === 'AERP-036' &&
    separation.metadataRepository === 'AERP-037' &&
    separation.authorizationDecision === 'EXTERNAL_REQUIRED' &&
    separation.defaultVisibility === 'HIDDEN' &&
    separation.visibilityGrantsAuthorization === false &&
    separation.denyPrecedence === true
  );
}

function aerpBuildCommercialInstallerPlan() {
  try {
    if (
      typeof aerpBuildCommercialBlueprint !== 'function' ||
      typeof aerpValidateCommercialBlueprint !== 'function' ||
      typeof aerpBuildCommercialPresentationManifestFromBlueprint !== 'function' ||
      typeof aerpValidateCommercialPresentationManifest !== 'function'
    ) {
      return aerpInstallerFailurePlan_('AERP_INSTALLER_DEPENDENCY_UNAVAILABLE');
    }

    const blueprint = aerpBuildCommercialBlueprint();
    const blueprintValidation = aerpValidateCommercialBlueprint(blueprint);
    if (!aerpInstallerValidationPassed_(blueprintValidation)) {
      return aerpInstallerFailurePlan_('AERP_INSTALLER_BLUEPRINT_INVALID');
    }

    const presentationResult = aerpBuildCommercialPresentationManifestFromBlueprint(blueprint);
    if (
      !presentationResult ||
      presentationResult.ok !== true ||
      !Array.isArray(presentationResult.errors) ||
      presentationResult.errors.length !== 0 ||
      !presentationResult.manifest
    ) {
      return aerpInstallerFailurePlan_('AERP_INSTALLER_PRESENTATION_INVALID');
    }

    const presentationValidation = aerpValidateCommercialPresentationManifest(
      presentationResult.manifest,
      blueprint
    );
    if (!aerpInstallerValidationPassed_(presentationValidation)) {
      return aerpInstallerFailurePlan_('AERP_INSTALLER_PRESENTATION_INVALID');
    }
    if (!aerpInstallerSecurityContractValid_(presentationResult.manifest)) {
      return aerpInstallerFailurePlan_('AERP_INSTALLER_SECURITY_CONTRACT_INVALID');
    }

    const separation = presentationResult.manifest.separation;
    return aerpInstallerDeepFreeze_({
      ok: true,
      contractVersion: AERP_COMMERCIAL_INSTALLER_PLAN_VERSION_,
      blueprintVersion: blueprint.version,
      presentationVersion: presentationResult.contractVersion,
      blueprint: blueprint,
      presentationManifest: presentationResult.manifest,
      security: {
        authorizationEngine: separation.authorizationEngine,
        metadataRepository: separation.metadataRepository,
        authorizationDecision: separation.authorizationDecision,
        defaultVisibility: separation.defaultVisibility,
        visibilityGrantsAuthorization: separation.visibilityGrantsAuthorization,
        denyPrecedence: separation.denyPrecedence
      },
      summary: {
        tables: blueprintValidation.summary.tables,
        columns: blueprintValidation.summary.columns,
        tenantScopedTables: blueprintValidation.summary.tenantScopedTables,
        modules: blueprintValidation.summary.modules,
        views: presentationValidation.summary.views,
        menus: presentationValidation.summary.menus,
        menuItems: presentationValidation.summary.menuItems,
        dashboards: presentationValidation.summary.dashboards,
        roleVisibilityRules: presentationValidation.summary.roleVisibilityRules
      },
      errors: []
    });
  } catch (_error) {
    return aerpInstallerFailurePlan_('AERP_INSTALLER_INTERNAL_ERROR');
  }
}

function aerpInstallerPublicPlanSummary_(plan) {
  if (!plan || plan.ok !== true) {
    return {
      ok: false,
      blueprintVersion: null,
      presentationVersion: null,
      security: null,
      summary: aerpInstallerEmptySummary_(),
      errors: plan && Array.isArray(plan.errors) ? plan.errors.slice() : []
    };
  }
  return {
    ok: true,
    blueprintVersion: plan.blueprintVersion,
    presentationVersion: plan.presentationVersion,
    security: {
      authorizationEngine: plan.security.authorizationEngine,
      metadataRepository: plan.security.metadataRepository,
      authorizationDecision: plan.security.authorizationDecision,
      defaultVisibility: plan.security.defaultVisibility,
      visibilityGrantsAuthorization: plan.security.visibilityGrantsAuthorization,
      denyPrecedence: plan.security.denyPrecedence
    },
    summary: {
      tables: plan.summary.tables,
      columns: plan.summary.columns,
      tenantScopedTables: plan.summary.tenantScopedTables,
      modules: plan.summary.modules,
      views: plan.summary.views,
      menus: plan.summary.menus,
      menuItems: plan.summary.menuItems,
      dashboards: plan.summary.dashboards,
      roleVisibilityRules: plan.summary.roleVisibilityRules
    },
    errors: []
  };
}

function aerpInstallerRegistryConflicts_(spreadsheet, blueprint, errors) {
  const tables = new Map(
    blueprint.tables.map(function (table) {
      return [table.physicalName, table];
    })
  );
  const tableIds = new Set(
    blueprint.tables.map(function (table) {
      return table.id;
    })
  );
  const columns = new Map();
  const columnIds = new Set();
  blueprint.tables.forEach(function (table) {
    table.columns.forEach(function (column) {
      columns.set(table.physicalName + '/' + column.Nombre_Campo, column);
      columnIds.add(column.ID_Columna);
    });
  });

  const inspect = function (sheetName, identityField, inspectRow) {
    const values = spreadsheet.getSheetByName(sheetName).getDataRange().getValues();
    const headers = values[0].map(function (value) {
      return String(value).trim();
    });
    if (new Set(headers).size !== headers.length || headers.indexOf(identityField) < 0) {
      errors.push('AERP_INSTALL_PREVIEW_REGISTRY_HEADERS:' + sheetName);
      return;
    }
    const seen = new Set();
    values.slice(1).forEach(function (valuesRow) {
      const row = aerpRowToObject(headers, valuesRow);
      const identity = String(row[identityField] || '').trim();
      if (!identity) return;
      if (seen.has(identity)) {
        errors.push('AERP_INSTALL_PREVIEW_REGISTRY_DUPLICATE:' + sheetName);
        return;
      }
      seen.add(identity);
      inspectRow(row);
    });
  };

  inspect('CORE_TABLAS', 'ID_Tabla', function (row) {
    const table = tables.get(String(row.Tabla_Fisica || '').trim());
    if (!table) {
      if (tableIds.has(String(row.ID_Tabla).trim())) {
        errors.push('AERP_INSTALL_PREVIEW_TABLE_REGISTRY_CONFLICT');
      }
      return;
    }
    if (
      String(row.ID_Tabla).trim() !== table.id ||
      String(row.Codigo).trim() !== table.code ||
      String(row.Modulo).trim() !== table.module
    ) {
      errors.push('AERP_INSTALL_PREVIEW_TABLE_REGISTRY_CONFLICT:' + table.physicalName);
    }
  });

  inspect('CORE_COLUMNAS', 'ID_Columna', function (row) {
    const tableName = String(row.Tabla || '').trim();
    if (!tables.has(tableName)) {
      if (columnIds.has(String(row.ID_Columna).trim())) {
        errors.push('AERP_INSTALL_PREVIEW_COLUMN_REGISTRY_CONFLICT');
      }
      return;
    }
    const columnName = String(row.Nombre_Campo || '').trim();
    const column = columns.get(tableName + '/' + columnName);
    if (
      !column ||
      String(row.ID_Columna).trim() !== column.ID_Columna ||
      String(row.Tipo_Dato).trim() !== column.Tipo_Dato ||
      String(row.Tabla_Referencia || '').trim() !== column.Tabla_Referencia
    ) {
      errors.push('AERP_INSTALL_PREVIEW_COLUMN_REGISTRY_CONFLICT:' + tableName);
    }
  });
}

/**
 * Read-only preflight for an isolated, bound copy. The caller must supply both
 * the original and the expected copy ID; a matching or unbound target is denied.
 * This does not activate the product or grant any authorization.
 */
function aerpPreviewCommercialInstallation(request) {
  const denied = function (code) {
    return {
      ok: false,
      status: 'DENIED',
      errors: [code],
      sheets: [],
      summary: aerpInstallerEmptySummary_()
    };
  };

  try {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return denied('AERP_INSTALL_PREVIEW_INVALID_REQUEST');
    }
    const sourceId = request.sourceSpreadsheetId;
    const targetId = request.targetSpreadsheetId;
    if (
      typeof sourceId !== 'string' ||
      typeof targetId !== 'string' ||
      !/^[A-Za-z0-9_-]{20,}$/.test(sourceId) ||
      !/^[A-Za-z0-9_-]{20,}$/.test(targetId) ||
      sourceId === targetId
    ) {
      return denied('AERP_INSTALL_PREVIEW_TARGET_NOT_ISOLATED');
    }

    const spreadsheet = aerpGetSpreadsheet();
    if (spreadsheet.getId() !== targetId) {
      return denied('AERP_INSTALL_PREVIEW_TARGET_MISMATCH');
    }

    const plan = aerpBuildCommercialInstallerPlan();
    if (!plan.ok) return denied('AERP_INSTALL_PREVIEW_PLAN_INVALID');

    const baseline = aerpInstallCheck();
    if (!baseline.ok) return denied('AERP_INSTALL_PREVIEW_BASELINE_INVALID');

    const errors = [];
    const sheets = plan.blueprint.tables.map(function (table) {
      const name = table.physicalName;
      const expectedHeaders = table.columns.map(function (column) {
        return column.Nombre_Campo;
      });
      const sheet = spreadsheet.getSheetByName(name);
      if (!sheet) return { name: name, action: 'CREATE' };

      const lastRow = sheet.getLastRow();
      const lastColumn = sheet.getLastColumn();
      if (lastRow === 0 && lastColumn === 0) {
        return { name: name, action: 'ADD_HEADERS' };
      }
      if (lastRow < 1 || lastColumn !== expectedHeaders.length) {
        errors.push('AERP_INSTALL_PREVIEW_SCHEMA_CONFLICT:' + name);
        return { name: name, action: 'CONFLICT' };
      }
      const headers = sheet
        .getRange(1, 1, 1, lastColumn)
        .getValues()[0]
        .map(function (value) {
          return String(value).trim();
        });
      if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders)) {
        errors.push('AERP_INSTALL_PREVIEW_SCHEMA_CONFLICT:' + name);
        return { name: name, action: 'CONFLICT' };
      }
      return { name: name, action: 'KEEP', dataRows: lastRow - 1 };
    });
    aerpInstallerRegistryConflicts_(spreadsheet, plan.blueprint, errors);

    return {
      ok: errors.length === 0,
      status: errors.length === 0 ? 'READY_FOR_STRUCTURE' : 'INCOMPATIBLE',
      errors: errors,
      sheets: sheets,
      summary: aerpInstallerPublicPlanSummary_(plan).summary
    };
  } catch (_error) {
    return denied('AERP_INSTALL_PREVIEW_INTERNAL_ERROR');
  }
}

function aerpInstallCheck() {
  const result = {
    ok: true,
    version: AERP_VERSION,
    checkedAt: new Date(),
    errors: [],
    warnings: [],
    sheets: [],
    commercialPlan: null
  };

  const commercialPlan = aerpBuildCommercialInstallerPlan();
  result.commercialPlan = aerpInstallerPublicPlanSummary_(commercialPlan);
  if (!commercialPlan || commercialPlan.ok !== true) {
    result.errors.push('El plan comercial AERP-040 no superó el preflight.');
  }

  aerpCheckRequiredSheet_(result, AERP_SHEETS.CORE_TABLAS, [
    'ID_Tabla',
    'Codigo',
    'Nombre',
    'Entidad',
    'Modulo',
    'Categoria',
    'Tipo_Tabla',
    'Origen_Datos',
    'Tabla_Fisica',
    'Activo'
  ]);

  aerpCheckRequiredSheet_(result, AERP_SHEETS.CORE_COLUMNAS, [
    'ID_Columna',
    'Tabla',
    'Nombre_Campo',
    'Nombre_Mostrar',
    'Tipo_Dato',
    'Es_Key',
    'Es_Label',
    'Es_Requerido',
    'Permite_Nulos',
    'Valor_Inicial',
    'Formula_App',
    'Tabla_Referencia',
    'Orden',
    'Activo',
    'Estado',
    'Visible',
    'Editable',
    'Es_Ref',
    'Es_Virtual',
    'Tipo_Control'
  ]);

  aerpCheckRequiredSheet_(result, AERP_SHEETS.GEN_REGLAS, [
    'ID_Regla',
    'Version',
    'Prioridad',
    'Nivel',
    'Activo',
    'Nombre_Regla',
    'Patron',
    'Tipo_Patron',
    'Categoria',
    'Categoria_App',
    'Motor',
    'Aplica_A',
    'Tipo_Dato',
    'Tipo_Control',
    'Requerido',
    'Permite_Nulos',
    'Es_Key',
    'Es_Label',
    'Es_Ref',
    'Visible',
    'Editable',
    'ID_TablaReferencia',
    'Formula',
    'Descripcion'
  ]);

  aerpCheckRequiredSheet_(result, AERP_SHEETS.GEN_ACCIONES, [
    'ID_Accion',
    'Version',
    'Activo',
    'ID_Regla',
    'Orden',
    'Nombre_Accion',
    'Tipo_Accion',
    'Campo_Destino',
    'Valor',
    'Condicion',
    'Descripcion'
  ]);

  aerpCheckRequiredSheet_(result, AERP_SHEETS.CAT_ESTADOS, [
    'ID_Estado',
    'Codigo',
    'Nombre',
    'Descripcion',
    'Activo'
  ]);

  result.ok = result.errors.length === 0;

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function aerpCheckRequiredSheet_(result, sheetName, requiredHeaders) {
  let sheet;

  try {
    sheet = aerpGetSheet(sheetName);
  } catch (error) {
    result.errors.push('Falta hoja obligatoria: ' + sheetName);
    result.sheets.push({
      sheet: sheetName,
      ok: false,
      error: 'No existe'
    });
    return;
  }

  const values = sheet.getDataRange().getValues();
  const headers = values.length > 0 ? values[0].map(h => String(h).trim()) : [];

  const missing = requiredHeaders.filter(header => !headers.includes(header));

  if (missing.length > 0) {
    result.errors.push(
      'La hoja ' + sheetName + ' no tiene columnas obligatorias: ' + missing.join(', ')
    );
  }

  result.sheets.push({
    sheet: sheetName,
    ok: missing.length === 0,
    missingHeaders: missing,
    totalRows: Math.max(values.length - 1, 0),
    totalColumns: headers.length
  });
}

function testInstaller() {
  const result = aerpInstallCheck();

  if (!result.ok) {
    throw new Error('Instalación inválida. Revisa el log.');
  }

  Logger.log('Instalación Alef ERP OK');
}
function testInstallerErrores() {
  const result = aerpInstallCheck();

  Logger.log('ERRORES:');
  Logger.log(JSON.stringify(result.errors, null, 2));

  Logger.log('WARNINGS:');
  Logger.log(JSON.stringify(result.warnings, null, 2));
}

if (typeof globalThis !== 'undefined') {
  globalThis.aerpBuildCommercialInstallerPlan = aerpBuildCommercialInstallerPlan;
  globalThis.aerpPreviewCommercialInstallation = aerpPreviewCommercialInstallation;
  globalThis.aerpInstallCheck = aerpInstallCheck;
}
