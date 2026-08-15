/**
 * ============================================================================
 * ALEF ERP
 * AERP-037 · AUTHORIZATION METADATA REPOSITORY
 * ============================================================================
 *
 * Archivo:
 *   37_AuthorizationMetadataRepository.gs
 *
 * Propósito:
 *   Proporcionar acceso seguro y normalizado a los metadatos de autorización
 *   almacenados en las tablas del ecosistema Alef ERP.
 *
 * Responsabilidades:
 *   - Leer metadatos de autorización desde Google Sheets.
 *   - Resolver roles asociados a un usuario.
 *   - Resolver módulos asociados a roles.
 *   - Obtener permisos aplicables.
 *   - Entregar datos normalizados al Authorization Metadata Adapter.
 *   - Mantener desacoplado el Authorization Engine del origen físico
 *     de los metadatos.
 *
 * Principio arquitectónico:
 *   El Authorization Engine no debe conocer cómo ni dónde se almacenan
 *   los metadatos de autorización.
 *
 * Flujo:
 *
 *   Google Sheets
 *        ↓
 *   Authorization Metadata Repository
 *        ↓
 *   Authorization Metadata Adapter
 *        ↓
 *   Authorization Engine
 *
 * Estado:
 *   FOUNDATION
 *
 * Versión:
 *   1.0.0
 * ============================================================================
 */

/* ============================================================================
 * 1. CONSTANTS
 * ============================================================================
 */

const AERP_AUTH_METADATA_REPOSITORY_VERSION = '1.0.0';

/**
 * Tablas oficiales utilizadas inicialmente por el repositorio.
 *
 * Estas referencias están centralizadas para evitar nombres de hojas
 * dispersos por el código.
 */
const AERP_AUTH_METADATA_TABLES = Object.freeze({
  USER_ROLE: 'CORE_USUARIO_ROL',

  ROLE_MODULE: 'CORE_ROL_MODULO',

  PERMISSION: 'CORE_PERMISOS',

  COMPANY: 'CORE_EMPRESAS'
});

/**
 * Configuración predeterminada del repositorio.
 */
const AERP_AUTH_METADATA_REPOSITORY_DEFAULTS = Object.freeze({
  ignoreEmptyRows: true,

  trimTextValues: true,

  caseInsensitiveHeaders: true,

  failOnMissingTable: true
});

/* ============================================================================
 * 2. PUBLIC API
 * ============================================================================
 */

/**
 * Carga el contexto de autorización asociado a un usuario.
 *
 * Esta función será el punto de entrada principal del repositorio.
 *
 * Resuelve metadata real desde las tablas de autorización configuradas.
 *
 * @param {Object} request Solicitud de contexto.
 * @param {*} request.authentication Evidencia opaca de autenticación.
 * @param {string} request.companyId Identificador obligatorio de empresa.
 * @param {Object=} options Opciones internas del repositorio.
 * @param {Function} options.trustedPrincipalVerifier Verificador backend.
 * @return {Object} Contexto de metadatos de autorización.
 */
function aerpLoadAuthorizationMetadata(request, options) {
  try {
    return aerpLoadAuthorizationMetadataImpl_(request, options);
  } catch (error) {
    return aerpBuildAuthorizationMetadataUnexpectedError_();
  }
}

/**
 * Implementación interna del cargador público de metadata.
 *
 * @param {Object} request Solicitud de contexto.
 * @param {Object=} options Opciones internas del repositorio.
 * @return {Object} Contexto de metadatos de autorización.
 */
function aerpLoadAuthorizationMetadataImpl_(request, options) {
  const startedAt = new Date();

  const principalResult = aerpResolveTrustedAuthorizationPrincipal_(request, options);

  if (!principalResult.ok) {
    return {
      ok: false,
      status: principalResult.status,
      request: {
        companyId: aerpNormalizeAuthorizationMetadataString_(request && request.companyId)
      },
      roles: [],
      modules: [],
      permissions: [],
      errors: principalResult.errors,
      repositoryVersion: AERP_AUTH_METADATA_REPOSITORY_VERSION,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString()
    };
  }

  const normalizedRequest = aerpBuildAuthorizationMetadataRequest_(
    Object.assign({}, request, {
      userId: principalResult.principal.userId
    })
  );

  const repositoryOptions = aerpBuildAuthorizationMetadataRepositoryOptions_(options);

  const validation = aerpValidateAuthorizationMetadataRequest_(normalizedRequest);

  if (!validation.ok) {
    return {
      ok: false,

      status: 'INVALID_REQUEST',

      request: normalizedRequest,

      trustedPrincipal: principalResult.principal,

      roles: [],

      modules: [],

      permissions: [],

      errors: validation.errors,

      repositoryVersion: AERP_AUTH_METADATA_REPOSITORY_VERSION,

      startedAt: startedAt.toISOString(),

      finishedAt: new Date().toISOString()
    };
  }

  const contextResult = aerpResolveAuthorizationContext_(
    normalizedRequest.userId,
    normalizedRequest.companyId,
    options
  );

  if (!contextResult.ok) {
    return {
      ok: false,

      status: contextResult.status,

      request: normalizedRequest,

      roles: [],

      modules: [],

      permissions: [],

      assignments: [],

      authorizationRules: [],

      errors: contextResult.errors || [],

      repositoryVersion: AERP_AUTH_METADATA_REPOSITORY_VERSION,

      startedAt: startedAt.toISOString(),

      finishedAt: new Date().toISOString()
    };
  }

  return {
    ok: true,

    status: contextResult.status,

    request: normalizedRequest,

    trustedPrincipal: principalResult.principal,

    roles: contextResult.roles,

    modules: contextResult.modules,

    moduleDetails: contextResult.moduleDetails,

    permissions: [],

    context: contextResult,

    options: repositoryOptions,

    repositoryVersion: AERP_AUTH_METADATA_REPOSITORY_VERSION,

    startedAt: startedAt.toISOString(),

    finishedAt: new Date().toISOString()
  };
}

/* ============================================================================
 * 3. REQUEST BUILDER
 * ============================================================================
 */

/**
 * Normaliza la solicitud recibida por el repositorio.
 *
 * @param {*} request Solicitud original.
 * @return {Object} Solicitud normalizada.
 */
function aerpBuildAuthorizationMetadataRequest_(request) {
  const source = request && typeof request === 'object' ? request : {};

  return {
    userId: aerpNormalizeAuthorizationMetadataString_(source.userId),

    companyId: aerpNormalizeAuthorizationMetadataString_(source.companyId)
  };
}

/* ============================================================================
 * 4. REQUEST VALIDATION
 * ============================================================================
 */

/**
 * Valida la solicitud mínima del repositorio.
 *
 * @param {Object} request Solicitud normalizada.
 * @return {{ok: boolean, errors: string[]}}
 */
function aerpValidateAuthorizationMetadataRequest_(request) {
  const errors = [];

  if (!request || typeof request !== 'object') {
    errors.push('Authorization metadata request must be an object.');

    return {
      ok: false,

      errors: errors
    };
  }

  if (!request.userId) {
    errors.push('userId is required.');
  }

  if (!request.companyId) {
    errors.push('companyId is required.');
  }

  return {
    ok: errors.length === 0,

    errors: errors
  };
}

/* ============================================================================
 * 4A. TRUSTED AUTHORIZATION PRINCIPAL
 * ============================================================================
 */

/**
 * Resuelve la identidad autenticada mediante un verificador ejecutado
 * exclusivamente en el backend.
 *
 * Contrato del verificador:
 *   - Debe validar la evidencia de autenticación con el proveedor elegido.
 *   - Debe devolver ok=true y verified=true únicamente después de validar
 *     firma/sesión, issuer, audience, expiración y controles aplicables.
 *   - Debe mapear (issuer, subjectId) al userId interno de Alef ERP.
 *   - Nunca debe derivar userId de request.userId.
 *
 * Resultado esperado del verificador:
 * {
 *   ok: true,
 *   verified: true,
 *   principal: {
 *     issuer: 'https://issuer.example',
 *     subjectId: 'provider-stable-subject',
 *     userId: 'AERP_INTERNAL_USER_ID',
 *     authenticationMethod: 'OIDC'
 *   }
 * }
 *
 * @param {*} request Solicitud no confiable recibida por la web app.
 * @param {Object=} options Opciones internas del backend.
 * @return {Object} Principal confiable normalizado o error fail-closed.
 */
function aerpResolveTrustedAuthorizationPrincipal_(request, options) {
  const source = request && typeof request === 'object' ? request : {};

  const verifier =
    options && typeof options.trustedPrincipalVerifier === 'function'
      ? options.trustedPrincipalVerifier
      : null;

  if (!verifier) {
    return {
      ok: false,
      verified: false,
      status: 'TRUSTED_PRINCIPAL_VERIFIER_NOT_CONFIGURED',
      principal: null,
      errors: ['A trusted authorization principal verifier is required.']
    };
  }

  let verificationResult;

  try {
    verificationResult = verifier({
      authentication: source.authentication,
      requestedCompanyId: aerpNormalizeAuthorizationMetadataString_(source.companyId)
    });
  } catch (error) {
    return {
      ok: false,
      verified: false,
      status: 'TRUSTED_PRINCIPAL_VERIFICATION_FAILED',
      principal: null,
      errors: ['Trusted principal verification failed.']
    };
  }

  if (
    !verificationResult ||
    verificationResult.ok !== true ||
    verificationResult.verified !== true ||
    !verificationResult.principal ||
    typeof verificationResult.principal !== 'object'
  ) {
    return {
      ok: false,
      verified: false,
      status: 'UNAUTHENTICATED',
      principal: null,
      errors: ['Authentication evidence could not be verified.']
    };
  }

  const principal = {
    issuer: aerpNormalizeAuthorizationMetadataString_(verificationResult.principal.issuer),
    subjectId: aerpNormalizeAuthorizationMetadataString_(verificationResult.principal.subjectId),
    userId: aerpNormalizeAuthorizationMetadataString_(verificationResult.principal.userId),
    authenticationMethod:
      aerpNormalizeAuthorizationMetadataString_(
        verificationResult.principal.authenticationMethod
      ) || 'UNSPECIFIED',
    verifiedAt: new Date().toISOString()
  };

  const errors = [];

  if (!principal.issuer) {
    errors.push('Trusted principal issuer is required.');
  }

  if (!principal.subjectId) {
    errors.push('Trusted principal subjectId is required.');
  }

  if (!principal.userId) {
    errors.push('Trusted principal userId mapping is required.');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      verified: false,
      status: 'INVALID_TRUSTED_PRINCIPAL',
      principal: null,
      errors: errors
    };
  }

  return {
    ok: true,
    verified: true,
    status: 'TRUSTED_PRINCIPAL_RESOLVED',
    principal: Object.freeze(principal),
    errors: []
  };
}

/**
 * Construye un fallo público sanitizado para errores inesperados del repositorio.
 *
 * @return {Object} Resultado fail-closed sin detalles internos.
 */
function aerpBuildAuthorizationMetadataUnexpectedError_() {
  const now = new Date().toISOString();

  return {
    ok: false,
    status: 'AUTHORIZATION_METADATA_UNEXPECTED_ERROR',
    request: {
      companyId: ''
    },
    roles: [],
    modules: [],
    permissions: [],
    errors: ['Authorization metadata could not be resolved.'],
    repositoryVersion: AERP_AUTH_METADATA_REPOSITORY_VERSION,
    startedAt: now,
    finishedAt: now
  };
}

/* ============================================================================
 * 5. OPTIONS
 * ============================================================================
 */

/**
 * Normaliza las opciones del repositorio.
 *
 * @param {Object=} options Opciones recibidas.
 * @return {Object}
 */
function aerpBuildAuthorizationMetadataRepositoryOptions_(options) {
  const source = options && typeof options === 'object' ? options : {};

  return {
    ignoreEmptyRows: source.ignoreEmptyRows !== false,

    trimTextValues: source.trimTextValues !== false,

    caseInsensitiveHeaders: source.caseInsensitiveHeaders !== false,

    failOnMissingTable: source.failOnMissingTable !== false
  };
}

/* ============================================================================
 * 6. TABLE READER
 * ============================================================================
 */

/**
 * Lee una tabla de metadatos desde una hoja de Google Sheets.
 *
 * Convierte cada fila en un objeto utilizando la primera fila como cabecera.
 *
 * @param {string} tableName Nombre de la hoja.
 * @param {Object=} options Opciones de lectura.
 * @return {Object} Resultado normalizado.
 */
function aerpReadAuthorizationMetadataTable_(tableName, options) {
  const repositoryOptions = aerpBuildAuthorizationMetadataRepositoryOptions_(options);

  const normalizedTableName = aerpNormalizeAuthorizationMetadataString_(tableName);

  if (!normalizedTableName) {
    return {
      ok: false,
      status: 'INVALID_TABLE_NAME',
      tableName: normalizedTableName,
      headers: [],
      rows: [],
      rowCount: 0,
      errors: ['tableName is required.']
    };
  }

  const injectedResult = aerpReadInjectedAuthorizationMetadataTable_(
    normalizedTableName,
    options,
    repositoryOptions
  );

  if (injectedResult) {
    return injectedResult;
  }

  const spreadsheet = aerpGetAuthorizationMetadataSpreadsheet_();

  if (!spreadsheet) {
    return {
      ok: false,
      status: 'SPREADSHEET_NOT_AVAILABLE',
      tableName: normalizedTableName,
      headers: [],
      rows: [],
      rowCount: 0,
      errors: ['Authorization metadata spreadsheet is not available.']
    };
  }

  const sheet = spreadsheet.getSheetByName(normalizedTableName);

  if (!sheet) {
    const errorMessage = 'Authorization metadata table not found: ' + normalizedTableName;

    if (repositoryOptions.failOnMissingTable) {
      return {
        ok: false,
        status: 'TABLE_NOT_FOUND',
        tableName: normalizedTableName,
        headers: [],
        rows: [],
        rowCount: 0,
        errors: [errorMessage]
      };
    }

    return {
      ok: true,
      status: 'TABLE_NOT_FOUND_IGNORED',
      tableName: normalizedTableName,
      headers: [],
      rows: [],
      rowCount: 0,
      errors: []
    };
  }

  const lastRow = sheet.getLastRow();

  const lastColumn = sheet.getLastColumn();

  if (lastRow < 1 || lastColumn < 1) {
    return {
      ok: true,
      status: 'EMPTY_TABLE',
      tableName: normalizedTableName,
      headers: [],
      rows: [],
      rowCount: 0,
      errors: []
    };
  }

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();

  if (!Array.isArray(values) || values.length === 0) {
    return {
      ok: true,
      status: 'EMPTY_TABLE',
      tableName: normalizedTableName,
      headers: [],
      rows: [],
      rowCount: 0,
      errors: []
    };
  }

  const headers = aerpNormalizeAuthorizationMetadataHeaders_(values[0], repositoryOptions);
  const headersValidation = aerpValidateAuthorizationMetadataHeaders_(headers);

  if (!headersValidation.ok) {
    return {
      ok: false,
      status: headersValidation.status || 'METADATA_SCHEMA_INVALID',
      tableName: normalizedTableName,
      headers: headers,
      rows: [],
      rowCount: 0,
      errors: Array.isArray(headersValidation.errors) ? headersValidation.errors : []
    };
  }
  const dataRows = values.slice(1);

  const rows = dataRows
    .map(function (row, index) {
      return aerpBuildAuthorizationMetadataRow_(headers, row, index + 2, repositoryOptions);
    })
    .filter(function (row) {
      if (repositoryOptions.ignoreEmptyRows !== true) {
        return true;
      }

      return row.__isEmpty !== true;
    })
    .map(function (row) {
      const cleanRow = Object.assign({}, row);

      delete cleanRow.__isEmpty;

      return cleanRow;
    });

  return {
    ok: true,
    status: 'TABLE_READ',
    tableName: normalizedTableName,
    headers: headers,
    rows: rows,
    rowCount: rows.length,
    errors: []
  };
}

/**
 * Lee metadata sintética exclusivamente para pruebas backend habilitadas.
 * La inyección solo se acepta desde options internas y nunca desde request.
 *
 * @param {string} tableName Tabla solicitada.
 * @param {Object=} options Opciones internas.
 * @param {Object} repositoryOptions Opciones normalizadas.
 * @return {Object|null} Resultado sintético, rechazo fail-closed o null.
 */
