/* global require */
const assert = require('node:assert/strict');
const test = require('node:test');

require('./AERP-040_CommercialBlueprint');
require('./AERP-040_CommercialPresentationManifest');
require('./AERP-041_IsolatedInstallerEngine');
require('./AERP-041_InstallerIntegration');
require('./11_Installer');

const clone = value => JSON.parse(JSON.stringify(value));

function fixture(options = {}) {
  const store = {
    sourceId: 'source-1',
    boundTargetId: 'target-1',
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
  const calls = [];
  const journal = [];
  let locked = false;
  const adapter = {
    withExclusiveTarget(targetId, work) {
      assert.equal(targetId, store.boundTargetId);
      assert.equal(locked, false);
      locked = true;
      try {
        return work();
      } finally {
        locked = false;
      }
    },
    readSnapshot(targetId) {
      assert.equal(targetId, store.boundTargetId);
      return clone(store);
    },
    setState(targetId, state) {
      assert.equal(targetId, store.boundTargetId);
      assert.equal(locked, true);
      calls.push(['state', state]);
      store.status = state;
      return true;
    },
    appendJournal(targetId, entry) {
      assert.equal(targetId, store.boundTargetId);
      assert.equal(locked, true);
      journal.push(clone(entry));
      return true;
    },
    createIfAbsent(targetId, operation) {
      assert.equal(targetId, store.boundTargetId);
      assert.equal(locked, true);
      const existing = store.resources.find(item => item.key === operation.resource.key);
      if (existing) {
        assert.deepEqual(existing, operation.resource);
        return 'EXISTS';
      }
      store.resources.push(clone(operation.resource));
      calls.push(['create', operation.id]);
      return 'CREATED';
    }
  };
  const dependencies = {
    validateSecurity: () => ({ ok: true, errors: [] }),
    verifyIdentity: evidence =>
      evidence && evidence.session === 'trusted-session'
        ? { verified: true, subjectId: 'principal-1', tenantId: 'tenant-A' }
        : null,
    authorize: () => ({ decision: 'ALLOW', explicitDeny: false }),
    verifyConfirmation: input =>
      input.evidence && input.evidence.token === 'confirmed-token'
        ? {
            confirmed: true,
            confirmationId: 'confirmation-1',
            intent: input.intent,
            sourceId: input.sourceId,
            targetId: input.targetId,
            tenantId: input.tenantId,
            subjectId: input.subjectId,
            contractVersion: input.contractVersion,
            blueprintVersion: input.blueprintVersion,
            presentationVersion: input.presentationVersion
          }
        : null,
    readSnapshot: targetId => {
      assert.equal(targetId, store.boundTargetId);
      return clone(store);
    },
    createAdapter: context => {
      calls.push(['adapter', clone(context)]);
      return adapter;
    },
    ...options.dependencies
  };
  const coordinator = globalThis.aerpCreateCommercialInstallerCoordinator(dependencies);
  const request = {
    sourceId: 'source-1',
    targetId: 'target-1',
    tenantId: 'tenant-A',
    identity: { session: 'trusted-session' },
    confirmation: { token: 'confirmed-token' }
  };
  return { adapter, calls, coordinator, dependencies, journal, request, store };
}

test('commercial coordinator binds the approved plan and analyzes a clean target', () => {
  const f = fixture();
  const result = f.coordinator.analyze(f.request);
  assert.equal(result.ok, true);
  assert.equal(result.state, 'CLEAN');
  assert.equal(f.coordinator.plan(f.request).operations.length, 21);
  assert.equal(f.calls.length, 0);
});

test('missing production dependencies fail closed without throwing', () => {
  const coordinator = globalThis.aerpCreateCommercialInstallerCoordinator({});
  const result = coordinator.analyze({});
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INTEGRATION_DEPENDENCY_UNAVAILABLE');
});

test('apply requires explicit confirmation before creating an adapter', () => {
  const f = fixture();
  delete f.request.confirmation;
  const result = f.coordinator.apply(f.request);
  assert.equal(result.code, 'INTEGRATION_CONFIRMATION_REQUIRED');
  assert.deepEqual(f.calls, []);
  assert.equal(f.store.status, 'EMPTY');
});

test('untrusted identity fails before confirmation or adapter creation', () => {
  const f = fixture();
  f.request.identity = { session: 'caller-claim' };
  const result = f.coordinator.apply(f.request);
  assert.equal(result.code, 'INTEGRATION_IDENTITY_REQUIRED');
  assert.deepEqual(f.calls, []);

  const undefinedIdentity = fixture({
    dependencies: { verifyIdentity: () => undefined }
  });
  assert.equal(
    undefinedIdentity.coordinator.apply(undefinedIdentity.request).code,
    'INTEGRATION_IDENTITY_REQUIRED'
  );
});

test('confirmation must bind intent, target, tenant, principal and plan versions', () => {
  const f = fixture({
    dependencies: {
      verifyConfirmation: input => ({
        confirmed: true,
        confirmationId: 'confirmation-1',
        intent: input.intent,
        sourceId: input.sourceId,
        targetId: 'different-target',
        tenantId: input.tenantId,
        subjectId: input.subjectId,
        contractVersion: input.contractVersion,
        blueprintVersion: input.blueprintVersion,
        presentationVersion: input.presentationVersion
      })
    }
  });
  const result = f.coordinator.apply(f.request);
  assert.equal(result.code, 'INTEGRATION_CONFIRMATION_MISMATCH');
  assert.deepEqual(f.calls, []);

  const undefinedConfirmation = fixture({
    dependencies: { verifyConfirmation: () => undefined }
  });
  assert.equal(
    undefinedConfirmation.coordinator.apply(undefinedConfirmation.request).code,
    'INTEGRATION_CONFIRMATION_MISMATCH'
  );
});

test('confirmed apply completes all deterministic resources under the adapter lock', () => {
  const f = fixture();
  const result = f.coordinator.apply(f.request);
  assert.equal(result.ok, true);
  assert.equal(result.state, 'COMPLETE');
  assert.equal(result.created, 21);
  assert.equal(f.store.status, 'COMPLETE');
  assert.equal(f.store.resources.length, 21);
  assert.equal(f.calls.filter(call => call[0] === 'adapter').length, 1);
});

test('repeated confirmed apply is idempotent', () => {
  const f = fixture();
  assert.equal(f.coordinator.apply(f.request).created, 21);
  const repeated = f.coordinator.apply(f.request);
  assert.equal(repeated.ok, true);
  assert.equal(repeated.created, 0);
  assert.equal(f.store.resources.length, 21);
});

test('normal access remains denied while installation is incomplete', () => {
  const f = fixture();
  Object.assign(f.request, {
    resourceTenantId: 'tenant-A',
    resource: 'ERP_PEDIDOS',
    action: 'READ'
  });
  assert.equal(f.coordinator.canAccess(f.request), false);
});

test('normal access requires both COMPLETE verification and explicit authorization', () => {
  const f = fixture();
  assert.equal(f.coordinator.apply(f.request).ok, true);
  Object.assign(f.request, {
    resourceTenantId: 'tenant-A',
    resource: 'ERP_PEDIDOS',
    action: 'READ'
  });
  assert.equal(f.coordinator.canAccess(f.request), true);
});

test('explicit DENY takes precedence after a complete installation', () => {
  const f = fixture({
    dependencies: { authorize: () => ({ decision: 'DENY', explicitDeny: true }) }
  });
  assert.equal(f.coordinator.apply(f.request).ok, true);
  Object.assign(f.request, {
    resourceTenantId: 'tenant-A',
    resource: 'ERP_PEDIDOS',
    action: 'READ'
  });
  assert.equal(f.coordinator.canAccess(f.request), false);
});

test('verification cannot promote an incomplete snapshot', () => {
  const f = fixture();
  const result = f.coordinator.verify(f.request);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'STRUCTURE_INCOMPLETE');
  assert.equal(f.store.status, 'EMPTY');
});

