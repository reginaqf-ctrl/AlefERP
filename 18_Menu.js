/**
 * ==========================================================
 * ALEF ERP
 * Launch Edition 1.0
 *
 * Módulo: Menú principal
 * Autor: Alef Engineering
 * Estado: Production Ready
 * ==========================================================
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 Alef ERP')
    .addItem('Generar ERP', 'menuGenerarERP')
    .addItem('Sincronizar Metadata', 'menuSincronizarMetadata')
    .addSeparator()
    .addItem('Dry Run', 'menuDryRun')
    .addItem('Verificar instalación', 'menuInstallerCheck')
    .addSeparator()
    .addItem('Probar interfaz', 'demoUIFoundation')
    .addToUi();
}

function menuGenerarERP() {
  try {
    aerpBuildStartedToast();

    const result = runGenerarERP();

    if (!result || !result.ok) {
      throw new Error(
        result && result.message
          ? result.message
          : 'El proceso no devolvió un resultado válido.'
      );
    }

    aerpBuildSuccessDialog(result.summary);

  } catch (error) {
    aerpBuildErrorDialog(error);
  }
}

/**
 * Ejecuta la simulación sin escribir metadata.
 */
function menuDryRun() {
  try {
    aerpToast(
      'Analizando tablas y metadata sin realizar cambios.',
      'Dry Run',
      4
    );

    const result = runAlefERPDryRun();

    const message = [
      AERP_MESSAGES.DRY_RUN_SUCCESS,
      '',
      'Tablas registradas: ' + Number(result.tablasRegistradas || 0),
      'Columnas detectadas: ' + Number(result.columnasDetectadas || 0),
      'Columnas nuevas: ' + Number(result.columnasNuevas || 0),
      'Columnas existentes: ' + Number(result.columnasExistentes || 0),
      'Errores: ' + Number((result.errores || []).length),
      'Advertencias: ' + Number((result.advertencias || []).length),
      'Duración: ' + aerpFormatDuration_(result.duracionMs || 0)
    ].join('\n');

    aerpSuccess(message, 'Dry Run finalizado');

  } catch (error) {
    aerpError(
      error && error.message ? error.message : error,
      'Dry Run interrumpido'
    );
  }
}

/**
 * Comprueba la estructura obligatoria de la instalación.
 */
function menuInstallerCheck() {
  try {
    const result = aerpInstallCheck();

    if (result.ok) {
      aerpSuccess(
        AERP_MESSAGES.INSTALL_SUCCESS,
        'Instalación verificada'
      );
      return;
    }

    const errors = result.errors || [];

    aerpWarning(
      AERP_MESSAGES.INSTALL_ERROR +
      '\n\n' +
      errors.join('\n'),
      'Revisión necesaria'
    );

  } catch (error) {
    aerpError(
      error && error.message ? error.message : error,
      'Error de instalación'
    );
  }
}

/**
 * Sincroniza CORE_COLUMNAS desde las tablas físicas.
 */
function menuSincronizarMetadata() {
  try {
    aerpToast(
      'Escaneando tablas y reconstruyendo CORE_COLUMNAS.',
      'Sincronizando Metadata',
      5
    );

    const result = runSincronizarMetadata();

    if (!result || !result.ok) {
      throw new Error(
        result && result.message
          ? result.message
          : 'La sincronización no devolvió un resultado válido.'
      );
    }

    const summary = result.summary || {};

    aerpSuccess(
      [
        'La metadata se sincronizó correctamente.',
        '',
        'Columnas escritas: ' + Number(summary.inserted || 0),
        'Total detectado: ' + Number(summary.total || 0),
        'Advertencias: ' + Number(summary.warnings || 0),
        'Duración: ' + aerpFormatDuration_(summary.durationMs || 0)
      ].join('\n'),
      'Metadata sincronizada'
    );

  } catch (error) {
    aerpError(
      error && error.message ? error.message : error,
      'Sincronización interrumpida'
    );
  }
}