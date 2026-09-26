# AERP-041C — Isolated Installer Engine

## Base y alcance

- Base exacta: `8ac0a758ee1a288da05ad26f3462883c169dd1d7`.
- Rama: `feature/AERP-041-isolated-installer-engine`.
- Worktree independiente: `C:/AlefERP/.worktrees/AERP-041`.
- Fecha de comprobación: 2026-09-26. Node.js: `v24.18.0`.
- Únicamente motor, suite específica y esta evidencia. Sin integración con hojas,
  llamadas a servicios, despliegue, push, merge ni ejecución de `runGenerarERP`.

El motor interpreta el plan comercial AERP-040 real y revalida blueprint y
presentación mediante sus validadores existentes, inyectados explícitamente.
`ok: true` por sí solo no valida un plan. Solo admite la versión `1.0.0`.
No importa ni modifica los módulos AERP-036/AERP-037 ni el instalador existente.

## Contrato público

La única exportación global es `aerpCreateIsolatedInstallerEngine(dependencies)`.
Devuelve una API congelada; resultados, operaciones y argumentos entregados al
adaptador son copias defensivas congeladas recursivamente.

| Método                       | Responsabilidad                                                                                                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `analyze(request, snapshot)` | Preflight puro. Clasifica `CLEAN`, `PARTIAL`, `COMPLETE` o `INCOMPATIBLE`; rechaza aislamiento, identidad o entradas inválidas.                                                                     |
| `plan(request, snapshot)`    | Lista determinista de operaciones `CREATE_IF_ABSENT`, exclusivamente para recursos ausentes. No escribe.                                                                                            |
| `apply(request, adapter)`    | Recalcula bajo bloqueo, marca `INCOMPLETE`, registra fases, crea recursos ausentes, vuelve a inspeccionar y valida antes de marcar `COMPLETE`. No acepta operaciones prefabricadas del solicitante. |
| `verify(request, snapshot)`  | Comprueba estructura y seguridad sin cambiar estado. Un snapshot válido aún marcado `INCOMPLETE` devuelve `PARTIAL`, aunque `verified` sea verdadero.                                               |
| `rollback(request, adapter)` | Recuperación conservadora: marca `INCOMPLETE` y devuelve `recovery: 'RESUME'`. Conserva todos los recursos y datos.                                                                                 |
| `canAccess(context)`         | Guard adicional puro sobre un puente de autorización confiable. Exige identidad, mismo tenant y veredicto externo explícito; no sustituye AERP-036/AERP-037.                                        |

`request` contiene:

```javascript
{
  sourceId: 'source-1',
  targetId: 'copy-1',
  tenantId: 'tenant-A',
  commercialPlan: validatedAerp040Plan,
  identity: trustedSessionReference
}
```

Los identificadores de origen, target, tenant y sujeto deben ser opacos, de 1 a
128 caracteres alfanuméricos, guion o guion bajo. El motor no los registra.
`identity` es una referencia a una identidad que el resolvedor confiable pueda
validar, nunca una prueba basada en un email o un flag enviado por el cliente.
No debe contener secretos; la entrada no se devuelve ni se registra.

Dependencias puras y síncronas, suministradas por código confiable:

- `validateBlueprint(blueprint)`:
  `aerpValidateCommercialBlueprint` existente.
- `validatePresentation(manifest, blueprint)`:
  `aerpValidateCommercialPresentationManifest` existente.
- `verifyIdentity(candidate)`: devuelve
  `{ verified: true, subjectId, tenantId }` solo tras validar identidad y tenant,
  o `null`. Sin identidad confiable: `ADMIN_IDENTITY_REQUIRED`.
- `validateSecurity(snapshot, { targetId, tenantId, subjectId })`: validador
  independiente obligatorio. Debe verificar autorización real, aislamiento,
  identidad administrativa, metadata y aplicación correspondientes a ese snapshot.
- `authorize({ subjectId, tenantId, resourceTenantId, resource, action })`:
  puente futuro AERP-036/AERP-037. Solo autoriza cuando devuelve
  `{ decision: 'ALLOW', explicitDeny: false }`. Cualquier ausencia, excepción,
  DENY o resultado ambiguo deniega. La visibilidad no se pasa a este puente.

Los validadores devuelven `{ ok: true, errors: [] }` para éxito. Sus mensajes de
error y excepciones nunca se propagan a resultados ni journal.
La implementación conserva el orden de propiedades al copiar: el validador
AERP-040 de presentación compara ciertos objetos mediante `JSON.stringify`.
Para compatibilidad de recursos, compara objetos independientemente del orden
de sus propiedades; el orden de las cabeceras sí es contractual.

`canAccess` recibe `identity`, `tenantId`, `resourceTenantId`, `resource` y
`action`. Acciones admitidas: `READ`, `CREATE`, `UPDATE`, `DELETE`, `APPROVE`,
`EXPORT`, `IMPORT`, `PRINT`, `ADMINISTER`. El puente debe traducirlas al contrato
del runtime. El integrador debe obtener el tenant real del recurso desde datos
confiables y bloquear el uso normal de instalaciones que no estén completas.

