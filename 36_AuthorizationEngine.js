/**
 * ============================================================================
 * ALEF ERP
 * AERP-036 Â· AUTHORIZATION ENGINE
 * ============================================================================
 *
 * Archivo:
 *   36_AuthorizationEngine.gs
 *
 * PropÃ³sito:
 *   Evaluar si un sujeto puede ejecutar una acciÃ³n determinada sobre un
 *   recurso dentro de Alef ERP.
 *
 * Responsabilidades:
 *   - Normalizar solicitudes de autorizaciÃ³n.
 *   - Validar los datos de entrada.
 *   - Construir decisiones ALLOW o DENY.
 *   - Generar trazabilidad de cada evaluaciÃ³n.
 *   - Servir como punto de entrada Ãºnico para autorizaciÃ³n.
 *
 * Principio de seguridad:
 *   Ante cualquier error, ausencia de reglas o informaciÃ³n insuficiente,
 *   el motor debe responder DENY.
 *
 * Estado:
 *   FOUNDATION
 *
 * VersiÃ³n:
 *   1.0.0
 * ============================================================================
 */

/* ============================================================================
 * 1. CONSTANTES
 * ============================================================================
 */

const AERP_AUTHORIZATION_VERSION = '1.0.0';

const AERP_AUTHORIZATION_DECISION = Object.freeze({
  ALLOW: 'ALLOW',
  DENY: 'DENY'
});

const AERP_AUTHORIZATION_REASON = Object.freeze({
  ALLOWED_BY_RULE: 'ALLOWED_BY_RULE',
  DENIED_BY_RULE: 'DENIED_BY_RULE',
  NO_MATCHING_RULE: 'NO_MATCHING_RULE',
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_AUTHORIZATION_OPTIONS: 'INVALID_AUTHORIZATION_OPTIONS',
  INVALID_AUTHORIZATION_RULES: 'INVALID_AUTHORIZATION_RULES',
  ENGINE_ERROR: 'ENGINE_ERROR'
});

const AERP_AUTHORIZATION_PUBLIC_ERROR = Object.freeze({
  INVALID_AUTHORIZATION_OPTIONS: 'Authorization options are invalid.',
  INVALID_AUTHORIZATION_RULES: 'Authorization rules are invalid.',
  ENGINE_ERROR: 'Authorization evaluation failed.'
});

const AERP_AUTHORIZATION_CONDITION_REASON_CODE = Object.freeze({
  INVALID_CONDITION_SCHEMA: 'INVALID_CONDITION_SCHEMA',
  CONDITION_EVALUATION_ERROR: 'CONDITION_EVALUATION_ERROR'
});

const AERP_AUTHORIZATION_DEFAULTS = Object.freeze({
  defaultDecision: AERP_AUTHORIZATION_DECISION.DENY,
  traceEnabled: true,
  stopOnFirstMatch: true
});

/**
 * PolÃ­tica predeterminada del Advanced Decision Builder.
 *
 * La polÃ­tica es declarativa para permitir futuras estrategias
 * sin modificar el nÃºcleo del Authorization Engine.
 */
const AERP_AUTHORIZATION_DECISION_POLICY_DEFAULTS = Object.freeze({
  priorityStrategy: 'HIGHEST_PRIORITY',

  conflictStrategy: 'DENY_PRECEDENCE',

  tieBreaker: 'FIRST_DECLARED',

  requireExplanation: true,

  auditEnabled: true
});

/**
 * CÃ³digos estandarizados para explicar decisiones.
 */
const AERP_AUTHORIZATION_DECISION_REASON_CODE = Object.freeze({
  HIGHEST_PRIORITY: 'HIGHEST_PRIORITY',

  DENY_PRECEDENCE: 'DENY_PRECEDENCE',

  FIRST_DECLARED: 'FIRST_DECLARED',

  LOWER_PRIORITY: 'LOWER_PRIORITY',

  NO_MATCHING_RULE: 'NO_MATCHING_RULE'
});

/* ============================================================================
 * 2. PUBLIC API
 * ============================================================================
 */

/**
 * EvalÃºa una solicitud de autorizaciÃ³n.
 *
 * Este serÃ¡ el punto de entrada oficial del Authorization Engine.
 *
 * @param {Object} request Solicitud de autorizaciÃ³n.
 * @param {Object=} options Opciones de ejecuciÃ³n.
 * @return {Object} Resultado normalizado de autorizaciÃ³n.
 */
function aerpAuthorize(request, options) {
  const startedAt = new Date();
  let executionOptions = null;
  let normalizedRequest = null;
  let trace = null;

  try {
    executionOptions = aerpBuildAuthorizationOptions_(options);

    if (!executionOptions.valid) {
      trace = aerpCreateAuthorizationTrace_(null, executionOptions);

      aerpAddAuthorizationTraceStep_(trace, 'VALIDATE_OPTIONS', AERP_AUTHORIZATION_DECISION.DENY, {
        reason: AERP_AUTHORIZATION_REASON.INVALID_AUTHORIZATION_OPTIONS
      });

      return aerpBuildAuthorizationDecision_({
        decision: AERP_AUTHORIZATION_DECISION.DENY,
        reason: AERP_AUTHORIZATION_REASON.INVALID_AUTHORIZATION_OPTIONS,
        reasonCode: AERP_AUTHORIZATION_REASON.INVALID_AUTHORIZATION_OPTIONS,
        request: null,
        matchedRule: null,
        validationErrors: [AERP_AUTHORIZATION_PUBLIC_ERROR.INVALID_AUTHORIZATION_OPTIONS],
        trace: trace,
        startedAt: startedAt
      });
    }

    normalizedRequest = aerpBuildAuthorizationRequest_(request);

    trace = aerpCreateAuthorizationTrace_(normalizedRequest, executionOptions);

    const validation = aerpValidateAuthorizationRequest_(normalizedRequest);

    if (!validation.ok) {
      aerpAddAuthorizationTraceStep_(trace, 'VALIDATE_REQUEST', 'DENY', {
        errors: validation.errors
      });

      return aerpBuildAuthorizationDecision_({
        decision: AERP_AUTHORIZATION_DECISION.DENY,
        reason: AERP_AUTHORIZATION_REASON.INVALID_REQUEST,
        request: normalizedRequest,
        matchedRule: null,
        validationErrors: validation.errors,
        trace: trace,
        startedAt: startedAt
      });
    }

    aerpAddAuthorizationTraceStep_(trace, 'VALIDATE_REQUEST', 'OK', {
      message: 'Authorization request is valid.'
    });

    const ruleEvaluation = aerpEvaluateAuthorizationRules_(
      normalizedRequest,
      executionOptions.rules,
      executionOptions
    );

    if (ruleEvaluation.valid !== true) {
      aerpAddAuthorizationTraceStep_(
        trace,
        'VALIDATE_CONDITIONS',
        AERP_AUTHORIZATION_DECISION.DENY,
        {
          reasonCode: AERP_AUTHORIZATION_CONDITION_REASON_CODE.INVALID_CONDITION_SCHEMA
        }
      );

      return aerpBuildAuthorizationDecision_({
        decision: AERP_AUTHORIZATION_DECISION.DENY,
        reason: AERP_AUTHORIZATION_REASON.INVALID_AUTHORIZATION_RULES,
        reasonCode: AERP_AUTHORIZATION_CONDITION_REASON_CODE.INVALID_CONDITION_SCHEMA,
        request: normalizedRequest,
        matchedRule: null,
        decisionSummary: null,
        validationErrors: [AERP_AUTHORIZATION_PUBLIC_ERROR.INVALID_AUTHORIZATION_RULES],
        trace: trace,
        startedAt: startedAt
      });
    }

    aerpAddAuthorizationTraceStep_(
      trace,
      'EVALUATE_RULES',
      ruleEvaluation.matched ? ruleEvaluation.decision : 'NO_MATCH',
      {
        evaluatedRuleCount: ruleEvaluation.evaluatedRuleCount,

        matchingRuleCount: ruleEvaluation.matchingRuleCount,

        matchedRuleId: ruleEvaluation.matchedRule ? ruleEvaluation.matchedRule.id : null,

        reason: ruleEvaluation.reason
      }
    );
    const advancedDecision = aerpBuildAdvancedAuthorizationDecision_(
      ruleEvaluation,
      executionOptions.decisionPolicy
    );

    aerpAddAuthorizationTraceStep_(
      trace,
      'BUILD_DECISION',
      advancedDecision.matched ? advancedDecision.decision : 'NO_DECISION',
      {
        winningRuleId: advancedDecision.winningRule ? advancedDecision.winningRule.id : null,

        matchingRuleCount: advancedDecision.matchingRuleCount,

        highestPriority:
          advancedDecision.highestPriority !== undefined ? advancedDecision.highestPriority : null,

        policy: advancedDecision.policy,

        ignoredRuleCount: advancedDecision.ignoredRules.length
      }
    );

    if (advancedDecision.matched) {
      return aerpBuildAuthorizationDecision_({
        decision: advancedDecision.decision,

        reason: advancedDecision.reason,

        request: normalizedRequest,

        matchedRule: advancedDecision.winningRule,

        decisionSummary: advancedDecision,

        validationErrors: [],

        trace: trace,

        startedAt: startedAt
      });
    }

    aerpAddAuthorizationTraceStep_(trace, 'DEFAULT_DECISION', AERP_AUTHORIZATION_DECISION.DENY, {
      reason: AERP_AUTHORIZATION_REASON.NO_MATCHING_RULE
    });

    return aerpBuildAuthorizationDecision_({
      decision: AERP_AUTHORIZATION_DECISION.DENY,

      reason: AERP_AUTHORIZATION_REASON.NO_MATCHING_RULE,

      request: normalizedRequest,

      matchedRule: null,

      validationErrors: [],

      trace: trace,

      startedAt: startedAt
    });
  } catch {
    return aerpBuildEmergencyAuthorizationDeny_();
  }
}

/* ============================================================================
 * 3. AUTHORIZATION REQUEST
 * ============================================================================
 */

/**
 * Construye una solicitud normalizada.
 *
 * Estructura esperada:
 *
 * {
 *   subject: {
 *     id: 'usuario@empresa.com',
 *     type: 'USER',
 *     roles: ['VENDEDOR']
 *   },
 *   action: 'EDIT',
 *   resource: {
 *     type: 'TABLE',
 *     id: 'PEDIDOS'
 *   },
 *   context: {
 *     companyId: 'EMPRESA_001'
 *   }
 * }
 *
 * @param {Object} request Solicitud original.
 * @return {Object} Solicitud normalizada.
 */
function aerpBuildAuthorizationRequest_(request) {
  const source = request && typeof request === 'object' ? request : {};

  const subject = source.subject && typeof source.subject === 'object' ? source.subject : {};

  const resource = source.resource && typeof source.resource === 'object' ? source.resource : {};

  const context = source.context && typeof source.context === 'object' ? source.context : {};

  return {
    requestId:
      aerpNormalizeAuthorizationString_(source.requestId) || aerpBuildSafeAuthorizationUuid_(),

    subject: {
      id: aerpNormalizeAuthorizationString_(subject.id),

      type: aerpNormalizeAuthorizationString_(subject.type).toUpperCase() || 'USER',

      roles: aerpNormalizeAuthorizationRoles_(subject.roles),

      attributes:
        subject.attributes && typeof subject.attributes === 'object' ? subject.attributes : {}
    },

    action: aerpNormalizeAuthorizationString_(source.action).toUpperCase(),

    resource: {
      id: aerpNormalizeAuthorizationString_(resource.id),

      type: aerpNormalizeAuthorizationString_(resource.type).toUpperCase(),

      attributes:
        resource.attributes && typeof resource.attributes === 'object' ? resource.attributes : {}
    },

    context: context,

    requestedAt: source.requestedAt instanceof Date ? source.requestedAt : new Date()
  };
}

/* ============================================================================
 * 4. REQUEST VALIDATION
 * ============================================================================
 */

/**
 * Valida la estructura mÃ­nima de una solicitud.
 *
 * @param {Object} request Solicitud normalizada.
 * @return {{ok: boolean, errors: string[]}}
 */
function aerpValidateAuthorizationRequest_(request) {
  const errors = [];

  if (!request || typeof request !== 'object') {
    errors.push('Authorization request must be an object.');

    return {
      ok: false,
      errors: errors
    };
  }

  if (!request.subject || !request.subject.id) {
    errors.push('subject.id is required.');
  }

  if (!request.action) {
    errors.push('action is required.');
  }

  if (!request.resource || !request.resource.type) {
    errors.push('resource.type is required.');
  }

  if (!request.resource || !request.resource.id) {
    errors.push('resource.id is required.');
  }

  return {
    ok: errors.length === 0,
    errors: errors
  };
}

/* ============================================================================
 * 5. DECISION BUILDER
 * ============================================================================
 */

/**
 * Construye la respuesta estÃ¡ndar del Authorization Engine.
 *
 * @param {Object} input Datos de la decisiÃ³n.
 * @return {Object} DecisiÃ³n normalizada.
 */
function aerpBuildAuthorizationDecision_(input) {
  const source = input && typeof input === 'object' ? input : {};

  const finishedAt = new Date();

  const startedAt = source.startedAt instanceof Date ? source.startedAt : finishedAt;

  const decision =
    source.decision === AERP_AUTHORIZATION_DECISION.ALLOW
      ? AERP_AUTHORIZATION_DECISION.ALLOW
      : AERP_AUTHORIZATION_DECISION.DENY;

  return {
    ok: true,

    decisionId: aerpBuildSafeAuthorizationUuid_(),

    allowed: decision === AERP_AUTHORIZATION_DECISION.ALLOW,

    decision: decision,

    reason: source.reason || AERP_AUTHORIZATION_REASON.NO_MATCHING_RULE,

    reasonCode: source.reasonCode || null,

    requestId: source.request && source.request.requestId ? source.request.requestId : null,

    subject: source.request ? source.request.subject : null,

    action: source.request ? source.request.action : null,

    resource: source.request ? source.request.resource : null,

    matchedRule: source.matchedRule || null,

    decisionSummary: source.decisionSummary || null,

    validationErrors: Array.isArray(source.validationErrors) ? source.validationErrors : [],

    trace: source.trace || null,

    error: source.error
      ? {
          message: source.error.message || String(source.error),

          name: source.error.name || 'Error'
        }
      : null,

    engineVersion: AERP_AUTHORIZATION_VERSION,

    startedAt: startedAt.toISOString(),

    finishedAt: finishedAt.toISOString(),

    durationMs: finishedAt.getTime() - startedAt.getTime()
  };
}

/* ============================================================================
 * 6. AUTHORIZATION TRACE
 * ============================================================================
 */

