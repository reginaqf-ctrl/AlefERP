/* global __dirname, require */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function fixture(overrides = {}) {
  const calls = [];
  let planState = overrides.planState || 'CLEAN';
  let planOperations = overrides.planOperations ?? (planState === 'CLEAN' ? 21 : 0);
  let applyResult = overrides.applyResult || {
    ok: false,
    state: 'INCOMPLETE',
    persistence: 'CONFIRMED',
    created: 21
  };
  let readiness = overrides.readiness || { ok: false };
  let verification = overrides.verification || { ok: false, state: 'INCOMPLETE' };
  const installer = {
    issueConfirmation(input) {
      calls.push(['issue', input]);
      return { confirmationId: 'confirmation_1', nonce: 'nonce-1' };
    },
    renewConfirmation(input) {
      calls.push(['renew', input]);
      return { confirmationId: 'confirmation_2', nonce: 'nonce-2' };
    },
    recordAppSheetCoreAttestation(input) {
      calls.push(['attest', input]);
      return overrides.attestationResult || { ok: true, persistence: 'CONFIRMED' };
    },
    getAppSheetCoreReadiness() {
      calls.push(['readiness']);
      return readiness;
    },
    plan(request) {
      calls.push(['plan', request]);
      return {
        ok: true,
        state: planState,
        operations: Array.from({ length: planOperations }, (_, index) => ({ id: index })),
        journal: [{ sensitive: 'must-not-escape' }]
      };
    },
    verify(request) {
      calls.push(['verify', request]);
      return verification;
    },
    apply(request) {
      calls.push(['apply', request]);
      return applyResult;
    }
  };
  const context = vm.createContext({ console });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, 'AERP-041_OperationalController.js'), 'utf8'),
    context
  );
  const config = Object.prototype.hasOwnProperty.call(overrides, 'config')
    ? overrides.config
    : {
        sourceId: 'source-1',
        tenantId: 'tenant-A',
        expectedAudience: 'apps-script-client-id.apps.googleusercontent.com',
        expectedAdminEmail: 'admin@example.test',
        company: {
          code: 'TENANT_A',
          name: 'Empresa inicial',
          currency: 'USD',
          timeZone: 'Europe/Madrid'
        }
      };
  const tableNames = [
    'CORE_EMPRESAS',
    'CORE_USUARIOS',
    'CORE_ROLES',
    'CORE_MODULOS',
    'CORE_USUARIO_ROL',
    'CORE_ROL_MODULO',
    'CORE_PERMISOS',
    'CORE_CONFIGURACION',
    'ERP_CLIENTES',
    'ERP_PROVEEDORES',
    'ERP_PRODUCTOS',
    'ERP_INVENTARIO',
    'ERP_MOVIMIENTOS_INVENTARIO',
    'ERP_PEDIDOS',
    'ERP_PEDIDO_DETALLE',
    'ERP_VENTAS',
    'ERP_VENTA_DETALLE'
  ];
  const attestation = {
    appId: 'alef-erp-core-app',
    appVersion: 1,
    templateVersion: '1.0.0',
    deploymentCheckReference: 'DEPLOYMENT_CHECK_001',
    evidenceDigest: 'a'.repeat(64),
    checks: {
      requireSignIn: true,
      googleAuthenticationProvider: true,
      allowAllSignedInUsersDisabled: true,
      explicitUserAllowlist: true,
      updatesRestrictedByRole: true,
      deploymentCheckPassed: true,
      adminAllowTestPassed: true,
      restrictedUserDenyTestPassed: true,
      crossTenantDenyTestPassed: true,
      auditHistoryReviewed: true
    },
    tableChecks: tableNames.map((physicalName, index) => ({
      physicalName,
      securityFilterVerified: true,
      updatePolicyVerified: true,
      adminAllowTestPassed: true,
      restrictedUserDenyTestPassed: true,
      crossTenantDenyTestPassed: true,
      evidenceReference: `TABLE_CHECK_${String(index + 1).padStart(2, '0')}`,
      evidenceDigest: String(index + 1).padStart(64, '0')
    }))
  };
  context.dependencies = {
    readConfiguration() {
      calls.push(['configuration']);
      return config;
    },
    getTargetId() {
      calls.push(['target']);
      return overrides.targetId || 'target-1';
    },
    createSecureInstaller(configuration) {
      calls.push(['create', configuration]);
      return installer;
    },
    readAppSheetAttestation() {
      calls.push(['read-attestation']);
      return overrides.attestation || attestation;
    },
    confirmPlan(summary) {
      calls.push(['confirm-plan', summary]);
      return overrides.confirmPlan !== false;
    },
    confirmCompletion(summary) {
      calls.push(['confirm-completion', summary]);
      return overrides.confirmCompletion !== false;
    }
  };
  vm.runInContext(
    'var controller = aerpCreateOperationalInstallerController(dependencies);',
    context
  );
  return {
    calls,
    context,
    run: code => vm.runInContext(code, context),
    setPlan(state, operations) {
      planState = state;
      planOperations = operations;
    },
    setApply(result) {
      applyResult = result;
    },
    setReadiness(result) {
      readiness = result;
    },
    setVerification(result) {
      verification = result;
    }
  };
}

