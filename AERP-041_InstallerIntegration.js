/**
 * AERP-041 integration coordinator. It binds the approved commercial plan to
 * the pure installer engine without owning storage, authentication or UI.
 */
function aerpCreateIsolatedInstallerIntegration(dependencies) {
  const failures = new WeakMap();
  const requiredDependencies = [
    'buildCommercialPlan',
    'createEngine',
    'validateBlueprint',
    'validatePresentation',
    'validateSecurity',
    'verifyIdentity',
    'authorize',
    'verifyConfirmation',
    'readSnapshot',
    'createAdapter'
  ];

  function fail(code) {
    const error = new Error(code);
    failures.set(error, code);
    throw error;
  }

  function copy(value, ancestors = new Set(), depth = 0) {
    if (depth > 40) fail('INTEGRATION_INVALID_REQUEST');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object' || ancestors.has(value)) {
      fail('INTEGRATION_INVALID_REQUEST');
    }
    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
      fail('INTEGRATION_INVALID_REQUEST');
    }
    ancestors.add(value);
    const result = Array.isArray(value) ? [] : {};
    Object.keys(value).forEach(function (key) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        fail('INTEGRATION_INVALID_REQUEST');
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        fail('INTEGRATION_INVALID_REQUEST');
      }
      result[key] = copy(descriptor.value, ancestors, depth + 1);
    });
    ancestors.delete(value);
    return result;
  }

  function freeze(value) {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }

  function opaque(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  }

  function denied(code) {
    return freeze({
      ok: false,
      state: 'INCOMPLETE',
      code: code,
      persistence: 'UNCHANGED',
      journal: []
    });
  }

  const dependenciesAvailable = Boolean(
    dependencies &&
    typeof dependencies === 'object' &&
    requiredDependencies.every(function (name) {
      return typeof dependencies[name] === 'function';
    })
  );

  let engine = null;
  if (dependenciesAvailable) {
    try {
      engine = dependencies.createEngine({
        validateBlueprint: dependencies.validateBlueprint,
        validatePresentation: dependencies.validatePresentation,
        validateSecurity: dependencies.validateSecurity,
        verifyIdentity: dependencies.verifyIdentity,
        authorize: dependencies.authorize
      });
      if (
        !engine ||
        ['analyze', 'plan', 'verify', 'apply', 'rollback', 'canAccess'].some(function (name) {
          return typeof engine[name] !== 'function';
        })
      ) {
        engine = null;
      }
    } catch (_error) {
      engine = null;
    }
  }

  function execute(work) {
    try {
      if (!dependenciesAvailable || !engine) {
        return denied('INTEGRATION_DEPENDENCY_UNAVAILABLE');
      }
      return work();
    } catch (error) {
      return denied(failures.get(error) || 'INTEGRATION_INTERNAL_ERROR');
    }
  }

  function prepare(rawRequest) {
    const source = copy(rawRequest);
    if (
      !source ||
      typeof source !== 'object' ||
      Array.isArray(source) ||
      !opaque(source.sourceId) ||
      !opaque(source.targetId) ||
      !opaque(source.tenantId) ||
      source.sourceId === source.targetId ||
      !source.identity
    ) {
      fail('INTEGRATION_INVALID_REQUEST');
    }
    const rawCommercialPlan = dependencies.buildCommercialPlan();
    if (!rawCommercialPlan || typeof rawCommercialPlan !== 'object') {
      fail('INTEGRATION_PLAN_INVALID');
    }
    const commercialPlan = copy(rawCommercialPlan);
    if (commercialPlan.ok !== true) fail('INTEGRATION_PLAN_INVALID');
    const rawIdentity = dependencies.verifyIdentity(freeze(copy(source.identity)));
    const identity = rawIdentity ? copy(rawIdentity) : null;
    if (
      !identity ||
      identity.verified !== true ||
      !opaque(identity.subjectId) ||
      identity.tenantId !== source.tenantId
    ) {
      fail('INTEGRATION_IDENTITY_REQUIRED');
    }
    return {
      raw: source,
      identity: identity,
      engineRequest: freeze({
        sourceId: source.sourceId,
        targetId: source.targetId,
        tenantId: source.tenantId,
        identity: copy(source.identity),
        commercialPlan: commercialPlan
      })
    };
  }

  function requireConfirmation(prepared, intent) {
    if (!prepared.raw.confirmation) fail('INTEGRATION_CONFIRMATION_REQUIRED');
    const plan = prepared.engineRequest.commercialPlan;
    const rawAttestation = dependencies.verifyConfirmation(
      freeze({
        evidence: copy(prepared.raw.confirmation),
        identity: copy(prepared.raw.identity),
        intent: intent,
        sourceId: prepared.engineRequest.sourceId,
        targetId: prepared.engineRequest.targetId,
        tenantId: prepared.engineRequest.tenantId,
        subjectId: prepared.identity.subjectId,
        contractVersion: plan.contractVersion,
        blueprintVersion: plan.blueprintVersion,
        presentationVersion: plan.presentationVersion
      })
    );
    const attestation = rawAttestation ? copy(rawAttestation) : null;
    if (
      !attestation ||
      attestation.confirmed !== true ||
      attestation.intent !== intent ||
      !opaque(attestation.confirmationId) ||
      attestation.sourceId !== prepared.engineRequest.sourceId ||
      attestation.targetId !== prepared.engineRequest.targetId ||
      attestation.tenantId !== prepared.engineRequest.tenantId ||
      attestation.subjectId !== prepared.identity.subjectId ||
      attestation.contractVersion !== plan.contractVersion ||
      attestation.blueprintVersion !== plan.blueprintVersion ||
      attestation.presentationVersion !== plan.presentationVersion
    ) {
      fail('INTEGRATION_CONFIRMATION_MISMATCH');
    }
    return freeze(attestation);
  }

  function snapshot(prepared) {
    return dependencies.readSnapshot(prepared.engineRequest.targetId);
  }

  function analyze(rawRequest) {
    return execute(function () {
      const prepared = prepare(rawRequest);
      return engine.analyze(prepared.engineRequest, snapshot(prepared));
    });
  }

  function plan(rawRequest) {
    return execute(function () {
      const prepared = prepare(rawRequest);
      return engine.plan(prepared.engineRequest, snapshot(prepared));
    });
  }

  function verify(rawRequest) {
    return execute(function () {
      const prepared = prepare(rawRequest);
      return engine.verify(prepared.engineRequest, snapshot(prepared));
    });
  }

  function mutate(rawRequest, intent) {
    return execute(function () {
      const prepared = prepare(rawRequest);
      const confirmation = requireConfirmation(prepared, intent);
      const adapter = dependencies.createAdapter(
        freeze({
          sourceId: prepared.engineRequest.sourceId,
          targetId: prepared.engineRequest.targetId,
          tenantId: prepared.engineRequest.tenantId,
          subjectId: prepared.identity.subjectId,
          confirmationId: confirmation.confirmationId,
          intent: intent
        })
      );
      return intent === 'APPLY'
        ? engine.apply(prepared.engineRequest, adapter)
        : engine.rollback(prepared.engineRequest, adapter);
    });
  }

  function canAccess(rawRequest) {
    try {
      if (!dependenciesAvailable || !engine) return false;
      const prepared = prepare(rawRequest);
      const currentSnapshot = snapshot(prepared);
      const verification = engine.verify(prepared.engineRequest, currentSnapshot);
      if (
        !verification ||
        verification.ok !== true ||
        verification.state !== 'COMPLETE' ||
        verification.verified !== true
      ) {
        return false;
      }
      return engine.canAccess({
        identity: copy(prepared.raw.identity),
        tenantId: prepared.engineRequest.tenantId,
        resourceTenantId: prepared.raw.resourceTenantId,
        resource: prepared.raw.resource,
        action: prepared.raw.action
      });
    } catch (_error) {
      return false;
    }
  }

  return Object.freeze({
    analyze: analyze,
    plan: plan,
    verify: verify,
    apply: function (request) {
      return mutate(request, 'APPLY');
    },
    rollback: function (request) {
      return mutate(request, 'RECOVER');
    },
    canAccess: canAccess
  });
}

if (typeof globalThis !== 'undefined') {
  globalThis.aerpCreateIsolatedInstallerIntegration = aerpCreateIsolatedInstallerIntegration;
}
