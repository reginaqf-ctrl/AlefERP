/**
 * ALEF ERP Framework
 * 20_BuildPipeline.gs
 *
 * AERP-019 - Build Pipeline
 * Orquestador central del proceso "Generar ERP".
 */

const AERP_SINGLE_BUILD_CONTRACT_VERSION_ = '1.0.0';
const AERP_SINGLE_BUILD_MESSAGES_ = Object.freeze({
  SB_METADATA_MODEL_FAILED: 'No fue posible construir un MetadataModel válido.',
  SB_GENERATOR_FAILED: 'No fue posible construir un GeneratorResult válido.',
  SB_APPSHEET_FAILED: 'No fue posible construir un AppSheetPackage válido.',
  SB_VALIDATION_FAILED: 'El bundle single-build no superó la validación in-memory.',
  SB_INTERNAL_ERROR: 'No fue posible completar el flujo single-build in-memory.'
});

function aerpBuildSingleMetadataArtifactsFromFrameworkSchema(frameworkSchema) {
  try {
    if (
      typeof aerpBuildMetadataModelFromFrameworkSchema !== 'function' ||
      typeof aerpBuildGeneratorEngineMVPFromMetadataModel !== 'function' ||
      typeof aerpBuildAppSheetPackageFromGenerator !== 'function' ||
      typeof aerpValidateSingleBuildArtifacts !== 'function'
    ) {
      return aerpSbpFailure_('SB_INTERNAL_ERROR');
    }

    const metadataModel = aerpBuildMetadataModelFromFrameworkSchema(frameworkSchema);
    if (!aerpSbpIsMetadataModelSuccess_(metadataModel)) {
      return aerpSbpFailure_('SB_METADATA_MODEL_FAILED');
    }

    const generatorResult = aerpBuildGeneratorEngineMVPFromMetadataModel(metadataModel);
    if (!aerpSbpIsGeneratorSuccess_(generatorResult, metadataModel)) {
      return aerpSbpFailure_('SB_GENERATOR_FAILED');
    }

    const appSheetResult = aerpBuildAppSheetPackageFromGenerator(generatorResult);
    if (!aerpSbpIsAppSheetSuccess_(appSheetResult, generatorResult)) {
      return aerpSbpFailure_('SB_APPSHEET_FAILED');
    }

    const lineage = aerpBuildMetadataLineage_(metadataModel);
    if (
      !aerpIsValidMetadataLineage_(lineage) ||
      !aerpMetadataLineageEquals_(lineage, generatorResult.lineage) ||
      !aerpMetadataLineageEquals_(lineage, appSheetResult.lineage)
    ) {
      return aerpSbpFailure_('SB_VALIDATION_FAILED');
    }

    const candidate = {
      ok: true,
      lineage,
      metadataModel,
      generatorResult,
      appSheetResult,
      summary: aerpSbpSummary_(metadataModel, generatorResult, appSheetResult),
      diagnostics: []
    };
    const validation = aerpValidateSingleBuildArtifacts(candidate);
    if (!aerpSbpIsValidationSuccess_(validation, candidate.summary)) {
      return aerpSbpFailure_('SB_VALIDATION_FAILED');
    }
    const frozen = aerpSbpCloneAndDeepFreeze_(candidate);
    return frozen || aerpSbpFailure_('SB_INTERNAL_ERROR');
  } catch (_error) {
    return aerpSbpFailure_('SB_INTERNAL_ERROR');
  }
}

function aerpSbpIsMetadataModelSuccess_(metadataModel) {
  return Boolean(
    typeof aerpGenValidateMetadataModel_ === 'function' &&
    aerpGenValidateMetadataModel_(metadataModel) &&
    metadataModel.summary.ok === true &&
    metadataModel.summary.errors.length === 0
  );
}

function aerpSbpIsGeneratorSuccess_(generatorResult, metadataModel) {
  return Boolean(
    typeof aerpGenValidateBuiltResult_ === 'function' &&
    aerpGenValidateBuiltResult_(generatorResult, metadataModel) &&
    generatorResult.ok === true
  );
}