function appsScriptPublicFixture(configurationRaw) {
  const calls = [];
  const context = vm.createContext({ console });
  context.PropertiesService = {
    getScriptProperties: () => ({
      getProperty(key) {
        calls.push(['property', key]);
        return key === 'AERP041_OPERATIONAL_CONFIG' ? configurationRaw : null;
      }
    })
  };
  context.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({ getId: () => 'target-1' })
  };
  context.aerpCreateSecureAppsScriptInstaller = configuration => {
    calls.push(['create-secure-installer', configuration]);
    return {
      issueConfirmation() {
        return { confirmationId: 'confirmation_1', nonce: 'nonce-1' };
      },
      renewConfirmation() {
        return { confirmationId: 'confirmation_2', nonce: 'nonce-2' };
      },
      recordAppSheetCoreAttestation() {
        return { ok: false, persistence: 'UNCHANGED' };
      },
      getAppSheetCoreReadiness() {
        return { ok: false };
      },
      plan(request) {
        calls.push(['plan', request]);
        return { ok: true, state: 'CLEAN', operations: [] };
      },
      verify() {
        return { ok: false, state: 'INCOMPLETE' };
      },
      apply() {
        return { ok: false, state: 'INCOMPLETE', persistence: 'UNCHANGED' };
      }
    };
  };
  context.aerpConfirm = () => true;
  context.aerpSuccess = (message, title) => calls.push(['success', title, message]);
  context.aerpWarning = (message, title) => calls.push(['warning', title, message]);
  context.aerpInfo = (message, title) => calls.push(['info', title, message]);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, 'AERP-041_OperationalController.js'), 'utf8'),
    context
  );
  return { calls, context, run: code => vm.runInContext(code, context) };
}

function validOperationalConfiguration() {
  return {
    sourceId: 'source-1',
    tenantId: 'tenant-A',
    expectedAudience: 'apps-script-client-id.apps.googleusercontent.com',
    expectedAdminEmail: 'admin@example.test',
    company: {
      code: 'TENANT_A',
      name: 'Empresa inicial',
      currency: 'USD',
      timeZone: 'Europe/Madrid'
    }
  };
}

test('clean start confirms the plan, issues ephemeral evidence and remains incomplete', () => {
  const f = fixture();
  const result = f.run('controller.start()');
  assert.equal(result.ok, false);
  assert.equal(result.state, 'INCOMPLETE');
  assert.equal(result.created, 21);
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(
    f.calls
      .filter(call => ['confirm-plan', 'issue', 'apply'].includes(call[0]))
      .map(call => call[0]),
    ['confirm-plan', 'issue', 'apply']
  );
  assert.equal(JSON.stringify(result).includes('nonce'), false);
  assert.equal(JSON.stringify(result).includes('sensitive'), false);
  const applied = f.calls.find(call => call[0] === 'apply')[1];
  assert.equal(applied.confirmation.confirmationId, 'confirmation_1');
  assert.equal(applied.confirmation.nonce, 'nonce-1');
  assert.equal(
    f.calls.find(call => call[0] === 'create')[1].expectedAdminEmail,
    'admin@example.test'
  );
});

test('cancelling start performs no confirmation or installation writes', () => {
  const f = fixture({ confirmPlan: false });
  const result = f.run('controller.start()');
  assert.equal(result.code, 'OPERATIONAL_USER_CANCELLED');
  assert.equal(
    f.calls.some(call => call[0] === 'issue'),
    false
  );
  assert.equal(
    f.calls.some(call => call[0] === 'renew'),
    false
  );
  assert.equal(
    f.calls.some(call => call[0] === 'apply'),
    false
  );
});

