# REVIEW-AERP-041-SECURITY-MIGRATION

**Rama:** `review/AERP-041-security-migration`
**Commit base:** `8ac0a75` (`feat(installer): add isolated-copy commercial preflight`)
**Alcance:** Solo lectura de código. Cero escrituras en Google Sheets, cero ejecución de `runGenerarERP`, cero publicación Apps Script, cero cambios en contratos congelados.
**Copia aislada objetivo:** `1rW009D6ZLpUmfjDTUcwhGowyddXcWBAp7_cWklieMY4` (67 hojas, no modificada por esta revisión).

---

## 1. Inventario de contratos afectados

| Contrato / artefacto                                                             | Estado en `8ac0a75`                                                                                                                                   | Relevancia para AERP-041                                                                                                              |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `DT-SEC-01_TrustedAuthorizationPrincipal_CONTRACT.md`                            | Aprobado, implementado en `37_AuthorizationMetadataRepository.js` (`aerpResolveTrustedAuthorizationPrincipal_`)                                       | Bloquea la creación de un administrador desde un email no verificado; ninguna instalación puede asignar rol admin sin `verified:true` |
| `DT-SEC-03_ImmutableDefaultDeny_CONTRACT.md`                                     | Aprobado/congelado, implementado (`defaultDecision` fijado a `DENY`, no configurable por cliente, cubierto por prueba `RULE_IMMUTABLE_DEFAULT_ALLOW`) | Cualquier tabla o regla que quede sin definir tras la migración deniega por defecto                                                   |
| `DT-SEC-04_StrictConditionValidation_CONTRACT.md`                                | Aprobado/congelado                                                                                                                                    | Relevante si la migración introduce condiciones nuevas para roles heredados: solo se aceptan si pasan el schema cerrado de operadores |
| `DT-SEC-05_GlobalDenyPrecedence_CONTRACT.md`                                     | Aprobado/congelado, implementado (`GLOBAL_DENY_PRECEDENCE` en el motor)                                                                               | Ningún `ALLOW` heredado de `CORE_PERMISOS` puede neutralizar un `DENY` aplicable tras la migración                                    |
| `AERP-040_INSTALLER_ONBOARDING_MVP_CONTRACT.md`                                  | Aprobado para implementación técnica; **no autoriza escrituras, acceso de clientes ni producción**                                                    | Es el contrato que gobierna qué puede y no puede hacer el instalador; el motor de aplicación (AERP-041C) todavía no existe            |
| `AERP-040_CommercialBlueprint.js` / `AERP-040_CommercialPresentationManifest.js` | Implementados, puros, sin I/O; 17 tablas, `ID_Empresa` como columna de tenant en 16 tablas dependientes                                               | Define el modelo destino contra el que se compara la copia legacy                                                                     |
| `11_Installer.js` (`aerpPreviewCommercialInstallation`)                          | Implementado, **estrictamente de solo lectura** (`getValues`/`getDataRange`, ningún `setValues`/`appendRow`)                                          | Es el único componente que hoy "toca" la copia aislada, y solo para leer y comparar cabeceras                                         |
| `ALEF_ERP_1_0_DELIVERY_STATUS.md`                                                | Estado de lanzamiento: **NO-GO — producto 1.0 incompleto**; RB-01 "Instalador inexistente" listado como bloqueo crítico                               | Confirma independientemente, desde el propio repositorio, que no existe todavía motor de escritura                                    |

No se detectaron contratos `DT-SEC-*` adicionales fuera de los cuatro listados (`01`, `03`, `04`, `05`); no existe `DT-SEC-02` en el árbol de trabajo en este commit.

---

## 2. Amenazas y posibles fallos

