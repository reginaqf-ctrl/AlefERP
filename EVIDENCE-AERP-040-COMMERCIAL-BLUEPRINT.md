# AERP-040 — Commercial Blueprint Baseline Evidence

## Alcance evaluado

Rama: `feature/AERP-040-commercial-blueprint`

El incremento introduce el baseline de datos del blueprint comercial Alef ERP 1.0.
No instala hojas, no escribe metadata, no crea usuarios, no concede permisos y no
publica Apps Script ni AppSheet.

## Contrato resultante

- `FrameworkSchema` puro y determinista, versión `1.0.0`.
- 17 tablas de producto y 8 áreas funcionales persistidas.
- 16 tablas dependientes con `ID_Empresa` obligatorio, no nulo, oculto y no editable.
- Catálogos explícitos de empresas, usuarios, roles, módulos y permisos.
- Permisos inicializados en `DENY` y todas las capacidades en `FALSE`.
- Relaciones declaradas como `Ref` y validadas por Metadata Builder Enterprise.
- Sin nombres, correos, identificadores ni reglas específicas de clientes.

## Cobertura añadida

- Construcción determinista y copias independientes.
- Compatibilidad con el contrato estricto `MetadataModel`.
- Cobertura exacta de tablas comerciales persistidas.
- Tenant isolation estructural para toda tabla dependiente.
- Encabezados requeridos por Authorization Metadata Repository.
- Referencias controladas de roles y permisos hacia `CORE_MODULOS`.
- Fallo cerrado ante ausencia del tenant, referencia inexistente o entrada hostil.

## Gates ejecutados

| Gate                                | Resultado                                                  |
| ----------------------------------- | ---------------------------------------------------------- |
| Suite canónica                      | PASS — 248/248                                             |
| ESLint                              | PASS                                                       |
| Globals Gate                        | PASS — 773 símbolos, 0 duplicados, 0 violaciones dinámicas |
| Bundle Gate                         | PASS — 18/18, 38 scripts, 39 archivos                      |
| Prettier sobre archivos modificados | PASS                                                       |
| `git diff --check`                  | PASS                                                       |

El control global de Prettier conserva el bloqueo heredado de 19 archivos no
modificados por este incremento. No se realizó un reformateo masivo.

## Seguridad

- Default DENY preservado.
- No se incorporan filas de autorización ni grants implícitos.
- `ID_Empresa` es una referencia obligatoria a `CORE_EMPRESAS`.
- `ID_Modulo` en asignaciones y permisos es una referencia controlada a
  `CORE_MODULOS`.
- El validador devuelve un error sanitizado y cerrado ante excepciones inesperadas.

## Límites pendientes

- El instalador todavía no consume el blueprint.
- Faltan manifiestos versionados de vistas, menús y dashboards.
- Falta crear y validar el activo AppSheet copiable.
- No existe autorización para producción ni para escrituras en hojas de clientes.

## Resultado de revisión

**APPROVED WITH FOLLOW-UP** para integrar este baseline en la siguiente fase de
AERP-040. No cierra por sí solo RB-01, RB-02 ni RB-03.
