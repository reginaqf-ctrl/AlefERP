/**
 * AERP-041C. Pure planning and verification; effects only through a synchronous,
 * exclusive, injected adapter. No runtime authorization or deployment integration.
 */
function aerpCreateIsolatedInstallerEngine(dependencies) {
  const failures = new WeakMap();
  const policy = Object.freeze({
    defaultDecision: 'DENY',
    denyPrecedence: true,
    visibilityGrantsAuthorization: false,
    tenantIsolation: true
  });

  function fail(code) {
    const error = new Error(code);
    failures.set(error, code);
    throw error;
  }

  // Copy data without invoking accessors or toJSON. Never retain caller objects.
  function copy(value, ancestors = new Set(), depth = 0) {
    if (depth > 40) fail('INVALID_INPUT');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object' || ancestors.has(value)) fail('INVALID_INPUT');
    const proto = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && proto !== Object.prototype && proto !== null)
      fail('INVALID_INPUT');
    ancestors.add(value);
    const result = Array.isArray(value) ? [] : {};
    for (const key of Object.keys(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('INVALID_INPUT');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        fail('INVALID_INPUT');
      }
      result[key] = copy(descriptor.value, ancestors, depth + 1);
    }
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

  function equal(left, right) {
    function canonical(value) {
      if (Array.isArray(value)) return value.map(canonical);
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.keys(value)
            .sort()
            .map(key => [key, canonical(value[key])])
        );
      }
      return value;
    }
    return JSON.stringify(canonical(copy(left))) === JSON.stringify(canonical(copy(right)));
  }

  function opaque(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  }

  function validationPassed(value) {
    return value && value.ok === true && Array.isArray(value.errors) && value.errors.length === 0;
  }

  function securityContract(value) {
    return (
      value &&
      value.authorizationEngine === 'AERP-036' &&
      value.metadataRepository === 'AERP-037' &&
      value.authorizationDecision === 'EXTERNAL_REQUIRED' &&
      value.defaultVisibility === 'HIDDEN' &&
      value.visibilityGrantsAuthorization === false &&
      value.denyPrecedence === true
    );
  }

  function prepare(rawRequest) {
    const request = copy(rawRequest);
    if (
      !opaque(request.sourceId) ||
      !opaque(request.targetId) ||
      !opaque(request.tenantId) ||
      request.sourceId === request.targetId
    )
      fail('TARGET_NOT_ISOLATED');
    const commercial = request.commercialPlan;
    if (
      !commercial ||
      commercial.ok !== true ||
      commercial.contractVersion !== '1.0.0' ||
      commercial.blueprintVersion !== '1.0.0' ||
      commercial.presentationVersion !== '1.0.0' ||
      !Array.isArray(commercial.errors) ||
      commercial.errors.length !== 0 ||
      !securityContract(commercial.security) ||
      !securityContract(
        commercial.presentationManifest && commercial.presentationManifest.separation
      )
    )
      fail('PLAN_INVALID');
    if (
      !validationPassed(dependencies.validateBlueprint(freeze(copy(commercial.blueprint)))) ||
      !validationPassed(
        dependencies.validatePresentation(
          freeze(copy(commercial.presentationManifest)),
          freeze(copy(commercial.blueprint))
        )
      )
    )
      fail('BLUEPRINT_INVALID');

    if (!request.identity) fail('ADMIN_IDENTITY_REQUIRED');
    const identity = copy(dependencies.verifyIdentity(request.identity));
    if (
      !identity ||
      identity.verified !== true ||
      !opaque(identity.subjectId) ||
      identity.tenantId !== request.tenantId
    )
      fail('ADMIN_IDENTITY_REQUIRED');

    const resources = [];
    const names = new Set();
    for (const table of commercial.blueprint.tables) {
      const headers = table.columns.map(column => column.Nombre_Campo);
      if (
        !opaque(table.physicalName) ||
        names.has(table.physicalName) ||
        headers.length === 0 ||
        headers.some(header => !opaque(header)) ||
        new Set(headers).size !== headers.length
      )
        fail('BLUEPRINT_INVALID');
      names.add(table.physicalName);
      resources.push({ key: 'table:' + table.physicalName, kind: 'TABLE', payload: { headers } });
    }
    if (!resources.length) fail('BLUEPRINT_INVALID');
    resources.sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
    resources.push(
      { key: 'metadata:blueprint', kind: 'BLUEPRINT', payload: commercial.blueprint },
      {
        key: 'metadata:presentation',
        kind: 'PRESENTATION',
        payload: commercial.presentationManifest
      },
      { key: 'security:policy', kind: 'POLICY', payload: policy },
      {
        key: 'security:admin-binding',
        kind: 'ADMIN_BINDING',
        payload: {
          subjectId: identity.subjectId,
          tenantId: request.tenantId,
          grantsAuthorization: false
        }
      }
    );
    return { request: freeze(request), resources: freeze(copy(resources)) };
  }

  function inspect(prepared, rawSnapshot) {
    const snapshot = copy(rawSnapshot);
    const request = prepared.request;
    if (
      snapshot.boundTargetId !== request.targetId ||
      snapshot.sourceId !== request.sourceId ||
      snapshot.boundTargetId === snapshot.sourceId
    )
      fail('TARGET_NOT_ISOLATED');
    if (snapshot.tenantId !== request.tenantId) fail('TENANT_MISMATCH');
    if (
      !['EMPTY', 'INCOMPLETE', 'COMPLETE'].includes(snapshot.status) ||
      !Array.isArray(snapshot.resources)
    )
      fail('SNAPSHOT_INVALID');
    const existing = new Map();
    for (const resource of snapshot.resources) {
      if (typeof resource.key !== 'string' || existing.has(resource.key))
        fail('DUPLICATE_RESOURCE');
      existing.set(resource.key, resource);
    }
    const missing = [];
    for (const resource of prepared.resources) {
      if (!existing.has(resource.key)) missing.push(resource);
      else if (!equal(existing.get(resource.key), resource)) fail('SCHEMA_INCOMPATIBLE');
    }
    const secure =
      snapshot.security &&
      Object.entries(policy).every(([key, value]) => snapshot.security[key] === value) &&
      [
        'authorizationValidated',
        'adminAccessValidated',
        'metadataValidated',
        'applicationValidated'
      ].every(key => snapshot.security[key] === true);
    const verified =
      missing.length === 0 &&
      secure === true &&
      validationPassed(
        dependencies.validateSecurity(
          freeze(copy(snapshot)),
          freeze({
            targetId: request.targetId,
            tenantId: request.tenantId,
            subjectId: prepared.resources.find(resource => resource.kind === 'ADMIN_BINDING')
              .payload.subjectId
          })
        )
      );
    return {
      snapshot,
      missing,
      verified,
      state:
        verified && snapshot.status === 'COMPLETE'
          ? 'COMPLETE'
          : missing.length === prepared.resources.length && snapshot.status === 'EMPTY'
            ? 'CLEAN'
            : 'PARTIAL'
    };
  }

  function failure(error, journal = [], persistence = 'UNCHANGED') {
    return freeze({
      ok: false,
      state: 'INCOMPLETE',
      code: failures.get(error) || 'ENGINE_FAILURE',
      persistence,
      journal: copy(journal)
    });
  }

  function pure(work) {
    try {
      return freeze(work());
    } catch (error) {
      const result = failure(error);
      return ['SCHEMA_INCOMPATIBLE', 'DUPLICATE_RESOURCE'].includes(result.code)
        ? freeze({ ...result, state: 'INCOMPATIBLE' })
        : result;
    }
  }

  function analyze(request, snapshot) {
    return pure(() => {
      const checked = inspect(prepare(request), snapshot);
      return {
        ok: true,
        state: checked.state,
        missing: checked.missing.length,
        verified: checked.verified,
        journal: [{ phase: 'ANALYZE', event: 'VALIDATED' }]
      };
    });
  }

  function plan(request, snapshot) {
    return pure(() => {
      const checked = inspect(prepare(request), snapshot);
      return {
        ok: true,
        state: checked.state,
        operations: checked.missing.map(resource => ({
          id: 'AERP-041:1:' + resource.key,
          type: 'CREATE_IF_ABSENT',
          resource: copy(resource)
        })),
        journal: [{ phase: 'PLAN', event: 'VALIDATED' }]
      };
    });
  }

  function verify(request, snapshot) {
    return pure(() => {
      const checked = inspect(prepare(request), snapshot);
      if (checked.missing.length) fail('STRUCTURE_INCOMPLETE');
      if (!checked.verified) fail('SECURITY_VALIDATION_REQUIRED');
      return {
        ok: true,
        state: checked.state,
        verified: true,
        journal: [{ phase: 'VERIFY', event: 'VALIDATED' }]
      };
    });
  }

  // Recovery is deliberately non-destructive: quarantine and resume, never drop
  // customer tables. The adapter must lock, persist before returning, and scope
  // every operation to its bound target. It must not roll back the quarantine.
  function execute(request, adapter, recovery) {
    const journal = [];
    let persistence = 'UNCHANGED';
    let entered = false;
    let result;
    let currentPhase = 'ANALYZE';
    try {
      const prepared = prepare(request);
      const target = prepared.request.targetId;
      const required = [
        'withExclusiveTarget',
        'readSnapshot',
        'setState',
        'appendJournal',
        'createIfAbsent'
      ];
      if (!adapter || required.some(name => typeof adapter[name] !== 'function'))
        fail('ADAPTER_INVALID');
      if (
        required.some(
          name => Object.prototype.toString.call(adapter[name]) === '[object AsyncFunction]'
        )
      ) {
        fail('ASYNC_ADAPTER_UNSUPPORTED');
      }
      function synchronous(value) {
        if (value && typeof value.then === 'function') fail('ASYNC_ADAPTER_UNSUPPORTED');
        return value;
      }
      function acknowledged(value) {
        if (synchronous(value) !== true) fail('ADAPTER_INVALID');
      }
      function record(phase, event, operation) {
        currentPhase = phase;
        const entry = { phase, event };
        if (operation !== undefined) entry.operation = operation;
        journal.push(entry);
        acknowledged(adapter.appendJournal(target, freeze(copy(entry))));
      }
      let callbackOpen = true;
      try {
        synchronous(
          adapter.withExclusiveTarget(target, () => {
            if (!callbackOpen) return failure(null);
            if (entered) fail('ADAPTER_INVALID');
            entered = true;
            let mutationStarted = false;
            try {
              const checked = inspect(prepared, synchronous(adapter.readSnapshot(target)));
              if (!recovery && checked.state === 'COMPLETE') {
                result = freeze({
                  ok: true,
                  state: 'COMPLETE',
                  created: 0,
                  persistence: 'CONFIRMED',
                  journal: []
                });
                return result;
              }
              mutationStarted = true;
              persistence = 'UNKNOWN';
              acknowledged(adapter.setState(target, 'INCOMPLETE'));
              persistence = 'CONFIRMED';
              record('ANALYZE', 'VALIDATED');
              if (recovery) {
                record('RECOVERY', 'QUARANTINED');
                result = freeze({
                  ok: true,
                  state: 'INCOMPLETE',
                  recovery: 'RESUME',
                  persistence,
                  journal: copy(journal)
                });
                return result;
              }
              record('PLAN', 'VALIDATED');
              let created = 0;
              for (let index = 0; index < checked.missing.length; index += 1) {
                const resource = checked.missing[index];
                const ordinal = prepared.resources.findIndex(item => item.key === resource.key);
                record('APPLY', 'STARTED', ordinal);
                const outcome = synchronous(
                  adapter.createIfAbsent(
                    target,
                    freeze({
                      id: 'AERP-041:1:' + resource.key,
                      type: 'CREATE_IF_ABSENT',
                      resource: copy(resource)
                    })
                  )
                );
                if (outcome !== 'CREATED' && outcome !== 'EXISTS') fail('ADAPTER_INVALID');
                if (outcome === 'CREATED') created += 1;
                record('APPLY', 'SUCCEEDED', ordinal);
              }
              record('VERIFY', 'STARTED');
              const final = inspect(prepared, synchronous(adapter.readSnapshot(target)));
              if (final.missing.length) fail('STRUCTURE_INCOMPLETE');
              if (!final.verified) fail('SECURITY_VALIDATION_REQUIRED');
              record('VERIFY', 'VALIDATED');
              acknowledged(adapter.setState(target, 'COMPLETE'));
              result = freeze({
                ok: true,
                state: 'COMPLETE',
                created,
                persistence,
                journal: copy(journal)
              });
            } catch (error) {
              if (mutationStarted) {
                persistence = 'UNKNOWN';
                try {
                  acknowledged(adapter.setState(target, 'INCOMPLETE'));
                  persistence = 'CONFIRMED';
                } catch (_error) {
                  /* Never claim a durable state when storage failed. */
                }
                try {
                  record(currentPhase, 'FAILED');
                } catch (_error) {
                  /* Original failure is retained without adapter details. */
                }
              }
              result = failure(error, journal, persistence);
            }
            return result;
          })
        );
      } finally {
        callbackOpen = false;
      }
      if (!entered || !result) fail('ADAPTER_INVALID');
      return result;
    } catch (error) {
      return failure(error, journal, entered ? 'UNKNOWN' : persistence);
    }
  }

  // Defense-in-depth guard around the trusted AERP-036/AERP-037 bridge. Menu
  // visibility and administrator bindings are never consulted for authorization.
  function canAccess(rawContext) {
    try {
      const context = copy(rawContext);
      const identity = copy(dependencies.verifyIdentity(context.identity || null));
      if (
        !identity ||
        identity.verified !== true ||
        !opaque(identity.subjectId) ||
        !opaque(context.tenantId) ||
        identity.tenantId !== context.tenantId ||
        context.resourceTenantId !== context.tenantId ||
        !opaque(context.resource) ||
        ![
          'READ',
          'CREATE',
          'UPDATE',
          'DELETE',
          'APPROVE',
          'EXPORT',
          'IMPORT',
          'PRINT',
          'ADMINISTER'
        ].includes(context.action)
      )
        return false;
      const verdict = dependencies.authorize(
        freeze({
          subjectId: identity.subjectId,
          tenantId: context.tenantId,
          resourceTenantId: context.resourceTenantId,
          resource: context.resource,
          action: context.action
        })
      );
      return Boolean(verdict && verdict.decision === 'ALLOW' && verdict.explicitDeny === false);
    } catch (_error) {
      return false;
    }
  }

  return Object.freeze({
    analyze,
    plan,
    verify,
    canAccess,
    apply: (request, adapter) => execute(request, adapter, false),
    rollback: (request, adapter) => execute(request, adapter, true)
  });
}

if (typeof globalThis !== 'undefined') {
  globalThis.aerpCreateIsolatedInstallerEngine = aerpCreateIsolatedInstallerEngine;
}
