/**
 * AERP-041 secure first-install services for a bound Apps Script project.
 *
 * The OIDC token is obtained directly from the trusted Apps Script runtime.
 * Confirmation and the one-time bootstrap claim are durable, document-scoped
 * and bound to the installation plan. None of these services grant normal ERP
 * access; AERP-036/AERP-037 remain authoritative after provisioning.
 */
function aerpCreateAppsScriptSecureBootstrap(configuration) {
  const config = configuration || {};
  const binding = {
    sourceId: config.sourceId,
    targetId: config.targetId,
    tenantId: config.tenantId
  };
  const company = config.company || {};
  const expectedAudience = config.expectedAudience;
  const confirmationTtlSeconds = Number(config.confirmationTtlSeconds || 600);
  const prefix = 'AERP041:v1:bootstrap:';
  const issuers = ['accounts.google.com', 'https://accounts.google.com'];

  function opaque(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  }

  function text(value, maximum) {
    return typeof value === 'string' && value.trim() && value.trim().length <= maximum
      ? value.trim()
      : null;
  }

  function fail() {
    throw new Error('SECURE_BOOTSTRAP_REJECTED');
  }

  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      const result = {};
      Object.keys(value)
        .sort()
        .forEach(function (key) {
          result[key] = canonical(value[key]);
        });
      return result;
    }
    return value;
  }

  function digest(value) {
    return Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      typeof value === 'string' ? value : JSON.stringify(canonical(value)),
      Utilities.Charset.UTF_8
    )
      .map(function (byte) {
        return ('0' + ((byte + 256) % 256).toString(16)).slice(-2);
      })
      .join('');
  }

  function nowSeconds() {
    return Math.floor((typeof config.now === 'function' ? config.now() : Date.now()) / 1000);
  }

  function spreadsheet() {
    if (
      !opaque(binding.sourceId) ||
      !opaque(binding.targetId) ||
      !opaque(binding.tenantId) ||
      binding.sourceId === binding.targetId ||
      !Number.isInteger(confirmationTtlSeconds) ||
      confirmationTtlSeconds < 60 ||
      confirmationTtlSeconds > 900
    )
      fail();
    const book = SpreadsheetApp.getActiveSpreadsheet();
    if (!book || book.getId() !== binding.targetId) fail();
    return book;
  }

  function properties() {
    spreadsheet();
    const store = PropertiesService.getDocumentProperties();
    if (!store) fail();
    return store;
  }

  function decodeOidcPayload(token) {
    const parts = typeof token === 'string' ? token.split('.') : [];
    if (parts.length !== 3 || !parts[1]) fail();
    const bytes = Utilities.base64DecodeWebSafe(parts[1]);
    const raw = Utilities.newBlob(bytes).getDataAsString();
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail();
    return payload;
  }

  function audienceMatches(audience) {
    if (!text(expectedAudience, 512)) return false;
    return Array.isArray(audience)
      ? audience.indexOf(expectedAudience) !== -1
      : audience === expectedAudience;
  }

  function verifyPrincipal(input) {
    try {
      if (!input || input.requestedCompanyId !== binding.tenantId) fail();
      const token = ScriptApp.getIdentityToken();
      if (!token) fail();
      const payload = decodeOidcPayload(token);
      const current = nowSeconds();
      const issuer = text(payload.iss, 128);
      const subjectId = text(payload.sub, 128);
      const email = text(payload.email, 320);
      const name = text(payload.name, 160) || email;
      if (
        issuers.indexOf(issuer) === -1 ||
        !opaque(subjectId) ||
        !audienceMatches(payload.aud) ||
        !Number.isFinite(payload.exp) ||
        payload.exp <= current ||
        (Number.isFinite(payload.iat) && payload.iat > current + 60) ||
        !email ||
        payload.email_verified !== true
      )
        fail();
      return {
        ok: true,
        verified: true,
        principal: {
          issuer: issuer,
          subjectId: subjectId,
          userId: 'OIDC_' + digest(issuer + '\u0000' + subjectId).slice(0, 32),
          authenticationMethod: 'GOOGLE_OIDC',
          email: email,
          name: name
        }
      };
    } catch (_error) {
      return { ok: false, verified: false, principal: null };
    }
  }

  function planDigest() {
    return digest(JSON.stringify(aerpBuildCommercialInstallerPlan()));
  }

  function companyConfiguration() {
    const normalized = {
      code: text(company.code, 64),
      name: text(company.name, 160),
      currency: text(company.currency, 16),
      timeZone: text(company.timeZone, 64)
    };
    if (
      Object.values(normalized).some(function (value) {
        return !value;
      })
    )
      fail();
    return normalized;
  }

  function configurationDigest() {
    return digest({ binding: binding, company: companyConfiguration(), planDigest: planDigest() });
  }

  function readRecord(id) {
    if (!opaque(id)) fail();
    const raw = properties().getProperty(prefix + 'confirmation:' + id);
    if (raw === null) fail();
    const record = JSON.parse(raw);
    if (!record || record.version !== 1) fail();
    return record;
  }

  function writeRecord(record) {
    properties().setProperty(
      prefix + 'confirmation:' + record.confirmationId,
      JSON.stringify(record)
    );
    const confirmed = readRecord(record.confirmationId);
    if (JSON.stringify(confirmed) !== JSON.stringify(record)) fail();
  }

  function principal() {
    const result = verifyPrincipal({ requestedCompanyId: binding.tenantId });
    if (!result.ok) fail();
    return result.principal;
  }

  function issueConfirmation(input) {
    const source = input || {};
    const intent = source.intent === 'RECOVER' ? 'RECOVER' : 'APPLY';
    spreadsheet();
    const lock = LockService.getDocumentLock();
    if (!lock || lock.tryLock(1000) !== true) fail();
    try {
      const currentState = properties().getProperty('AERP041:v1:state');
      if (currentState) {
        const parsed = JSON.parse(currentState);
        if (parsed.status === 'COMPLETE') fail();
      }
      const identity = principal();
      const confirmationId = String(Utilities.getUuid()).replace(/-/g, '_');
      const nonce = String(Utilities.getUuid()) + String(Utilities.getUuid());
      const record = {
        version: 1,
        confirmationId: confirmationId,
        status: 'PENDING',
        intent: intent,
        sourceId: binding.sourceId,
        targetId: binding.targetId,
        tenantId: binding.tenantId,
        issuer: identity.issuer,
        subjectId: identity.subjectId,
        planDigest: planDigest(),
        configurationDigest: configurationDigest(),
        nonceDigest: digest(nonce),
        expiresAt: nowSeconds() + confirmationTtlSeconds
      };
      writeRecord(record);
      return Object.freeze({ confirmationId: confirmationId, nonce: nonce });
    } finally {
      lock.releaseLock();
    }
  }

  function matchingRecord(input, allowedStatuses) {
    const source = input || {};
    const evidence = source.evidence || source;
    const record = readRecord(evidence.confirmationId);
    const identity = principal();
    if (
      allowedStatuses.indexOf(record.status) === -1 ||
      record.expiresAt < nowSeconds() ||
      record.intent !== source.intent ||
      record.sourceId !== binding.sourceId ||
      record.targetId !== binding.targetId ||
      record.tenantId !== binding.tenantId ||
      record.issuer !== identity.issuer ||
      record.subjectId !== identity.subjectId ||
      record.planDigest !== source.planDigest ||
      record.planDigest !== planDigest() ||
      record.configurationDigest !== configurationDigest() ||
      record.nonceDigest !== digest(evidence.nonce || '')
    )
      fail();
    return { record: record, identity: identity };
  }

  function verifyConfirmation(input) {
    try {
      const checked = matchingRecord(input, ['PENDING', 'CLAIMED']);
      return {
        confirmed: true,
        confirmationId: checked.record.confirmationId,
        intent: input.intent,
        sourceId: binding.sourceId,
        targetId: binding.targetId,
        tenantId: binding.tenantId,
        subjectId: checked.identity.subjectId,
        contractVersion: input.contractVersion,
        blueprintVersion: input.blueprintVersion,
        presentationVersion: input.presentationVersion,
        planDigest: checked.record.planDigest
      };
    } catch (_error) {
      return null;
    }
  }

  function claimBootstrap(context) {
    let mutationAttempted = false;
    try {
      const source = context || {};
      const record = readRecord(source.confirmationId);
      const identity = principal();
      if (
        ['PENDING', 'CLAIMED'].indexOf(record.status) === -1 ||
        record.expiresAt < nowSeconds() ||
        record.intent !== source.intent ||
        record.sourceId !== binding.sourceId ||
        record.targetId !== binding.targetId ||
        record.tenantId !== binding.tenantId ||
        record.issuer !== identity.issuer ||
        record.subjectId !== identity.subjectId ||
        record.configurationDigest !== configurationDigest()
      )
        fail();
      const store = properties();
      const claimKey = prefix + 'claim';
      const priorRaw = store.getProperty(claimKey);
      if (priorRaw) {
        const prior = JSON.parse(priorRaw);
        if (
          prior.confirmationId !== record.confirmationId ||
          prior.subjectId !== identity.subjectId ||
          prior.tenantId !== binding.tenantId ||
          prior.status === 'CONSUMED'
        )
          fail();
      } else {
        const claim = {
          version: 1,
          status: 'CLAIMED',
          confirmationId: record.confirmationId,
          subjectId: identity.subjectId,
          tenantId: binding.tenantId
        };
        mutationAttempted = true;
        store.setProperty(claimKey, JSON.stringify(claim));
        const storedClaim = JSON.parse(store.getProperty(claimKey) || 'null');
        if (JSON.stringify(storedClaim) !== JSON.stringify(claim)) fail();
      }
      if (record.status === 'PENDING') {
        record.status = 'CLAIMED';
        mutationAttempted = true;
        writeRecord(record);
      }
      return {
        ok: true,
        confirmationId: record.confirmationId,
        profile: identity,
        company: companyConfiguration()
      };
    } catch (_error) {
      return { ok: false, persistence: mutationAttempted ? 'UNKNOWN' : 'UNCHANGED' };
    }
  }

  function consumeBootstrap(context) {
    try {
      const source = context || {};
      const store = properties();
      const claimKey = prefix + 'claim';
      const raw = store.getProperty(claimKey);
      if (!raw) fail();
      const claim = JSON.parse(raw);
      if (
        claim.status !== 'CLAIMED' ||
        claim.confirmationId !== source.confirmationId ||
        claim.tenantId !== binding.tenantId
      )
        fail();
      const record = readRecord(claim.confirmationId);
      record.status = 'CONSUMED';
      writeRecord(record);
      claim.status = 'CONSUMED';
      store.setProperty(claimKey, JSON.stringify(claim));
      return true;
    } catch (_error) {
      return false;
    }
  }

  return Object.freeze({
    trustedPrincipalVerifier: verifyPrincipal,
    issueConfirmation: issueConfirmation,
    verifyConfirmation: verifyConfirmation,
    claimBootstrap: claimBootstrap,
    consumeBootstrap: consumeBootstrap
  });
}

