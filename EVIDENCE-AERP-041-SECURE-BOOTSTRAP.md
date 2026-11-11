# AERP-041 — Evidencia del bootstrap seguro de una sola ejecución

## Estado y alcance

- Rama local: `feature/AERP-041-secure-bootstrap`.
- Base exacta: `742e98b9180f5fe58d68736205fd041ff19fafc5`.
- Alcance: bootstrap inicial para una copia vacía, aislada y vinculada al documento.
- No se modificaron las 17 tablas del blueprint AERP-040 ni sus columnas.
- No se modificaron AERP-036, AERP-037, DT-SEC-01, DT-SEC-03, DT-SEC-04 ni
  DT-SEC-05.
- No se ejecutaron `push`, `merge`, despliegues ni escrituras sobre Google
  Sheets. Las pruebas usan dobles locales de los servicios de Apps Script.

## Decisiones aprobadas aplicadas

1. `DocumentProperties` almacena el estado durable por documento.
2. La identidad inicial se obtiene directamente mediante
   `ScriptApp.getIdentityToken()`; no se acepta un token aportado por la
   solicitud.
3. El manifiesto solicita solamente los scopes adicionales `openid` y
   `https://www.googleapis.com/auth/userinfo.email` para el bootstrap OIDC.
4. La confirmación es explícita, de duración acotada, vinculada a identidad,
   origen, destino, tenant, intención, plan y configuración.
5. La copia debe estar vacía. Una hoja ajena con cualquier dato bloquea el
   bootstrap antes de crear las tablas.
6. El bootstrap crea metadata administrativa explícita para los ocho módulos
   aprobados. La ausencia de metadata nunca equivale a autorización.
7. El claim es de una sola ejecución y pasa por `PENDING`, `CLAIMED` y
   `CONSUMED`.
8. La instalación permanece `INCOMPLETE` y `canAccess` devuelve `false` hasta
   que el validador de la plantilla AppSheet aprobada confirme el vínculo.

## Contrato implementado

`aerpCreateSecureAppsScriptInstaller(configuration)` compone el bootstrap y el
adaptador durable sin permitir que el llamador reemplace los verificadores de
identidad, confirmación, claim o consumo. Expone:

- `issueConfirmation`
- `analyze`
- `plan`
- `verify`
- `apply`
- `rollback`
- `canAccess`

El contrato requiere configuración backend para `sourceId`, `targetId`,
`tenantId`, audiencia OIDC, empresa inicial y validación de la aplicación. La
confirmación admite un TTL entero entre 60 y 900 segundos.

## Controles de seguridad verificados

- Emisor OIDC de Google, audiencia configurada, sujeto, expiración, emisión,
  correo verificado y vinculación al tenant.
- ID de usuario interno derivado de `issuer + subject`; no se usa el correo como
  clave de autorización.
- Nonce almacenado únicamente como SHA-256.
- Confirmación y claim protegidos por `DocumentLock`.
- Escrituras con lectura de confirmación y reintento idempotente.
- Provisión únicamente después de que las siete tablas de seguridad existan y
  sus encabezados coincidan exactamente.
- Filas administrativas deterministas, explícitas y aisladas por
  `ID_Empresa`.
- AERP-036/AERP-037 vuelven a ser la única autoridad después de la provisión.
- Un fallo al consumir el bootstrap produce persistencia `UNKNOWN`; nunca se
  declara éxito silenciosamente.

La carga OIDC no se firma nuevamente dentro del proyecto: se acepta solamente
porque el token se obtiene directamente del servicio confiable
`ScriptApp.getIdentityToken()` y nunca desde datos del llamador.

## Evidencia de pruebas

Entorno canónico: Node.js `24.18.0`, npm `11.16.0`.

| Comprobación                     | Resultado                                              |
| -------------------------------- | ------------------------------------------------------ |
| Suite completa                   | 328/328 PASS                                           |
| Adaptador y bootstrap            | 19/19 PASS                                             |
| ESLint                           | PASS                                                   |
| Prettier de archivos modificados | PASS                                                   |
| Prettier global                  | FAIL heredado; 18 archivos fuera de este incremento    |
| Globals Gate                     | 817 símbolos; 0 colisiones; 0 construcciones dinámicas |
| Autotests de Globals             | 37 PASS; 1 omitido por plataforma                      |
| Bundle Gate                      | 18/18 PASS; 43 scripts; 44 archivos                    |
| `git diff --check`               | PASS                                                   |
| Autotests del Test Gate          | 41/42; pendiente confirmación de `taskkill` en Windows |

El único fallo del Test Gate no pertenece al código del producto: el entorno
no confirmó el cierre de un árbol de procesos de prueba mediante `taskkill`.
La prueba funcional completa y los demás gates permanecen en verde.

## Seguimientos antes de una instalación real

1. Conectar el validador backend de la plantilla AppSheet aprobada.
2. Configurar la audiencia OIDC real del proyecto Apps Script vinculado.
3. Ejecutar el Test Gate en un host Windows que permita confirmar `taskkill`.
4. Normalizar en una tarea separada los 18 archivos heredados detectados por
   Prettier, sin mezclar ese refactor con el bootstrap.
5. Obtener autorización separada antes de cualquier push, merge, despliegue o
   escritura sobre la copia de Google Sheets.
