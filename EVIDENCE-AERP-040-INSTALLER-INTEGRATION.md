# AERP-040 — Installer Integration Evidence

## Alcance evaluado

Rama: `feature/AERP-040-installer-integration`

Base aprobada: `329cde574b1f010dc2fc646a7183cd91bb58d927`

El incremento integra el blueprint comercial y su manifiesto de presentación con el
preflight existente de `11_Installer.js`. No modifica el modelo de 17 tablas, no crea
hojas, empresas, usuarios ni permisos y no integra todavía el activo AppSheet.

## Diseño implementado

- Contrato puro `aerpBuildCommercialInstallerPlan()` versión `1.0.0`.
- Construcción única del blueprint comercial aprobado.
- Construcción del manifiesto desde la misma instancia validada del blueprint.
- Revalidación explícita de ambos artefactos antes de exponer el plan.
- Resultado determinista, inmutable y sin dependencias de servicios Apps Script.
- Resumen sanitizado incorporado a `aerpInstallCheck()`; el preflight no registra los
  artefactos completos.
- Cero escrituras nuevas: el instalador continúa siendo un preflight hasta el
  incremento de RB-01.

## Contrato de seguridad

El plan solo se acepta cuando el manifiesto conserva simultáneamente:

- autorización externa obligatoria mediante AERP-036;
- repositorio de metadata AERP-037;
- visibilidad predeterminada `HIDDEN`;
- `visibilityGrantsAuthorization: false`;
- precedencia `DENY` activa.

La ausencia de una dependencia, un blueprint inválido, un manifiesto inválido, una
referencia huérfana o una excepción inesperada devuelve un resultado cerrado y sin
artefactos parciales.

## Cobertura añadida

- Construcción determinista e inmutable del plan.
- Confirmación de una sola construcción del blueprint y reutilización de su identidad.
- Dependencias ausentes.
- Blueprint inválido con interrupción antes de presentación.
- Excepción de presentación con respuesta sanitizada.
- Rechazo de visibilidad que intente sustituir autorización.
- Consumo real del plan por el preflight y exposición exclusiva de su resumen seguro.

## Gates ejecutados

| Gate                                | Resultado                                                  |
| ----------------------------------- | ---------------------------------------------------------- |
| Ciclo TDD inicial                   | PASS — 7 fallos esperados antes de implementar             |
| Suite canónica                      | PASS — 263/263                                             |
| Suite AERP-038A                     | PASS — 61/61                                               |
| ESLint                              | PASS                                                       |
| Globals Gate                        | PASS — 809 símbolos, 0 duplicados, 0 violaciones dinámicas |
| Bundle Gate                         | PASS — 18/18, 39 scripts, 40 archivos                      |
| Prettier sobre archivos modificados | PASS                                                       |
| `git diff --check`                  | PASS                                                       |

El control global de Prettier conserva un bloqueo heredado de 18 archivos no
modificados por este incremento. No se realizó un reformateo masivo.

## Cierre de RB-02

RB-02 queda cerrado porque el preflight del instalador consume de forma reproducible
el blueprint y su manifiesto de presentación validados. RB-01 permanece abierto: aún
falta materializar de manera idempotente una instalación limpia, crear empresa,
administrador y configuración inicial, y registrar journal y rollback.

## Resultado de revisión

**APPROVED** para AERP-040 Integración con Installer. El cambio satisface el criterio
de cierre de RB-02 sin ampliar permisos, alterar tenant isolation ni simular la
finalización del instalador completo.
