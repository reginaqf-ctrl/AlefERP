/* global Buffer, __dirname, require */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const test = require('node:test');
const crypto = require('node:crypto');

function fixture() {
  const properties = new Map();
  const sheets = new Map();
  const control = {
    locked: false,
    busy: false,
    failStorage: false,
    writes: 0,
    flushes: 0,
    lastWrittenSheet: null
  };
  let nextSheetId = 1;
  function sheet(name, rows = []) {
    const sheetId = nextSheetId++;
    const item = {
      getSheetId: () => sheetId,
      getName: () => name,
      getLastRow: () => rows.length,
      getLastColumn: () => rows[0]?.length || 0,
      getRange: (r, c, height, width) => ({
        getValues: () => {
          const values = Array.from({ length: height }, (_, i) =>
            Array.from({ length: width }, (_, j) => rows[r - 1 + i]?.[c - 1 + j] ?? '')
          );
          if (
            control.corruptReadbackSheet === name &&
            control.lastWrittenSheet === name &&
            r === 2
          ) {
            control.corruptReadbackSheet = null;
            values[0][0] = 'CORRUPTED_READBACK';
          }
          return values;
        },
        setValues(values) {
          assert.equal(control.locked, true);
          if (control.failHeaders) throw Error('header write failure');
          if (control.failSheetWrite === name && r >= 2) throw Error('selected sheet failure');
          control.writes++;
          values.forEach((row, i) => {
            rows[r - 1 + i] = [...row];
          });
          control.lastWrittenSheet = name;
        }
      })
    };
    sheets.set(name, item);
    return item;
  }
  const spreadsheet = {
    getId: () => 'target-1',
    getSheets: () => [...sheets.values()],
    getSheetByName: name => sheets.get(name) || null,
    insertSheet(name) {
      assert.equal(control.locked, true);
      assert.equal(sheets.has(name), false);
      control.writes++;
      return sheet(name);
    }
  };
  const context = vm.createContext({ console });
  let uuid = 0;
  const defaultOidcPayload = {
    iss: 'https://accounts.google.com',
    sub: 'principal-1',
    aud: 'apps-script-client-id',
    email: 'admin@example.test',
    email_verified: true,
    name: 'Administración QA',
    iat: 1000,
    exp: 5000
  };
  let oidcPayload = { ...defaultOidcPayload };
  context.Utilities = {
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    computeDigest: (algorithm, value, charset) => [
      ...crypto.createHash(algorithm).update(value, charset).digest()
    ],
    base64DecodeWebSafe: value => [...Buffer.from(value, 'base64url')],
    newBlob: value => ({ getDataAsString: () => Buffer.from(value).toString('utf8') }),
    getUuid: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`
  };
  context.ScriptApp = {
    getIdentityToken: () =>
      `header.${Buffer.from(JSON.stringify(oidcPayload)).toString('base64url')}.signature`
  };
  context.SpreadsheetApp = {
    getActiveSpreadsheet: () => spreadsheet,
    flush() {
      control.flushes++;
      if (control.failFlush) throw Error('flush failure');
    }
  };
  context.PropertiesService = {
    getDocumentProperties: () => ({
      getProperty: key => {
        if (control.failRead) throw Error('read failure');
        return properties.get(key) ?? null;
      },
      setProperty(key, value) {
        assert.equal(control.locked, true);
        if (control.failStorage) throw Error('secret storage detail');
        if (control.failKey && key.includes(control.failKey)) throw Error('selected write failure');
        if (
          control.failCompleteState &&
          key.endsWith(':state') &&
          JSON.parse(value).status === 'COMPLETE'
        )
          throw Error('complete state write failure');
        control.writes++;
        properties.set(key, value);
        if (control.ambiguousKey && key.includes(control.ambiguousKey))
          throw Error('committed but response lost');
      }
    })
  };
  context.LockService = {
    getDocumentLock: () => ({
      tryLock() {
        if (control.busy || control.locked) return false;
        control.locked = true;
        return true;
      },
      releaseLock() {
        control.locked = false;
      }
    })
  };
  for (const file of [
    '36_AuthorizationEngine.js',
    '37_AuthorizationMetadataRepository.js',
    'AERP-036_AuthorizationEngine.js',
    'AERP-040_CommercialBlueprint.js',
    'AERP-040_CommercialPresentationManifest.js',
    'AERP-041_IsolatedInstallerEngine.js',
    'AERP-041_InstallerIntegration.js',
    '11_Installer.js',
    'AERP-041_AppSheetCoreReadinessValidator.js',
    'AERP-041_SecureBootstrap.js',
    'AERP-041_AppsScriptRuntimeAdapter.js',
    'AERP-041_OperationalController.js'
  ])
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context);
  vm.runInContext(
    `
    var configuration = {
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      trustedPrincipalVerifier(input) {
        return input.authentication.token === 'trusted' && input.requestedCompanyId === 'tenant-A'
          ? { ok: true, verified: true, principal: {
              issuer: 'fixture', subjectId: 'principal-1', userId: 'USER_1'
            }} : { ok: false };
      },
      verifyConfirmation(input) {
        return input.evidence.token === 'confirmed' ? {
          ...input, confirmed: true, confirmationId: 'confirmation-1'
        } : null;
      },
      validateApplication: () => ({ ok: true, errors: [] })
    };
    var request = {
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      identity: { token: 'trusted' }, confirmation: { token: 'confirmed' },
      resourceTenantId: 'tenant-A', resource: 'ADMINISTRACION', action: 'READ'
    };
    var appSheetCoreAttestation = {
      appId: 'alef-erp-core-app',
      appVersion: 1,
      templateVersion: '1.0.0',
      deploymentCheckReference: 'DEPLOYMENT_CHECK_001',
      evidenceDigest: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
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
      tableChecks: aerpBuildCommercialInstallerPlan().blueprint.tables.map((table, index) => ({
        physicalName: table.physicalName,
        securityFilterVerified: true,
        updatePolicyVerified: true,
        adminAllowTestPassed: true,
        restrictedUserDenyTestPassed: true,
        crossTenantDenyTestPassed: true,
        evidenceReference: 'TABLE_CHECK_' + String(index + 1).padStart(2, '0'),
        evidenceDigest: String(index + 1).padStart(64, '0')
      }))
    };
  `,
    context
  );
  function run(code) {
    return vm.runInContext(code, context);
  }
  function seedAuthorization(deny = false) {
    const blueprint = run('aerpBuildCommercialInstallerPlan().blueprint');
    const values = {
      CORE_USUARIO_ROL: { ID_Usuario: 'USER_1', ID_Rol: 'ROLE_1' },
      CORE_ROL_MODULO: { ID_Rol: 'ROLE_1', ID_Modulo: 'ADMINISTRACION' },
      CORE_PERMISOS: {
        ID_Permiso: 'PERM_1',
        ID_Rol: 'ROLE_1',
        ID_Modulo: 'ADMINISTRACION',
        Nivel_Acceso: 'ALLOW',
        Puede_Ver: true,
        Puede_Administrar: true
      }
    };
    for (const table of blueprint.tables) {
      if (!values[table.physicalName]) continue;
      const headers = Array.from(table.columns, col => col.Nombre_Campo);
      const record = { ID_Empresa: 'tenant-A', Activo: true, ...values[table.physicalName] };
      const rows = [headers, headers.map(key => record[key] ?? false)];
      if (deny && table.physicalName === 'CORE_PERMISOS') {
        rows.push(
          headers.map(key =>
            key === 'ID_Permiso'
              ? 'PERM_DENY'
              : key.startsWith('Puede_')
                ? false
                : (record[key] ?? false)
          )
        );
      }
      sheet(table.physicalName, rows);
    }
  }
  const create = () => run('var runtime = aerpCreateAppsScriptInstallerRuntime(configuration);');
  const setOidcPayload = overrides => {
    oidcPayload = { ...defaultOidcPayload, ...overrides };
  };
  return {
    run,
    create,
    seedAuthorization,
    setOidcPayload,
    properties,
    sheets,
    control,
    sheet,
    context
  };
}

function sheetRecords(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, headers.length)
    .getValues()
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
}

function prepareBootstrapCompletion(f) {
  f.run(`
    var clockMs = 2000000;
    var secureInstaller = aerpCreateSecureAppsScriptInstaller({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => clockMs,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' },
      validateApplication: () => ({ ok: true, errors: [] })
    });
    request.identity = { provider: 'GOOGLE_OIDC' };
    request.confirmation = secureInstaller.issueConfirmation({ intent: 'APPLY' });
  `);
  assert.equal(f.run('secureInstaller.apply(request).state'), 'INCOMPLETE');
  assert.equal(
    f.run('secureInstaller.recordAppSheetCoreAttestation(appSheetCoreAttestation).ok'),
    true
  );
}

function bootstrapAuthorizationDecision(f, moduleId = 'CLIENTES') {
  f.context.bootstrapUserId = sheetRecords(f.sheets.get('CORE_USUARIOS'))[0].ID_Usuario;
  f.context.bootstrapProbeModuleId = moduleId;
  return f.run(`
    (function () {
      var bootstrapTrustedVerifier = function () {
        return { ok: true, verified: true, principal: {
          issuer: 'https://accounts.google.com', subjectId: 'principal-1', userId: bootstrapUserId
        }};
      };
      return aerpAuthorizeFromMetadata({
        authentication: { token: 'trusted' },
        companyId: 'tenant-A', moduleId: bootstrapProbeModuleId, action: 'VIEW',
        context: { companyId: 'tenant-A' }
      }, { trustedPrincipalVerifier: bootstrapTrustedVerifier }).decision;
    })()
  `);
}

test('one-time OIDC bootstrap provisions explicit admin grants and waits for application', () => {
  const f = fixture();
  f.run(`
    var secureInstaller = aerpCreateSecureAppsScriptInstaller({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' },
      validateApplication: () => ({ ok: true, errors: [] })
    });
    request.identity = { provider: 'GOOGLE_OIDC' };
    request.confirmation = secureInstaller.issueConfirmation({ intent: 'APPLY' });
  `);
  const incomplete = f.run('secureInstaller.apply(request)');
  assert.equal(incomplete.ok, false);
  assert.equal(incomplete.state, 'INCOMPLETE');
  assert.equal(f.sheets.size, 17);
  assert.equal(f.run('secureInstaller.canAccess(request)'), false);
  for (const name of [
    'CORE_EMPRESAS',
    'CORE_USUARIOS',
    'CORE_ROLES',
    'CORE_MODULOS',
    'CORE_USUARIO_ROL',
    'CORE_ROL_MODULO',
    'CORE_PERMISOS'
  ]) {
    assert.ok(f.sheets.get(name).getLastRow() > 1, name);
  }
  const incompletePermissions = sheetRecords(f.sheets.get('CORE_PERMISOS'));
  assert.equal(incompletePermissions.length, 8);
  assert.equal(
    incompletePermissions.filter(permission => permission.Nivel_Acceso === 'ALLOW').length,
    1
  );
  assert.equal(
    incompletePermissions.find(permission => permission.ID_Modulo === 'ADMINISTRACION')
      .Puede_Administrar,
    true
  );
  assert.equal(
    incompletePermissions
      .filter(permission => permission.ID_Modulo !== 'ADMINISTRACION')
      .every(
        permission => permission.Nivel_Acceso === 'DENY' && permission.Puede_Administrar === false
      ),
    true
  );
  assert.equal(
    sheetRecords(f.sheets.get('CORE_ROL_MODULO'))
      .filter(module => module.ID_Modulo !== 'ADMINISTRACION')
      .every(module => module.Visible_Menu === false),
    true
  );
  f.context.bootstrapUserId = sheetRecords(f.sheets.get('CORE_USUARIOS'))[0].ID_Usuario;
  f.run(`
    var bootstrapTrustedVerifier = function () {
      return { ok: true, verified: true, principal: {
        issuer: 'https://accounts.google.com', subjectId: 'principal-1', userId: bootstrapUserId
      }};
    };
  `);
  assert.equal(
    f.run(`
      aerpAuthorizeFromMetadata({
        authentication: { token: 'trusted' },
        companyId: 'tenant-A', moduleId: 'CLIENTES', action: 'VIEW',
        context: { companyId: 'tenant-A' }
      }, { trustedPrincipalVerifier: bootstrapTrustedVerifier }).decision
    `),
    'DENY'
  );
  const attested = f.run('secureInstaller.recordAppSheetCoreAttestation(appSheetCoreAttestation)');
  assert.equal(attested.ok, true);
  assert.equal(attested.mode, 'APPSHEET_CORE_MANUAL_ATTESTATION');
  assert.equal(f.run('secureInstaller.getAppSheetCoreReadiness().ok'), true);
  assert.equal(
    f.properties.get('AERP041:v1:appsheet-core-attestation').includes('admin@example.test'),
    false
  );
  const complete = f.run('secureInstaller.apply(request)');
  assert.equal(complete.ok, true);
  assert.equal(complete.state, 'COMPLETE');
  assert.equal(f.run('secureInstaller.canAccess(request)'), true);
  assert.match(f.properties.get('AERP041:v1:bootstrap:claim'), /CONSUMED/);
  assert.equal(
    sheetRecords(f.sheets.get('CORE_PERMISOS')).every(
      permission => permission.Nivel_Acceso === 'ALLOW' && permission.Puede_Administrar === true
    ),
    true
  );
  assert.equal(
    sheetRecords(f.sheets.get('CORE_ROL_MODULO')).every(module => module.Visible_Menu === true),
    true
  );
  assert.equal(
    f.run(`
      aerpAuthorizeFromMetadata({
        authentication: { token: 'trusted' },
        companyId: 'tenant-A', moduleId: 'CLIENTES', action: 'VIEW',
        context: { companyId: 'tenant-A' }
      }, { trustedPrincipalVerifier: bootstrapTrustedVerifier }).decision
    `),
    'ALLOW'
  );
});

test('permission promotion failures stay incomplete and retry without duplicate grants', () => {
  for (const [failureMode, inject] of [
    ['permission-write', control => (control.failSheetWrite = 'CORE_PERMISOS')],
    ['flush', control => (control.failFlush = true)],
    ['readback', control => (control.corruptReadbackSheet = 'CORE_ROL_MODULO')]
  ]) {
    const f = fixture();
    prepareBootstrapCompletion(f);
    inject(f.control);
    const failed = f.run('secureInstaller.apply(request)');
    assert.equal(failed.ok, false);
    assert.equal(failed.state, 'INCOMPLETE');
    assert.equal(failed.code, 'ACCESS_PROMOTION_INCOMPLETE', failureMode);
    assert.equal(failed.persistence, 'UNKNOWN');
    assert.match(f.properties.get('AERP041:v1:state'), /INCOMPLETE|COMPLETE/);
    assert.match(f.properties.get('AERP041:v1:bootstrap:claim'), /CONSUMED/);
    assert.equal(f.run('secureInstaller.canAccess(request)'), false);
    assert.equal(bootstrapAuthorizationDecision(f), 'DENY');

    f.control.failSheetWrite = null;
    f.control.failFlush = false;
    f.control.corruptReadbackSheet = null;
    const retried = f.run('secureInstaller.apply(request)');
    assert.equal(retried.ok, true);
    assert.equal(retried.state, 'COMPLETE');
    assert.equal(sheetRecords(f.sheets.get('CORE_PERMISOS')).length, 8);
    assert.equal(sheetRecords(f.sheets.get('CORE_ROL_MODULO')).length, 8);
    assert.match(f.properties.get('AERP041:v1:bootstrap:claim'), /CONSUMED/);
  }
});

test('a failed COMPLETE state write cannot expose promoted permissions and is retryable', () => {
  const f = fixture();
  prepareBootstrapCompletion(f);
  f.control.failCompleteState = true;
  const failed = f.run('secureInstaller.apply(request)');
  assert.equal(failed.ok, false);
  assert.equal(failed.state, 'INCOMPLETE');
  assert.equal(failed.code, 'ACCESS_PROMOTION_INCOMPLETE');
  assert.equal(failed.persistence, 'UNKNOWN');
  assert.match(f.properties.get('AERP041:v1:state'), /INCOMPLETE/);
  assert.equal(f.run('secureInstaller.canAccess(request)'), false);
  assert.equal(
    sheetRecords(f.sheets.get('CORE_PERMISOS')).filter(row => row.Nivel_Acceso === 'ALLOW').length,
    1
  );
  assert.equal(
    sheetRecords(f.sheets.get('CORE_PERMISOS'))
      .filter(row => row.ID_Modulo !== 'ADMINISTRACION')
      .every(row => row.Nivel_Acceso === 'DENY'),
    true
  );
  assert.equal(bootstrapAuthorizationDecision(f), 'DENY');

  f.control.failCompleteState = false;
  const retried = f.run('secureInstaller.apply(request)');
  assert.equal(retried.ok, true);
  assert.equal(retried.state, 'COMPLETE');
  assert.match(f.properties.get('AERP041:v1:bootstrap:claim'), /CONSUMED/);
});

test('bootstrap consumption failure remains fail-closed and renews the same installation', () => {
  const f = fixture();
  prepareBootstrapCompletion(f);
  f.control.failKey = 'bootstrap:claim';
  const failed = f.run('secureInstaller.apply(request)');
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'ACCESS_PROMOTION_INCOMPLETE');
  assert.equal(failed.persistence, 'UNKNOWN');
  assert.match(f.properties.get('AERP041:v1:state'), /INCOMPLETE/);
  assert.match(f.properties.get('AERP041:v1:bootstrap:claim'), /CLAIMED/);
  assert.equal(f.run('secureInstaller.canAccess(request)'), false);
  assert.equal(bootstrapAuthorizationDecision(f), 'DENY');

  f.control.failKey = null;
  f.run("request.confirmation = secureInstaller.renewConfirmation({ intent: 'APPLY' })");
  const retried = f.run('secureInstaller.apply(request)');
  assert.equal(retried.ok, true);
  assert.equal(retried.state, 'COMPLETE');
  assert.match(f.properties.get('AERP041:v1:bootstrap:claim'), /CONSUMED/);
});

test('a consumed bootstrap resumes the same promotion without exposing early access', () => {
  const f = fixture();
  prepareBootstrapCompletion(f);
  f.properties.set(
    'AERP041:v1:state',
    JSON.stringify({
      sourceId: 'source-1',
      boundTargetId: 'target-1',
      tenantId: 'tenant-A',
      status: 'COMPLETE'
    })
  );
  const claimKey = 'AERP041:v1:bootstrap:claim';
  const claim = JSON.parse(f.properties.get(claimKey));
  const confirmationKey = `AERP041:v1:bootstrap:confirmation:${claim.confirmationId}`;
  const confirmation = JSON.parse(f.properties.get(confirmationKey));

  assert.equal(f.run('secureInstaller.canAccess(request)'), false);
  assert.equal(bootstrapAuthorizationDecision(f), 'DENY');
  f.properties.set(claimKey, JSON.stringify({ ...claim, status: 'CONSUMED' }));
  f.properties.set(confirmationKey, JSON.stringify({ ...confirmation, status: 'CONSUMED' }));

  assert.equal(f.run('secureInstaller.canAccess(request)'), false);
  assert.equal(bootstrapAuthorizationDecision(f), 'DENY');
  f.setOidcPayload({ sub: 'different-principal' });
  assert.equal(f.run('secureInstaller.apply(request)').ok, false);
  assert.equal(bootstrapAuthorizationDecision(f), 'DENY');
  f.setOidcPayload({ sub: 'principal-1' });
  const recovered = f.run('secureInstaller.apply(request)');
  assert.equal(recovered.ok, true);
  assert.equal(recovered.state, 'COMPLETE');
  assert.equal(f.run('secureInstaller.canAccess(request)'), true);
  assert.equal(bootstrapAuthorizationDecision(f), 'ALLOW');
});

test('a bootstrap-backed COMPLETE state rejects missing lifecycle metadata', () => {
  const f = fixture();
  prepareBootstrapCompletion(f);
  const complete = f.run('secureInstaller.apply(request)');
  assert.equal(complete.ok, true);
  const claim = JSON.parse(f.properties.get('AERP041:v1:bootstrap:claim'));
  f.properties.delete('AERP041:v1:bootstrap:provisioned');
  f.properties.delete('AERP041:v1:bootstrap:claim');
  f.properties.delete(`AERP041:v1:bootstrap:confirmation:${claim.confirmationId}`);

  assert.equal(f.run('secureInstaller.canAccess(request)'), false);
  const verification = f.run('secureInstaller.verify(request)');
  assert.equal(verification.ok, false);
  assert.equal(verification.state, 'INCOMPLETE');
});

test('legacy COMPLETE state with claimed partial access is recovered explicitly', () => {
  const f = fixture();
  prepareBootstrapCompletion(f);
  f.properties.set(
    'AERP041:v1:state',
    JSON.stringify({
      sourceId: 'source-1',
      boundTargetId: 'target-1',
      tenantId: 'tenant-A',
      status: 'COMPLETE'
    })
  );
  const plan = f.run('secureInstaller.plan(request)');
  assert.equal(plan.ok, true);
  assert.equal(plan.state, 'PARTIAL');
  assert.equal(f.run('secureInstaller.canAccess(request)'), false);

  f.run("request.confirmation = secureInstaller.renewConfirmation({ intent: 'APPLY' })");
  const recovered = f.run('secureInstaller.apply(request)');
  assert.equal(recovered.ok, true);
  assert.equal(recovered.state, 'COMPLETE');
  assert.equal(f.run('secureInstaller.canAccess(request)'), true);
});

test('duplicate, altered and foreign access rows fail closed without silent repair', () => {
  for (const mutate of [
    f => {
      const sheet = f.sheets.get('CORE_PERMISOS');
      const first = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
      f.control.locked = true;
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, first.length).setValues([first]);
      f.control.locked = false;
    },
    f => {
      const sheet = f.sheets.get('CORE_ROL_MODULO');
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const row = sheet.getRange(2, 1, 1, headers.length).getValues()[0];
      row[headers.indexOf('Visible_Menu')] = 'ALTERED';
      f.control.locked = true;
      sheet.getRange(2, 1, 1, row.length).setValues([row]);
      f.control.locked = false;
    },
    f => {
      const sheet = f.sheets.get('CORE_PERMISOS');
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const row = sheet.getRange(2, 1, 1, headers.length).getValues()[0];
      row[headers.indexOf('ID_Empresa')] = 'tenant-B';
      f.control.locked = true;
      sheet.getRange(2, 1, 1, row.length).setValues([row]);
      f.control.locked = false;
    }
  ]) {
    const f = fixture();
    prepareBootstrapCompletion(f);
    mutate(f);
    const permissionsBefore = JSON.stringify(sheetRecords(f.sheets.get('CORE_PERMISOS')));
    const roleModulesBefore = JSON.stringify(sheetRecords(f.sheets.get('CORE_ROL_MODULO')));
    const rejected = f.run('secureInstaller.apply(request)');
    assert.equal(rejected.ok, false);
    assert.equal(rejected.state, 'INCOMPLETE');
    assert.equal(f.run('secureInstaller.canAccess(request)'), false);
    assert.equal(JSON.stringify(sheetRecords(f.sheets.get('CORE_PERMISOS'))), permissionsBefore);
    assert.equal(JSON.stringify(sheetRecords(f.sheets.get('CORE_ROL_MODULO'))), roleModulesBefore);
    assert.match(f.properties.get('AERP041:v1:bootstrap:claim'), /CLAIMED/);
  }
});

test('operational controller completes the real secure runtime from clean preflight', () => {
  const f = fixture();
  f.run(`
    var clockMs = 2000000;
    var operational = aerpCreateOperationalInstallerController({
      readConfiguration() {
        return {
          sourceId: 'source-1', tenantId: 'tenant-A',
          expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
          company: {
            code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid'
          }
        };
      },
      getTargetId: () => 'target-1',
      createSecureInstaller(configuration) {
        return aerpCreateSecureAppsScriptInstaller(Object.assign({}, configuration, {
          now: () => clockMs
        }));
      },
      readAppSheetAttestation: () => appSheetCoreAttestation,
      confirmPlan: () => true,
      confirmCompletion: () => true
    });
  `);
  const before = f.control.writes;
  const preview = f.run('operational.preview()');
  assert.equal(preview.ok, true);
  assert.equal(preview.state, 'CLEAN');
  assert.equal(f.control.writes, before);

  const incomplete = f.run('operational.start()');
  assert.equal(incomplete.ok, false);
  assert.equal(incomplete.state, 'INCOMPLETE');
  assert.equal(f.sheets.size, 17);

  const complete = f.run('operational.complete()');
  assert.equal(complete.ok, true);
  assert.equal(complete.state, 'COMPLETE');

  const status = f.run('operational.status()');
  assert.equal(status.ok, true);
  assert.equal(status.state, 'COMPLETE');
  assert.equal(status.appSheetReady, true);
  assert.equal(status.verified, true);
});

test('operational preflight rejects wrong identity and cross-tenant requests without mutation', () => {
  const wrongIdentity = fixture();
  wrongIdentity.setOidcPayload({ email: 'other@example.test' });
  wrongIdentity.run(`
    var secureInstaller = aerpCreateSecureAppsScriptInstaller({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
    request.identity = { provider: 'GOOGLE_OIDC' };
  `);
  const deniedIdentity = wrongIdentity.run('secureInstaller.plan(request)');
  assert.equal(deniedIdentity.ok, false);
  assert.equal(deniedIdentity.state, 'INCOMPLETE');
  assert.equal(wrongIdentity.control.writes, 0);

  const crossTenant = fixture();
  crossTenant.run(`
    var secureInstaller = aerpCreateSecureAppsScriptInstaller({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
    request.identity = { provider: 'GOOGLE_OIDC' };
    request.tenantId = 'tenant-B';
  `);
  const deniedTenant = crossTenant.run('secureInstaller.plan(request)');
  assert.equal(deniedTenant.ok, false);
  assert.equal(deniedTenant.state, 'INCOMPLETE');
  assert.equal(crossTenant.control.writes, 0);
});

test('AppSheet Core attestation requires the exact manual acceptance checklist', () => {
  const f = fixture();
  f.run(`
    var secureInstaller = aerpCreateSecureAppsScriptInstaller({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
    request.identity = { provider: 'GOOGLE_OIDC' };
    request.confirmation = secureInstaller.issueConfirmation({ intent: 'APPLY' });
  `);
  assert.equal(f.run('secureInstaller.apply(request).state'), 'INCOMPLETE');
  f.run('appSheetCoreAttestation.checks.crossTenantDenyTestPassed = false');
  const rejected = f.run('secureInstaller.recordAppSheetCoreAttestation(appSheetCoreAttestation)');
  assert.equal(rejected.ok, false);
  assert.deepEqual(Array.from(rejected.errors), ['APPSHEET_CORE_ATTESTATION_REJECTED']);
  assert.equal(f.properties.has('AERP041:v1:appsheet-core-attestation'), false);
  assert.equal(f.run('secureInstaller.canAccess(request)'), false);
});

test('AppSheet Core attestation requires one verified evidence row for every blueprint table', () => {
  for (const mutation of [
    'appSheetCoreAttestation.tableChecks.pop()',
    "appSheetCoreAttestation.tableChecks[1].physicalName = 'CORE_EMPRESAS'",
    'appSheetCoreAttestation.tableChecks[2].securityFilterVerified = false',
    "appSheetCoreAttestation.tableChecks[3].evidenceDigest = 'invalid'"
  ]) {
    const f = fixture();
    f.run(`
      var secureInstaller = aerpCreateSecureAppsScriptInstaller({
        sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
        expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
        now: () => 2000000,
        company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
      });
      request.identity = { provider: 'GOOGLE_OIDC' };
      request.confirmation = secureInstaller.issueConfirmation({ intent: 'APPLY' });
    `);
    assert.equal(f.run('secureInstaller.apply(request).state'), 'INCOMPLETE');
    f.run(mutation);
    assert.equal(
      f.run('secureInstaller.recordAppSheetCoreAttestation(appSheetCoreAttestation).ok'),
      false
    );
    assert.equal(f.properties.has('AERP041:v1:appsheet-core-attestation'), false);
  }
});

test('AppSheet Core attestation is one-time, idempotent and bound to one app', () => {
  const f = fixture();
  f.run(`
    var secureInstaller = aerpCreateSecureAppsScriptInstaller({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
    request.identity = { provider: 'GOOGLE_OIDC' };
    request.confirmation = secureInstaller.issueConfirmation({ intent: 'APPLY' });
  `);
  assert.equal(f.run('secureInstaller.apply(request).state'), 'INCOMPLETE');
  const first = f.run('secureInstaller.recordAppSheetCoreAttestation(appSheetCoreAttestation)');
  const writes = f.control.writes;
  const repeated = f.run('secureInstaller.recordAppSheetCoreAttestation(appSheetCoreAttestation)');
  assert.equal(first.ok, true);
  assert.equal(repeated.ok, true);
  assert.equal(repeated.attestedAt, first.attestedAt);
  assert.equal(f.control.writes, writes);
  f.run("appSheetCoreAttestation.appId = 'different-app'");
  assert.equal(
    f.run('secureInstaller.recordAppSheetCoreAttestation(appSheetCoreAttestation).ok'),
    false
  );
});

test('ambiguous AppSheet Core attestation persistence is reported without granting access', () => {
  const f = fixture();
  f.run(`
    var secureInstaller = aerpCreateSecureAppsScriptInstaller({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
    request.identity = { provider: 'GOOGLE_OIDC' };
    request.confirmation = secureInstaller.issueConfirmation({ intent: 'APPLY' });
  `);
  assert.equal(f.run('secureInstaller.apply(request).state'), 'INCOMPLETE');
  f.control.ambiguousKey = 'appsheet-core-attestation';
  const result = f.run('secureInstaller.recordAppSheetCoreAttestation(appSheetCoreAttestation)');
  assert.equal(result.ok, false);
  assert.equal(result.persistence, 'UNKNOWN');
  assert.equal(f.run('secureInstaller.canAccess(request)'), false);
});

test('AppSheet Core attestation rejects a principal without explicit metadata administration', () => {
  const f = fixture();
  f.run(`
    var secureInstaller = aerpCreateSecureAppsScriptInstaller({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
    request.identity = { provider: 'GOOGLE_OIDC' };
    request.confirmation = secureInstaller.issueConfirmation({ intent: 'APPLY' });
  `);
  assert.equal(f.run('secureInstaller.apply(request).state'), 'INCOMPLETE');
  f.setOidcPayload({ sub: 'principal-without-role' });
  assert.equal(
    f.run('secureInstaller.recordAppSheetCoreAttestation(appSheetCoreAttestation).ok'),
    false
  );
  assert.equal(f.properties.has('AERP041:v1:appsheet-core-attestation'), false);
});

test('tampered AppSheet Core evidence never completes the installation', () => {
  const f = fixture();
  f.run(`
    var secureInstaller = aerpCreateSecureAppsScriptInstaller({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
    request.identity = { provider: 'GOOGLE_OIDC' };
    request.confirmation = secureInstaller.issueConfirmation({ intent: 'APPLY' });
  `);
  assert.equal(f.run('secureInstaller.apply(request).state'), 'INCOMPLETE');
  assert.equal(
    f.run('secureInstaller.recordAppSheetCoreAttestation(appSheetCoreAttestation).ok'),
    true
  );
  const key = 'AERP041:v1:appsheet-core-attestation';
  const tampered = JSON.parse(f.properties.get(key));
  tampered.planDigest = '0'.repeat(64);
  f.properties.set(key, JSON.stringify(tampered));
  const readiness = f.run('secureInstaller.getAppSheetCoreReadiness()');
  assert.equal(readiness.ok, false);
  assert.deepEqual(Array.from(readiness.errors), ['APPSHEET_CORE_READINESS_REQUIRED']);
  const result = f.run('secureInstaller.apply(request)');
  assert.equal(result.ok, false);
  assert.equal(result.state, 'INCOMPLETE');
  assert.equal(f.run('secureInstaller.canAccess(request)'), false);
});

test('every persisted AppSheet attestation field is covered by tamper evidence', () => {
  const mutations = [
    record => (record.appId = 'other-app'),
    record => (record.appVersion += 1),
    record => (record.templateVersion = '9.9.9'),
    record => (record.deploymentCheckReference = 'OTHER_CHECK'),
    record => (record.evidenceDigest = 'b'.repeat(64)),
    record => (record.attestedAt = '2030-01-01T00:00:00.000Z'),
    record => (record.tableChecks[0].evidenceReference = 'OTHER_TABLE_CHECK'),
    record => (record.tableChecks[0].evidenceDigest = 'c'.repeat(64))
  ];
  for (const mutate of mutations) {
    const f = fixture();
    f.run(`
      var secureInstaller = aerpCreateSecureAppsScriptInstaller({
        sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
        expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
        now: () => 2000000,
        company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
      });
      request.identity = { provider: 'GOOGLE_OIDC' };
      request.confirmation = secureInstaller.issueConfirmation({ intent: 'APPLY' });
    `);
    assert.equal(f.run('secureInstaller.apply(request).state'), 'INCOMPLETE');
    assert.equal(
      f.run('secureInstaller.recordAppSheetCoreAttestation(appSheetCoreAttestation).ok'),
      true
    );
    const key = 'AERP041:v1:appsheet-core-attestation';
    const record = JSON.parse(f.properties.get(key));
    mutate(record);
    f.properties.set(key, JSON.stringify(record));
    assert.equal(f.run('secureInstaller.getAppSheetCoreReadiness().ok'), false);
    assert.equal(f.run('secureInstaller.apply(request).state'), 'INCOMPLETE');
    assert.equal(f.run('secureInstaller.canAccess(request)'), false);
  }
});

test('bootstrap is restricted to the preapproved administrator email', () => {
  const f = fixture();
  f.run(`
    var bootstrap = aerpCreateAppsScriptSecureBootstrap({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'approved@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
  `);
  assert.throws(() => f.run("bootstrap.issueConfirmation({ intent: 'APPLY' })"));
  assert.equal(f.properties.size, 0);
  assert.equal(f.sheets.size, 0);
});

test('bootstrap rejects formula-capable identity and company text before any write', () => {
  const identity = fixture();
  identity.setOidcPayload({ name: '=IMPORTXML("https://example.test","//x")' });
  identity.run(`
    var bootstrap = aerpCreateAppsScriptSecureBootstrap({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
  `);
  assert.throws(() => identity.run("bootstrap.issueConfirmation({ intent: 'APPLY' })"));
  assert.equal(identity.control.writes, 0);
  assert.equal(identity.properties.size, 0);
  assert.equal(identity.sheets.size, 0);

  const company = fixture();
  company.run(`
    var bootstrap = aerpCreateAppsScriptSecureBootstrap({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: '+SUM(1,1)', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
  `);
  assert.throws(() => company.run("bootstrap.issueConfirmation({ intent: 'APPLY' })"));
  assert.equal(company.control.writes, 0);
  assert.equal(company.properties.size, 0);
  assert.equal(company.sheets.size, 0);
});

test('OIDC bootstrap rejects invalid issuer, subject, lifetime and verified-email claims', () => {
  for (const payload of [
    { iss: 'https://issuer.example.test' },
    { sub: 'invalid subject' },
    { exp: 1999 },
    { iat: 2061 },
    { email_verified: false }
  ]) {
    const f = fixture();
    f.setOidcPayload(payload);
    f.run(`
      var bootstrap = aerpCreateAppsScriptSecureBootstrap({
        sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
        expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
        now: () => 2000000,
        company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
      });
    `);
    assert.throws(() => f.run("bootstrap.issueConfirmation({ intent: 'APPLY' })"));
    assert.equal(f.properties.size, 0);
    assert.equal(f.sheets.size, 0);
  }
});

test('OIDC bootstrap rejects invalid configuration and reports ambiguous claim persistence', () => {
  const f = fixture();
  f.setOidcPayload({ aud: 'unexpected-client-id' });
  f.run(`
    var bootstrap = aerpCreateAppsScriptSecureBootstrap({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
  `);
  assert.throws(() => f.run("bootstrap.issueConfirmation({ intent: 'APPLY' })"));
  f.setOidcPayload({});
  f.run(`
    var invalidTtlBootstrap = aerpCreateAppsScriptSecureBootstrap({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      confirmationTtlSeconds: 901,
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
  `);
  assert.throws(() => f.run("invalidTtlBootstrap.issueConfirmation({ intent: 'APPLY' })"));
  assert.equal(f.properties.size, 0);
  assert.equal(f.sheets.size, 0);

  const ambiguous = fixture();
  ambiguous.run(`
    var secureInstaller = aerpCreateSecureAppsScriptInstaller({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
    request.identity = { provider: 'GOOGLE_OIDC' };
    request.confirmation = secureInstaller.issueConfirmation({ intent: 'APPLY' });
  `);
  ambiguous.control.ambiguousKey = 'bootstrap:claim';
  const unknown = ambiguous.run('secureInstaller.apply(request)');
  assert.equal(unknown.ok, false);
  assert.equal(unknown.state, 'INCOMPLETE');
  assert.equal(unknown.persistence, 'UNKNOWN');
});

test('one-time bootstrap denies a non-empty isolated-copy target before creating tables', () => {
  const f = fixture();
  f.sheet('UNRELATED', [['occupied']]);
  f.run(`
    var secureInstaller = aerpCreateSecureAppsScriptInstaller({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
    request.identity = { provider: 'GOOGLE_OIDC' };
    request.confirmation = secureInstaller.issueConfirmation({ intent: 'APPLY' });
  `);
  const result = f.run('secureInstaller.apply(request)');
  assert.equal(result.ok, false);
  assert.equal(result.state, 'INCOMPLETE');
  assert.deepEqual([...f.sheets.keys()], ['UNRELATED']);
  assert.equal(
    [...f.properties.keys()].some(key => key.includes('bootstrap:provisioned')),
    false
  );
});

test('bootstrap resume rejects data added to an installer-owned commercial table', () => {
  const f = fixture();
  f.run(`
    var secureInstaller = aerpCreateSecureAppsScriptInstaller({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
    request.identity = { provider: 'GOOGLE_OIDC' };
    request.confirmation = secureInstaller.issueConfirmation({ intent: 'APPLY' });
  `);
  assert.equal(f.run('secureInstaller.apply(request)').state, 'INCOMPLETE');
  const clients = f.sheets.get('ERP_CLIENTES');
  f.control.locked = true;
  clients
    .getRange(2, 1, 1, clients.getLastColumn())
    .setValues([Array(clients.getLastColumn()).fill('unexpected')]);
  f.control.locked = false;
  assert.equal(
    f.run('secureInstaller.recordAppSheetCoreAttestation(appSheetCoreAttestation).ok'),
    true
  );
  const rejected = f.run('secureInstaller.apply(request)');
  assert.equal(rejected.ok, false);
  assert.equal(rejected.state, 'INCOMPLETE');
  assert.equal(f.run('secureInstaller.canAccess(request)'), false);
  assert.match(f.properties.get('AERP041:v1:bootstrap:claim'), /CLAIMED/);
});

test('expired bootstrap evidence can be renewed by the same principal after manual AppSheet work', () => {
  const f = fixture();
  f.run(`
    var clockMs = 2000000;
    var secureInstaller = aerpCreateSecureAppsScriptInstaller({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      confirmationTtlSeconds: 60,
      now: () => clockMs,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
    request.identity = { provider: 'GOOGLE_OIDC' };
    request.confirmation = secureInstaller.issueConfirmation({ intent: 'APPLY' });
  `);
  assert.equal(f.run('secureInstaller.apply(request).state'), 'INCOMPLETE');
  f.run('clockMs = 2061000');
  assert.equal(
    f.run('secureInstaller.recordAppSheetCoreAttestation(appSheetCoreAttestation).ok'),
    true
  );
  f.run("request.confirmation = secureInstaller.renewConfirmation({ intent: 'APPLY' })");
  const complete = f.run('secureInstaller.apply(request)');
  assert.equal(complete.ok, true);
  assert.equal(complete.state, 'COMPLETE');
  assert.match(f.properties.get('AERP041:v1:bootstrap:claim'), /CONSUMED/);
});

test('renewal rebinds the claim so superseded confirmation evidence is denied', () => {
  const f = fixture();
  f.run(`
    var secureInstaller = aerpCreateSecureAppsScriptInstaller({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
    request.identity = { provider: 'GOOGLE_OIDC' };
    request.confirmation = secureInstaller.issueConfirmation({ intent: 'APPLY' });
  `);
  assert.equal(f.run('secureInstaller.apply(request).state'), 'INCOMPLETE');
  f.run(`
    var supersededConfirmation = request.confirmation;
    var renewedConfirmation = secureInstaller.renewConfirmation({ intent: 'APPLY' });
    request.confirmation = supersededConfirmation;
  `);
  assert.equal(f.run('secureInstaller.apply(request).ok'), false);
  f.run('request.confirmation = renewedConfirmation');
  assert.equal(f.run('secureInstaller.apply(request).state'), 'INCOMPLETE');
});

test('renewal rejects a different OIDC subject without changing the active claim', () => {
  const f = fixture();
  f.run(`
    var secureInstaller = aerpCreateSecureAppsScriptInstaller({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
    request.identity = { provider: 'GOOGLE_OIDC' };
    request.confirmation = secureInstaller.issueConfirmation({ intent: 'APPLY' });
  `);
  assert.equal(f.run('secureInstaller.apply(request).state'), 'INCOMPLETE');
  const claim = f.properties.get('AERP041:v1:bootstrap:claim');
  f.setOidcPayload({ sub: 'different-principal', email: 'other@example.test' });
  assert.throws(() => f.run("secureInstaller.renewConfirmation({ intent: 'APPLY' })"));
  assert.equal(f.properties.get('AERP041:v1:bootstrap:claim'), claim);
});

test('renewal requires an incomplete claimed bootstrap and recovers committed claim responses', () => {
  const fresh = fixture();
  fresh.run(`
    var secureInstaller = aerpCreateSecureAppsScriptInstaller({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
  `);
  assert.throws(() => fresh.run("secureInstaller.renewConfirmation({ intent: 'APPLY' })"));
  assert.equal(fresh.properties.size, 0);

  const ambiguous = fixture();
  ambiguous.run(`
    var secureInstaller = aerpCreateSecureAppsScriptInstaller({
      sourceId: 'source-1', targetId: 'target-1', tenantId: 'tenant-A',
      expectedAudience: 'apps-script-client-id', expectedAdminEmail: 'admin@example.test',
      now: () => 2000000,
      company: { code: 'TENANT_A', name: 'Empresa inicial', currency: 'USD', timeZone: 'Europe/Madrid' }
    });
    request.identity = { provider: 'GOOGLE_OIDC' };
    request.confirmation = secureInstaller.issueConfirmation({ intent: 'APPLY' });
  `);
  assert.equal(ambiguous.run('secureInstaller.apply(request).state'), 'INCOMPLETE');
  ambiguous.control.ambiguousKey = 'bootstrap:claim';
  const renewed = ambiguous.run("secureInstaller.renewConfirmation({ intent: 'APPLY' })");
  assert.match(renewed.confirmationId, /^[A-Za-z0-9_-]+$/);
  assert.equal(typeof renewed.nonce, 'string');
});
test('durable install uses real authorization, preserves 17 tables and survives a new runtime', () => {
  const f = fixture();
  f.seedAuthorization();
  f.create();
  const result = f.run('runtime.apply(request)');
  assert.equal(result.ok, true);
  assert.equal(result.state, 'COMPLETE');
  assert.equal(f.sheets.size, 17);
  assert.equal(f.run('runtime.canAccess(request)'), true);
  const writes = f.control.writes;
  f.create();
  assert.equal(f.run('runtime.apply(request).created'), 0);
  assert.equal(f.control.writes, writes);
  assert.ok([...f.properties.keys()].some(key => key.includes('journal:')));
});

test('empty metadata and explicit DENY cannot authorize installation', () => {
  for (const deny of [false, true]) {
    const f = fixture();
    if (deny) f.seedAuthorization(true);
    f.create();
    assert.equal(f.run('runtime.apply(request).ok'), false);
    assert.equal(f.control.writes, 0);
    assert.equal(f.run('runtime.canAccess(request)'), false);
  }
});

test('invalid requests, cross tenant, unverified identity and confirmation fail before writes', () => {
  for (const change of [
    'request.targetId = request.sourceId',
    "request.tenantId = 'tenant-B'",
    "request.identity = { verified: true, email: 'claimed' }",
    "request.confirmation.token = 'invalid'",
    'delete request.confirmation',
    'request = null',
    "request.sourceId = 'wrong-source'"
  ]) {
    const f = fixture();
    f.seedAuthorization();
    f.create();
    f.run(change);
    assert.equal(f.run('runtime.apply(request).ok'), false, change);
    assert.equal(f.control.writes, 0, change);
  }
});

test('exclusive lock contention fails without writes', () => {
  const f = fixture();
  f.seedAuthorization();
  f.create();
  f.control.busy = true;
  assert.equal(f.run('runtime.apply(request).ok'), false);
  assert.equal(f.control.writes, 0);
  assert.equal(f.control.locked, false);
});

test('unconfirmed persistence returns UNKNOWN, denies access and supports retry', () => {
  const f = fixture();
  f.seedAuthorization();
  f.create();
  f.control.failStorage = true;
  const result = f.run('runtime.apply(request)');
  assert.equal(result.ok, false);
  assert.equal(result.persistence, 'UNKNOWN');
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.equal(f.run('runtime.canAccess(request)'), false);
  assert.equal(f.control.locked, false);
  f.control.failStorage = false;
  f.create();
  assert.equal(f.run('runtime.apply(request).ok'), true);
});

test('recovery quarantines durably, preserves sheets and resumes without duplication', () => {
  const f = fixture();
  f.seedAuthorization();
  f.create();
  assert.equal(f.run('runtime.apply(request).ok'), true);
  assert.equal(f.run('runtime.rollback(request).state'), 'INCOMPLETE');
  assert.equal(f.sheets.size, 17);
  f.create();
  assert.equal(f.run('runtime.canAccess(request)'), false);
  assert.equal(f.run('runtime.apply(request).created'), 0);
});

test('incompatible headers are not overwritten and application validation is mandatory', () => {
  const f = fixture();
  f.seedAuthorization();
  f.sheet('ERP_CLIENTES', [['legacy']]);
  f.create();
  assert.equal(f.run('runtime.apply(request).ok'), false);
  assert.equal(f.control.writes, 0);
  const g = fixture();
  g.seedAuthorization();
  g.run('delete configuration.validateApplication');
  g.create();
  assert.equal(g.run('runtime.apply(request).ok'), false);
  assert.equal(g.run('runtime.canAccess(request)'), false);
});

test('owned empty sheet resumes after a failed header write in a fresh execution', () => {
  const f = fixture();
  f.seedAuthorization();
  f.create();
  f.control.failHeaders = true;
  assert.equal(f.run('runtime.apply(request).persistence'), 'UNKNOWN');
  f.control.failHeaders = false;
  f.create();
  assert.equal(f.run('runtime.apply(request).ok'), true);
  assert.equal(f.sheets.size, 17);
});

test('an unowned blank table is incompatible and cannot be adopted', () => {
  const f = fixture();
  f.seedAuthorization();
  f.sheet('ERP_CLIENTES');
  f.create();
  assert.equal(f.run('runtime.apply(request).ok'), false);
  assert.equal(f.control.writes, 0);
});

test('journal and chunk write failures remain UNKNOWN even after quarantine succeeds', () => {
  for (const key of ['journal:', 'resource:metadata:blueprint:1']) {
    const f = fixture();
    f.seedAuthorization();
    f.create();
    f.control.failKey = key;
    const result = f.run('runtime.apply(request)');
    assert.equal(result.ok, false);
    assert.equal(result.persistence, 'UNKNOWN');
    assert.equal(f.run('runtime.canAccess(request)'), false);
    f.control.failKey = null;
    f.create();
    assert.equal(f.run('runtime.apply(request).ok'), true);
    assert.equal(f.sheets.size, 17);
  }
});

test('lost write response preserves journal and resumes committed resources', () => {
  const f = fixture();
  f.seedAuthorization();
  f.create();
  f.control.ambiguousKey = 'resource:metadata:blueprint:head';
  assert.equal(f.run('runtime.apply(request).persistence'), 'UNKNOWN');
  const before = [...f.properties].filter(([key]) => /journal:\d+$/.test(key));
  f.control.ambiguousKey = null;
  f.create();
  assert.equal(f.run('runtime.apply(request).ok'), true);
  before.forEach(([key, value]) => assert.equal(f.properties.get(key), value));
});

test('unreadable or corrupted storage denies access without exposing details', () => {
  const f = fixture();
  f.seedAuthorization();
  f.create();
  assert.equal(f.run('runtime.apply(request).ok'), true);
  f.control.failRead = true;
  assert.equal(f.run('runtime.canAccess(request)'), false);
  assert.equal(f.run('runtime.apply(request).persistence'), 'UNKNOWN');
  f.control.failRead = false;
  f.properties.set('AERP041:v1:state', '{broken');
  f.create();
  assert.equal(f.run('runtime.canAccess(request)'), false);
  assert.equal(f.run('runtime.apply(request).ok'), false);
});

test('confirmation binds digest, intent, subject, source, tenant and destination', () => {
  for (const field of ['planDigest', 'intent', 'subjectId', 'sourceId', 'tenantId', 'targetId']) {
    const f = fixture();
    f.seedAuthorization();
    f.run(`configuration.verifyConfirmation = input => ({ ...input, confirmed: true,
      confirmationId: 'confirmation-1', ${field}: 'wrong' });`);
    f.create();
    assert.equal(f.run('runtime.apply(request).ok'), false, field);
    assert.equal(f.control.writes, 0, field);
  }
});

test('copied durable state cannot be rebound to a different tenant or destination', () => {
  const f = fixture();
  f.seedAuthorization();
  f.create();
  assert.equal(f.run('runtime.apply(request).ok'), true);
  const state = JSON.parse(f.properties.get('AERP041:v1:state'));
  state.boundTargetId = 'another-target';
  f.properties.set('AERP041:v1:state', JSON.stringify(state));
  f.create();
  assert.equal(f.run('runtime.canAccess(request)'), false);
  assert.equal(f.run('runtime.apply(request).ok'), false);
});

test('missing identity verifier cannot be replaced by Session or caller flags', () => {
  const f = fixture();
  f.seedAuthorization();
  f.run(
    "delete configuration.trustedPrincipalVerifier; var Session = { getActiveUser() { throw Error('must not run'); } };"
  );
  f.create();
  assert.equal(f.run('runtime.apply(request).ok'), false);
  assert.equal(f.control.writes, 0);
});
