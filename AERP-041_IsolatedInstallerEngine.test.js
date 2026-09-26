/* global __dirname, require */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

require('./AERP-040_CommercialBlueprint');
require('./AERP-040_CommercialPresentationManifest');
require('./AERP-041_IsolatedInstallerEngine');

const clone = value => JSON.parse(JSON.stringify(value));
const commercialPlan = clone(
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '11_Installer.js'), 'utf8') +
      '\naerpBuildCommercialInstallerPlan();',
    {
      aerpBuildCommercialBlueprint: globalThis.aerpBuildCommercialBlueprint,
      aerpValidateCommercialBlueprint: globalThis.aerpValidateCommercialBlueprint,
      aerpBuildCommercialPresentationManifestFromBlueprint:
        globalThis.aerpBuildCommercialPresentationManifestFromBlueprint,
      aerpValidateCommercialPresentationManifest:
        globalThis.aerpValidateCommercialPresentationManifest
    }
  )
);

function fixture(options = {}) {
  const request = {
    sourceId: 'source-1',
    targetId: 'copy-1',
    tenantId: 'tenant-A',
    commercialPlan: clone(commercialPlan),
    identity: { session: 'fixture-session' }
  };
  const dependencies = {
    validateBlueprint: globalThis.aerpValidateCommercialBlueprint,
    validatePresentation: globalThis.aerpValidateCommercialPresentationManifest,
    // In-memory attestation double. The integration must inject real security
    // validation against AERP-036/AERP-037 for this exact snapshot and principal.
    validateSecurity: () => ({ ok: true, errors: [] }),
    // Only the fixture's session registry establishes identity, never an email
    // or a caller-supplied verified flag. Production needs a trusted resolver.
    verifyIdentity: candidate =>
      candidate && candidate.session === 'fixture-session'
        ? { verified: true, subjectId: 'principal-1', tenantId: 'tenant-A' }
        : null,
    authorize: () => ({ decision: 'DENY', explicitDeny: false }),
    ...options.dependencies
  };
  const engine = globalThis.aerpCreateIsolatedInstallerEngine(dependencies);
  const store = {
    sourceId: 'source-1',
    boundTargetId: 'copy-1',
    tenantId: 'tenant-A',
    status: 'EMPTY',
    resources: [],
    security: {
      defaultDecision: 'DENY',
      denyPrecedence: true,
      visibilityGrantsAuthorization: false,
      tenantIsolation: true,
      authorizationValidated: true,
      adminAccessValidated: true,
      metadataValidated: true,
      applicationValidated: true
    }
  };
  const journal = [];
  const calls = [];
  let locked = false;
  const adapter = {
    withExclusiveTarget(target, work) {
      assert.equal(target, store.boundTargetId);
      assert.equal(locked, false);
      locked = true;
      try {
        return work();
      } finally {
        locked = false;
      }
    },
    readSnapshot(target) {
      assert.equal(target, store.boundTargetId);
      return clone(store);
    },
    setState(target, state) {
      assert.equal(locked, true);
      assert.equal(target, store.boundTargetId);
      calls.push(['state', state]);
      store.status = state;
      return true;
    },
    appendJournal(target, entry) {
      assert.equal(locked, true);
      assert.equal(target, store.boundTargetId);
      journal.push(clone(entry));
      return true;
    },
    createIfAbsent(target, operation) {
      assert.equal(locked, true);
      assert.equal(target, store.boundTargetId);
      assert.equal(store.status, 'INCOMPLETE');
      calls.push(['create', operation.id]);
      const previous = store.resources.find(item => item.key === operation.resource.key);
      if (previous) {
        assert.deepEqual(previous, operation.resource);
        return 'EXISTS';
      }
      store.resources.push(clone(operation.resource));
      return 'CREATED';
    }
  };
  return { request, engine, store, adapter, journal, calls, dependencies };
}

