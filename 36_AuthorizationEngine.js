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
  ENGINE_ERROR: 'ENGINE_ERROR'
});

const AERP_AUTHORIZATION_PUBLIC_ERROR = Object.freeze({
  INVALID_AUTHORIZATION_OPTIONS: 'Authorization options are invalid.',
  ENGINE_ERROR: 'Authorization evaluation failed.'
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
    requestId: aerpNormalizeAuthorizationString_(source.requestId) || Utilities.getUuid(),

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
  const normalizedRules = aerpNormalizeAuthorizationRules_(rules);

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
 * @return {Object[]} Reglas normalizadas.
 */
function aerpNormalizeAuthorizationRules_(rules) {
  if (!Array.isArray(rules)) {
    return [];
  }

  return rules
    .map(function (rule, index) {
      return aerpNormalizeAuthorizationRule_(rule, index);
    })
    .filter(function (rule) {
      return rule !== null;
    });
}

/**
 * Normaliza una regla individual.
 *
 * @param {*} rule Regla original.
 * @param {number} index PosiciÃ³n original.
 * @return {?Object} Regla normalizada.
 */
function aerpNormalizeAuthorizationRule_(rule, index) {
  if (!rule || typeof rule !== 'object') {
    return null;
  }

  const effect = aerpNormalizeAuthorizationString_(rule.effect).toUpperCase();

  if (effect !== AERP_AUTHORIZATION_DECISION.ALLOW && effect !== AERP_AUTHORIZATION_DECISION.DENY) {
    return null;
  }

  const priorityNumber = Number(rule.priority);

  return {
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

    conditions: aerpNormalizeAuthorizationConditions_(rule.conditions),

    metadata: rule.metadata && typeof rule.metadata === 'object' ? rule.metadata : {},

    originalIndex: index
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
 * @return {Object[]} Condiciones normalizadas.
 */
function aerpNormalizeAuthorizationConditions_(conditions) {
  if (!Array.isArray(conditions)) {
    return [];
  }

  return conditions
    .map(function (condition, index) {
      return aerpNormalizeAuthorizationCondition_(condition, index);
    })
    .filter(function (condition) {
      return condition !== null;
    });
}

/**
 * Normaliza una condiciÃ³n individual.
 *
 * @param {*} condition CondiciÃ³n original.
 * @param {number} index PosiciÃ³n original.
 * @return {?Object}
 */
function aerpNormalizeAuthorizationCondition_(condition, index) {
  if (!condition || typeof condition !== 'object') {
    return null;
  }

  const path = aerpNormalizeAuthorizationString_(condition.path);

  const operator = aerpNormalizeAuthorizationString_(condition.operator).toUpperCase();

  if (!path) {
    return null;
  }

  if (!aerpIsSupportedAuthorizationConditionOperator_(operator)) {
    return null;
  }

  return {
    id: aerpNormalizeAuthorizationString_(condition.id) || 'AUTH_CONDITION_' + String(index + 1),

    enabled: condition.enabled !== false,

    path: path,

    operator: operator,

    value: condition.value,

    caseSensitive: condition.caseSensitive === true,

    metadata:
      condition.metadata && typeof condition.metadata === 'object' ? condition.metadata : {},

    originalIndex: index
  };
}

/**
 * Verifica si un operador estÃ¡ soportado.
 *
 * @param {string} operator Operador normalizado.
 * @return {boolean}
 */
function aerpIsSupportedAuthorizationConditionOperator_(operator) {
  return Object.keys(AERP_AUTHORIZATION_CONDITION_OPERATOR).some(function (key) {
    return AERP_AUTHORIZATION_CONDITION_OPERATOR[key] === operator;
  });
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

    const actualValue = resolution.value;

    const expectedValue = condition.value;

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

      conditionId: condition.id,

      path: condition.path,

      operator: condition.operator,

      expectedValue: expectedValue,

      actualValue: actualValue,

      pathExists: resolution.exists,

      error: null
    };
  } catch (error) {
    return {
      ok: false,

      conditionId: condition.id,

      path: condition.path,

      operator: condition.operator,

      expectedValue: condition.value,

      actualValue: null,

      pathExists: false,

      error: {
        name: error && error.name ? error.name : 'Error',

        message: error && error.message ? error.message : String(error)
      }
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
  const normalizedPath = aerpNormalizeAuthorizationString_(path);

  if (!normalizedPath) {
    return {
      exists: false,
      value: undefined
    };
  }

  const segments = normalizedPath
    .split('.')
    .map(function (segment) {
      return segment.trim();
    })
    .filter(function (segment) {
      return Boolean(segment);
    });

  if (segments.length === 0) {
    return {
      exists: false,
      value: undefined
    };
  }

  let current = source;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];

    if (
      current === null ||
      current === undefined ||
      typeof current !== 'object' ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return {
        exists: false,
        value: undefined
      };
    }

    current = current[segment];
  }

  return {
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
  if (typeof actualValue === 'string' || typeof expectedValue === 'string') {
    let actualText = aerpNormalizeAuthorizationString_(actualValue);

    let expectedText = aerpNormalizeAuthorizationString_(expectedValue);

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
  const actualNumber = Number(actualValue);

  const expectedNumber = Number(expectedValue);

  if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) {
    return false;
  }

  return comparator(actualNumber, expectedNumber);
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
    return actualValue.some(function (item) {
      return aerpAuthorizationValuesEqual_(item, expectedValue, caseSensitive);
    });
  }

  if (actualValue === null || actualValue === undefined) {
    return false;
  }

  let actualText = String(actualValue);

  let expectedText = String(expectedValue);

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
  if (actualValue === null || actualValue === undefined) {
    return false;
  }

  let actualText = String(actualValue);

  let expectedText = String(expectedValue);

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
  if (actualValue === null || actualValue === undefined) {
    return false;
  }

  let actualText = String(actualValue);

  let expectedText = String(expectedValue);

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
