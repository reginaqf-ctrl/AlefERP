/**
 * ==========================================================
 * ALEF ERP
 * Launch Edition 1.0
 *
 * Módulo: Build Workflow
 * ID: AERP-020
 * Autor: Alef Engineering
 * Arquitectura: Metadata Engine 3.0
 * Estado: Release Candidate
 * ==========================================================
 *
 * Flujo oficial "Generar ERP":
 *
 * 1. Installer
 * 2. Metadata Sync
 * 3. AppSheet Package
 * 4. Deployment
 * 5. Build Summary
 *
 * Este módulo detiene el proceso ante cualquier error crítico
 * y evita ejecuciones simultáneas.
 * ==========================================================
 */

/**
 * Ejecuta el Workflow oficial de generación de Alef ERP.
 *
 * @return {Object} Resultado estándar del proceso.
 */
function aerpRunBuildWorkflow() {
  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(5000)) {
    return {
      ok: false,
      status: 'BUSY',
      message: 'Alef ERP ya está ejecutando otro proceso de generación.',
      summary: {},
      metadata: null,
      warnings: [],
      errors: ['Existe otra generación en curso.'],
      durationMs: 0
    };
  }

  let monitor = null;
  let sheet = null;
  let start = new Date();

  let metadataResult = null;
  let packageResult = null;

  const warnings = [];

  try {
    monitor = aerpStartBuildMonitor();
    sheet = monitor.sheet;
    start = monitor.start;

    // ======================================================
    // PASO 1: INSTALLER
    // ======================================================

    aerpWorkflowBuildStep_(
      sheet,
      'Installer',
      '⏳ RUNNING',
      'Validando instalación...',
      start
    );

    const install = aerpInstallCheck();

    if (!install || !install.ok) {
      const installErrors =
        install && install.errors
          ? install.errors
          : ['Resultado de instalación inválido.'];

      aerpWorkflowBuildStep_(
        sheet,
        'Installer',
        '❌ ERROR',
        installErrors.join(' | '),
        start
      );

      throw new Error(
        'La instalación de Alef ERP presenta errores.'
      );
    }

    warnings.push.apply(
      warnings,
      install.warnings || []
    );

    aerpWorkflowBuildStep_(
      sheet,
      'Installer',
      '✅ OK',
      'Instalación validada',
      start
    );

    // ======================================================
    // PASO 2: METADATA SYNC
    // ======================================================

    aerpWorkflowBuildStep_(
      sheet,
      'Metadata Sync',
      '⏳ RUNNING',
      'Escaneando tablas y reconstruyendo CORE_COLUMNAS...',
      start
    );

    metadataResult = aerpGenerate(
      AERP_MODES.REBUILD
    );

    if (!metadataResult) {
      throw new Error(
        'Metadata Sync no devolvió ningún resultado.'
      );
    }

    if (Number(metadataResult.inserted || 0) === 0) {
      aerpWorkflowBuildStep_(
        sheet,
        'Metadata Sync',
        '❌ ERROR',
        'No se escribieron columnas en CORE_COLUMNAS.',
        start
      );

      throw new Error(
        'Metadata Sync no generó registros.'
      );
    }

    if (
      Number(metadataResult.inserted || 0) !==
      Number(metadataResult.total || 0)
    ) {
      aerpWorkflowBuildStep_(
        sheet,
        'Metadata Sync',
        '❌ ERROR',
        'La cantidad insertada no coincide con la metadata detectada.',
        start
      );

      throw new Error(
        'Metadata Sync quedó incompleta.'
      );
    }

    warnings.push.apply(
      warnings,
      metadataResult.warnings || []
    );

    aerpWorkflowBuildStep_(
      sheet,
      'Metadata Sync',
      '✅ OK',
      metadataResult.inserted +
        ' columnas escritas en CORE_COLUMNAS',
      start
    );

    // ======================================================
    // PASO 3: APPSHEET PACKAGE
    // ======================================================

    aerpWorkflowBuildStep_(
      sheet,
      'AppSheet Package',
      '⏳ RUNNING',
      'Construyendo paquete para AppSheet...',
      start
    );

    packageResult = aerpBuildAppSheetPackage();

    if (!packageResult || !packageResult.ok) {
      const packageErrors =
        packageResult && packageResult.errors
          ? packageResult.errors
          : ['El Package devolvió un resultado inválido.'];

      aerpWorkflowBuildStep_(
        sheet,
        'AppSheet Package',
        '❌ ERROR',
        packageErrors.join(' | '),
        start
      );

      throw new Error(
        'El paquete AppSheet no pudo generarse.'
      );
    }

    const metadataColumns =
      Number(metadataResult.inserted || 0);

    const packageColumns =
      Number(packageResult.summary.columns || 0);

    if (packageColumns !== metadataColumns) {
      aerpWorkflowBuildStep_(
        sheet,
        'AppSheet Package',
        '❌ ERROR',
        'Metadata: ' +
          metadataColumns +
          ' columnas | Package: ' +
          packageColumns +
          ' columnas',
        start
      );

      throw new Error(
        'El AppSheet Package no contiene toda la metadata generada.'
      );
    }

    warnings.push.apply(
      warnings,
      packageResult.warnings || []
    );

    aerpWorkflowBuildStep_(
      sheet,
      'AppSheet Package',
      '✅ OK',
      packageResult.summary.tables +
        ' tablas, ' +
        packageResult.summary.columns +
        ' columnas',
      start
    );

    // ======================================================
    // PASO 4: DEPLOYMENT
    // ======================================================

    aerpWorkflowBuildStep_(
      sheet,
      'Deployment',
      '⏳ RUNNING',
      'Registrando resultado del Build...',
      start
    );

    aerpWriteDeploymentLog_(
      packageResult,
      start
    );

    aerpWriteAppSheetPackageSummary_(
      packageResult
    );

    aerpWorkflowBuildStep_(
      sheet,
      'Deployment',
      '✅ OK',
      'ERP generado correctamente',
      start
    );

    // ======================================================
    // PASO 5: RESUMEN FINAL
    // ======================================================

    const totalDuration = new Date() - start;

    packageResult.summary.durationMs =
      totalDuration;

    packageResult.summary.warnings =
      warnings.length;

    packageResult.summary.errors = 0;

    aerpBuildPipelineSummary_(
      sheet,
      packageResult,
      start
    );

    aerpWorkflowBuildStep_(
      sheet,
      'Workflow',
      '✅ COMPLETADO',
      'Alef ERP listo para AppSheet',
      start
    );

    return {
      ok: true,
      status: 'SUCCESS',
      message: 'Alef ERP generado correctamente.',

      summary: {
        tables: packageResult.summary.tables,
        columns: packageResult.summary.columns,
        forms: packageResult.summary.forms,
        views: packageResult.summary.views,
        menus: packageResult.summary.menus,
        warnings: warnings.length,
        errors: 0,
        durationMs: totalDuration
      },

      metadata: {
        mode: metadataResult.mode,
        inserted: metadataResult.inserted,
        updated: metadataResult.updated,
        skipped: metadataResult.skipped,
        total: metadataResult.total
      },

      warnings: warnings,
      errors: [],
      durationMs: totalDuration
    };

  } catch (error) {
    const message =
      error && error.message
        ? error.message
        : String(error);

    if (sheet) {
      aerpWorkflowBuildStep_(
        sheet,
        'Workflow',
        '❌ ERROR',
        message,
        start
      );
    }

    return {
      ok: false,
      status: 'FAILED',
      message: message,
      summary: {},
      metadata: metadataResult,
      warnings: warnings,
      errors: [message],
      durationMs: new Date() - start
    };

  } finally {
    lock.releaseLock();
  }
}

/**
 * Registra un paso y fuerza su visualización inmediata
 * dentro de la hoja AERP_BUILD.
 */
function aerpWorkflowBuildStep_(
  sheet,
  step,
  status,
  message,
  startTime
) {
  aerpBuildStep(
    sheet,
    step,
    status,
    message,
    startTime
  );

  SpreadsheetApp.flush();
}

/**
 * Prueba técnica completa del Build Workflow.
 */
function testBuildWorkflow() {
  const result = aerpRunBuildWorkflow();

  Logger.log(
    JSON.stringify(result, null, 2)
  );

  if (!result.ok) {
    throw new Error(
      'Build Workflow falló: ' +
      result.message
    );
  }

  if (
    Number(result.summary.columns || 0) !==
    Number(result.metadata.total || 0)
  ) {
    throw new Error(
      'Inconsistencia final: Package y Metadata no coinciden.'
    );
  }

  Logger.log(
    'Build Workflow OK | ' +
    result.summary.tables +
    ' tablas | ' +
    result.summary.columns +
    ' columnas | ' +
    aerpFormatDuration_(
      result.summary.durationMs
    )
  );

  return result;
}