test('clean install consumes the real validated AERP-040 plan and verifies before COMPLETE', () => {
  const f = fixture();
  assert.equal(commercialPlan.ok, true);
  assert.equal(f.engine.analyze(f.request, f.store).state, 'CLEAN');
  const planned = f.engine.plan(f.request, f.store);
  assert.equal(planned.operations.length, 21);
  assert.equal(planned.operations.filter(op => op.resource.kind === 'TABLE').length, 17);
  const result = f.engine.apply(f.request, f.adapter);
  assert.equal(result.ok, true);
  assert.equal(result.created, 21);
  assert.equal(f.store.status, 'COMPLETE');
  assert.equal(f.engine.verify(f.request, f.store).verified, true);
  assert.equal(f.engine.analyze(f.request, f.store).state, 'COMPLETE');
  assert.deepEqual(f.calls.at(-1), ['state', 'COMPLETE']);
  assert.deepEqual(f.journal.at(-1), { phase: 'VERIFY', event: 'VALIDATED' });
});

test('idempotent retry produces no operations, writes, or duplicated resources', () => {
  const f = fixture();
  f.engine.apply(f.request, f.adapter);
  const before = clone({ store: f.store, calls: f.calls, journal: f.journal });
  assert.equal(f.engine.plan(f.request, f.store).operations.length, 0);
  assert.equal(f.engine.apply(f.request, f.adapter).created, 0);
  assert.deepEqual({ store: f.store, calls: f.calls, journal: f.journal }, before);
});

test('source equal to target fails before adapter writes', () => {
  const f = fixture();
  f.request.targetId = f.request.sourceId;
  assert.equal(f.engine.apply(f.request, f.adapter).code, 'TARGET_NOT_ISOLATED');
  assert.equal(f.calls.length, 0);
});

test('target different from actual binding and incorrect provenance fail closed', () => {
  const f = fixture();
  const wrong = clone(f.store);
  wrong.boundTargetId = 'another-copy';
  assert.equal(f.engine.analyze(f.request, wrong).code, 'TARGET_NOT_ISOLATED');
  f.adapter.readSnapshot = () => wrong;
  assert.equal(f.engine.apply(f.request, f.adapter).code, 'TARGET_NOT_ISOLATED');
  wrong.boundTargetId = f.request.targetId;
  wrong.sourceId = 'another-source';
  assert.equal(f.engine.apply(f.request, f.adapter).code, 'TARGET_NOT_ISOLATED');
  assert.equal(f.calls.length, 0);
});

test('blueprint is independently revalidated even when plan.ok is true', () => {
  const f = fixture();
  f.request.commercialPlan.blueprint.tables.pop();
  assert.equal(f.engine.apply(f.request, f.adapter).code, 'BLUEPRINT_INVALID');
  assert.equal(f.calls.length, 0);
});

test('plan version, failed validation, and presentation security cannot be bypassed', () => {
  for (const mutate of [
    plan => {
      plan.contractVersion = '9';
    },
    plan => {
      plan.ok = false;
    },
    plan => {
      plan.security.visibilityGrantsAuthorization = true;
    },
    plan => {
      plan.presentationManifest.separation.denyPrecedence = false;
    }
  ]) {
    const f = fixture();
    mutate(f.request.commercialPlan);
    assert.equal(f.engine.apply(f.request, f.adapter).ok, false);
    assert.equal(f.calls.length, 0);
  }
});

test('incompatible headers are never overwritten', () => {
  const f = fixture();
  const resource = clone(f.engine.plan(f.request, f.store).operations[0].resource);
  resource.payload.headers.reverse();
  f.store.resources.push(resource);
  const before = clone(f.store);
  assert.equal(f.engine.analyze(f.request, f.store).state, 'INCOMPATIBLE');
  assert.equal(f.engine.apply(f.request, f.adapter).code, 'SCHEMA_INCOMPATIBLE');
  assert.deepEqual(f.store, before);
  assert.equal(f.calls.length, 0);
});

