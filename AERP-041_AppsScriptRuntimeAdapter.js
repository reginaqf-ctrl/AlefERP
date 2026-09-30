/**
 * Durable AERP-041 host for a bound, isolated spreadsheet. Configuration is a
 * backend dependency, never request data. No identity provider or grants are
 * inferred. All entrypoints remain closed without explicit metadata permission.
 */
function aerpCreateAppsScriptInstallerRuntime(configuration) {
  const config = configuration || {};
  const binding = {
    sourceId: config.sourceId,
    boundTargetId: config.targetId,
    tenantId: config.tenantId
  };
  const prefix = 'AERP041:v1:';
  let locked = false;
  let uncertain = false;
  let authentication = null;
  let principal = null;

  function fail() {
    throw new Error('RUNTIME_REJECTED');
  }
  function same(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  function opaque(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  }
  function spreadsheet(target) {
    if (
      !Object.values(binding).every(opaque) ||
      binding.sourceId === binding.boundTargetId ||
      target !== binding.boundTargetId
    )
      fail();
    const book = SpreadsheetApp.getActiveSpreadsheet();
    if (!book || book.getId() !== target) fail();
    return book;
  }
  function properties() {
    spreadsheet(binding.boundTargetId);
    const store = PropertiesService.getDocumentProperties();
    if (!store) fail();
    return store;
  }
  function read(key) {
    try {
      return properties().getProperty(prefix + key);
    } catch (_error) {
      uncertain = true;
      fail();
    }
  }
  function write(key, value) {
    if (!locked) fail();
    try {
      properties().setProperty(prefix + key, value);
      if (read(key) !== value) fail();
    } catch (_error) {
      uncertain = true;
      fail();
    }
  }
  function state() {
    const raw = read('state');
    if (raw === null) return { ...binding, status: 'EMPTY' };
    const value = JSON.parse(raw);
    if (
      !value ||
      Object.keys(binding).some(key => value[key] !== binding[key]) ||
      !['EMPTY', 'INCOMPLETE', 'COMPLETE'].includes(value.status)
    )
      fail();
    return value;
  }
  function setState(target, status) {
    spreadsheet(target);
    state();
    if (!['EMPTY', 'INCOMPLETE', 'COMPLETE'].includes(status)) fail();
    if (read('state') === null) write('state', JSON.stringify({ ...binding, status: 'EMPTY' }));
    write('state', JSON.stringify({ ...binding, status }));
    return true;
  }
  // Each immutable resource is published only after all bounded chunks have
  // been read back. A torn unpublished write can be resumed with identical bytes.
  function resourceRead(key) {
    const raw = read(key + ':head');
    if (raw === null) return null;
    const head = JSON.parse(raw);
    if (!Number.isInteger(head.chunks) || head.chunks < 1 || head.chunks > 200) fail();
    let serialized = '';
    for (let i = 0; i < head.chunks; i++) {
      const chunk = read(key + ':' + i);
      if (chunk === null) fail();
      serialized += chunk;
    }
    if (serialized.length !== head.length) fail();
    return JSON.parse(serialized);
  }
  function resourceWrite(resource) {
    const key = 'resource:' + resource.key;
    const serialized = JSON.stringify(resource);
    if (serialized.length > 400000) fail();
    const chunks = Math.ceil(serialized.length / 2000);
    for (let i = 0; i < chunks; i++) {
      const piece = serialized.slice(i * 2000, (i + 1) * 2000);
      const existing = read(key + ':' + i);
      if (existing !== null && existing !== piece) fail();
      if (existing === null) write(key + ':' + i, piece);
    }
    write(key + ':head', JSON.stringify({ chunks, length: serialized.length }));
    if (!same(resourceRead(key), resource)) {
      uncertain = true;
      fail();
    }
  }
  function verifyIdentity(evidence) {
    const result = aerpResolveTrustedAuthorizationPrincipal_(
      { authentication: evidence, companyId: binding.tenantId },
      { trustedPrincipalVerifier: config.trustedPrincipalVerifier }
    );
    if (!result || result.ok !== true || result.verified !== true) return null;
    if (
      principal &&
      (principal.subjectId !== result.principal.subjectId ||
        principal.issuer !== result.principal.issuer ||
        principal.userId !== result.principal.userId)
    )
      return null;
    principal = result.principal;
    return { verified: true, subjectId: principal.subjectId, tenantId: binding.tenantId };
  }
  function authorize(context) {
    spreadsheet(binding.boundTargetId);
    if (
      !principal ||
      context.subjectId !== principal.subjectId ||
      context.tenantId !== binding.tenantId ||
      context.resourceTenantId !== binding.tenantId
    )
      fail();
    const actions = { READ: 'VIEW', UPDATE: 'EDIT' };
    const verdict = aerpAuthorizeFromMetadata(
      {
        authentication,
        companyId: binding.tenantId,
        moduleId: context.resource,
        action: actions[context.action] || context.action,
        context: { companyId: binding.tenantId }
      },
      { trustedPrincipalVerifier: config.trustedPrincipalVerifier }
    );
    const allowed =
      verdict &&
      verdict.ok === true &&
      verdict.decision === 'ALLOW' &&
      verdict.allowed === true &&
      verdict.trustedPrincipal &&
      verdict.trustedPrincipal.subjectId === principal.subjectId &&
      verdict.trustedPrincipal.issuer === principal.issuer &&
      verdict.trustedPrincipal.userId === principal.userId;
    return { decision: allowed ? 'ALLOW' : 'DENY', explicitDeny: !allowed };
  }
  function adminAllowed() {
    return (
      authorize({
        subjectId: principal.subjectId,
        tenantId: binding.tenantId,
        resourceTenantId: binding.tenantId,
        resource: 'ADMINISTRACION',
        action: 'ADMINISTER'
      }).decision === 'ALLOW'
    );
  }
  function security(snapshot) {
    const blueprint = snapshot.resources.find(item => item.kind === 'BLUEPRINT');
    const presentation = snapshot.resources.find(item => item.kind === 'PRESENTATION');
    const metadataValidated = Boolean(
      blueprint &&
      presentation &&
      aerpValidateCommercialBlueprint(blueprint.payload).ok === true &&
      aerpValidateCommercialPresentationManifest(presentation.payload, blueprint.payload).ok ===
        true
    );
    const admin = adminAllowed();
    const application =
      typeof config.validateApplication === 'function'
        ? config.validateApplication(aerpInstallerDeepFreeze_(JSON.parse(JSON.stringify(snapshot))))
        : null;
    return {
      defaultDecision: 'DENY',
      denyPrecedence: true,
      visibilityGrantsAuthorization: false,
      tenantIsolation: true,
      authorizationValidated: admin,
      adminAccessValidated: admin,
      metadataValidated,
      applicationValidated: Boolean(
        application &&
        application.ok === true &&
        Array.isArray(application.errors) &&
        application.errors.length === 0
      )
    };
  }
  function readSnapshot(target) {
    if (!locked) return withExclusiveTarget(target, () => readSnapshot(target));
    const book = spreadsheet(target);
    const current = state();
    const resources = book
      .getSheets()
      .filter(sheet => !ownedEmpty(sheet))
      .map(sheet => ({
        key: 'table:' + sheet.getName(),
        kind: 'TABLE',
        payload: {
          headers:
            sheet.getLastColumn() > 0
              ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
              : []
        }
      }));
    for (const key of [
      'metadata:blueprint',
      'metadata:presentation',
      'security:policy',
      'security:admin-binding'
    ]) {
      const resource = resourceRead('resource:' + key);
      if (resource) resources.push(resource);
    }
    const snapshot = { ...current, resources };
    snapshot.security = security(snapshot);
    return snapshot;
  }
  function ownedEmpty(sheet) {
    return (
      sheet.getLastRow() === 0 &&
      sheet.getLastColumn() === 0 &&
      read('owned:' + sheet.getName()) === String(sheet.getSheetId())
    );
  }
  function appendJournal(target, entry) {
    spreadsheet(target);
    if (
      !['ANALYZE', 'PLAN', 'APPLY', 'VERIFY', 'RECOVERY'].includes(entry.phase) ||
      !['VALIDATED', 'STARTED', 'SUCCEEDED', 'FAILED', 'QUARANTINED'].includes(entry.event) ||
      (entry.operation !== undefined &&
        (!Number.isInteger(entry.operation) || entry.operation < 0 || entry.operation > 20))
    )
      fail();
    const raw = read('journal:next');
    let index = raw === null ? 0 : Number(raw);
    if (!Number.isInteger(index) || index < 0) fail();
    // Preserve a record written just before a failed cursor acknowledgement.
    while (index < 4096 && read('journal:' + index) !== null) index++;
    if (index >= 4096) {
      uncertain = true;
      fail();
    }
    const sanitized = { phase: entry.phase, event: entry.event };
    if (entry.operation !== undefined) sanitized.operation = entry.operation;
    write('journal:' + index, JSON.stringify(sanitized));
    write('journal:next', String(index + 1));
    return true;
  }
  function createIfAbsent(target, operation) {
    const book = spreadsheet(target);
    if (
      !locked ||
      state().status !== 'INCOMPLETE' ||
      operation.type !== 'CREATE_IF_ABSENT' ||
      operation.id !== 'AERP-041:1:' + operation.resource.key
    )
      fail();
    const resource = operation.resource;
    if (resource.kind === 'TABLE') {
      const name = resource.key.slice(6);
      const existing = book.getSheetByName(name);
      if (existing && !ownedEmpty(existing)) {
        const headers =
          existing.getLastColumn() > 0
            ? existing.getRange(1, 1, 1, existing.getLastColumn()).getValues()[0]
            : [];
        if (!same(headers, resource.payload.headers)) fail();
        return 'EXISTS';
      }
      try {
        const sheet = existing || book.insertSheet(name);
        if (!existing) write('owned:' + name, String(sheet.getSheetId()));
        sheet
          .getRange(1, 1, 1, resource.payload.headers.length)
          .setValues([resource.payload.headers]);
        SpreadsheetApp.flush();
        if (
          !same(
            sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0],
            resource.payload.headers
          )
        )
          fail();
      } catch (_error) {
        uncertain = true;
        fail();
      }
    } else {
      const existing = resourceRead('resource:' + resource.key);
      if (existing) {
        if (!same(existing, resource)) fail();
        return 'EXISTS';
      }
      resourceWrite(resource);
    }
    return 'CREATED';
  }
  function withExclusiveTarget(target, work) {
    spreadsheet(target);
    const lock = LockService.getDocumentLock();
    if (locked || !lock || lock.tryLock(1000) !== true) fail();
    locked = true;
    try {
      // Recheck identity and metadata under the same lock as the mutation.
      if (!verifyIdentity(authentication) || !adminAllowed()) fail();
      return work();
    } finally {
      locked = false;
      try {
        lock.releaseLock();
      } catch (_error) {
        uncertain = true;
        fail();
      }
    }
  }
  const adapter = { withExclusiveTarget, readSnapshot, setState, appendJournal, createIfAbsent };
  function invoke(method, request) {
    uncertain = false;
    authentication = null;
    principal = null;
    try {
      // The coordinator performs descriptor-safe copying before invoking these
      // callbacks; never read authentication or confirmation from raw request here.
      const coordinator = aerpCreateCommercialInstallerCoordinator({
        verifyIdentity(evidence) {
          authentication = evidence;
          return verifyIdentity(evidence);
        },
        authorize,
        verifyConfirmation(input) {
          if (typeof config.verifyConfirmation !== 'function') return null;
          const planDigest = Utilities.computeDigest(
            Utilities.DigestAlgorithm.SHA_256,
            JSON.stringify(aerpBuildCommercialInstallerPlan()),
            Utilities.Charset.UTF_8
          )
            .map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2))
            .join('');
          const attestation = config.verifyConfirmation(
            aerpInstallerDeepFreeze_({ ...input, planDigest })
          );
          return attestation && attestation.planDigest === planDigest ? attestation : null;
        },
        validateSecurity(snapshot) {
          const checked = security(snapshot);
          return {
            ok: [
              'authorizationValidated',
              'adminAccessValidated',
              'metadataValidated',
              'applicationValidated'
            ].every(key => checked[key] === true),
            errors: []
          };
        },
        readSnapshot,
        createAdapter(context) {
          if (
            context.sourceId !== binding.sourceId ||
            context.targetId !== binding.boundTargetId ||
            context.tenantId !== binding.tenantId ||
            !adminAllowed()
          )
            fail();
          return adapter;
        }
      });
      const result = coordinator[method](request);
      return uncertain && method !== 'canAccess'
        ? { ...result, ok: false, state: 'INCOMPLETE', persistence: 'UNKNOWN' }
        : result;
    } catch (_error) {
      return method === 'canAccess'
        ? false
        : {
            ok: false,
            state: 'INCOMPLETE',
            code: 'RUNTIME_REJECTED',
            persistence: uncertain ? 'UNKNOWN' : 'UNCHANGED',
            journal: []
          };
    } finally {
      authentication = null;
      principal = null;
    }
  }
  return Object.freeze({
    analyze: request => invoke('analyze', request),
    plan: request => invoke('plan', request),
    verify: request => invoke('verify', request),
    apply: request => invoke('apply', request),
    rollback: request => invoke('rollback', request),
    canAccess: request => invoke('canAccess', request)
  });
}

if (typeof globalThis !== 'undefined') {
  globalThis.aerpCreateAppsScriptInstallerRuntime = aerpCreateAppsScriptInstallerRuntime;
}
