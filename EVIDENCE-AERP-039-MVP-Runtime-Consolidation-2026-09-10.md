# Evidencia operativa AERP-039 — MVP Runtime Consolidation

Este documento registra evidencia sanitizada de la validación manual controlada del bundle comercial de Alef ERP en un entorno no productivo. Las observaciones proceden de Google Apps Script y Google Sheets y fueron revisadas visualmente durante la sesión.

## Identificación

- Proyecto validado: AlefERP_DEV
- Fecha de validación: 2026-09-10
- Rama: `feature/AERP-039-mvp-runtime-consolidation`
- Commit probado: `5b42e13486874ba5e5edcccc9957380bb93aea96`
- Bundle SHA-256: `c5b30ce4a796bbfc811ebf55040ca18af57b5f59bf8be260914fe1e89075533a`
- Entorno: proyecto Google Apps Script y hoja de cálculo no productivos
- Identificadores de script y hoja: omitidos deliberadamente

## Precondiciones y backups

Antes de la ejecución se confirmó la conservación de cuatro backups:

- `AERP_BUILD_BACKUP_20260910`
- `AERP_DEPLOY_LOG_BACKUP_20260910`
- `AERP_APPSHEET_PACKAGE_BACKUP_20260910`
- `CORE_COLUMNAS_BACKUP_20260910`

Los backups no fueron eliminados ni modificados durante la validación.

## Bundle desplegado

- Se publicó el bundle comercial mediante un push controlado de clasp al proyecto no productivo.
- El bundle contenía 37 scripts y `appsscript.json`, para un total de 38 archivos.
- La comparación read-only posterior confirmó identidad exacta entre los 38 archivos remotos y el bundle local.
- El bundle excluyó 102 funciones de prueba embebidas y una autoexportación técnica, conforme al gate aprobado.
- No se creó una versión ni una implementación de producción.

## Ejecución operativa `runGenerarERP`

- La ruta comercial se ejecutó una sola vez desde `Alef ERP → Generar ERP`.
- El diálogo final confirmó generación correcta.
- Resumen observado:
  - 23 tablas
  - 276 columnas
  - 23 formularios
  - 23 vistas
  - 23 menús
  - 0 warnings
  - duración mostrada: 48.48 segundos

### Receipt autoritativo

`AERP_DEPLOY_LOG` añadió una fila nueva con:

- Resultado `OK`
- 23 tablas
- 276 columnas
- 23 formularios
- 23 vistas
- 23 menús
- 0 warnings
- Duración: 48 463 ms

### Estado del build

`AERP_BUILD` mostró la secuencia nominal:

- Installer: `RUNNING` → `VALIDADO`
- FrameworkSchema: `RUNNING` → `VALIDADO`
- Single Build: `RUNNING` → `VALIDADO`
- Deployment: `RUNNING`

El resumen final mostró:

- Estado `LISTO_PARA_CONFIRMAR`
- Versión `3.0.0`
- 23 tablas
- 23 formularios
- 23 vistas
- 23 menús
- 0 warnings
- Duración total: 48 446 ms

### Paquete AppSheet

`AERP_APPSHEET_PACKAGE` quedó materializado con 92 artefactos:

- 23 tablas
- 23 formularios
- 23 vistas
- 23 menús

La hoja contiene una cabecera y datos en las filas 2 a 93; la fila 94 está vacía.

## Conservación de `CORE_COLUMNAS`

La hoja actual y `CORE_COLUMNAS_BACKUP_20260910` mostraron la misma estructura:

- 276 registros de datos
- 30 columnas físicas
- Última fila de datos: 277, incluida la cabecera en la fila 1
- Última columna: `AD`

No se realizó una comparación criptográfica celda por celda. Esta evidencia confirma conservación estructural y ausencia observable de rebuild, no identidad binaria completa.

## Controles técnicos asociados

Para el commit probado se habían validado previamente:

- Pruebas canónicas: 239/239
- Globals gate: 760 símbolos, 0 duplicados y 0 construcciones dinámicas bloqueantes
- Bundle gate: 17/17
- Seis comprobaciones smoke sobre el artefacto exacto
- Comparación posterior al push: 38/38 archivos idénticos

La evidencia técnica local permanece efímera y fuera de Git; este documento registra únicamente el resultado operativo sanitizado.

## Limitaciones y operaciones no realizadas

- El Workflow no fue ejecutado durante esta validación.
- `runSincronizarMetadata()` no fue ejecutada.
- Dry Run y entradas legacy no fueron ejecutados.
- Un intento previo mediante Execution API falló antes de entrar al código de negocio por falta de configuración de esa interfaz; no produjo evidencia de escritura operativa.
- No se ejecutó una operación en producción.
- No se crearon triggers, versiones o deployments.
- Las capturas no se incorporan al repositorio para evitar identificadores y datos del entorno.
- Este documento no contiene credenciales, identificadores de script u hoja, URLs privadas, payloads empresariales, excepciones ni stack traces.

```text
AERP-039 NON-PRODUCTION OPERATIONAL VALIDATION: PASSED
PRIMARY COMMERCIAL GENERATION PATH: PASSED
DEPLOYMENT RECEIPTS: 1 OK
OPERATIONAL WARNINGS: 0
CORE_COLUMNAS STRUCTURAL PRESERVATION: VERIFIED
BACKUPS RETAINED: YES
WORKFLOW MANUAL VALIDATION: NOT EXECUTED
PRODUCTION DEPLOYMENT: NOT EXECUTED
```