function aerpReadInjectedAuthorizationMetadataTable_(tableName, options, repositoryOptions) {
  const source = options && typeof options === 'object' ? options : {};

  if (!Object.prototype.hasOwnProperty.call(source, 'testAuthorizationMetadataTables')) {
    return null;
  }

  if (!aerpIsAuthorizationTestModeEnabled_()) {
    return {
      ok: false,
      status: 'TEST_METADATA_INJECTION_DISABLED',
      tableName: tableName,
      headers: [],
      rows: [],
      rowCount: 0,
      errors: ['Authorization metadata test injection is disabled.']
    };
  }

  const tables = source.testAuthorizationMetadataTables;

  if (
    !tables ||
    typeof tables !== 'object' ||
    !Object.prototype.hasOwnProperty.call(tables, tableName)
  ) {
    return {
      ok: false,
      status: 'TEST_METADATA_TABLE_NOT_CONFIGURED',
      tableName: tableName,
      headers: [],
      rows: [],
      rowCount: 0,
      errors: ['Authorization metadata test table is not configured.']
    };
  }

  return aerpBuildAuthorizationMetadataTableResultFromValues_(
    tableName,
    tables[tableName],
    repositoryOptions
  );
}

/**
 * Construye un resultado de tabla a partir de valores sintéticos de pruebas.
 *
 * @param {string} tableName Tabla solicitada.
 * @param {*} values Matriz con cabecera y filas.
 * @param {Object} repositoryOptions Opciones normalizadas.
 * @return {Object} Resultado de tabla normalizado.
 */
function aerpBuildAuthorizationMetadataTableResultFromValues_(
  tableName,
  values,
  repositoryOptions
) {
  if (!Array.isArray(values) || values.length === 0 || !Array.isArray(values[0])) {
    return {
      ok: false,
      status: 'TEST_METADATA_TABLE_INVALID',
      tableName: tableName,
      headers: [],
      rows: [],
      rowCount: 0,
      errors: ['Authorization metadata test table is invalid.']
    };
  }

  const headers = aerpNormalizeAuthorizationMetadataHeaders_(values[0], repositoryOptions);
  const headersValidation = aerpValidateAuthorizationMetadataHeaders_(headers);

  if (!headersValidation.ok) {
    return {
      ok: false,
      status: headersValidation.status || 'METADATA_SCHEMA_INVALID',
      tableName: tableName,
      headers: headers,
      rows: [],
      rowCount: 0,
      errors: Array.isArray(headersValidation.errors) ? headersValidation.errors : []
    };
  }

  const rows = values
    .slice(1)
    .map(function (row, index) {
      return aerpBuildAuthorizationMetadataRow_(headers, row, index + 2, repositoryOptions);
    })
    .filter(function (row) {
      return repositoryOptions.ignoreEmptyRows !== true || row.__isEmpty !== true;
    })
    .map(function (row) {
      const cleanRow = Object.assign({}, row);

      delete cleanRow.__isEmpty;

      return cleanRow;
    });

  return {
    ok: true,
    status: 'TEST_METADATA_TABLE_READ',
    tableName: tableName,
    headers: headers,
    rows: rows,
    rowCount: rows.length,
    errors: []
  };
}

/**
 * Obtiene el Spreadsheet activo utilizado por el repositorio.
 *
 * Esta función queda aislada para permitir sustituir el origen
 * en el futuro sin modificar el Table Reader.
 *
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function aerpGetAuthorizationMetadataSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Normaliza las cabeceras de una tabla.
 *
 * @param {Array} headers Cabeceras originales.
 * @param {Object} options Opciones del repositorio.
 * @return {string[]}
 */
function aerpNormalizeAuthorizationMetadataHeaders_(headers, options) {
  const source = Array.isArray(headers) ? headers : [];

  return source.map(function (header, index) {
    let normalizedHeader = aerpNormalizeAuthorizationMetadataString_(header);

    if (!normalizedHeader) {
      normalizedHeader = 'COLUMN_' + String(index + 1);
    }

    if (options && options.caseInsensitiveHeaders === true) {
      normalizedHeader = normalizedHeader.toUpperCase();
    }

    return normalizedHeader;
  });
}
/**
 * Valida que las cabeceras normalizadas sean únicas.
 *
 * @param {string[]} headers Cabeceras normalizadas.
 * @return {Object} Resultado de validación.
 */
function aerpValidateAuthorizationMetadataHeaders_(headers) {
  const source = Array.isArray(headers) ? headers : [];

  const seen = {};

  const duplicates = [];

  source.forEach(function (header) {
    if (Object.prototype.hasOwnProperty.call(seen, header)) {
      if (duplicates.indexOf(header) === -1) {
        duplicates.push(header);
      }

      return;
    }

    seen[header] = true;
  });

  if (duplicates.length > 0) {
    return {
      ok: false,
      status: 'DUPLICATE_HEADER',
      duplicates: duplicates,
      errors: ['Duplicate normalized authorization metadata headers: ' + duplicates.join(', ')]
    };
  }

  return {
    ok: true,
    status: 'VALID_HEADERS',
    duplicates: [],
    errors: []
  };
}
/**
 * Valida que un campo semántico de seguridad
 * no esté representado por más de un alias.
 *
 * @param {string[]} headers Cabeceras normalizadas.
 * @param {string[]} aliases Alias reconocidos.
 * @param {string} fieldName Nombre lógico del campo.
 * @return {Object} Resultado de validación.
 */
function aerpValidateAuthorizationMetadataFieldAliases_(headers, aliases, fieldName) {
  const sourceHeaders = Array.isArray(headers) ? headers : [];

  const sourceAliases = Array.isArray(aliases) ? aliases : [];

  const matches = sourceAliases.filter(function (alias) {
    return sourceHeaders.indexOf(alias) !== -1;
  });

  if (matches.length > 1) {
    return {
      ok: false,
      status: 'AMBIGUOUS_SECURITY_FIELD',
      field: fieldName,
      matches: matches,
      errors: ['Ambiguous authorization metadata field "' + fieldName + '": ' + matches.join(', ')]
    };
  }

  return {
    ok: true,
    status: 'VALID_SECURITY_FIELD',
    field: fieldName,
    matches: matches,
    errors: []
  };
}

/**
 * Construye un objeto a partir de una fila.
 *
 * Añade __rowNumber para trazabilidad interna.
 *
 * @param {string[]} headers Cabeceras normalizadas.
 * @param {Array} values Valores de la fila.
 * @param {number} rowNumber Número real de fila en la hoja.
 * @param {Object} options Opciones del repositorio.
 * @return {Object}
 */
function aerpBuildAuthorizationMetadataRow_(headers, values, rowNumber, options) {
  const row = {};

  let isEmpty = true;

  headers.forEach(function (header, index) {
    let value = values[index];

    if (options && options.trimTextValues === true && typeof value === 'string') {
      value = value.trim();
    }

    if (value !== '' && value !== null && value !== undefined) {
      isEmpty = false;
    }

    row[header] = value;
  });

  row.__rowNumber = rowNumber;

  row.__isEmpty = isEmpty;

  return row;
}

/* ============================================================================
 * 7. USER ROLE RESOLVER
 * ============================================================================
 */

/**
 * Resuelve los roles asignados a un usuario.
 *
 * Fuente:
 *   CORE_USUARIO_ROL
 *
 * La función:
 *   - Lee la tabla mediante el Table Reader.
 *   - Detecta las columnas relevantes.
 *   - Filtra por usuario.
 *   - Filtra obligatoriamente por empresa.
 *   - Ignora asignaciones inactivas.
 *   - Elimina roles duplicados.
 *
 * @param {string} userId Identificador del usuario.
 * @param {string} companyId Identificador obligatorio de empresa.
 * @param {Object=} options Opciones del repositorio.
 * @return {Object} Resultado de resolución.
 */
function aerpResolveAuthorizationUserRoles_(userId, companyId, options) {
  const normalizedUserId = aerpNormalizeAuthorizationMetadataString_(userId);

  const normalizedCompanyId = aerpNormalizeAuthorizationMetadataString_(companyId);

  if (!normalizedUserId) {
    return {
      ok: false,
      status: 'INVALID_USER_ID',
      userId: normalizedUserId,
      companyId: normalizedCompanyId,
      roles: [],
      modules: [],
      permissions: [],
      assignments: [],
      authorizationRules: [],
      errors: ['userId is required.']
    };
  }
  if (!normalizedCompanyId) {
    return {
      ok: false,
      status: 'INVALID_COMPANY_ID',
      userId: normalizedUserId,
      companyId: normalizedCompanyId,
      roles: [],
      modules: [],
      permissions: [],
      assignments: [],
      authorizationRules: [],
      errors: ['companyId is required.']
    };
  }

  const tableResult = aerpReadAuthorizationMetadataTable_(
    AERP_AUTH_METADATA_TABLES.USER_ROLE,
    options
  );

  if (!tableResult.ok) {
    return {
      ok: false,
      status: 'USER_ROLE_TABLE_ERROR',
      userId: normalizedUserId,
      companyId: normalizedCompanyId,
      roles: [],
      modules: [],
      permissions: [],
      assignments: [],
      authorizationRules: [],
      errors: ['Could not read CORE_USUARIO_ROL.']
    };
  }

  const headers = tableResult.headers;

  const userColumnResult = aerpResolveAuthorizationMetadataSecurityColumn_(
    headers,
    ['ID_USUARIO', 'USER_ID', 'USUARIO_ID', 'ID_USER', 'USUARIO', 'EMAIL', 'CORREO'],
    'userId'
  );

  if (!userColumnResult.ok) {
    return aerpBuildAuthorizationUserRoleSchemaError_(
      userColumnResult,
      normalizedUserId,
      normalizedCompanyId
    );
  }

  const roleColumnResult = aerpResolveAuthorizationMetadataSecurityColumn_(
    headers,
    ['ID_ROL', 'ROLE_ID', 'ROL_ID', 'ROL', 'ROLE'],
    'roleId'
  );

  if (!roleColumnResult.ok) {
    return aerpBuildAuthorizationUserRoleSchemaError_(
      roleColumnResult,
      normalizedUserId,
      normalizedCompanyId
    );
  }

  const companyColumnResult = aerpResolveAuthorizationMetadataSecurityColumn_(
    headers,
    ['ID_EMPRESA', 'COMPANY_ID', 'EMPRESA_ID', 'EMPRESA', 'COMPANY'],
    'companyId'
  );

  if (!companyColumnResult.ok) {
    return aerpBuildAuthorizationUserRoleSchemaError_(
      companyColumnResult,
      normalizedUserId,
      normalizedCompanyId
    );
  }

  const activeColumnResult = aerpResolveAuthorizationMetadataSecurityColumn_(
    headers,
    ['ACTIVO', 'ACTIVE', 'ES_ACTIVO', 'IS_ACTIVE', 'HABILITADO', 'ENABLED'],
    'active'
  );

  if (!activeColumnResult.ok) {
    return aerpBuildAuthorizationUserRoleSchemaError_(
      activeColumnResult,
      normalizedUserId,
      normalizedCompanyId
    );
  }

  const userColumn = userColumnResult.column;

  const roleColumn = roleColumnResult.column;

  const companyColumn = companyColumnResult.column;

  const activeColumn = activeColumnResult.column;

  const normalizedUserLookup = normalizedUserId.toUpperCase();

  const normalizedCompanyLookup = normalizedCompanyId.toUpperCase();

  const relevantRows = tableResult.rows.filter(function (row) {
    const rowUserId = aerpNormalizeAuthorizationMetadataString_(row[userColumn]).toUpperCase();

    const rowRoleId = aerpNormalizeAuthorizationMetadataString_(row[roleColumn]).toUpperCase();

    const rowCompanyId = aerpNormalizeAuthorizationMetadataString_(
      row[companyColumn]
    ).toUpperCase();

    /*
     * Ignora filas sin datos funcionales de autorización.
     *
     * Algunas hojas pueden contener filas físicamente presentes
     * con valores predeterminados como false en ACTIVO o PRINCIPAL.
     * Una asignación solo es válida si tiene usuario y rol.
     */
    if (!rowUserId || !rowRoleId) {
      return false;
    }

    return rowUserId === normalizedUserLookup && rowCompanyId === normalizedCompanyLookup;
  });

  const activationError = aerpFindAuthorizationMetadataActivationError_(
    relevantRows,
    activeColumn,
    AERP_AUTH_METADATA_TABLES.USER_ROLE
  );

  if (activationError) {
    return aerpBuildAuthorizationMetadataResolutionFailure_(
      activationError.status,
      normalizedUserId,
      normalizedCompanyId,
      activationError.errors
    );
  }

  const assignments = relevantRows.filter(function (row) {
    return aerpResolveAuthorizationMetadataActiveValue_(row[activeColumn]).active === true;
  });

  const roles = assignments
    .map(function (row) {
      return aerpNormalizeAuthorizationMetadataString_(row[roleColumn]).toUpperCase();
    })
    .filter(function (role) {
      return Boolean(role);
    })
    .filter(function (role, index, source) {
      return source.indexOf(role) === index;
    });

  return {
    ok: true,

    status: roles.length > 0 ? 'USER_ROLES_RESOLVED' : 'NO_USER_ROLES',

    userId: normalizedUserId,

    companyId: normalizedCompanyId,

    roles: roles,

    assignments: assignments,

    roleCount: roles.length,

    assignmentCount: assignments.length,

    schema: {
      userColumn: userColumn,

      roleColumn: roleColumn,

      companyColumn: companyColumn,

      activeColumn: activeColumn
    },

    errors: []
  };
}

/**
 * Resuelve los módulos autorizados para uno o múltiples roles.
 *
 * Fuente:
 * CORE_ROL_MODULO
 *
 * Reglas:
 * - Ignora filas sin ROL o MODULO.
 * - Ignora relaciones inactivas.
 * - Permite resolver múltiples roles.
 * - Elimina módulos duplicados.
 * - Conserva VISIBLE_MENU como metadata.
 *
 * @param {string[]} roles Roles que deben resolverse.
 * @param {Object=} options Opciones de resolución.
 * @return {Object} Resultado normalizado.
 */
/**
 * Resuelve los módulos autorizados para uno o múltiples roles.
 *
 * Aplica aislamiento obligatorio por empresa y validación estricta
 * del schema de seguridad.
 *
 * @param {string[]} roles Roles que deben resolverse.
 * @param {string} companyId Identificador obligatorio de empresa.
 * @param {Object=} options Opciones de resolución.
 * @return {Object} Resultado normalizado.
 */