/**
 * Crea el objeto de trazabilidad.
 *
 * @param {?Object} request Solicitud normalizada.
 * @param {Object} options Opciones de ejecuciÃ³n.
 * @return {Object|null} Traza o null.
 */
function aerpCreateAuthorizationTrace_(request, options) {
  if (options && options.traceEnabled === false) {
    return null;
  }

  return {
    traceId: aerpBuildSafeAuthorizationUuid_(),

    requestId: request && request.requestId ? request.requestId : null,

    createdAt: new Date().toISOString(),

    steps: []
  };
}

/**
 * Construye un identificador interno sin permitir que un fallo de UUID escape.
 * El factory opcional es exclusivamente interno y permite pruebas deterministas.
 *
 * @param {Function=} uuidFactory Factory interno opcional.
 * @return {?string}
 */
function aerpBuildSafeAuthorizationUuid_(uuidFactory) {
  try {
    const uuid =
      typeof uuidFactory === 'function'
        ? uuidFactory()
        : typeof Utilities !== 'undefined' && Utilities && typeof Utilities.getUuid === 'function'
          ? Utilities.getUuid()
          : null;

    return typeof uuid === 'string' && uuid ? uuid : null;
  } catch {
    return null;
  }
}

/**
 * Construye el DENY de emergencia sin consultar opciones, solicitudes,
 * normalizadores, trazas, builders ni dependencias externas.
 *
 * @return {Object}
 */
function aerpBuildEmergencyAuthorizationDeny_() {
  return {
    ok: false,
    status: 'AUTHORIZATION_ENGINE_ERROR',
    message: AERP_AUTHORIZATION_PUBLIC_ERROR.ENGINE_ERROR,
    decisionId: null,
    allowed: false,
    decision: AERP_AUTHORIZATION_DECISION.DENY,
    reason: AERP_AUTHORIZATION_REASON.ENGINE_ERROR,
    reasonCode: AERP_AUTHORIZATION_REASON.ENGINE_ERROR,
    requestId: null,
    subject: null,
    action: null,
    resource: null,
    matchedRule: null,
    decisionSummary: null,
    validationErrors: [],
    trace: null,
    error: {
      name: 'AuthorizationEngineError',
      message: AERP_AUTHORIZATION_PUBLIC_ERROR.ENGINE_ERROR
    },
    engineVersion: AERP_AUTHORIZATION_VERSION,
    startedAt: null,
    finishedAt: null,
    durationMs: 0
  };
}

/**
 * Agrega un paso a la traza.
 *
 * @param {?Object} trace Traza activa.
 * @param {string} stage Etapa evaluada.
 * @param {string} result Resultado de la etapa.
 * @param {Object=} details InformaciÃ³n adicional.
 */
function aerpAddAuthorizationTraceStep_(trace, stage, result, details) {
  if (!trace || !Array.isArray(trace.steps)) {
    return;
  }

  trace.steps.push({
    sequence: trace.steps.length + 1,

    stage: aerpNormalizeAuthorizationString_(stage).toUpperCase(),

    result: aerpNormalizeAuthorizationString_(result).toUpperCase(),

    details: details && typeof details === 'object' ? details : {},

    timestamp: new Date().toISOString()
  });
}

/* ============================================================================
 * 7. RULE EVALUATOR
 * ============================================================================
 */

/**
 * EvalÃºa las reglas disponibles contra una solicitud de autorizaciÃ³n.
 *
 * PolÃ­tica:
 *   - Solo se procesan reglas habilitadas y vÃ¡lidas.
 *   - Las reglas se ordenan por prioridad descendente.
 *   - Ante igual prioridad, DENY tiene precedencia sobre ALLOW.
 *   - Si ninguna regla coincide, el evaluador no decide.
 *   - La decisiÃ³n predeterminada pertenece al Authorization Engine.
 *
 * @param {Object} request Solicitud normalizada.
 * @param {Object[]} rules Reglas disponibles.
 * @param {Object} options Opciones de ejecuciÃ³n.
 * @return {Object} Resultado de evaluaciÃ³n.
 */
/**
 * EvalÃºa las reglas disponibles contra una solicitud de autorizaciÃ³n.
 *
 * Responsabilidad:
 *   - Normalizar y ordenar las reglas.
 *   - Evaluar coincidencias estructurales.
 *   - Evaluar condiciones declarativas.
 *   - Recopilar todas las reglas coincidentes.
 *
 * Durante la migraciÃ³n al Decision Builder avanzado, esta funciÃ³n conserva
 * temporalmente los campos decision y matchedRule para mantener
 * compatibilidad con las pruebas existentes.
 *
 * @param {Object} request Solicitud normalizada.
 * @param {Object[]} rules Reglas disponibles.
 * @param {Object} options Opciones de ejecuciÃ³n.
 * @return {Object} Evidencia obtenida durante la evaluaciÃ³n.
 */
function aerpEvaluateAuthorizationRules_(request, rules, _options) {
  const normalizationResult = aerpNormalizeAuthorizationRules_(rules);

  if (!normalizationResult.ok) {
    return {
      valid: false,
      matched: false,
      decision: AERP_AUTHORIZATION_DECISION.DENY,
      reason: AERP_AUTHORIZATION_REASON.INVALID_AUTHORIZATION_RULES,
      matchedRule: null,
      matchingRules: [],
      evaluatedRuleCount: 0,
      matchingRuleCount: 0
    };
  }

  const normalizedRules = normalizationResult.rules;

  const orderedRules = normalizedRules.slice().sort(aerpCompareAuthorizationRules_);

  const matchingRules = [];

  for (let index = 0; index < orderedRules.length; index += 1) {
    const rule = orderedRules[index];

    const match = aerpDoesAuthorizationRuleMatch_(rule, request);

    if (!match.ok) {
      continue;
    }

    matchingRules.push({
      rule: rule,

      match: match,

      evaluationOrder: index + 1
    });
  }

  if (matchingRules.length === 0) {
    return {
      valid: true,

      matched: false,

      decision: null,

      reason: AERP_AUTHORIZATION_REASON.NO_MATCHING_RULE,

      matchedRule: null,

      matchingRules: [],

      evaluatedRuleCount: orderedRules.length,

      matchingRuleCount: 0
    };
  }

  /*
   * Compatibilidad temporal:
   *
   * El Decision Builder avanzado todavÃ­a no estÃ¡ conectado.
   * Mientras lo construimos, se conserva la selecciÃ³n de una regla ganadora
   * utilizando la polÃ­tica actual.
   */
  const candidateRules = matchingRules.map(function (candidate) {
    return candidate.rule;
  });

  const winningRule = aerpSelectWinningAuthorizationRule_(candidateRules);

  const decision =
    winningRule.effect === AERP_AUTHORIZATION_DECISION.ALLOW
      ? AERP_AUTHORIZATION_DECISION.ALLOW
      : AERP_AUTHORIZATION_DECISION.DENY;

  return {
    valid: true,

    matched: true,

    decision: decision,

    reason:
      decision === AERP_AUTHORIZATION_DECISION.ALLOW
        ? AERP_AUTHORIZATION_REASON.ALLOWED_BY_RULE
        : AERP_AUTHORIZATION_REASON.DENIED_BY_RULE,

    matchedRule: aerpBuildPublicAuthorizationRule_(winningRule),

    matchingRules: matchingRules.map(function (candidate) {
      return {
        rule: aerpBuildPublicAuthorizationRule_(candidate.rule),

        evaluationOrder: candidate.evaluationOrder,

        checks: candidate.match.checks,

        conditionEvaluation: candidate.match.conditionEvaluation
      };
    }),

    evaluatedRuleCount: orderedRules.length,

    matchingRuleCount: matchingRules.length
  };
}

/**
 * Normaliza una colecciÃ³n de reglas.
 *
 * Formato admitido:
 *
 * {
 *   id: 'RULE_PEDIDOS_EDIT_VENDEDOR',
 *   enabled: true,
 *   effect: 'ALLOW',
 *   priority: 100,
 *   subjectTypes: ['USER'],
 *   roles: ['VENDEDOR'],
 *   actions: ['EDIT'],
 *   resourceTypes: ['TABLE'],
 *   resourceIds: ['PEDIDOS']
 * }
 *
 * El valor "*" funciona como comodÃ­n.
 *
 * @param {*} rules Reglas originales.
 * @return {{ok: boolean, rules: Object[]}} Reglas normalizadas.
 */
function aerpNormalizeAuthorizationRules_(rules) {
  /*
   * Límite de confianza:
   * las reglas productivas deben ser objetos JSON/plain construidos por el
   * backend. JavaScript no permite detectar universalmente todos los Proxies;
   * cualquier fallo durante su inspección invalida la colección y termina en
   * DENY sin propagar detalles del trap.
   */
  if (!Array.isArray(rules)) {
    return {
      ok: true,
      rules: []
    };
  }

  const normalizedRules = [];

  try {
    for (let index = 0; index < rules.length; index += 1) {
      const ruleResult = aerpNormalizeAuthorizationRule_(rules[index], index);

      if (!ruleResult.ok) {
        return {
          ok: false,
          rules: []
        };
      }

      if (ruleResult.rule) {
        normalizedRules.push(ruleResult.rule);
      }
    }
  } catch {
    return {
      ok: false,
      rules: []
    };
  }

  return {
    ok: true,
    rules: normalizedRules
  };
}

/**
 * Normaliza una regla individual.
 *
 * @param {*} rule Regla original.
 * @param {number} index PosiciÃ³n original.
 * @return {{ok: boolean, rule: ?Object}} Regla normalizada.
 */
function aerpNormalizeAuthorizationRule_(rule, index) {
  if (!rule || typeof rule !== 'object') {
    return {
      ok: true,
      rule: null
    };
  }

  if (!aerpIsPlainAuthorizationObject_(rule)) {
    return {
      ok: false,
      rule: null
    };
  }

  const effect = aerpNormalizeAuthorizationString_(rule.effect).toUpperCase();

  if (effect !== AERP_AUTHORIZATION_DECISION.ALLOW && effect !== AERP_AUTHORIZATION_DECISION.DENY) {
    return {
      ok: true,
      rule: null
    };
  }

  const priorityNumber = Number(rule.priority);

  const conditionProperty = Object.getOwnPropertyDescriptor(rule, 'conditions');

  const conditionResult = conditionProperty
    ? conditionProperty.get || conditionProperty.set
      ? {
          ok: false,
          conditions: []
        }
      : aerpNormalizeAuthorizationConditions_(conditionProperty.value)
    : {
        ok: true,
        conditions: []
      };

  if (!conditionResult.ok) {
    return {
      ok: false,
      rule: null
    };
  }

  const metadataProperty = Object.getOwnPropertyDescriptor(rule, 'metadata');

  const metadataResult = metadataProperty
    ? metadataProperty.get || metadataProperty.set
      ? {
          ok: false,
          value: null
        }
      : aerpCloneAuthorizationJsonSafe_(
          metadataProperty.value,
          AERP_AUTHORIZATION_CONDITION_LIMITS.metadataDepth
        )
    : {
        ok: true,
        value: {}
      };

  if (!metadataResult.ok || !aerpIsPlainAuthorizationObject_(metadataResult.value)) {
    return {
      ok: false,
      rule: null
    };
  }

  return {
    ok: true,
    rule: {
      id: aerpNormalizeAuthorizationString_(rule.id) || 'AUTH_RULE_' + String(index + 1),

      name: aerpNormalizeAuthorizationString_(rule.name),

      description: aerpNormalizeAuthorizationString_(rule.description),

      enabled: rule.enabled !== false,

      effect: effect,

      priority: Number.isFinite(priorityNumber) ? priorityNumber : 0,

      subjectTypes: aerpNormalizeAuthorizationRuleValues_(rule.subjectTypes || rule.subjectType),

      subjectIds: aerpNormalizeAuthorizationRuleValues_(rule.subjectIds || rule.subjectId),

      roles: aerpNormalizeAuthorizationRuleValues_(rule.roles || rule.role),

      actions: aerpNormalizeAuthorizationRuleValues_(rule.actions || rule.action),

      resourceTypes: aerpNormalizeAuthorizationRuleValues_(rule.resourceTypes || rule.resourceType),

      resourceIds: aerpNormalizeAuthorizationRuleValues_(
        rule.resourceIds || rule.resourceId || rule.resource
      ),

      conditions: conditionResult.conditions,

      metadata: metadataResult.value,

      originalIndex: index
    }
  };
}

/**
 * Normaliza un campo que puede contener uno o varios valores.
 *
 * @param {*} value Valor original.
 * @return {string[]}
 */
function aerpNormalizeAuthorizationRuleValues_(value) {
  const source = Array.isArray(value)
    ? value
    : value === null || value === undefined || value === ''
      ? []
      : [value];

  return source
    .map(function (item) {
      return aerpNormalizeAuthorizationString_(item).toUpperCase();
    })
    .filter(function (item) {
      return Boolean(item);
    });
}

/**
 * Ordena las reglas.
 *
 * Orden:
 *   1. Prioridad descendente.
 *   2. DENY antes que ALLOW.
 *   3. PosiciÃ³n original.
 *
 * @param {Object} first Primera regla.
 * @param {Object} second Segunda regla.
 * @return {number}
 */
function aerpCompareAuthorizationRules_(first, second) {
  if (first.priority !== second.priority) {
    return second.priority - first.priority;
  }

  if (first.effect !== second.effect) {
    if (first.effect === AERP_AUTHORIZATION_DECISION.DENY) {
      return -1;
    }

    return 1;
  }

  return first.originalIndex - second.originalIndex;
}

/**
 * Determina si una regla coincide con una solicitud.
 *
 * @param {Object} rule Regla normalizada.
 * @param {Object} request Solicitud normalizada.
 * @return {{ok: boolean, checks: Object}}
 */
/**
 * Determina si una regla coincide con una solicitud.
 *
 * La coincidencia requiere:
 *   - Regla habilitada.
 *   - Coincidencia de sujeto, rol, acciÃ³n y recurso.
 *   - Cumplimiento de todas las condiciones declaradas.
 *
 * @param {Object} rule Regla normalizada.
 * @param {Object} request Solicitud normalizada.
 * @return {{ok: boolean, checks: Object, conditionEvaluation: Object}}
 */