test('missing, extra and hostile configuration fail closed before installer creation', () => {
  for (const config of [
    null,
    {
      sourceId: 'source-1',
      tenantId: 'tenant-A',
      expectedAudience: 'client',
      company: { code: 'TENANT_A', name: 'Empresa', currency: 'USD', timeZone: 'UTC' }
    },
    {
      sourceId: 'source-1',
      tenantId: 'tenant-A',
      expectedAudience: 'client',
      expectedAdminEmail: 'not-an-email',
      company: { code: 'TENANT_A', name: 'Empresa', currency: 'USD', timeZone: 'UTC' }
    },
    {
      sourceId: 'source-1',
      tenantId: 'tenant-A',
      expectedAudience: 'client',
      expectedAdminEmail: 'admin@example.test',
      company: { code: 'TENANT_A', name: 'Empresa', currency: 'USD', timeZone: 'UTC' },
      grantsAuthorization: true
    },
    {
      sourceId: 'invalid source',
      tenantId: 'tenant-A',
      expectedAudience: 'client',
      expectedAdminEmail: 'admin@example.test',
      company: { code: 'TENANT_A', name: 'Empresa', currency: 'USD', timeZone: 'UTC' }
    }
  ]) {
    const f = fixture({ config });
    assert.equal(f.run('controller.preview().ok'), false);
    assert.equal(
      f.calls.some(call => call[0] === 'create'),
      false
    );
  }

  let getterReads = 0;
  const hostile = {
    tenantId: 'tenant-A',
    expectedAudience: 'client',
    expectedAdminEmail: 'admin@example.test',
    company: { code: 'TENANT_A', name: 'Empresa', currency: 'USD', timeZone: 'UTC' }
  };
  Object.defineProperty(hostile, 'sourceId', {
    enumerable: true,
    get() {
      getterReads += 1;
      return 'source-1';
    }
  });
  const hostileFixture = fixture({ config: hostile });
  assert.equal(hostileFixture.run('controller.preview().ok'), false);
  assert.equal(getterReads, 0);
});

test('source and active target must be distinct opaque identifiers', () => {
  const same = fixture({ targetId: 'source-1' });
  assert.equal(same.run('controller.start().ok'), false);
  assert.equal(
    same.calls.some(call => call[0] === 'create'),
    false
  );
  const invalid = fixture({ targetId: 'target/unsafe' });
  assert.equal(invalid.run('controller.start().ok'), false);
  assert.equal(
    invalid.calls.some(call => call[0] === 'create'),
    false
  );
});

test('partial start renews the existing claim instead of issuing a new grant', () => {
  const f = fixture({ planState: 'PARTIAL', planOperations: 0 });
  f.run('controller.start()');
  assert.equal(
    f.calls.some(call => call[0] === 'issue'),
    false
  );
  assert.equal(f.calls.filter(call => call[0] === 'renew').length, 1);
  assert.equal(f.calls.filter(call => call[0] === 'apply').length, 1);
});

test('completion records attestation, renews evidence and reaches complete', () => {
  const f = fixture({
    planState: 'PARTIAL',
    planOperations: 0,
    applyResult: { ok: true, state: 'COMPLETE', persistence: 'CONFIRMED', created: 0 }
  });
  const result = f.run('controller.complete()');
  assert.equal(result.ok, true);
  assert.equal(result.state, 'COMPLETE');
  assert.deepEqual(
    f.calls
      .filter(call => ['confirm-completion', 'attest', 'renew', 'apply'].includes(call[0]))
      .map(call => call[0]),
    ['confirm-completion', 'attest', 'renew', 'apply']
  );
  assert.equal(JSON.stringify(result).includes('evidenceDigest'), false);
});

test('rejected or ambiguous attestation blocks renewal and final apply', () => {
  for (const attestationResult of [
    { ok: false, persistence: 'UNCHANGED' },
    { ok: false, persistence: 'UNKNOWN' }
  ]) {
    const f = fixture({ planState: 'PARTIAL', planOperations: 0, attestationResult });
    const result = f.run('controller.complete()');
    assert.equal(result.ok, false);
    assert.equal(result.persistence, attestationResult.persistence);
    assert.equal(
      f.calls.some(call => call[0] === 'renew'),
      false
    );
    assert.equal(
      f.calls.some(call => call[0] === 'apply'),
      false
    );
  }
});

test('invalid checklist and user cancellation do not write attestation', () => {
  const invalid = fixture({ planState: 'PARTIAL', planOperations: 0 });
  invalid.context.dependencies.readAppSheetAttestation = () => ({ checks: {} });
  assert.equal(invalid.run('controller.complete().ok'), false);
  assert.equal(
    invalid.calls.some(call => call[0] === 'attest'),
    false
  );

  const cancelled = fixture({
    planState: 'PARTIAL',
    planOperations: 0,
    confirmCompletion: false
  });
  assert.equal(cancelled.run('controller.complete().code'), 'OPERATIONAL_USER_CANCELLED');
  assert.equal(
    cancelled.calls.some(call => call[0] === 'attest'),
    false
  );
});

