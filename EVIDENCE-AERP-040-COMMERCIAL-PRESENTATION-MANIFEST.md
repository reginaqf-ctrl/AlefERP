# AERP-040 — Commercial Presentation Manifest Evidence

## Alcance evaluado

Rama: `feature/AERP-040-commercial-blueprint`

Base aprobada: `ad847dd46a8877d8d0abb927b51e77733014ad26`

El incremento cierra la capa declarativa de presentación del blueprint comercial
Alef ERP 1.0. No modifica las 17 tablas aprobadas, no concede permisos, no escribe
hojas y no conecta todavía el blueprint con el instalador.

## Diseño implementado

- Manifiesto puro y determinista, versión `1.0.0`.
- 17 vistas: una por cada tabla aprobada y asociada a su módulo exacto.
- 8 menús: uno por cada área funcional comercial.
- 20 elementos de menú: 17 destinos de vista y 3 destinos de dashboard.
- 3 dashboards mínimos: ventas, pedidos e inventario.
- 3 reglas declarativas de visibilidad: `ADMINISTRADOR`, `LECTOR` y `OPERADOR`.
- Contratos explícitos para `CORE_VISTAS`, `CORE_MENU`, `CORE_MENU_ITEM` y
  `CORE_DASHBOARDS`.

## Separación de responsabilidades

- **Autorización:** decisión externa obligatoria mediante AERP-036 y metadata de
  AERP-037.
- **Visibilidad:** recomendación declarativa de experiencia; el valor por defecto es
  `HIDDEN`.
- **Navegación:** solo enlaza menús con vistas o dashboards existentes.
- La visibilidad nunca concede autorización y la precedencia `DENY` permanece activa.
- Todos los elementos navegables solicitan la acción `VIEW`; no incorporan grants ni
  bypasses.

## Integridad y fallo cerrado

El validador rechaza de forma cerrada y sanitizada:

- tablas, módulos, campos, vistas o dashboards inexistentes;
- vistas, menús, elementos, dashboards o reglas de rol duplicados;
- vistas o dashboards sin destino de navegación;
- elementos de menú sin menú o destino válido;
- widgets con tabla o campo desconocido;
- contratos de separación o tablas de metadata alterados;
- blueprint inválido, entrada hostil o excepción inesperada.

## Cobertura añadida

- Construcción determinista, neutral respecto del cliente y con copias independientes.
- Cobertura exacta de las 17 tablas y los 8 módulos aprobados.
- Ausencia de vistas, menús, elementos y dashboards huérfanos.
- Integridad de referencias de tablas, vistas y campos de widgets.
- Compatibilidad de alias de `CORE_MENU` y `CORE_MENU_ITEM` con AERP-036.
- Separación verificable entre autorización, visibilidad y navegación.
- Regresiones fail-closed sobre cada clase de referencia huérfana.
- Sanitización de entradas hostiles sin filtrar detalles internos.

## Gates ejecutados

| Gate                                | Resultado                                                  |
| ----------------------------------- | ---------------------------------------------------------- |
| Ciclo TDD inicial                   | PASS — fallo esperado por módulo aún inexistente           |
| Suite canónica                      | PASS — 256/256                                             |
| Suite AERP-038A                     | PASS — 54/54                                               |
| ESLint                              | PASS                                                       |
| Globals Gate                        | PASS — 801 símbolos, 0 duplicados, 0 violaciones dinámicas |
| Bundle Gate                         | PASS — 18/18, 39 scripts, 40 archivos                      |
| Prettier sobre archivos modificados | PASS                                                       |
| `git diff --check`                  | PASS                                                       |

El control global de Prettier conserva el bloqueo heredado de 19 archivos no
modificados por este incremento. No se realizó un reformateo masivo.

## Seguridad y multiempresa

- Default DENY y DENY precedence permanecen intactos.
- El manifiesto no modifica `CORE_PERMISOS`, `CORE_ROL_MODULO` ni sus valores iniciales.
- No existe inferencia de autorización a partir de visibilidad o navegación.
- Las vistas se derivan únicamente del blueprint validado, por lo que preservan su
  asociación exacta de tabla y módulo y no agregan estructuras de datos paralelas.
- No se incorporan datos, correos ni identificadores específicos de clientes.

## Límite pendiente

RB-02 queda reducido exclusivamente a que el instalador consuma de forma reproducible
el blueprint y este manifiesto. Esa integración está fuera del alcance autorizado para
este incremento.

## Resultado de revisión

**APPROVED WITH FOLLOW-UP** para AERP-040 Incremento 2. El manifiesto de presentación
queda completo y validado; permanece pendiente únicamente su integración posterior con
el instalador.