function aerpSbpIsAppSheetSuccess_(appSheetResult, generatorResult) {
  return Boolean(
    typeof aerpAsgValidateBuiltPackage_ === 'function' &&
    typeof aerpAsgValidateBuiltResult_ === 'function' &&
    aerpAsgValidateBuiltResult_(appSheetResult) &&
    appSheetResult.ok === true &&
    aerpAsgValidateBuiltPackage_(appSheetResult.package, generatorResult)
  );
}

function aerpSbpIsValidationSuccess_(validation, summary) {
  return Boolean(
    validation &&
    validation.ok === true &&
    validation.diagnostics &&
    validation.diagnostics.length === 0 &&
    validation.summary &&
    validation.summary.contractVersion === summary.contractVersion &&
    validation.summary.tables === summary.tables &&
    validation.summary.columns === summary.columns &&
    validation.summary.primaryKeys === summary.primaryKeys &&
    validation.summary.foreignKeys === summary.foreignKeys &&
    validation.summary.labels === summary.labels &&
    validation.summary.forms === summary.forms &&
    validation.summary.views === summary.views &&
    validation.summary.menus === summary.menus
  );
}

function aerpSbpSummary_(metadataModel, generatorResult, appSheetResult) {
  return {
    contractVersion: AERP_SINGLE_BUILD_CONTRACT_VERSION_,
    tables: metadataModel.summary.tables,
    columns: metadataModel.summary.columns,
    primaryKeys: metadataModel.summary.primaryKeys,
    foreignKeys: metadataModel.summary.foreignKeys,
    labels: metadataModel.summary.labels,
    forms: generatorResult.summary.forms,
    views: generatorResult.summary.views,
    menus: appSheetResult.summary.menus
  };
}

function aerpSbpFailure_(code) {
  const safeCode = Object.prototype.hasOwnProperty.call(AERP_SINGLE_BUILD_MESSAGES_, code)
    ? code
    : 'SB_INTERNAL_ERROR';
  const result = {
    ok: false,
    lineage: null,
    metadataModel: null,
    generatorResult: null,
    appSheetResult: null,
    summary: {
      contractVersion: AERP_SINGLE_BUILD_CONTRACT_VERSION_,
      tables: 0,
      columns: 0,
      primaryKeys: 0,
      foreignKeys: 0,
      labels: 0,
      forms: 0,
      views: 0,
      menus: 0
    },
    diagnostics: [
      {
        code: safeCode,
        severity: 'ERROR',
        stage: 'SINGLE_BUILD',
        message: AERP_SINGLE_BUILD_MESSAGES_[safeCode]
      }
    ]
  };
  return aerpSbpCloneAndDeepFreeze_(result) || result;
}

function aerpSbpCloneAndDeepFreeze_(source) {
  try {
    if (source === null || typeof source !== 'object') return source;
    const seen = new WeakSet();
    const targets = [];
    const createTarget = function (value) {
      if (Array.isArray(value)) {
        if (Object.getPrototypeOf(value) !== Array.prototype) return null;
        return [];
      }
      if (Object.getPrototypeOf(value) !== Object.prototype) return null;
      return {};
    };
    const root = createTarget(source);
    if (root === null) return null;
    const stack = [{ source, target: root }];
    while (stack.length > 0) {
      const current = stack.pop();
      if (seen.has(current.source)) return null;
      seen.add(current.source);
      targets.push(current.target);
      const keys = Reflect.ownKeys(current.source);
      if (Array.isArray(current.source)) {
        if (keys.length !== current.source.length + 1 || keys[keys.length - 1] !== 'length') {
          return null;
        }
      }
      for (let index = 0; index < keys.length; index += 1) {
        const key = keys[index];
        if (key === 'length' && Array.isArray(current.source)) continue;
        if (typeof key !== 'string') return null;
        if (Array.isArray(current.source) && key !== String(index)) return null;
        const descriptor = Object.getOwnPropertyDescriptor(current.source, key);
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
        const value = descriptor.value;
        if (value !== null && typeof value === 'object') {
          const child = createTarget(value);
          if (child === null || seen.has(value)) return null;
          current.target[key] = child;
          stack.push({ source: value, target: child });
        } else if (
          value === null ||
          typeof value === 'string' ||
          typeof value === 'boolean' ||
          (typeof value === 'number' && Number.isFinite(value))
        ) {
          current.target[key] = value;
        } else {
          return null;
        }
      }
    }
    for (let index = targets.length - 1; index >= 0; index -= 1) Object.freeze(targets[index]);
    return root;
  } catch (_error) {
    return null;
  }
}

