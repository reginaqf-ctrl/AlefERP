/**
 * AERP-041 operational controller.
 *
 * Authorization remains in AERP-036/AERP-037. This module coordinates an
 * explicit user confirmation with the secure installer and exposes only
 * sanitized status. Configuration is read by the Apps Script adapter from
 * ScriptProperties; durable installation state remains in DocumentProperties.
 */
function aerpCreateOperationalInstallerController(dependencies) {
  const required = [
    'readConfiguration',
    'getTargetId',
    'createSecureInstaller',
    'readAppSheetAttestation',
    'confirmPlan',
    'confirmCompletion'
  ];

  function freeze(value) {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }

  function copy(value, ancestors = new Set(), depth = 0) {
    if (depth > 20) throw new Error('OPERATIONAL_CONTROLLER_REJECTED');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object' || ancestors.has(value)) {
      throw new Error('OPERATIONAL_CONTROLLER_REJECTED');
    }
    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== null) {
      const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
      if (
        !constructor ||
        !Object.prototype.hasOwnProperty.call(constructor, 'value') ||
        typeof constructor.value !== 'function' ||
        Function.prototype.toString.call(constructor.value) !==
          'function Object() { [native code] }'
      ) {
        throw new Error('OPERATIONAL_CONTROLLER_REJECTED');
      }
    }
    ancestors.add(value);
    const result = Array.isArray(value) ? [] : {};
    Object.keys(value).forEach(function (key) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        throw new Error('OPERATIONAL_CONTROLLER_REJECTED');
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        throw new Error('OPERATIONAL_CONTROLLER_REJECTED');
      }
      result[key] = copy(descriptor.value, ancestors, depth + 1);
    });
    ancestors.delete(value);
    return result;
  }

  function exactKeys(value, keys) {
    return (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys.slice().sort())
    );
  }

  function opaque(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  }

  function bounded(value, maximum) {
    return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximum;
  }

  function denied(code, persistence) {
    return freeze({
      ok: false,
      state: 'INCOMPLETE',
      code: code,
      persistence: persistence === 'UNKNOWN' ? 'UNKNOWN' : 'UNCHANGED'
    });
  }

  function configuration() {
    const raw = copy(dependencies.readConfiguration());
    if (
      !exactKeys(raw, ['sourceId', 'tenantId', 'expectedAudience', 'expectedAdminEmail', 'company'])
    ) {
      throw new Error('OPERATIONAL_CONFIGURATION_REJECTED');
    }
    if (!exactKeys(raw.company, ['code', 'name', 'currency', 'timeZone'])) {
      throw new Error('OPERATIONAL_CONFIGURATION_REJECTED');
    }
    const normalized = {
      sourceId: raw.sourceId,
      tenantId: raw.tenantId,
      expectedAudience: raw.expectedAudience,
      expectedAdminEmail:
        typeof raw.expectedAdminEmail === 'string'
          ? raw.expectedAdminEmail.trim().toLowerCase()
          : raw.expectedAdminEmail,
      company: {
        code: raw.company.code.trim(),
        name: raw.company.name.trim(),
        currency: raw.company.currency.trim(),
        timeZone: raw.company.timeZone.trim()
      }
    };
    if (
      !opaque(normalized.sourceId) ||
      !opaque(normalized.tenantId) ||
      !bounded(normalized.expectedAudience, 512) ||
      !bounded(normalized.expectedAdminEmail, 320) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.expectedAdminEmail) ||
      !/^[A-Za-z0-9._-]{1,64}$/.test(normalized.company.code) ||
      !bounded(normalized.company.name, 160) ||
      !/^[A-Z]{3,16}$/.test(normalized.company.currency) ||
      !/^[A-Za-z0-9_+./-]{1,64}$/.test(normalized.company.timeZone)
    ) {
      throw new Error('OPERATIONAL_CONFIGURATION_REJECTED');
    }
    return normalized;
  }

  function createContext() {
    if (
      !dependencies ||
      typeof dependencies !== 'object' ||
      required.some(function (name) {
        return typeof dependencies[name] !== 'function';
      })
    ) {
      throw new Error('OPERATIONAL_DEPENDENCY_UNAVAILABLE');
    }
    const config = configuration();
    const targetId = dependencies.getTargetId();
    if (!opaque(targetId) || targetId === config.sourceId) {
      throw new Error('OPERATIONAL_TARGET_NOT_ISOLATED');
    }
    const installer = dependencies.createSecureInstaller(
      freeze({
        sourceId: config.sourceId,
        targetId: targetId,
        tenantId: config.tenantId,
        expectedAudience: config.expectedAudience,
        expectedAdminEmail: config.expectedAdminEmail,
        confirmationTtlSeconds: 900,
        company: copy(config.company)
      })
    );
    const methods = [
      'issueConfirmation',
      'renewConfirmation',
      'recordAppSheetCoreAttestation',
      'getAppSheetCoreReadiness',
      'plan',
      'verify',
      'apply'
    ];
    if (
      !installer ||
      typeof installer !== 'object' ||
      methods.some(function (name) {
        return typeof installer[name] !== 'function';
      })
    ) {
      throw new Error('OPERATIONAL_DEPENDENCY_UNAVAILABLE');
    }
    return {
      installer: installer,
      request: freeze({
        sourceId: config.sourceId,
        targetId: targetId,
        tenantId: config.tenantId,
        identity: { provider: 'GOOGLE_OIDC' }
      })
    };
  }

  function planContext() {
    const context = createContext();
    const planned = context.installer.plan(context.request);
    if (
      !planned ||
      planned.ok !== true ||
      !['CLEAN', 'PARTIAL', 'COMPLETE'].includes(planned.state) ||
      !Array.isArray(planned.operations)
    ) {
      throw new Error('OPERATIONAL_PLAN_REJECTED');
    }
    return {
      installer: context.installer,
      request: context.request,
      summary: freeze({
        ok: true,
        state: planned.state,
        operations: planned.operations.length,
        persistence: 'UNCHANGED'
      })
    };
  }

  function completionValidated(context) {
    const readiness = context.installer.getAppSheetCoreReadiness();
    const verification = context.installer.verify(context.request);
    return Boolean(
      readiness &&
      readiness.ok === true &&
      verification &&
      verification.ok === true &&
      verification.verified === true &&
      verification.state === 'COMPLETE'
    );
  }

  function completeResponse(context) {
    if (!completionValidated(context)) return denied('ACCESS_PROMOTION_INCOMPLETE');
    return freeze({
      ok: true,
      state: 'COMPLETE',
      code: 'OPERATIONAL_INSTALLATION_COMPLETE',
      persistence: 'UNCHANGED',
      created: 0
    });
  }

  function sanitizeMutation(result, context) {
    if (!result || typeof result !== 'object') {
      return denied('OPERATIONAL_INSTALLATION_REJECTED');
    }
    const state = ['COMPLETE', 'INCOMPLETE', 'INCOMPATIBLE'].includes(result.state)
      ? result.state
      : 'INCOMPLETE';
    const persistence = ['CONFIRMED', 'UNCHANGED', 'UNKNOWN'].includes(result.persistence)
      ? result.persistence
      : 'UNCHANGED';
    if (result.code === 'ACCESS_PROMOTION_INCOMPLETE') {
      return denied('ACCESS_PROMOTION_INCOMPLETE', persistence);
    }
    if (result.ok === true && state === 'COMPLETE' && !completionValidated(context)) {
      return denied('ACCESS_PROMOTION_INCOMPLETE', 'UNKNOWN');
    }
    const response = {
      ok: result.ok === true && state === 'COMPLETE',
      state: state,
      code:
        result.ok === true && state === 'COMPLETE'
          ? 'OPERATIONAL_INSTALLATION_COMPLETE'
          : state === 'INCOMPATIBLE'
            ? 'OPERATIONAL_TARGET_INCOMPATIBLE'
            : 'OPERATIONAL_INSTALLATION_INCOMPLETE',
      persistence: persistence
    };
    if (Number.isInteger(result.created) && result.created >= 0) response.created = result.created;
    return freeze(response);
  }

  function preview() {
    try {
      return planContext().summary;
    } catch (_error) {
      return denied('OPERATIONAL_PREVIEW_REJECTED');
    }
  }

  function start() {
    try {
      const context = planContext();
      if (context.summary.state === 'COMPLETE') {
        return completeResponse(context);
      }
      if (dependencies.confirmPlan(context.summary) !== true) {
        return denied('OPERATIONAL_USER_CANCELLED');
      }
      const confirmation =
        context.summary.state === 'CLEAN'
          ? context.installer.issueConfirmation({ intent: 'APPLY' })
          : context.installer.renewConfirmation({ intent: 'APPLY' });
      if (
        !confirmation ||
        !opaque(confirmation.confirmationId) ||
        !bounded(confirmation.nonce, 512)
      ) {
        throw new Error('OPERATIONAL_CONFIRMATION_REJECTED');
      }
      return sanitizeMutation(
        context.installer.apply(
          freeze(Object.assign({}, context.request, { confirmation: copy(confirmation) }))
        ),
        context
      );
    } catch (_error) {
      return denied('OPERATIONAL_INSTALLATION_REJECTED');
    }
  }

  function normalizedAttestation() {
    const source = copy(dependencies.readAppSheetAttestation());
    const rootKeys = [
      'appId',
      'appVersion',
      'templateVersion',
      'deploymentCheckReference',
      'evidenceDigest',
      'checks',
      'tableChecks'
    ];
    const checks = [
      'requireSignIn',
      'googleAuthenticationProvider',
      'allowAllSignedInUsersDisabled',
      'explicitUserAllowlist',
      'updatesRestrictedByRole',
      'deploymentCheckPassed',
      'adminAllowTestPassed',
      'restrictedUserDenyTestPassed',
      'crossTenantDenyTestPassed',
      'auditHistoryReviewed'
    ];
    if (
      !exactKeys(source, rootKeys) ||
      !exactKeys(source.checks, checks) ||
      !/^[A-Za-z0-9_.-]{1,128}$/.test(source.appId || '') ||
      !Number.isInteger(source.appVersion) ||
      source.appVersion < 1 ||
      source.appVersion > 1000000 ||
      !/^\d+\.\d+\.\d+$/.test(source.templateVersion || '') ||
      !/^[A-Za-z0-9_.-]{1,160}$/.test(source.deploymentCheckReference || '') ||
      !/^[a-f0-9]{64}$/.test(source.evidenceDigest || '') ||
      checks.some(function (name) {
        return source.checks[name] !== true;
      }) ||
      !Array.isArray(source.tableChecks) ||
      source.tableChecks.length !== 17
    ) {
      throw new Error('OPERATIONAL_ATTESTATION_REJECTED');
    }
    const tableKeys = [
      'physicalName',
      'securityFilterVerified',
      'updatePolicyVerified',
      'adminAllowTestPassed',
      'restrictedUserDenyTestPassed',
      'crossTenantDenyTestPassed',
      'evidenceReference',
      'evidenceDigest'
    ];
    const tableNames = {};
    const tableChecks = source.tableChecks.map(function (entry) {
      if (
        !exactKeys(entry, tableKeys) ||
        !/^[A-Z][A-Z0-9_]{2,63}$/.test(entry.physicalName || '') ||
        tableNames[entry.physicalName] ||
        entry.securityFilterVerified !== true ||
        entry.updatePolicyVerified !== true ||
        entry.adminAllowTestPassed !== true ||
        entry.restrictedUserDenyTestPassed !== true ||
        entry.crossTenantDenyTestPassed !== true ||
        !/^[A-Za-z0-9_.-]{1,160}$/.test(entry.evidenceReference || '') ||
        !/^[a-f0-9]{64}$/.test(entry.evidenceDigest || '')
      ) {
        throw new Error('OPERATIONAL_ATTESTATION_REJECTED');
      }
      tableNames[entry.physicalName] = true;
      return copy(entry);
    });
    return freeze({
      appId: source.appId,
      appVersion: source.appVersion,
      templateVersion: source.templateVersion,
      deploymentCheckReference: source.deploymentCheckReference,
      evidenceDigest: source.evidenceDigest,
      checks: copy(source.checks),
      tableChecks: tableChecks
    });
  }

  function complete() {
    try {
      const context = planContext();
      if (context.summary.state === 'COMPLETE') {
        return completeResponse(context);
      }
      if (context.summary.state !== 'PARTIAL') {
        return denied('OPERATIONAL_INSTALLATION_NOT_STARTED');
      }
      const attestation = normalizedAttestation();
      const confirmationSummary = freeze({
        state: context.summary.state,
        appId: attestation.appId,
        appVersion: attestation.appVersion,
        templateVersion: attestation.templateVersion,
        deploymentCheckReference: attestation.deploymentCheckReference,
        tablesVerified: attestation.tableChecks.length
      });
      if (dependencies.confirmCompletion(confirmationSummary) !== true) {
        return denied('OPERATIONAL_USER_CANCELLED');
      }
      const recorded = context.installer.recordAppSheetCoreAttestation(attestation);
      if (!recorded || recorded.ok !== true) {
        return denied(
          'OPERATIONAL_ATTESTATION_REJECTED',
          recorded && recorded.persistence === 'UNKNOWN' ? 'UNKNOWN' : 'UNCHANGED'
        );
      }
      const confirmation = context.installer.renewConfirmation({ intent: 'APPLY' });
      if (
        !confirmation ||
        !opaque(confirmation.confirmationId) ||
        !bounded(confirmation.nonce, 512)
      ) {
        throw new Error('OPERATIONAL_CONFIRMATION_REJECTED');
      }
      return sanitizeMutation(
        context.installer.apply(
          freeze(Object.assign({}, context.request, { confirmation: copy(confirmation) }))
        ),
        context
      );
    } catch (_error) {
      return denied('OPERATIONAL_COMPLETION_REJECTED');
    }
  }

  function status() {
    try {
      const context = planContext();
      const readiness = context.installer.getAppSheetCoreReadiness();
      const verification = context.installer.verify(context.request);
      const verified = Boolean(
        verification &&
        verification.ok === true &&
        verification.verified === true &&
        verification.state === 'COMPLETE'
      );
      const complete = Boolean(
        context.summary.state === 'COMPLETE' && readiness && readiness.ok === true && verified
      );
      return freeze({
        ok: true,
        state: complete ? 'COMPLETE' : 'INCOMPLETE',
        operations: context.summary.operations,
        appSheetReady: Boolean(readiness && readiness.ok === true),
        verified: verified,
        persistence: 'UNCHANGED'
      });
    } catch (_error) {
      return denied('OPERATIONAL_STATUS_REJECTED');
    }
  }

  return freeze({ preview: preview, start: start, complete: complete, status: status });
}

