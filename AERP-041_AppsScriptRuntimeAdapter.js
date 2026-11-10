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
  let principalProfile = null;
  let activeMutation = null;
  let bootstrapGrant = null;
  let accessPromotionPending = false;

  function fail() {
    throw new Error('RUNTIME_REJECTED');
  }
  function same(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  function exactKeys(value, keys) {
    return Boolean(
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      same(Object.keys(value).sort(), keys.slice().sort())
    );
  }
  function opaque(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  }
  function hasControlCharacter(value) {
    return value.split('').some(function (character) {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    });
  }
  function safeBootstrapCellValue(value) {
    if (typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    return Boolean(
      typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 320 &&
      !/^[\s]*[=+\-@]/.test(value) &&
      !hasControlCharacter(value)
    );
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
  function bootstrapRequired() {
    return (
      typeof config.claimBootstrap === 'function' || typeof config.consumeBootstrap === 'function'
    );
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
    const current = state();
    if (!['EMPTY', 'INCOMPLETE', 'COMPLETE'].includes(status)) fail();
    if (read('state') === null) write('state', JSON.stringify({ ...binding, status: 'EMPTY' }));
    if (
      status === 'INCOMPLETE' &&
      current.status === 'COMPLETE' &&
      activeMutation &&
      bootstrapGrant
    ) {
      synchronizeBootstrapAccess('INCOMPLETE');
    }
    if (status === 'COMPLETE' && activeMutation && bootstrapGrant) {
      accessPromotionPending = true;
    }
    if (activeMutation && bootstrapGrant && read('bootstrap:provisioned') === null) {
      provisionBootstrapIfReady();
    }
    if (status === 'COMPLETE' && activeMutation && bootstrapGrant) {
      // Validate the exact bounded rows first, but keep their commercial grants
      // restricted until the durable state and one-time bootstrap are final.
      synchronizeBootstrapAccess('COMPLETE', false);
      const lifecycle = bootstrapLifecycleStatus();
      if (!['RECOVERABLE', 'PROMOTION_READY', 'COMPLETE'].includes(lifecycle)) fail();

      write('state', JSON.stringify({ ...binding, status: 'COMPLETE' }));
      if (lifecycle === 'RECOVERABLE') {
        if (
          typeof config.consumeBootstrap !== 'function' ||
          config.consumeBootstrap({
            confirmationId: activeMutation.confirmationId,
            tenantId: binding.tenantId,
            targetId: binding.boundTargetId
          }) !== true
        ) {
          uncertain = true;
          fail();
        }
      }
      if (lifecycle !== 'COMPLETE' && bootstrapLifecycleStatus() !== 'PROMOTION_READY') {
        uncertain = true;
        fail();
      }
      if (lifecycle !== 'COMPLETE') {
        // Visibility is promoted before permissions, and CORE_PERMISOS is a
        // single bounded range write. Authorization becomes ALLOW only after
        // state COMPLETE and bootstrap consumption are already durable.
        synchronizeBootstrapAccess('COMPLETE');
      }
      if (bootstrapLifecycleStatus() !== 'COMPLETE') {
        uncertain = true;
        fail();
      }
      accessPromotionPending = false;
      return true;
    }
    if (status === 'COMPLETE' && activeMutation && !bootstrapGrant) {
      const lifecycle = bootstrapLifecycleStatus();
      const accepted = bootstrapRequired()
        ? lifecycle === 'COMPLETE'
        : ['NOT_APPLICABLE', 'COMPLETE'].includes(lifecycle);
      if (!accepted) {
        accessPromotionPending = true;
        fail();
      }
    }
    write('state', JSON.stringify({ ...binding, status }));
    const completedLifecycle = status === 'COMPLETE' ? bootstrapLifecycleStatus() : null;
    const completedLifecycleAccepted = bootstrapRequired()
      ? completedLifecycle === 'COMPLETE'
      : ['NOT_APPLICABLE', 'COMPLETE'].includes(completedLifecycle);
    if (status === 'COMPLETE' && !completedLifecycleAccepted) {
      accessPromotionPending = true;
      fail();
    }
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
    let rawVerification = null;
    const result = aerpResolveTrustedAuthorizationPrincipal_(
      { authentication: evidence, companyId: binding.tenantId },
      {
        trustedPrincipalVerifier(input) {
          rawVerification = config.trustedPrincipalVerifier(input);
          return rawVerification;
        }
      }
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
    principalProfile = rawVerification && rawVerification.principal;
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

  function bootstrapModules() {
    return [
      'ADMINISTRACION',
      'CLIENTES',
      'CONFIGURACION',
      'INVENTARIO',
      'PEDIDOS',
      'PRODUCTOS',
      'PROVEEDORES',
      'VENTAS'
    ];
  }

  function bootstrapTargetEligible(allowComplete) {
    const current = state();
    if (
      !['EMPTY', 'INCOMPLETE'].includes(current.status) &&
      !(allowComplete === true && current.status === 'COMPLETE')
    )
      return false;
    const book = spreadsheet(binding.boundTargetId);
    const planned = new Set(
      aerpBuildCommercialInstallerPlan().blueprint.tables.map(function (table) {
        return table.physicalName;
      })
    );
    return book.getSheets().every(function (sheet) {
      if (!planned.has(sheet.getName())) {
        return sheet.getLastRow() === 0 && sheet.getLastColumn() === 0;
      }
      return read('owned:' + sheet.getName()) === String(sheet.getSheetId());
    });
  }

  function claimBootstrap() {
    const current = state();
    if (
      !activeMutation ||
      typeof config.claimBootstrap !== 'function' ||
      !bootstrapTargetEligible(current.status === 'COMPLETE')
    )
      return false;
    const grant = config.claimBootstrap({
      sourceId: binding.sourceId,
      targetId: binding.boundTargetId,
      tenantId: binding.tenantId,
      subjectId: principal && principal.subjectId,
      issuer: principal && principal.issuer,
      userId: principal && principal.userId,
      email: principalProfile && principalProfile.email,
      confirmationId: activeMutation.confirmationId,
      intent: activeMutation.intent
    });
    if (
      !grant ||
      grant.ok !== true ||
      grant.confirmationId !== activeMutation.confirmationId ||
      !grant.profile ||
      grant.profile.subjectId !== principal.subjectId ||
      grant.profile.issuer !== principal.issuer ||
      grant.profile.userId !== principal.userId ||
      grant.profile.email !== (principalProfile && principalProfile.email) ||
      !grant.company
    ) {
      if (grant && grant.persistence === 'UNKNOWN') uncertain = true;
      return false;
    }
    bootstrapGrant = JSON.parse(JSON.stringify(grant));
    if (!bootstrapOwnedDataEligible()) {
      bootstrapGrant = null;
      return false;
    }
    return true;
  }

  function bootstrapPreflightEligible() {
    if (activeMutation || typeof config.claimBootstrap !== 'function') return false;
    const current = state();
    if (!bootstrapTargetEligible(current.status === 'COMPLETE')) return false;
    const claimRaw = read('bootstrap:claim');
    if (current.status === 'EMPTY') return claimRaw === null;
    if (!['INCOMPLETE', 'COMPLETE'].includes(current.status) || !claimRaw || !principal)
      return false;
    const claim = JSON.parse(claimRaw);
    if (
      !claim ||
      claim.version !== 1 ||
      claim.status !== 'CLAIMED' ||
      claim.tenantId !== binding.tenantId ||
      claim.subjectId !== principal.subjectId ||
      !opaque(claim.confirmationId)
    )
      return false;
    const confirmationRaw = read('bootstrap:confirmation:' + claim.confirmationId);
    if (!confirmationRaw) return false;
    const confirmation = JSON.parse(confirmationRaw);
    return Boolean(
      confirmation &&
      confirmation.version === 1 &&
      confirmation.status === 'CLAIMED' &&
      confirmation.intent === 'APPLY' &&
      confirmation.sourceId === binding.sourceId &&
      confirmation.targetId === binding.boundTargetId &&
      confirmation.tenantId === binding.tenantId &&
      confirmation.issuer === principal.issuer &&
      confirmation.subjectId === principal.subjectId
    );
  }

  function bootstrapRecords(accessState) {
    if (!bootstrapGrant) return null;
    if (!['INCOMPLETE', 'COMPLETE'].includes(accessState || 'INCOMPLETE')) fail();
    const profile = bootstrapGrant.profile;
    const company = bootstrapGrant.company;
    const roleId = 'AERP_ADMIN';
    const modules = bootstrapModules();
    const records = {
      CORE_EMPRESAS: [
        {
          ID_Empresa: binding.tenantId,
          Codigo: company.code,
          Nombre: company.name,
          Moneda: company.currency,
          Zona_Horaria: company.timeZone,
          Activo: true
        }
      ],
      CORE_USUARIOS: [
        {
          ID_Usuario: profile.userId,
          ID_Empresa: binding.tenantId,
          Email: profile.email,
          Nombre: profile.name || profile.email,
          Activo: true
        }
      ],
      CORE_ROLES: [
        {
          ID_Rol: roleId,
          ID_Empresa: binding.tenantId,
          Codigo: 'ADMIN',
          Nombre: 'Administrador',
          Activo: true
        }
      ],
      CORE_MODULOS: modules.map(function (moduleId, index) {
        return {
          ID_Modulo: moduleId,
          ID_Empresa: binding.tenantId,
          Codigo: moduleId,
          Nombre: moduleId,
          Orden: index + 1,
          Activo: true
        };
      }),
      CORE_USUARIO_ROL: [
        {
          ID_Usuario_Rol: 'AERP_ADMIN_USER_ROLE',
          ID_Empresa: binding.tenantId,
          ID_Usuario: profile.userId,
          ID_Rol: roleId,
          Activo: true
        }
      ],
      ...bootstrapAccessRecords(accessState || 'INCOMPLETE')
    };
    if (
      Object.values(records).some(function (rows) {
        return rows.some(function (record) {
          return Object.values(record).some(function (value) {
            return !safeBootstrapCellValue(value);
          });
        });
      })
    )
      fail();
    return records;
  }

  function bootstrapAccessRecords(accessState) {
    const completed = accessState === 'COMPLETE';
    if (!['INCOMPLETE', 'COMPLETE'].includes(accessState)) fail();
    return {
      CORE_ROL_MODULO: bootstrapModules().map(function (moduleId) {
        const allowed = completed || moduleId === 'ADMINISTRACION';
        return {
          ID_Rol_Modulo: 'AERP_ADMIN_' + moduleId,
          ID_Empresa: binding.tenantId,
          ID_Rol: 'AERP_ADMIN',
          ID_Modulo: moduleId,
          Visible_Menu: allowed,
          Activo: true
        };
      }),
      CORE_PERMISOS: bootstrapModules().map(function (moduleId) {
        const allowed = completed || moduleId === 'ADMINISTRACION';
        return {
          ID_Permiso: 'AERP_ADMIN_' + moduleId,
          ID_Empresa: binding.tenantId,
          ID_Rol: 'AERP_ADMIN',
          ID_Modulo: moduleId,
          Nivel_Acceso: allowed ? 'ALLOW' : 'DENY',
          Puede_Ver: allowed,
          Puede_Crear: allowed,
          Puede_Editar: allowed,
          Puede_Eliminar: allowed,
          Puede_Aprobar: allowed,
          Puede_Exportar: allowed,
          Puede_Importar: allowed,
          Puede_Imprimir: allowed,
          Puede_Administrar: allowed,
          Activo: true
        };
      })
    };
  }

  function bootstrapAccessStatus() {
    const book = spreadsheet(binding.boundTargetId);
    const tableIndex = {};
    aerpBuildCommercialInstallerPlan().blueprint.tables.forEach(function (table) {
      tableIndex[table.physicalName] = table;
    });
    const incomplete = bootstrapAccessRecords('INCOMPLETE');
    const complete = bootstrapAccessRecords('COMPLETE');
    let incompleteFound = false;
    for (const name of ['CORE_ROL_MODULO', 'CORE_PERMISOS']) {
      const sheet = book.getSheetByName(name);
      if (!sheet || read('owned:' + name) !== String(sheet.getSheetId())) return 'INVALID';
      const headers = tableIndex[name].columns.map(function (column) {
        return column.Nombre_Campo;
      });
      if (
        sheet.getLastColumn() !== headers.length ||
        !same(sheet.getRange(1, 1, 1, headers.length).getValues()[0], headers)
      )
        return 'INVALID';
      const existingRows =
        sheet.getLastRow() > 1
          ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
          : [];
      const incompleteRows = incomplete[name].map(function (record) {
        return headers.map(function (header) {
          return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : false;
        });
      });
      const completeRows = complete[name].map(function (record) {
        return headers.map(function (header) {
          return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : false;
        });
      });
      if (existingRows.length !== completeRows.length) return 'INVALID';
      for (let index = 0; index < existingRows.length; index += 1) {
        if (same(existingRows[index], completeRows[index])) continue;
        if (!same(existingRows[index], incompleteRows[index])) return 'INVALID';
        incompleteFound = true;
      }
    }
    return incompleteFound ? 'RECOVERABLE' : 'COMPLETE';
  }

  function bootstrapLifecycleStatus() {
    const provisionedRaw = read('bootstrap:provisioned');
    const claimRaw = read('bootstrap:claim');
    if (provisionedRaw === null && claimRaw === null) return 'NOT_APPLICABLE';
    if (!provisionedRaw || !claimRaw) return 'INVALID';
    let provisioned;
    let claim;
    let confirmation;
    try {
      provisioned = JSON.parse(provisionedRaw);
      claim = JSON.parse(claimRaw);
      confirmation = JSON.parse(read('bootstrap:confirmation:' + claim.confirmationId) || 'null');
    } catch (_error) {
      return 'INVALID';
    }
    if (
      !provisioned ||
      !claim ||
      !confirmation ||
      !exactKeys(provisioned, ['confirmationId', 'subjectId', 'tenantId']) ||
      !exactKeys(claim, ['version', 'status', 'confirmationId', 'subjectId', 'tenantId']) ||
      !exactKeys(confirmation, [
        'version',
        'confirmationId',
        'status',
        'intent',
        'sourceId',
        'targetId',
        'tenantId',
        'issuer',
        'subjectId',
        'planDigest',
        'configurationDigest',
        'nonceDigest',
        'expiresAt'
      ]) ||
      claim.version !== 1 ||
      confirmation.version !== 1 ||
      confirmation.intent !== 'APPLY' ||
      confirmation.sourceId !== binding.sourceId ||
      confirmation.targetId !== binding.boundTargetId ||
      provisioned.tenantId !== binding.tenantId ||
      claim.tenantId !== binding.tenantId ||
      confirmation.tenantId !== binding.tenantId ||
      provisioned.subjectId !== claim.subjectId ||
      confirmation.subjectId !== claim.subjectId ||
      !opaque(provisioned.confirmationId) ||
      !opaque(provisioned.subjectId) ||
      confirmation.confirmationId !== claim.confirmationId ||
      !opaque(claim.confirmationId) ||
      !opaque(claim.subjectId) ||
      typeof confirmation.issuer !== 'string' ||
      confirmation.issuer.length < 1 ||
      confirmation.issuer.length > 128 ||
      !/^[a-f0-9]{64}$/.test(confirmation.planDigest || '') ||
      !/^[a-f0-9]{64}$/.test(confirmation.configurationDigest || '') ||
      !/^[a-f0-9]{64}$/.test(confirmation.nonceDigest || '') ||
      !Number.isFinite(confirmation.expiresAt) ||
      !['CLAIMED', 'CONSUMED'].includes(claim.status) ||
      !['CLAIMED', 'CONSUMED'].includes(confirmation.status)
    )
      return 'INVALID';
    const access = bootstrapAccessStatus();
    if (claim.status === 'CONSUMED' && confirmation.status === 'CONSUMED') {
      if (access === 'COMPLETE') return 'COMPLETE';
      if (access === 'RECOVERABLE') return 'PROMOTION_READY';
    }
    if (
      claim.status === 'CLAIMED' &&
      ['CLAIMED', 'CONSUMED'].includes(confirmation.status) &&
      ['RECOVERABLE', 'COMPLETE'].includes(access)
    )
      return 'RECOVERABLE';
    return 'INVALID';
  }

  function bootstrapOwnedDataEligible() {
    const records = bootstrapRecords();
    if (!records) return false;
    const tableIndex = {};
    aerpBuildCommercialInstallerPlan().blueprint.tables.forEach(function (table) {
      tableIndex[table.physicalName] = table;
    });
    return spreadsheet(binding.boundTargetId)
      .getSheets()
      .every(function (sheet) {
        const name = sheet.getName();
        const table = tableIndex[name];
        if (!table) return sheet.getLastRow() === 0 && sheet.getLastColumn() === 0;
        if (read('owned:' + name) !== String(sheet.getSheetId())) return false;
        if (sheet.getLastRow() === 0) return sheet.getLastColumn() === 0;
        const headers = table.columns.map(function (column) {
          return column.Nombre_Campo;
        });
        if (
          sheet.getLastColumn() !== headers.length ||
          !same(sheet.getRange(1, 1, 1, headers.length).getValues()[0], headers)
        )
          return false;
        const expectedRows = (records[name] || []).map(function (record) {
          return headers.map(function (header) {
            return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : false;
          });
        });
        const existingRows =
          sheet.getLastRow() > 1
            ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
            : [];
        if (existingRows.length > expectedRows.length) return false;
        if (!['CORE_ROL_MODULO', 'CORE_PERMISOS'].includes(name)) {
          return existingRows.every(function (row) {
            return (
              expectedRows.filter(function (expected) {
                return same(expected, row);
              }).length === 1
            );
          });
        }
        const completeRows = bootstrapAccessRecords('COMPLETE')[name].map(function (record) {
          return headers.map(function (header) {
            return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : false;
          });
        });
        return existingRows.every(function (row, index) {
          return same(row, expectedRows[index]) || same(row, completeRows[index]);
        });
      });
  }

  function provisionBootstrapIfReady() {
    const records = bootstrapRecords('INCOMPLETE');
    if (!records) return;
    const book = spreadsheet(binding.boundTargetId);
    const tables = aerpBuildCommercialInstallerPlan().blueprint.tables;
    const tableIndex = {};
    tables.forEach(function (table) {
      tableIndex[table.physicalName] = table;
    });
    if (
      Object.keys(records).some(function (name) {
        return !book.getSheetByName(name);
      })
    )
      return;
    Object.keys(records).forEach(function (name) {
      const sheet = book.getSheetByName(name);
      if (read('owned:' + name) !== String(sheet.getSheetId())) fail();
      const headers = tableIndex[name].columns.map(function (column) {
        return column.Nombre_Campo;
      });
      const actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (!same(headers, actualHeaders)) fail();
      const key = headers[0];
      const expectedRows = records[name].map(function (record) {
        return headers.map(function (header) {
          return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : false;
        });
      });
      const completeRows = ['CORE_ROL_MODULO', 'CORE_PERMISOS'].includes(name)
        ? bootstrapAccessRecords('COMPLETE')[name].map(function (record) {
            return headers.map(function (header) {
              return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : false;
            });
          })
        : null;
      const existingRows =
        sheet.getLastRow() > 1
          ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
          : [];
      expectedRows.forEach(function (row, expectedIndex) {
        const keyIndex = headers.indexOf(key);
        const matches = existingRows.filter(function (existing) {
          return existing[keyIndex] === row[keyIndex];
        });
        if (
          matches.length > 1 ||
          (matches.length === 1 &&
            !same(matches[0], row) &&
            (!completeRows || !same(matches[0], completeRows[expectedIndex])))
        )
          fail();
        if (matches.length === 0) {
          const rowIndex = sheet.getLastRow() + 1;
          try {
            sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
            SpreadsheetApp.flush();
            if (!same(sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0], row)) fail();
          } catch (_error) {
            uncertain = true;
            fail();
          }
          existingRows.push(row);
        }
      });
      if (existingRows.length !== expectedRows.length) fail();
    });
    SpreadsheetApp.flush();
    write(
      'bootstrap:provisioned',
      JSON.stringify({
        confirmationId: bootstrapGrant.confirmationId,
        subjectId: bootstrapGrant.profile.subjectId,
        tenantId: binding.tenantId
      })
    );
  }
  function synchronizeBootstrapAccess(accessState, shouldWrite) {
    if (!locked || !activeMutation || !bootstrapGrant) fail();
    const current = state();
    if (
      (accessState === 'COMPLETE' && !['INCOMPLETE', 'COMPLETE'].includes(current.status)) ||
      (accessState === 'INCOMPLETE' && current.status !== 'COMPLETE')
    )
      fail();
    const book = spreadsheet(binding.boundTargetId);
    const tables = aerpBuildCommercialInstallerPlan().blueprint.tables;
    const tableIndex = {};
    tables.forEach(function (table) {
      tableIndex[table.physicalName] = table;
    });
    const incomplete = bootstrapRecords('INCOMPLETE');
    const complete = bootstrapRecords('COMPLETE');
    const expected = accessState === 'COMPLETE' ? complete : incomplete;
    const accessTables =
      accessState === 'INCOMPLETE'
        ? ['CORE_PERMISOS', 'CORE_ROL_MODULO']
        : ['CORE_ROL_MODULO', 'CORE_PERMISOS'];
    for (const name of accessTables) {
      const sheet = book.getSheetByName(name);
      if (!sheet || read('owned:' + name) !== String(sheet.getSheetId())) fail();
      const headers = tableIndex[name].columns.map(function (column) {
        return column.Nombre_Campo;
      });
      if (
        sheet.getLastColumn() !== headers.length ||
        !same(sheet.getRange(1, 1, 1, headers.length).getValues()[0], headers)
      )
        fail();
      const expectedRows = expected[name].map(function (record) {
        return headers.map(function (header) {
          return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : false;
        });
      });
      const incompleteRows = incomplete[name].map(function (record) {
        return headers.map(function (header) {
          return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : false;
        });
      });
      const completeRows = complete[name].map(function (record) {
        return headers.map(function (header) {
          return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : false;
        });
      });
      const existingRows =
        sheet.getLastRow() > 1
          ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
          : [];
      if (
        existingRows.length !== expectedRows.length ||
        existingRows.some(function (row, index) {
          return !same(row, incompleteRows[index]) && !same(row, completeRows[index]);
        })
      )
        fail();
      if (shouldWrite === false) continue;
      if (same(existingRows, expectedRows)) continue;
      try {
        sheet.getRange(2, 1, expectedRows.length, headers.length).setValues(expectedRows);
        SpreadsheetApp.flush();
        if (
          !same(sheet.getRange(2, 1, expectedRows.length, headers.length).getValues(), expectedRows)
        )
          fail();
      } catch (_error) {
        uncertain = true;
        fail();
      }
    }
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
    const lifecycle = bootstrapLifecycleStatus();
    const bootstrapValidated = bootstrapRequired()
      ? snapshot.status === 'COMPLETE'
        ? lifecycle === 'COMPLETE'
        : ['RECOVERABLE', 'PROMOTION_READY', 'COMPLETE'].includes(lifecycle)
      : lifecycle !== 'INVALID' &&
        (snapshot.status !== 'COMPLETE' || ['NOT_APPLICABLE', 'COMPLETE'].includes(lifecycle));
    const application =
      typeof config.validateApplication === 'function'
        ? config.validateApplication(aerpInstallerDeepFreeze_(JSON.parse(JSON.stringify(snapshot))))
        : null;
    return {
      defaultDecision: 'DENY',
      denyPrecedence: true,
      visibilityGrantsAuthorization: false,
      tenantIsolation: true,
      authorizationValidated: admin && bootstrapValidated,
      adminAccessValidated: admin && bootstrapValidated,
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
        provisionBootstrapIfReady();
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
    provisionBootstrapIfReady();
    return 'CREATED';
  }
  function withExclusiveTarget(target, work) {
    spreadsheet(target);
    const lock = LockService.getDocumentLock();
    if (locked || !lock || lock.tryLock(1000) !== true) fail();
    locked = true;
    try {
      // Recheck identity and metadata under the same lock as the mutation.
      if (!verifyIdentity(authentication)) fail();
      const metadataAdmin = adminAllowed();
      const current = state();
      const lifecycle = bootstrapLifecycleStatus();
      if (activeMutation && current.status === 'COMPLETE' && lifecycle === 'INVALID') {
        accessPromotionPending = true;
        fail();
      }
      if (
        typeof config.claimBootstrap === 'function' &&
        (current.status !== 'COMPLETE' || ['RECOVERABLE', 'PROMOTION_READY'].includes(lifecycle))
      ) {
        if (activeMutation) {
          if (!claimBootstrap()) fail();
        } else if (!bootstrapPreflightEligible()) fail();
      } else if (!metadataAdmin) fail();
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
    accessPromotionPending = false;
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
            (!adminAllowed() && typeof config.claimBootstrap !== 'function')
          )
            fail();
          activeMutation = JSON.parse(JSON.stringify(context));
          return adapter;
        }
      });
      const result = coordinator[method](request);
      if (method === 'apply' && accessPromotionPending) {
        return {
          ...result,
          ok: false,
          state: 'INCOMPLETE',
          code: 'ACCESS_PROMOTION_INCOMPLETE',
          persistence: uncertain ? 'UNKNOWN' : result.persistence
        };
      }
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
      principalProfile = null;
      activeMutation = null;
      bootstrapGrant = null;
      accessPromotionPending = false;
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
