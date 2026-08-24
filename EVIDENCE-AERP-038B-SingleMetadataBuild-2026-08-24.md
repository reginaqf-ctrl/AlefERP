# Evidencia operativa AERP-038B — Single Metadata Build

Este documento registra evidencia sanitizada procedente de ejecuciones manuales controladas realizadas por el operador en Apps Script y verificadas visualmente mediante los registros y las hojas del entorno validado.

## Identificación

- Proyecto: Alef ERP Metadata Engine 3.0
- Fecha de validación: 2026-08-24
- Rama: `feature/AERP-038B-single-metadata-build`
- Commit probado: `6cd7e70bb9416ec4c6ed58315dcae8f10c72386b`
- Entorno: proyecto Apps Script existente y Google Sheets asociado
- Sin activadores instalados visibles: confirmado
- Sin implementaciones activas o archivadas: confirmado
- Backups manuales creados antes de la prueba:
  - `CORE_COLUMNAS_BACKUP_20260824`
  - `AERP_BUILD_BACKUP_20260824`
  - `AERP_DEPLOY_LOG_BACKUP_20260824`
  - `AERP_APPSHEET_PACKAGE_BACKUP_20260824`

Los nombres de los backups pueden incluir el sufijo automático que Google Sheets aplique en caso de colisión.

## Archivos actualizados manualmente

```text
10_Main.gs
12_DryRun.gs
14_MetadataBuilder.gs
15_GeneratorEngine.gs
16_AppSheetGenerator.gs
17_DeploymentMVP.gs
20_BuildPipeline.gs
21_BuildWorkflow.gs
```

No se utilizó clasp ni se creó una implementación de Apps Script.

## Validaciones read-only previas

### `testMetadataBuilderEnterpriseCompatibilityAudit`

- `ok:true`
- Contrato `1.0.0`
- 23 tablas activas
- 276 columnas activas
- 23 primary keys
- 30 foreign keys
- 14 labels
- 0 errores
- 0 warnings

### `testMetadataBuilder`

- 23 tablas
- 276 columnas
- 23 PK
- 30 FK
- 14 labels
- 0 errores/warnings

### `testGeneratorEngineMVP`

- 23 tablas
- 23 formularios
- 23 vistas
- 23 menús
- 0 errores/warnings

### `testAppSheetGeneratorMVP`

- 23 tablas
- 276 columnas
- 23 formularios
- 23 vistas
- 23 menús
- 0 errores/warnings

## Prueba operativa `runGenerarERP`

- La función se ejecutó una sola vez.
- La ejecución finalizó sin excepción.
- `AERP_DEPLOY_LOG` añadió una nueva fila:
  - Resultado `OK`
  - 23 tablas
  - 276 columnas
  - 23 formularios
  - 23 vistas
  - 23 menús
  - 0 warnings
- `AERP_BUILD` mostró:
  - Estado `LISTO_PARA_CONFIRMAR`
  - Versión `3.0.0`
  - 23 tablas
  - 23 formularios
  - 23 vistas
  - 23 menús
  - 0 warnings
- `AERP_APPSHEET_PACKAGE` quedó materializado y con contenido.
- El estado `OK` del deployment log se observó como evidencia autoritativa.

## Prueba operativa Workflow

- `testBuildWorkflow` se ejecutó una sola vez y finalizó sin excepción.
- Resultado:
  - `ok:true`
  - `status:SUCCESS`
  - Mensaje fijo de generación correcta
- Summary:
  - Contrato `1.0.0`
  - 23 tablas
  - 276 columnas
  - 23 primary keys
  - 30 foreign keys
  - 14 labels
  - 23 formularios
  - 23 vistas
  - 23 menús
  - 0 errores
  - 0 warnings
- `metadata`:
  - 23 tablas
  - 276 columnas
  - 23 primary keys
  - 30 foreign keys
  - 14 labels
- `AERP_DEPLOY_LOG` añadió una segunda fila nueva con `OK`.
- El lock se adquirió y liberó sin error observable.

## Integridad de `CORE_COLUMNAS`

- Antes de las pruebas se creó un backup manual de `CORE_COLUMNAS`.
- Durante ambas ejecuciones, la validación de instalación reportó 276 filas y headers completos.
- Después de ambas ejecuciones, `CORE_COLUMNAS` continuó reportando 276 filas.
- La revisión de código confirma que Pipeline, Deployment y Workflow no llaman a rebuild ni contienen una ruta de escritura hacia `CORE_COLUMNAS`.
- No se realizó una comparación criptográfica celda por celda. Por tanto, la evidencia confirma ausencia de rebuild observable y conservación del conteo, no identidad binaria completa.

## Seguridad y operación

- Ningún trigger fue creado, eliminado o modificado.
- Ninguna implementación fue creada.
- Ninguna función legacy fue ejecutada.
- `runSincronizarMetadata()` no fue ejecutada.
- No se ejecutó clasp.
- No se desplegó una aplicación externa.
- Los backups se conservan.
- No se observaron fingerprints, stack traces ni datos empresariales sensibles en respuestas públicas.

## Evidencia y limitaciones

- La evidencia visual fue revisada durante la sesión de validación.
- Las capturas no se incorporan al repositorio para evitar datos del entorno y crecimiento innecesario.
- Este documento registra resultados sanitizados.
- Las marcas horarias de Apps Script y Google Sheets pueden diferir por la configuración de zona horaria.
- Esta evidencia corresponde exclusivamente al entorno validado y no sustituye pruebas en otros entornos.

```text
AERP-038B MANUAL OPERATIONAL VALIDATION: PASSED
METADATA REBUILD OBSERVED: NO
DEPLOYMENT RECEIPTS: 2 OK
OPERATIONAL WARNINGS: 0
BACKUPS RETAINED: YES
```