function aerpDoesAuthorizationRuleMatch_(rule, request) {
  if (!rule.enabled) {
    return {
      ok: false,

      checks: {
        enabled: false
      },

      conditionEvaluation: {
        ok: false,
        evaluatedConditionCount: 0,
        failedConditionCount: 0,
        results: []
      }
    };
  }

  const checks = {
    subjectType: aerpAuthorizationValueMatches_(request.subject.type, rule.subjectTypes, true),

    subjectId: aerpAuthorizationValueMatches_(request.subject.id, rule.subjectIds, true),

    role: aerpAuthorizationRolesMatch_(request.subject.roles, rule.roles),

    action: aerpAuthorizationValueMatches_(request.action, rule.actions, false),

    resourceType: aerpAuthorizationValueMatches_(request.resource.type, rule.resourceTypes, false),

    resourceId: aerpAuthorizationValueMatches_(request.resource.id, rule.resourceIds, false)
  };

  const structuralMatch =
    checks.subjectType &&
    checks.subjectId &&
    checks.role &&
    checks.action &&
    checks.resourceType &&
    checks.resourceId;

  if (!structuralMatch) {
    return {
      ok: false,

      checks: checks,

      conditionEvaluation: {
        ok: false,
        skipped: true,
        evaluatedConditionCount: 0,
        failedConditionCount: 0,
        results: []
      }
    };
  }

  const conditionEvaluation = aerpEvaluateAuthorizationConditions_(rule.conditions, request);

  checks.conditions = conditionEvaluation.ok;

  return {
    ok: structuralMatch && conditionEvaluation.ok,

    checks: checks,

    conditionEvaluation: conditionEvaluation
  };
}

/**
 * Compara un valor con los valores admitidos por una regla.
 *
 * Cuando allowEmptyRuleValues es true, una colecciÃ³n vacÃ­a significa
 * "sin restricciÃ³n".
 *
 * @param {*} value Valor solicitado.
 * @param {string[]} allowedValues Valores admitidos.
 * @param {boolean} allowEmptyRuleValues Permitir ausencia de restricciÃ³n.
 * @return {boolean}
 */
function aerpAuthorizationValueMatches_(value, allowedValues, allowEmptyRuleValues) {
  const normalizedValue = aerpNormalizeAuthorizationString_(value).toUpperCase();

  const values = Array.isArray(allowedValues) ? allowedValues : [];

  if (values.length === 0) {
    return allowEmptyRuleValues === true;
  }

  if (values.indexOf('*') !== -1) {
    return true;
  }

  return values.indexOf(normalizedValue) !== -1;
}

/**
 * Determina si alguno de los roles del sujeto coincide con la regla.
 *
 * Una lista de roles vacÃ­a en la regla significa que la regla no restringe
 * por rol.
 *
 * @param {string[]} subjectRoles Roles del sujeto.
 * @param {string[]} ruleRoles Roles admitidos.
 * @return {boolean}
 */
function aerpAuthorizationRolesMatch_(subjectRoles, ruleRoles) {
  const expectedRoles = Array.isArray(ruleRoles) ? ruleRoles : [];

  if (expectedRoles.length === 0 || expectedRoles.indexOf('*') !== -1) {
    return true;
  }

  const currentRoles = Array.isArray(subjectRoles) ? subjectRoles : [];

  return currentRoles.some(function (role) {
    return expectedRoles.indexOf(aerpNormalizeAuthorizationString_(role).toUpperCase()) !== -1;
  });
}

/**
 * Selecciona la regla ganadora.
 *
 * Esta funciÃ³n vuelve a ordenar las coincidencias para mantener una
 * decisiÃ³n determinista incluso cuando stopOnFirstMatch estÃ¡ desactivado.
 *
 * @param {Object[]} matchingRules Reglas coincidentes.
 * @return {Object} Regla ganadora.
 */
function aerpSelectWinningAuthorizationRule_(matchingRules) {
  return matchingRules.slice().sort(aerpCompareAuthorizationRules_)[0];
}

/**
 * Construye una representaciÃ³n pÃºblica y segura de la regla ganadora.
 *
 * @param {Object} rule Regla normalizada.
 * @return {Object}
 */
function aerpBuildPublicAuthorizationRule_(rule) {
  return {
    id: rule.id,

    name: rule.name,

    description: rule.description,

    effect: rule.effect,

    priority: rule.priority,

    subjectTypes: rule.subjectTypes.slice(),

    subjectIds: rule.subjectIds.slice(),

    roles: rule.roles.slice(),

    actions: rule.actions.slice(),

    resourceTypes: rule.resourceTypes.slice(),

    resourceIds: rule.resourceIds.slice(),

    conditions: rule.conditions.map(function (condition) {
      return {
        id: condition.id,

        path: condition.path,

        operator: condition.operator,

        value: condition.value,

        caseSensitive: condition.caseSensitive
      };
    }),

    metadata: rule.metadata
  };
}

/* ============================================================================
 * ADVANCED DECISION BUILDER
 * ============================================================================
 */

/**
 * Construye la decisiÃ³n final a partir de las reglas coincidentes.
 *
 * Responsabilidades:
 *   - Aplicar prioridad.
 *   - Resolver conflictos ALLOW / DENY.
 *   - Resolver empates.
 *   - Seleccionar la regla ganadora.
 *   - Documentar las reglas descartadas.
 *   - Explicar la decisiÃ³n final.
 *
 * El Rule Evaluator descubre evidencia.
 * El Decision Builder toma la decisiÃ³n.
 *
 * @param {Object} ruleEvaluation Resultado del Rule Evaluator.
 * @param {Object=} policy PolÃ­tica de decisiÃ³n.
 * @return {Object} DecisiÃ³n avanzada.
 */
function aerpBuildAdvancedAuthorizationDecision_(ruleEvaluation, policy) {
  const decisionPolicy = aerpBuildAuthorizationDecisionPolicy_(policy);

  const candidates =
    ruleEvaluation && Array.isArray(ruleEvaluation.matchingRules)
      ? ruleEvaluation.matchingRules.slice()
      : [];

  if (candidates.length === 0) {
    return {
      matched: false,

      decision: null,

      reason: AERP_AUTHORIZATION_REASON.NO_MATCHING_RULE,

      winningRule: null,

      ignoredRules: [],

      evaluatedRuleCount:
        ruleEvaluation && Number.isFinite(ruleEvaluation.evaluatedRuleCount)
          ? ruleEvaluation.evaluatedRuleCount
          : 0,

      matchingRuleCount: 0,

      policy: decisionPolicy,

      reasoning: [
        {
          code: AERP_AUTHORIZATION_DECISION_REASON_CODE.NO_MATCHING_RULE,

          message: 'No authorization rule matched the request.'
        }
      ]
    };
  }

  /*
   * FASE 1
   * Seleccionar Ãºnicamente las reglas con mayor prioridad.
   */
  const highestPriority = candidates.reduce(function (currentHighest, candidate) {
    const priority = candidate && candidate.rule ? Number(candidate.rule.priority) : 0;

    return Math.max(currentHighest, Number.isFinite(priority) ? priority : 0);
  }, Number.NEGATIVE_INFINITY);

  const priorityCandidates = candidates.filter(function (candidate) {
    const priority = Number(candidate.rule.priority);

    return priority === highestPriority;
  });

  /*
   * FASE 2
   * Resolver conflictos ALLOW / DENY.
   *
   * PolÃ­tica inicial:
   * Ante igual prioridad, DENY tiene precedencia.
   */
  let conflictCandidates = priorityCandidates.slice();

  if (decisionPolicy.conflictStrategy === 'DENY_PRECEDENCE') {
    const denyCandidates = priorityCandidates.filter(function (candidate) {
      return candidate.rule.effect === AERP_AUTHORIZATION_DECISION.DENY;
    });

    if (denyCandidates.length > 0) {
      conflictCandidates = denyCandidates;
    }
  }

  /*
   * FASE 3
   * Resolver empate final.
   *
   * PolÃ­tica inicial:
   * Gana la primera regla declarada.
   */
  conflictCandidates.sort(function (first, second) {
    return Number(first.evaluationOrder) - Number(second.evaluationOrder);
  });

  const winner = conflictCandidates[0];

  const winningRule = winner.rule;

  const decision =
    winningRule.effect === AERP_AUTHORIZATION_DECISION.ALLOW
      ? AERP_AUTHORIZATION_DECISION.ALLOW
      : AERP_AUTHORIZATION_DECISION.DENY;

  const ignoredRules = candidates
    .filter(function (candidate) {
      return candidate !== winner;
    })
    .map(function (candidate) {
      return aerpExplainIgnoredAuthorizationRule_(candidate, winner);
    });

  const reasoning = [];

  reasoning.push({
    code: AERP_AUTHORIZATION_DECISION_REASON_CODE.HIGHEST_PRIORITY,

    message: 'Winning rule belongs to the highest priority group.',

    priority: highestPriority
  });

  if (priorityCandidates.length > 1 && decision === AERP_AUTHORIZATION_DECISION.DENY) {
    reasoning.push({
      code: AERP_AUTHORIZATION_DECISION_REASON_CODE.DENY_PRECEDENCE,

      message: 'DENY precedence was applied among rules with equal priority.'
    });
  }

  if (conflictCandidates.length > 1) {
    reasoning.push({
      code: AERP_AUTHORIZATION_DECISION_REASON_CODE.FIRST_DECLARED,

      message: 'FIRST_DECLARED tie breaker selected the winning rule.'
    });
  }

  return {
    matched: true,

    decision: decision,

    reason:
      decision === AERP_AUTHORIZATION_DECISION.ALLOW
        ? AERP_AUTHORIZATION_REASON.ALLOWED_BY_RULE
        : AERP_AUTHORIZATION_REASON.DENIED_BY_RULE,

    winningRule: winningRule,

    ignoredRules: ignoredRules,

    evaluatedRuleCount: ruleEvaluation.evaluatedRuleCount,

    matchingRuleCount: candidates.length,

    highestPriority: highestPriority,

    policy: decisionPolicy,

    reasoning: reasoning
  };
}

/**
 * Normaliza la polÃ­tica del Decision Builder.
 *
 * Actualmente se soporta:
 *   - HIGHEST_PRIORITY
 *   - DENY_PRECEDENCE
 *   - FIRST_DECLARED
 *
 * @param {Object=} policy PolÃ­tica recibida.
 * @return {Object} PolÃ­tica normalizada.
 */
function aerpBuildAuthorizationDecisionPolicy_(policy) {
  const source = policy && typeof policy === 'object' ? policy : {};

  return {
    priorityStrategy:
      source.priorityStrategy === 'HIGHEST_PRIORITY'
        ? 'HIGHEST_PRIORITY'
        : AERP_AUTHORIZATION_DECISION_POLICY_DEFAULTS.priorityStrategy,

    conflictStrategy:
      source.conflictStrategy === 'DENY_PRECEDENCE'
        ? 'DENY_PRECEDENCE'
        : AERP_AUTHORIZATION_DECISION_POLICY_DEFAULTS.conflictStrategy,

    tieBreaker:
      source.tieBreaker === 'FIRST_DECLARED'
        ? 'FIRST_DECLARED'
        : AERP_AUTHORIZATION_DECISION_POLICY_DEFAULTS.tieBreaker,

    requireExplanation: source.requireExplanation !== false,

    auditEnabled: source.auditEnabled !== false
  };
}

/**
 * Explica por quÃ© una regla coincidente no resultÃ³ ganadora.
 *
 * @param {Object} candidate Regla descartada.
 * @param {Object} winner Regla ganadora.
 * @return {Object}
 */
function aerpExplainIgnoredAuthorizationRule_(candidate, winner) {
  const candidateRule = candidate.rule;

  const winningRule = winner.rule;

  let reasonCode = AERP_AUTHORIZATION_DECISION_REASON_CODE.FIRST_DECLARED;

  let reason = 'Another rule won through the configured tie breaker.';

  if (Number(candidateRule.priority) < Number(winningRule.priority)) {
    reasonCode = AERP_AUTHORIZATION_DECISION_REASON_CODE.LOWER_PRIORITY;

    reason = 'Rule was ignored because it has lower priority than the winning rule.';
  } else if (
    candidateRule.effect !== winningRule.effect &&
    winningRule.effect === AERP_AUTHORIZATION_DECISION.DENY
  ) {
    reasonCode = AERP_AUTHORIZATION_DECISION_REASON_CODE.DENY_PRECEDENCE;

    reason = 'Rule was ignored because DENY has precedence at equal priority.';
  }

  return {
    ruleId: candidateRule.id,

    effect: candidateRule.effect,

    priority: candidateRule.priority,

    reasonCode: reasonCode,

    reason: reason
  };
}
/* ============================================================================
 * 8. CONDITION EVALUATOR
 * ============================================================================
 */

/**
 * Operadores admitidos por el Condition Evaluator.
 */
const AERP_AUTHORIZATION_CONDITION_OPERATOR = Object.freeze({
  EQ: 'EQ',
  NEQ: 'NEQ',
  IN: 'IN',
  NOT_IN: 'NOT_IN',
  GT: 'GT',
  GTE: 'GTE',
  LT: 'LT',
  LTE: 'LTE',
  EXISTS: 'EXISTS',
  NOT_EXISTS: 'NOT_EXISTS',
  CONTAINS: 'CONTAINS',
  STARTS_WITH: 'STARTS_WITH',
  ENDS_WITH: 'ENDS_WITH'
});

const AERP_AUTHORIZATION_CONDITION_FIELDS = Object.freeze([
  'id',
  'enabled',
  'path',
  'operator',
  'value',
  'caseSensitive',
  'metadata'
]);

const AERP_AUTHORIZATION_CONDITION_FORBIDDEN_PATH_SEGMENTS = Object.freeze([
  '__proto__',
  'prototype',
  'constructor'
]);

const AERP_AUTHORIZATION_CONDITION_LIMITS = Object.freeze({
  pathLength: 256,
  pathDepth: 8,
  metadataDepth: 8
});

/**
 * Normaliza una colecciÃ³n de condiciones.
 *
 * Formato:
 *
 * {
 *   id: 'COND_PEDIDO_BORRADOR',
 *   path: 'resource.attributes.status',
 *   operator: 'EQ',
 *   value: 'BORRADOR',
 *   enabled: true
 * }
 *
 * @param {*} conditions Condiciones originales.
 * @return {{ok: boolean, conditions: Object[]}} Condiciones normalizadas.
 */
function aerpNormalizeAuthorizationConditions_(conditions) {
  if (!Array.isArray(conditions) || Object.getPrototypeOf(conditions) !== Array.prototype) {
    return {
      ok: false,
      conditions: []
    };
  }

  const normalizedConditions = [];

  try {
    const descriptors = Object.getOwnPropertyDescriptors(conditions);
    const keys = Object.keys(descriptors).filter(function (key) {
      return key !== 'length';
    });

    if (
      keys.length !== conditions.length ||
      Object.getOwnPropertySymbols(conditions).length > 0 ||
      keys.some(function (key) {
        return !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= conditions.length;
      }) ||
      keys.some(function (key) {
        return descriptors[key].get || descriptors[key].set;
      })
    ) {
      return {
        ok: false,
        conditions: []
      };
    }

    for (let index = 0; index < conditions.length; index += 1) {
      const conditionResult = aerpNormalizeAuthorizationCondition_(
        descriptors[String(index)].value,
        index
      );

      if (!conditionResult.ok) {
        return {
          ok: false,
          conditions: []
        };
      }

      normalizedConditions.push(conditionResult.condition);
    }
  } catch {
    return {
      ok: false,
      conditions: []
    };
  }

  return {
    ok: true,
    conditions: normalizedConditions
  };
}

