# DT-SEC-04 — Strict Condition Validation

**Estado:** Aprobado / congelado

Las condiciones se aceptan solo si cumplen un schema y una lista cerrada de operadores. No se evalúa JavaScript, fórmulas arbitrarias ni expresiones dinámicas.

## Invariantes

- Campo, operador, tipo o valor desconocido/incompatible → regla inválida y decisión segura `DENY`.
- Comparaciones son deterministas y no coercionan tipos silenciosamente.
- Toda nueva operación exige diseño, pruebas y versión del contrato.
- Errores internos pueden trazarse de forma sanitizada; no se exponen detalles sensibles.