test('compatible partial install creates only absent resources and preserves unrelated data', () => {
  const f = fixture();
  f.store.resources.push(clone(f.engine.plan(f.request, f.store).operations[0].resource));
  f.store.resources.push({ key: 'customer:existing', kind: 'CUSTOM', payload: { keep: true } });
  const before = clone(f.store.resources);
  assert.equal(f.engine.analyze(f.request, f.store).state, 'PARTIAL');
  assert.equal(f.engine.apply(f.request, f.adapter).created, 20);
  assert.deepEqual(f.store.resources.slice(0, 2), before);
});

test('duplicate resource identities and duplicate blueprint columns fail closed', () => {
  const f = fixture();
  const resource = clone(f.engine.plan(f.request, f.store).operations[0].resource);
  f.store.resources.push(resource, clone(resource));
  assert.equal(f.engine.apply(f.request, f.adapter).code, 'DUPLICATE_RESOURCE');
  assert.equal(f.calls.length, 0);
  const g = fixture();
  const columns = g.request.commercialPlan.blueprint.tables[0].columns;
  columns.push(clone(columns[0]));
  assert.equal(g.engine.plan(g.request, g.store).ok, false);
});

test('ambiguous write failure is quarantined and retry discovers the committed resource', () => {
  const f = fixture();
  const create = f.adapter.createIfAbsent;
  let attempts = 0;
  f.adapter.createIfAbsent = (target, operation) => {
    const outcome = create(target, operation);
    attempts += 1;
    if (attempts === 3) throw new Error('private@example.org bearer SECRET');
    return outcome;
  };
  const result = f.engine.apply(f.request, f.adapter);
  assert.equal(result.state, 'INCOMPLETE');
  assert.equal(result.persistence, 'CONFIRMED');
  assert.equal(f.store.status, 'INCOMPLETE');
  assert.equal(f.store.resources.length, 3);
  f.adapter.createIfAbsent = create;
  assert.equal(f.engine.apply(f.request, f.adapter).created, 18);
  assert.equal(new Set(f.calls.filter(call => call[0] === 'create').map(call => call[1])).size, 21);
  assert.equal(f.calls.filter(call => call[0] === 'create').length, 21);
});