/**
 * Normaliza una condiciÃ³n individual.
 *
 * @param {*} condition CondiciÃ³n original.
 * @param {number} index PosiciÃ³n original.
 * @return {{ok: boolean, condition: ?Object}}
 */
function aerpNormalizeAuthorizationCondition_(condition, index) {
  if (!aerpIsPlainAuthorizationObject_(condition)) {
    return {
      ok: false,
      condition: null
    };
  }

  const descriptors = Object.getOwnPropertyDescriptors(condition);
  const fields = Object.keys(descriptors);

  if (
    Object.getOwnPropertySymbols(condition).length > 0 ||
    fields.some(function (field) {
      return AERP_AUTHORIZATION_CONDITION_FIELDS.indexOf(field) === -1;
    }) ||
    fields.some(function (field) {
      return descriptors[field].get || descriptors[field].set;
    })
  ) {
    return {
      ok: false,
      condition: null
    };
  }

  const pathDescriptor = descriptors.path;
  const operatorDescriptor = descriptors.operator;

  if (
    !pathDescriptor ||
    typeof pathDescriptor.value !== 'string' ||
    !aerpIsValidAuthorizationConditionPath_(pathDescriptor.value)
  ) {
    return {
      ok: false,
      condition: null
    };
  }

  if (
    !operatorDescriptor ||
    typeof operatorDescriptor.value !== 'string' ||
    !aerpIsSupportedAuthorizationConditionOperator_(operatorDescriptor.value)
  ) {
    return {
      ok: false,
      condition: null
    };
  }

  const operator = operatorDescriptor.value;

  if (descriptors.enabled && typeof descriptors.enabled.value !== 'boolean') {
    return {
      ok: false,
      condition: null
    };
  }

  if (descriptors.caseSensitive && typeof descriptors.caseSensitive.value !== 'boolean') {
    return {
      ok: false,
      condition: null
    };
  }

  const hasValue = Boolean(descriptors.value);

  if (!aerpIsValidAuthorizationConditionExpectedValue_(operator, hasValue, descriptors.value)) {
    return {
      ok: false,
      condition: null
    };
  }

  if (
    descriptors.caseSensitive &&
    !aerpAuthorizationConditionSupportsCaseSensitivity_(operator, hasValue, descriptors.value)
  ) {
    return {
      ok: false,
      condition: null
    };
  }

  const metadataResult = descriptors.metadata
    ? aerpCloneAuthorizationJsonSafe_(
        descriptors.metadata.value,
        AERP_AUTHORIZATION_CONDITION_LIMITS.metadataDepth
      )
    : {
        ok: true,
        value: {}
      };

  if (!metadataResult.ok || !aerpIsPlainAuthorizationObject_(metadataResult.value)) {
    return {
      ok: false,
      condition: null
    };
  }

  const id = descriptors.id ? descriptors.id.value : '';

  if (descriptors.id && (typeof id !== 'string' || !id.trim())) {
    return {
      ok: false,
      condition: null
    };
  }

  return {
    ok: true,
    condition: {
      id: id ? id.trim() : 'AUTH_CONDITION_' + String(index + 1),

      enabled: descriptors.enabled ? descriptors.enabled.value : true,

      path: pathDescriptor.value,

      operator: operator,

      value: hasValue ? descriptors.value.value : undefined,

      caseSensitive: descriptors.caseSensitive ? descriptors.caseSensitive.value : false,

      metadata: metadataResult.value,

      originalIndex: index
    }
  };
}

/**
 * Verifica si un operador estÃ¡ soportado.
 *
 * @param {string} operator Operador normalizado.
 * @return {boolean}
 */
function aerpIsSupportedAuthorizationConditionOperator_(operator) {
  return Object.prototype.hasOwnProperty.call(AERP_AUTHORIZATION_CONDITION_OPERATOR, operator);
}

/**
 * Indica si un operador admite comparación textual configurable.
 *
 * @param {string} operator Operador.
 * @param {boolean} hasValue Presencia explícita de value.
 * @param {Object=} valueDescriptor Descriptor de value.
 * @return {boolean}
 */
function aerpAuthorizationConditionSupportsCaseSensitivity_(operator, hasValue, valueDescriptor) {
  if (!hasValue || !valueDescriptor) {
    return false;
  }

  const value = valueDescriptor.value;

  if (
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.EQ ||
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.NEQ ||
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.CONTAINS ||
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.STARTS_WITH ||
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.ENDS_WITH
  ) {
    return typeof value === 'string';
  }

  if (
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.IN ||
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.NOT_IN
  ) {
    return aerpIsHomogeneousAuthorizationConditionArray_(value) && typeof value[0] === 'string';
  }

  return false;
}

/**
 * Valida el valor esperado según la matriz cerrada de operadores.
 *
 * @param {string} operator Operador.
 * @param {boolean} hasValue Presencia explícita de value.
 * @param {Object=} valueDescriptor Descriptor de value.
 * @return {boolean}
 */
function aerpIsValidAuthorizationConditionExpectedValue_(operator, hasValue, valueDescriptor) {
  if (
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.EXISTS ||
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.NOT_EXISTS
  ) {
    return !hasValue;
  }

  if (!hasValue) {
    return false;
  }

  const value = valueDescriptor.value;

  if (
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.EQ ||
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.NEQ
  ) {
    return aerpIsAuthorizationConditionScalar_(value, true);
  }

  if (
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.IN ||
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.NOT_IN
  ) {
    return aerpIsHomogeneousAuthorizationConditionArray_(value);
  }

  if (
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.GT ||
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.GTE ||
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.LT ||
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.LTE
  ) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  if (operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.CONTAINS) {
    return aerpIsAuthorizationConditionScalar_(value, false);
  }

  if (
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.STARTS_WITH ||
    operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.ENDS_WITH
  ) {
    return typeof value === 'string' && value.length > 0;
  }

  return false;
}

/**
 * Valida un escalar declarativo sin coerción.
 *
 * @param {*} value Valor.
 * @param {boolean} allowNull Permitir null.
 * @return {boolean}
 */
function aerpIsAuthorizationConditionScalar_(value, allowNull) {
  if (value === null) {
    return allowNull === true;
  }

  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

/**
 * Valida un array no vacío, homogéneo y escalar.
 *
 * @param {*} value Valor.
 * @return {boolean}
 */
function aerpIsHomogeneousAuthorizationConditionArray_(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    return false;
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).filter(function (key) {
    return key !== 'length';
  });

  if (
    value.length === 0 ||
    keys.length !== value.length ||
    Object.getOwnPropertySymbols(value).length > 0 ||
    keys.some(function (key) {
      return !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length;
    }) ||
    keys.some(function (key) {
      return descriptors[key].get || descriptors[key].set;
    })
  ) {
    return false;
  }

  const items = keys
    .map(function (key) {
      return {
        index: Number(key),
        value: descriptors[key].value
      };
    })
    .sort(function (first, second) {
      return first.index - second.index;
    })
    .map(function (item) {
      return item.value;
    });

  const expectedType = typeof items[0];

  if (!aerpIsAuthorizationConditionScalar_(items[0], false)) {
    return false;
  }

  return items.every(function (item) {
    return typeof item === expectedType && aerpIsAuthorizationConditionScalar_(item, false);
  });
}

/**
 * Comprueba que un valor sea un objeto plano sin prototipo personalizado.
 *
 * @param {*} value Valor.
 * @return {boolean}
 */
function aerpIsPlainAuthorizationObject_(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

/**
 * Clona metadata declarativa JSON-safe sin ejecutar accessors.
 *
 * @param {*} value Valor.
 * @param {number} remainingDepth Profundidad restante.
 * @return {{ok: boolean, value: *}}
 */
function aerpCloneAuthorizationJsonSafe_(value, remainingDepth) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return {
      ok: true,
      value: value
    };
  }

  if (typeof value === 'number') {
    return {
      ok: Number.isFinite(value),
      value: Number.isFinite(value) ? value : null
    };
  }

  if (!Number.isInteger(remainingDepth) || remainingDepth <= 0 || !value) {
    return {
      ok: false,
      value: null
    };
  }

  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      return {
        ok: false,
        value: null
      };
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors).filter(function (key) {
      return key !== 'length';
    });

    if (
      keys.length !== value.length ||
      Object.getOwnPropertySymbols(value).length > 0 ||
      keys.some(function (key) {
        return !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length;
      }) ||
      keys.some(function (key) {
        return descriptors[key].get || descriptors[key].set;
      })
    ) {
      return {
        ok: false,
        value: null
      };
    }

    const clone = [];

    for (let index = 0; index < value.length; index += 1) {
      const itemResult = aerpCloneAuthorizationJsonSafe_(
        descriptors[String(index)].value,
        remainingDepth - 1
      );

      if (!itemResult.ok) {
        return {
          ok: false,
          value: null
        };
      }

      clone.push(itemResult.value);
    }

    return {
      ok: true,
      value: clone
    };
  }

  if (!aerpIsPlainAuthorizationObject_(value)) {
    return {
      ok: false,
      value: null
    };
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);

  if (
    Object.getOwnPropertySymbols(value).length > 0 ||
    keys.some(function (key) {
      return descriptors[key].get || descriptors[key].set;
    }) ||
    keys.some(function (key) {
      return AERP_AUTHORIZATION_CONDITION_FORBIDDEN_PATH_SEGMENTS.indexOf(key) !== -1;
    })
  ) {
    return {
      ok: false,
      value: null
    };
  }

  const clone = {};

  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    const propertyResult = aerpCloneAuthorizationJsonSafe_(
      descriptors[key].value,
      remainingDepth - 1
    );

    if (!propertyResult.ok) {
      return {
        ok: false,
        value: null
      };
    }

    clone[key] = propertyResult.value;
  }

  return {
    ok: true,
    value: clone
  };
}

/**
 * Valida una ruta declarativa contra raíces y segmentos cerrados.
 *
 * @param {*} path Ruta.
 * @return {boolean}
 */
function aerpIsValidAuthorizationConditionPath_(path) {
  if (
    typeof path !== 'string' ||
    !path ||
    path !== path.trim() ||
    path.length > AERP_AUTHORIZATION_CONDITION_LIMITS.pathLength
  ) {
    return false;
  }

  const segments = path.split('.');

  if (
    segments.length === 0 ||
    segments.length > AERP_AUTHORIZATION_CONDITION_LIMITS.pathDepth ||
    segments.some(function (segment) {
      return (
        !/^[A-Za-z][A-Za-z0-9_]*$/.test(segment) ||
        AERP_AUTHORIZATION_CONDITION_FORBIDDEN_PATH_SEGMENTS.indexOf(segment) !== -1
      );
    })
  ) {
    return false;
  }

  if (segments.length === 1) {
    return segments[0] === 'action';
  }

  if (segments[0] === 'context') {
    return segments.length >= 2;
  }

  if (segments[0] === 'subject') {
    return (
      (segments.length === 2 && ['id', 'type', 'roles'].indexOf(segments[1]) !== -1) ||
      (segments[1] === 'attributes' && segments.length >= 3)
    );
  }

  if (segments[0] === 'resource') {
    return (
      (segments.length === 2 && ['id', 'type'].indexOf(segments[1]) !== -1) ||
      (segments[1] === 'attributes' && segments.length >= 3)
    );
  }

  return false;
}

/**
 * EvalÃºa todas las condiciones de una regla.
 *
 * PolÃ­tica inicial:
 *   - Todas las condiciones habilitadas deben cumplirse.
 *   - Una regla sin condiciones se considera vÃ¡lida.
 *   - Una ruta inexistente no genera error del motor.
 *   - Los errores de evaluaciÃ³n producen condiciÃ³n fallida.
 *
 * @param {Object[]} conditions Condiciones normalizadas.
 * @param {Object} request Solicitud normalizada.
 * @return {Object} Resultado de evaluaciÃ³n.
 */
function aerpEvaluateAuthorizationConditions_(conditions, request) {
  const activeConditions = Array.isArray(conditions)
    ? conditions.filter(function (condition) {
        return condition.enabled !== false;
      })
    : [];

  if (activeConditions.length === 0) {
    return {
      ok: true,
      evaluatedConditionCount: 0,
      passedConditionCount: 0,
      failedConditionCount: 0,
      results: []
    };
  }

  const results = activeConditions.map(function (condition) {
    return aerpEvaluateAuthorizationCondition_(condition, request);
  });

  const failedResults = results.filter(function (result) {
    return result.ok !== true;
  });

  return {
    ok: failedResults.length === 0,

    evaluatedConditionCount: results.length,

    passedConditionCount: results.length - failedResults.length,

    failedConditionCount: failedResults.length,

    results: results
  };
}

/**
 * EvalÃºa una condiciÃ³n individual.
 *
 * @param {Object} condition CondiciÃ³n normalizada.
 * @param {Object} request Solicitud normalizada.
 * @return {Object}
 */
function aerpEvaluateAuthorizationCondition_(condition, request) {
  try {
    const resolution = aerpResolveAuthorizationPath_(request, condition.path);

    if (!resolution.ok) {
      return {
        ok: false,
        pathExists: false,
        errorCode: AERP_AUTHORIZATION_CONDITION_REASON_CODE.CONDITION_EVALUATION_ERROR
      };
    }

    const actualValue = resolution.value;

    const expectedValue = condition.value;

    if (
      !resolution.exists &&
      condition.operator !== AERP_AUTHORIZATION_CONDITION_OPERATOR.EXISTS &&
      condition.operator !== AERP_AUTHORIZATION_CONDITION_OPERATOR.NOT_EXISTS
    ) {
      return {
        ok: false,
        pathExists: false,
        errorCode: null
      };
    }

    const result = aerpApplyAuthorizationConditionOperator_(
      condition.operator,
      actualValue,
      expectedValue,
      {
        exists: resolution.exists,

        caseSensitive: condition.caseSensitive
      }
    );

    return {
      ok: result === true,
      pathExists: resolution.exists,
      errorCode: null
    };
  } catch {
    return {
      ok: false,
      pathExists: false,
      errorCode: AERP_AUTHORIZATION_CONDITION_REASON_CODE.CONDITION_EVALUATION_ERROR
    };
  }
}

