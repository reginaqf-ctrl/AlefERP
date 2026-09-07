/* global __dirname, require */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

require('./AERP-036_AuthorizationEngine');

const CONSOLIDATED_RUNTIME_FILES = Object.freeze([
  '04_ActionEngine.js',
  '07_Writer.js',
  '36_AuthorizationEngine.js',
  '37_AuthorizationMetadataRepository.js',
  'AERP-036_AuthorizationEngine.js'
]);

function readConsolidatedRuntimeFile(fileName) {
  return fs.readFileSync(path.join(__dirname, fileName), 'utf8');
}

function buildConsolidatedAuthorizationRuntime() {
  const context = vm.createContext({
    console,
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Math,
    RegExp,
    Error,
    TypeError,
    Set,
    Map,
    Proxy
  });

  const source = CONSOLIDATED_RUNTIME_FILES.map(fileName =>
    readConsolidatedRuntimeFile(fileName)
  ).join('\n;\n');

  vm.runInContext(source, context, {
    filename: 'AERP-039-combined-authorization-runtime.js',
    timeout: 5000
  });

  return context;
}

function buildSheetRendererRuntime() {
  const context = vm.createContext({
    console,
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Math,
    RegExp,
    Error,
    TypeError,
    aerpRenderDashboardHero() {},
    aerpRenderDashboardKpi() {},
    aerpCreateDashboardHeroSpecification() {},
    aerpCreateDashboardKpiSpecification() {},
    aerpCalculateDashboardLayout() {}
  });

  vm.runInContext(readConsolidatedRuntimeFile('35_SheetRenderer.js'), context, {
    filename: '35_SheetRenderer.js',
    timeout: 5000
  });

  return context;
}

test('loads the consolidated runtime without global declaration collisions', () => {
  const runtime = buildConsolidatedAuthorizationRuntime();

  assert.equal(typeof runtime.aerpAuthorize, 'function');
  assert.equal(typeof runtime.aerpAuthorizeEnterprise, 'function');
  assert.notEqual(runtime.aerpAuthorize, runtime.aerpAuthorizeEnterprise);
});

test('keeps request/options authorization as the canonical public API', () => {
  const runtime = buildConsolidatedAuthorizationRuntime();
  const decision = runtime.aerpAuthorize({}, { rules: [] });

  assert.equal(decision.decision, 'DENY');
  assert.equal(decision.reason, 'INVALID_REQUEST');
  assert.equal(decision.allowed, false);
});

test('keeps enterprise context/model authorization named and fail-closed', () => {
  const runtime = buildConsolidatedAuthorizationRuntime();
  const decision = runtime.aerpAuthorizeEnterprise({}, {});

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionType, 'DENY');
  assert.equal(decision.implemented, false);
});

test('keeps exactly one productive aerpMetadataToRow declaration', () => {
  const owners = ['04_ActionEngine.js', '07_Writer.js'].filter(fileName =>
    /function\s+aerpMetadataToRow\s*\(/u.test(readConsolidatedRuntimeFile(fileName))
  );

  assert.deepEqual(owners, ['07_Writer.js']);
});

test('contains no productive eval calls in the Apps Script runtime inventory', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'qa/manifests/apps-script-globals.json'), 'utf8')
  );
  const owners = manifest.includedFiles
    .map(item => item.path)
    .filter(fileName => /\beval\s*\(/u.test(readConsolidatedRuntimeFile(fileName)));

  assert.deepEqual(owners, []);
});

test('resolves only explicitly registered sheet renderer functions and factories', () => {
  const runtime = buildSheetRendererRuntime();

  assert.equal(
    runtime.aerpResolveSheetRendererFunction_('aerpRenderDashboardHero'),
    runtime.aerpRenderDashboardHero
  );
  assert.equal(
    runtime.aerpResolveSpecificationFactory_('aerpCreateDashboardKpiSpecification'),
    runtime.aerpCreateDashboardKpiSpecification
  );
  assert.throws(
    () => runtime.aerpResolveSheetRendererFunction_('unregisteredRenderer'),
    /not available/u
  );
  assert.throws(
    () => runtime.aerpResolveSpecificationFactory_('unregisteredFactory'),
    /not available/u
  );
});

