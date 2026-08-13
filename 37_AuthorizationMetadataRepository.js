/**
 * ============================================================================
 * ALEF ERP
 * AERP-037 Â· AUTHORIZATION METADATA REPOSITORY
 * ============================================================================
 *
 * Archivo:
 *   37_AuthorizationMetadataRepository.gs
 *
 * PropÃ³sito:
 *   Proporcionar acceso seguro y normalizado a los metadatos de autorizaciÃ³n
 *   almacenados en las tablas del ecosistema Alef ERP.
 *
 * Responsabilidades:
 *   - Leer metadatos de autorizaciÃ³n desde Google Sheets.
 *   - Resolver roles asociados a un usuario.
 *   - Resolver mÃ³dulos asociados a roles.
 *   - Obtener permisos aplicables.
 *   - Entregar datos normalizados al Authorization Metadata Adapter.
 *   - Mantener desacoplado el Authorization Engine del origen fÃ­sico
 *     de los metadatos.
 *
 * Principio arquitectÃ³nico:
 *   El Authorization Engine no debe conocer cÃ³mo ni dÃ³nde se almacenan
 *   los metadatos de autorizaciÃ³n.
 *
 * Flujo:
 *
 *   Google Sheets
 *        â†“
 *   Authorization Metadata Repository
 *        â†“
 *   Authorization Metadata Adapter
 *        â†“
 *   Authorization Engine
 *
 * Estado:
 *   FOUNDATION
 *
 * VersiÃ³n:
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
 * Estas referencias estÃ¡n centralizadas para evitar nombres de hojas
 * dispersos por el cÃ³digo.
 */
const AERP_AUTH_METADATA_TABLES = Object.freeze({
  USER_ROLE: 'CORE_USUARIO_ROL',

  ROLE_MODULE: 'CORE_ROL_MODULO',

  PERMISSION: 'CORE_PERMISOS',

  COMPANY: 'CORE_EMPRESAS'
});

/**
 * ConfiguraciÃ³n predeterminada del repositorio.
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
 * Carga el contexto de autorizaciÃ³n asociado a un usuario.
 *
 * Esta funciÃ³n serÃ¡ el punto de entrada principal del repositorio.
 *
 * En esta primera versiÃ³n Foundation todavÃ­a no consulta las hojas.
 * Ãšnicamente define y valida el contrato pÃºblico del componente.
 *
 * @param {Object} request Solicitud de contexto.
 * @param {string} request.userId Identificador del usuario.
 * @param {string=} request.companyId Identificador opcional de empresa.
 * @param {Object=} options Opciones del repositorio.
 * @return {Object} Contexto de metadatos de autorizaciÃ³n.
 */