function aerpCreateAppsScriptOperationalInstallerController() {
  const configurationKey = 'AERP041_OPERATIONAL_CONFIG';
  const attestationKey = 'AERP041_APPSHEET_ATTESTATION_INPUT';

  function scriptProperty(key) {
    const store = PropertiesService.getScriptProperties();
    if (!store) throw new Error('OPERATIONAL_CONTROLLER_REJECTED');
    const raw = store.getProperty(key);
    if (!raw) throw new Error('OPERATIONAL_CONTROLLER_REJECTED');
    return JSON.parse(raw);
  }

  return aerpCreateOperationalInstallerController({
    readConfiguration: function () {
      return scriptProperty(configurationKey);
    },
    getTargetId: function () {
      const book = SpreadsheetApp.getActiveSpreadsheet();
      return book ? book.getId() : null;
    },
    createSecureInstaller: function (configuration) {
      return aerpCreateSecureAppsScriptInstaller(configuration);
    },
    readAppSheetAttestation: function () {
      return scriptProperty(attestationKey);
    },
    confirmPlan: function (summary) {
      return aerpConfirm(
        [
          'Se instalará Alef ERP 1.0 en esta copia aislada.',
          '',
          'Estado detectado: ' + summary.state,
          'Operaciones pendientes: ' + summary.operations,
          '',
          'La autorización se vinculará al plan, al tenant y a esta hoja.'
        ].join('\n'),
        'Confirmar instalación segura'
      );
    },
    confirmCompletion: function (summary) {
      return aerpConfirm(
        [
          'Se registrará la validación manual de AppSheet Core.',
          '',
          'Aplicación: ' + summary.appId,
          'Versión: ' + summary.appVersion,
          'Plantilla: ' + summary.templateVersion,
          'Referencia: ' + summary.deploymentCheckReference,
          'Tablas verificadas: ' + summary.tablesVerified,
          '',
          'Después se verificará nuevamente toda la instalación.'
        ].join('\n'),
        'Confirmar AppSheet Core'
      );
    }
  });
}