function aerpResolveAuthorizationRoleModules_(roles, companyId, options) {
  const normalizedCompanyId = aerpNormalizeAuthorizationMetadataString_(companyId);

  if (!normalizedCompanyId) {
    return aerpBuildAuthorizationMetadataResolutionFailure_(
      'INVALID_COMPANY_ID',
      '',
      normalizedCompanyId,
      ['companyId is required.']
    );
  }

  const normalizedCompanyLookup = normalizedCompanyId.toUpperCase();

  const normalizedRoles = Array.isArray(roles)
    ? roles
        .map(function (role) {
          return aerpNormalizeAuthorizationMetadataString_(role).toUpperCase();
        })
        .filter(function (role) {
          return Boolean(role);
        })
    : [];

  const uniqueRoles = Array.from(new Set(normalizedRoles));

  if (uniqueRoles.length === 0) {
    return aerpBuildAuthorizationMetadataResolutionFailure_(
      'INVALID_ROLE_INPUT',
      '',
      normalizedCompanyId,
      ['At least one valid role is required.']
    );
  }

  const tableResult = aerpReadAuthorizationMetadataTable_(
    AERP_AUTH_METADATA_TABLES.ROLE_MODULE,
    options
  );

  if (!tableResult.ok) {
    return aerpBuildAuthorizationMetadataResolutionFailure_(
      'ROLE_MODULE_TABLE_READ_FAILED',
      '',
      normalizedCompanyId,
      ['Could not read CORE_ROL_MODULO.']
    );
  }

  const headers = tableResult.headers;

  const roleColumnResult = aerpResolveAuthorizationMetadataSecurityColumn_(
    headers,
    ['ID_ROL', 'ROLE_ID', 'ROL_ID', 'ROL', 'ROLE'],
    'roleId'
  );

  if (!roleColumnResult.ok) {
    return aerpBuildAuthorizationMetadataResolutionFailure_(
      roleColumnResult.status || 'ROLE_MODULE_SCHEMA_INVALID',
      '',
      normalizedCompanyId,
      Array.isArray(roleColumnResult.errors) ? roleColumnResult.errors : []
    );
  }

  const moduleColumnResult = aerpResolveAuthorizationMetadataSecurityColumn_(
    headers,
    ['ID_MODULO', 'MODULE_ID', 'MODULO_ID', 'MODULO', 'MODULE'],
    'moduleId'
  );

  if (!moduleColumnResult.ok) {
    return aerpBuildAuthorizationMetadataResolutionFailure_(
      moduleColumnResult.status || 'ROLE_MODULE_SCHEMA_INVALID',
      '',
      normalizedCompanyId,
      Array.isArray(moduleColumnResult.errors) ? moduleColumnResult.errors : []
    );
  }

  const companyColumnResult = aerpResolveAuthorizationMetadataSecurityColumn_(
    headers,
    ['ID_EMPRESA', 'COMPANY_ID', 'EMPRESA_ID', 'EMPRESA', 'COMPANY'],
    'companyId'
  );

  if (!companyColumnResult.ok) {
    return aerpBuildAuthorizationMetadataResolutionFailure_(
      companyColumnResult.status || 'ROLE_MODULE_SCHEMA_INVALID',
      '',
      normalizedCompanyId,
      Array.isArray(companyColumnResult.errors) ? companyColumnResult.errors : []
    );
  }

  const activeColumnResult = aerpResolveAuthorizationMetadataSecurityColumn_(
    headers,
    ['ACTIVO', 'ACTIVE', 'ES_ACTIVO', 'IS_ACTIVE', 'HABILITADO', 'ENABLED'],
    'active'
  );

  if (!activeColumnResult.ok) {
    return aerpBuildAuthorizationMetadataResolutionFailure_(
      activeColumnResult.status || 'ROLE_MODULE_SCHEMA_INVALID',
      '',
      normalizedCompanyId,
      Array.isArray(activeColumnResult.errors) ? activeColumnResult.errors : []
    );
  }

  const roleColumn = roleColumnResult.column;

  const moduleColumn = moduleColumnResult.column;

  const companyColumn = companyColumnResult.column;

  const activeColumn = activeColumnResult.column;

  const visibleMenuColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'VISIBLE_MENU',
    'MENU_VISIBLE',
    'VISIBLE_EN_MENU',
    'SHOW_IN_MENU',
    'MENU_VISIBILITY'
  ]);

  const relevantRows = tableResult.rows.filter(function (row) {
    const rowRole = aerpNormalizeAuthorizationMetadataString_(row[roleColumn]).toUpperCase();

    const rowModule = aerpNormalizeAuthorizationMetadataString_(row[moduleColumn]).toUpperCase();

    const rowCompanyId = aerpNormalizeAuthorizationMetadataString_(
      row[companyColumn]
    ).toUpperCase();

    return (
      Boolean(rowRole && rowModule && rowCompanyId) &&
      uniqueRoles.indexOf(rowRole) !== -1 &&
      rowCompanyId === normalizedCompanyLookup
    );
  });

  const activationError = aerpFindAuthorizationMetadataActivationError_(
    relevantRows,
    activeColumn,
    AERP_AUTH_METADATA_TABLES.ROLE_MODULE
  );

  if (activationError) {
    return aerpBuildAuthorizationMetadataResolutionFailure_(
      activationError.status,
      '',
      normalizedCompanyId,
      activationError.errors
    );
  }

  const assignments = relevantRows
    .filter(function (row) {
      return aerpResolveAuthorizationMetadataActiveValue_(row[activeColumn]).active === true;
    })
    .map(function (row) {
      return {
        role: aerpNormalizeAuthorizationMetadataString_(row[roleColumn]).toUpperCase(),

        module: aerpNormalizeAuthorizationMetadataString_(row[moduleColumn]).toUpperCase(),

        companyId: aerpNormalizeAuthorizationMetadataString_(row[companyColumn]),

        visibleMenu: visibleMenuColumn
          ? aerpIsAuthorizationMetadataActiveValue_(row[visibleMenuColumn])
          : false,

        rowNumber: row.__rowNumber
      };
    });

  const moduleMap = {};

  assignments.forEach(function (assignment) {
    const moduleId = assignment.module;

    if (!moduleMap[moduleId]) {
      moduleMap[moduleId] = {
        module: moduleId,

        companyId: normalizedCompanyId,

        visibleMenu: assignment.visibleMenu,

        roles: []
      };
    }

    if (assignment.visibleMenu) {
      moduleMap[moduleId].visibleMenu = true;
    }

    if (moduleMap[moduleId].roles.indexOf(assignment.role) === -1) {
      moduleMap[moduleId].roles.push(assignment.role);
    }
  });

  const moduleDetails = Object.keys(moduleMap).map(function (moduleId) {
    return moduleMap[moduleId];
  });

  const modules = moduleDetails.map(function (item) {
    return item.module;
  });

  return {
    ok: true,

    status: 'ROLE_MODULES_RESOLVED',

    companyId: normalizedCompanyId,

    roles: uniqueRoles,

    modules: modules,

    moduleCount: modules.length,

    moduleDetails: moduleDetails,

    assignments: assignments,

    errors: []
  };
}

/**
 * Resuelve el contexto completo de autorización de un usuario.
 *
 * Flujo:
 *   userId + companyId
 *        ↓
 *   CORE_USUARIO_ROL
 *        ↓
 *   roles[]
 *        ↓
 *   CORE_ROL_MODULO
 *        ↓
 *   modules[]
 *
 * @param {string} userId Identificador del usuario.
 * @param {string} companyId Identificador obligatorio de empresa.
 * @param {Object=} options Opciones del repositorio.
 * @return {Object} Contexto de autorización resuelto.
 */
function aerpResolveAuthorizationContext_(userId, companyId, options) {
  const startedAt = new Date();

  const normalizedUserId = aerpNormalizeAuthorizationMetadataString_(userId);

  const normalizedCompanyId = aerpNormalizeAuthorizationMetadataString_(companyId);

  if (!normalizedUserId) {
    const failure = aerpBuildAuthorizationMetadataResolutionFailure_(
      'INVALID_USER_ID',
      normalizedUserId,
      normalizedCompanyId,
      ['userId is required.']
    );

    failure.startedAt = startedAt.toISOString();
    failure.finishedAt = new Date().toISOString();

    return failure;
  }

  if (!normalizedCompanyId) {
    const failure = aerpBuildAuthorizationMetadataResolutionFailure_(
      'INVALID_COMPANY_ID',
      normalizedUserId,
      normalizedCompanyId,
      ['companyId is required.']
    );

    failure.startedAt = startedAt.toISOString();
    failure.finishedAt = new Date().toISOString();

    return failure;
  }

  const roleResult = aerpResolveAuthorizationUserRoles_(
    normalizedUserId,
    normalizedCompanyId,
    options
  );

  if (!roleResult.ok) {
    const failure = aerpBuildAuthorizationMetadataResolutionFailure_(
      'USER_ROLE_RESOLUTION_FAILED',
      normalizedUserId,
      normalizedCompanyId,
      ['Could not resolve user roles.']
    );

    failure.startedAt = startedAt.toISOString();
    failure.finishedAt = new Date().toISOString();

    return failure;
  }

  /*
   * No tener roles no es un error técnico.
   *
   * Es un contexto válido sin autorizaciones asignadas.
   */
  if (roleResult.roles.length === 0) {
    return {
      ok: true,

      status: 'AUTHORIZATION_CONTEXT_EMPTY',

      userId: normalizedUserId,

      companyId: normalizedCompanyId,

      roles: [],

      modules: [],

      moduleDetails: [],

      roleAssignments: roleResult.assignments || [],

      moduleAssignments: [],

      errors: [],

      startedAt: startedAt.toISOString(),

      finishedAt: new Date().toISOString()
    };
  }

  const moduleResult = aerpResolveAuthorizationRoleModules_(
    roleResult.roles,
    normalizedCompanyId,
    options
  );

  if (!moduleResult.ok) {
    const failure = aerpBuildAuthorizationMetadataResolutionFailure_(
      'ROLE_MODULE_RESOLUTION_FAILED',
      normalizedUserId,
      normalizedCompanyId,
      ['Could not resolve role modules.']
    );

    failure.startedAt = startedAt.toISOString();
    failure.finishedAt = new Date().toISOString();

    return failure;
  }
  /*
   * Resolver permisos efectivos para los roles
   * y módulos obtenidos del contexto.
   */
  const permissionResult = aerpResolveAuthorizationPermissions_(
    roleResult.roles,
    moduleResult.modules,
    normalizedCompanyId,
    options
  );

  if (!permissionResult.ok) {
    const failure = aerpBuildAuthorizationMetadataResolutionFailure_(
      'PERMISSION_RESOLUTION_FAILED',
      normalizedUserId,
      normalizedCompanyId,
      ['Could not resolve authorization permissions.']
    );

    failure.startedAt = startedAt.toISOString();
    failure.finishedAt = new Date().toISOString();

    return failure;
  }

  /*
   * Transformar los permisos resueltos
   * en reglas consumibles por AERP-036.
   */
  const ruleResult = aerpBuildAuthorizationRulesFromPermissions_(permissionResult.permissions);

  if (!ruleResult.ok) {
    const failure = aerpBuildAuthorizationMetadataResolutionFailure_(
      'AUTHORIZATION_RULE_BUILD_FAILED',
      normalizedUserId,
      normalizedCompanyId,
      ['Could not build authorization rules.']
    );

    failure.startedAt = startedAt.toISOString();
    failure.finishedAt = new Date().toISOString();

    return failure;
  }

  const finishedAt = new Date();

  return {
    ok: true,

    status: 'AUTHORIZATION_CONTEXT_RESOLVED',

    userId: normalizedUserId,

    companyId: normalizedCompanyId,

    roles: roleResult.roles,

    roleCount: roleResult.roles.length,

    modules: moduleResult.modules,

    moduleCount: moduleResult.modules.length,

    moduleDetails: moduleResult.moduleDetails,
    permissions: permissionResult.permissions,

    permissionCount: permissionResult.permissionCount,

    authorizationRules: ruleResult.rules,

    authorizationRuleCount: ruleResult.ruleCount,

    roleAssignments: roleResult.assignments,

    moduleAssignments: moduleResult.assignments,

    repositoryVersion: AERP_AUTH_METADATA_REPOSITORY_VERSION,

    errors: [],

    startedAt: startedAt.toISOString(),

    finishedAt: finishedAt.toISOString(),

    durationMs: finishedAt.getTime() - startedAt.getTime()
  };
}

/**
 * Resuelve los permisos aplicables para uno o múltiples roles y módulos.
 *
 * Fuente:
 * CORE_PERMISOS
 *
 * @param {string[]} roles Roles resueltos.
 * @param {string[]} modules Módulos resueltos.
 * @param {Object=} options Opciones del repositorio.
 * @return {Object} Resultado normalizado.
 */
/**
 * Resuelve los permisos aplicables para uno o múltiples
 * roles y módulos dentro de una empresa.
 *
 * Aplica aislamiento obligatorio por tenant y validación
 * estricta de los campos principales del schema.
 *
 * @param {string[]} roles Roles resueltos.
 * @param {string[]} modules Módulos resueltos.
 * @param {string} companyId Identificador obligatorio de empresa.
 * @param {Object=} options Opciones del repositorio.
 * @return {Object} Resultado normalizado.
 */
function aerpResolveAuthorizationPermissions_(roles, modules, companyId, options) {
  const normalizedCompanyId = aerpNormalizeAuthorizationMetadataString_(companyId);

  if (!normalizedCompanyId) {
    return aerpBuildAuthorizationPermissionFailure_('INVALID_COMPANY_ID', normalizedCompanyId, [
      'companyId is required.'
    ]);
  }

  const normalizedCompanyLookup = normalizedCompanyId.toUpperCase();

  const normalizedRoles = Array.isArray(roles)
    ? roles
        .map(function (role) {
          return aerpNormalizeAuthorizationMetadataString_(role).toUpperCase();
        })
        .filter(function (role) {
          return Boolean(role);
        })
    : [];

  const normalizedModules = Array.isArray(modules)
    ? modules
        .map(function (moduleId) {
          return aerpNormalizeAuthorizationMetadataString_(moduleId).toUpperCase();
        })
        .filter(function (moduleId) {
          return Boolean(moduleId);
        })
    : [];

  const uniqueRoles = Array.from(new Set(normalizedRoles));

  const uniqueModules = Array.from(new Set(normalizedModules));

  if (uniqueRoles.length === 0) {
    return aerpBuildAuthorizationPermissionFailure_(
      'INVALID_PERMISSION_ROLE_INPUT',
      normalizedCompanyId,
      ['At least one valid role is required.']
    );
  }

  if (uniqueModules.length === 0) {
    return aerpBuildAuthorizationPermissionFailure_(
      'INVALID_PERMISSION_MODULE_INPUT',
      normalizedCompanyId,
      ['At least one valid module is required.']
    );
  }

  const tableResult = aerpReadAuthorizationMetadataTable_(
    AERP_AUTH_METADATA_TABLES.PERMISSION,
    options
  );

  if (!tableResult.ok) {
    return aerpBuildAuthorizationPermissionFailure_(
      'PERMISSION_TABLE_READ_FAILED',
      normalizedCompanyId,
      ['Could not read CORE_PERMISOS.']
    );
  }

  const headers = tableResult.headers;

  const permissionIdColumnResult = aerpResolveAuthorizationMetadataSecurityColumn_(
    headers,
    ['ID_PERMISO', 'PERMISSION_ID', 'PERMISO_ID'],
    'permissionId'
  );

  if (!permissionIdColumnResult.ok) {
    return aerpBuildAuthorizationPermissionFailure_(
      permissionIdColumnResult.status || 'PERMISSION_SCHEMA_INVALID',
      normalizedCompanyId,
      Array.isArray(permissionIdColumnResult.errors) ? permissionIdColumnResult.errors : []
    );
  }

  const roleColumnResult = aerpResolveAuthorizationMetadataSecurityColumn_(
    headers,
    ['ROL', 'ID_ROL', 'ROLE', 'ROLE_ID'],
    'roleId'
  );

  if (!roleColumnResult.ok) {
    return aerpBuildAuthorizationPermissionFailure_(
      roleColumnResult.status || 'PERMISSION_SCHEMA_INVALID',
      normalizedCompanyId,
      Array.isArray(roleColumnResult.errors) ? roleColumnResult.errors : []
    );
  }

  const moduleColumnResult = aerpResolveAuthorizationMetadataSecurityColumn_(
    headers,
    ['MODULO', 'ID_MODULO', 'MODULE', 'MODULE_ID'],
    'moduleId'
  );

  if (!moduleColumnResult.ok) {
    return aerpBuildAuthorizationPermissionFailure_(
      moduleColumnResult.status || 'PERMISSION_SCHEMA_INVALID',
      normalizedCompanyId,
      Array.isArray(moduleColumnResult.errors) ? moduleColumnResult.errors : []
    );
  }

  const companyColumnResult = aerpResolveAuthorizationMetadataSecurityColumn_(
    headers,
    ['ID_EMPRESA', 'COMPANY_ID', 'EMPRESA_ID', 'EMPRESA', 'COMPANY'],
    'companyId'
  );

  if (!companyColumnResult.ok) {
    return aerpBuildAuthorizationPermissionFailure_(
      companyColumnResult.status || 'PERMISSION_SCHEMA_INVALID',
      normalizedCompanyId,
      Array.isArray(companyColumnResult.errors) ? companyColumnResult.errors : []
    );
  }

  const activeColumnResult = aerpResolveAuthorizationMetadataSecurityColumn_(
    headers,
    ['ACTIVO', 'ACTIVE', 'ES_ACTIVO', 'IS_ACTIVE', 'HABILITADO', 'ENABLED'],
    'active'
  );

  if (!activeColumnResult.ok) {
    return aerpBuildAuthorizationPermissionFailure_(
      activeColumnResult.status || 'PERMISSION_SCHEMA_INVALID',
      normalizedCompanyId,
      Array.isArray(activeColumnResult.errors) ? activeColumnResult.errors : []
    );
  }

  const permissionIdColumn = permissionIdColumnResult.column;

  const roleColumn = roleColumnResult.column;

  const moduleColumn = moduleColumnResult.column;

  const companyColumn = companyColumnResult.column;

  const activeColumn = activeColumnResult.column;

  const accessLevelColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'NIVEL_ACCESO',
    'ACCESS_LEVEL'
  ]);

  const actionAliases = {
    VIEW: ['PUEDE_VER', 'CAN_VIEW'],
    CREATE: ['PUEDE_CREAR', 'CAN_CREATE'],
    EDIT: ['PUEDE_EDITAR', 'CAN_EDIT'],
    DELETE: ['PUEDE_ELIMINAR', 'CAN_DELETE'],
    APPROVE: ['PUEDE_APROBAR', 'CAN_APPROVE'],
    EXPORT: ['PUEDE_EXPORTAR', 'CAN_EXPORT'],
    IMPORT: ['PUEDE_IMPORTAR', 'CAN_IMPORT'],
    PRINT: ['PUEDE_IMPRIMIR', 'CAN_PRINT'],
    ADMINISTER: ['PUEDE_ADMINISTRAR', 'CAN_ADMINISTER']
  };

  const actionColumns = {};
  const actionNames = Object.keys(actionAliases);

  for (let index = 0; index < actionNames.length; index += 1) {
    const action = actionNames[index];
    const actionColumnResult = aerpResolveAuthorizationMetadataSecurityColumn_(
      headers,
      actionAliases[action],
      'action.' + action
    );

    if (!actionColumnResult.ok) {
      return aerpBuildAuthorizationPermissionFailure_(
        actionColumnResult.status,
        normalizedCompanyId,
        actionColumnResult.errors
      );
    }

    actionColumns[action] = actionColumnResult.column;
  }

  const relevantRows = tableResult.rows.filter(function (row) {
    const rowRole = aerpNormalizeAuthorizationMetadataString_(row[roleColumn]).toUpperCase();

    const rowModule = aerpNormalizeAuthorizationMetadataString_(row[moduleColumn]).toUpperCase();

    const rowCompanyId = aerpNormalizeAuthorizationMetadataString_(
      row[companyColumn]
    ).toUpperCase();

    const rowPermissionId = aerpNormalizeAuthorizationMetadataString_(row[permissionIdColumn]);

    return (
      Boolean(rowPermissionId && rowRole && rowModule && rowCompanyId) &&
      uniqueRoles.indexOf(rowRole) !== -1 &&
      uniqueModules.indexOf(rowModule) !== -1 &&
      rowCompanyId === normalizedCompanyLookup
    );
  });

  const activationError = aerpFindAuthorizationMetadataActivationError_(
    relevantRows,
    activeColumn,
    AERP_AUTH_METADATA_TABLES.PERMISSION
  );

  if (activationError) {
    return aerpBuildAuthorizationPermissionFailure_(
      activationError.status,
      normalizedCompanyId,
      activationError.errors
    );
  }

  const assignments = relevantRows
    .filter(function (row) {
      return aerpResolveAuthorizationMetadataActiveValue_(row[activeColumn]).active === true;
    })
    .map(function (row) {
      const actions = {};

      Object.keys(actionColumns).forEach(function (action) {
        const column = actionColumns[action];

        actions[action] = aerpIsAuthorizationMetadataActiveValue_(row[column]);
      });

      return {
        permissionId: aerpNormalizeAuthorizationMetadataString_(row[permissionIdColumn]),

        companyId: aerpNormalizeAuthorizationMetadataString_(row[companyColumn]),

        role: aerpNormalizeAuthorizationMetadataString_(row[roleColumn]).toUpperCase(),

        module: aerpNormalizeAuthorizationMetadataString_(row[moduleColumn]).toUpperCase(),

        accessLevel: accessLevelColumn
          ? aerpNormalizeAuthorizationMetadataString_(row[accessLevelColumn]).toUpperCase()
          : '',

        actions: actions,

        rowNumber: row.__rowNumber
      };
    });

  return {
    ok: true,

    status: assignments.length > 0 ? 'PERMISSIONS_RESOLVED' : 'NO_PERMISSIONS',

    companyId: normalizedCompanyId,

    roles: uniqueRoles,

    modules: uniqueModules,

    permissions: assignments,

    permissionCount: assignments.length,

    assignments: assignments,

    actionColumns: actionColumns,

    errors: []
  };
}

