# AERP-041 — Adaptador durable de Apps Script

## Base y alcance

- Repositorio: `reginaqf-ctrl/AlefERP`.
- Base comprobada: `2c562c3e8c3babf79812b2516f0e668a194ebf7d`, coincidente con
  `origin/feature/AERP-040-installer-integration` disponible localmente.
- Rama: `feature/AERP-041-apps-script-runtime-adapter`, en worktree independiente.
- Fecha: 2026-09-30. Node: `24.18.0`.
- Sin push, merge, deploy, ejecución remota ni escrituras en Google Sheets.
- Blueprint de 17 tablas, manifiesto comercial AERP-040 y `appsscript.json` sin cambios.

## Revisión previa y reutilización

Se revisaron el motor y las pruebas AERP-041, el coordinador y sus pruebas,
`11_Installer.js`, el blueprint, el manifiesto, la matriz AERP-041B y la revisión de
migración. Se contrastaron AERP-036/AERP-037 con DT-SEC-01/03/04/05.

El adaptador reutiliza `aerpCreateCommercialInstallerCoordinator`, el motor puro,
`aerpBuildCommercialInstallerPlan`, los validadores comerciales,
`aerpResolveTrustedAuthorizationPrincipal_` y `aerpAuthorizeFromMetadata`. No copia
el motor de permisos ni introduce reglas de autorización alternativas.

## Contrato de backend

`aerpCreateAppsScriptInstallerRuntime(configuration)` devuelve `analyze`, `plan`,
`verify`, `apply`, `rollback` y `canAccess`. La configuración procede exclusivamente
del backend y contiene:

- `sourceId`, `targetId`, `tenantId`: vinculación inmutable de esta instancia.
- `trustedPrincipalVerifier`: contrato DT-SEC-01, con `ok`, `verified`, `issuer`,
  `subjectId` y mapeo interno `userId`; recibe la evidencia opaca y la empresa solicitada.
- `verifyConfirmation`: valida evidencia de una confirmación humana explícita y
  devuelve la atestación del coordinador, incluyendo `planDigest`. Debe vincular
  sujeto, tenant, origen, destino, intención, versiones y SHA-256 del plan completo.
  No se incluye un verificador permisivo por defecto.
