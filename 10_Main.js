/**
 * ALEF ERP
 * Punto único de entrada
 */

function runAlefERP() {
  return aerpLegacyEntrypointDisabled_();
}

function runAlefERPScannerLegacyDryRun() {
  const result = aerpGenerate('dry-run');

  Logger.log(JSON.stringify(result, null, 2));
}

function runAlefERPRebuild() {
  return aerpLegacyEntrypointDisabled_();
}

function runAlefERPUpdate() {
  return aerpLegacyEntrypointDisabled_();
}

function aerpLegacyEntrypointDisabled_() {
  return {
    ok: false,
    status: 'LEGACY_ENTRYPOINT_DISABLED',
    message:
      'Entrada legacy deshabilitada. Usa runGenerarERP() para generar o runSincronizarMetadata() para sincronizar metadata.'
  };
}