/**
 * Convierte permisos normalizados en reglas compatibles
 * con AERP-036 Authorization Engine.
 *
 * Cada acción genera una regla independiente.
 *
 * true  -> ALLOW
 * false -> DENY
 *
 * @param {Object[]} permissions Permisos normalizados.
 * @param {Object=} options Opciones del adapter.
 * @return {Object} Resultado de construcción de reglas.
 */
function aerpBuildAuthorizationRulesFromPermissions_(permissions, options) {
  const sourcePermissions = Array.isArray(permissions) ? permissions : [];

  const adapterOptions = options && typeof options === 'object' ? options : {};

  const priority = Number.isFinite(Number(adapterOptions.priority))
    ? Number(adapterOptions.priority)
    : 100;

  const resourceType =
    aerpNormalizeAuthorizationMetadataString_(adapterOptions.resourceType).toUpperCase() ||
    'MODULE';

  const rules = [];

  sourcePermissions.forEach(function (permission) {
    if (!permission || typeof permission !== 'object') {
      return;
    }

    const permissionId =
      aerpNormalizeAuthorizationMetadataString_(permission.permissionId) || 'PERMISSION';

    const role = aerpNormalizeAuthorizationMetadataString_(permission.role).toUpperCase();

    const moduleId = aerpNormalizeAuthorizationMetadataString_(permission.module).toUpperCase();

    const actions =
      permission.actions && typeof permission.actions === 'object' ? permission.actions : {};

    if (!role || !moduleId) {
      return;
    }

    Object.keys(actions).forEach(function (action) {
      const normalizedAction = aerpNormalizeAuthorizationMetadataString_(action).toUpperCase();

      if (!normalizedAction) {
        return;
      }

      const allowed = actions[action] === true;

      rules.push({
        id: permissionId + '_' + normalizedAction,

        name: 'Permission rule ' + permissionId + ' ' + normalizedAction,

        description: 'Generated from CORE_PERMISOS.',

        enabled: true,

        effect: allowed ? 'ALLOW' : 'DENY',

        priority: priority,

        subjectTypes: ['USER'],

        roles: [role],

        actions: [normalizedAction],

        resourceTypes: [resourceType],

        resourceIds: [moduleId],

        conditions: [],

        metadata: {
          source: 'CORE_PERMISOS',

          permissionId: permissionId,

          accessLevel: permission.accessLevel || '',

          rowNumber: permission.rowNumber || null
        }
      });
    });
  });

  return {
    ok: true,

    status: rules.length > 0 ? 'AUTHORIZATION_RULES_BUILT' : 'NO_AUTHORIZATION_RULES',

    permissionsProcessed: sourcePermissions.length,

    rules: rules,

    ruleCount: rules.length,

    errors: []
  };
}

/**
 * Ejecuta una autorización utilizando metadatos reales de Alef ERP.
 *
 * Flujo:
 *   userId + companyId
 *        ↓
 *   Authorization Metadata Repository
 *        ↓
 *   roles[]
 *        ↓
 *   modules[]
 *        ↓
 *   permissions[]
 *        ↓
 *   authorizationRules[]
 *        ↓
 *   AERP-036 Authorization Engine
 *        ↓
 *   ALLOW / DENY
 *
 * @param {Object} request Solicitud de autorización basada en metadatos.
 * @param {*} request.authentication Evidencia opaca de autenticación.
 * @param {string} request.companyId Empresa activa obligatoria.
 * @param {string} request.action Acción solicitada.
 * @param {string} request.moduleId Módulo solicitado.
 * @param {Object=} request.context Contexto adicional.
 * @param {Object=} options Opciones internas de ejecución.
 * @param {Function} options.trustedPrincipalVerifier Verificador backend.
 * @return {Object} Resultado integrado de autorización.
 */
function aerpAuthorizeFromMetadata(request, options) {
  try {
    return aerpAuthorizeFromMetadataImpl_(request, options);
  } catch (error) {
    return aerpBuildMetadataAuthorizationUnexpectedError_();
  }
}

/**
 * Implementación interna de la autorización integrada basada en metadata.
 *
 * @param {Object} request Solicitud de autorización basada en metadatos.
 * @param {Object=} options Opciones internas de ejecución.
 * @return {Object} Resultado integrado de autorización.
 */
function aerpAuthorizeFromMetadataImpl_(request, options) {
  const startedAt = new Date();

  const source = request && typeof request === 'object' ? request : {};

  const principalResult = aerpResolveTrustedAuthorizationPrincipal_(source, options);

  if (!principalResult.ok) {
    return {
      ok: false,
      status: principalResult.status,
      decision: 'DENY',
      allowed: false,
      trustedPrincipal: null,
      errors: principalResult.errors,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString()
    };
  }

  const userId = principalResult.principal.userId;

  const companyId = aerpNormalizeAuthorizationMetadataString_(source.companyId);

  const action = aerpNormalizeAuthorizationMetadataString_(source.action).toUpperCase();

  const moduleId = aerpNormalizeAuthorizationMetadataString_(source.moduleId).toUpperCase();

  const context = source.context && typeof source.context === 'object' ? source.context : {};

  /*
   * Validación mínima antes de consultar metadatos.
   */
  const validationErrors = [];

  if (!companyId) {
    validationErrors.push('companyId is required.');
  }

  if (!action) {
    validationErrors.push('action is required.');
  }

  if (!moduleId) {
    validationErrors.push('moduleId is required.');
  }

  const contextHasCompanyId = Object.prototype.hasOwnProperty.call(context, 'companyId');

  const contextCompanyId = contextHasCompanyId
    ? aerpNormalizeAuthorizationMetadataString_(context.companyId)
    : '';

  if (contextHasCompanyId && contextCompanyId.toUpperCase() !== companyId.toUpperCase()) {
    validationErrors.push('request.context.companyId must match request.companyId.');
  }

  if (validationErrors.length > 0) {
    return {
      ok: false,

      status: 'INVALID_METADATA_AUTHORIZATION_REQUEST',

      decision: 'DENY',

      allowed: false,

      errors: validationErrors,

      startedAt: startedAt.toISOString(),

      finishedAt: new Date().toISOString()
    };
  }

  /*
   * Resolver contexto completo desde AERP-037.
   */
  const metadataContext = aerpResolveAuthorizationContext_(userId, companyId, options);

  if (!metadataContext.ok) {
    return {
      ok: false,

      status: 'AUTHORIZATION_METADATA_RESOLUTION_FAILED',

      decision: 'DENY',

      allowed: false,

      roles: [],

      modules: [],

      permissions: [],

      assignments: [],

      authorizationRules: [],

      errors: ['Could not resolve authorization metadata.'],

      startedAt: startedAt.toISOString(),

      finishedAt: new Date().toISOString()
    };
  }

  /*
   * Construir la solicitud exacta que consume AERP-036.
   */
  const authorizationRequest = {
    subject: {
      id: userId,

      type: 'USER',

      roles: metadataContext.roles,

      attributes: {
        companyId: companyId,

        authenticationIssuer: principalResult.principal.issuer,

        authenticationSubjectId: principalResult.principal.subjectId
      }
    },

    action: action,

    resource: {
      type: 'MODULE',

      id: moduleId,

      attributes: {}
    },

    context: Object.assign({}, context, {
      companyId: companyId,

      authenticatedUserId: userId,

      authenticationIssuer: principalResult.principal.issuer,

      authenticationSubjectId: principalResult.principal.subjectId
    })
  };

  /*
   * Entregar las reglas generadas por AERP-037
   * al Authorization Engine AERP-036.
   */
  const authorizationResult = aerpAuthorize(authorizationRequest, {
    rules: metadataContext.authorizationRules,

    traceEnabled: true,

    decisionPolicy: options && options.decisionPolicy ? options.decisionPolicy : undefined
  });

  const finishedAt = new Date();

  return {
    ok: true,

    status: 'METADATA_AUTHORIZATION_EVALUATED',

    userId: userId,

    trustedPrincipal: principalResult.principal,

    companyId: companyId,

    action: action,

    moduleId: moduleId,

    roles: metadataContext.roles,

    modules: metadataContext.modules,

    permissionCount: metadataContext.permissionCount,

    authorizationRuleCount: metadataContext.authorizationRuleCount,

    decisionId: authorizationResult.decisionId,

    decision: authorizationResult.decision,

    allowed: authorizationResult.allowed,

    reason: authorizationResult.reason,

    matchedRule: authorizationResult.matchedRule,

    decisionSummary: authorizationResult.decisionSummary || null,

    trace: authorizationResult.trace,

    engineResult: authorizationResult,

    metadataContext: metadataContext,

    startedAt: startedAt.toISOString(),

    finishedAt: finishedAt.toISOString(),

    durationMs: finishedAt.getTime() - startedAt.getTime()
  };
}

/**
 * Construye un DENY sanitizado para errores inesperados de autorización.
 *
 * @return {Object} Resultado fail-closed sin detalles internos.
 */
function aerpBuildMetadataAuthorizationUnexpectedError_() {
  const now = new Date().toISOString();

  return {
    ok: false,
    status: 'METADATA_AUTHORIZATION_UNEXPECTED_ERROR',
    decision: 'DENY',
    allowed: false,
    trustedPrincipal: null,
    errors: ['Metadata authorization could not be evaluated.'],
    startedAt: now,
    finishedAt: now
  };
}

/* ============================================================================
 * 8. COLUMN RESOLVER
 * ============================================================================
 */

/**
 * Busca el primer nombre de columna existente entre varios candidatos.
 *
 * Permite desacoplar el repositorio de pequeñas variaciones en los nombres
 * físicos de las columnas de Google Sheets.
 *
 * @param {string[]} headers Cabeceras disponibles.
 * @param {string[]} candidates Nombres candidatos.
 * @return {?string} Cabecera encontrada o null.
 */
function aerpResolveAuthorizationMetadataColumn_(headers, candidates) {
  const availableHeaders = Array.isArray(headers)
    ? headers.map(function (header) {
        return aerpNormalizeAuthorizationMetadataString_(header).toUpperCase();
      })
    : [];

  const expectedCandidates = Array.isArray(candidates) ? candidates : [];

  for (let index = 0; index < expectedCandidates.length; index += 1) {
    const candidate = aerpNormalizeAuthorizationMetadataString_(
      expectedCandidates[index]
    ).toUpperCase();

    if (availableHeaders.indexOf(candidate) !== -1) {
      return candidate;
    }
  }

  return null;
}
/**
 * Resuelve de forma estricta una columna de metadata de seguridad.
 *
 * Debe existir exactamente un alias reconocido.
 *
 * @param {string[]} headers Cabeceras disponibles.
 * @param {string[]} candidates Alias reconocidos.
 * @param {string} fieldName Nombre lógico del campo.
 * @return {Object} Resultado de resolución.
 */
function aerpResolveAuthorizationMetadataSecurityColumn_(headers, candidates, fieldName) {
  const availableHeaders = Array.isArray(headers)
    ? headers.map(function (header) {
        return aerpNormalizeAuthorizationMetadataString_(header).toUpperCase();
      })
    : [];

  const expectedCandidates = Array.isArray(candidates)
    ? candidates.map(function (candidate) {
        return aerpNormalizeAuthorizationMetadataString_(candidate).toUpperCase();
      })
    : [];

  const matches = expectedCandidates.filter(function (candidate) {
    return availableHeaders.indexOf(candidate) !== -1;
  });

  if (matches.length === 0) {
    return {
      ok: false,
      status: 'REQUIRED_SECURITY_FIELD_MISSING',
      field: fieldName,
      column: null,
      matches: [],
      errors: ['Required authorization metadata field "' + fieldName + '" could not be resolved.']
    };
  }

  if (matches.length > 1) {
    return {
      ok: false,
      status: 'AMBIGUOUS_SECURITY_FIELD',
      field: fieldName,
      column: null,
      matches: matches,
      errors: ['Ambiguous authorization metadata field "' + fieldName + '": ' + matches.join(', ')]
    };
  }

  return {
    ok: true,
    status: 'SECURITY_FIELD_RESOLVED',
    field: fieldName,
    column: matches[0],
    matches: matches,
    errors: []
  };
}

/**
 * Construye un fallo de schema fail-closed para CORE_USUARIO_ROL.
 *
 * @param {Object} columnResult Resultado del resolver estricto.
 * @param {string} userId Usuario normalizado.
 * @param {string} companyId Empresa normalizada.
 * @return {Object} Resultado sin asignaciones parciales.
 */
function aerpBuildAuthorizationUserRoleSchemaError_(columnResult, userId, companyId) {
  const source = columnResult && typeof columnResult === 'object' ? columnResult : {};

  return aerpBuildAuthorizationMetadataResolutionFailure_(
    source.status || 'USER_ROLE_SCHEMA_ERROR',
    userId,
    companyId,
    Array.isArray(source.errors) ? source.errors : ['CORE_USUARIO_ROL schema is invalid.']
  );
}

/**
 * Construye una respuesta uniforme sin resultados parciales de autorización.
 *
 * @param {string} status Estado controlado por AERP-037.
 * @param {string} userId Usuario normalizado o vacío.
 * @param {string} companyId Empresa normalizada o vacía.
 * @param {string[]} errors Errores públicos fijos.
 * @return {Object} Fallo de resolución sanitizado.
 */