test('recovery also requires bound confirmation and preserves created resources', () => {
  const f = fixture();
  assert.equal(f.coordinator.apply(f.request).ok, true);
  const resourceCount = f.store.resources.length;
  const recovered = f.coordinator.rollback(f.request);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.state, 'INCOMPLETE');
  assert.equal(recovered.recovery, 'RESUME');
  assert.equal(f.store.status, 'INCOMPLETE');
  assert.equal(f.store.resources.length, resourceCount);
});

test('adapter factory failures are sanitized and never imply persistence', () => {
  const f = fixture({
    dependencies: {
      createAdapter: () => {
        throw new Error('private adapter detail');
      }
    }
  });
  const result = f.coordinator.apply(f.request);
  assert.equal(result.code, 'INTEGRATION_INTERNAL_ERROR');
  assert.equal(result.persistence, 'UNCHANGED');
  assert.equal(JSON.stringify(result).includes('private adapter detail'), false);
});

test('hostile accessors and cross-tenant resources fail closed', () => {
  const f = fixture();
  const hostile = { ...f.request };
  Object.defineProperty(hostile, 'targetId', {
    enumerable: true,
    get() {
      throw new Error('must not execute');
    }
  });
  assert.equal(f.coordinator.analyze(hostile).code, 'INTEGRATION_INVALID_REQUEST');

  assert.equal(f.coordinator.apply(f.request).ok, true);
  Object.assign(f.request, {
    resourceTenantId: 'tenant-B',
    resource: 'ERP_PEDIDOS',
    action: 'READ'
  });
  assert.equal(f.coordinator.canAccess(f.request), false);
});
