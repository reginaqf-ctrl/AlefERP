/**
 * ALEF ERP
 * Suite de pruebas
 */

function aerpRunSmokeTest() {

  Logger.log('=========== SMOKE TEST ===========');

  const metadata = aerpScanTable('CAT_ESTADOS');

  Logger.log('Scanner OK');

  const validation = aerpValidateMetadata(metadata);

  if (!validation.ok){

    throw new Error('Validator ERROR');

  }

  Logger.log('Validator OK');

  Logger.log('Metadata: ' + metadata.length);

  Logger.log('=================================');

}

function aerpRunPipelineTest(){

  const result = aerpGenerate('dry-run');

  Logger.log(JSON.stringify(result,null,2));

}