function aerpBuildAuthorizationMetadataResolutionFailure_(status, userId, companyId, errors) {
  return {
    ok: false,
    status: status,
    userId: userId || '',
    companyId: companyId || '',
    roles: [],
    modules: [],
    moduleDetails: [],
    permissions: [],
    assignments: [],
    roleAssignments: [],
    moduleAssignments: [],
    authorizationRules: [],
    roleCount: 0,
    moduleCount: 0,
    permissionCount: 0,
    authorizationRuleCount: 0,
    errors: Array.isArray(errors) ? errors : ['Authorization metadata resolution failed.']
  };
}

/**
 * Construye un fallo uniforme del resolver de permisos.
 *
 * @param {string} status Estado controlado por AERP-037.
 * @param {string} companyId Empresa normalizada.
 * @param {string[]} errors Errores públicos fijos.
 * @return {Object} Fallo sin permisos ni reglas parciales.
 */
function aerpBuildAuthorizationPermissionFailure_(status, companyId, errors) {
  const result = aerpBuildAuthorizationMetadataResolutionFailure_(status, '', companyId, errors);

  result.actionColumns = {};

  return result;
}

/**
 * Interpreta de forma estricta un valor de activación.
 *
 * @param {*} value Valor de metadata.
 * @return {{ok: boolean, active: boolean, status: string, errors: string[]}}
 */
function aerpResolveAuthorizationMetadataActiveValue_(value) {
  if (value === true || value === 1) {
    return {
      ok: true,
      active: true,
      status: 'VALID_ACTIVE_VALUE',
      errors: []
    };
  }

  if (value === false || value === 0) {
    return {
      ok: true,
      active: false,
      status: 'VALID_INACTIVE_VALUE',
      errors: []
    };
  }

  if (value === null || value === undefined) {
    return {
      ok: false,
      active: false,
      status: 'INVALID_AUTHORIZATION_METADATA_ACTIVE_VALUE',
      errors: ['Authorization metadata activation value is invalid.']
    };
  }

  const normalizedValue = aerpNormalizeAuthorizationMetadataString_(value).toUpperCase();

  if (!normalizedValue) {
    return {
      ok: false,
      active: false,
      status: 'INVALID_AUTHORIZATION_METADATA_ACTIVE_VALUE',
      errors: ['Authorization metadata activation value is invalid.']
    };
  }

  if (['1', 'SI', 'SÍ', 'YES', 'Y', 'ACTIVO', 'ACTIVE', 'TRUE'].indexOf(normalizedValue) !== -1) {
    return {
      ok: true,
      active: true,
      status: 'VALID_ACTIVE_VALUE',
      errors: []
    };
  }

  if (['0', 'NO', 'N', 'INACTIVO', 'INACTIVE', 'FALSE'].indexOf(normalizedValue) !== -1) {
    return {
      ok: true,
      active: false,
      status: 'VALID_INACTIVE_VALUE',
      errors: []
    };
  }

  return {
    ok: false,
    active: false,
    status: 'INVALID_AUTHORIZATION_METADATA_ACTIVE_VALUE',
    errors: ['Authorization metadata activation value is invalid.']
  };
}

/**
 * Detecta valores de activación inválidos antes de devolver resultados parciales.
 *
 * @param {Object[]} rows Filas relevantes para el tenant y sujeto.
 * @param {string} activeColumn Columna de activación resuelta.
 * @param {string} tableName Tabla de origen.
 * @return {Object|null} Error sanitizado o null.
 */
function aerpFindAuthorizationMetadataActivationError_(rows, activeColumn, tableName) {
  const sourceRows = Array.isArray(rows) ? rows : [];

  for (let index = 0; index < sourceRows.length; index += 1) {
    const activationResult = aerpResolveAuthorizationMetadataActiveValue_(
      sourceRows[index][activeColumn]
    );

    if (!activationResult.ok) {
      return {
        status: 'INVALID_AUTHORIZATION_METADATA_ACTIVE_VALUE',
        errors: [
          'Invalid activation metadata in ' +
            aerpNormalizeAuthorizationMetadataString_(tableName) +
            '.'
        ]
      };
    }
  }

  return null;
}

/**
 * Determina si un valor representa un registro activo.
 *
 * Valores considerados activos:
 *   true
 *   1
 *   SI
 *   SÍ
 *   YES
 *   Y
 *   ACTIVO
 *   ACTIVE
 *
 * @param {*} value Valor recibido.
 * @return {boolean}
 */
function aerpIsAuthorizationMetadataActiveValue_(value) {
  const result = aerpResolveAuthorizationMetadataActiveValue_(value);

  return result.ok === true && result.active === true;
}

/* ============================================================================
 * 9. NORMALIZATION HELPERS
 * ============================================================================
 */

/**
 * Convierte un valor en texto limpio.
 *
 * @param {*} value Valor recibido.
 * @return {string}
 */
function aerpNormalizeAuthorizationMetadataString_(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

/* ============================================================================
 * 10. FOUNDATION TESTS
 * ============================================================================
 */

/**
 * Comprueba el modo de pruebas mediante una propiedad exclusiva del backend.
 * Cualquier ausencia, valor distinto o excepción mantiene las pruebas deshabilitadas.
 *
 * @return {boolean} true únicamente para el valor exacto ENABLED.
 */
function aerpIsAuthorizationTestModeEnabled_() {
  try {
    return (
      PropertiesService.getScriptProperties().getProperty('AERP_AUTHORIZATION_TEST_MODE') ===
      'ENABLED'
    );
  } catch (error) {
    return false;
  }
}

/**
 * Impide ejecutar entry points de prueba cuando el modo backend está deshabilitado.
 */
function aerpRequireAuthorizationTestMode_() {
  if (!aerpIsAuthorizationTestModeEnabled_()) {
    throw new Error('AUTHORIZATION_TEST_MODE_DISABLED');
  }
}

/**
 * Verificador inyectable utilizado exclusivamente por las pruebas de AERP-037.
 * Simula una autenticación ya validada por el backend y nunca consulta
 * request.userId.
 *
 * @param {Object} input Entrada segura entregada al verificador.
 * @return {Object}
 */
function aerpTestTrustedPrincipalVerifier_(input) {
  if (!aerpIsAuthorizationTestModeEnabled_()) {
    return {
      ok: false,
      verified: false,
      status: 'UNAUTHENTICATED',
      principal: null,
      errors: ['Authentication evidence could not be verified.']
    };
  }

  if (
    !input ||
    !input.authentication ||
    input.authentication.testToken !== 'AERP_TEST_AUTHENTICATION'
  ) {
    return {
      ok: false,
      verified: false,
      status: 'UNAUTHENTICATED',
      principal: null,
      errors: ['Test authentication evidence is invalid.']
    };
  }

  return {
    ok: true,
    verified: true,
    status: 'TEST_PRINCIPAL_VERIFIED',
    principal: {
      issuer: 'urn:alef:test-identity-provider',
      subjectId: 'TEST_SUBJECT_001',
      userId: 'usuario.test@alef.local',
      authenticationMethod: 'TEST'
    },
    errors: []
  };
}

/**
 * Construye las opciones internas empleadas por pruebas autenticadas.
 *
 * @return {Object}
 */
function aerpBuildAuthorizationTestOptions_() {
  return {
    trustedPrincipalVerifier: aerpTestTrustedPrincipalVerifier_
  };
}

/**
 * Construye la evidencia de autenticación utilizada por pruebas.
 *
 * @return {Object}
 */
function aerpBuildAuthorizationTestAuthentication_() {
  return {
    testToken: 'AERP_TEST_AUTHENTICATION'
  };
}

/**
 * Construye las nueve columnas de acción obligatorias de CORE_PERMISOS.
 *
 * @return {string[]}
 */
function aerpBuildAuthorizationPermissionTestActionHeaders_() {
  return [
    'PUEDE_VER',
    'PUEDE_CREAR',
    'PUEDE_EDITAR',
    'PUEDE_ELIMINAR',
    'PUEDE_APROBAR',
    'PUEDE_EXPORTAR',
    'PUEDE_IMPORTAR',
    'PUEDE_IMPRIMIR',
    'PUEDE_ADMINISTRAR'
  ];
}

/**
 * Construye tablas sintéticas mínimas para el flujo integrado.
 *
 * @param {*} userRoleActive Activación de usuario-rol.
 * @param {*} roleModuleActive Activación de rol-módulo.
 * @param {*} permissionActive Activación de permiso.
 * @return {Object} Tablas 2D inyectables únicamente en tests backend.
 */
function aerpBuildAuthorizationSyntheticTables_(
  userRoleActive,
  roleModuleActive,
  permissionActive
) {
  const permissionHeaders = ['ID_PERMISO', 'ID_ROL', 'ID_MODULO', 'ID_EMPRESA', 'ACTIVO'].concat(
    aerpBuildAuthorizationPermissionTestActionHeaders_()
  );

  return {
    CORE_USUARIO_ROL: [
      ['ID_USUARIO', 'ID_ROL', 'ID_EMPRESA', 'ACTIVO'],
      ['usuario.test@alef.local', 'ROL_TEST', 'EMPRESA_TEST', userRoleActive]
    ],
    CORE_ROL_MODULO: [
      ['ID_ROL', 'ID_MODULO', 'ID_EMPRESA', 'ACTIVO'],
      ['ROL_TEST', 'MODULO_TEST_AUTORIZACION', 'EMPRESA_TEST', roleModuleActive]
    ],
    CORE_PERMISOS: [
      permissionHeaders,
      [
        'PERMISO_TEST',
        'ROL_TEST',
        'MODULO_TEST_AUTORIZACION',
        'EMPRESA_TEST',
        permissionActive,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true
      ]
    ]
  };
}

/**
 * Construye opciones de prueba con metadata sintética y verificador backend.
 *
 * @param {Object} tables Tablas sintéticas.
 * @return {Object} Opciones internas de prueba.
 */
function aerpBuildAuthorizationSyntheticTestOptions_(tables) {
  return {
    trustedPrincipalVerifier: aerpTestTrustedPrincipalVerifier_,
    testAuthorizationMetadataTables: tables
  };
}

/**
 * Verifica que un fallo no contenga resultados parciales ni objetos internos.
 *
 * @param {Object} result Resultado de resolver o entry point público.
 */
function aerpAssertAuthorizationFailureCollectionsEmpty_(result) {
  const fields = ['roles', 'modules', 'permissions', 'assignments', 'authorizationRules'];

  fields.forEach(function (field) {
    if (!Array.isArray(result[field]) || result[field].length !== 0) {
      throw new Error('Expected empty failure collection: ' + field);
    }
  });

  ['roleResult', 'moduleResult', 'permissionResult', 'ruleResult', 'metadataContext'].forEach(
    function (field) {
      if (Object.prototype.hasOwnProperty.call(result, field)) {
        throw new Error('Unexpected raw metadata failure field: ' + field);
      }
    }
  );
}

/**
 * Comprueba el contrato inicial del repositorio.
 */
function testAuthorizationMetadataRepositoryFoundation() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpLoadAuthorizationMetadata(
    {
      companyId: 'EMPRESA_001',

      authentication: aerpBuildAuthorizationTestAuthentication_()
    },
    aerpBuildAuthorizationTestOptions_()
  );

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    throw new Error('Authorization Metadata Repository Foundation must return ok=true.');
  }

  if (result.status !== 'AUTHORIZATION_CONTEXT_EMPTY') {
    throw new Error('Expected status AUTHORIZATION_CONTEXT_EMPTY.');
  }

  if (result.roles.length !== 0 || result.modules.length !== 0 || result.permissions.length !== 0) {
    throw new Error('Expected empty authorization metadata for EMPRESA_001.');
  }

  if (result.request.userId !== 'usuario.test@alef.local') {
    throw new Error('The userId was not normalized correctly.');
  }

  console.log('AERP-037 Authorization Metadata Repository Foundation: OK');

  return result;
}

/**
 * Comprueba que una solicitud sin companyId sea rechazada.
 */
function testAuthorizationMetadataRepositoryInvalidRequest() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpLoadAuthorizationMetadata(
    {
      authentication: aerpBuildAuthorizationTestAuthentication_()
    },
    aerpBuildAuthorizationTestOptions_()
  );

  console.log(JSON.stringify(result, null, 2));

  if (result.ok) {
    throw new Error('An authorization metadata request without companyId must fail.');
  }

  if (result.status !== 'INVALID_REQUEST') {
    throw new Error('Expected status INVALID_REQUEST.');
  }

  if (result.errors.length === 0) {
    throw new Error('Expected validation errors.');
  }

  console.log('AERP-037 Authorization Metadata Repository Invalid Request: OK');

  return result;
}

/**
 * Comprueba que el Table Reader pueda leer una tabla real.
 *
 * Utiliza CORE_USUARIO_ROL como tabla de prueba inicial.
 */
function testAuthorizationMetadataTableReader() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpReadAuthorizationMetadataTable_(AERP_AUTH_METADATA_TABLES.USER_ROLE);

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    throw new Error('Authorization Metadata Table Reader failed: ' + result.errors.join(' | '));
  }

  if (result.tableName !== AERP_AUTH_METADATA_TABLES.USER_ROLE) {
    throw new Error('Unexpected table name.');
  }

  if (!Array.isArray(result.headers)) {
    throw new Error('Expected headers array.');
  }

  if (!Array.isArray(result.rows)) {
    throw new Error('Expected rows array.');
  }

  console.log('AERP-037 Authorization Metadata Table Reader: OK');

  return result;
}

/**
 * Comprueba el comportamiento ante una tabla inexistente.
 */
function testAuthorizationMetadataTableReaderMissingTable() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpReadAuthorizationMetadataTable_('AERP_TABLE_DOES_NOT_EXIST');

  console.log(JSON.stringify(result, null, 2));

  if (result.ok) {
    throw new Error('Missing table must fail when failOnMissingTable=true.');
  }

  if (result.status !== 'TABLE_NOT_FOUND') {
    throw new Error('Expected status TABLE_NOT_FOUND.');
  }

  console.log('AERP-037 Authorization Metadata Missing Table Test: OK');

  return result;
}

/**
 * Diagnóstico del esquema real de CORE_USUARIO_ROL.
 *
 * No requiere conocer previamente un usuario válido.
 */
function testAuthorizationUserRoleSchema() {
  aerpRequireAuthorizationTestMode_();

  const tableResult = aerpReadAuthorizationMetadataTable_(AERP_AUTH_METADATA_TABLES.USER_ROLE);

  if (!tableResult.ok) {
    throw new Error('Could not read CORE_USUARIO_ROL: ' + tableResult.errors.join(' | '));
  }

  const headers = tableResult.headers;

  const result = {
    tableName: tableResult.tableName,

    rowCount: tableResult.rowCount,

    headers: headers,

    detectedSchema: {
      userColumn: aerpResolveAuthorizationMetadataColumn_(headers, [
        'ID_USUARIO',
        'USER_ID',
        'USUARIO_ID',
        'ID_USER',
        'USUARIO',
        'EMAIL',
        'CORREO'
      ]),

      roleColumn: aerpResolveAuthorizationMetadataColumn_(headers, [
        'ID_ROL',
        'ROLE_ID',
        'ROL_ID',
        'ROL',
        'ROLE'
      ]),

      companyColumn: aerpResolveAuthorizationMetadataColumn_(headers, [
        'ID_EMPRESA',
        'COMPANY_ID',
        'EMPRESA_ID',
        'EMPRESA',
        'COMPANY'
      ]),

      activeColumn: aerpResolveAuthorizationMetadataColumn_(headers, [
        'ACTIVO',
        'ACTIVE',
        'ES_ACTIVO',
        'IS_ACTIVE',
        'HABILITADO',
        'ENABLED'
      ])
    },

    sampleRows: tableResult.rows.slice(0, 3)
  };

  console.log(JSON.stringify(result, null, 2));

  if (!result.detectedSchema.userColumn) {
    throw new Error('Could not resolve the user column in CORE_USUARIO_ROL.');
  }

  if (!result.detectedSchema.roleColumn) {
    throw new Error('Could not resolve the role column in CORE_USUARIO_ROL.');
  }

  console.log('AERP-037 User Role Schema Test: OK');

  return result;
}

/**
 * Busca automáticamente la primera asignación real de CORE_USUARIO_ROL
 * y comprueba que el User Role Resolver pueda resolver sus roles.
 */