const AERP_OPERATIONAL_PIPELINE_MESSAGES_ = Object.freeze({
  PIPELINE_LOCK_BUSY: 'Alef ERP ya está ejecutando otra operación de build.',
  PIPELINE_LOCK_FAILED: 'No fue posible adquirir el lock operativo de Alef ERP.',
  PIPELINE_INSTALLATION_FAILED: 'La instalación no superó la validación operativa.',
  PIPELINE_SCHEMA_FAILED: 'FrameworkSchema no superó la validación operativa.',
  PIPELINE_BUNDLE_FAILED: 'El bundle single-build no pudo construirse de forma segura.',
  PIPELINE_VALIDATION_FAILED: 'El bundle congelado no superó la validación operativa.',
  PIPELINE_WRITE_FAILED: 'No fue posible completar las escrituras operativas.',
  PIPELINE_INTERNAL_ERROR: 'No fue posible completar el Pipeline de Alef ERP.'
});
const AERP_OPERATIONAL_LOCK_TIMEOUT_MS_ = 5000;

function aerpPipelineFrameworkSchemaReady_(schema) {
  try {
    return Boolean(
      aerpSbHasExactDataFields_(schema, ['version', 'generatedAt', 'tables', 'summary']) &&
      typeof schema.version === 'string' &&
      schema.version !== '' &&
      aerpSbSafeDenseArray_(schema.tables) &&
      schema.tables.length > 0 &&
      aerpSbHasExactDataFields_(schema.summary, [
        'tables',
        'columns',
        'relations',
        'views',
        'warnings',
        'errors',
        'durationMs'
      ]) &&
      aerpSbSafeDenseArray_(schema.summary.errors) &&
      schema.summary.errors.length === 0
    );
  } catch (_error) {
    return false;
  }
}

function aerpValidateFrozenSingleBuildBundle_(bundle) {
  try {
    if (!aerpSbpIsDeepFrozen_(bundle) || !aerpSbValidateArtifactsShape_(bundle)) return false;
    const metadataModel = bundle.metadataModel;
    const generatorResult = bundle.generatorResult;
    const appSheetResult = bundle.appSheetResult;
    if (
      !aerpGenValidateMetadataModel_(metadataModel) ||
      !aerpGenValidateBuiltResult_(generatorResult, metadataModel) ||
      !aerpAsgValidateGeneratorResult_(generatorResult) ||
      !aerpAsgValidateBuiltResult_(appSheetResult) ||
      !aerpAsgValidateBuiltPackage_(appSheetResult.package, generatorResult) ||
      !aerpSbValidateCrossArtifactSummary_(bundle)
    ) {
      return false;
    }
    const lineage = aerpBuildMetadataLineage_(metadataModel);
    return Boolean(
      aerpIsValidMetadataLineage_(lineage) &&
      aerpMetadataLineageEquals_(lineage, bundle.lineage) &&
      aerpMetadataLineageEquals_(lineage, generatorResult.lineage) &&
      aerpMetadataLineageEquals_(lineage, appSheetResult.lineage)
    );
  } catch (_error) {
    return false;
  }
}