## Snapshot y recursos

`snapshot` es una lectura autoritativa del adaptador, no un objeto aportado por
un cliente HTTP. Contiene `sourceId`, `boundTargetId`, `tenantId`, `status`,
`resources` y `security`. El origen y la vinculación deben comprobarse desde el
entorno real. Estados persistidos admitidos: `EMPTY`, `INCOMPLETE`, `COMPLETE`.

Cada recurso es `{ key, kind, payload }`. El plan comercial de esta base produce
21 recursos lógicos, en orden determinista:

1. Las 17 tablas, ordenadas por nombre físico: `table:<physicalName>`, tipo
   `TABLE`, payload `{ headers: [...] }`.
2. `metadata:blueprint`, tipo `BLUEPRINT`, con el blueprint validado.
3. `metadata:presentation`, tipo `PRESENTATION`, con el manifiesto validado.
4. `security:policy`, tipo `POLICY`, con Default DENY, DENY precedence,
   separación de visibilidad y aislamiento de tenant.
5. `security:admin-binding`, tipo `ADMIN_BINDING`, con sujeto y tenant verificados
   y `grantsAuthorization: false`.

Estos son recursos abstractos: los dos recursos de metadata no equivalen a
materializar todas las filas del repositorio ni a desplegar una aplicación.
El binding identifica al administrador previsto, **no crea usuarios, roles ni
permisos efectivos**. El aprovisionamiento administrativo real queda para la
integración, con su autorización explícita y validación independiente.

El snapshot de tablas incluye cabeceras exactas; no incluye filas de negocio.
El adaptador debe conservar esas filas. Recursos ajenos al plan se conservan.
Identidades de recurso duplicadas o payloads incompatibles bloquean la operación;
el motor no sobrescribe, migra ni elimina recursos existentes. Un recurso lógico
parcialmente materializado debe reportarse como incompatible hasta que el
adaptador complete su recuperación interna de manera segura.

Además de la validación estructural y el validador independiente,
`snapshot.security` debe declarar exactamente:

```javascript
{
  defaultDecision: 'DENY',
  denyPrecedence: true,
  visibilityGrantsAuthorization: false,
  tenantIsolation: true,
  authorizationValidated: true,
  adminAccessValidated: true,
  metadataValidated: true,
  applicationValidated: true
}
```

Son evidencias derivadas de comprobaciones reales y actuales, no valores por
defecto. Con cero permisos administrativos no puede afirmarse
`adminAccessValidated`; el guard de acceso deniega sin ALLOW explícito.
`COMPLETE` significa que el contrato inyectado verificó todo lo anterior; este
commit no declara ninguna instalación externa operativa.

## Adaptador síncrono y persistencia

| Operación                                 | Obligaciones                                                                                                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `withExclusiveTarget(targetId, callback)` | Ejecutar callback exactamente una vez y síncronamente bajo exclusión mutua del target, hasta terminar la validación y el estado final. Liberar siempre el bloqueo; no revertir la cuarentena cuando el callback devuelve fallo. |
| `readSnapshot(targetId)`                  | Leer estado actual completo y procedencia/vinculación verificadas del target, con evidencias de seguridad actuales. No omitir colisiones ni cabeceras incompatibles.                                                            |
| `setState(targetId, state)`               | Persistir estado antes de devolver `true`. Cualquier otro resultado es fallo.                                                                                                                                                   |
| `appendJournal(targetId, entry)`          | Persistir la entrada sanitizada antes de devolver `true`. No enriquecerla con datos de usuario.                                                                                                                                 |
| `createIfAbsent(targetId, operation)`     | Crear atómicamente solo si no existe; devolver `CREATED` o `EXISTS` compatible. Nunca reemplazar contenido incompatible.                                                                                                        |

No se admiten adaptadores asíncronos. Se rechazan funciones async declaradas y
resultados Promise; un callback diferido queda cerrado al retornar. La seguridad
frente a concurrencia y la durabilidad real pertenecen al adaptador confiable.
El motor no puede impedir efectos arbitrarios de un adaptador malicioso.

La clave idempotente es el par `(targetId, operation.id)`, donde el ID de operación
es `AERP-041:1:<resource.key>`. Un reintento relee el snapshot y omite recursos
compatibles existentes, incluso si su creación anterior persistió pero lanzó
una excepción antes de confirmarse. Las entradas de journal pueden repetirse
entre intentos; los recursos no. El journal no es la fuente de verdad del reintento.

Antes de la primera creación se persiste `INCOMPLETE`. Un fallo posterior vuelve
a intentar persistir ese estado dentro del bloqueo. El resultado indica:

- `persistence: 'CONFIRMED'`: el adaptador confirmó el estado.
- `persistence: 'UNCHANGED'`: no se inició una mutación.
- `persistence: 'UNKNOWN'`: falló el almacenamiento o el protocolo del bloqueo;
  no se afirma que el estado haya quedado persistido. Requiere cuarentena y
  reconciliación autoritativa antes de permitir uso normal.

Una incompatibilidad de preflight no modifica el target, incluso si este tenía
un marcador `COMPLETE` obsoleto. Ese marcador nunca evita la revalidación.
La recuperación no borra recursos: reintentar `apply` retoma el estado compatible.
No incluye migraciones, borrado de tablas ni compensación destructiva.

## Sanitización y entradas hostiles

Journal con lista cerrada de campos: `phase`, `event` y, para operaciones, un
ordinal numérico estable. Fases: `ANALYZE`, `PLAN`, `APPLY`, `VERIFY`, `RECOVERY`.
No contiene emails, tokens, secretos, sujetos, tenants, IDs de hojas, payloads,
mensajes de excepciones ni stack traces. Un evento local puede no haber llegado
a persistirse si el adaptador de journal falló.

Los errores públicos son códigos fijos. La copia rechaza accessors, funciones,
prototipos especiales, claves de contaminación de prototipo, ciclos y profundidad
excesiva. No invoca `toJSON`; las excepciones de proxies y dependencias se capturan.
Los planes contienen payloads operativos y el binding opaco: no deben usarse como
logs ni enviarse a consumidores sin autorización.

## Pruebas y controles ejecutados

Suite específica: **31 pruebas, 31 aprobadas, 0 fallos, 0 omitidas**.
Usa el plan real generado por `11_Installer.js` en un contexto de prueba, los
validadores AERP-040 existentes y un adaptador exclusivamente en memoria.
Identidad, autorización y validación de seguridad usan dobles explícitos;
no se afirma cobertura de integración del runtime AERP-036/AERP-037.

Cobertura: instalación limpia, reintento idempotente, aislamiento origen/target y
vinculación, blueprint inválido, versiones y separación de seguridad, esquema
incompatible, parcial compatible, duplicados, fallo tras escritura persistida,
sanitización, recuperación, identidad no verificada, tenant incorrecto, cero
permisos, Default DENY, DENY precedence, aislamiento A/B, visibilidad sin acceso,
fallos de journal/verificación/completion, estado no persistible, getters/proxies/
ciclos/toJSON hostiles, inmutabilidad, COMPLETE falsificado, adaptador inválido,
asincronía, confirmación durable, acciones inválidas y validador independiente.

Comandos, ejecutados desde el worktree:

```powershell
node --test AERP-041_IsolatedInstallerEngine.test.js
node C:/AlefERP/node_modules/eslint/bin/eslint.js --max-warnings=0 AERP-041_IsolatedInstallerEngine.js AERP-041_IsolatedInstallerEngine.test.js
node C:/AlefERP/node_modules/prettier/bin/prettier.cjs --check AERP-041_IsolatedInstallerEngine.js AERP-041_IsolatedInstallerEngine.test.js EVIDENCE-AERP-041-INSTALLER-ENGINE.md
git diff --check
git diff --cached --check
```

Se usaron las herramientas ya instaladas, sin cambiar dependencias. El hook Husky
se ejecuta en el commit usando `git -c core.hooksPath=C:/AlefERP/.husky/_ commit`:
el worktree nuevo no contiene los wrappers generados de Husky. Esto reutiliza los
wrappers existentes, conserva `lint-staged` y no modifica configuración compartida.

## Integración pendiente y límites

No se ejecutan suite canónica, Globals Gate ni Bundle Gate en esta entrega:
requieren registrar los archivos nuevos en manifiestos compartidos, fuera de alcance.
El responsable de integración deberá modificar posteriormente:

- `11_Installer.js`: conectar API, identidad confiable, adaptador, estado y validaciones.
- `qa/manifests/test-suites.json`: registrar la suite y reconciliar inventario.
- `qa/manifests/apps-script-globals.json`: registrar/clasificar el motor y su exportación.
- `qa/manifests/apps-script-bundle.json`: incluir el motor con el orden apropiado;
  mantener pruebas fuera del bundle.
- Añadir el adaptador real y las pruebas de integración en archivos que determine
  el integrador. No requiere relajar contratos ni cambiar AERP-036/AERP-037.

Riesgos pendientes: identidad verificable en plataforma, exclusión mutua y
persistencia durable, recuperación de fallos de almacenamiento, materialización
atómica de recursos lógicos, validación real de metadata y aplicación vinculada,
puente de seguridad y autorización administrativa efectiva. El adaptador debe
considerar snapshots y referencias de sesión fronteras de confianza, impedir
replay de evidencias y preservar todos los datos existentes. Después de integrar,
ejecutar la suite completa y todos los gates sobre el artefacto exacto.