1. **Colisión de nombres físicos garantizada, no hipotética.** Las 7 hojas heredadas que la copia conserva (`CORE_EMPRESAS`, `CORE_USUARIOS`, `CORE_ROLES`, `CORE_MODULOS`, `CORE_USUARIO_ROL`, `CORE_ROL_MODULO`, `CORE_PERMISOS`) usan **exactamente los mismos `physicalName`** que las 7 primeras tablas del blueprint AERP-040. Esto significa que la migración en el mismo lugar (opción 1) chocará directamente contra estas hojas; no es un riesgo marginal, es el caso central a resolver.
2. **Reinterpretación silenciosa de IDs antiguos.** Si las columnas clave (`ID_Empresa`, `ID_Usuario`, `ID_Rol`, etc.) de la copia legacy no comparten el mismo espacio de identificadores que el blueprint, reutilizar la hoja sin transformación explícita podría hacer que un `ID_Rol` antiguo apunte, tras la instalación, a un rol distinto del que el cliente esperaba. El preflight actual (`aerpInstallerRegistryConflicts_`) solo compara `CORE_TABLAS`/`CORE_COLUMNAS` contra el blueprint; no valida coherencia semántica de datos de negocio en `CORE_USUARIO_ROL` o `CORE_ROL_MODULO`.
3. **Ausencia total de motor de escritura.** No existe ninguna función `apply`/`install` que escriba en la hoja en este commit. Cualquier decisión de "migrar" o "instalar en paralelo" hoy es papel: no hay manera de ejecutarla sin construir primero el motor (tarea AERP-041C, deliberadamente no integrada aquí).
4. **Autorización basada en convención (`context.companyId`), no en un campo estructural distinto.** El aislamiento por tenant en `36_AuthorizationEngine.js` se resuelve como una condición de regla más (`path: 'context.companyId'`), validada por el motor de condiciones estricto (DT-SEC-04). Esto es coherente con el contrato, pero significa que el aislamiento multiempresa depende de que **todas** las reglas migradas/generadas incluyan esa condición; una regla mal generada durante la migración (p. ej. copiada de `CORE_PERMISOS` legacy sin adaptarla) podría quedar sin `companyId` y, aunque seguiría cayendo en Default DENY si no hay match, un `ALLOW` mal migrado sin ese scoping sería una fuga de aislamiento entre empresas.
5. **Identidad del administrador.** `DT-SEC-01` exige `verified:true` y un verificador de backend; hoy no hay adaptador de proveedor de identidad conectado (fuera de alcance, ver contrato). El instalador aún no implementa el estado `ADMIN_IDENTITY_REQUIRED` mencionado en el encargo de AERP-041C; hasta que exista, cualquier "creación de administrador" tendría que apoyarse en el usuario activo de Apps Script (`Session.getActiveUser()`), que **no** es una identidad verificada según el contrato — riesgo de romper Default DENY si se implementa de forma apresurada.
6. **Activación parcial.** Si una instalación se marca `COMPLETE` sin que las 17 tablas, el manifiesto de presentación y la seguridad estén validados en conjunto, el modelo de menús/vistas (visibilidad) podría quedar activo sin que la autorización real lo respalde. El contrato de separación (`visibilityGrantsAuthorization: false`, verificado en `aerpInstallerSecurityContractValid_`) mitiga esto, pero solo si el instalador rechaza planes incompletos — lo cual sí hace hoy (`aerpInstallerFailurePlan_`).
7. **Filas "vacías" con formato pero sin datos.** El preflight actual no distingue entre fila vacía formateada y fila con datos reales; usa `getLastRow()`/`getLastColumn()` de la hoja completa. Una hoja legacy con formato aplicado a 500 filas pero solo 12 con datos podría producir falsos `CONFLICT` o falsos `KEEP` según cómo se interprete `dataRows`. Esto es responsabilidad conjunta con AERP-041B (matriz de compatibilidad), pero afecta directamente la fiabilidad del preflight de seguridad.
8. **Entorno de pruebas no reproducible en esta revisión.** El repositorio exige Node `24.18.0` (`.nvmrc`) para el gate canónico de pruebas; este entorno de revisión tiene Node `22.22.2` disponible, por lo que la ejecución de `npm test` falló en la fase `node-version` (`UNEXPECTED_FAILURE`, 0 pruebas ejecutadas) antes de llegar a evaluar ninguna suite. Esto **no es un hallazgo de seguridad del producto** — de hecho, el gate de versión funcionando como bloqueo es la conducta correcta — pero significa que las cifras "264/264" y "Bundle Gate 18/18" de `ALEF_ERP_1_0_DELIVERY_STATUS.md` no pudieron reproducirse de forma independiente en esta revisión y deben tomarse como evidencia reportada, no verificada aquí. `ESLint` sí se ejecutó en este entorno y pasó sin errores, confirmando ese punto del estado de entrega.

