/* global __dirname, require */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const test = require('node:test');
const crypto = require('node:crypto');

function fixture() {
  const properties = new Map();
  const sheets = new Map();
  const control = { locked: false, busy: false, failStorage: false, writes: 0 };
  let nextSheetId = 1;
  function sheet(name, rows = []) {
    const sheetId = nextSheetId++;
    const item = {
      getSheetId: () => sheetId,
      getName: () => name,
      getLastRow: () => rows.length,
      getLastColumn: () => rows[0]?.length || 0,
      getRange: (r, c, height, width) => ({
        getValues: () =>
          Array.from({ length: height }, (_, i) =>
            Array.from({ length: width }, (_, j) => rows[r - 1 + i]?.[c - 1 + j] ?? '')
          ),
        setValues(values) {
          assert.equal(control.locked, true);
          if (control.failHeaders) throw Error('header write failure');
          control.writes++;
          values.forEach((row, i) => {
            rows[r - 1 + i] = [...row];
          });
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
  context.Utilities = {
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    computeDigest: (algorithm, value, charset) => [
      ...crypto.createHash(algorithm).update(value, charset).digest()
    ]
  };
  context.SpreadsheetApp = { getActiveSpreadsheet: () => spreadsheet, flush() {} };
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
    'AERP-041_AppsScriptRuntimeAdapter.js'
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
  return { run, create, seedAuthorization, properties, sheets, control, sheet, context };
}

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
