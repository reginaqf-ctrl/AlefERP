/**
 * ALEF ERP Framework
 * 12_DryRun.gs
 *
 * AERP-012 - DryRun
 * Simula la generación completa del Metadata Engine
 * sin escribir datos en CORE_COLUMNAS.
 */

const AERP_SINGLE_BUILD_VALIDATION_MESSAGE_ =
  'Los artefactos single-build no superaron la validación in-memory.';

function aerpValidateSingleBuildArtifacts(artifacts) {
  try {
    if (!aerpSbValidateArtifactsShape_(artifacts)) {
      return aerpSbValidationFailure_();
    }
    const metadataModel = artifacts.metadataModel;
    const generatorResult = artifacts.generatorResult;
    const appSheetResult = artifacts.appSheetResult;
    if (
      typeof aerpGenValidateMetadataModel_ !== 'function' ||
      typeof aerpGenValidateBuiltResult_ !== 'function' ||
      typeof aerpAsgValidateGeneratorResult_ !== 'function' ||
      typeof aerpAsgValidateBuiltPackage_ !== 'function' ||
      typeof aerpAsgValidateBuiltResult_ !== 'function' ||
      typeof aerpBuildMetadataLineage_ !== 'function' ||
      typeof aerpIsValidMetadataLineage_ !== 'function' ||
      typeof aerpMetadataLineageEquals_ !== 'function' ||
      !aerpGenValidateMetadataModel_(metadataModel) ||
      !aerpGenValidateBuiltResult_(generatorResult, metadataModel) ||
      !aerpAsgValidateGeneratorResult_(generatorResult) ||
      !aerpAsgValidateBuiltResult_(appSheetResult) ||
      !aerpAsgValidateBuiltPackage_(appSheetResult.package, generatorResult) ||
      !aerpSbValidateCrossArtifactSummary_(artifacts)
    ) {
      return aerpSbValidationFailure_();
    }
    const expectedLineage = aerpBuildMetadataLineage_(metadataModel);
    if (
      !aerpIsValidMetadataLineage_(expectedLineage) ||
      !aerpMetadataLineageEquals_(artifacts.lineage, expectedLineage) ||
      !aerpMetadataLineageEquals_(generatorResult.lineage, expectedLineage) ||
      !aerpMetadataLineageEquals_(appSheetResult.lineage, expectedLineage)
    ) {
      return aerpSbValidationFailure_();
    }
    return {
      ok: true,
      summary: aerpSbCopySummary_(artifacts.summary),
      diagnostics: []
    };
  } catch (_error) {
    return aerpSbValidationFailure_();
  }
}

function aerpSbValidateArtifactsShape_(artifacts) {
  return (
    aerpSbHasExactDataFields_(artifacts, [
      'ok',
      'lineage',
      'metadataModel',
      'generatorResult',
      'appSheetResult',
      'summary',
      'diagnostics'
    ]) &&
    artifacts.ok === true &&
    aerpIsValidMetadataLineage_(artifacts.lineage) &&
    aerpSbHasExactDataFields_(artifacts.summary, [
      'contractVersion',
      'tables',
      'columns',
      'primaryKeys',
      'foreignKeys',
      'labels',
      'forms',
      'views',
      'menus'
    ]) &&
    artifacts.summary.contractVersion === '1.0.0' &&
    ['tables', 'columns', 'primaryKeys', 'foreignKeys', 'labels', 'forms', 'views', 'menus'].every(
      function (field) {
        return Number.isInteger(artifacts.summary[field]) && artifacts.summary[field] >= 0;
      }
    ) &&
    aerpSbSafeDenseArray_(artifacts.diagnostics) &&
    artifacts.diagnostics.length === 0
  );
}

