// @ts-nocheck
/**
 * ============================================================
 * Alef ERP
 * Enterprise Authorization Framework
 * ------------------------------------------------------------
 * Module : AERP-036
 * Name   : Authorization Engine
 * Version: 1.0.0
 * Status : Phase 2 - Metadata Adapter
 * ------------------------------------------------------------
 * Description:
 * Defines the official authorization contracts, validation
 * helpers, and the injected metadata adapter layer for the
 * Alef ERP authorization engine.
 *
 * Milestone 2 scope is intentionally limited to the injected
 * metadata adapter and contract normalization layer. The future
 * decision pipeline remains:
 *   1. validate context
 *   2. validate model
 *   3. evaluate rules
 *   4. build decision
 *
 * Spreadsheet boundary:
 * Direct SpreadsheetApp reads are intentionally unimplemented in
 * this milestone. A future Apps Script adapter layer may bridge
 * CORE metadata from sheets into the injected input structure.
 *
 * Future extension point:
 * The Authorization Evaluator milestone will introduce an
 * evaluator strategy layer for rule execution. This milestone
 * does not implement that layer yet.
 *
 * Public API:
 *   - aerpCreateAuthorizationContext(context)
 *   - aerpCreateAuthorizationRule(rule)
 *   - aerpCreateAuthorizationModel(model)
 *   - aerpCreateAuthorizationDecision(decision)
 *   - aerpCreateAuthorizationValidationResult(result)
 *   - aerpNormalizeAuthorizationModel(model)
 *   - aerpValidateAuthorizationContext(context)
 *   - aerpValidateAuthorizationModel(model)
 *   - aerpAuthorize(context, model)
 *   - aerpCreateAuthorizationMetadataInput(input)
 *   - aerpBuildAuthorizationModel(metadataInput, options)
 *   - aerpValidateAuthorizationMetadataInput(metadataInput)
 *   - aerpGetAuthorizationMetadataDiagnostics(metadataInput)
 * ============================================================
 */

const AERP_AUTHORIZATION_VERSION = '1.0.0';
const AERP_AUTHORIZATION_RULE_EFFECTS = Object.freeze(['ALLOW', 'DENY']);
const AERP_AUTHORIZATION_COMPANY_SCOPES = Object.freeze(['COMPANY', 'TENANT']);

const AERP_AUTHORIZATION_EFFECTS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY: 'DENY'
});

function aerpNormalizeString_(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toUpperCase();
}