/**
 * Resuelve una ruta declarativa dentro de la solicitud.
 *
 * Ejemplos:
 *   context.companyId
 *   resource.attributes.status
 *   resource.attributes.total
 *   subject.attributes.departmentId
 *
 * No admite funciones, Ã­ndices ejecutables ni expresiones.
 *
 * @param {Object} source Objeto raÃ­z.
 * @param {string} path Ruta separada por puntos.
 * @return {{exists: boolean, value: *}}
 */
function aerpResolveAuthorizationPath_(source, path) {
  if (!aerpIsValidAuthorizationConditionPath_(path)) {
    return {
      ok: false,
      exists: false,
      value: undefined
    };
  }

  const segments = path.split('.');

  let current = source;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];

    if (current === null || current === undefined || typeof current !== 'object') {
      return {
        ok: true,
        exists: false,
        value: undefined
      };
    }

    const descriptor = Object.getOwnPropertyDescriptor(current, segment);

    if (!descriptor) {
      return {
        ok: true,
        exists: false,
        value: undefined
      };
    }

    if (descriptor.get || descriptor.set) {
      return {
        ok: false,
        exists: false,
        value: undefined
      };
    }

    current = descriptor.value;
  }

  return {
    ok: true,
    exists: true,
    value: current
  };
}

/**
 * Aplica un operador a dos valores.
 *
 * @param {string} operator Operador.
 * @param {*} actualValue Valor real.
 * @param {*} expectedValue Valor esperado.
 * @param {Object} options Opciones de comparaciÃ³n.
 * @return {boolean}
 */
function aerpApplyAuthorizationConditionOperator_(operator, actualValue, expectedValue, options) {
  const comparisonOptions = options && typeof options === 'object' ? options : {};

  const exists = comparisonOptions.exists === true;

  if (
    (operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.EQ ||
      operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.NEQ) &&
    (!aerpIsAuthorizationConditionScalar_(actualValue, true) ||
      typeof actualValue !== typeof expectedValue)
  ) {
    return false;
  }

  if (
    (operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.IN ||
      operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.NOT_IN) &&
    (!aerpIsAuthorizationConditionScalar_(actualValue, false) ||
      !aerpIsHomogeneousAuthorizationConditionArray_(expectedValue) ||
      typeof actualValue !== typeof expectedValue[0])
  ) {
    return false;
  }

  if (
    (operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.GT ||
      operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.GTE ||
      operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.LT ||
      operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.LTE) &&
    (typeof actualValue !== 'number' ||
      typeof expectedValue !== 'number' ||
      !Number.isFinite(actualValue) ||
      !Number.isFinite(expectedValue))
  ) {
    return false;
  }

  if (
    (operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.STARTS_WITH ||
      operator === AERP_AUTHORIZATION_CONDITION_OPERATOR.ENDS_WITH) &&
    (typeof actualValue !== 'string' || typeof expectedValue !== 'string')
  ) {
    return false;
  }

  switch (operator) {
    case AERP_AUTHORIZATION_CONDITION_OPERATOR.EXISTS:
      return exists;

    case AERP_AUTHORIZATION_CONDITION_OPERATOR.NOT_EXISTS:
      return !exists;

    case AERP_AUTHORIZATION_CONDITION_OPERATOR.EQ:
      return aerpAuthorizationValuesEqual_(
        actualValue,
        expectedValue,
        comparisonOptions.caseSensitive
      );

    case AERP_AUTHORIZATION_CONDITION_OPERATOR.NEQ:
      return !aerpAuthorizationValuesEqual_(
        actualValue,
        expectedValue,
        comparisonOptions.caseSensitive
      );

    case AERP_AUTHORIZATION_CONDITION_OPERATOR.IN:
      return aerpAuthorizationValueInCollection_(
        actualValue,
        expectedValue,
        comparisonOptions.caseSensitive
      );

    case AERP_AUTHORIZATION_CONDITION_OPERATOR.NOT_IN:
      return !aerpAuthorizationValueInCollection_(
        actualValue,
        expectedValue,
        comparisonOptions.caseSensitive
      );

    case AERP_AUTHORIZATION_CONDITION_OPERATOR.GT:
      return aerpCompareAuthorizationNumbers_(
        actualValue,
        expectedValue,
        function (actual, expected) {
          return actual > expected;
        }
      );

    case AERP_AUTHORIZATION_CONDITION_OPERATOR.GTE:
      return aerpCompareAuthorizationNumbers_(
        actualValue,
        expectedValue,
        function (actual, expected) {
          return actual >= expected;
        }
      );

    case AERP_AUTHORIZATION_CONDITION_OPERATOR.LT:
      return aerpCompareAuthorizationNumbers_(
        actualValue,
        expectedValue,
        function (actual, expected) {
          return actual < expected;
        }
      );

    case AERP_AUTHORIZATION_CONDITION_OPERATOR.LTE:
      return aerpCompareAuthorizationNumbers_(
        actualValue,
        expectedValue,
        function (actual, expected) {
          return actual <= expected;
        }
      );

    case AERP_AUTHORIZATION_CONDITION_OPERATOR.CONTAINS:
      return aerpAuthorizationValueContains_(
        actualValue,
        expectedValue,
        comparisonOptions.caseSensitive
      );

    case AERP_AUTHORIZATION_CONDITION_OPERATOR.STARTS_WITH:
      return aerpAuthorizationStringStartsWith_(
        actualValue,
        expectedValue,
        comparisonOptions.caseSensitive
      );

    case AERP_AUTHORIZATION_CONDITION_OPERATOR.ENDS_WITH:
      return aerpAuthorizationStringEndsWith_(
        actualValue,
        expectedValue,
        comparisonOptions.caseSensitive
      );

    default:
      return false;
  }
}

/**
 * Compara valores escalares.
 *
 * Los textos son insensibles a mayÃºsculas por defecto.
 *
 * @param {*} actualValue Valor real.
 * @param {*} expectedValue Valor esperado.
 * @param {boolean} caseSensitive ComparaciÃ³n sensible a mayÃºsculas.
 * @return {boolean}
 */
function aerpAuthorizationValuesEqual_(actualValue, expectedValue, caseSensitive) {
  if (typeof actualValue !== typeof expectedValue) {
    return false;
  }

  if (typeof actualValue === 'string') {
    let actualText = actualValue;

    let expectedText = expectedValue;

    if (caseSensitive !== true) {
      actualText = actualText.toUpperCase();

      expectedText = expectedText.toUpperCase();
    }

    return actualText === expectedText;
  }

  return actualValue === expectedValue;
}

/**
 * Comprueba si un valor estÃ¡ incluido en una colecciÃ³n.
 *
 * @param {*} actualValue Valor real.
 * @param {*} expectedValue ColecciÃ³n esperada.
 * @param {boolean} caseSensitive ComparaciÃ³n sensible a mayÃºsculas.
 * @return {boolean}
 */
function aerpAuthorizationValueInCollection_(actualValue, expectedValue, caseSensitive) {
  if (!Array.isArray(expectedValue)) {
    return false;
  }

  return expectedValue.some(function (item) {
    return aerpAuthorizationValuesEqual_(actualValue, item, caseSensitive);
  });
}

/**
 * Realiza una comparaciÃ³n numÃ©rica segura.
 *
 * @param {*} actualValue Valor real.
 * @param {*} expectedValue Valor esperado.
 * @param {Function} comparator Comparador.
 * @return {boolean}
 */
function aerpCompareAuthorizationNumbers_(actualValue, expectedValue, comparator) {
  if (
    typeof actualValue !== 'number' ||
    typeof expectedValue !== 'number' ||
    !Number.isFinite(actualValue) ||
    !Number.isFinite(expectedValue)
  ) {
    return false;
  }

  return comparator(actualValue, expectedValue);
}

/**
 * Comprueba si un valor contiene otro.
 *
 * Admite:
 *   - Texto dentro de texto.
 *   - Elemento dentro de arreglo.
 *
 * @param {*} actualValue Valor real.
 * @param {*} expectedValue Valor buscado.
 * @param {boolean} caseSensitive ComparaciÃ³n sensible a mayÃºsculas.
 * @return {boolean}
 */
function aerpAuthorizationValueContains_(actualValue, expectedValue, caseSensitive) {
  if (Array.isArray(actualValue)) {
    if (!aerpIsHomogeneousAuthorizationConditionArray_(actualValue)) {
      return false;
    }

    return actualValue.some(function (item) {
      return aerpAuthorizationValuesEqual_(item, expectedValue, caseSensitive);
    });
  }

  if (typeof actualValue !== 'string' || typeof expectedValue !== 'string') {
    return false;
  }

  let actualText = actualValue;

  let expectedText = expectedValue;

  if (caseSensitive !== true) {
    actualText = actualText.toUpperCase();

    expectedText = expectedText.toUpperCase();
  }

  return actualText.indexOf(expectedText) !== -1;
}

/**
 * Comprueba el inicio de un texto.
 *
 * @param {*} actualValue Valor real.
 * @param {*} expectedValue Prefijo esperado.
 * @param {boolean} caseSensitive ComparaciÃ³n sensible a mayÃºsculas.
 * @return {boolean}
 */
function aerpAuthorizationStringStartsWith_(actualValue, expectedValue, caseSensitive) {
  if (typeof actualValue !== 'string' || typeof expectedValue !== 'string') {
    return false;
  }

  let actualText = actualValue;

  let expectedText = expectedValue;

  if (caseSensitive !== true) {
    actualText = actualText.toUpperCase();

    expectedText = expectedText.toUpperCase();
  }

  return actualText.indexOf(expectedText) === 0;
}

/**
 * Comprueba el final de un texto.
 *
 * @param {*} actualValue Valor real.
 * @param {*} expectedValue Sufijo esperado.
 * @param {boolean} caseSensitive ComparaciÃ³n sensible a mayÃºsculas.
 * @return {boolean}
 */
function aerpAuthorizationStringEndsWith_(actualValue, expectedValue, caseSensitive) {
  if (typeof actualValue !== 'string' || typeof expectedValue !== 'string') {
    return false;
  }

  let actualText = actualValue;

  let expectedText = expectedValue;

  if (caseSensitive !== true) {
    actualText = actualText.toUpperCase();

    expectedText = expectedText.toUpperCase();
  }

  return actualText.slice(actualText.length - expectedText.length) === expectedText;
}

/* ============================================================================
 * 9. OPTIONS
 * ============================================================================
 */

/**
 * Normaliza las opciones de ejecuciÃ³n.
 *
 * @param {Object=} options Opciones recibidas.
 * @return {Object}
 */
function aerpBuildAuthorizationOptions_(options) {
  const source = options && typeof options === 'object' ? options : {};

  const hasDefaultDecision = Object.prototype.hasOwnProperty.call(source, 'defaultDecision');

  const defaultDecisionIsValid =
    !hasDefaultDecision || source.defaultDecision === AERP_AUTHORIZATION_DECISION.DENY;

  return {
    valid: defaultDecisionIsValid,

    defaultDecision: AERP_AUTHORIZATION_DECISION.DENY,

    traceEnabled: source.traceEnabled !== false,

    stopOnFirstMatch: source.stopOnFirstMatch !== false,

    rules: Array.isArray(source.rules) ? source.rules : [],
    decisionPolicy: aerpBuildAuthorizationDecisionPolicy_(source.decisionPolicy)
  };
}

/**
 * Construye opciones internas seguras sin consultar datos del llamador.
 *
 * @return {Object}
 */
/* ============================================================================
 * 10. NORMALIZATION HELPERS
 * ============================================================================
 */

/**
 * Convierte un valor en texto limpio.
 *
 * @param {*} value Valor recibido.
 * @return {string}
 */
function aerpNormalizeAuthorizationString_(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

/**
 * Normaliza la lista de roles.
 *
 * @param {*} roles Roles recibidos.
 * @return {string[]}
 */
function aerpNormalizeAuthorizationRoles_(roles) {
  if (!Array.isArray(roles)) {
    return [];
  }

  return roles
    .map(function (role) {
      return aerpNormalizeAuthorizationString_(role).toUpperCase();
    })
    .filter(function (role) {
      return Boolean(role);
    });
}

/* ============================================================================
 * 11. FOUNDATION TEST
 * ============================================================================
 */

/**
 * Prueba inicial del Authorization Engine.
 *
 * Resultado esperado:
 *   - La solicitud serÃ¡ vÃ¡lida.
 *   - La decisiÃ³n serÃ¡ DENY.
 *   - La razÃ³n serÃ¡ NO_MATCHING_RULE.
 *
 * El DENY es correcto porque todavÃ­a no hemos conectado reglas.
 */
function testAuthorizationEngineFoundation() {
  const request = {
    subject: {
      id: 'vendedor@empresa.com',
      type: 'USER',
      roles: ['VENDEDOR']
    },

    action: 'EDIT',

    resource: {
      type: 'TABLE',
      id: 'PEDIDOS'
    },

    context: {
      companyId: 'EMPRESA_001'
    }
  };

  const result = aerpAuthorize(request, {
    traceEnabled: true,
    stopOnFirstMatch: true
  });

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    throw new Error('Authorization Engine did not return a valid result.');
  }

  if (result.decision !== AERP_AUTHORIZATION_DECISION.DENY) {
    throw new Error('Foundation test must return DENY before rules are connected.');
  }

  if (result.reason !== AERP_AUTHORIZATION_REASON.NO_MATCHING_RULE) {
    throw new Error('Expected reason NO_MATCHING_RULE.');
  }

  if (!result.trace || result.trace.steps.length < 2) {
    throw new Error('Authorization trace was not generated correctly.');
  }

  console.log('AERP-036 Authorization Engine Foundation: OK');

  return result;
}

/**
 * Comprueba el comportamiento ante una solicitud invÃ¡lida.
 */
function testAuthorizationEngineInvalidRequest() {
  const result = aerpAuthorize({
    subject: {
      id: ''
    },

    action: '',

    resource: {
      type: '',
      id: ''
    }
  });

  console.log(JSON.stringify(result, null, 2));

  if (result.decision !== AERP_AUTHORIZATION_DECISION.DENY) {
    throw new Error('Invalid requests must always return DENY.');
  }

  if (result.reason !== AERP_AUTHORIZATION_REASON.INVALID_REQUEST) {
    throw new Error('Expected reason INVALID_REQUEST.');
  }

  if (result.validationErrors.length === 0) {
    throw new Error('Validation errors were expected.');
  }

  console.log('AERP-036 Invalid Request Test: OK');

  return result;
}
/**
 * Comprueba que una regla ALLOW autorice una operaciÃ³n.
 */