test('journal and errors contain only allowlisted phases, events and numeric ordinals', () => {
  const f = fixture();
  f.request.identity.email = 'private@example.org';
  f.request.identity.token = 'TOP_SECRET_TOKEN';
  f.adapter.createIfAbsent = () => {
    throw new Error('private@example.org TOP_SECRET_TOKEN');
  };
  const result = f.engine.apply(f.request, f.adapter);
  const serialized = JSON.stringify({ result, journal: f.journal });
  for (const forbidden of [
    'private@',
    'TOP_SECRET',
    'principal-1',
    'tenant-A',
    'copy-1',
    'stack'
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
  for (const entry of f.journal) {
    assert.ok(Object.keys(entry).every(key => ['phase', 'event', 'operation'].includes(key)));
    if ('operation' in entry) assert.equal(typeof entry.operation, 'number');
  }
});

test('rollback quarantines without deletion; resume revalidates and avoids duplicates', () => {
  const f = fixture();
  f.engine.apply(f.request, f.adapter);
  const resources = clone(f.store.resources);
  const result = f.engine.rollback(f.request, f.adapter);
  assert.equal(result.recovery, 'RESUME');
  assert.equal(f.store.status, 'INCOMPLETE');
  assert.deepEqual(f.store.resources, resources);
  assert.equal(f.engine.apply(f.request, f.adapter).created, 0);
  assert.equal(f.store.status, 'COMPLETE');
});

test('email and caller verified flags cannot create an administrator', () => {
  for (const identity of [null, {}, { email: 'admin@example.org', verified: true }]) {
    const f = fixture();
    f.request.identity = identity;
    assert.equal(f.engine.apply(f.request, f.adapter).code, 'ADMIN_IDENTITY_REQUIRED');
    assert.equal(f.calls.length, 0);
  }
});

test('trusted identity must belong to the installation tenant and have an opaque subject', () => {
  for (const identity of [
    { verified: true, subjectId: 'principal-1', tenantId: 'tenant-B' },
    { verified: true, subjectId: 'admin@example.org', tenantId: 'tenant-A' },
    { verified: false, subjectId: 'principal-1', tenantId: 'tenant-A' }
  ]) {
    const f = fixture({ dependencies: { verifyIdentity: () => identity } });
    assert.equal(f.engine.apply(f.request, f.adapter).code, 'ADMIN_IDENTITY_REQUIRED');
  }
});

function accessContext(f) {
  return {
    identity: f.request.identity,
    tenantId: 'tenant-A',
    resourceTenantId: 'tenant-A',
    resource: 'ERP_CLIENTES',
    action: 'READ'
  };
}

test('zero rules and permissions preserve Default DENY and cannot complete admin validation', () => {
  const f = fixture();
  assert.equal(f.engine.canAccess(accessContext(f)), false);
  f.store.security.adminAccessValidated = false;
  assert.equal(f.engine.apply(f.request, f.adapter).code, 'SECURITY_VALIDATION_REQUIRED');
  assert.equal(f.store.status, 'INCOMPLETE');
  assert.equal(
    f.store.resources.some(resource => resource.kind === 'PERMISSION'),
    false
  );
});

test('external explicit ALLOW is required and DENY takes precedence', () => {
  for (const [verdict, expected] of [
    [null, false],
    [{}, false],
    [{ decision: 'ALLOW' }, false],
    [{ decision: 'ALLOW', explicitDeny: false }, true],
    [{ decision: 'ALLOW', explicitDeny: true }, false],
    [{ decision: 'DENY', explicitDeny: false }, false]
  ]) {
    const f = fixture({ dependencies: { authorize: () => verdict } });
    assert.equal(f.engine.canAccess(accessContext(f)), expected);
  }
});

test('tenant A never accesses B, including a caller changing both tenant context fields', () => {
  let calls = 0;
  const f = fixture({
    dependencies: {
      authorize: () => {
        calls += 1;
        return { decision: 'ALLOW', explicitDeny: false };
      }
    }
  });
  const context = accessContext(f);
  context.resourceTenantId = 'tenant-B';
  assert.equal(f.engine.canAccess(context), false);
  context.tenantId = 'tenant-B';
  assert.equal(f.engine.canAccess(context), false);
  assert.equal(calls, 0);
  f.store.tenantId = 'tenant-B';
  assert.equal(f.engine.apply(f.request, f.adapter).code, 'TENANT_MISMATCH');
});

test('visibility and admin role labels never grant authorization', () => {
  const f = fixture();
  const context = { ...accessContext(f), visible: true, Visible_Menu: true, role: 'ADMINISTRADOR' };
  assert.equal(f.engine.canAccess(context), false);
});

test('every structural and security check is mandatory for COMPLETE', () => {
  for (const key of Object.keys(fixture().store.security)) {
    const f = fixture();
    f.store.security[key] = key === 'defaultDecision' ? 'ALLOW' : !f.store.security[key];
    assert.equal(f.engine.apply(f.request, f.adapter).code, 'SECURITY_VALIDATION_REQUIRED');
    assert.equal(f.store.status, 'INCOMPLETE');
    assert.equal(f.engine.verify(f.request, f.store).ok, false);
  }
  const f = fixture();
  f.adapter.createIfAbsent = () => 'CREATED';
  assert.equal(f.engine.apply(f.request, f.adapter).code, 'STRUCTURE_INCOMPLETE');
  assert.equal(f.store.status, 'INCOMPLETE');
});

test('journal failure, verification read failure and completion failure quarantine the target', () => {
  for (const phase of ['journal', 'verify', 'complete']) {
    const f = fixture();
    if (phase === 'journal')
      f.adapter.appendJournal = () => {
        throw new Error('SECRET');
      };
    if (phase === 'verify') {
      let reads = 0;
      const read = f.adapter.readSnapshot;
      f.adapter.readSnapshot = target => {
        if (++reads === 2) throw new Error('SECRET');
        return read(target);
      };
    }
    if (phase === 'complete') {
      const set = f.adapter.setState;
      f.adapter.setState = (target, state) => {
        set(target, state);
        if (state === 'COMPLETE') throw new Error('SECRET');
        return true;
      };
    }
    const result = f.engine.apply(f.request, f.adapter);
    assert.equal(result.ok, false);
    assert.equal(result.persistence, 'CONFIRMED');
    assert.equal(f.store.status, 'INCOMPLETE');
    assert.equal(JSON.stringify(result).includes('SECRET'), false);
  }
});

test('unavailable state storage is reported honestly without creating resources', () => {
  const f = fixture();
  f.adapter.setState = () => {
    throw new Error('SECRET');
  };
  const result = f.engine.apply(f.request, f.adapter);
  assert.equal(result.state, 'INCOMPLETE');
  assert.equal(result.persistence, 'UNKNOWN');
  assert.equal(f.store.resources.length, 0);
});

test('hostile getters, proxies, cycles and toJSON cannot escape or disclose exceptions', () => {
  const f = fixture();
  const getter = Object.defineProperty({}, 'commercialPlan', {
    enumerable: true,
    get() {
      throw new Error('SECRET');
    }
  });
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        throw new Error('SECRET');
      }
    }
  );
  const cycle = {};
  cycle.self = cycle;
  const custom = {
    toJSON() {
      throw new Error('SECRET');
    }
  };
  for (const hostile of [getter, proxy, cycle, custom, null]) {
    for (const result of [
      f.engine.analyze(hostile, f.store),
      f.engine.plan(hostile, f.store),
      f.engine.verify(hostile, f.store),
      f.engine.apply(hostile, f.adapter),
      f.engine.rollback(hostile, f.adapter)
    ]) {
      assert.equal(result.ok, false);
      assert.equal(JSON.stringify(result).includes('SECRET'), false);
    }
    assert.equal(f.engine.canAccess(hostile), false);
  }
  assert.equal(f.calls.length, 0);
});