function aerpOperationalResultMessage_(result) {
  const source = result || {};
  return [
    'Estado: ' + (source.state || 'INCOMPLETE'),
    'Código: ' + (source.code || 'OPERATIONAL_STATUS'),
    'Persistencia: ' + (source.persistence || 'UNCHANGED'),
    'Operaciones pendientes: ' + Number(source.operations || 0),
    'Recursos creados: ' + Number(source.created || 0),
    'AppSheet listo: ' + (source.appSheetReady === true ? 'Sí' : 'No'),
    'Instalación verificada: ' + (source.verified === true ? 'Sí' : 'No')
  ].join('\n');
}

function menuAerp041SecureInstall() {
  const result = aerpCreateAppsScriptOperationalInstallerController().start();
  if (result.ok && result.state === 'COMPLETE') {
    aerpSuccess(aerpOperationalResultMessage_(result), 'Instalación segura completada');
  } else {
    aerpWarning(aerpOperationalResultMessage_(result), 'Instalación segura pendiente');
  }
  return result;
}

function menuAerp041CompleteAppSheetCore() {
  const result = aerpCreateAppsScriptOperationalInstallerController().complete();
  if (result.ok && result.state === 'COMPLETE') {
    aerpSuccess(aerpOperationalResultMessage_(result), 'Alef ERP listo');
  } else {
    aerpWarning(aerpOperationalResultMessage_(result), 'Validación pendiente');
  }
  return result;
}

function menuAerp041SecureStatus() {
  const result = aerpCreateAppsScriptOperationalInstallerController().status();
  if (result.ok) {
    aerpInfo(aerpOperationalResultMessage_(result), 'Estado de instalación segura');
  } else {
    aerpWarning(aerpOperationalResultMessage_(result), 'Estado no disponible');
  }
  return result;
}

if (typeof globalThis !== 'undefined') {
  globalThis.aerpCreateOperationalInstallerController = aerpCreateOperationalInstallerController;
  globalThis.aerpCreateAppsScriptOperationalInstallerController =
    aerpCreateAppsScriptOperationalInstallerController;
  globalThis.menuAerp041SecureInstall = menuAerp041SecureInstall;
  globalThis.menuAerp041CompleteAppSheetCore = menuAerp041CompleteAppSheetCore;
  globalThis.menuAerp041SecureStatus = menuAerp041SecureStatus;
}