function testAuthorizationRuleEvaluatorAllow() {
  const rules = [
    {
      id: 'RULE_PEDIDOS_EDIT_VENDEDOR',

      name: 'Vendedor puede editar pedidos',

      enabled: true,

      effect: AERP_AUTHORIZATION_DECISION.ALLOW,

      priority: 100,

      subjectTypes: ['USER'],

      roles: ['VENDEDOR'],

      actions: ['EDIT'],

      resourceTypes: ['TABLE'],

      resourceIds: ['PEDIDOS']
    }
  ];

  const request = {
    subject: {
      id: 'vendedor@empresa.com',
      type: 'USER',
      roles: ['VENDEDOR']
    },

    action: 'EDIT',

    resource: {
      type: 'TABLE',
      id: 'PEDIDOS'
    },

    context: {
      companyId: 'EMPRESA_001'
    }
  };

  const result = aerpAuthorize(request, {
    rules: rules,
    traceEnabled: true
  });

  console.log(JSON.stringify(result, null, 2));

  if (result.decision !== AERP_AUTHORIZATION_DECISION.ALLOW) {
    throw new Error('Expected an ALLOW decision.');
  }

  if (!result.allowed) {
    throw new Error('The allowed property must be true.');
  }

  if (result.reason !== AERP_AUTHORIZATION_REASON.ALLOWED_BY_RULE) {
    throw new Error('Expected reason ALLOWED_BY_RULE.');
  }

  if (!result.matchedRule || result.matchedRule.id !== 'RULE_PEDIDOS_EDIT_VENDEDOR') {
    throw new Error('The expected authorization rule was not selected.');
  }

  console.log('AERP-036 Rule Evaluator ALLOW Test: OK');

  return result;
}

/**
 * Comprueba que una regla no coincidente no autorice la operaciÃ³n.
 */
function testAuthorizationRuleEvaluatorNoMatch() {
  const rules = [
    {
      id: 'RULE_PEDIDOS_VIEW_VENDEDOR',

      enabled: true,

      effect: AERP_AUTHORIZATION_DECISION.ALLOW,

      priority: 100,

      roles: ['VENDEDOR'],

      actions: ['VIEW'],

      resourceTypes: ['TABLE'],

      resourceIds: ['PEDIDOS']
    }
  ];

  const request = {
    subject: {
      id: 'vendedor@empresa.com',
      type: 'USER',
      roles: ['VENDEDOR']
    },

    action: 'DELETE',

    resource: {
      type: 'TABLE',
      id: 'PEDIDOS'
    }
  };

  const result = aerpAuthorize(request, {
    rules: rules
  });

  console.log(JSON.stringify(result, null, 2));

  if (result.decision !== AERP_AUTHORIZATION_DECISION.DENY) {
    throw new Error('A non-matching rule must not authorize the request.');
  }

  if (result.reason !== AERP_AUTHORIZATION_REASON.NO_MATCHING_RULE) {
    throw new Error('Expected reason NO_MATCHING_RULE.');
  }

  if (result.matchedRule !== null) {
    throw new Error('No rule should have been selected.');
  }

  console.log('AERP-036 Rule Evaluator NO MATCH Test: OK');

  return result;
}

/**
 * Comprueba la polÃ­tica de prioridad y DENY por precedencia.
 */
function testAuthorizationRuleEvaluatorDenyOverride() {
  const rules = [
    {
      id: 'RULE_ALLOW_PEDIDOS_EDIT',

      enabled: true,

      effect: AERP_AUTHORIZATION_DECISION.ALLOW,

      priority: 100,

      roles: ['VENDEDOR'],

      actions: ['EDIT'],

      resourceTypes: ['TABLE'],

      resourceIds: ['PEDIDOS']
    },

    {
      id: 'RULE_DENY_PEDIDOS_EDIT',

      enabled: true,

      effect: AERP_AUTHORIZATION_DECISION.DENY,

      priority: 100,

      roles: ['VENDEDOR'],

      actions: ['EDIT'],

      resourceTypes: ['TABLE'],

      resourceIds: ['PEDIDOS']
    }
  ];

  const request = {
    subject: {
      id: 'vendedor@empresa.com',
      type: 'USER',
      roles: ['VENDEDOR']
    },

    action: 'EDIT',

    resource: {
      type: 'TABLE',
      id: 'PEDIDOS'
    }
  };

  const result = aerpAuthorize(request, {
    rules: rules,
    traceEnabled: true
  });

  console.log(JSON.stringify(result, null, 2));

  if (result.decision !== AERP_AUTHORIZATION_DECISION.DENY) {
    throw new Error('DENY must take precedence when priorities are equal.');
  }

  if (result.reason !== AERP_AUTHORIZATION_REASON.DENIED_BY_RULE) {
    throw new Error('Expected reason DENIED_BY_RULE.');
  }

  if (!result.matchedRule || result.matchedRule.id !== 'RULE_DENY_PEDIDOS_EDIT') {
    throw new Error('The DENY rule should be selected.');
  }

  console.log('AERP-036 Rule Evaluator DENY Override Test: OK');

  return result;
  /**
   * Comprueba que una regla autorice cuando todas sus condiciones se cumplen.
   */
  // eslint-disable-next-line no-unused-vars
  function testAuthorizationConditionEvaluatorAllow() {
    const rules = [
      {
        id: 'RULE_EDIT_PEDIDO_BORRADOR',

        enabled: true,

        effect: AERP_AUTHORIZATION_DECISION.ALLOW,

        priority: 100,

        roles: ['VENDEDOR'],

        actions: ['EDIT'],

        resourceTypes: ['TABLE'],

        resourceIds: ['PEDIDOS'],

        conditions: [
          {
            id: 'COND_COMPANY',

            path: 'context.companyId',

            operator: 'EQ',

            value: 'EMPRESA_001'
          },

          {
            id: 'COND_STATUS',

            path: 'resource.attributes.status',

            operator: 'EQ',

            value: 'BORRADOR'
          },

          {
            id: 'COND_TOTAL',

            path: 'resource.attributes.total',

            operator: 'LTE',

            value: 5000
          }
        ]
      }
    ];

    const request = {
      subject: {
        id: 'vendedor@empresa.com',

        type: 'USER',

        roles: ['VENDEDOR']
      },

      action: 'EDIT',

      resource: {
        type: 'TABLE',

        id: 'PEDIDOS',

        attributes: {
          status: 'BORRADOR',

          total: 3500
        }
      },

      context: {
        companyId: 'EMPRESA_001'
      }
    };

    const result = aerpAuthorize(request, {
      rules: rules,

      traceEnabled: true
    });

    console.log(JSON.stringify(result, null, 2));

    if (result.decision !== AERP_AUTHORIZATION_DECISION.ALLOW) {
      throw new Error('Expected ALLOW when every condition passes.');
    }

    if (!result.matchedRule || result.matchedRule.id !== 'RULE_EDIT_PEDIDO_BORRADOR') {
      throw new Error('The conditioned rule was not selected.');
    }

    console.log('AERP-036 Condition Evaluator ALLOW Test: OK');

    return result;
  }

  /**
   * Comprueba que una condiciÃ³n fallida impida la autorizaciÃ³n.
   */
  // eslint-disable-next-line no-unused-vars
  function testAuthorizationConditionEvaluatorFail() {
    const rules = [
      {
        id: 'RULE_EDIT_PEDIDO_BORRADOR',

        enabled: true,

        effect: AERP_AUTHORIZATION_DECISION.ALLOW,

        priority: 100,

        roles: ['VENDEDOR'],

        actions: ['EDIT'],

        resourceTypes: ['TABLE'],

        resourceIds: ['PEDIDOS'],

        conditions: [
          {
            id: 'COND_STATUS',

            path: 'resource.attributes.status',

            operator: 'EQ',

            value: 'BORRADOR'
          },

          {
            id: 'COND_TOTAL',

            path: 'resource.attributes.total',

            operator: 'LTE',

            value: 5000
          }
        ]
      }
    ];

    const request = {
      subject: {
        id: 'vendedor@empresa.com',

        type: 'USER',

        roles: ['VENDEDOR']
      },

      action: 'EDIT',

      resource: {
        type: 'TABLE',

        id: 'PEDIDOS',

        attributes: {
          status: 'APROBADO',

          total: 3500
        }
      }
    };

    const result = aerpAuthorize(request, {
      rules: rules,

      traceEnabled: true
    });

    console.log(JSON.stringify(result, null, 2));

    if (result.decision !== AERP_AUTHORIZATION_DECISION.DENY) {
      throw new Error('A failed condition must prevent authorization.');
    }

    if (result.reason !== AERP_AUTHORIZATION_REASON.NO_MATCHING_RULE) {
      throw new Error('Expected NO_MATCHING_RULE after condition failure.');
    }

    if (result.matchedRule !== null) {
      throw new Error('A rule with failed conditions must not be selected.');
    }

    console.log('AERP-036 Condition Evaluator FAIL Test: OK');

    return result;
  }

  /**
   * Comprueba EXISTS, IN y CONTAINS.
   */
  // eslint-disable-next-line no-unused-vars
  function testAuthorizationConditionEvaluatorOperators() {
    const rules = [
      {
        id: 'RULE_ADVANCED_CONTEXT',

        enabled: true,

        effect: AERP_AUTHORIZATION_DECISION.ALLOW,

        priority: 100,

        roles: ['SUPERVISOR'],

        actions: ['APPROVE'],

        resourceTypes: ['TABLE'],

        resourceIds: ['PEDIDOS'],

        conditions: [
          {
            id: 'COND_DEPARTMENT_EXISTS',

            path: 'subject.attributes.departmentId',

            operator: 'EXISTS'
          },

          {
            id: 'COND_CHANNEL',

            path: 'context.channel',

            operator: 'IN',

            value: ['WEB', 'APPSHEET']
          },

          {
            id: 'COND_TAG',

            path: 'resource.attributes.tags',

            operator: 'CONTAINS',

            value: 'PRIORITARIO'
          }
        ]
      }
    ];

    const request = {
      subject: {
        id: 'supervisor@empresa.com',

        type: 'USER',

        roles: ['SUPERVISOR'],

        attributes: {
          departmentId: 'VENTAS'
        }
      },

      action: 'APPROVE',

      resource: {
        type: 'TABLE',

        id: 'PEDIDOS',

        attributes: {
          tags: ['CLIENTE_VIP', 'PRIORITARIO']
        }
      },

      context: {
        channel: 'APPSHEET'
      }
    };

    const result = aerpAuthorize(request, {
      rules: rules,

      traceEnabled: true
    });

    console.log(JSON.stringify(result, null, 2));

    if (result.decision !== AERP_AUTHORIZATION_DECISION.ALLOW) {
      throw new Error('Expected ALLOW for EXISTS, IN and CONTAINS.');
    }

    if (!result.matchedRule || result.matchedRule.conditions.length !== 3) {
      throw new Error('Expected three public conditions.');
    }

    console.log('AERP-036 Condition Evaluator Operators Test: OK');

    return result;
  }
}
/**
 * Comprueba que una regla autorice cuando todas sus condiciones se cumplen.
 */
function testAuthorizationConditionEvaluatorAllow() {
  const rules = [
    {
      id: 'RULE_EDIT_PEDIDO_BORRADOR',

      enabled: true,

      effect: AERP_AUTHORIZATION_DECISION.ALLOW,

      priority: 100,

      roles: ['VENDEDOR'],

      actions: ['EDIT'],

      resourceTypes: ['TABLE'],

      resourceIds: ['PEDIDOS'],

      conditions: [
        {
          id: 'COND_COMPANY',

          path: 'context.companyId',

          operator: 'EQ',

          value: 'EMPRESA_001'
        },

        {
          id: 'COND_STATUS',

          path: 'resource.attributes.status',

          operator: 'EQ',

          value: 'BORRADOR'
        },

        {
          id: 'COND_TOTAL',

          path: 'resource.attributes.total',

          operator: 'LTE',

          value: 5000
        }
      ]
    }
  ];

  const request = {
    subject: {
      id: 'vendedor@empresa.com',

      type: 'USER',

      roles: ['VENDEDOR']
    },

    action: 'EDIT',

    resource: {
      type: 'TABLE',

      id: 'PEDIDOS',

      attributes: {
        status: 'BORRADOR',

        total: 3500
      }
    },

    context: {
      companyId: 'EMPRESA_001'
    }
  };

  const result = aerpAuthorize(request, {
    rules: rules,

    traceEnabled: true
  });

  console.log(JSON.stringify(result, null, 2));

  if (result.decision !== AERP_AUTHORIZATION_DECISION.ALLOW) {
    throw new Error('Expected ALLOW when every condition passes.');
  }

  if (!result.matchedRule || result.matchedRule.id !== 'RULE_EDIT_PEDIDO_BORRADOR') {
    throw new Error('The conditioned rule was not selected.');
  }

  console.log('AERP-036 Condition Evaluator ALLOW Test: OK');

  return result;
}

/**
 * Comprueba que una condiciÃ³n fallida impida la autorizaciÃ³n.
 */
function testAuthorizationConditionEvaluatorFail() {
  const rules = [
    {
      id: 'RULE_EDIT_PEDIDO_BORRADOR',

      enabled: true,

      effect: AERP_AUTHORIZATION_DECISION.ALLOW,

      priority: 100,

      roles: ['VENDEDOR'],

      actions: ['EDIT'],

      resourceTypes: ['TABLE'],

      resourceIds: ['PEDIDOS'],

      conditions: [
        {
          id: 'COND_STATUS',

          path: 'resource.attributes.status',

          operator: 'EQ',

          value: 'BORRADOR'
        },

        {
          id: 'COND_TOTAL',

          path: 'resource.attributes.total',

          operator: 'LTE',

          value: 5000
        }
      ]
    }
  ];

  const request = {
    subject: {
      id: 'vendedor@empresa.com',

      type: 'USER',

      roles: ['VENDEDOR']
    },

    action: 'EDIT',

    resource: {
      type: 'TABLE',

      id: 'PEDIDOS',

      attributes: {
        status: 'APROBADO',

        total: 3500
      }
    }
  };

  const result = aerpAuthorize(request, {
    rules: rules,

    traceEnabled: true
  });

  console.log(JSON.stringify(result, null, 2));

  if (result.decision !== AERP_AUTHORIZATION_DECISION.DENY) {
    throw new Error('A failed condition must prevent authorization.');
  }

  if (result.reason !== AERP_AUTHORIZATION_REASON.NO_MATCHING_RULE) {
    throw new Error('Expected NO_MATCHING_RULE after condition failure.');
  }

  if (result.matchedRule !== null) {
    throw new Error('A rule with failed conditions must not be selected.');
  }

  console.log('AERP-036 Condition Evaluator FAIL Test: OK');

  return result;
}

/**
 * Comprueba EXISTS, IN y CONTAINS.
 */