function aerpSbpIsDeepFrozen_(source) {
  if (source === null || typeof source !== 'object') return false;
  const seen = new WeakSet();
  const stack = [source];
  while (stack.length > 0) {
    const current = stack.pop();
    if (seen.has(current) || !Object.isFrozen(current)) return false;
    seen.add(current);
    if (Array.isArray(current)) {
      if (Object.getPrototypeOf(current) !== Array.prototype) return false;
    } else if (Object.getPrototypeOf(current) !== Object.prototype) {
      return false;
    }
    const keys = Reflect.ownKeys(current);
    if (Array.isArray(current)) {
      if (keys.length !== current.length + 1 || keys[keys.length - 1] !== 'length') return false;
    }
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (key === 'length' && Array.isArray(current)) continue;
      if (typeof key !== 'string') return false;
      if (Array.isArray(current) && key !== String(index)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return false;
      const value = descriptor.value;
      if (value !== null && typeof value === 'object') stack.push(value);
      else if (
        value !== null &&
        typeof value !== 'string' &&
        typeof value !== 'boolean' &&
        !(typeof value === 'number' && Number.isFinite(value))
      ) {
        return false;
      }
    }
  }
  return true;
}

function aerpRunBuildPipeline() {
  let lock = null;
  let acquired = false;
  try {
    lock = LockService.getDocumentLock();
    acquired = lock.tryLock(AERP_OPERATIONAL_LOCK_TIMEOUT_MS_);
    if (!acquired) return aerpPipelineLockFailureResponse_('PIPELINE_LOCK_BUSY', 'BUILD_BUSY');
    return aerpRunBuildPipelineLocked_(lock);
  } catch (_error) {
    return aerpPipelineLockFailureResponse_('PIPELINE_LOCK_FAILED', 'BUILD_LOCK_FAILED');
  } finally {
    if (acquired && lock) {
      try {
        lock.releaseLock();
      } catch (_error) {
        // Best effort: never replace the already sanitized Pipeline result.
      }
    }
  }
}

function aerpRunBuildPipelineLocked_(lock) {
  if (!lock || typeof lock.hasLock !== 'function' || lock.hasLock() !== true) {
    return aerpPipelineLockFailureResponse_('PIPELINE_LOCK_FAILED', 'BUILD_LOCK_FAILED');
  }
  let sheet = null;
  let deploymentReceipt = null;
  let failureCode = 'PIPELINE_INTERNAL_ERROR';
  let globalStart = new Date();
  try {
    const monitor = aerpStartBuildMonitor();
    sheet = monitor.sheet;
    globalStart = monitor.start;
    aerpBuildStep(sheet, 'Installer', '⏳ RUNNING', 'Validando instalación...', globalStart);
    const install = aerpInstallCheck();

    if (!install || install.ok !== true) {
      failureCode = 'PIPELINE_INSTALLATION_FAILED';
      throw new Error(failureCode);
    }

    aerpBuildStep(sheet, 'Installer', 'VALIDADO', 'Instalación validada', globalStart);

    aerpBuildStep(sheet, 'FrameworkSchema', '⏳ RUNNING', 'Construyendo schema...', globalStart);
    const frameworkSchema = aerpBuildFrameworkSchema();
    if (!aerpPipelineFrameworkSchemaReady_(frameworkSchema)) {
      failureCode = 'PIPELINE_SCHEMA_FAILED';
      throw new Error(failureCode);
    }
    aerpBuildStep(sheet, 'FrameworkSchema', 'VALIDADO', 'Schema validado', globalStart);
    aerpBuildStep(sheet, 'Single Build', '⏳ RUNNING', 'Construyendo artefactos...', globalStart);
    const bundle = aerpBuildSingleMetadataArtifactsFromFrameworkSchema(frameworkSchema);
    if (!bundle || bundle.ok !== true) {
      failureCode = 'PIPELINE_BUNDLE_FAILED';
      throw new Error(failureCode);
    }
    if (!aerpValidateFrozenSingleBuildBundle_(bundle)) {
      failureCode = 'PIPELINE_VALIDATION_FAILED';
      throw new Error(failureCode);
    }
    aerpBuildStep(sheet, 'Single Build', 'VALIDADO', 'Bundle validado', globalStart);

    aerpBuildStep(sheet, 'Deployment', '⏳ RUNNING', 'Registrando resultado...', globalStart);
    failureCode = 'PIPELINE_WRITE_FAILED';
    deploymentReceipt = aerpWriteDeploymentLog_(bundle, globalStart);
    aerpWriteAppSheetPackageSummary_(bundle);
    aerpBuildStep(
      sheet,
      'Deployment',
      'LISTO_PARA_CONFIRMAR',
      'Escrituras operativas preparadas',
      globalStart
    );
    aerpBuildPipelineSummary_(sheet, bundle, globalStart);
    aerpFinalizeDeploymentLog_(deploymentReceipt, 'OK', globalStart);
    return aerpPipelineSuccessResponse_(bundle, globalStart);
  } catch (_error) {
    aerpPipelineStepBestEffort_(sheet, 'Pipeline', 'ERROR', failureCode, globalStart);
    if (deploymentReceipt) {
      try {
        aerpFinalizeDeploymentLog_(deploymentReceipt, 'ERROR', globalStart);
      } catch (_ignored) {
        // Best effort only; the public failure remains sanitized.
      }
    }
    return aerpPipelineFailureResponse_(failureCode);
  }
}