/**
 * Composes the approved Apps Script bootstrap with the durable installer.
 * Security services are always sourced from the bootstrap created here and
 * cannot be replaced by caller-provided verifier functions.
 */
function aerpCreateSecureAppsScriptInstaller(configuration) {
  const config = configuration || {};
  const bootstrap = aerpCreateAppsScriptSecureBootstrap(config);
  const appSheetCore = aerpCreateAppSheetCoreReadinessValidator(
    Object.assign({}, config, {
      trustedPrincipalVerifier: bootstrap.trustedPrincipalVerifier
    })
  );
  const runtimeConfiguration = Object.assign({}, config, {
    trustedPrincipalVerifier: bootstrap.trustedPrincipalVerifier,
    verifyConfirmation: bootstrap.verifyConfirmation,
    claimBootstrap: bootstrap.claimBootstrap,
    consumeBootstrap: bootstrap.consumeBootstrap,
    validateApplication: appSheetCore.validateApplication
  });
  const runtime = aerpCreateAppsScriptInstallerRuntime(runtimeConfiguration);

  return Object.freeze({
    issueConfirmation: bootstrap.issueConfirmation,
    recordAppSheetCoreAttestation: appSheetCore.recordAttestation,
    getAppSheetCoreReadiness: appSheetCore.getReadiness,
    analyze: runtime.analyze,
    plan: runtime.plan,
    verify: runtime.verify,
    apply: runtime.apply,
    rollback: runtime.rollback,
    canAccess: runtime.canAccess
  });
}

if (typeof globalThis !== 'undefined') {
  globalThis.aerpCreateAppsScriptSecureBootstrap = aerpCreateAppsScriptSecureBootstrap;
  globalThis.aerpCreateSecureAppsScriptInstaller = aerpCreateSecureAppsScriptInstaller;
}