function testAuthorizationConditionEvaluatorOperators() {
  const rules = [
    {
      id: 'RULE_ADVANCED_CONTEXT',

      enabled: true,

      effect: AERP_AUTHORIZATION_DECISION.ALLOW,

      priority: 100,

      roles: ['SUPERVISOR'],

      actions: ['APPROVE'],

      resourceTypes: ['TABLE'],

      resourceIds: ['PEDIDOS'],

      conditions: [
        {
          id: 'COND_DEPARTMENT_EXISTS',

          path: 'subject.attributes.departmentId',

          operator: 'EXISTS'
        },

        {
          id: 'COND_CHANNEL',

          path: 'context.channel',

          operator: 'IN',

          value: ['WEB', 'APPSHEET']
        },

        {
          id: 'COND_TAG',

          path: 'resource.attributes.tags',

          operator: 'CONTAINS',

          value: 'PRIORITARIO'
        }
      ]
    }
  ];

  const request = {
    subject: {
      id: 'supervisor@empresa.com',

      type: 'USER',

      roles: ['SUPERVISOR'],

      attributes: {
        departmentId: 'VENTAS'
      }
    },

    action: 'APPROVE',

    resource: {
      type: 'TABLE',

      id: 'PEDIDOS',

      attributes: {
        tags: ['CLIENTE_VIP', 'PRIORITARIO']
      }
    },

    context: {
      channel: 'APPSHEET'
    }
  };

  const result = aerpAuthorize(request, {
    rules: rules,

    traceEnabled: true
  });

  console.log(JSON.stringify(result, null, 2));

  if (result.decision !== AERP_AUTHORIZATION_DECISION.ALLOW) {
    throw new Error('Expected ALLOW for EXISTS, IN and CONTAINS.');
  }

  if (!result.matchedRule || result.matchedRule.conditions.length !== 3) {
    throw new Error('Expected three public conditions.');
  }

  console.log('AERP-036 Condition Evaluator Operators Test: OK');

  return result;
}
/**
 * Comprueba que el Advanced Decision Builder:
 *
 * - recopila mÃºltiples reglas;
 * - aplica prioridad;
 * - aplica DENY precedence;
 * - genera decisionSummary;
 * - explica las reglas descartadas.
 */
function testAuthorizationAdvancedDecisionBuilder() {
  const rules = [
    {
      id: 'RULE_LOW_PRIORITY_DENY',

      enabled: true,

      effect: AERP_AUTHORIZATION_DECISION.DENY,

      priority: 500,

      roles: ['MANAGER'],

      actions: ['EDIT'],

      resourceTypes: ['TABLE'],

      resourceIds: ['PEDIDOS']
    },

    {
      id: 'RULE_HIGH_PRIORITY_ALLOW',

      enabled: true,

      effect: AERP_AUTHORIZATION_DECISION.ALLOW,

      priority: 900,

      roles: ['MANAGER'],

      actions: ['EDIT'],

      resourceTypes: ['TABLE'],

      resourceIds: ['PEDIDOS']
    },

    {
      id: 'RULE_HIGH_PRIORITY_DENY',

      enabled: true,

      effect: AERP_AUTHORIZATION_DECISION.DENY,

      priority: 900,

      roles: ['MANAGER'],

      actions: ['EDIT'],

      resourceTypes: ['TABLE'],

      resourceIds: ['PEDIDOS']
    }
  ];

  const request = {
    subject: {
      id: 'manager@empresa.com',

      type: 'USER',

      roles: ['MANAGER']
    },

    action: 'EDIT',

    resource: {
      type: 'TABLE',

      id: 'PEDIDOS'
    }
  };

  const result = aerpAuthorize(request, {
    rules: rules,

    traceEnabled: true
  });

  console.log(JSON.stringify(result, null, 2));

  if (result.decision !== AERP_AUTHORIZATION_DECISION.DENY) {
    throw new Error('Expected DENY from the Advanced Decision Builder.');
  }

  if (!result.matchedRule || result.matchedRule.id !== 'RULE_HIGH_PRIORITY_DENY') {
    throw new Error('Expected RULE_HIGH_PRIORITY_DENY as winning rule.');
  }

  if (!result.decisionSummary) {
    throw new Error('Expected decisionSummary.');
  }

  if (result.decisionSummary.matchingRuleCount !== 3) {
    throw new Error('Expected three matching rules.');
  }

  if (result.decisionSummary.ignoredRules.length !== 2) {
    throw new Error('Expected two ignored rules.');
  }

  console.log('AERP-036 Advanced Decision Builder Test: OK');

  return result;
}

/**
 * Comprueba que el DENY predeterminado sea inmutable y que una regla ALLOW
 * explícita y válida siga autorizando.
 */
function testAuthorizationImmutableDefaultDeny() {
  const request = {
    subject: {
      id: 'vendedor@empresa.com',
      type: 'USER',
      roles: ['VENDEDOR']
    },
    action: 'EDIT',
    resource: {
      type: 'TABLE',
      id: 'PEDIDOS'
    },
    context: {
      companyId: 'EMPRESA_001'
    }
  };

  const allowRule = {
    id: 'RULE_IMMUTABLE_DEFAULT_ALLOW',
    enabled: true,
    effect: AERP_AUTHORIZATION_DECISION.ALLOW,
    priority: 100,
    subjectTypes: ['USER'],
    roles: ['VENDEDOR'],
    actions: ['EDIT'],
    resourceTypes: ['TABLE'],
    resourceIds: ['PEDIDOS']
  };

  const acceptedCases = [
    {
      name: 'omitted defaultDecision',
      options: {}
    },
    {
      name: 'exact DENY',
      options: {
        defaultDecision: AERP_AUTHORIZATION_DECISION.DENY
      }
    }
  ];

  acceptedCases.forEach(function (testCase) {
    const result = aerpAuthorize(request, testCase.options);

    if (
      result.decision !== AERP_AUTHORIZATION_DECISION.DENY ||
      result.allowed ||
      result.reason !== AERP_AUTHORIZATION_REASON.NO_MATCHING_RULE
    ) {
      throw new Error(testCase.name + ' must preserve the immutable DENY fallback.');
    }
  });

  const invalidCases = [
    {
      name: 'explicit ALLOW',
      value: AERP_AUTHORIZATION_DECISION.ALLOW
    },
    {
      name: 'unknown string',
      value: 'UNKNOWN'
    },
    {
      name: 'empty string',
      value: ''
    },
    {
      name: 'null',
      value: null
    },
    {
      name: 'number',
      value: 1
    },
    {
      name: 'array',
      value: []
    },
    {
      name: 'object',
      value: {}
    }
  ];

  invalidCases.forEach(function (testCase) {
    const result = aerpAuthorize(request, {
      defaultDecision: testCase.value,
      debug: true,
      traceEnabled: true
    });

    if (
      result.decision !== AERP_AUTHORIZATION_DECISION.DENY ||
      result.allowed ||
      result.reason !== AERP_AUTHORIZATION_REASON.INVALID_AUTHORIZATION_OPTIONS ||
      result.reasonCode !== AERP_AUTHORIZATION_REASON.INVALID_AUTHORIZATION_OPTIONS
    ) {
      throw new Error(testCase.name + ' must fail closed as INVALID_AUTHORIZATION_OPTIONS.');
    }

    const serializedResult = JSON.stringify(result);

    if (serializedResult.indexOf('UNKNOWN') !== -1) {
      throw new Error('Unsafe defaultDecision values must not be exposed.');
    }
  });

  const throwingOptions = {};

  Object.defineProperty(throwingOptions, 'defaultDecision', {
    get: function () {
      throw new Error('UNTRUSTED_DEFAULT_DECISION_DETAIL');
    }
  });

  const throwingResult = aerpAuthorize(request, throwingOptions);

  if (
    throwingResult.decision !== AERP_AUTHORIZATION_DECISION.DENY ||
    throwingResult.allowed ||
    throwingResult.reason !== AERP_AUTHORIZATION_REASON.ENGINE_ERROR ||
    JSON.stringify(throwingResult).indexOf('UNTRUSTED_DEFAULT_DECISION_DETAIL') !== -1
  ) {
    throw new Error('A throwing defaultDecision getter must return a sanitized DENY.');
  }

  const allowResult = aerpAuthorize(request, {
    defaultDecision: AERP_AUTHORIZATION_DECISION.DENY,
    rules: [allowRule],
    traceEnabled: true
  });

  if (
    allowResult.decision !== AERP_AUTHORIZATION_DECISION.ALLOW ||
    !allowResult.allowed ||
    allowResult.reason !== AERP_AUTHORIZATION_REASON.ALLOWED_BY_RULE
  ) {
    throw new Error('A valid applicable ALLOW rule must still authorize.');
  }

  const noMatchResult = aerpAuthorize(
    Object.assign({}, request, {
      action: 'DELETE'
    }),
    {
      rules: [allowRule]
    }
  );

  if (
    noMatchResult.decision !== AERP_AUTHORIZATION_DECISION.DENY ||
    noMatchResult.allowed ||
    noMatchResult.reason !== AERP_AUTHORIZATION_REASON.NO_MATCHING_RULE
  ) {
    throw new Error('No matching rules must preserve the immutable DENY fallback.');
  }

  console.log('AERP-036 Immutable Default Deny Test: OK');

  return {
    ok: true,
    status: 'IMMUTABLE_DEFAULT_DENY_OK',
    testedInvalidDefaults: invalidCases.length
  };
}

/**
 * Comprueba que un fallo interno al generar UUID no escape ni contamine el
 * DENY de emergencia con detalles de la excepción.
 */
function testAuthorizationEmergencyDeny() {
  const privateExceptionText = 'PRIVATE_UUID_FACTORY_FAILURE';

  const uuid = aerpBuildSafeAuthorizationUuid_(function () {
    throw new Error(privateExceptionText);
  });

  if (uuid !== null) {
    throw new Error('A failing internal UUID factory must return null.');
  }

  const result = aerpBuildEmergencyAuthorizationDeny_();

  if (
    result.ok !== false ||
    result.decision !== AERP_AUTHORIZATION_DECISION.DENY ||
    result.allowed !== false ||
    result.reason !== AERP_AUTHORIZATION_REASON.ENGINE_ERROR ||
    result.decisionId !== null ||
    result.trace !== null
  ) {
    throw new Error('The emergency authorization response must be a dependency-free DENY.');
  }

  if (JSON.stringify(result).indexOf(privateExceptionText) !== -1) {
    throw new Error('The emergency authorization response exposed private exception details.');
  }

  console.log('AERP-036 Emergency DENY Test: OK');

  return result;
}

/**
 * Comprueba el schema cerrado, la matriz de tipos y el fail-closed completo
 * de DT-SEC-04.
 */
