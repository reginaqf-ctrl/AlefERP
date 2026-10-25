/**
 * AERP-041 AppSheet Core readiness gate.
 *
 * AppSheet Core does not expose the Enterprise administration API. This gate
 * therefore combines deterministic validation of the installed Alef ERP
 * structure with a durable, explicit and administrator-authorized attestation
 * of the manual AppSheet deployment checks. An attestation is evidence, not an
 * authorization grant; AERP-036/AERP-037 remain authoritative.
 */
const AERP_APPSHEET_CORE_READINESS_VERSION_ = '1.0.0';
const AERP_APPSHEET_CORE_ATTESTATION_KEY_ = 'AERP041:v1:appsheet-core-attestation';
const AERP_APPSHEET_CORE_STATE_KEY_ = 'AERP041:v1:state';
const AERP_APPSHEET_CORE_REQUIRED_CHECKS_ = Object.freeze([
  'requireSignIn',
  'googleAuthenticationProvider',
  'allowAllSignedInUsersDisabled',
  'explicitUserAllowlist',
  'securityFiltersAllTables',
  'updatesRestrictedByRole',
  'deploymentCheckPassed',
  'adminAllowTestPassed',
  'restrictedUserDenyTestPassed',
  'crossTenantDenyTestPassed',
  'auditHistoryReviewed'
]);