test('status exposes only bounded readiness and verification facts', () => {
  const f = fixture({
    planState: 'COMPLETE',
    planOperations: 0,
    readiness: { ok: true, reviewer: { email: 'secret@example.test' } },
    verification: { ok: true, state: 'COMPLETE', verified: true, journal: ['secret'] }
  });
  const result = f.run('controller.status()');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    ok: true,
    state: 'COMPLETE',
    operations: 0,
    appSheetReady: true,
    verified: true,
    persistence: 'UNCHANGED'
  });
  assert.equal(Object.isFrozen(result), true);
});

test('missing dependencies and a clean completion request fail without mutation', () => {
  const missing = vm.createContext({ console });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, 'AERP-041_OperationalController.js'), 'utf8'),
    missing
  );
  vm.runInContext('var broken = aerpCreateOperationalInstallerController({});', missing);
  assert.equal(vm.runInContext('broken.start().ok', missing), false);

  const clean = fixture();
  const result = clean.run('controller.complete()');
  assert.equal(result.code, 'OPERATIONAL_INSTALLATION_NOT_STARTED');
  assert.equal(
    clean.calls.some(call => call[0] === 'read-attestation'),
    false
  );
  assert.equal(
    clean.calls.some(call => call[0] === 'attest'),
    false
  );
});

test('Apps Script production wiring rejects absent, malformed and hostile properties', () => {
  const invalidProperties = [
    null,
    '{',
    JSON.stringify({ ...validOperationalConfiguration(), extra: true }),
    JSON.stringify({
      ...validOperationalConfiguration(),
      ['__proto__']: { grantsAuthorization: true }
    })
  ];
  for (const raw of invalidProperties) {
    const f = appsScriptPublicFixture(raw);
    const result = f.run('aerpCreateAppsScriptOperationalInstallerController().preview()');
    assert.equal(result.ok, false);
    assert.equal(
      f.calls.some(call => call[0] === 'create-secure-installer'),
      false
    );
  }
});

test('Apps Script production wiring derives the bound target from the active spreadsheet', () => {
  const f = appsScriptPublicFixture(JSON.stringify(validOperationalConfiguration()));
  const result = f.run('aerpCreateAppsScriptOperationalInstallerController().preview()');
  assert.equal(result.ok, true);
  assert.equal(result.state, 'CLEAN');
  const configuration = f.calls.find(call => call[0] === 'create-secure-installer')[1];
  assert.equal(configuration.sourceId, 'source-1');
  assert.equal(configuration.targetId, 'target-1');
  assert.equal(configuration.tenantId, 'tenant-A');
});

test('Apps Script menu handlers invoke only their bounded operational action', () => {
  const f = appsScriptPublicFixture(JSON.stringify(validOperationalConfiguration()));
  f.run(`
    var publicMenuCalls = [];
    aerpCreateAppsScriptOperationalInstallerController = function () {
      return {
        start: function () {
          publicMenuCalls.push('start');
          return { ok: false, state: 'INCOMPLETE', code: 'START_PENDING' };
        },
        complete: function () {
          publicMenuCalls.push('complete');
          return { ok: true, state: 'COMPLETE', code: 'COMPLETE' };
        },
        status: function () {
          publicMenuCalls.push('status');
          return { ok: true, state: 'COMPLETE', code: 'STATUS' };
        }
      };
    };
  `);
  assert.equal(f.run('menuAerp041SecureInstall().state'), 'INCOMPLETE');
  assert.equal(f.run('menuAerp041CompleteAppSheetCore().state'), 'COMPLETE');
  assert.equal(f.run('menuAerp041SecureStatus().state'), 'COMPLETE');
  assert.deepEqual(Array.from(f.run('publicMenuCalls')), ['start', 'complete', 'status']);
  assert.deepEqual(
    f.calls.filter(call => ['warning', 'success', 'info'].includes(call[0])).map(call => call[0]),
    ['warning', 'success', 'info']
  );
});

test('main menu registers all three AERP-041 operational entries', () => {
  const items = [];
  const builder = {
    addItem(label, handler) {
      items.push([label, handler]);
      return this;
    },
    addSeparator() {
      return this;
    },
    addToUi() {
      return this;
    }
  };
  const context = vm.createContext({
    SpreadsheetApp: { getUi: () => ({ createMenu: () => builder }) }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '18_Menu.js'), 'utf8'), context);
  vm.runInContext('onOpen()', context);
  assert.deepEqual(
    items.filter(item => item[1].startsWith('menuAerp041')),
    [
      ['Instalación segura', 'menuAerp041SecureInstall'],
      ['Completar AppSheet Core', 'menuAerp041CompleteAppSheetCore'],
      ['Estado instalación segura', 'menuAerp041SecureStatus']
    ]
  );
});