function aerpPipelineSuccessResponse_(bundle, start) {
  const source = bundle.summary;
  return {
    ok: true,
    message: 'Alef ERP generado correctamente.',
    summary: {
      contractVersion: source.contractVersion,
      tables: source.tables,
      columns: source.columns,
      primaryKeys: source.primaryKeys,
      foreignKeys: source.foreignKeys,
      labels: source.labels,
      forms: source.forms,
      views: source.views,
      menus: source.menus,
      warnings: 0,
      errors: 0,
      durationMs: new Date() - start
    },
    warnings: []
  };
}

function aerpPipelineFailureResponse_(code) {
  const safeCode = Object.prototype.hasOwnProperty.call(AERP_OPERATIONAL_PIPELINE_MESSAGES_, code)
    ? code
    : 'PIPELINE_INTERNAL_ERROR';
  return {
    ok: false,
    message: AERP_OPERATIONAL_PIPELINE_MESSAGES_[safeCode],
    summary: {},
    warnings: []
  };
}

function aerpPipelineLockFailureResponse_(code, status) {
  return {
    ok: false,
    status,
    message: AERP_OPERATIONAL_PIPELINE_MESSAGES_[code],
    summary: {},
    warnings: []
  };
}

function aerpPipelineStepBestEffort_(sheet, step, status, message, start) {
  try {
    if (sheet) aerpBuildStep(sheet, step, status, message, start);
  } catch (_error) {
    // Operational telemetry must not expose or replace the sanitized result.
  }
}

function aerpBuildPipelineSummary_(sheet, bundle, start) {
  if (!aerpValidateFrozenSingleBuildBundle_(bundle)) {
    throw new Error('AERP_PIPELINE_BUNDLE_INVALID');
  }
  const packageResult = bundle.appSheetResult;
  const row = sheet.getLastRow() + 2;

  sheet.getRange(row, 1).setValue('🚀 ALEF ERP BUILD SUMMARY');
  sheet.getRange(row, 1, 1, 5).merge();
  sheet
    .getRange(row, 1)
    .setFontWeight('bold')
    .setFontSize(14)
    .setBackground('#12372A')
    .setFontColor('#FFFFFF');

  const data = [
    ['Estado', 'LISTO_PARA_CONFIRMAR'],
    ['Versión', AERP_VERSION],
    ['Tablas', packageResult.summary.tables],
    ['Columnas', packageResult.summary.columns],
    ['Formularios', packageResult.summary.forms],
    ['Vistas', packageResult.summary.views],
    ['Menús', packageResult.summary.menus],
    ['Warnings', packageResult.warnings.length],
    ['Duración total ms', new Date() - start]
  ];

  sheet.getRange(row + 1, 1, data.length, 2).setValues(data);
  sheet.autoResizeColumns(1, 5);
}

function testBuildPipeline() {
  const result = aerpRunBuildPipeline();
  Logger.log(JSON.stringify(result, null, 2));
}