function aerpCreateAppSheetCoreReadinessValidator(configuration) {
  const config = configuration || {};
  const binding = {
    sourceId: config.sourceId,
    targetId: config.targetId,
    tenantId: config.tenantId
  };

  function fail() {
    throw new Error('APPSHEET_CORE_READINESS_REJECTED');
  }

  function opaque(value, maximum) {
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      value.length <= maximum &&
      /^[A-Za-z0-9_.-]+$/.test(value)
    );
  }

  function boundedText(value, maximum) {
    return typeof value === 'string' && value.length > 0 && value.length <= maximum;
  }

  function exactBindingValid() {
    return (
      opaque(binding.sourceId, 128) &&
      opaque(binding.targetId, 128) &&
      opaque(binding.tenantId, 128) &&
      binding.sourceId !== binding.targetId
    );
  }

  function spreadsheet() {
    if (!exactBindingValid()) fail();
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
      JSON.stringify(canonical(value)),
      Utilities.Charset.UTF_8
    )
      .map(function (byte) {
        return ('0' + ((byte + 256) % 256).toString(16)).slice(-2);
      })
      .join('');
  }

  function commercialPlan() {
    const plan = aerpBuildCommercialInstallerPlan();
    if (
      !plan ||
      plan.ok !== true ||
      !plan.blueprint ||
      !plan.presentationManifest ||
      !plan.summary ||
      plan.summary.tables !== 17
    )
      fail();
    return plan;
  }

  function planEvidence(plan) {
    return {
      planDigest: digest(plan),
      schemaDigest: digest(
        plan.blueprint.tables.map(function (table) {
          return {
            physicalName: table.physicalName,
            headers: table.columns.map(function (column) {
              return column.Nombre_Campo;
            })
          };
        })
      ),
      presentationDigest: digest(plan.presentationManifest)
    };
  }

  function trustedPrincipal() {
    if (typeof config.trustedPrincipalVerifier !== 'function') fail();
    const result = config.trustedPrincipalVerifier({
      authentication: null,
      requestedCompanyId: binding.tenantId
    });
    const principal = result && result.principal;
    if (
      !result ||
      result.ok !== true ||
      result.verified !== true ||
      !principal ||
      !boundedText(principal.issuer, 256) ||
      !opaque(principal.subjectId, 128) ||
      !opaque(principal.userId, 128)
    )
      fail();
    return {
      issuer: principal.issuer,
      subjectId: principal.subjectId,
      userId: principal.userId
    };
  }

  function adminAllowed(principal) {
    const verdict = aerpAuthorizeFromMetadata(
      {
        authentication: null,
        companyId: binding.tenantId,
        moduleId: 'ADMINISTRACION',
        action: 'ADMINISTER',
        context: { companyId: binding.tenantId }
      },
      { trustedPrincipalVerifier: config.trustedPrincipalVerifier }
    );
    return Boolean(
      verdict &&
      verdict.ok === true &&
      verdict.decision === 'ALLOW' &&
      verdict.allowed === true &&
      verdict.trustedPrincipal &&
      verdict.trustedPrincipal.issuer === principal.issuer &&
      verdict.trustedPrincipal.subjectId === principal.subjectId &&
      verdict.trustedPrincipal.userId === principal.userId
    );
  }

  function installationState() {
    const raw = properties().getProperty(AERP_APPSHEET_CORE_STATE_KEY_);
    if (!raw) fail();
    const value = JSON.parse(raw);
    if (
      !value ||
      value.sourceId !== binding.sourceId ||
      value.boundTargetId !== binding.targetId ||
      value.tenantId !== binding.tenantId ||
      !['INCOMPLETE', 'COMPLETE'].includes(value.status)
    )
      fail();
    return value;
  }

  function normalizedChecks(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) fail();
    const actualKeys = Object.keys(source).sort();
    const requiredKeys = AERP_APPSHEET_CORE_REQUIRED_CHECKS_.slice().sort();
    if (
      actualKeys.length !== requiredKeys.length ||
      actualKeys.some(function (key, index) {
        return key !== requiredKeys[index] || source[key] !== true;
      })
    )
      fail();
    const result = {};
    AERP_APPSHEET_CORE_REQUIRED_CHECKS_.forEach(function (key) {
      result[key] = true;
    });
    return result;
  }

  function publicRecord(record) {
    return Object.freeze({
      ok: true,
      mode: 'APPSHEET_CORE_MANUAL_ATTESTATION',
      contractVersion: record.contractVersion,
      appId: record.appId,
      appVersion: record.appVersion,
      templateVersion: record.templateVersion,
      targetId: record.targetId,
      tenantId: record.tenantId,
      attestedAt: record.attestedAt,
      persistence: 'CONFIRMED',
      errors: []
    });
  }

  function readAttestation() {
    const raw = properties().getProperty(AERP_APPSHEET_CORE_ATTESTATION_KEY_);
    if (!raw) return null;
    const record = JSON.parse(raw);
    return record && typeof record === 'object' && !Array.isArray(record) ? record : null;
  }

  function attestationValid(record, principal, evidence) {
    return Boolean(
      record &&
      record.contractVersion === AERP_APPSHEET_CORE_READINESS_VERSION_ &&
      record.status === 'ATTESTED' &&
      record.mode === 'APPSHEET_CORE_MANUAL_ATTESTATION' &&
      record.sourceId === binding.sourceId &&
      record.targetId === binding.targetId &&
      record.tenantId === binding.tenantId &&
      opaque(record.appId, 128) &&
      Number.isInteger(record.appVersion) &&
      record.appVersion >= 1 &&
      record.appVersion <= 1000000 &&
      /^\d+\.\d+\.\d+$/.test(record.templateVersion || '') &&
      opaque(record.deploymentCheckReference, 160) &&
      /^[a-f0-9]{64}$/.test(record.evidenceDigest || '') &&
      JSON.stringify(normalizedChecks(record.checks)) === JSON.stringify(record.checks) &&
      record.planDigest === evidence.planDigest &&
      record.schemaDigest === evidence.schemaDigest &&
      record.presentationDigest === evidence.presentationDigest &&
      record.reviewer &&
      record.reviewer.issuer === principal.issuer &&
      record.reviewer.subjectId === principal.subjectId &&
      record.reviewer.userId === principal.userId &&
      Number.isFinite(Date.parse(record.attestedAt))
    );
  }

  function recordAttestation(input) {
    let mutationAttempted = false;
    try {
      const source = input || {};
      const lock = LockService.getDocumentLock();
      if (!lock || lock.tryLock(1000) !== true) fail();
      try {
        if (installationState().status !== 'INCOMPLETE') fail();
        const principal = trustedPrincipal();
        if (!adminAllowed(principal)) fail();
        if (
          !opaque(source.appId, 128) ||
          !Number.isInteger(source.appVersion) ||
          source.appVersion < 1 ||
          source.appVersion > 1000000 ||
          !/^\d+\.\d+\.\d+$/.test(source.templateVersion || '') ||
          !opaque(source.deploymentCheckReference, 160) ||
          !/^[a-f0-9]{64}$/.test(source.evidenceDigest || '')
        )
          fail();
        const checks = normalizedChecks(source.checks);
        const plan = commercialPlan();
        const evidence = planEvidence(plan);
        const record = {
          contractVersion: AERP_APPSHEET_CORE_READINESS_VERSION_,
          status: 'ATTESTED',
          mode: 'APPSHEET_CORE_MANUAL_ATTESTATION',
          sourceId: binding.sourceId,
          targetId: binding.targetId,
          tenantId: binding.tenantId,
          appId: source.appId,
          appVersion: source.appVersion,
          templateVersion: source.templateVersion,
          deploymentCheckReference: source.deploymentCheckReference,
          evidenceDigest: source.evidenceDigest,
          checks: checks,
          planDigest: evidence.planDigest,
          schemaDigest: evidence.schemaDigest,
          presentationDigest: evidence.presentationDigest,
          reviewer: principal,
          attestedAt: new Date().toISOString()
        };
        const store = properties();
        const existing = readAttestation();
        if (existing) {
          const comparableExisting = Object.assign({}, existing, { attestedAt: record.attestedAt });
          if (JSON.stringify(comparableExisting) !== JSON.stringify(record)) fail();
          return publicRecord(existing);
        }
        mutationAttempted = true;
        store.setProperty(AERP_APPSHEET_CORE_ATTESTATION_KEY_, JSON.stringify(record));
        const stored = readAttestation();
        if (JSON.stringify(stored) !== JSON.stringify(record)) fail();
        return publicRecord(record);
      } finally {
        lock.releaseLock();
      }
    } catch (_error) {
      return Object.freeze({
        ok: false,
        mode: 'APPSHEET_CORE_MANUAL_ATTESTATION',
        persistence: mutationAttempted ? 'UNKNOWN' : 'UNCHANGED',
        errors: ['APPSHEET_CORE_ATTESTATION_REJECTED']
      });
    }
  }

  function validateSnapshot(snapshot, plan) {
    if (
      !snapshot ||
      snapshot.sourceId !== binding.sourceId ||
      snapshot.boundTargetId !== binding.targetId ||
      snapshot.tenantId !== binding.tenantId ||
      !Array.isArray(snapshot.resources)
    )
      return false;
    const tables = snapshot.resources.filter(function (resource) {
      return resource && resource.kind === 'TABLE';
    });
    if (tables.length !== plan.blueprint.tables.length) return false;
    const seen = {};
    for (const resource of tables) {
      const name = typeof resource.key === 'string' ? resource.key.replace(/^table:/, '') : '';
      if (!name || seen[name] || !resource.payload || !Array.isArray(resource.payload.headers)) {
        return false;
      }
      seen[name] = resource.payload.headers;
    }
    if (
      plan.blueprint.tables.some(function (table) {
        const expected = table.columns.map(function (column) {
          return column.Nombre_Campo;
        });
        return JSON.stringify(seen[table.physicalName]) !== JSON.stringify(expected);
      })
    )
      return false;
    const blueprint = snapshot.resources.filter(function (resource) {
      return resource && resource.kind === 'BLUEPRINT';
    });
    const presentation = snapshot.resources.filter(function (resource) {
      return resource && resource.kind === 'PRESENTATION';
    });
    return Boolean(
      blueprint.length === 1 &&
      presentation.length === 1 &&
      aerpValidateCommercialBlueprint(blueprint[0].payload).ok === true &&
      aerpValidateCommercialPresentationManifest(presentation[0].payload, blueprint[0].payload)
        .ok === true &&
      digest(blueprint[0].payload) === digest(plan.blueprint) &&
      digest(presentation[0].payload) === digest(plan.presentationManifest)
    );
  }

  function validateApplication(snapshot) {
    try {
      spreadsheet();
      installationState();
      const principal = trustedPrincipal();
      if (!adminAllowed(principal)) fail();
      const plan = commercialPlan();
      if (!validateSnapshot(snapshot, plan)) fail();
      const record = readAttestation();
      const evidence = planEvidence(plan);
      if (!attestationValid(record, principal, evidence)) fail();
      return publicRecord(record);
    } catch (_error) {
      return Object.freeze({
        ok: false,
        mode: 'APPSHEET_CORE_MANUAL_ATTESTATION',
        errors: ['APPSHEET_CORE_READINESS_REQUIRED']
      });
    }
  }

  function getReadiness() {
    try {
      spreadsheet();
      installationState();
      const principal = trustedPrincipal();
      if (!adminAllowed(principal)) fail();
      const plan = commercialPlan();
      const record = readAttestation();
      if (!attestationValid(record, principal, planEvidence(plan))) fail();
      return publicRecord(record);
    } catch (_error) {
      return Object.freeze({
        ok: false,
        mode: 'APPSHEET_CORE_MANUAL_ATTESTATION',
        errors: ['APPSHEET_CORE_READINESS_REQUIRED']
      });
    }
  }

  return Object.freeze({
    recordAttestation: recordAttestation,
    validateApplication: validateApplication,
    getReadiness: getReadiness
  });
}

if (typeof globalThis !== 'undefined') {
  globalThis.aerpCreateAppSheetCoreReadinessValidator = aerpCreateAppSheetCoreReadinessValidator;
}
