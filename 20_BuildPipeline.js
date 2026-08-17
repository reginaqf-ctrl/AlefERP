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

// AERP-038B Phase 2B will connect this pure bundle to the existing operational pipeline.
// The public aerpRunBuildPipeline flow below deliberately remains unchanged in Phase 2A.

function aerpRunBuildPipeline() {
  const monitor = aerpStartBuildMonitor();
  const sheet = monitor.sheet;
  const globalStart = monitor.start;

  let packageResult;

  try {
    aerpBuildStep(sheet, 'Installer', '⏳ RUNNING', 'Validando instalación...', globalStart);
    const install = aerpInstallCheck();

    if (!install.ok) {
      aerpBuildStep(sheet, 'Installer', '❌ ERROR', install.errors.join(' | '), globalStart);
      throw new Error('Instalación inválida.');
    }

    aerpBuildStep(sheet, 'Installer', '✅ OK', 'Instalación validada', globalStart);

    aerpBuildStep(sheet, 'DryRun', '⏳ RUNNING', 'Validando metadata...', globalStart);
    const dryRun = runAlefERPDryRun();
    aerpBuildStep(
      sheet,
      'DryRun',
      '✅ OK',
      dryRun.columnasDetectadas + ' columnas detectadas',
      globalStart
    );

    aerpBuildStep(sheet, 'Metadata Builder', '⏳ RUNNING', 'Construyendo modelo...', globalStart);
    const metadataModel = aerpBuildMetadataModel();

    if (metadataModel.summary.errors.length > 0) {
      aerpBuildStep(
        sheet,
        'Metadata Builder',
        '❌ ERROR',
        metadataModel.summary.errors.join(' | '),
        globalStart
      );
      throw new Error('Metadata Builder generó errores.');
    }

    aerpBuildStep(
      sheet,
      'Metadata Builder',
      '✅ OK',
      metadataModel.summary.tables + ' tablas procesadas',
      globalStart
    );

    aerpBuildStep(sheet, 'Generator Engine', '⏳ RUNNING', 'Generando objetos...', globalStart);
    const generator = aerpBuildGeneratorEngineMVP();

    aerpBuildStep(
      sheet,
      'Generator Engine',
      '✅ OK',
      generator.summary.tables + ' tablas, ' + generator.summary.views + ' vistas',
      globalStart
    );

    aerpBuildStep(sheet, 'AppSheet Package', '⏳ RUNNING', 'Construyendo package...', globalStart);
    packageResult = aerpBuildAppSheetPackage();

    if (!packageResult.ok) {
      aerpBuildStep(
        sheet,
        'AppSheet Package',
        '❌ ERROR',
        packageResult.errors.join(' | '),
        globalStart
      );
      throw new Error('AppSheet Package inválido.');
    }

    aerpBuildStep(
      sheet,
      'AppSheet Package',
      '✅ OK',
      packageResult.summary.tables + ' tablas listas para AppSheet',
      globalStart
    );

    aerpBuildStep(sheet, 'Deployment', '⏳ RUNNING', 'Registrando resultado...', globalStart);
    aerpWriteDeploymentLog_(packageResult, globalStart);
    aerpWriteAppSheetPackageSummary_(packageResult);

    aerpBuildStep(sheet, 'Deployment', '✅ OK', 'ERP generado correctamente', globalStart);

    aerpBuildPipelineSummary_(sheet, packageResult, globalStart);

    return {
      ok: true,
      message: 'Alef ERP generado correctamente.',
      summary: packageResult.summary,
      warnings: packageResult.warnings
    };
  } catch (error) {
    aerpBuildStep(sheet, 'Pipeline', '❌ ERROR', error.message, globalStart);

    throw error;
  }
}

function aerpBuildPipelineSummary_(sheet, packageResult, start) {
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
    ['Estado', 'COMPLETADO'],
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