---

## 3. Decisión entre migración, coexistencia o plantilla limpia

**Recomendación: opción 3 (plantilla estructural limpia + traslado selectivo de datos compatibles), no opción 1 ni opción 2 en su forma pura.**

Razonamiento:

- **Opción 1 (migrar la copia existente in situ) se descarta como camino directo.** La colisión de nombres en las 7 tablas `CORE_*` es total, no parcial. El preflight actual ya está diseñado para bloquear esto con `AERP_INSTALL_PREVIEW_SCHEMA_CONFLICT` en cuanto las cabeceras no coincidan exactamente, lo cual es casi seguro dado que "estas estructuras no coinciden exactamente con el blueprint AERP-040" (dato de partida del encargo). Forzar esta ruta requeriría desactivar o relajar esa comprobación, lo cual iría contra el principio de "no sobrescribir tablas ni cabeceras incompatibles" exigido para el motor AERP-041C.
- **Opción 2 (blueprint en paralelo con nombres distintos) resuelve la colisión de nombres pero no resuelve el problema de fondo:** dejaría dos conjuntos de verdad de identidad y permisos (`CORE_USUARIOS` legacy vs. `CORE_USUARIOS_V2` o similar) en la misma copia, lo que es exactamente el escenario que `DT-SEC-01`/`DT-SEC-05` buscan evitar: dos fuentes de autorización compitiendo aumenta la superficie de error humano (¿qué motor consulta el Authorization Engine en producción?) sin necesidad real, ya que el propósito declarado (demo a inversores) no exige conservar el sistema legacy operativo en paralelo.
- **Opción 3 es la más segura porque:** (a) el blueprint AERP-040 ya es neutral respecto al cliente y no incluye IDs ni datos reales; (b) permite decidir campo por campo qué se traslada (tarea que corresponde a la matriz de AERP-041B) sin heredar automáticamente permisos `ALLOW` legacy que no han sido auditados contra Default DENY; (c) es coherente con el principio ya adoptado por el propio `11_Installer.js`, que solo crea recursos ausentes y nunca sobrescribe.

Esta decisión es **condicional**: depende de que la matriz de compatibilidad (AERP-041B) confirme qué datos de `CORE_USUARIOS`/`CORE_ROLES`/`CORE_USUARIO_ROL` son trasladables sin pérdida ni reinterpretación. Esta revisión no tiene acceso a los datos reales de la copia (no se abrió el Google Sheet, por restricción de alcance) y no puede confirmar el volumen de datos afectados.

---

## 4. Precondiciones exactas para realizar escrituras

Ninguna escritura debe ejecutarse hasta que **todas** las siguientes condiciones se cumplan simultáneamente:

1. El motor de instalación puro (AERP-041C: `analyze` → `plan` → `apply` → `verify` → `rollback`) exista, esté integrado con `11_Installer.js` y tenga cobertura de prueba positiva, negativa y de seguridad (lista ya especificada en el encargo de AERP-041C).
2. `aerpPreviewCommercialInstallation` devuelva `status: 'READY_FOR_STRUCTURE'` con `errors: []` sobre la copia aislada real (no simulada), confirmando `targetId` distinto de `sourceId` y coincidente con el `spreadsheet.getId()` activo.
3. La matriz AERP-041B esté completa y clasifique cada campo heredado como equivalente, renombrable, transformable, heredado a conservar, incompatible o requerido ausente — sin discrepancias omitidas.
4. Exista un verificador de identidad (`trustedPrincipalVerifier`) configurado en código de backend que devuelva `verified: true` antes de crear cualquier administrador; si no existe, el flujo debe responder `ADMIN_IDENTITY_REQUIRED` (o equivalente) y detenerse, no usar el email de sesión de Apps Script como sustituto.
5. Backup verificado y accesible de la copia aislada (67 hojas) tomado inmediatamente antes de cualquier escritura, con procedimiento de restauración probado.
6. Confirmación explícita y humana (no automática) de qué opción de las tres se ejecuta, registrada en el journal de instalación.
7. Cero reglas `ALLOW` generadas automáticamente a partir de la ausencia de datos legacy — si un campo no puede migrarse, el resultado debe ser `DENY`/bloqueo, nunca una concesión por omisión.
8. El working tree del commit a instalar debe estar limpio y coincidir con el commit auditado; cualquier cambio posterior a `8ac0a75` en los archivos de seguridad (`36_AuthorizationEngine.js`, `37_AuthorizationMetadataRepository.js`, contratos `DT-SEC-*`) invalida esta revisión y exige una nueva.

---

## 5. Estrategia de rollback

- **Antes de escribir:** snapshot completo de la copia aislada (exportación `.xlsx` o copia de Google Sheet) y registro del `blueprintVersion`/`presentationVersion` planeados, conforme a la sección 8 de `AERP-040_INSTALLER_ONBOARDING_MVP_CONTRACT.md`.
- **Durante la instalación:** cada fase (`analyze`, `plan`, `apply`, `verify`) debe dejar un estado journal _antes_ y _después_ de escribir, tal como exige el contrato; una fase fallida deja la instalación en `INCOMPLETE`, nunca en `COMPLETE`.
- **Reintento:** debe ser idempotente — repetir `apply` sobre un estado `INCOMPLETE` no debe duplicar empresas, usuarios, roles ni módulos. Esto todavía no está implementado (pertenece a AERP-041C) y es una precondición, no un hecho actual.
- **Después de un fallo:** restaurar desde el snapshot si el estado no puede reconciliarse mediante reintento; ninguna recuperación debe ampliar permisos ni cruzar datos entre empresas (ya exigido explícitamente por el contrato AERP-040, sección 4.5).
- **Rollback de la opción 3 (plantilla limpia):** al no tocar las hojas `CORE_*` originales hasta que se confirme el traslado, el rollback más simple es no activar la nueva instalación y conservar la copia legacy intacta — es la opción con menor superficie de rollback necesaria, otro argumento a su favor.

---

## 6. Pruebas de seguridad exigidas antes de cualquier GO

- Reproducir `npm test` (264/264 declarado) en un entorno con Node `24.18.0` exacto, no Node `22.x`, para no depender solo de la evidencia reportada.
- Caso explícito: administrador de Empresa A no puede leer ni modificar Empresa B tras una instalación construida a partir de datos migrados (no solo con datos sintéticos, como cubre hoy la suite de AERP-036).
- Caso explícito: usuario sin rol asignado tras la migración queda denegado por defecto (Default DENY) — verificar contra un usuario real proveniente de `CORE_USUARIO_ROL` legacy sin mapeo, no solo contra un usuario inexistente.
- Caso explícito: un `ALLOW` presente en `CORE_PERMISOS` legacy que no pase la validación estricta de condiciones (DT-SEC-04) debe resultar en regla inválida y `DENY`, nunca en un intento de "interpretar" la intención original.
- Caso explícito: reintento de instalación tras fallo simulado a mitad de fase no duplica registros ni dispara acceso indebido durante el estado `INCOMPLETE`.
- Caso explícito: intento de creación de administrador sin verificador de identidad configurado responde con el estado fail-closed correspondiente y no crea ningún usuario con rol elevado.
- Confirmar mediante inspección de journal que ningún log de la instalación contiene tokens, cookies, secretos o correos en claro (exigido por DT-SEC-01 invariante 8 y por la sección 4.3 del contrato de onboarding).

---

## 7. Acciones que deben permanecer bloqueadas

