# DT-SEC-05 — Global Deny Precedence

**Estado:** Aprobado / congelado

Si cualquier regla `DENY` válida y aplicable coincide, la decisión final es `DENY`, independientemente de `ALLOW` coincidentes o de su prioridad.

## Invariantes

- La prioridad ordena o resuelve reglas compatibles; nunca neutraliza un Deny aplicable.
- La evaluación considera todas las reglas necesarias antes de permitir.
- El Decision Builder conserva la razón y regla Deny determinante sin filtrar datos sensibles.