function testAuthorizationUserRoleResolver() {
  aerpRequireAuthorizationTestMode_();

  const tableResult = aerpReadAuthorizationMetadataTable_(AERP_AUTH_METADATA_TABLES.USER_ROLE);

  if (!tableResult.ok) {
    throw new Error('Could not read CORE_USUARIO_ROL: ' + tableResult.errors.join(' | '));
  }

  const headers = tableResult.headers;

  const userColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'ID_USUARIO',
    'USER_ID',
    'USUARIO_ID',
    'ID_USER',
    'USUARIO',
    'EMAIL',
    'CORREO'
  ]);

  const roleColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'ID_ROL',
    'ROLE_ID',
    'ROL_ID',
    'ROL',
    'ROLE'
  ]);

  const companyColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'ID_EMPRESA',
    'COMPANY_ID',
    'EMPRESA_ID',
    'EMPRESA',
    'COMPANY'
  ]);

  const activeColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'ACTIVO',
    'ACTIVE',
    'ES_ACTIVO',
    'IS_ACTIVE',
    'HABILITADO',
    'ENABLED'
  ]);

  if (!userColumn || !roleColumn) {
    throw new Error('Required USER or ROLE column could not be resolved.');
  }

  const sampleAssignment = tableResult.rows.find(function (row) {
    const userId = aerpNormalizeAuthorizationMetadataString_(row[userColumn]);

    const roleId = aerpNormalizeAuthorizationMetadataString_(row[roleColumn]);

    if (!userId || !roleId) {
      return false;
    }

    if (activeColumn && !aerpIsAuthorizationMetadataActiveValue_(row[activeColumn])) {
      return false;
    }

    return true;
  });

  if (!sampleAssignment) {
    throw new Error('No valid active user-role assignment was found in CORE_USUARIO_ROL.');
  }

  const userId = aerpNormalizeAuthorizationMetadataString_(sampleAssignment[userColumn]);

  const companyId = companyColumn
    ? aerpNormalizeAuthorizationMetadataString_(sampleAssignment[companyColumn])
    : '';

  const expectedRole = aerpNormalizeAuthorizationMetadataString_(
    sampleAssignment[roleColumn]
  ).toUpperCase();

  const result = aerpResolveAuthorizationUserRoles_(userId, companyId);

  console.log(
    JSON.stringify(
      {
        sampleAssignment: sampleAssignment,

        resolvedResult: result
      },
      null,
      2
    )
  );

  if (!result.ok) {
    throw new Error('User Role Resolver failed: ' + result.errors.join(' | '));
  }

  if (result.roles.indexOf(expectedRole) === -1) {
    throw new Error('Expected role was not resolved: ' + expectedRole);
  }

  if (result.status !== 'USER_ROLES_RESOLVED') {
    throw new Error('Expected status USER_ROLES_RESOLVED.');
  }

  console.log('AERP-037 User Role Resolver Test: OK');

  return result;
}

/**
 * Diagnóstico de asignaciones reales en CORE_USUARIO_ROL.
 *
 * Busca filas con USUARIO y ROL informados, sin exigir que ACTIVO sea true.
 */
function testAuthorizationUserRoleDataDiagnostic() {
  aerpRequireAuthorizationTestMode_();

  const tableResult = aerpReadAuthorizationMetadataTable_(AERP_AUTH_METADATA_TABLES.USER_ROLE);

  if (!tableResult.ok) {
    throw new Error('Could not read CORE_USUARIO_ROL: ' + tableResult.errors.join(' | '));
  }

  const headers = tableResult.headers;

  const userColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'ID_USUARIO',
    'USER_ID',
    'USUARIO_ID',
    'ID_USER',
    'USUARIO',
    'EMAIL',
    'CORREO'
  ]);

  const roleColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'ID_ROL',
    'ROLE_ID',
    'ROL_ID',
    'ROL',
    'ROLE'
  ]);

  const companyColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'ID_EMPRESA',
    'COMPANY_ID',
    'EMPRESA_ID',
    'EMPRESA',
    'COMPANY'
  ]);

  const activeColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'ACTIVO',
    'ACTIVE',
    'ES_ACTIVO',
    'IS_ACTIVE',
    'HABILITADO',
    'ENABLED'
  ]);

  const populatedRows = tableResult.rows.filter(function (row) {
    const userId = aerpNormalizeAuthorizationMetadataString_(row[userColumn]);

    const roleId = aerpNormalizeAuthorizationMetadataString_(row[roleColumn]);

    return Boolean(userId && roleId);
  });

  const diagnostic = populatedRows.slice(0, 10).map(function (row) {
    return {
      rowNumber: row.__rowNumber,

      user: row[userColumn],

      role: row[roleColumn],

      company: companyColumn ? row[companyColumn] : null,

      activeRaw: activeColumn ? row[activeColumn] : null,

      activeResolved: activeColumn
        ? aerpIsAuthorizationMetadataActiveValue_(row[activeColumn])
        : true
    };
  });

  const result = {
    totalPhysicalRows: tableResult.rowCount,

    populatedAssignmentCount: populatedRows.length,

    detectedColumns: {
      userColumn: userColumn,

      roleColumn: roleColumn,

      companyColumn: companyColumn,

      activeColumn: activeColumn
    },

    sampleAssignments: diagnostic
  };

  console.log(JSON.stringify(result, null, 2));

  console.log('AERP-037 User Role Data Diagnostic: OK');

  return result;
}

/**
 * Diagnóstico del esquema y datos de CORE_ROL_MODULO.
 *
 * Permite identificar:
 * - columnas reales de la tabla,
 * - cantidad de filas físicas,
 * - primeras filas disponibles,
 * - estructura necesaria para el Role Module Resolver.
 */
function testAuthorizationRoleModuleSchema() {
  aerpRequireAuthorizationTestMode_();

  const tableResult = aerpReadAuthorizationMetadataTable_(AERP_AUTH_METADATA_TABLES.ROLE_MODULE);

  if (!tableResult.ok) {
    throw new Error('Could not read CORE_ROL_MODULO: ' + tableResult.errors.join(' | '));
  }

  const result = {
    tableName: tableResult.tableName,

    rowCount: tableResult.rowCount,

    headers: tableResult.headers,

    sampleRows: tableResult.rows.slice(0, 5)
  };

  console.log(JSON.stringify(result, null, 2));

  console.log('AERP-037 Role Module Schema Test: OK');

  return result;
}

/**
 * Prueba funcional del Role Module Resolver.
 *
 * Utiliza la relación controlada:
 * ROL_TEST_AUTORIZACION
 *        ↓
 * MODULO_TEST_AUTORIZACION
 */
function testAuthorizationRoleModuleResolver() {
  aerpRequireAuthorizationTestMode_();

  const roles = ['ROL_TEST_AUTORIZACION'];

  const result = aerpResolveAuthorizationRoleModules_(roles, 'EMPRESA_TEST', {});

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    throw new Error('Role Module Resolver failed: ' + result.errors.join(' | '));
  }

  if (result.status !== 'ROLE_MODULES_RESOLVED') {
    throw new Error('Expected status ROLE_MODULES_RESOLVED.');
  }

  if (result.modules.indexOf('MODULO_TEST_AUTORIZACION') === -1) {
    throw new Error('Expected module was not resolved: ' + 'MODULO_TEST_AUTORIZACION');
  }

  const moduleDetail = result.moduleDetails.find(function (item) {
    return item.module === 'MODULO_TEST_AUTORIZACION';
  });

  if (!moduleDetail) {
    throw new Error('Expected module detail was not found.');
  }

  if (moduleDetail.visibleMenu !== true) {
    throw new Error('Expected VISIBLE_MENU to resolve as true.');
  }

  console.log('AERP-037 Role Module Resolver Test: OK');

  return result;
}

/**
 * Comprueba que un rol no herede módulos
 * desde otra empresa.
 *
 * @return {Object}
 */
function testAuthorizationRoleModulesCrossTenantDenied() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpResolveAuthorizationRoleModules_(
    ['ROL_TEST_AUTORIZACION'],
    'EMPRESA_OTRA',
    {}
  );

  if (result.ok !== true) {
    throw new Error('Expected a valid empty cross-tenant resolution. Status: ' + result.status);
  }

  if (!Array.isArray(result.modules) || result.modules.length !== 0) {
    throw new Error('Expected zero modules for a different tenant.');
  }

  if (!Array.isArray(result.assignments) || result.assignments.length !== 0) {
    throw new Error('Expected zero role-module assignments for a different tenant.');
  }

  console.log('AERP-037 Cross-Tenant Role Modules Test: OK');

  return result;
}

/**
 * Comprueba el flujo integrado:
 *
 * USUARIO
 *   ↓
 * CORE_USUARIO_ROL
 *   ↓
 * roles[]
 *   ↓
 * CORE_ROL_MODULO
 *   ↓
 * modules[]
 */
function testAuthorizationContextResolver() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpResolveAuthorizationContext_('usuario.test@alef.local', 'EMPRESA_TEST');

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    throw new Error('Authorization Context Resolver failed: ' + result.errors.join(' | '));
  }

  if (result.status !== 'AUTHORIZATION_CONTEXT_RESOLVED') {
    throw new Error('Expected status AUTHORIZATION_CONTEXT_RESOLVED.');
  }

  if (result.roles.indexOf('ROL_TEST_AUTORIZACION') === -1) {
    throw new Error('Expected role was not resolved.');
  }

  if (result.modules.indexOf('MODULO_TEST_AUTORIZACION') === -1) {
    throw new Error('Expected module was not resolved.');
  }

  if (result.roleCount !== 1) {
    throw new Error('Expected roleCount=1.');
  }

  if (result.moduleCount !== 1) {
    throw new Error('Expected moduleCount=1.');
  }

  console.log('AERP-037 Authorization Context Resolver Test: OK');

  return result;
}

/**
 * Comprueba que la Public API del repositorio entregue
 * el contexto completo de autorización.
 */
function testAuthorizationMetadataRepositoryIntegrated() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpLoadAuthorizationMetadata(
    {
      companyId: 'EMPRESA_TEST',

      authentication: aerpBuildAuthorizationTestAuthentication_()
    },
    aerpBuildAuthorizationTestOptions_()
  );

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    throw new Error('Integrated Authorization Metadata Repository failed.');
  }

  if (result.status !== 'AUTHORIZATION_CONTEXT_RESOLVED') {
    throw new Error('Expected AUTHORIZATION_CONTEXT_RESOLVED.');
  }

  if (result.roles.indexOf('ROL_TEST_AUTORIZACION') === -1) {
    throw new Error('Expected role not found.');
  }

  if (result.modules.indexOf('MODULO_TEST_AUTORIZACION') === -1) {
    throw new Error('Expected module not found.');
  }

  console.log('AERP-037 Integrated Metadata Repository Test: OK');

  return result;
}

/**
 * Diagnóstico del esquema y datos de CORE_PERMISOS.
 *
 * Permite identificar:
 * - columnas reales de la tabla,
 * - cantidad de filas físicas,
 * - primeras filas disponibles,
 * - estructura necesaria para construir el Permission Resolver.
 */
function testAuthorizationPermissionSchema() {
  aerpRequireAuthorizationTestMode_();

  const tableResult = aerpReadAuthorizationMetadataTable_(AERP_AUTH_METADATA_TABLES.PERMISSION);

  if (!tableResult.ok) {
    throw new Error('Could not read CORE_PERMISOS: ' + tableResult.errors.join(' | '));
  }

  const result = {
    tableName: tableResult.tableName,

    rowCount: tableResult.rowCount,

    headers: tableResult.headers,

    sampleRows: tableResult.rows.slice(0, 5)
  };

  console.log(JSON.stringify(result, null, 2));

  console.log('AERP-037 Permission Schema Test: OK');

  return result;
}

/**
 * Prueba funcional del Permission Resolver.
 */
function testAuthorizationPermissionResolver() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpResolveAuthorizationPermissions_(
    ['ROL_TEST_AUTORIZACION'],
    ['MODULO_TEST_AUTORIZACION'],
    'EMPRESA_TEST',
    {}
  );

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    throw new Error('Permission Resolver failed: ' + result.errors.join(' | '));
  }

  if (result.status !== 'PERMISSIONS_RESOLVED') {
    throw new Error('Expected status PERMISSIONS_RESOLVED.');
  }

  if (result.permissionCount !== 1) {
    throw new Error('Expected permissionCount=1.');
  }

  const permission = result.permissions[0];

  if (permission.role !== 'ROL_TEST_AUTORIZACION') {
    throw new Error('Unexpected role.');
  }

  if (permission.module !== 'MODULO_TEST_AUTORIZACION') {
    throw new Error('Unexpected module.');
  }

  if (permission.actions.VIEW !== true) {
    throw new Error('Expected VIEW=true.');
  }

  if (permission.actions.CREATE !== true) {
    throw new Error('Expected CREATE=true.');
  }

  if (permission.actions.EDIT !== true) {
    throw new Error('Expected EDIT=true.');
  }

  if (permission.actions.DELETE !== false) {
    throw new Error('Expected DELETE=false.');
  }

  if (permission.actions.ADMINISTER !== false) {
    throw new Error('Expected ADMINISTER=false.');
  }

  console.log('AERP-037 Permission Resolver Test: OK');

  return result;
}

/**
 * Comprueba que el Permission Resolver falle cerrado
 * cuando companyId no está presente.
 *
 * @return {Object}
 */
function testAuthorizationPermissionsRequiresCompanyId() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpResolveAuthorizationPermissions_(
    ['ROL_TEST_AUTORIZACION'],
    ['MODULO_TEST_AUTORIZACION'],
    '',
    {}
  );

  if (result.ok !== false || result.status !== 'INVALID_COMPANY_ID') {
    throw new Error('Expected missing companyId to fail closed in Permission Resolver.');
  }

  console.log('AERP-037 Permission CompanyId Required Test: OK');

  return result;
}

/**
 * Comprueba que permisos de una empresa
 * no se hereden desde otro tenant.
 *
 * @return {Object}
 */
function testAuthorizationPermissionsCrossTenantDenied() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpResolveAuthorizationPermissions_(
    ['ROL_TEST_AUTORIZACION'],
    ['MODULO_TEST_AUTORIZACION'],
    'EMPRESA_OTRA',
    {}
  );

  if (result.ok !== true) {
    throw new Error(
      'Expected valid empty cross-tenant permission resolution. Status: ' + result.status
    );
  }

  if (result.status !== 'NO_PERMISSIONS') {
    throw new Error('Expected status NO_PERMISSIONS for a different tenant.');
  }

  if (!Array.isArray(result.permissions) || result.permissions.length !== 0) {
    throw new Error('Expected zero permissions for a different tenant.');
  }

  if (!Array.isArray(result.assignments) || result.assignments.length !== 0) {
    throw new Error('Expected zero permission assignments for a different tenant.');
  }

  console.log('AERP-037 Cross-Tenant Permissions Test: OK');

  return result;
}

/**
 * Comprueba la conversión:
 *
 * CORE_PERMISOS
 *      ↓
 * Permission Resolver
 *      ↓
 * Permission Rule Adapter
 *      ↓
 * Authorization Rules
 */
function testAuthorizationPermissionRuleAdapter() {
  aerpRequireAuthorizationTestMode_();

  const permissionResult = aerpResolveAuthorizationPermissions_(
    ['ROL_TEST_AUTORIZACION'],
    ['MODULO_TEST_AUTORIZACION'],
    'EMPRESA_TEST',
    {}
  );

  if (!permissionResult.ok) {
    throw new Error('Permission Resolver failed before adapter execution.');
  }

  const ruleResult = aerpBuildAuthorizationRulesFromPermissions_(permissionResult.permissions);

  console.log(JSON.stringify(ruleResult, null, 2));

  if (!ruleResult.ok) {
    throw new Error('Permission Rule Adapter failed.');
  }

  if (ruleResult.status !== 'AUTHORIZATION_RULES_BUILT') {
    throw new Error('Expected AUTHORIZATION_RULES_BUILT.');
  }

  /*
   * CORE_PERMISOS dispone actualmente
   * de nueve acciones configurables.
   */
  if (ruleResult.ruleCount !== 9) {
    throw new Error('Expected ruleCount=9.');
  }

  const editRule = ruleResult.rules.find(function (rule) {
    return rule.actions.indexOf('EDIT') !== -1;
  });

  if (!editRule) {
    throw new Error('EDIT rule was not generated.');
  }

  if (editRule.effect !== 'ALLOW') {
    throw new Error('Expected EDIT effect ALLOW.');
  }

  const deleteRule = ruleResult.rules.find(function (rule) {
    return rule.actions.indexOf('DELETE') !== -1;
  });

  if (!deleteRule) {
    throw new Error('DELETE rule was not generated.');
  }

  if (deleteRule.effect !== 'DENY') {
    throw new Error('Expected DELETE effect DENY.');
  }

  if (editRule.roles.indexOf('ROL_TEST_AUTORIZACION') === -1) {
    throw new Error('Expected role not found in EDIT rule.');
  }

  if (editRule.resourceIds.indexOf('MODULO_TEST_AUTORIZACION') === -1) {
    throw new Error('Expected module not found in EDIT rule.');
  }

  console.log('AERP-037 Permission Rule Adapter Test: OK');

  return ruleResult;
}

