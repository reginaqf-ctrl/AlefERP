/**
 * ALEF ERP Metadata Engine 3.0
 * 08_Generator.gs
 *
 * Orquestador principal del pipeline.
 */

const AERP_MODES = {
  DRY_RUN: 'dry-run',
  INCREMENTAL: 'incremental',
  REBUILD: 'rebuild',
  UPDATE: 'update'
};

function aerpGenerate(mode) {

  mode = mode || AERP_MODES.INCREMENTAL;

  const start = new Date();

  Logger.log('================================');
  Logger.log('ALEF ERP Metadata Engine');
  Logger.log('Versión: ' + AERP_VERSION);
  Logger.log('Modo: ' + mode);
  Logger.log('================================');

  //----------------------------------
  // 1. Escanear tablas
  //----------------------------------

  const metadata = aerpScanAll();

  //----------------------------------
  // 2. Validar
  //----------------------------------

  const validation = aerpValidateMetadata(metadata);

  if (!validation.ok) {

    throw new Error(
      'El proceso se canceló.\n\n' +
      validation.errors.join('\n')
    );

  }

  //----------------------------------
  // 3. Simulación
  //----------------------------------

  if (mode === AERP_MODES.DRY_RUN) {

    return {

      mode: mode,

      total: metadata.length,

      errors: validation.errors.length,

      warnings: validation.warnings.length,

      duration: (new Date() - start)

    };

  }

  //----------------------------------
  // 4. Escritura
  //----------------------------------

  const result = aerpWriteCoreColumnas(metadata, mode);

  result.duration = (new Date() - start);

  return result;

}

function testMetadataRebuild() {
  const result = aerpGenerate(AERP_MODES.REBUILD);

  Logger.log(JSON.stringify(result, null, 2));

  if (!result || result.inserted === 0) {
    throw new Error(
      'El rebuild no insertó metadata en CORE_COLUMNAS.'
    );
  }

  Logger.log(
    'Metadata Rebuild OK: ' +
    result.inserted +
    ' columnas escritas.'
  );
}