- Cualquier escritura en la copia aislada (`1rW009D6ZLpUmfjDTUcwhGowyddXcWBAp7_cWklieMY4`) hasta que se cumplan todas las precondiciones de la sección 4.
- Ejecución de `runGenerarERP` en esta o cualquier copia hasta cerrar RB-01 (instalador inexistente, según el propio estado de entrega del repositorio).
- Publicación de Apps Script o concesión de acceso a clientes (coherente con RB-06, RB-10 y RB-11 del documento de estado de entrega — ninguno de ellos está cerrado).
- Creación de un administrador a partir de `Session.getActiveUser()` o de cualquier email no verificado por un `trustedPrincipalVerifier`.
- Generación automática de reglas `ALLOW` para cubrir huecos de datos ausentes durante la migración.
- Modificación de los contratos `DT-SEC-01`, `DT-SEC-03`, `DT-SEC-04`, `DT-SEC-05` o del blueprint AERP-040 aprobado como parte de este trabajo de migración.
- Formateo masivo de los 18 archivos heredados señalados como pendientes de Prettier (RB-07) mezclado con cualquier cambio funcional de esta migración — debe hacerse en un cambio aparte, como ya advierte el propio contrato de instalador.

---

## 8. Recomendación final

El código de seguridad y autorización auditado (`36_AuthorizationEngine.js`, `37_AuthorizationMetadataRepository.js`, contratos `DT-SEC-01/03/04/05`) está bien construido para este propósito: fail-closed, default-deny inmutable, deny-precedence global y verificación de identidad separada de la autorización, todo con manejo de excepciones que degrada a `DENY` en vez de fallar abierto. El preflight del instalador (`11_Installer.js`) es hoy estrictamente de solo lectura y ya anticipa correctamente el conflicto de nombres con las 7 tablas legacy.

Sin embargo, **no existe todavía ningún mecanismo que pueda ejecutar una escritura real** (RB-01, confirmado independientemente en `ALEF_ERP_1_0_DELIVERY_STATUS.md`), y la colisión de nombres entre la copia legacy y el blueprint AERP-040 en las 7 tablas `CORE_*` es total, no parcial. Por tanto, ninguna de las tres opciones puede ejecutarse hoy sin trabajo adicional, y la opción recomendada (plantilla limpia + traslado selectivo) depende de una matriz de compatibilidad (AERP-041B) que esta revisión no ha podido completar por estar fuera de su alcance.

## BLOCKERS

- No existe motor de aplicación (`apply`) para el instalador; toda escritura está bloqueada hasta que AERP-041C se integre y pase sus pruebas de seguridad.
- Colisión de nombre físico total en las 7 tablas `CORE_*` legacy vs. blueprint AERP-040; la opción "migrar in situ" no es viable sin una capa de transformación previa.
- No hay verificador de identidad (`trustedPrincipalVerifier`) conectado; cualquier creación de administrador hoy dependería de una identidad no confiable.

## IMPORTANT

- La matriz de compatibilidad AERP-041B debe completarse y confirmarse antes de fijar la decisión final entre plantilla limpia y traslado parcial de datos.
- Las cifras de pruebas del estado de entrega (264/264, Bundle Gate 18/18) no se pudieron reproducir en este entorno de revisión por diferencia de versión de Node; deben re-verificarse en un entorno con Node 24.18.0 antes del GO definitivo.
- El aislamiento multiempresa depende de que cada regla generada incluya la condición `context.companyId`; cualquier regla migrada sin este campo es un riesgo de fuga entre empresas aunque el sistema siga siendo técnicamente "default deny".

## OPTIONAL

- Distinguir en el preflight entre fila vacía formateada y fila con datos reales, en lugar de usar solo `getLastRow()`/`getLastColumn()`, para reducir falsos `CONFLICT`/`KEEP`.
- Documentar explícitamente el estado `ADMIN_IDENTITY_REQUIRED` en el contrato DT-SEC-01 o en un contrato hijo, ya que hoy se menciona como requisito de AERP-041C pero no aparece formalizado en el contrato existente.

## RESULT

CHANGES REQUIRED