/**
 * Comprueba la resolución completa del contexto:
 *
 * Usuario
 *   ↓
 * Roles
 *   ↓
 * Módulos
 *   ↓
 * Permisos
 *   ↓
 * Authorization Rules
 */
function testAuthorizationContextWithPermissions() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpResolveAuthorizationContext_('usuario.test@alef.local', 'EMPRESA_TEST');

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    throw new Error(
      'Authorization Context with Permissions failed: ' + (result.errors || []).join(' | ')
    );
  }

  if (result.status !== 'AUTHORIZATION_CONTEXT_RESOLVED') {
    throw new Error('Expected AUTHORIZATION_CONTEXT_RESOLVED.');
  }

  if (result.roleCount !== 1) {
    throw new Error('Expected roleCount=1.');
  }

  if (result.moduleCount !== 1) {
    throw new Error('Expected moduleCount=1.');
  }

  if (result.permissionCount !== 1) {
    throw new Error('Expected permissionCount=1.');
  }

  if (result.authorizationRuleCount !== 9) {
    throw new Error('Expected authorizationRuleCount=9.');
  }

  const editRule = result.authorizationRules.find(function (rule) {
    return rule.actions.indexOf('EDIT') !== -1;
  });

  if (!editRule || editRule.effect !== 'ALLOW') {
    throw new Error('Expected EDIT authorization rule with effect ALLOW.');
  }

  const deleteRule = result.authorizationRules.find(function (rule) {
    return rule.actions.indexOf('DELETE') !== -1;
  });

  if (!deleteRule || deleteRule.effect !== 'DENY') {
    throw new Error('Expected DELETE authorization rule with effect DENY.');
  }

  console.log('AERP-037 Authorization Context with Permissions Test: OK');

  return result;
}

/**
 * Prueba End-to-End:
 *
 * Metadata real
 *   ↓
 * EDIT
 *   ↓
 * ALLOW
 */
function testAuthorizationMetadataEndToEndEdit() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpAuthorizeFromMetadata(
    {
      companyId: 'EMPRESA_TEST',

      authentication: aerpBuildAuthorizationTestAuthentication_(),

      action: 'EDIT',

      moduleId: 'MODULO_TEST_AUTORIZACION'
    },
    aerpBuildAuthorizationTestOptions_()
  );

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    throw new Error('End-to-End EDIT authorization failed.');
  }

  if (result.decision !== 'ALLOW') {
    throw new Error('Expected EDIT decision ALLOW.');
  }

  if (result.allowed !== true) {
    throw new Error('Expected allowed=true for EDIT.');
  }

  if (!result.matchedRule) {
    throw new Error('Expected a matched authorization rule.');
  }

  if (result.matchedRule.id !== 'PERM_TEST_001_EDIT') {
    throw new Error('Expected PERM_TEST_001_EDIT as winning rule.');
  }

  if (!result.decisionSummary) {
    throw new Error('Expected decisionSummary for EDIT.');
  }

  if (!result.trace) {
    throw new Error('Expected authorization trace for EDIT.');
  }

  console.log('AERP-037 → AERP-036 End-to-End EDIT ALLOW Test: OK');

  return result;
}

/**
 * Prueba End-to-End:
 *
 * Metadata real
 *   ↓
 * DELETE
 *   ↓
 * DENY
 */
function testAuthorizationMetadataEndToEndDelete() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpAuthorizeFromMetadata(
    {
      companyId: 'EMPRESA_TEST',

      authentication: aerpBuildAuthorizationTestAuthentication_(),

      action: 'DELETE',

      moduleId: 'MODULO_TEST_AUTORIZACION'
    },
    aerpBuildAuthorizationTestOptions_()
  );

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    throw new Error('End-to-End DELETE authorization failed.');
  }

  if (result.decision !== 'DENY') {
    throw new Error('Expected DELETE decision DENY.');
  }

  if (result.allowed !== false) {
    throw new Error('Expected allowed=false for DELETE.');
  }

  if (!result.matchedRule) {
    throw new Error('Expected a matched authorization rule.');
  }

  if (result.matchedRule.id !== 'PERM_TEST_001_DELETE') {
    throw new Error('Expected PERM_TEST_001_DELETE as winning rule.');
  }

  if (!result.decisionSummary) {
    throw new Error('Expected decisionSummary for DELETE.');
  }

  if (!result.trace) {
    throw new Error('Expected authorization trace for DELETE.');
  }

  console.log('AERP-037 → AERP-036 End-to-End DELETE DENY Test: OK');

  return result;
}
function testAuthorizationMetadataDuplicateHeaders() {
  aerpRequireAuthorizationTestMode_();

  const headers = aerpNormalizeAuthorizationMetadataHeaders_(['ACTIVO', 'activo'], {
    caseInsensitiveHeaders: true
  });

  const result = aerpValidateAuthorizationMetadataHeaders_(headers);

  if (result.ok !== false || result.status !== 'DUPLICATE_HEADER') {
    throw new Error('Expected duplicate normalized headers to be rejected.');
  }

  console.log('AERP-037 Duplicate Headers Test: OK');

  return result;
}
function testAuthorizationMetadataAmbiguousCompanyAliases() {
  aerpRequireAuthorizationTestMode_();

  const headers = ['ID_EMPRESA', 'COMPANY_ID', 'ACTIVO'];

  const result = aerpValidateAuthorizationMetadataFieldAliases_(
    headers,
    ['ID_EMPRESA', 'COMPANY_ID'],
    'companyId'
  );

  if (result.ok !== false || result.status !== 'AMBIGUOUS_SECURITY_FIELD') {
    throw new Error('Expected ambiguous company aliases to be rejected.');
  }

  console.log('AERP-037 Ambiguous Company Aliases Test: OK');

  return result;
}
function testAuthorizationUserRolesTenantIsolation() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpResolveAuthorizationUserRoles_('USER_TEST', 'COMPANY_B', {});

  if (result.ok !== true && result.status !== 'USER_ROLE_SCHEMA_ERROR') {
    throw new Error('Unexpected repository result while testing tenant isolation.');
  }

  console.log('AERP-037 Tenant Isolation User Roles Test:', JSON.stringify(result));

  return result;
}
function testAuthorizationUserRolesRequiresCompanyId() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpResolveAuthorizationUserRoles_('USER_TEST', '', {});

  if (result.ok !== false || result.status !== 'INVALID_COMPANY_ID') {
    throw new Error('Expected missing companyId to fail closed.');
  }

  console.log('AERP-037 CompanyId Required Test: OK');

  return result;
}
function testAuthorizationMetadataCompanyColumnRequired() {
  aerpRequireAuthorizationTestMode_();

  const headers = ['ID_USUARIO', 'ID_ROL', 'ACTIVO'];

  const companyColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'ID_EMPRESA',
    'COMPANY_ID',
    'EMPRESA_ID',
    'EMPRESA',
    'COMPANY'
  ]);

  if (companyColumn !== null) {
    throw new Error('Expected missing company column to resolve as null.');
  }

  console.log('AERP-037 Company Column Required Test: OK');

  return {
    ok: true,
    companyColumn: companyColumn
  };
}
/**
 * Comprueba que un único alias de seguridad
 * se resuelva correctamente.
 *
 * @return {Object}
 */
function testAuthorizationMetadataSecurityColumnSingleAlias() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpResolveAuthorizationMetadataSecurityColumn_(
    ['ID_USUARIO', 'ID_ROL', 'ID_EMPRESA', 'ACTIVO'],
    ['ID_EMPRESA', 'COMPANY_ID', 'EMPRESA_ID', 'EMPRESA', 'COMPANY'],
    'companyId'
  );

  if (
    result.ok !== true ||
    result.status !== 'SECURITY_FIELD_RESOLVED' ||
    result.column !== 'ID_EMPRESA' ||
    result.matches.length !== 1
  ) {
    throw new Error('Expected ID_EMPRESA to resolve as the unique company security field.');
  }

  console.log('AERP-037 Security Column Single Alias Test: OK');

  return result;
}
/**
 * Comprueba que múltiples aliases de seguridad
 * se rechacen como ambiguos.
 *
 * @return {Object}
 */
function testAuthorizationMetadataSecurityColumnAmbiguousAliases() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpResolveAuthorizationMetadataSecurityColumn_(
    ['ID_USUARIO', 'ID_ROL', 'ID_EMPRESA', 'COMPANY_ID', 'ACTIVO'],
    ['ID_EMPRESA', 'COMPANY_ID', 'EMPRESA_ID', 'EMPRESA', 'COMPANY'],
    'companyId'
  );

  if (
    result.ok !== false ||
    result.status !== 'AMBIGUOUS_SECURITY_FIELD' ||
    result.column !== null ||
    result.matches.length !== 2
  ) {
    throw new Error('Expected multiple company aliases to be rejected as ambiguous.');
  }

  console.log('AERP-037 Security Column Ambiguous Aliases Test: OK');

  return result;
}
/**
 * Comprueba que un usuario con una asignación activa
 * pueda resolver su rol únicamente dentro de su empresa.
 *
 * @return {Object}
 */
function testAuthorizationUserRolesValidTenant() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpResolveAuthorizationUserRoles_('usuario.test@alef.local', 'EMPRESA_TEST', {});

  if (result.ok !== true) {
    throw new Error('Expected valid tenant role resolution. Status: ' + result.status);
  }

  if (!Array.isArray(result.roles) || result.roles.indexOf('ROL_TEST_AUTORIZACION') === -1) {
    throw new Error('Expected ROL_TEST_AUTORIZACION for EMPRESA_TEST.');
  }

  console.log('AERP-037 Valid Tenant Role Resolution Test: OK');

  return result;
}
/**
 * Comprueba que un usuario no herede roles
 * desde otra empresa.
 *
 * @return {Object}
 */
function testAuthorizationUserRolesCrossTenantDenied() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpResolveAuthorizationUserRoles_('usuario.test@alef.local', 'EMPRESA_OTRA', {});

  if (result.ok !== true) {
    throw new Error('Expected a valid empty tenant resolution. Status: ' + result.status);
  }

  if (!Array.isArray(result.roles) || result.roles.length !== 0) {
    throw new Error('Expected zero roles for a different tenant.');
  }

  if (!Array.isArray(result.assignments) || result.assignments.length !== 0) {
    throw new Error('Expected zero assignments for a different tenant.');
  }

  console.log('AERP-037 Cross-Tenant User Roles Test: OK');

  return result;
}

/**
 * Comprueba que el resolver integrado de contexto falle cerrado
 * cuando companyId no está presente.
 *
 * @return {Object}
 */
function testAuthorizationContextRequiresCompanyId() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpResolveAuthorizationContext_('usuario.test@alef.local', '', {});

  if (result.ok !== false || result.status !== 'INVALID_COMPANY_ID') {
    throw new Error('Expected missing companyId to fail closed in Authorization Context Resolver.');
  }

  if (
    !Array.isArray(result.roles) ||
    result.roles.length !== 0 ||
    !Array.isArray(result.modules) ||
    result.modules.length !== 0 ||
    !Array.isArray(result.permissions) ||
    result.permissions.length !== 0
  ) {
    throw new Error('Expected empty authorization metadata after missing companyId.');
  }

  console.log('AERP-037 Authorization Context CompanyId Required Test: OK');

  return result;
}

/**
 * Comprueba que request.context no pueda sustituir el tenant confiable.
 * Un conflicto debe rechazarse antes de resolver metadata o evaluar reglas.
 *
 * @return {Object}
 */
function testAuthorizationContextCompanyIdOverrideDenied() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpAuthorizeFromMetadata(
    {
      companyId: 'EMPRESA_TEST',
      authentication: aerpBuildAuthorizationTestAuthentication_(),
      action: 'EDIT',
      moduleId: 'MODULO_TEST_AUTORIZACION',
      context: {
        companyId: 'EMPRESA_OTRA'
      }
    },
    aerpBuildAuthorizationTestOptions_()
  );

  if (
    result.ok !== false ||
    result.decision !== 'DENY' ||
    result.allowed !== false ||
    result.status !== 'INVALID_METADATA_AUTHORIZATION_REQUEST'
  ) {
    throw new Error('Expected conflicting request.context.companyId to fail closed.');
  }

  if (
    !Array.isArray(result.errors) ||
    result.errors.indexOf('request.context.companyId must match request.companyId.') === -1
  ) {
    throw new Error('Expected an explicit companyId context-conflict error.');
  }

  console.log('AERP-037 Context CompanyId Override DENY Test: OK');

  return result;
}

/**
 * Comprueba que un companyId coincidente aportado en request.context
 * no altere el tenant confiable ni rompa el camino válido.
 *
 * @return {Object}
 */
function testAuthorizationContextCompanyIdPreserved() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpAuthorizeFromMetadata(
    {
      companyId: 'EMPRESA_TEST',
      authentication: aerpBuildAuthorizationTestAuthentication_(),
      action: 'EDIT',
      moduleId: 'MODULO_TEST_AUTORIZACION',
      context: {
        companyId: 'EMPRESA_TEST'
      }
    },
    aerpBuildAuthorizationTestOptions_()
  );

  if (
    result.ok !== true ||
    result.decision !== 'ALLOW' ||
    result.allowed !== true ||
    result.companyId !== 'EMPRESA_TEST'
  ) {
    throw new Error('Expected the trusted companyId to be preserved on the valid path.');
  }

  console.log('AERP-037 Trusted Context CompanyId Preservation Test: OK');

  return result;
}

/**
 * Comprueba de extremo a extremo que un usuario no obtenga autorización
 * consultando un tenant para el que no tiene asignaciones.
 *
 * @return {Object}
 */
function testAuthorizationMetadataEndToEndCrossTenantDenied() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpAuthorizeFromMetadata(
    {
      companyId: 'EMPRESA_OTRA',
      authentication: aerpBuildAuthorizationTestAuthentication_(),
      action: 'EDIT',
      moduleId: 'MODULO_TEST_AUTORIZACION'
    },
    aerpBuildAuthorizationTestOptions_()
  );

  if (result.decision !== 'DENY' || result.allowed !== false) {
    throw new Error('Expected cross-tenant metadata authorization to produce DENY.');
  }

  if (
    result.metadataContext &&
    Array.isArray(result.metadataContext.roles) &&
    result.metadataContext.roles.length !== 0
  ) {
    throw new Error('Expected zero resolved roles for the foreign tenant.');
  }

  console.log('AERP-037 End-to-End Cross-Tenant DENY Test: OK');

  return result;
}

/**
 * Comprueba que la API pública falle cerrada si el backend no ha configurado
 * un verificador de principal confiable.
 *
 * @return {Object}
 */
function testAuthorizationTrustedPrincipalVerifierRequired() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpAuthorizeFromMetadata({
    userId: 'usuario.test@alef.local',
    companyId: 'EMPRESA_TEST',
    action: 'EDIT',
    moduleId: 'MODULO_TEST_AUTORIZACION'
  });

  if (
    result.ok !== false ||
    result.allowed !== false ||
    result.decision !== 'DENY' ||
    result.status !== 'TRUSTED_PRINCIPAL_VERIFIER_NOT_CONFIGURED'
  ) {
    throw new Error('Expected authorization without a trusted verifier to fail closed.');
  }

  console.log('AERP-037 Trusted Principal Verifier Required Test: OK');

  return result;
}

/**
 * Comprueba que evidencia de autenticación inválida produzca DENY.
 *
 * @return {Object}
 */
function testAuthorizationInvalidAuthenticationDenied() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpAuthorizeFromMetadata(
    {
      companyId: 'EMPRESA_TEST',
      action: 'EDIT',
      moduleId: 'MODULO_TEST_AUTORIZACION',
      authentication: {
        testToken: 'INVALID'
      }
    },
    aerpBuildAuthorizationTestOptions_()
  );

  if (
    result.ok !== false ||
    result.allowed !== false ||
    result.decision !== 'DENY' ||
    result.status !== 'UNAUTHENTICATED'
  ) {
    throw new Error('Expected invalid authentication evidence to produce DENY.');
  }

  console.log('AERP-037 Invalid Authentication DENY Test: OK');

  return result;
}

/**
 * Comprueba que request.userId no controle el sujeto autorizado.
 * El valor falso debe ser ignorado y sustituido por el mapeo del principal.
 *
 * @return {Object}
 */