function testAuthorizationStrictConditionValidation() {
  const buildRequest = function (contextOverrides) {
    return {
      subject: {
        id: 'strict.conditions@empresa.com',
        type: 'USER',
        roles: ['SECURITY_TEST'],
        attributes: {
          departmentId: 'VENTAS'
        }
      },
      action: 'EDIT',
      resource: {
        type: 'TABLE',
        id: 'PEDIDOS',
        attributes: {
          status: 'BORRADOR',
          total: 10,
          tags: ['URGENTE', 'INTERNO']
        }
      },
      context: Object.assign(
        {
          companyId: 'EMPRESA_001',
          channel: 'WEB',
          count: 10,
          active: true,
          code: 'ABC-123'
        },
        contextOverrides || {}
      )
    };
  };

  const buildRule = function (conditions, overrides) {
    return Object.assign(
      {
        id: 'RULE_STRICT_CONDITIONS',
        enabled: true,
        effect: AERP_AUTHORIZATION_DECISION.ALLOW,
        priority: 100,
        roles: ['SECURITY_TEST'],
        actions: ['EDIT'],
        resourceTypes: ['TABLE'],
        resourceIds: ['PEDIDOS'],
        conditions: conditions,
        metadata: {
          source: 'DT-SEC-04'
        }
      },
      overrides || {}
    );
  };

  const assertAllow = function (condition, message, request) {
    const result = aerpAuthorize(request || buildRequest(), {
      rules: [buildRule([condition])],
      traceEnabled: true
    });

    if (result.decision !== AERP_AUTHORIZATION_DECISION.ALLOW || !result.allowed) {
      throw new Error(message);
    }
  };

  const assertInvalidCollection = function (rules, forbiddenText) {
    const result = aerpAuthorize(buildRequest(), {
      rules: rules,
      traceEnabled: true
    });

    if (
      result.decision !== AERP_AUTHORIZATION_DECISION.DENY ||
      result.allowed ||
      result.reason !== AERP_AUTHORIZATION_REASON.INVALID_AUTHORIZATION_RULES ||
      result.reasonCode !== AERP_AUTHORIZATION_CONDITION_REASON_CODE.INVALID_CONDITION_SCHEMA ||
      result.matchedRule !== null ||
      result.decisionSummary !== null ||
      result.validationErrors.length !== 1 ||
      result.validationErrors[0] !== AERP_AUTHORIZATION_PUBLIC_ERROR.INVALID_AUTHORIZATION_RULES
    ) {
      throw new Error('Invalid condition collections must return a sanitized DENY.');
    }

    const serialized = JSON.stringify(result);

    if (forbiddenText && serialized.indexOf(forbiddenText) !== -1) {
      throw new Error('Invalid condition details were exposed publicly.');
    }

    if (
      result.trace &&
      JSON.stringify(result.trace).indexOf(
        AERP_AUTHORIZATION_CONDITION_REASON_CODE.INVALID_CONDITION_SCHEMA
      ) === -1
    ) {
      throw new Error('Expected a sanitized condition failure trace code.');
    }

    return result;
  };

  const operatorCases = [
    {
      path: 'context.companyId',
      operator: 'EQ',
      value: 'EMPRESA_001'
    },
    {
      path: 'context.companyId',
      operator: 'NEQ',
      value: 'EMPRESA_999'
    },
    {
      path: 'context.channel',
      operator: 'IN',
      value: ['WEB', 'APP']
    },
    {
      path: 'context.channel',
      operator: 'NOT_IN',
      value: ['API', 'BATCH']
    },
    {
      path: 'context.count',
      operator: 'GT',
      value: 5
    },
    {
      path: 'context.count',
      operator: 'GTE',
      value: 10
    },
    {
      path: 'context.count',
      operator: 'LT',
      value: 20
    },
    {
      path: 'context.count',
      operator: 'LTE',
      value: 10
    },
    {
      path: 'context.companyId',
      operator: 'EXISTS'
    },
    {
      path: 'context.missingValue',
      operator: 'NOT_EXISTS'
    },
    {
      path: 'resource.attributes.tags',
      operator: 'CONTAINS',
      value: 'URGENTE'
    },
    {
      path: 'context.code',
      operator: 'STARTS_WITH',
      value: 'ABC'
    },
    {
      path: 'context.code',
      operator: 'ENDS_WITH',
      value: '123'
    }
  ];

  operatorCases.forEach(function (condition) {
    assertAllow(condition, 'Supported operator failed strict validation: ' + condition.operator);
  });

  assertAllow(
    {
      path: 'context.active',
      operator: 'EQ',
      value: true
    },
    'Boolean equality must remain supported.'
  );

  assertAllow(
    {
      path: 'context.nullable',
      operator: 'EQ',
      value: null
    },
    'Null equality must be exact.',
    buildRequest({
      nullable: null
    })
  );

  const invalidConditions = [
    {
      path: 'context.companyId',
      operator: 'UNKNOWN',
      value: 'PRIVATE_UNKNOWN_OPERATOR'
    },
    {
      path: 'context.companyId',
      operator: 'eq',
      value: 'PRIVATE_LOWERCASE_OPERATOR'
    },
    {
      operator: 'EQ',
      value: 'PRIVATE_MISSING_PATH'
    },
    {
      operator: 'EXISTS'
    },
    {
      operator: 'NOT_EXISTS'
    },
    {
      path: 'context..companyId',
      operator: 'EQ',
      value: 'PRIVATE_INVALID_PATH'
    },
    {
      path: 'context.__proto__.companyId',
      operator: 'EQ',
      value: 'PRIVATE_FORBIDDEN_PATH'
    },
    {
      path: 'context.companyId',
      operator: 'EXISTS',
      value: 'PRIVATE_FORBIDDEN_EXISTS_VALUE'
    },
    {
      path: 'context.missingValue',
      operator: 'NOT_EXISTS',
      value: 'PRIVATE_FORBIDDEN_NOT_EXISTS_VALUE'
    },
    {
      path: 'context.companyId',
      operator: 'EQ',
      value: 'EMPRESA_001',
      unknownSecurityField: 'PRIVATE_UNKNOWN_FIELD'
    },
    {
      path: 'context.companyId',
      operator: 'EQ',
      value: {}
    },
    {
      path: 'context.channel',
      operator: 'IN',
      value: []
    },
    {
      path: 'context.channel',
      operator: 'IN',
      value: ['WEB', 1]
    },
    {
      path: 'context.channel',
      operator: 'IN',
      value: [['WEB']]
    },
    {
      path: 'context.count',
      operator: 'GT',
      value: '5'
    },
    {
      path: 'context.companyId',
      operator: 'CONTAINS',
      value: {}
    },
    {
      path: 'context.code',
      operator: 'STARTS_WITH',
      value: 1
    }
  ];

  invalidConditions.forEach(function (condition) {
    assertInvalidCollection(
      [buildRule([condition])],
      typeof condition.value === 'string' && condition.value.indexOf('PRIVATE_') === 0
        ? condition.value
        : null
    );
  });

  [null, undefined, 'condition', {}, 1].forEach(function (conditions) {
    assertInvalidCollection([buildRule(conditions)]);
  });

  let conditionGetterCalls = 0;
  const accessorCondition = {
    operator: 'EQ',
    value: 'PRIVATE_ACCESSOR_VALUE'
  };

  Object.defineProperty(accessorCondition, 'path', {
    enumerable: true,
    get: function () {
      conditionGetterCalls += 1;
      throw new Error('PRIVATE_CONDITION_GETTER');
    }
  });

  assertInvalidCollection([buildRule([accessorCondition])], 'PRIVATE_CONDITION_GETTER');

  if (conditionGetterCalls !== 0) {
    throw new Error('Condition accessors must be rejected without execution.');
  }

  let collectionGetterCalls = 0;
  const accessorRule = buildRule([]);

  Object.defineProperty(accessorRule, 'conditions', {
    enumerable: true,
    get: function () {
      collectionGetterCalls += 1;
      throw new Error('PRIVATE_COLLECTION_GETTER');
    }
  });

  assertInvalidCollection([accessorRule], 'PRIVATE_COLLECTION_GETTER');

  if (collectionGetterCalls !== 0) {
    throw new Error('Condition collection accessors must be rejected without execution.');
  }

  const unsafePrototypeCondition = Object.create({
    inherited: true
  });
  unsafePrototypeCondition.path = 'context.companyId';
  unsafePrototypeCondition.operator = 'EQ';
  unsafePrototypeCondition.value = 'EMPRESA_001';
  assertInvalidCollection([buildRule([unsafePrototypeCondition])]);

  const unsafeMetadata = {};
  Object.defineProperty(unsafeMetadata, 'secret', {
    enumerable: true,
    get: function () {
      throw new Error('PRIVATE_METADATA_GETTER');
    }
  });
  assertInvalidCollection([
    buildRule([
      {
        path: 'context.companyId',
        operator: 'EQ',
        value: 'EMPRESA_001',
        metadata: unsafeMetadata
      }
    ])
  ]);

  const validSibling = buildRule([], {
    id: 'RULE_VALID_ALLOW_SIBLING'
  });
  const malformedSibling = buildRule(
    [
      {
        operator: 'EQ',
        value: 'PRIVATE_MALFORMED_SIBLING'
      }
    ],
    {
      id: 'RULE_MALFORMED_SIBLING'
    }
  );
  assertInvalidCollection([validSibling, malformedSibling], 'PRIVATE_MALFORMED_SIBLING');
  assertInvalidCollection([
    buildRule(
      [
        {
          operator: 'EQ',
          value: 'PRIVATE_DISABLED_MALFORMED'
        }
      ],
      {
        enabled: false
      }
    ),
    validSibling
  ]);

  const numericStringResult = aerpAuthorize(buildRequest({ count: '10' }), {
    rules: [
      buildRule([
        {
          path: 'context.count',
          operator: 'EQ',
          value: 10
        }
      ])
    ]
  });

  if (numericStringResult.decision !== AERP_AUTHORIZATION_DECISION.DENY) {
    throw new Error('Condition evaluation must not coerce strings into numbers.');
  }

  const incompatibleNegativeResult = aerpAuthorize(buildRequest({ count: '10' }), {
    rules: [
      buildRule([
        {
          path: 'context.count',
          operator: 'NEQ',
          value: 10
        }
      ])
    ]
  });

  if (incompatibleNegativeResult.decision !== AERP_AUTHORIZATION_DECISION.DENY) {
    throw new Error('Incompatible NEQ types must not authorize through negation.');
  }

  const omittedConditionsRule = buildRule([]);
  delete omittedConditionsRule.conditions;
  const omittedResult = aerpAuthorize(buildRequest(), {
    rules: [omittedConditionsRule]
  });
  const emptyResult = aerpAuthorize(buildRequest(), {
    rules: [buildRule([])]
  });

  if (
    omittedResult.decision !== AERP_AUTHORIZATION_DECISION.ALLOW ||
    emptyResult.decision !== AERP_AUTHORIZATION_DECISION.ALLOW
  ) {
    throw new Error('Omitted and empty conditions must remain compatible.');
  }

  [
    {
      path: 'context.companyId',
      operator: 'EQ',
      value: 'EMPRESA_001',
      caseSensitive: true
    },
    {
      path: 'context.companyId',
      operator: 'NEQ',
      value: 'empresa_999',
      caseSensitive: true
    },
    {
      path: 'context.channel',
      operator: 'IN',
      value: ['WEB'],
      caseSensitive: true
    },
    {
      path: 'context.channel',
      operator: 'NOT_IN',
      value: ['web'],
      caseSensitive: true
    },
    {
      path: 'context.code',
      operator: 'CONTAINS',
      value: 'ABC',
      caseSensitive: true
    },
    {
      path: 'context.code',
      operator: 'STARTS_WITH',
      value: 'ABC',
      caseSensitive: true
    },
    {
      path: 'context.code',
      operator: 'ENDS_WITH',
      value: '123',
      caseSensitive: true
    }
  ].forEach(function (condition) {
    assertAllow(condition, 'Valid textual caseSensitive condition was rejected.');
  });

  [
    {
      path: 'context.count',
      operator: 'EQ',
      value: 10,
      caseSensitive: false
    },
    {
      path: 'context.active',
      operator: 'NEQ',
      value: false,
      caseSensitive: false
    },
    {
      path: 'context.nullable',
      operator: 'EQ',
      value: null,
      caseSensitive: false
    },
    {
      path: 'context.count',
      operator: 'IN',
      value: [10, 20],
      caseSensitive: false
    },
    {
      path: 'context.active',
      operator: 'NOT_IN',
      value: [false],
      caseSensitive: false
    },
    {
      path: 'context.count',
      operator: 'GT',
      value: 5,
      caseSensitive: false
    },
    {
      path: 'context.companyId',
      operator: 'EXISTS',
      caseSensitive: false
    }
  ].forEach(function (condition) {
    assertInvalidCollection([buildRule([condition])]);
  });

  [
    {
      path: 'context.count',
      operator: 'IN',
      value: [10, 20]
    },
    {
      path: 'context.count',
      operator: 'NOT_IN',
      value: [20, 30]
    },
    {
      path: 'context.active',
      operator: 'IN',
      value: [true]
    },
    {
      path: 'context.active',
      operator: 'NOT_IN',
      value: [false]
    },
    {
      path: 'context.code',
      operator: 'CONTAINS',
      value: 'ABC'
    },
    {
      path: 'resource.attributes.tags',
      operator: 'CONTAINS',
      value: 'URGENTE'
    },
    {
      path: 'context.numericValues',
      operator: 'CONTAINS',
      value: 2
    },
    {
      path: 'context.booleanValues',
      operator: 'CONTAINS',
      value: true
    }
  ].forEach(function (condition) {
    assertAllow(
      condition,
      'Valid strict array or CONTAINS type was rejected.',
      buildRequest({
        numericValues: [1, 2, 3],
        booleanValues: [false, true]
      })
    );
  });

  const incompatibleNotInResult = aerpAuthorize(buildRequest({ count: '10' }), {
    rules: [
      buildRule([
        {
          path: 'context.count',
          operator: 'NOT_IN',
          value: [10, 20]
        }
      ])
    ]
  });

  if (incompatibleNotInResult.decision !== AERP_AUTHORIZATION_DECISION.DENY) {
    throw new Error('Incompatible NOT_IN types must fail closed.');
  }

  [NaN, Infinity, -Infinity].forEach(function (unsafeNumber) {
    assertInvalidCollection([
      buildRule([
        {
          path: 'context.count',
          operator: 'GTE',
          value: unsafeNumber
        }
      ])
    ]);
    assertInvalidCollection([
      buildRule([
        {
          path: 'context.count',
          operator: 'IN',
          value: [unsafeNumber]
        }
      ])
    ]);
  });

  const arrayWithHole = [];
  arrayWithHole.length = 2;
  arrayWithHole[1] = 'WEB';

  let arrayAccessorCalls = 0;
  const arrayWithAccessor = ['WEB'];
  Object.defineProperty(arrayWithAccessor, '0', {
    enumerable: true,
    get: function () {
      arrayAccessorCalls += 1;
      throw new Error('PRIVATE_ARRAY_ACCESSOR');
    }
  });

  const arrayWithProperty = ['WEB'];
  arrayWithProperty.extra = 'PRIVATE_ARRAY_PROPERTY';

  const arrayWithPrototype = ['WEB'];
  Object.setPrototypeOf(arrayWithPrototype, {});

  [arrayWithHole, arrayWithAccessor, arrayWithProperty, arrayWithPrototype].forEach(
    function (unsafeArray) {
      assertInvalidCollection([
        buildRule([
          {
            path: 'context.channel',
            operator: 'IN',
            value: unsafeArray
          }
        ])
      ]);
    }
  );

  if (arrayAccessorCalls !== 0) {
    throw new Error('Array accessors must be rejected without execution.');
  }

  assertAllow(
    {
      path: 'context.companyId',
      operator: 'EQ',
      value: 'EMPRESA_001',
      metadata: {
        source: 'BACKEND',
        nested: {
          enabled: true,
          values: ['A', 1, false, null]
        }
      }
    },
    'Nested JSON-safe metadata must remain compatible.'
  );

  const customMetadata = Object.create({
    inherited: true
  });
  customMetadata.source = 'PRIVATE_CUSTOM_METADATA';
  assertInvalidCollection([
    buildRule([
      {
        path: 'context.companyId',
        operator: 'EQ',
        value: 'EMPRESA_001',
        metadata: customMetadata
      }
    ])
  ]);

  const customPrototypeRule = Object.create({
    inherited: true
  });
  Object.keys(validSibling).forEach(function (key) {
    customPrototypeRule[key] = validSibling[key];
  });
  assertInvalidCollection([customPrototypeRule]);

  const assertThrowingProxyDenied = function (proxyValue, privateMessage, wrapAsCondition) {
    const rules = wrapAsCondition ? [buildRule([proxyValue])] : [proxyValue];
    const result = assertInvalidCollection(rules, privateMessage);

    if (
      result.decision !== AERP_AUTHORIZATION_DECISION.DENY ||
      JSON.stringify(result).indexOf(privateMessage) !== -1
    ) {
      throw new Error('Throwing Proxy traps must return a sanitized DENY.');
    }
  };

  assertThrowingProxyDenied(
    new Proxy(validSibling, {
      getPrototypeOf: function () {
        throw new Error('PRIVATE_PROXY_GET_PROTOTYPE');
      }
    }),
    'PRIVATE_PROXY_GET_PROTOTYPE',
    false
  );

  const proxyConditionTarget = {
    path: 'context.companyId',
    operator: 'EQ',
    value: 'EMPRESA_001'
  };

  assertThrowingProxyDenied(
    new Proxy(proxyConditionTarget, {
      getOwnPropertyDescriptor: function () {
        throw new Error('PRIVATE_PROXY_DESCRIPTOR');
      }
    }),
    'PRIVATE_PROXY_DESCRIPTOR',
    true
  );

  assertThrowingProxyDenied(
    new Proxy(proxyConditionTarget, {
      ownKeys: function () {
        throw new Error('PRIVATE_PROXY_ENUMERATION');
      }
    }),
    'PRIVATE_PROXY_ENUMERATION',
    true
  );

  const emergencyResult = testAuthorizationEmergencyDeny();

  if (emergencyResult.decision !== AERP_AUTHORIZATION_DECISION.DENY) {
    throw new Error('DT-SEC-03 emergency DENY must remain intact.');
  }

  console.log('AERP-036 Strict Condition Validation Test: OK');

  return {
    ok: true,
    status: 'STRICT_CONDITION_VALIDATION_OK',
    testedOperators: operatorCases.length,
    testedInvalidConditions: invalidConditions.length
  };
}