test('hostile snapshot and injected dependencies fail closed with fixed error codes', () => {
  const f = fixture();
  const proxy = new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error('SECRET');
      }
    }
  );
  assert.equal(f.engine.analyze(f.request, proxy).code, 'ENGINE_FAILURE');
  const g = fixture({
    dependencies: {
      validateBlueprint() {
        throw new Error('SECRET');
      }
    }
  });
  assert.equal(g.engine.apply(g.request, g.adapter).code, 'ENGINE_FAILURE');
  const h = fixture({
    dependencies: {
      authorize() {
        throw new Error('SECRET');
      }
    }
  });
  assert.equal(h.engine.canAccess(accessContext(h)), false);
});

test('plans are deterministic, deeply immutable and independent of subsequent input mutations', () => {
  const f = fixture();
  const first = f.engine.plan(f.request, f.store);
  assert.deepEqual(first, f.engine.plan(f.request, f.store));
  assert.equal(Object.isFrozen(first.operations[0].resource.payload.headers), true);
  const serialized = JSON.stringify(first);
  f.request.commercialPlan.blueprint.tables[0].columns[0].Nombre_Campo = 'Changed';
  f.store.resources.push({ key: 'new', kind: 'CUSTOM', payload: {} });
  assert.equal(JSON.stringify(first), serialized);
  assert.equal(Object.isFrozen(f.engine), true);
});