function aerpSbValidateCrossArtifactSummary_(artifacts) {
  const metadata = artifacts.metadataModel;
  const generator = artifacts.generatorResult;
  const appSheet = artifacts.appSheetResult;
  const summary = artifacts.summary;
  return (
    metadata.summary.ok === true &&
    generator.ok === true &&
    appSheet.ok === true &&
    metadata.version === generator.application.version &&
    generator.application.version === appSheet.package.app.version &&
    summary.contractVersion === metadata.summary.contractVersion &&
    summary.tables === metadata.summary.tables &&
    summary.tables === generator.summary.tables &&
    summary.tables === appSheet.summary.tables &&
    summary.columns === metadata.summary.columns &&
    summary.columns === appSheet.summary.columns &&
    summary.primaryKeys === metadata.summary.primaryKeys &&
    summary.foreignKeys === metadata.summary.foreignKeys &&
    summary.labels === metadata.summary.labels &&
    summary.forms === generator.summary.forms &&
    summary.forms === appSheet.summary.forms &&
    summary.views === generator.summary.views &&
    summary.views === appSheet.summary.views &&
    summary.menus === generator.summary.menus &&
    summary.menus === appSheet.summary.menus
  );
}

function aerpSbCopySummary_(summary) {
  return {
    contractVersion: summary.contractVersion,
    tables: summary.tables,
    columns: summary.columns,
    primaryKeys: summary.primaryKeys,
    foreignKeys: summary.foreignKeys,
    labels: summary.labels,
    forms: summary.forms,
    views: summary.views,
    menus: summary.menus
  };
}

function aerpSbValidationFailure_() {
  return {
    ok: false,
    lineage: null,
    metadataModel: null,
    generatorResult: null,
    appSheetResult: null,
    summary: {
      contractVersion: '1.0.0',
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
        code: 'SBV_ARTIFACTS_INVALID',
        severity: 'ERROR',
        stage: 'SINGLE_BUILD_VALIDATION',
        message: AERP_SINGLE_BUILD_VALIDATION_MESSAGE_
      }
    ]
  };
}

function aerpSbHasExactDataFields_(value, expectedFields) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedFields.length ||
    keys.some(function (key) {
      return typeof key !== 'string';
    })
  ) {
    return false;
  }
  const expected = new Set(expectedFields);
  return keys.every(function (key) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return (
      expected.has(key) && descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
    );
  });
}

function aerpSbSafeDenseArray_(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || keys[keys.length - 1] !== 'length') return false;
  for (let index = 0; index < value.length; index += 1) {
    if (keys[index] !== String(index)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return false;
  }
  return true;
}

function runAlefERPDryRun() {
  const install = aerpInstallCheck();

  if (!install.ok) {
    throw new Error('Instalación inválida. Ejecuta testInstallerErrores() para ver detalles.');
  }

  const start = new Date();

  const metadata = aerpScanAll();
  const validation = aerpValidateMetadata(metadata);

  const currentData = aerpGetTable(AERP_SHEETS.CORE_COLUMNAS);
  const existingIndex = aerpBuildExistingColumnIndex(currentData.rows, currentData.headers);

  let columnasNuevas = 0;
  let columnasExistentes = 0;

  metadata.forEach(item => {
    const key = item.Tabla + '|' + item.Nombre_Campo;

    if (existingIndex[key]) {
      columnasExistentes++;
    } else {
      columnasNuevas++;
    }
  });

  const result = {
    ok: validation.ok,
    modo: 'dry-run',
    version: AERP_VERSION,
    tablasRegistradas: aerpGetRegisteredTables().length,
    columnasDetectadas: metadata.length,
    columnasNuevas: columnasNuevas,
    columnasExistentes: columnasExistentes,
    errores: validation.errors,
    advertencias: validation.warnings,
    duracionMs: new Date() - start
  };

  Logger.log(JSON.stringify(result, null, 2));

  if (!validation.ok) {
    throw new Error('DryRun falló. Revisa errores en el log.');
  }

  return result;
}

function testDryRun() {
  const result = runAlefERPDryRun();
  Logger.log('DryRun OK');
  Logger.log(JSON.stringify(result, null, 2));
}
