/**
 * ALEF ERP Framework
 * 12_DryRun.gs
 *
 * AERP-012 - DryRun
 * Simula la generación completa del Metadata Engine
 * sin escribir datos en CORE_COLUMNAS.
 */

function runAlefERPDryRun() {
  const install = aerpInstallCheck();

  if (!install.ok) {
    throw new Error(
      'Instalación inválida. Ejecuta testInstallerErrores() para ver detalles.'
    );
  }

  const start = new Date();

  const metadata = aerpScanAll();
  const validation = aerpValidateMetadata(metadata);

  const currentData = aerpGetTable(AERP_SHEETS.CORE_COLUMNAS);
  const existingIndex = aerpBuildExistingColumnIndex(
    currentData.rows,
    currentData.headers
  );

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