function aerpLoadAuthorizationMetadata(request, options) {
  const startedAt = new Date();

  const normalizedRequest = aerpBuildAuthorizationMetadataRequest_(request);

  const repositoryOptions = aerpBuildAuthorizationMetadataRepositoryOptions_(options);

  const validation = aerpValidateAuthorizationMetadataRequest_(normalizedRequest);

  if (!validation.ok) {
    return {
      ok: false,

      status: 'INVALID_REQUEST',

      request: normalizedRequest,

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
    repositoryOptions
  );

  if (!contextResult.ok) {
    return {
      ok: false,

      status: contextResult.status,

      request: normalizedRequest,

      roles: contextResult.roles || [],

      modules: contextResult.modules || [],

      permissions: [],

      context: contextResult,

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
 * Valida la solicitud mÃ­nima del repositorio.
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

  return {
    ok: errors.length === 0,

    errors: errors
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
 * Obtiene el Spreadsheet activo utilizado por el repositorio.
 *
 * Esta funciÃ³n queda aislada para permitir sustituir el origen
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
 * Construye un objeto a partir de una fila.
 *
 * AÃ±ade __rowNumber para trazabilidad interna.
 *
 * @param {string[]} headers Cabeceras normalizadas.
 * @param {Array} values Valores de la fila.
 * @param {number} rowNumber NÃºmero real de fila en la hoja.
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
 * La funciÃ³n:
 *   - Lee la tabla mediante el Table Reader.
 *   - Detecta las columnas relevantes.
 *   - Filtra por usuario.
 *   - Filtra opcionalmente por empresa.
 *   - Ignora asignaciones inactivas.
 *   - Elimina roles duplicados.
 *
 * @param {string} userId Identificador del usuario.
 * @param {string=} companyId Identificador opcional de empresa.
 * @param {Object=} options Opciones del repositorio.
 * @return {Object} Resultado de resoluciÃ³n.
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
      assignments: [],
      errors: ['userId is required.']
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
      assignments: [],
      errors: tableResult.errors
    };
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

  const missingColumns = [];

  if (!userColumn) {
    missingColumns.push('USER');
  }

  if (!roleColumn) {
    missingColumns.push('ROLE');
  }

  if (missingColumns.length > 0) {
    return {
      ok: false,
      status: 'USER_ROLE_SCHEMA_ERROR',
      userId: normalizedUserId,
      companyId: normalizedCompanyId,
      roles: [],
      assignments: [],
      detectedHeaders: headers,
      missingColumns: missingColumns,
      errors: [
        'Required CORE_USUARIO_ROL columns could not be resolved: ' + missingColumns.join(', ')
      ]
    };
  }

  const normalizedUserLookup = normalizedUserId.toUpperCase();

  const normalizedCompanyLookup = normalizedCompanyId.toUpperCase();

  const assignments = tableResult.rows.filter(function (row) {
    const rowUserId = aerpNormalizeAuthorizationMetadataString_(row[userColumn]).toUpperCase();

    const rowRoleId = aerpNormalizeAuthorizationMetadataString_(row[roleColumn]).toUpperCase();

    /*
     * Ignora filas sin datos funcionales de autorizaciÃ³n.
     *
     * Algunas hojas pueden contener filas fÃ­sicamente presentes
     * con valores predeterminados como false en ACTIVO o PRINCIPAL.
     * Una asignaciÃ³n solo es vÃ¡lida si tiene usuario y rol.
     */
    if (!rowUserId || !rowRoleId) {
      return false;
    }

    if (rowUserId !== normalizedUserLookup) {
      return false;
    }

    if (activeColumn && !aerpIsAuthorizationMetadataActiveValue_(row[activeColumn])) {
      return false;
    }

    if (normalizedCompanyLookup && companyColumn) {
      const rowCompanyId = aerpNormalizeAuthorizationMetadataString_(
        row[companyColumn]
      ).toUpperCase();

      if (rowCompanyId !== normalizedCompanyLookup) {
        return false;
      }
    }

    return true;
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
 * Resuelve los mÃ³dulos autorizados para uno o mÃºltiples roles.
 *
 * Fuente:
 * CORE_ROL_MODULO
 *
 * Reglas:
 * - Ignora filas sin ROL o MODULO.
 * - Ignora relaciones inactivas.
 * - Permite resolver mÃºltiples roles.
 * - Elimina mÃ³dulos duplicados.
 * - Conserva VISIBLE_MENU como metadata.
 *
 * @param {string[]} roles Roles que deben resolverse.
 * @param {Object=} options Opciones de resoluciÃ³n.
 * @return {Object} Resultado normalizado.
 */
function aerpResolveAuthorizationRoleModules_(roles, options) {
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
    return {
      ok: false,
      status: 'INVALID_ROLE_INPUT',
      roles: [],
      modules: [],
      moduleCount: 0,
      assignments: [],
      errors: ['At least one valid role is required.']
    };
  }

  const tableResult = aerpReadAuthorizationMetadataTable_(
    AERP_AUTH_METADATA_TABLES.ROLE_MODULE,
    options
  );

  if (!tableResult.ok) {
    return {
      ok: false,
      status: 'ROLE_MODULE_TABLE_READ_FAILED',
      roles: uniqueRoles,
      modules: [],
      moduleCount: 0,
      assignments: [],
      errors: tableResult.errors || ['Could not read CORE_ROL_MODULO.']
    };
  }

  const headers = tableResult.headers;

  const roleColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'ID_ROL',
    'ROLE_ID',
    'ROL_ID',
    'ROL',
    'ROLE'
  ]);

  const moduleColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'ID_MODULO',
    'MODULE_ID',
    'MODULO_ID',
    'MODULO',
    'MODULE'
  ]);

  const activeColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'ACTIVO',
    'ACTIVE',
    'ES_ACTIVO',
    'IS_ACTIVE',
    'HABILITADO',
    'ENABLED'
  ]);

  const visibleMenuColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'VISIBLE_MENU',
    'MENU_VISIBLE',
    'VISIBLE_EN_MENU',
    'SHOW_IN_MENU',
    'MENU_VISIBILITY'
  ]);

  if (!roleColumn || !moduleColumn) {
    return {
      ok: false,
      status: 'ROLE_MODULE_SCHEMA_INVALID',
      roles: uniqueRoles,
      modules: [],
      moduleCount: 0,
      assignments: [],
      errors: ['Required ROLE or MODULE column could not be resolved.']
    };
  }

  const assignments = tableResult.rows
    .filter(function (row) {
      const rowRole = aerpNormalizeAuthorizationMetadataString_(row[roleColumn]).toUpperCase();

      const rowModule = aerpNormalizeAuthorizationMetadataString_(row[moduleColumn]).toUpperCase();

      /*
       * Ignora filas fÃ­sicamente presentes
       * que no representan una relaciÃ³n funcional.
       */
      if (!rowRole || !rowModule) {
        return false;
      }

      if (uniqueRoles.indexOf(rowRole) === -1) {
        return false;
      }

      if (activeColumn && !aerpIsAuthorizationMetadataActiveValue_(row[activeColumn])) {
        return false;
      }

      return true;
    })
    .map(function (row) {
      return {
        role: aerpNormalizeAuthorizationMetadataString_(row[roleColumn]).toUpperCase(),

        module: aerpNormalizeAuthorizationMetadataString_(row[moduleColumn]).toUpperCase(),

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

    roles: uniqueRoles,

    modules: modules,

    moduleCount: modules.length,

    moduleDetails: moduleDetails,

    assignments: assignments,

    errors: []
  };
}

/**
 * Resuelve el contexto completo de autorizaciÃ³n de un usuario.
 *
 * Flujo:
 *   userId + companyId
 *        â†“
 *   CORE_USUARIO_ROL
 *        â†“
 *   roles[]
 *        â†“
 *   CORE_ROL_MODULO
 *        â†“
 *   modules[]
 *
 * @param {string} userId Identificador del usuario.
 * @param {string=} companyId Identificador opcional de empresa.
 * @param {Object=} options Opciones del repositorio.
 * @return {Object} Contexto de autorizaciÃ³n resuelto.
 */
function aerpResolveAuthorizationContext_(userId, companyId, options) {
  const startedAt = new Date();

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

      moduleDetails: [],

      errors: ['userId is required.'],

      startedAt: startedAt.toISOString(),

      finishedAt: new Date().toISOString()
    };
  }

  const roleResult = aerpResolveAuthorizationUserRoles_(
    normalizedUserId,
    normalizedCompanyId,
    options
  );

  if (!roleResult.ok) {
    return {
      ok: false,

      status: 'USER_ROLE_RESOLUTION_FAILED',

      userId: normalizedUserId,

      companyId: normalizedCompanyId,

      roles: [],

      modules: [],

      moduleDetails: [],

      roleResult: roleResult,

      errors: roleResult.errors || ['Could not resolve user roles.'],

      startedAt: startedAt.toISOString(),

      finishedAt: new Date().toISOString()
    };
  }

  /*
   * No tener roles no es un error tÃ©cnico.
   *
   * Es un contexto vÃ¡lido sin autorizaciones asignadas.
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

  const moduleResult = aerpResolveAuthorizationRoleModules_(roleResult.roles, options);

  if (!moduleResult.ok) {
    return {
      ok: false,

      status: 'ROLE_MODULE_RESOLUTION_FAILED',

      userId: normalizedUserId,

      companyId: normalizedCompanyId,

      roles: roleResult.roles,

      modules: [],

      moduleDetails: [],

      roleResult: roleResult,

      moduleResult: moduleResult,

      errors: moduleResult.errors || ['Could not resolve role modules.'],

      startedAt: startedAt.toISOString(),

      finishedAt: new Date().toISOString()
    };
  }
  /*
   * Resolver permisos efectivos para los roles
   * y mÃ³dulos obtenidos del contexto.
   */
  const permissionResult = aerpResolveAuthorizationPermissions_(
    roleResult.roles,
    moduleResult.modules,
    options
  );

  if (!permissionResult.ok) {
    return {
      ok: false,

      status: 'PERMISSION_RESOLUTION_FAILED',

      userId: normalizedUserId,

      companyId: normalizedCompanyId,

      roles: roleResult.roles,

      modules: moduleResult.modules,

      permissions: [],

      authorizationRules: [],

      permissionResult: permissionResult,

      errors: permissionResult.errors || ['Could not resolve authorization permissions.'],

      startedAt: startedAt.toISOString(),

      finishedAt: new Date().toISOString()
    };
  }

  /*
   * Transformar los permisos resueltos
   * en reglas consumibles por AERP-036.
   */
  const ruleResult = aerpBuildAuthorizationRulesFromPermissions_(permissionResult.permissions);

  if (!ruleResult.ok) {
    return {
      ok: false,

      status: 'AUTHORIZATION_RULE_BUILD_FAILED',

      userId: normalizedUserId,

      companyId: normalizedCompanyId,

      roles: roleResult.roles,

      modules: moduleResult.modules,

      permissions: permissionResult.permissions,

      authorizationRules: [],

      permissionResult: permissionResult,

      ruleResult: ruleResult,

      errors: ruleResult.errors || ['Could not build authorization rules.'],

      startedAt: startedAt.toISOString(),

      finishedAt: new Date().toISOString()
    };
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
 * Resuelve los permisos aplicables para uno o mÃºltiples roles y mÃ³dulos.
 *
 * Fuente:
 * CORE_PERMISOS
 *
 * @param {string[]} roles Roles resueltos.
 * @param {string[]} modules MÃ³dulos resueltos.
 * @param {Object=} options Opciones del repositorio.
 * @return {Object} Resultado normalizado.
 */
function aerpResolveAuthorizationPermissions_(roles, modules, options) {
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
    return {
      ok: false,

      status: 'INVALID_PERMISSION_ROLE_INPUT',

      roles: [],

      modules: uniqueModules,

      permissions: [],

      permissionCount: 0,

      errors: ['At least one valid role is required.']
    };
  }

  if (uniqueModules.length === 0) {
    return {
      ok: false,

      status: 'INVALID_PERMISSION_MODULE_INPUT',

      roles: uniqueRoles,

      modules: [],

      permissions: [],

      permissionCount: 0,

      errors: ['At least one valid module is required.']
    };
  }

  const tableResult = aerpReadAuthorizationMetadataTable_(
    AERP_AUTH_METADATA_TABLES.PERMISSION,
    options
  );

  if (!tableResult.ok) {
    return {
      ok: false,

      status: 'PERMISSION_TABLE_READ_FAILED',

      roles: uniqueRoles,

      modules: uniqueModules,

      permissions: [],

      permissionCount: 0,

      errors: tableResult.errors || ['Could not read CORE_PERMISOS.']
    };
  }

  const headers = tableResult.headers;

  const roleColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'ROL',
    'ID_ROL',
    'ROLE',
    'ROLE_ID'
  ]);

  const moduleColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'MODULO',
    'ID_MODULO',
    'MODULE',
    'MODULE_ID'
  ]);

  const activeColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'ACTIVO',
    'ACTIVE',
    'ES_ACTIVO',
    'IS_ACTIVE',
    'HABILITADO',
    'ENABLED'
  ]);

  const accessLevelColumn = aerpResolveAuthorizationMetadataColumn_(headers, [
    'NIVEL_ACCESO',
    'ACCESS_LEVEL'
  ]);

  if (!roleColumn || !moduleColumn) {
    return {
      ok: false,

      status: 'PERMISSION_SCHEMA_INVALID',

      roles: uniqueRoles,

      modules: uniqueModules,

      permissions: [],

      permissionCount: 0,

      errors: ['Required ROLE or MODULE column could not be resolved.']
    };
  }

  const actionColumns = {
    VIEW: aerpResolveAuthorizationMetadataColumn_(headers, ['PUEDE_VER', 'CAN_VIEW']),

    CREATE: aerpResolveAuthorizationMetadataColumn_(headers, ['PUEDE_CREAR', 'CAN_CREATE']),

    EDIT: aerpResolveAuthorizationMetadataColumn_(headers, ['PUEDE_EDITAR', 'CAN_EDIT']),

    DELETE: aerpResolveAuthorizationMetadataColumn_(headers, ['PUEDE_ELIMINAR', 'CAN_DELETE']),

    APPROVE: aerpResolveAuthorizationMetadataColumn_(headers, ['PUEDE_APROBAR', 'CAN_APPROVE']),

    EXPORT: aerpResolveAuthorizationMetadataColumn_(headers, ['PUEDE_EXPORTAR', 'CAN_EXPORT']),

    IMPORT: aerpResolveAuthorizationMetadataColumn_(headers, ['PUEDE_IMPORTAR', 'CAN_IMPORT']),

    PRINT: aerpResolveAuthorizationMetadataColumn_(headers, ['PUEDE_IMPRIMIR', 'CAN_PRINT']),

    ADMINISTER: aerpResolveAuthorizationMetadataColumn_(headers, [
      'PUEDE_ADMINISTRAR',
      'CAN_ADMINISTER'
    ])
  };

  const assignments = tableResult.rows
    .filter(function (row) {
      const rowRole = aerpNormalizeAuthorizationMetadataString_(row[roleColumn]).toUpperCase();

      const rowModule = aerpNormalizeAuthorizationMetadataString_(row[moduleColumn]).toUpperCase();

      if (!rowRole || !rowModule) {
        return false;
      }

      if (uniqueRoles.indexOf(rowRole) === -1) {
        return false;
      }

      if (uniqueModules.indexOf(rowModule) === -1) {
        return false;
      }

      if (activeColumn && !aerpIsAuthorizationMetadataActiveValue_(row[activeColumn])) {
        return false;
      }

      return true;
    })
    .map(function (row) {
      const actions = {};

      Object.keys(actionColumns).forEach(function (action) {
        const column = actionColumns[action];

        actions[action] = column ? aerpIsAuthorizationMetadataActiveValue_(row[column]) : false;
      });

      return {
        permissionId: aerpNormalizeAuthorizationMetadataString_(row.ID_PERMISO),

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

    roles: uniqueRoles,

    modules: uniqueModules,

    permissions: assignments,

    permissionCount: assignments.length,

    actionColumns: actionColumns,

    errors: []
  };
}

/**
 * Convierte permisos normalizados en reglas compatibles
 * con AERP-036 Authorization Engine.
 *
 * Cada acciÃ³n genera una regla independiente.
 *
 * true  -> ALLOW
 * false -> DENY
 *
 * @param {Object[]} permissions Permisos normalizados.
 * @param {Object=} options Opciones del adapter.
 * @return {Object} Resultado de construcciÃ³n de reglas.
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
 * Ejecuta una autorizaciÃ³n utilizando metadatos reales de Alef ERP.
 *
 * Flujo:
 *   userId + companyId
 *        â†“
 *   Authorization Metadata Repository
 *        â†“
 *   roles[]
 *        â†“
 *   modules[]
 *        â†“
 *   permissions[]
 *        â†“
 *   authorizationRules[]
 *        â†“
 *   AERP-036 Authorization Engine
 *        â†“
 *   ALLOW / DENY
 *
 * @param {Object} request Solicitud de autorizaciÃ³n basada en metadatos.
 * @param {string} request.userId Identificador del usuario.
 * @param {string=} request.companyId Empresa activa.
 * @param {string} request.action AcciÃ³n solicitada.
 * @param {string} request.moduleId MÃ³dulo solicitado.
 * @param {Object=} request.context Contexto adicional.
 * @param {Object=} options Opciones de ejecuciÃ³n.
 * @return {Object} Resultado integrado de autorizaciÃ³n.
 */
function aerpAuthorizeFromMetadata(request, options) {
  const startedAt = new Date();

  const source = request && typeof request === 'object' ? request : {};

  const userId = aerpNormalizeAuthorizationMetadataString_(source.userId);

  const companyId = aerpNormalizeAuthorizationMetadataString_(source.companyId);

  const action = aerpNormalizeAuthorizationMetadataString_(source.action).toUpperCase();

  const moduleId = aerpNormalizeAuthorizationMetadataString_(source.moduleId).toUpperCase();

  const context = source.context && typeof source.context === 'object' ? source.context : {};

  /*
   * ValidaciÃ³n mÃ­nima antes de consultar metadatos.
   */
  const validationErrors = [];

  if (!userId) {
    validationErrors.push('userId is required.');
  }

  if (!action) {
    validationErrors.push('action is required.');
  }

  if (!moduleId) {
    validationErrors.push('moduleId is required.');
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

      metadataContext: metadataContext,

      errors: metadataContext.errors || ['Could not resolve authorization metadata.'],

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
        companyId: companyId
      }
    },

    action: action,

    resource: {
      type: 'MODULE',

      id: moduleId,

      attributes: {}
    },

    context: Object.assign(
      {
        companyId: companyId
      },
      context
    )
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

/* ============================================================================
 * 8. COLUMN RESOLVER
 * ============================================================================
 */

/**
 * Busca el primer nombre de columna existente entre varios candidatos.
 *
 * Permite desacoplar el repositorio de pequeÃ±as variaciones en los nombres
 * fÃ­sicos de las columnas de Google Sheets.
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
 * Determina si un valor representa un registro activo.
 *
 * Valores considerados activos:
 *   true
 *   1
 *   SI
 *   SÃ
 *   YES
 *   Y
 *   ACTIVO
 *   ACTIVE
 *
 * Cuando no existe una columna de estado, el registro se considera activo.
 *
 * @param {*} value Valor recibido.
 * @return {boolean}
 */
function aerpIsAuthorizationMetadataActiveValue_(value) {
  if (value === null || value === undefined || value === '') {
    return true;
  }

  if (value === true) {
    return true;
  }

  if (value === false) {
    return false;
  }

  if (Number(value) === 1) {
    return true;
  }

  if (Number(value) === 0) {
    return false;
  }

  const normalizedValue = aerpNormalizeAuthorizationMetadataString_(value).toUpperCase();

  return ['SI', 'SÃ', 'YES', 'Y', 'ACTIVO', 'ACTIVE', 'TRUE'].indexOf(normalizedValue) !== -1;
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
 * Comprueba el contrato inicial del repositorio.
 */
function testAuthorizationMetadataRepositoryFoundation() {
  const result = aerpLoadAuthorizationMetadata({
    userId: 'usuario@empresa.com',

    companyId: 'EMPRESA_001'
  });

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    throw new Error('Authorization Metadata Repository Foundation must return ok=true.');
  }

  if (result.status !== 'FOUNDATION_READY') {
    throw new Error('Expected status FOUNDATION_READY.');
  }

  if (result.request.userId !== 'usuario@empresa.com') {
    throw new Error('The userId was not normalized correctly.');
  }

  console.log('AERP-037 Authorization Metadata Repository Foundation: OK');

  return result;
}

/**
 * Comprueba que una solicitud sin usuario sea rechazada.
 */
function testAuthorizationMetadataRepositoryInvalidRequest() {
  const result = aerpLoadAuthorizationMetadata({
    userId: ''
  });

  console.log(JSON.stringify(result, null, 2));

  if (result.ok) {
    throw new Error('An authorization metadata request without userId must fail.');
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
 * DiagnÃ³stico del esquema real de CORE_USUARIO_ROL.
 *
 * No requiere conocer previamente un usuario vÃ¡lido.
 */
function testAuthorizationUserRoleSchema() {
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
 * Busca automÃ¡ticamente la primera asignaciÃ³n real de CORE_USUARIO_ROL
 * y comprueba que el User Role Resolver pueda resolver sus roles.
 */
function testAuthorizationUserRoleResolver() {
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
 * DiagnÃ³stico de asignaciones reales en CORE_USUARIO_ROL.
 *
 * Busca filas con USUARIO y ROL informados, sin exigir que ACTIVO sea true.
 */
function testAuthorizationUserRoleDataDiagnostic() {
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
 * DiagnÃ³stico del esquema y datos de CORE_ROL_MODULO.
 *
 * Permite identificar:
 * - columnas reales de la tabla,
 * - cantidad de filas fÃ­sicas,
 * - primeras filas disponibles,
 * - estructura necesaria para el Role Module Resolver.
 */
function testAuthorizationRoleModuleSchema() {
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
 * Utiliza la relaciÃ³n controlada:
 * ROL_TEST_AUTORIZACION
 *        â†“
 * MODULO_TEST_AUTORIZACION
 */
function testAuthorizationRoleModuleResolver() {
  const roles = ['ROL_TEST_AUTORIZACION'];

  const result = aerpResolveAuthorizationRoleModules_(roles);

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
 * Comprueba el flujo integrado:
 *
 * USUARIO
 *   â†“
 * CORE_USUARIO_ROL
 *   â†“
 * roles[]
 *   â†“
 * CORE_ROL_MODULO
 *   â†“
 * modules[]
 */
function testAuthorizationContextResolver() {
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
 * el contexto completo de autorizaciÃ³n.
 */
function testAuthorizationMetadataRepositoryIntegrated() {
  const result = aerpLoadAuthorizationMetadata({
    userId: 'usuario.test@alef.local',

    companyId: 'EMPRESA_TEST'
  });

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
 * DiagnÃ³stico del esquema y datos de CORE_PERMISOS.
 *
 * Permite identificar:
 * - columnas reales de la tabla,
 * - cantidad de filas fÃ­sicas,
 * - primeras filas disponibles,
 * - estructura necesaria para construir el Permission Resolver.
 */
function testAuthorizationPermissionSchema() {
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
  const result = aerpResolveAuthorizationPermissions_(
    ['ROL_TEST_AUTORIZACION'],
    ['MODULO_TEST_AUTORIZACION']
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
 * Comprueba la conversiÃ³n:
 *
 * CORE_PERMISOS
 *      â†“
 * Permission Resolver
 *      â†“
 * Permission Rule Adapter
 *      â†“
 * Authorization Rules
 */
function testAuthorizationPermissionRuleAdapter() {
  const permissionResult = aerpResolveAuthorizationPermissions_(
    ['ROL_TEST_AUTORIZACION'],
    ['MODULO_TEST_AUTORIZACION']
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
 * Comprueba la resoluciÃ³n completa del contexto:
 *
 * Usuario
 *   â†“
 * Roles
 *   â†“
 * MÃ³dulos
 *   â†“
 * Permisos
 *   â†“
 * Authorization Rules
 */
function testAuthorizationContextWithPermissions() {
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
 *   â†“
 * EDIT
 *   â†“
 * ALLOW
 */
function testAuthorizationMetadataEndToEndEdit() {
  const result = aerpAuthorizeFromMetadata({
    userId: 'usuario.test@alef.local',

    companyId: 'EMPRESA_TEST',

    action: 'EDIT',

    moduleId: 'MODULO_TEST_AUTORIZACION'
  });

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

  console.log('AERP-037 â†’ AERP-036 End-to-End EDIT ALLOW Test: OK');

  return result;
}

/**
 * Prueba End-to-End:
 *
 * Metadata real
 *   â†“
 * DELETE
 *   â†“
 * DENY
 */
function testAuthorizationMetadataEndToEndDelete() {
  const result = aerpAuthorizeFromMetadata({
    userId: 'usuario.test@alef.local',

    companyId: 'EMPRESA_TEST',

    action: 'DELETE',

    moduleId: 'MODULO_TEST_AUTORIZACION'
  });

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

  console.log('AERP-037 â†’ AERP-036 End-to-End DELETE DENY Test: OK');

  return result;
}