test('creates normalized authorization contracts', () => {
  const context = globalThis.aerpCreateAuthorizationContext({
    userId: '  user-1 ',
    companyId: '  company-7 ',
    companyScope: ' company ',
    roles: [' admin ', ' manager '],
    permissions: [' read ', ' write '],
    metadata: { source: 'api' }
  });

  assert.equal(context.userId, 'user-1');
  assert.equal(context.companyId, 'company-7');
  assert.equal(context.companyScope, 'COMPANY');
  assert.deepEqual(context.roles, ['ADMIN', 'MANAGER']);
  assert.deepEqual(context.permissions, ['READ', 'WRITE']);
  assert.deepEqual(context.metadata, { source: 'api' });

  const rule = globalThis.aerpCreateAuthorizationRule({
    id: '  rule-1 ',
    effect: ' allow ',
    resource: ' invoice ',
    action: ' read '
  });

  assert.equal(rule.id, 'rule-1');
  assert.equal(rule.effect, 'ALLOW');
  assert.equal(rule.resource, 'invoice');
  assert.equal(rule.action, 'read');

  const model = globalThis.aerpCreateAuthorizationModel({
    name: '  finance ',
    rules: [rule]
  });

  assert.equal(model.name, 'finance');
  assert.equal(model.rules[0].id, 'rule-1');
  assert.equal(model.defaultEffect, 'DENY');

  const decision = globalThis.aerpCreateAuthorizationDecision({
    effect: ' deny ',
    reasonCode: ' policy ',
    allowed: false,
    decisionType: 'DENY',
    matchedRuleIds: ['rule-1']
  });

  assert.equal(decision.effect, 'DENY');
  assert.equal(decision.decisionType, 'DENY');
  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, 'policy');
  assert.equal(decision.implemented, true);
  assert.equal(decision.modelVersion, '1.0.0');
  assert.deepEqual(decision.matchedRuleIds, ['rule-1']);
  assert.deepEqual(decision.validationIssues, []);
  assert.ok(typeof decision.timestamp === 'string' && decision.timestamp.length > 0);
  assert.equal(typeof decision.decisionId, 'string');
  assert.ok(decision.decisionId.length > 0);

  const validationResult = globalThis.aerpCreateAuthorizationValidationResult({
    isValid: true,
    errors: []
  });

  assert.equal(validationResult.isValid, true);
  assert.deepEqual(validationResult.errors, []);
});

test('normalizes a model with defaults', () => {
  const normalizedModel = globalThis.aerpNormalizeAuthorizationModel({
    name: '  sales ',
    rules: [{ id: 'r1', effect: 'allow', resource: 'lead', action: 'read' }]
  });

  assert.equal(normalizedModel.name, 'sales');
  assert.equal(normalizedModel.defaultEffect, 'DENY');
  assert.equal(normalizedModel.rules[0].effect, 'ALLOW');
});

test('rejects authorization context missing required fields', () => {
  const result = globalThis.aerpValidateAuthorizationContext({
    companyId: 'company-7'
  });

  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(error => error.includes('userId')));
});

test('rejects an invalid authorization model', () => {
  const result = globalThis.aerpValidateAuthorizationModel({
    name: 'finance',
    rules: 'not-an-array'
  });

  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(error => error.includes('rules')));
});

test('rejects an invalid rule effect', () => {
  const result = globalThis.aerpValidateAuthorizationModel({
    name: 'finance',
    rules: [{ id: 'r1', effect: 'maybe', resource: 'invoice', action: 'read' }]
  });

  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(error => error.includes('effect')));
});

test('rejects an invalid company scope', () => {
  const result = globalThis.aerpValidateAuthorizationContext({
    userId: 'user-1',
    companyId: 'company-7',
    companyScope: 'region'
  });

  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(error => error.includes('companyScope')));
});

test('fails closed for incomplete authorization entry points', () => {
  const decision = globalThis.aerpAuthorizeEnterprise(
    {
      userId: 'user-1',
      companyId: 'company-7',
      companyScope: 'COMPANY'
    },
    {
      name: 'finance',
      rules: []
    }
  );

  assert.equal(decision.allowed, false);
  assert.equal(decision.decisionType, 'DENY');
  assert.equal(decision.effect, 'DENY');
  assert.equal(decision.implemented, false);
  assert.equal(decision.reasonCode, 'NOT_IMPLEMENTED');
  assert.equal(decision.modelVersion, '1.0.0');
  assert.deepEqual(decision.matchedRuleIds, []);
  assert.deepEqual(decision.validationIssues, []);
  assert.ok(typeof decision.timestamp === 'string' && decision.timestamp.length > 0);
  assert.equal(typeof decision.decisionId, 'string');
  assert.ok(decision.decisionId.length > 0);
});