function aerpNormalizeOptionalString_(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function aerpNormalizeStringArray_(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map(value => aerpNormalizeString_(value)).filter(value => value);
}

function aerpNormalizeRuleList_(rules) {
  if (!Array.isArray(rules)) {
    return [];
  }

  return rules.map(rule => aerpCreateAuthorizationRule(rule));
}

function aerpNormalizeMetadata_(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  return Object.keys(metadata).reduce((result, key) => {
    result[key] = aerpNormalizeMetadataValue_(metadata[key]);
    return result;
  }, {});
}

function aerpNormalizeMetadataValue_(value) {
  if (Array.isArray(value)) {
    return value.map(item => aerpNormalizeMetadataValue_(item));
  }

  if (value && typeof value === 'object') {
    return aerpNormalizeMetadata_(value);
  }

  return value;
}

function aerpClonePlainValue_(value) {
  if (Array.isArray(value)) {
    return value.map(item => aerpClonePlainValue_(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).reduce((result, key) => {
      result[key] = aerpClonePlainValue_(value[key]);
      return result;
    }, {});
  }

  return value;
}

function aerpNormalizeEmailValue_(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
}

function aerpNormalizeIdentifierValue_(value) {
  if (typeof value === 'string') {
    return value.trim().toUpperCase();
  }

  if (typeof value === 'number') {
    return String(value).trim().toUpperCase();
  }

  return '';
}

function aerpNormalizeBooleanValue_(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();
    if (
      normalizedValue === 'true' ||
      normalizedValue === '1' ||
      normalizedValue === 'yes' ||
      normalizedValue === 'y'
    ) {
      return true;
    }

    if (
      normalizedValue === 'false' ||
      normalizedValue === '0' ||
      normalizedValue === 'no' ||
      normalizedValue === 'n'
    ) {
      return false;
    }
  }

  return false;
}

function aerpNormalizeEffectValue_(value) {
  const normalizedValue = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (normalizedValue === 'ALLOW') {
    return 'ALLOW';
  }

  if (normalizedValue === 'DENY') {
    return 'DENY';
  }

  return '';
}

function aerpNormalizePriorityValue_(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function aerpGenerateDecisionId_() {
  if (typeof Utilities !== 'undefined' && Utilities && typeof Utilities.getUuid === 'function') {
    return Utilities.getUuid();
  }

  const base = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `aerp-${base}`;
}

function aerpCreateMetadataDiagnostic_(type, code, message, source, rowIndex, details) {
  return Object.freeze({
    type,
    code,
    message,
    source: aerpNormalizeOptionalString_(source) || 'AERP-036',
    rowIndex: Number.isFinite(rowIndex) ? rowIndex : null,
    details: details && typeof details === 'object' ? aerpClonePlainValue_(details) : null
  });
}

function aerpCreateFailClosedDecision_(validationIssues, modelVersion) {
  return Object.freeze({
    allowed: false,
    decisionType: AERP_AUTHORIZATION_EFFECTS.DENY,
    reasonCode: 'NOT_IMPLEMENTED',
    implemented: false,
    timestamp: new Date().toISOString(),
    modelVersion: aerpNormalizeOptionalString_(modelVersion) || AERP_AUTHORIZATION_VERSION,
    matchedRuleIds: [],
    validationIssues: Array.isArray(validationIssues)
      ? validationIssues.map(issue => aerpNormalizeOptionalString_(issue)).filter(Boolean)
      : [],
    effect: AERP_AUTHORIZATION_EFFECTS.DENY,
    decisionId: aerpGenerateDecisionId_()
  });
}

function aerpCreateAuthorizationContext(context) {
  const normalizedContext = {
    userId: aerpNormalizeOptionalString_(context && context.userId),
    companyId: aerpNormalizeOptionalString_(context && context.companyId),
    companyScope: aerpNormalizeString_(context && context.companyScope),
    roles: aerpNormalizeStringArray_(context && context.roles),
    permissions: aerpNormalizeStringArray_(context && context.permissions),
    metadata: aerpNormalizeMetadata_(context && context.metadata)
  };

  return Object.freeze(normalizedContext);
}

function aerpCreateAuthorizationRule(rule) {
  const normalizedRule = {
    id: aerpNormalizeOptionalString_(rule && rule.id),
    effect: aerpNormalizeString_(rule && rule.effect),
    resource: aerpNormalizeOptionalString_(rule && rule.resource),
    action: aerpNormalizeOptionalString_(rule && rule.action)
  };

  return Object.freeze(normalizedRule);
}

function aerpCreateAuthorizationModel(model) {
  const normalizedModel = {
    name: aerpNormalizeOptionalString_(model && model.name),
    rules: aerpNormalizeRuleList_(model && model.rules),
    defaultEffect: AERP_AUTHORIZATION_EFFECTS.DENY
  };

  return Object.freeze(normalizedModel);
}

function aerpCreateAuthorizationDecision(decision) {
  const normalizedDecision = {
    allowed: Boolean(decision && decision.allowed),
    decisionType:
      aerpNormalizeString_(decision && (decision.decisionType || decision.effect)) ||
      AERP_AUTHORIZATION_EFFECTS.DENY,
    reasonCode: aerpNormalizeOptionalString_(decision && decision.reasonCode),
    implemented:
      decision && Object.prototype.hasOwnProperty.call(decision, 'implemented')
        ? Boolean(decision.implemented)
        : true,
    timestamp:
      aerpNormalizeOptionalString_(decision && decision.timestamp) || new Date().toISOString(),
    modelVersion:
      aerpNormalizeOptionalString_(decision && decision.modelVersion) || AERP_AUTHORIZATION_VERSION,
    matchedRuleIds: Array.isArray(decision && decision.matchedRuleIds)
      ? decision.matchedRuleIds.map(ruleId => aerpNormalizeOptionalString_(ruleId)).filter(Boolean)
      : [],
    validationIssues: Array.isArray(decision && decision.validationIssues)
      ? decision.validationIssues.map(issue => aerpNormalizeOptionalString_(issue)).filter(Boolean)
      : [],
    effect:
      aerpNormalizeString_(decision && (decision.effect || decision.decisionType)) ||
      AERP_AUTHORIZATION_EFFECTS.DENY,
    decisionId:
      aerpNormalizeOptionalString_(decision && decision.decisionId) || aerpGenerateDecisionId_()
  };

  if (normalizedDecision.allowed === false && normalizedDecision.decisionType === '') {
    normalizedDecision.decisionType = AERP_AUTHORIZATION_EFFECTS.DENY;
    normalizedDecision.effect = AERP_AUTHORIZATION_EFFECTS.DENY;
  }

  return Object.freeze(normalizedDecision);
}

function aerpCreateAuthorizationValidationResult(result) {
  const normalizedResult = {
    isValid: Boolean(result && result.isValid),
    errors: Array.isArray(result && result.errors) ? result.errors : []
  };

  return Object.freeze(normalizedResult);
}

function aerpNormalizeAuthorizationModel(model) {
  return aerpCreateAuthorizationModel(model);
}

function aerpValidateAuthorizationContext(context) {
  const errors = [];

  if (!context || typeof context !== 'object') {
    errors.push('AuthorizationContext is required');
    return aerpCreateAuthorizationValidationResult({ isValid: false, errors });
  }

  if (!context.userId || typeof context.userId !== 'string' || !context.userId.trim()) {
    errors.push('AuthorizationContext.userId is required');
  }

  if (!context.companyId || typeof context.companyId !== 'string' || !context.companyId.trim()) {
    errors.push('AuthorizationContext.companyId is required');
  }

  const normalizedScope = aerpNormalizeString_(context.companyScope);
  if (!normalizedScope || !AERP_AUTHORIZATION_COMPANY_SCOPES.includes(normalizedScope)) {
    errors.push('AuthorizationContext.companyScope must be COMPANY or TENANT');
  }

  return aerpCreateAuthorizationValidationResult({
    isValid: errors.length === 0,
    errors
  });
}

function aerpValidateAuthorizationModel(model) {
  const errors = [];

  if (!model || typeof model !== 'object') {
    errors.push('AuthorizationModel is required');
    return aerpCreateAuthorizationValidationResult({ isValid: false, errors });
  }

  if (!model.name || typeof model.name !== 'string' || !model.name.trim()) {
    errors.push('AuthorizationModel.name is required');
  }

  if (!Array.isArray(model.rules)) {
    errors.push('AuthorizationModel.rules must be an array');
  } else {
    model.rules.forEach((rule, index) => {
      if (!rule || typeof rule !== 'object') {
        errors.push(`AuthorizationModel.rules[${index}] must be an object`);
        return;
      }

      const normalizedEffect = aerpNormalizeString_(rule.effect);
      if (!AERP_AUTHORIZATION_RULE_EFFECTS.includes(normalizedEffect)) {
        errors.push(`AuthorizationModel.rules[${index}].effect must be ALLOW or DENY`);
      }
    });
  }

  if (model.validationState && String(model.validationState).toUpperCase() === 'INVALID') {
    errors.push('AuthorizationModel.validationState is INVALID');
  }

  return aerpCreateAuthorizationValidationResult({
    isValid: errors.length === 0,
    errors
  });
}

function aerpAuthorize(context, model) {
  const contextValidation = aerpValidateAuthorizationContext(context);
  const modelValidation = aerpValidateAuthorizationModel(model);

  if (!contextValidation.isValid || !modelValidation.isValid) {
    const validationIssues = [];

    if (!contextValidation.isValid) {
      validationIssues.push(...contextValidation.errors);
    }

    if (!modelValidation.isValid) {
      validationIssues.push(...modelValidation.errors);
    }

    return aerpCreateFailClosedDecision_(validationIssues, model && model.version);
  }

  return aerpCreateFailClosedDecision_([], model && model.version);
}

function aerpNormalizeUsuarioRolRow_(row, index) {
  return {
    userId: aerpNormalizeIdentifierValue_(
      row && (row.userId || row.usuarioId || row.user || row.email || row.userEmail)
    ),
    roleId: aerpNormalizeIdentifierValue_(
      row && (row.roleId || row.rolId || row.roleCode || row.role)
    ),
    email: aerpNormalizeEmailValue_(row && (row.email || row.userEmail || row.usuarioEmail)),
    active: aerpNormalizeBooleanValue_(
      row && (row.active !== undefined ? row.active : row.enabled)
    ),
    sourceMetadata: {
      source: 'CORE_USUARIO_ROL',
      rowIndex: index + 1
    }
  };
}

function aerpNormalizeRolModuloRow_(row, index) {
  return {
    roleId: aerpNormalizeIdentifierValue_(
      row && (row.roleId || row.rolId || row.roleCode || row.role)
    ),
    moduleId: aerpNormalizeIdentifierValue_(
      row && (row.moduleId || row.moduleCode || row.module || row.moduloId || row.moduloCode)
    ),
    active: aerpNormalizeBooleanValue_(
      row && (row.active !== undefined ? row.active : row.enabled)
    ),
    sourceMetadata: {
      source: 'CORE_ROL_MODULO',
      rowIndex: index + 1
    }
  };
}

function aerpNormalizePermisoRow_(row, index) {
  return {
    ruleId: aerpNormalizeIdentifierValue_(
      row && (row.ruleId || row.permissionId || row.id || row.permissionCode || row.ruleCode)
    ),
    subjectType: aerpNormalizeIdentifierValue_(
      row && (row.subjectType || row.subject || row.subjectKind || 'USER')
    ),
    subjectId: aerpNormalizeIdentifierValue_(
      row &&
        (row.subjectId ||
          row.userId ||
          row.roleId ||
          row.roleCode ||
          row.companyId ||
          row.companyCode)
    ),
    effect: aerpNormalizeEffectValue_(row && row.effect),
    moduleCode: aerpNormalizeIdentifierValue_(
      row && (row.moduleCode || row.moduleId || row.module || row.moduloCode)
    ),
    actionCode: aerpNormalizeIdentifierValue_(
      row && (row.actionCode || row.actionId || row.action || row.permissionAction)
    ),
    companyScope: aerpNormalizeIdentifierValue_(
      row && (row.companyScope || row.companyId || row.companyCode || row.scope || 'COMPANY')
    ),
    priority: aerpNormalizePriorityValue_(row && row.priority),
    active: aerpNormalizeBooleanValue_(
      row && (row.active !== undefined ? row.active : row.enabled)
    ),
    conditions: aerpClonePlainValue_(row && row.conditions ? row.conditions : {}),
    sourceMetadata: {
      source: 'CORE_PERMISOS',
      rowIndex: index + 1
    }
  };
}

function aerpNormalizeModuloRow_(row, index) {
  return {
    moduleId: aerpNormalizeIdentifierValue_(
      row && (row.moduleId || row.moduleCode || row.module || row.id)
    ),
    moduleCode: aerpNormalizeIdentifierValue_(
      row && (row.moduleCode || row.moduleId || row.module || row.code)
    ),
    name: aerpNormalizeOptionalString_(row && (row.name || row.moduleName || row.description)),
    active: aerpNormalizeBooleanValue_(
      row && (row.active !== undefined ? row.active : row.enabled)
    ),
    sourceMetadata: {
      source: 'CORE_MODULOS',
      rowIndex: index + 1
    }
  };
}

function aerpNormalizeMenuRow_(row, index) {
  return {
    menuId: aerpNormalizeIdentifierValue_(
      row && (row.menuId || row.menuCode || row.menu || row.id)
    ),
    menuCode: aerpNormalizeIdentifierValue_(
      row && (row.menuCode || row.menuId || row.menu || row.code)
    ),
    name: aerpNormalizeOptionalString_(row && (row.name || row.menuName || row.description)),
    active: aerpNormalizeBooleanValue_(
      row && (row.active !== undefined ? row.active : row.enabled)
    ),
    sourceMetadata: {
      source: 'CORE_MENU',
      rowIndex: index + 1
    }
  };
}

function aerpNormalizeMenuItemRow_(row, index) {
  return {
    itemId: aerpNormalizeIdentifierValue_(row && (row.itemId || row.itemCode || row.id)),
    itemCode: aerpNormalizeIdentifierValue_(row && (row.itemCode || row.itemId || row.code)),
    menuId: aerpNormalizeIdentifierValue_(row && (row.menuId || row.menuCode || row.menu)),
    moduleCode: aerpNormalizeIdentifierValue_(
      row && (row.moduleCode || row.moduleId || row.module)
    ),
    actionCode: aerpNormalizeIdentifierValue_(
      row && (row.actionCode || row.actionId || row.action)
    ),
    active: aerpNormalizeBooleanValue_(
      row && (row.active !== undefined ? row.active : row.enabled)
    ),
    sourceMetadata: {
      source: 'CORE_MENU_ITEM',
      rowIndex: index + 1
    }
  };
}

function aerpNormalizeEmpresaRow_(row, index) {
  return {
    companyId: aerpNormalizeIdentifierValue_(
      row && (row.companyId || row.companyCode || row.id || row.company)
    ),
    companyCode: aerpNormalizeIdentifierValue_(
      row && (row.companyCode || row.companyId || row.company || row.code)
    ),
    name: aerpNormalizeOptionalString_(row && (row.name || row.companyName || row.description)),
    active: aerpNormalizeBooleanValue_(
      row && (row.active !== undefined ? row.active : row.enabled)
    ),
    sourceMetadata: {
      source: 'CORE_EMPRESAS',
      rowIndex: index + 1
    }
  };
}

function aerpCreateAuthorizationMetadataInput(input) {
  const normalizedInput = {
    usuarioRoles: Array.isArray(input && input.usuarioRoles)
      ? input.usuarioRoles.map((row, index) => aerpNormalizeUsuarioRolRow_(row, index))
      : [],
    rolModulos: Array.isArray(input && input.rolModulos)
      ? input.rolModulos.map((row, index) => aerpNormalizeRolModuloRow_(row, index))
      : [],
    permisos: Array.isArray(input && input.permisos)
      ? input.permisos.map((row, index) => aerpNormalizePermisoRow_(row, index))
      : [],
    modulos: Array.isArray(input && input.modulos)
      ? input.modulos.map((row, index) => aerpNormalizeModuloRow_(row, index))
      : [],
    menus: Array.isArray(input && input.menus)
      ? input.menus.map((row, index) => aerpNormalizeMenuRow_(row, index))
      : [],
    menuItems: Array.isArray(input && input.menuItems)
      ? input.menuItems.map((row, index) => aerpNormalizeMenuItemRow_(row, index))
      : [],
    empresas: Array.isArray(input && input.empresas)
      ? input.empresas.map((row, index) => aerpNormalizeEmpresaRow_(row, index))
      : []
  };

  return normalizedInput;
}

function aerpAddMetadataDiagnostic_(diagnostics, type, code, message, source, rowIndex, details) {
  diagnostics.push(aerpCreateMetadataDiagnostic_(type, code, message, source, rowIndex, details));
}

function aerpBuildAuthorizationModel(metadataInput, options) {
  const input = aerpCreateAuthorizationMetadataInput(metadataInput);
  const diagnostics = [];
  const rolesByUser = {};
  const modulesByRole = {};
  const permissionRules = [];
  const modules = [];
  const menus = [];
  const menuItems = [];
  const companies = [];
  const moduleLookup = new Set();
  const companyLookup = new Set();
  const seenUserRolePairs = new Set();
  const seenRoleModulePairs = new Set();
  const seenPermissionIds = new Set();
  const seenModuleIds = new Set();
  const seenCompanyIds = new Set();

  input.modulos.forEach((row, index) => {
    const moduleId = row.moduleId || row.moduleCode;
    if (!moduleId) {
      aerpAddMetadataDiagnostic_(
        diagnostics,
        'error',
        'MALFORMED_MODULE',
        'Module row is missing an identifier.',
        'CORE_MODULOS',
        index + 1,
        row
      );
      return;
    }

    if (seenModuleIds.has(moduleId)) {
      aerpAddMetadataDiagnostic_(
        diagnostics,
        'error',
        'DUPLICATE_MODULE_IDENTIFIER',
        'Duplicate module identifier detected.',
        'CORE_MODULOS',
        index + 1,
        row
      );
      return;
    }

    seenModuleIds.add(moduleId);
    moduleLookup.add(moduleId);
    modules.push({
      moduleId,
      moduleCode: row.moduleCode || moduleId,
      name: row.name,
      active: row.active,
      sourceMetadata: row.sourceMetadata
    });
  });

  input.empresas.forEach((row, index) => {
    const companyId = row.companyId || row.companyCode;
    if (!companyId) {
      aerpAddMetadataDiagnostic_(
        diagnostics,
        'error',
        'MALFORMED_COMPANY',
        'Company row is missing an identifier.',
        'CORE_EMPRESAS',
        index + 1,
        row
      );
      return;
    }

    if (seenCompanyIds.has(companyId)) {
      aerpAddMetadataDiagnostic_(
        diagnostics,
        'error',
        'DUPLICATE_COMPANY_IDENTIFIER',
        'Duplicate company identifier detected.',
        'CORE_EMPRESAS',
        index + 1,
        row
      );
      return;
    }

    seenCompanyIds.add(companyId);
    companyLookup.add(companyId);
    companies.push({
      companyId,
      companyCode: row.companyCode || companyId,
      name: row.name,
      active: row.active,
      sourceMetadata: row.sourceMetadata
    });
  });

  input.menus.forEach((row, index) => {
    const menuId = row.menuId || row.menuCode;
    if (!menuId) {
      aerpAddMetadataDiagnostic_(
        diagnostics,
        'error',
        'MALFORMED_MENU',
        'Menu row is missing an identifier.',
        'CORE_MENU',
        index + 1,
        row
      );
      return;
    }

    menus.push({
      menuId,
      menuCode: row.menuCode || menuId,
      name: row.name,
      active: row.active,
      sourceMetadata: row.sourceMetadata
    });
  });

  input.menuItems.forEach((row, index) => {
    const itemId = row.itemId || row.itemCode;
    if (!itemId) {
      aerpAddMetadataDiagnostic_(
        diagnostics,
        'error',
        'MALFORMED_MENU_ITEM',
        'Menu item row is missing an identifier.',
        'CORE_MENU_ITEM',
        index + 1,
        row
      );
      return;
    }

    menuItems.push({
      itemId,
      itemCode: row.itemCode || itemId,
      menuId: row.menuId,
      moduleCode: row.moduleCode,
      actionCode: row.actionCode,
      active: row.active,
      sourceMetadata: row.sourceMetadata
    });
  });

  input.usuarioRoles.forEach((row, index) => {
    const userId = row.userId;
    const roleId = row.roleId;

    if (!userId || !roleId) {
      aerpAddMetadataDiagnostic_(
        diagnostics,
        'error',
        'MALFORMED_USER_ROLE',
        'User-role row is missing user or role identifiers.',
        'CORE_USUARIO_ROL',
        index + 1,
        row
      );
      return;
    }

    const pairKey = `${userId}:${roleId}`;
    if (seenUserRolePairs.has(pairKey)) {
      aerpAddMetadataDiagnostic_(
        diagnostics,
        'warning',
        'DUPLICATE_USER_ROLE_MAPPING',
        'Duplicate user-role mapping detected.',
        'CORE_USUARIO_ROL',
        index + 1,
        row
      );
      return;
    }

    seenUserRolePairs.add(pairKey);

    if (!rolesByUser[userId]) {
      rolesByUser[userId] = [];
    }

    if (row.active !== false) {
      rolesByUser[userId].push(roleId);
    }
  });

  input.rolModulos.forEach((row, index) => {
    const roleId = row.roleId;
    const moduleId = row.moduleId;

    if (!roleId || !moduleId) {
      aerpAddMetadataDiagnostic_(
        diagnostics,
        'error',
        'MALFORMED_ROLE_MODULE',
        'Role-module row is missing role or module identifiers.',
        'CORE_ROL_MODULO',
        index + 1,
        row
      );
      return;
    }

    const pairKey = `${roleId}:${moduleId}`;
    if (seenRoleModulePairs.has(pairKey)) {
      aerpAddMetadataDiagnostic_(
        diagnostics,
        'warning',
        'DUPLICATE_ROLE_MODULE_MAPPING',
        'Duplicate role-module mapping detected.',
        'CORE_ROL_MODULO',
        index + 1,
        row
      );
      return;
    }

    seenRoleModulePairs.add(pairKey);

    if (!modulesByRole[roleId]) {
      modulesByRole[roleId] = [];
    }

    if (row.active !== false) {
      modulesByRole[roleId].push(moduleId);
    }
  });

  input.permisos.forEach((row, index) => {
    const ruleId = row.ruleId;
    const moduleCode = row.moduleCode;
    const actionCode = row.actionCode;
    const effect = row.effect;
    const companyScope = row.companyScope || 'COMPANY';

    if (!ruleId || !moduleCode || !actionCode || !row.subjectId) {
      aerpAddMetadataDiagnostic_(
        diagnostics,
        'error',
        'MALFORMED_PERMISSION',
        'Permission row is missing required identifiers.',
        'CORE_PERMISOS',
        index + 1,
        row
      );
      return;
    }

    if (seenPermissionIds.has(ruleId)) {
      aerpAddMetadataDiagnostic_(
        diagnostics,
        'error',
        'DUPLICATE_PERMISSION_IDENTIFIER',
        'Duplicate permission identifier detected.',
        'CORE_PERMISOS',
        index + 1,
        row
      );
      return;
    }

    seenPermissionIds.add(ruleId);

    let isPermissionValid = true;
    const normalizedEffect = aerpNormalizeEffectValue_(effect);
    if (normalizedEffect !== 'ALLOW' && normalizedEffect !== 'DENY') {
      aerpAddMetadataDiagnostic_(
        diagnostics,
        'error',
        'INVALID_PERMISSION_EFFECT',
        'Permission row has an invalid effect and cannot become an active rule.',
        'CORE_PERMISOS',
        index + 1,
        row
      );
      isPermissionValid = false;
    }

    if (!moduleLookup.has(moduleCode)) {
      aerpAddMetadataDiagnostic_(
        diagnostics,
        'error',
        'UNKNOWN_MODULE_REFERENCE',
        'Permission row references an unknown module.',
        'CORE_PERMISOS',
        index + 1,
        row
      );
      isPermissionValid = false;
    }

    const normalizedCompanyScope = aerpNormalizeIdentifierValue_(companyScope);
    const hasValidCompanyRef =
      normalizedCompanyScope === 'COMPANY' ||
      normalizedCompanyScope === 'TENANT' ||
      normalizedCompanyScope === 'GLOBAL' ||
      companyLookup.has(normalizedCompanyScope);
    if (!hasValidCompanyRef) {
      aerpAddMetadataDiagnostic_(
        diagnostics,
        'error',
        'INVALID_COMPANY_REFERENCE',
        'Permission row references an unknown company scope.',
        'CORE_PERMISOS',
        index + 1,
        row
      );
      isPermissionValid = false;
    }

    if (row.active === false) {
      aerpAddMetadataDiagnostic_(
        diagnostics,
        'warning',
        'INACTIVE_PERMISSION_EXCLUDED',
        'Inactive permission row was excluded from the normalized rules.',
        'CORE_PERMISOS',
        index + 1,
        row
      );
      return;
    }

    if (!isPermissionValid) {
      return;
    }

    permissionRules.push({
      ruleId,
      id: ruleId,
      subjectType: row.subjectType || 'USER',
      subjectId: row.subjectId,
      effect: normalizedEffect,
      moduleCode,
      actionCode,
      companyScope: normalizedCompanyScope,
      priority: row.priority,
      active: true,
      conditions: row.conditions || {},
      sourceMetadata: row.sourceMetadata
    });
  });

  const validationErrors = diagnostics.filter(item => item.type === 'error');
  const validationState = validationErrors.length > 0 ? 'INVALID' : 'VALID';
  const modelName =
    options && options.name ? aerpNormalizeOptionalString_(options.name) : 'AERP-036-METADATA';

  const model = {
    modelVersion: AERP_AUTHORIZATION_VERSION,
    generatedAt: new Date().toISOString(),
    rolesByUser,
    modulesByRole,
    permissionRules,
    modules,
    menus,
    menuItems,
    companies,
    defaults: {
      defaultEffect: AERP_AUTHORIZATION_EFFECTS.DENY,
      failClosed: true,
      allowImplicit: false,
      modelVersion: AERP_AUTHORIZATION_VERSION
    },
    validationState,
    metadataDiagnostics: diagnostics,
    name: modelName,
    rules: permissionRules.map(rule =>
      aerpCreateAuthorizationRule({
        id: rule.ruleId,
        effect: rule.effect,
        resource: rule.moduleCode,
        action: rule.actionCode
      })
    ),
    defaultEffect: AERP_AUTHORIZATION_EFFECTS.DENY
  };

  return model;
}

function aerpValidateAuthorizationMetadataInput(metadataInput) {
  const model = aerpBuildAuthorizationModel(metadataInput);
  return aerpCreateAuthorizationValidationResult({
    isValid: model.validationState === 'VALID',
    errors: model.metadataDiagnostics
      .filter(diagnostic => diagnostic.type === 'error')
      .map(diagnostic => diagnostic.message)
  });
}

function aerpGetAuthorizationMetadataDiagnostics(metadataInput) {
  return aerpBuildAuthorizationModel(metadataInput).metadataDiagnostics;
}

globalThis.aerpCreateAuthorizationContext = aerpCreateAuthorizationContext;
globalThis.aerpCreateAuthorizationRule = aerpCreateAuthorizationRule;
globalThis.aerpCreateAuthorizationModel = aerpCreateAuthorizationModel;
globalThis.aerpCreateAuthorizationDecision = aerpCreateAuthorizationDecision;
globalThis.aerpCreateAuthorizationValidationResult = aerpCreateAuthorizationValidationResult;
globalThis.aerpNormalizeAuthorizationModel = aerpNormalizeAuthorizationModel;
globalThis.aerpValidateAuthorizationContext = aerpValidateAuthorizationContext;
globalThis.aerpValidateAuthorizationModel = aerpValidateAuthorizationModel;
globalThis.aerpAuthorize = aerpAuthorize;
globalThis.aerpCreateAuthorizationMetadataInput = aerpCreateAuthorizationMetadataInput;
globalThis.aerpBuildAuthorizationModel = aerpBuildAuthorizationModel;
globalThis.aerpValidateAuthorizationMetadataInput = aerpValidateAuthorizationMetadataInput;
globalThis.aerpGetAuthorizationMetadataDiagnostics = aerpGetAuthorizationMetadataDiagnostics;

globalThis.AERP_AUTHORIZATION_VERSION = AERP_AUTHORIZATION_VERSION;
globalThis.AERP_AUTHORIZATION_RULE_EFFECTS = AERP_AUTHORIZATION_RULE_EFFECTS;
globalThis.AERP_AUTHORIZATION_COMPANY_SCOPES = AERP_AUTHORIZATION_COMPANY_SCOPES;
globalThis.AERP_AUTHORIZATION_EFFECTS = AERP_AUTHORIZATION_EFFECTS;
