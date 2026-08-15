# DT-SEC-03 — Immutable Default Deny

**Estado:** Aprobado / congelado

La decisión inicial y de fallback es siempre `DENY`. Solo un `ALLOW` explícito, válido y aplicable puede permitir, siempre que no exista un `DENY` aplicable.

## Invariantes

- Cero reglas, cero coincidencias, error, timeout, dependencia ausente o schema inválido → `DENY`.
- El cliente no configura el efecto por defecto.
- Ningún modo debug, trace o compatibilidad cambia el default.
