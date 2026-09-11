# Evidencia operativa AERP-REL-001 — RC1 Pilot

Este documento registra evidencia sanitizada de una ejecución manual controlada del
bundle Alef ERP 3.0.0 RC1 en un entorno piloto no productivo. Las observaciones se
obtuvieron mediante el historial de Google Apps Script y consultas de solo lectura a
las hojas de control. Los identificadores, URLs, cuenta del operador, capturas y datos
empresariales se omiten deliberadamente.

## Identificación

- Fecha de validación: 2026-09-11
- Rama: `release/AlefERP-3.0.0-rc1`
- Revisión de release validada: `4a295e021ac7c67a6173693b6317f954464608b9`
- Revisión de código del bundle: `4f392de5bf7dc02d3f242b26da73f10264d68a13`
- Versión del producto: `3.0.0`
- Bundle SHA-256 canónico:
  `0ed03fb36b945cf920f0ab4f0de78bf4d0df7ae4affcdeb04015382eb5849073`
- Entorno: hoja piloto y proyecto Apps Script vinculado, ambos no productivos
- Identificadores de script, hoja, backup y cuenta: omitidos deliberadamente

La revisión de release añade documentación sobre la revisión de código indicada. No
cambia los archivos del bundle ni su hash canónico.

## Precondiciones

- Se confirmó el proyecto Apps Script vinculado exclusivamente a la hoja piloto.
- Se conservó una copia privada completa de la hoja piloto previa a la ejecución.
- El bundle remoto contenía 37 scripts y `appsscript.json`, 38 archivos en total.
- La inspección remota confirmó ausencia de un ID fijo de spreadsheet y ausencia de
  fallback mediante `openById`.
- La ejecución fue autorizada expresamente una sola vez.
- No se autorizó producción, acceso de clientes ni una segunda ejecución.

## Ejecución controlada

El historial del proyecto piloto registró exactamente una ejecución de
`runGenerarERP`:

- Origen: editor del proyecto Apps Script vinculado al piloto
- Inicio observado: 2026-09-11 22:50:37 en la zona horaria mostrada por Apps Script
- Estado: `Completada`
- Duración de Apps Script: 34.94 segundos
- Segunda ejecución: no realizada

Las horas mostradas por Apps Script y Google Sheets difieren por la configuración de
zona horaria de cada superficie. La secuencia, el resultado y las duraciones internas
corresponden a la misma ejecución autorizada.

## Receipt autoritativo

`AERP_DEPLOY_LOG` en el piloto añadió una sola fila posterior al backup:

- Fecha observada en la hoja: 2026-09-11 13:50:46
- Resultado: `OK`
- Tablas: 23
- Columnas: 276
- Formularios: 23
- Vistas: 23
- Menús: 23
- Warnings: 0
- Duración: 32 980 ms

El piloto pasó de nueve a diez receipts. La copia privada previa conservó nueve, por
lo que el cambio observado corresponde exclusivamente a una nueva ejecución.

## Estado y artefactos

`AERP_BUILD` registró la secuencia nominal:

- Installer: `RUNNING` → `VALIDADO`
- FrameworkSchema: `RUNNING` → `VALIDADO`
- Single Build: `RUNNING` → `VALIDADO`
- Deployment: inicio del registro operativo
- Estado final del resumen: `LISTO_PARA_CONFIRMAR`
- Versión: `3.0.0`
- Tablas: 23
- Formularios: 23
- Vistas: 23
- Menús: 23
- Warnings: 0

`AERP_APPSHEET_PACKAGE` contiene 92 artefactos y `CORE_COLUMNAS` conserva 276
registros de datos. Esos conteos coinciden con el receipt autoritativo.

## Aislamiento y backup

La verificación posterior confirmó:

- Hoja piloto: diez receipts, incluido el nuevo resultado `OK` del 2026-09-11.
- Backup privado pre-run: nueve receipts, 276 registros en `CORE_COLUMNAS` y 92
  artefactos AppSheet.
- Hoja DEV existente: nueve receipts; el último continúa fechado 2026-09-10.
- Hoja DEV existente: ninguna fila operativa del 2026-09-11.

Por tanto, la escritura autorizada quedó contenida en la hoja piloto. No se restauró
el backup y no se realizó ninguna escritura durante la verificación posterior.

## Observación de presentación

La celda de `Columnas` del resumen visual secundario `AERP_BUILD` apareció vacía. El
receipt autoritativo, `CORE_COLUMNAS` y el paquete AppSheet confirmaron de forma
independiente 276 columnas. La observación se clasifica como seguimiento visual no
bloqueante y no como pérdida o ausencia de datos generados.

## Controles técnicos asociados

Antes de la activación se habían aprobado:

- Pruebas canónicas: 242/242, seis suites y cero skips.
- Globals gate: 759 símbolos, 779 ocurrencias, cero duplicados y cero construcciones
  dinámicas bloqueantes.
- Bundle gate: 17/17.
- Inventario comercial: 37 scripts y un manifiesto.
- Hash canónico idéntico en dos reconstrucciones consecutivas.
- Pruebas de aislamiento del contenedor activo.

## Limitaciones y operaciones no realizadas

- No se ejecutó una segunda vez `runGenerarERP`.
- No se ejecutaron Workflow, metadata rebuild, Dry Run ni entradas legacy.
- No se realizó comparación criptográfica celda por celda del spreadsheet.
- No se creó una versión o implementación web/API.
- No se crearon, modificaron ni eliminaron triggers instalables.
- No se ejecutó una operación en producción.
- No se concedió acceso a clientes.
- Las capturas no se incorporan al repositorio.
- Este documento no contiene credenciales, IDs de recursos, URLs privadas, datos de
  negocio, payloads, variables de entorno, excepciones ni stack traces.

```text
AERP-REL-001 RC1 NON-PRODUCTION OPERATIONAL VALIDATION: PASSED
RUNGENERARERP EXECUTIONS: 1/1 COMPLETED
AUTHORITATIVE RECEIPT: 1 NEW OK
TABLES/COLUMNS/FORMS/VIEWS/MENUS: 23/276/23/23/23
APPSHEET PACKAGE ARTIFACTS: 92
OPERATIONAL WARNINGS: 0
CORE_COLUMNAS STRUCTURAL PRESERVATION: VERIFIED
PRIVATE PRE-RUN BACKUP: PRESERVED
PILOT/DEV ISOLATION: VERIFIED
SECOND EXECUTION: NOT PERFORMED
CLIENT ACTIVATION: NOT AUTHORIZED BY THIS RECORD
PRODUCTION DEPLOYMENT: NOT EXECUTED
```