test('a forged COMPLETE marker never bypasses verification or repairs incompatible structure', () => {
  const f = fixture();
  f.store.status = 'COMPLETE';
  assert.equal(f.engine.analyze(f.request, f.store).state, 'PARTIAL');
  assert.equal(f.engine.verify(f.request, f.store).code, 'STRUCTURE_INCOMPLETE');
  assert.equal(f.engine.apply(f.request, f.adapter).created, 21);
  f.store.resources[0].payload.headers.push('Unexpected');
  assert.equal(f.engine.apply(f.request, f.adapter).code, 'SCHEMA_INCOMPATIBLE');
});

test('adapter is required and unused plan operations cannot be injected into apply', () => {
  const f = fixture();
  assert.equal(f.engine.apply(f.request, {}).code, 'ADAPTER_INVALID');
  f.request.operations = [{ type: 'DELETE_ALL' }];
  assert.equal(f.engine.apply(f.request, f.adapter).ok, true);
  assert.ok(
    f.calls.filter(call => call[0] === 'create').every(call => call[1].startsWith('AERP-041:1:'))
  );
});

test('async and deferred lock adapters cannot execute writes after the engine returns', () => {
  const f = fixture();
  f.adapter.withExclusiveTarget = async (_target, work) => work();
  assert.equal(f.engine.apply(f.request, f.adapter).code, 'ASYNC_ADAPTER_UNSUPPORTED');
  assert.equal(f.calls.length, 0);
  let delayed;
  f.adapter.withExclusiveTarget = (_target, work) => {
    delayed = work;
  };
  assert.equal(f.engine.apply(f.request, f.adapter).code, 'ADAPTER_INVALID');
  assert.equal(delayed().ok, false);
  assert.equal(f.calls.length, 0);
});

test('state and journal mutations require explicit durable acknowledgements', () => {
  const f = fixture();
  f.adapter.setState = () => false;
  const failed = f.engine.apply(f.request, f.adapter);
  assert.equal(failed.code, 'ADAPTER_INVALID');
  assert.equal(failed.persistence, 'UNKNOWN');
  assert.equal(f.store.resources.length, 0);
  const g = fixture();
  g.adapter.appendJournal = () => false;
  assert.equal(g.engine.apply(g.request, g.adapter).code, 'ADAPTER_INVALID');
  assert.equal(g.store.status, 'INCOMPLETE');
  assert.equal(g.store.resources.length, 0);
});

test('unknown or missing access actions and resources deny before the external engine', () => {
  const f = fixture({
    dependencies: { authorize: () => ({ decision: 'ALLOW', explicitDeny: false }) }
  });
  for (const action of [null, '', '*', 'ANY']) {
    assert.equal(f.engine.canAccess({ ...accessContext(f), action }), false);
  }
  const context = accessContext(f);
  delete context.resource;
  assert.equal(f.engine.canAccess(context), false);
});

test('security requires an independent validator, not just snapshot assertions', () => {
  for (const validator of [
    undefined,
    () => ({ ok: false, errors: ['PRIVATE'] }),
    () => ({ ok: true, errors: ['PRIVATE'] }),
    () => {
      throw new Error('PRIVATE');
    }
  ]) {
    const f = fixture({ dependencies: { validateSecurity: validator } });
    const result = f.engine.apply(f.request, f.adapter);
    assert.equal(result.ok, false);
    assert.equal(f.store.status, 'INCOMPLETE');
    assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  }
});

test('security validator receives an immutable snapshot and the exact principal/tenant/target', () => {
  let checks = 0;
  const f = fixture({
    dependencies: {
      validateSecurity: (snapshot, context) => {
        checks += 1;
        assert.deepEqual(context, {
          subjectId: 'principal-1',
          tenantId: 'tenant-A',
          targetId: 'copy-1'
        });
        assert.equal(Object.isFrozen(snapshot.resources[0].payload), true);
        assert.equal(Object.isFrozen(context), true);
        return { ok: true, errors: [] };
      }
    }
  });
  assert.equal(f.engine.apply(f.request, f.adapter).ok, true);
  assert.equal(checks, 1);
});