function testAuthorizationRequestUserIdCannotImpersonate() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpAuthorizeFromMetadata(
    {
      userId: 'attacker-controlled-user',
      companyId: 'EMPRESA_TEST',
      action: 'EDIT',
      moduleId: 'MODULO_TEST_AUTORIZACION',
      authentication: aerpBuildAuthorizationTestAuthentication_()
    },
    aerpBuildAuthorizationTestOptions_()
  );

  if (
    result.ok !== true ||
    result.allowed !== true ||
    result.userId !== 'usuario.test@alef.local' ||
    !result.trustedPrincipal ||
    result.trustedPrincipal.subjectId !== 'TEST_SUBJECT_001'
  ) {
    throw new Error('Expected request.userId to be ignored in favor of the trusted principal.');
  }

  console.log('AERP-037 Request UserId Impersonation Prevention Test: OK');

  return result;
}

/**
 * Comprueba que un verificador que no entregue el mapeo interno completo
 * sea rechazado aunque declare verified=true.
 *
 * @return {Object}
 */
function testAuthorizationInvalidTrustedPrincipalDenied() {
  aerpRequireAuthorizationTestMode_();

  const incompleteVerifier = function () {
    return {
      ok: true,
      verified: true,
      principal: {
        issuer: 'urn:alef:test-identity-provider',
        subjectId: 'UNMAPPED_SUBJECT',
        userId: ''
      }
    };
  };

  const result = aerpAuthorizeFromMetadata(
    {
      companyId: 'EMPRESA_TEST',
      action: 'EDIT',
      moduleId: 'MODULO_TEST_AUTORIZACION',
      authentication: aerpBuildAuthorizationTestAuthentication_()
    },
    {
      trustedPrincipalVerifier: incompleteVerifier
    }
  );

  if (
    result.ok !== false ||
    result.allowed !== false ||
    result.decision !== 'DENY' ||
    result.status !== 'INVALID_TRUSTED_PRINCIPAL'
  ) {
    throw new Error('Expected an incomplete trusted principal to produce DENY.');
  }

  console.log('AERP-037 Invalid Trusted Principal DENY Test: OK');

  return result;
}

/**
 * Comprueba la resolución estricta de columnas críticas de CORE_USUARIO_ROL.
 *
 * @return {Object}
 */
function testAuthorizationUserRoleStrictSecurityColumns() {
  aerpRequireAuthorizationTestMode_();

  const fields = [
    {
      name: 'userId',
      candidates: ['ID_USUARIO', 'USER_ID']
    },
    {
      name: 'roleId',
      candidates: ['ID_ROL', 'ROLE_ID']
    },
    {
      name: 'companyId',
      candidates: ['ID_EMPRESA', 'COMPANY_ID']
    },
    {
      name: 'active',
      candidates: ['ACTIVO', 'ACTIVE']
    }
  ];

  fields.forEach(function (field) {
    const missing = aerpResolveAuthorizationMetadataSecurityColumn_(
      [],
      field.candidates,
      field.name
    );

    const ambiguous = aerpResolveAuthorizationMetadataSecurityColumn_(
      field.candidates,
      field.candidates,
      field.name
    );

    if (missing.ok !== false || missing.status !== 'REQUIRED_SECURITY_FIELD_MISSING') {
      throw new Error('Expected missing strict security field: ' + field.name);
    }

    if (ambiguous.ok !== false || ambiguous.status !== 'AMBIGUOUS_SECURITY_FIELD') {
      throw new Error('Expected ambiguous strict security field: ' + field.name);
    }
  });

  return {
    ok: true,
    status: 'USER_ROLE_STRICT_SECURITY_COLUMNS_TESTED'
  };
}

/**
 * Comprueba valores activos, inactivos e inválidos sin semántica implícita.
 *
 * @return {Object}
 */
function testAuthorizationMetadataStrictActivationValues() {
  aerpRequireAuthorizationTestMode_();

  const activeValues = [true, 1, '1', 'SI', 'SÍ', 'YES', 'Y', 'ACTIVO', 'ACTIVE', 'TRUE'];
  const inactiveValues = [false, 0, '0', 'NO', 'N', 'INACTIVO', 'INACTIVE', 'FALSE'];
  const invalidValues = ['', '   ', null, undefined, 'UNKNOWN'];

  activeValues.forEach(function (value) {
    const result = aerpResolveAuthorizationMetadataActiveValue_(value);

    if (!result.ok || result.active !== true) {
      throw new Error('Expected an explicitly active metadata value.');
    }
  });

  inactiveValues.forEach(function (value) {
    const result = aerpResolveAuthorizationMetadataActiveValue_(value);

    if (!result.ok || result.active !== false) {
      throw new Error('Expected an explicitly inactive metadata value.');
    }
  });

  invalidValues.forEach(function (value) {
    const result = aerpResolveAuthorizationMetadataActiveValue_(value);

    if (result.ok || result.active !== false) {
      throw new Error('Expected an invalid metadata activation value to fail closed.');
    }
  });

  return {
    ok: true,
    status: 'STRICT_ACTIVATION_VALUES_TESTED'
  };
}

/**
 * Comprueba que un error de activación se detecte antes de producir resultados parciales.
 *
 * @return {Object}
 */
function testAuthorizationMetadataInvalidActivationNoPartialResults() {
  aerpRequireAuthorizationTestMode_();

  const result = aerpFindAuthorizationMetadataActivationError_(
    [
      {
        ACTIVE: true
      },
      {
        ACTIVE: ''
      }
    ],
    'ACTIVE',
    AERP_AUTH_METADATA_TABLES.USER_ROLE
  );

  if (!result || result.status !== 'INVALID_AUTHORIZATION_METADATA_ACTIVE_VALUE') {
    throw new Error('Expected invalid activation to abort metadata resolution.');
  }

  return {
    ok: true,
    status: 'INVALID_ACTIVATION_NO_PARTIAL_RESULTS_TESTED'
  };
}

/**
 * Comprueba que los detalles controlados por el verificador no sean públicos.
 *
 * @return {Object}
 */
function testAuthorizationVerifierFailureSanitized() {
  aerpRequireAuthorizationTestMode_();

  const secretMarker = 'SECRET_TOKEN_COOKIE_HEADER_PROVIDER_PAYLOAD';
  const result = aerpAuthorizeFromMetadata(
    {
      companyId: 'EMPRESA_TEST',
      action: 'EDIT',
      moduleId: 'MODULO_TEST_AUTORIZACION',
      authentication: {
        token: secretMarker
      }
    },
    {
      trustedPrincipalVerifier: function () {
        return {
          ok: false,
          verified: false,
          status: secretMarker,
          errors: [secretMarker],
          claims: {
            token: secretMarker
          }
        };
      }
    }
  );

  if (
    result.status !== 'UNAUTHENTICATED' ||
    result.decision !== 'DENY' ||
    result.allowed !== false ||
    JSON.stringify(result).indexOf(secretMarker) !== -1
  ) {
    throw new Error('Expected verifier failure details to be sanitized.');
  }

  return result;
}

/**
 * Comprueba los límites públicos ante una excepción previa a la autorización.
 *
 * @return {Object}
 */
function testAuthorizationPublicEntryPointsFailClosed() {
  aerpRequireAuthorizationTestMode_();

  const throwingOptions = {};

  Object.defineProperty(throwingOptions, 'trustedPrincipalVerifier', {
    get: function () {
      throw new Error('SECRET_INTERNAL_EXCEPTION_DETAIL');
    }
  });

  const metadataResult = aerpLoadAuthorizationMetadata({}, throwingOptions);
  const authorizationResult = aerpAuthorizeFromMetadata({}, throwingOptions);
  const serializedResults = JSON.stringify([metadataResult, authorizationResult]);

  if (
    metadataResult.status !== 'AUTHORIZATION_METADATA_UNEXPECTED_ERROR' ||
    authorizationResult.status !== 'METADATA_AUTHORIZATION_UNEXPECTED_ERROR' ||
    authorizationResult.decision !== 'DENY' ||
    authorizationResult.allowed !== false ||
    serializedResults.indexOf('SECRET_INTERNAL_EXCEPTION_DETAIL') !== -1
  ) {
    throw new Error('Expected public entry points to fail closed without exception details.');
  }

  return {
    metadata: metadataResult,
    authorization: authorizationResult
  };
}

/**
 * Aplica un caso sintético de schema/valor sobre la columna ACTIVO.
 *
 * @param {Array[]} table Tabla 2D.
 * @param {string} caseName Caso: missing, ambiguous o value.
 * @param {*} value Valor utilizado para el caso value.
 */
function aerpApplyAuthorizationSyntheticActivationCase_(table, caseName, value) {
  const activeIndex = table[0].indexOf('ACTIVO');

  if (caseName === 'missing') {
    table[0].splice(activeIndex, 1);
    table[1].splice(activeIndex, 1);
    return;
  }

  if (caseName === 'ambiguous') {
    table[0].push('ACTIVE');
    table[1].push(false);
    return;
  }

  table[1][activeIndex] = value;
}

/**
 * Ejecuta una autorización sintética para comprobar el fallo público sanitizado.
 *
 * @param {Object} tables Tablas sintéticas.
 * @return {Object} Resultado público.
 */
function aerpAuthorizeWithSyntheticMetadata_(tables) {
  return aerpAuthorizeFromMetadata(
    {
      companyId: 'EMPRESA_TEST',
      authentication: aerpBuildAuthorizationTestAuthentication_(),
      action: 'EDIT',
      moduleId: 'MODULO_TEST_AUTORIZACION'
    },
    aerpBuildAuthorizationSyntheticTestOptions_(tables)
  );
}

/**
 * Comprueba activación inválida y schema ACTIVE estricto en User Role Resolver.
 *
 * @return {Object}
 */
function testAuthorizationUserRolesStrictActivationResolver() {
  aerpRequireAuthorizationTestMode_();

  const cases = [
    { name: 'value', value: '' },
    { name: 'value', value: null },
    { name: 'value', value: undefined },
    { name: 'value', value: 'UNKNOWN' },
    { name: 'missing' },
    { name: 'ambiguous' }
  ];

  cases.forEach(function (testCase) {
    const tables = aerpBuildAuthorizationSyntheticTables_(true, true, true);
    aerpApplyAuthorizationSyntheticActivationCase_(
      tables.CORE_USUARIO_ROL,
      testCase.name,
      testCase.value
    );

    const options = aerpBuildAuthorizationSyntheticTestOptions_(tables);
    const resolverResult = aerpResolveAuthorizationUserRoles_(
      'usuario.test@alef.local',
      'EMPRESA_TEST',
      options
    );
    const publicResult = aerpAuthorizeWithSyntheticMetadata_(tables);

    if (resolverResult.ok || publicResult.decision !== 'DENY' || publicResult.allowed !== false) {
      throw new Error('Expected strict user-role activation failure.');
    }

    aerpAssertAuthorizationFailureCollectionsEmpty_(resolverResult);
    aerpAssertAuthorizationFailureCollectionsEmpty_(publicResult);
  });

  return { ok: true, status: 'USER_ROLE_STRICT_ACTIVATION_RESOLVER_TESTED' };
}

/**
 * Comprueba activación inválida y schema ACTIVE estricto en Role Module Resolver.
 *
 * @return {Object}
 */
function testAuthorizationRoleModulesStrictActivationResolver() {
  aerpRequireAuthorizationTestMode_();

  const cases = [
    { name: 'value', value: '' },
    { name: 'value', value: null },
    { name: 'value', value: undefined },
    { name: 'value', value: 'UNKNOWN' },
    { name: 'missing' },
    { name: 'ambiguous' }
  ];

  cases.forEach(function (testCase) {
    const tables = aerpBuildAuthorizationSyntheticTables_(true, true, true);
    aerpApplyAuthorizationSyntheticActivationCase_(
      tables.CORE_ROL_MODULO,
      testCase.name,
      testCase.value
    );

    const options = aerpBuildAuthorizationSyntheticTestOptions_(tables);
    const resolverResult = aerpResolveAuthorizationRoleModules_(
      ['ROL_TEST'],
      'EMPRESA_TEST',
      options
    );
    const publicResult = aerpAuthorizeWithSyntheticMetadata_(tables);

    if (resolverResult.ok || publicResult.decision !== 'DENY' || publicResult.allowed !== false) {
      throw new Error('Expected strict role-module activation failure.');
    }

    aerpAssertAuthorizationFailureCollectionsEmpty_(resolverResult);
    aerpAssertAuthorizationFailureCollectionsEmpty_(publicResult);
  });

  return { ok: true, status: 'ROLE_MODULE_STRICT_ACTIVATION_RESOLVER_TESTED' };
}

/**
 * Comprueba activación inválida y schema ACTIVE estricto en Permission Resolver.
 *
 * @return {Object}
 */
function testAuthorizationPermissionsStrictActivationResolver() {
  aerpRequireAuthorizationTestMode_();

  const cases = [
    { name: 'value', value: '' },
    { name: 'value', value: null },
    { name: 'value', value: undefined },
    { name: 'value', value: 'UNKNOWN' },
    { name: 'missing' },
    { name: 'ambiguous' }
  ];

  cases.forEach(function (testCase) {
    const tables = aerpBuildAuthorizationSyntheticTables_(true, true, true);
    aerpApplyAuthorizationSyntheticActivationCase_(
      tables.CORE_PERMISOS,
      testCase.name,
      testCase.value
    );

    const options = aerpBuildAuthorizationSyntheticTestOptions_(tables);
    const resolverResult = aerpResolveAuthorizationPermissions_(
      ['ROL_TEST'],
      ['MODULO_TEST_AUTORIZACION'],
      'EMPRESA_TEST',
      options
    );
    const publicResult = aerpAuthorizeWithSyntheticMetadata_(tables);

    if (resolverResult.ok || publicResult.decision !== 'DENY' || publicResult.allowed !== false) {
      throw new Error('Expected strict permission activation failure.');
    }

    aerpAssertAuthorizationFailureCollectionsEmpty_(resolverResult);
    aerpAssertAuthorizationFailureCollectionsEmpty_(publicResult);
  });

  return { ok: true, status: 'PERMISSION_STRICT_ACTIVATION_RESOLVER_TESTED' };
}

/**
 * Comprueba que alias de acción en conflicto invaliden CORE_PERMISOS completo.
 *
 * @return {Object}
 */
function testAuthorizationPermissionActionAliasConflictDenied() {
  aerpRequireAuthorizationTestMode_();

  const missingTables = aerpBuildAuthorizationSyntheticTables_(true, true, true);
  const missingPermissionTable = missingTables.CORE_PERMISOS;
  const viewIndex = missingPermissionTable[0].indexOf('PUEDE_VER');
  missingPermissionTable[0].splice(viewIndex, 1);
  missingPermissionTable[1].splice(viewIndex, 1);

  const missingOptions = aerpBuildAuthorizationSyntheticTestOptions_(missingTables);
  const missingResult = aerpResolveAuthorizationPermissions_(
    ['ROL_TEST'],
    ['MODULO_TEST_AUTORIZACION'],
    'EMPRESA_TEST',
    missingOptions
  );

  if (missingResult.ok || missingResult.status !== 'REQUIRED_SECURITY_FIELD_MISSING') {
    throw new Error('Expected a missing permission action column to fail closed.');
  }

  aerpAssertAuthorizationFailureCollectionsEmpty_(missingResult);

  const ambiguousTables = aerpBuildAuthorizationSyntheticTables_(true, true, true);
  const permissionTable = ambiguousTables.CORE_PERMISOS;
  permissionTable[0].push('CAN_EDIT');
  permissionTable[1].push(false);

  const options = aerpBuildAuthorizationSyntheticTestOptions_(ambiguousTables);
  const resolverResult = aerpResolveAuthorizationPermissions_(
    ['ROL_TEST'],
    ['MODULO_TEST_AUTORIZACION'],
    'EMPRESA_TEST',
    options
  );
  const publicResult = aerpAuthorizeWithSyntheticMetadata_(ambiguousTables);

  if (
    resolverResult.ok ||
    resolverResult.status !== 'AMBIGUOUS_SECURITY_FIELD' ||
    publicResult.decision !== 'DENY' ||
    publicResult.allowed !== false
  ) {
    throw new Error('Expected conflicting permission action aliases to fail closed.');
  }

  aerpAssertAuthorizationFailureCollectionsEmpty_(resolverResult);
  aerpAssertAuthorizationFailureCollectionsEmpty_(publicResult);

  return { ok: true, status: 'PERMISSION_ACTION_ALIAS_CONFLICT_DENIED' };
}