test('creates unique decision identifiers', () => {
  const firstDecision = globalThis.aerpCreateAuthorizationDecision({
    effect: 'ALLOW',
    reasonCode: 'policy'
  });

  const secondDecision = globalThis.aerpCreateAuthorizationDecision({
    effect: 'DENY',
    reasonCode: 'policy'
  });

  assert.notEqual(firstDecision.decisionId, secondDecision.decisionId);
});

test('builds a normalized authorization model from injected metadata', () => {
  const input = globalThis.aerpCreateAuthorizationMetadataInput({
    usuarioRoles: [
      { userId: '  user-1 ', roleId: ' admin ', email: ' User@Example.com ', active: 'true' },
      { userId: 'user-1', roleId: ' manager ', email: 'user@example.com', active: true }
    ],
    rolModulos: [
      { roleId: 'ADMIN', moduleId: 'FINANCE', active: true },
      { roleId: 'MANAGER', moduleId: 'SALES', active: true }
    ],
    permisos: [
      {
        ruleId: '  perm-1 ',
        subjectType: 'USER',
        subjectId: 'user-1',
        effect: ' allow ',
        moduleCode: 'FINANCE',
        actionCode: 'READ',
        companyScope: ' COMPANY ',
        priority: 5,
        active: true,
        conditions: { region: 'MX' }
      },
      {
        ruleId: 'perm-2',
        subjectType: 'ROLE',
        subjectId: 'MANAGER',
        effect: 'deny',
        moduleCode: 'SALES',
        actionCode: 'WRITE',
        companyScope: 'TENANT',
        priority: 2,
        active: false
      }
    ],
    modulos: [
      { moduleId: ' finance ', moduleCode: 'FINANCE', name: ' Finance ', active: true },
      { moduleId: 'sales', moduleCode: 'SALES', name: ' Sales ', active: true }
    ],
    menus: [{ menuId: ' menu-1 ', menuCode: 'MENU-1', name: ' Main ', active: true }],
    menuItems: [
      {
        itemId: ' item-1 ',
        itemCode: 'ITEM-1',
        menuId: 'MENU-1',
        moduleCode: 'FINANCE',
        actionCode: 'READ',
        active: true
      }
    ],
    empresas: [
      { companyId: ' company-7 ', companyCode: 'COMPANY-7', name: ' Alpha ', active: true }
    ]
  });

  const model = globalThis.aerpBuildAuthorizationModel(input, { name: '  finance model ' });

  assert.equal(model.name, 'finance model');
  assert.equal(model.modelVersion, '1.0.0');
  assert.equal(model.validationState, 'VALID');
  assert.deepEqual(model.rolesByUser['USER-1'], ['ADMIN', 'MANAGER']);
  assert.deepEqual(model.modulesByRole.ADMIN, ['FINANCE']);
  assert.equal(model.permissionRules.length, 1);
  assert.equal(model.permissionRules[0].effect, 'ALLOW');
  assert.equal(model.permissionRules[0].subjectId, 'USER-1');
  assert.equal(model.permissionRules[0].companyScope, 'COMPANY');
  assert.equal(model.modules[0].moduleCode, 'FINANCE');
  assert.equal(model.menus[0].menuCode, 'MENU-1');
  assert.equal(model.menuItems[0].itemCode, 'ITEM-1');
  assert.equal(model.companies[0].companyCode, 'COMPANY-7');
  assert.equal(model.defaults.defaultEffect, 'DENY');
  assert.equal(model.defaults.failClosed, true);
  assert.equal(model.defaults.allowImplicit, false);
  assert.ok(Array.isArray(model.metadataDiagnostics));
});

test('normalizes emails and identifiers for metadata input', () => {
  const input = globalThis.aerpCreateAuthorizationMetadataInput({
    usuarioRoles: [
      { userId: ' user-2 ', roleId: ' role-2 ', email: ' User@Example.com ', active: true }
    ]
  });

  assert.equal(input.usuarioRoles[0].email, 'user@example.com');
  assert.equal(input.usuarioRoles[0].userId, 'USER-2');
  assert.equal(input.usuarioRoles[0].roleId, 'ROLE-2');
});

