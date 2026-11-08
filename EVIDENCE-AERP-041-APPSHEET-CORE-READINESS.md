# AERP-041 — Evidencia del gate AppSheet Core

## Estado y alcance

- Rama local: `feature/AERP-041-appsheet-core-readiness`.
- Base exacta: `15d65a019cecfa1170e48bb8615207f6b806f4d5`.
- Plan soportado: AppSheet Core, sin API Enterprise.
- No se modificaron las 17 tablas ni sus columnas.
- No se modificaron AERP-036, AERP-037 ni los contratos DT-SEC-01/03/04/05.
- No se ejecutaron `push`, `merge`, despliegues ni escrituras sobre Google Sheets.
- Las pruebas usan dobles locales de Apps Script y datos sintéticos.

## Contrato implementado

`aerpCreateAppSheetCoreReadinessValidator(configuration)` implementa un gate
fail-closed compuesto por dos evidencias diferentes:

1. validación automática de la estructura local aprobada; y
2. atestación manual durable de las comprobaciones que AppSheet Core no expone
   mediante una API oficial.

El validador verifica automáticamente:

- vínculo exacto a `sourceId`, `targetId` y `tenantId`;
- las 17 tablas y sus encabezados exactos;
- blueprint y manifiesto de presentación válidos e idénticos al plan vigente;
- hashes del plan, esquema y presentación;
- administrador OIDC confiable con permiso explícito `ADMINISTER` resuelto por
  AERP-036/AERP-037;
- versión de la plantilla y versión de la aplicación;
- hash SHA-256 del paquete de evidencia manual; y
- identidad del revisor sin almacenar su correo electrónico.

La atestación queda en `DocumentProperties`, es de una sola vinculación y se
puede reintentar de forma idempotente. Una escritura de resultado ambiguo se
reporta como `UNKNOWN` y nunca habilita el acceso mientras el estado sea
`INCOMPLETE`.

## Checklist obligatorio

La atestación solo acepta el conjunto exacto de comprobaciones, todas en
`true`:

- inicio de sesión obligatorio;
- proveedor de autenticación Google;
- `Allow all signed-in users` desactivado;
- allowlist explícita;
- filtros de seguridad en todas las tablas;
- actualizaciones restringidas por rol;
- Deployment Check aprobado;
- prueba positiva del administrador;
- prueba DENY del usuario restringido;
- prueba DENY entre tenants; y
- revisión del historial de auditoría.

Estas afirmaciones no sustituyen autorización. La autorización continúa en
AERP-036/AERP-037; visibilidad y navegación continúan en el manifiesto
AERP-040.

## Integración

`aerpCreateSecureAppsScriptInstaller(configuration)` ya no acepta que un
`validateApplication` aportado por el llamador complete la instalación. El
factory crea internamente el validador AppSheet Core y expone:

- `recordAppSheetCoreAttestation(input)`;
- `getAppSheetCoreReadiness()`; y
- las operaciones existentes del instalador.

La consulta de readiness vuelve a comprobar la vinculación, los hashes, el
checklist, el revisor OIDC y la autorización administrativa; un registro
presente pero alterado nunca se informa como válido.

Sin atestación válida, con evidencia alterada, con identidad sin permiso, con
un esquema distinto o con cualquier referencia cruzada, el resultado permanece
`INCOMPLETE` y `canAccess` devuelve `false`.

## Evidencia local

Entorno canónico disponible: Node.js `24.18.0`.

| Comprobación                         | Resultado                                              |
| ------------------------------------ | ------------------------------------------------------ |
| Suite funcional completa             | 333/333 PASS                                           |
| Adaptador, bootstrap y AppSheet Core | 24/24 PASS                                             |
| ESLint de archivos modificados       | PASS                                                   |
| Prettier de archivos modificados     | PASS                                                   |
| Globals real del repositorio         | 822 símbolos; 0 colisiones; 0 construcciones dinámicas |
| Bundle directo                       | PASS; 44 scripts; 45 archivos                          |
| `git diff --check`                   | PASS                                                   |

Los autotests que escriben y renombran artefactos temporales siguen afectados
por restricciones del sandbox Windows (`Access denied`, `taskkill` y renombres
temporales). El bundle directo, el inventario real, el análisis de globals y las
333 pruebas funcionales se ejecutan correctamente. Esta limitación del host no
se presenta como un gate canónico aprobado.

## Trabajo todavía externo y manual

Antes de marcar una copia real como `COMPLETE` deben existir:

1. plantilla AppSheet Core vinculada a la copia aislada;
2. matriz de filtros, CRUD, vistas y roles aplicada en el editor;
3. datos sintéticos de aceptación para administrador, usuario restringido y
   tenant alterno;
4. Deployment Check sin errores;
5. paquete de evidencia sanitizado y su SHA-256; y
6. atestación ejecutada por el administrador OIDC autorizado.

AppSheet Core no permite verificar automáticamente su configuración interna.
El gate registra y vincula la comprobación manual; no afirma haber inspeccionado
configuración que la plataforma no expone.
