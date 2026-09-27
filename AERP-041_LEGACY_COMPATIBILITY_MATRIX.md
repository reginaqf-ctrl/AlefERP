# AERP-041B — Matriz de compatibilidad legado

## Estado

Revisión integrada el 27 de septiembre de 2026 sobre una copia aislada. Este
documento es evidencia de análisis y no autoriza escrituras, migraciones ni
despliegues.

| Campo                   | Valor                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| Archivo analizado       | `AERP-041_ISOLATED_COPY_67_SHEETS.xlsx`                            |
| SHA-256                 | `8EABE245F1427D88CADE696105DDC906F05EFA2FBFDCE68E2BABA0EA29FF04AE` |
| Hojas del archivo       | 67                                                                 |
| Blueprint de referencia | AERP-040, versión 1.0.0                                            |
| Base del análisis       | `8ac0a75`                                                          |

No se conservan en esta evidencia valores personales, comerciales ni secretos.

## Resumen verificado

| Métrica                                     |           Resultado |
| ------------------------------------------- | ------------------: |
| Tablas declaradas por AERP-040              | 17 (8 CORE + 9 ERP) |
| Tablas del blueprint presentes              |                   7 |
| Tablas del blueprint ausentes               |                  10 |
| Tablas presentes con conflicto de esquema   |                   7 |
| Tablas presentes con conflicto de registro  |                   7 |
| Filas significativas en esas 7 hojas        |                  17 |
| Filas autorizadas para migración automática |                   0 |

Las 17 filas significativas son 14 filas de módulos y 3 filas de relaciones o
permisos. Son evidencia para respaldo y revisión, no un lote migrable. Las tres
filas de seguridad no pueden resolverse de forma confiable porque las hojas de
empresas, usuarios y roles no contienen registros significativos.

## Inventario del blueprint

### Tablas presentes e incompatibles

| Tabla              | Filas significativas | Conflicto principal                                             | Registro legacy |
| ------------------ | -------------------: | --------------------------------------------------------------- | --------------- |
| `CORE_EMPRESAS`    |                    0 | Faltan `Nombre` y `Moneda`; existen columnas legacy adicionales | `TAB0009`       |
| `CORE_USUARIOS`    |                    0 | Falta `ID_Empresa`; usa `Empresa`                               | `TAB0010`       |
| `CORE_ROLES`       |                    0 | Faltan `ID_Empresa`, `Codigo` y `Nombre`                        | `TAB0011`       |
| `CORE_MODULOS`     |                   14 | Faltan `ID_Empresa` y `Orden`; usa `Orden_Menu`                 | `TAB0012`       |
| `CORE_USUARIO_ROL` |                    1 | Faltan las cuatro claves AERP-040                               | `TAB0014`       |
| `CORE_ROL_MODULO`  |                    1 | Faltan las claves normalizadas de relación                      | `TAB0015`       |
| `CORE_PERMISOS`    |                    1 | Faltan `ID_Empresa`, `ID_Rol` e `ID_Modulo`                     | `TAB0013`       |

La incompatibilidad se determina contra la cabecera exacta, el orden y los IDs
del blueprint. No se considera compatible una hoja sólo porque comparta parte de
los nombres.

### Tablas ausentes

- `CORE_CONFIGURACION`
- `ERP_CLIENTES`
- `ERP_PROVEEDORES`
- `ERP_PRODUCTOS`
- `ERP_INVENTARIO`
- `ERP_MOVIMIENTOS_INVENTARIO`
- `ERP_PEDIDOS`
- `ERP_PEDIDO_DETALLE`
- `ERP_VENTAS`
- `ERP_VENTA_DETALLE`

Las hojas `CORE_TABLAS`, `CORE_COLUMNAS`, `CORE_VISTAS`, `CORE_MENU`,
`CORE_MENU_ITEM`, `CORE_DASHBOARDS`, `CORE_FAVORITOS` y `CORE_RELACIONES` son
metadata del framework. No sustituyen a las 17 tablas declaradas por el
blueprint y no deben copiarse como datos de negocio.

## Hallazgos de seguridad

- La única fila significativa de `CORE_PERMISOS` contiene permisos `ALLOW`.
  No se puede usar para inicializar autorización.
- Las filas de `CORE_USUARIO_ROL`, `CORE_ROL_MODULO` y `CORE_PERMISOS` quedan
  huérfanas frente a la ausencia de empresas, usuarios y roles significativos.
- La ausencia de datos nunca constituye autorización.
- La visibilidad de menú no concede acceso.
- La plantilla destino debe comenzar con Default DENY y sólo podrá crear un
  administrador después de verificar identidad y tenant mediante AERP-036 y
  AERP-037.

## Decisión de migración

**Plantilla limpia AERP-040 con migración selectiva posterior y explícita.**

Para la primera instalación comercial:

1. Crear las 17 tablas desde el blueprint aprobado, sin reutilizar cabeceras ni
   registros `TAB00xx` del legado.
2. Generar la metadata y la presentación desde AERP-040.
3. Mantener las 17 filas legacy en respaldo inmutable para revisión.
4. No migrar automáticamente módulos, relaciones ni permisos legacy.
5. Permitir una migración posterior sólo mediante un mapeo aprobado, tenant
   verificado, integridad referencial y pruebas específicas.

Esta decisión conserva el blueprint, evita hardcoding y reduce el camino crítico
para la demostración: la primera instalación no depende de transformar filas de
seguridad incompatibles.

## Recuperación y rollback

El rollback destructivo por `TRUNCATE` queda rechazado. No es compatible con el
contrato AERP-040 ni con el motor AERP-041C.

La recuperación aprobada es:

1. mantener los recursos ya creados;
2. marcar la instalación como `INCOMPLETE`;
3. bloquear el acceso normal;
4. conservar journal y respaldo sanitizados;
5. reanudar idempotentemente desde el último estado seguro;
6. no marcar `COMPLETE` hasta validar estructura, metadata, autorización y
   aplicación.

## Criterios para una migración futura

- mapeo campo a campo aprobado;
- claves de empresa, usuario y rol existentes y verificadas;
- permisos de destino en DENY salvo concesión explícita y auditable;
- ninguna fila huérfana;
- conteos antes/después reconciliados;
- respaldo íntegro y restauración ensayada;
- pruebas de tenant isolation, DENY precedence y reintento idempotente.

## Resultado

La copia analizada no es una base válida para instalar en sitio. Sí es válida
como fuente de evidencia para decidir una instalación limpia y aislada. El
trabajo de migración de datos queda fuera del camino crítico del primer producto
comercial hasta que exista un mapeo aprobado.