test('excludes inactive permissions and reports diagnostics', () => {
  const input = globalThis.aerpCreateAuthorizationMetadataInput({
    permisos: [
      {
        ruleId: 'perm-1',
        subjectType: 'USER',
        subjectId: 'user-1',
        effect: 'allow',
        moduleCode: 'FINANCE',
        actionCode: 'READ',
        companyScope: 'COMPANY',
        active: false
      }
    ],
    modulos: [{ moduleId: 'finance', moduleCode: 'FINANCE', name: 'Finance', active: true }]
  });

  const model = globalThis.aerpBuildAuthorizationModel(input);

  assert.equal(model.permissionRules.length, 0);
  assert.ok(model.metadataDiagnostics.some(item => item.code === 'INACTIVE_PERMISSION_EXCLUDED'));
});

test('reports unknown modules and invalid company references', () => {
  const input = globalThis.aerpCreateAuthorizationMetadataInput({
    permisos: [
      {
        ruleId: 'perm-1',
        subjectType: 'USER',
        subjectId: 'user-1',
        effect: 'allow',
        moduleCode: 'UNKNOWN',
        actionCode: 'READ',
        companyScope: 'MISSING',
        active: true
      }
    ],
    modulos: [{ moduleId: 'finance', moduleCode: 'FINANCE', name: 'Finance', active: true }],
    empresas: [{ companyId: 'company-7', companyCode: 'COMPANY-7', name: 'Alpha', active: true }]
  });

  const model = globalThis.aerpBuildAuthorizationModel(input);
  const codes = model.metadataDiagnostics.map(item => item.code);

  assert.ok(codes.includes('UNKNOWN_MODULE_REFERENCE'));
  assert.ok(codes.includes('INVALID_COMPANY_REFERENCE'));
  assert.equal(model.validationState, 'INVALID');
});

test('reports duplicate identifiers and preserves input immutability', () => {
  const input = {
    usuarioRoles: [{ userId: 'user-1', roleId: 'ADMIN' }],
    rolModulos: [
      { roleId: 'ADMIN', moduleId: 'FINANCE' },
      { roleId: 'ADMIN', moduleId: 'FINANCE' }
    ],
    permisos: [
      {
        ruleId: 'perm-1',
        subjectType: 'USER',
        subjectId: 'user-1',
        effect: 'allow',
        moduleCode: 'FINANCE',
        actionCode: 'READ',
        companyScope: 'COMPANY',
        active: true
      }
    ],
    modulos: [{ moduleId: 'finance', moduleCode: 'FINANCE', name: 'Finance', active: true }],
    menus: [],
    menuItems: [],
    empresas: []
  };

  const originalSnapshot = JSON.stringify(input);
  const normalizedInput = globalThis.aerpCreateAuthorizationMetadataInput(input);
  const model = globalThis.aerpBuildAuthorizationModel(normalizedInput);
  const diagnosticCodes = model.metadataDiagnostics.map(item => item.code);

  assert.equal(JSON.stringify(input), originalSnapshot);
  assert.ok(diagnosticCodes.includes('DUPLICATE_ROLE_MODULE_MAPPING'));
});

test('keeps the authorization model serializable and fail-closed on critical metadata errors', () => {
  const input = globalThis.aerpCreateAuthorizationMetadataInput({
    permisos: [
      {
        ruleId: 'perm-1',
        subjectType: 'USER',
        subjectId: 'user-1',
        effect: 'maybe',
        moduleCode: 'FINANCE',
        actionCode: 'READ',
        companyScope: 'COMPANY',
        active: true
      }
    ],
    modulos: [{ moduleId: 'finance', moduleCode: 'FINANCE', name: 'Finance', active: true }],
    empresas: []
  });

  const model = globalThis.aerpBuildAuthorizationModel(input);
  const serialized = JSON.stringify(model);

  assert.equal(typeof serialized, 'string');
  assert.equal(model.validationState, 'INVALID');
  assert.equal(model.defaults.failClosed, true);
  assert.equal(model.defaults.allowImplicit, false);
  assert.ok(model.metadataDiagnostics.some(item => item.code === 'INVALID_PERMISSION_EFFECT'));
});
