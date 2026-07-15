/**
 * ALEF ERP
 * Punto único de entrada
 */

function runAlefERP(){

  const result = aerpGenerate();

  Logger.log(JSON.stringify(result,null,2));

}

function runAlefERPDryRun(){

  const result = aerpGenerate('dry-run');

  Logger.log(JSON.stringify(result,null,2));

}

function runAlefERPRebuild(){

  const result = aerpGenerate('rebuild');

  Logger.log(JSON.stringify(result,null,2));

}

function runAlefERPUpdate(){

  const result = aerpGenerate('update');

  Logger.log(JSON.stringify(result,null,2));

}