- `validateApplication(snapshot)`: validación de backend de la aplicación real
  vinculada a ese destino y tenant; devuelve `{ ok: true, errors: [] } únicamente
  tras validar la aplicación. El paquete descriptivo no sustituye esta validación.

Los requests conservan el contrato del coordinador. No pueden seleccionar
verificadores, opciones del repositorio ni proveedores de identidad. No se consulta
`Session.getActiveUser()`. Los tokens no se persisten y las referencias de
autenticación se descartan al terminar cada llamada.

La autorización consulta las hojas del documento activo mediante AERP-037/AERP-036.
Las mutaciones requieren `ADMINISTER` explícito sobre `ADMINISTRACION` en el tenant
configurado, antes y dentro del bloqueo. `READ` y `UPDATE` se traducen a las acciones
existentes `VIEW` y `EDIT`. La ausencia de metadata, un DENY aplicable, un principal
distinto o un tenant cruzado bloquean la operación. El binding administrativo no
concede permisos. El acceso por esta API exige COMPLETE y revalidación de estructura,
metadata, autorización y aplicación; no sustituye los controles de los consumidores
legados que aún no invoquen esta API.

## Persistencia y recuperación

Se implementa **DocumentProperties como propuesta de almacenamiento**. Los contratos
revisados no nombran un almacenamiento durable aprobado; se ha solicitado aclaración.
Esta evidencia no convierte esa propuesta en una aprobación arquitectónica.

La API utiliza únicamente el documento activo, comprueba su ID y no llama a
`openById`. `LockService.getDocumentLock()` protege lecturas consistentes y escrituras.
No hay fallback a locks de usuario ni a propiedades de script compartidas.

- Namespace: `AERP041:v1:`. El registro de estado vincula origen, destino y tenant.
- Estados durables: EMPTY, INCOMPLETE y COMPLETE. EMPTY se confirma antes de la
  primera transición a INCOMPLETE; el preflight no escribe.
- Cada escritura de propiedad se relee antes de reconocerla. Los recursos grandes
  se fragmentan en 2.000 unidades UTF-16 por propiedad y su cabecera se publica al
  final. Los fragmentos existentes deben coincidir exactamente para reanudarse.
- El journal conserva fases, eventos y ordinales; no guarda tokens, errores de
  servicio ni datos del cliente. El cursor se confirma después de cada entrada y
  los registros anteriores no se sobrescriben. Límite conservador: 4.096 entradas;
  agotamiento o cuota insuficiente bloquean la instalación.
- Las tablas se crean sólo si faltan. Se ejecuta `SpreadsheetApp.flush()` y se
  releen las cabeceras. Las cabeceras incompatibles nunca se reescriben.
- Una tabla vacía sólo puede reanudarse automáticamente cuando su ID físico
  coincide con el registro durable de propiedad del adaptador. Si el proceso muere
  entre `insertSheet` y ese registro, la tabla queda incompatible para revisión
  manual; no se presume propiedad ni se borra.
- Una respuesta perdida, fallo de journal, lectura o escritura fallida conserva
  `persistence: UNKNOWN`, aunque posteriormente se confirme la cuarentena.
- Recuperar significa persistir INCOMPLETE y conservar recursos; no hay borrado,
  truncado, migración de ALLOW heredados ni ampliación de permisos.

Referencias oficiales consultadas:
[PropertiesService](https://developers.google.com/apps-script/reference/properties/properties-service),
[LockService](https://developers.google.com/apps-script/reference/lock/lock-service).
La validación local usa dobles de estos servicios, no acredita una ejecución remota.

## Pruebas y gates

El ciclo inicial produjo siete fallos por ausencia del adaptador. La suite final del
adaptador contiene 15 pruebas: instalación con permisos explícitos, reconstrucción
de instancia, idempotencia, metadata ausente, precedencia DENY, entradas inválidas,
tenant cruzado, identidad no verificada, confirmación y digest inválidos, bloqueo,
fallos de estado/journal/fragmentos, respuesta perdida, almacenamiento corrupto,
cabeceras incompatibles, tabla vacía propia/ajena, recuperación y aplicación ausente.
Las pruebas ejecutan los motores reales AERP-036/AERP-037, sin inyectar un ALLOW.

| Comprobación                               | Resultado                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| Suite completa `npm.cmd test`              | PASS: 324/324, 9 suites, 0 omitidas                                            |
| Adaptador durable                          | PASS: 15/15                                                                    |
| ESLint `npm.cmd run lint`                  | PASS, salida 0                                                                 |
| Prettier global `npm.cmd run format:check` | FAIL: 18 archivos heredados                                                    |
| Prettier de archivos modificados           | Pendiente de comprobación final                                                |
| Globals Gate                               | PASS: 815 símbolos, 847 ocurrencias, 0 duplicados, 0 construcciones dinámicas  |
| Autotests Globals Gate                     | PASS: 37, 0 fallos, 1 omitida por ser POSIX en Windows                         |
| Bundle Gate                                | PASS: 18/18; 42 scripts, 43 archivos; `claspPrepared=false`                    |
| Autotests del gate de pruebas              | PASS: 42/42 fuera del sandbox; dentro falla la terminación de procesos Windows |
| Husky                                      | PASS: git hook run pre-commit, salida 0; ESLint y Prettier activos             |
| `git diff --check`                         | PASS; pendiente de comprobación final                                          |

Se actualizaron los inventarios positivos y sus recuentos exactos para el nuevo
archivo y la novena suite. No se deshabilitaron controles. Un primer autotest IPC de
Globals falló por orden de mensajes; la repetición completa pasó sin modificar su
lógica ni sus plazos. No se presenta ese primer intento como un PASS.

Los 18 archivos con formato heredado son `.prettierrc`, `.vscode/launch.json`,
`.vscode/settings.json`, `06_MetadataValidator.js`, `07_Writer.js`, `08_Generator.js`,
`09_Tests.js`, `13_FrameworkSchema.js`, `18_Menu.js`, `22_UIFoundation.js`,
`23_CommercialDashboard.js`, `24_BuildReport.js`, `25_ProductBranding.js`,
`33_LayoutEngine.js`, `34_LayoutFoundation.js`, `AERP-027_UITheme.js`,
`AERP-029_SheetRenderer.js` y `AGENTS.md`. Se preservan fuera del incremento acotado.

## Límites y resultado

**CHANGES REQUIRED para declarar la instalación limpia plenamente ejecutable.**

1. Una copia totalmente vacía no tiene concesiones AERP-037 y recibe DENY. El happy
   path usa tres tablas de autorización compatibles con concesiones explícitas de
   prueba. Falta una decisión aprobada para el aprovisionamiento inicial de permisos;
   el adaptador no inventa una excepción de bootstrap ni migra permisos legacy.
2. No se ha proporcionado un proveedor real de identidad, un servicio real de
   confirmación ni un validador de aplicación. Son dependencias de backend explícitas;
   no se suplantan con dobles en producción.
3. Debe ratificarse DocumentProperties o indicarse el almacenamiento ya aprobado.
4. Prettier global sigue rojo en los 18 archivos heredados. Requiere un cambio de
   formato separado si se exige un repositorio completamente verde.

El incremento entrega un adaptador local revisable y probado, no una afirmación de
que la copia limpia ya tenga identidad, permisos y aplicación aprovisionados.
