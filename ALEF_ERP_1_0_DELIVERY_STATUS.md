# Alef ERP 1.0 — Delivery Status

**Fecha de corte:** 2026-09-18

**Rama evaluada:** `release/AlefERP-3.0.0-rc1`

**Base aprobada AERP-040:** `329cde574b1f010dc2fc646a7183cd91bb58d927`

**Rama de implementación AERP-040:** `feature/AERP-040-installer-integration`

**Documento rector:** `Product Completion Plan.md`

**Estado de lanzamiento:** **NO-GO — producto 1.0 incompleto**

Este documento mantiene el estado operativo exigido por la directiva maestra. No
reemplaza las evidencias históricas ni autoriza producción o acceso de clientes.

## CURRENT_STATUS

### Completado

- Framework Core, Metadata Engine, Layout Engine, Dashboard Framework y UI Framework.
- Security Foundation, Authorization Engine y Authorization Metadata Repository.
- Pipeline único de metadata, generator y paquete AppSheet descriptivo.
- Bundle comercial controlado: 39 scripts y `appsscript.json`.
- Piloto aislado no productivo con resultado operativo satisfactorio.
- Aislamiento de la hoja vinculada y OAuth de mínimo privilegio validados.
- Caso demo comercial web publicado de forma privada.
- Baseline AERP-040 del blueprint comercial implementado como `FrameworkSchema` puro,
  versionado y neutral respecto del cliente: 17 tablas, 8 áreas funcionales y 16
  tablas dependientes con tenant obligatorio.
- Manifiesto de presentación AERP-040 completo y validado: 17 vistas, 8 menús, 20
  elementos de navegación, 3 dashboards comerciales y 3 reglas de visibilidad por rol.
- Separación explícita entre autorización AERP-036/AERP-037, visibilidad y navegación;
  visibilidad oculta por defecto y sin capacidad de conceder acceso.
- Integración AERP-040 con el preflight del instalador: plan puro, determinista e
  inmutable que consume el blueprint y el manifiesto validados sin realizar escrituras.
- **RB-02 cerrado:** el instalador consume de forma reproducible las 17 tablas, 17
  vistas, 8 menús, 20 elementos de navegación y 3 dashboards aprobados.
- Controles ejecutados sobre la revisión evaluada:
  - pruebas canónicas: **263/263**, sin fallos ni omisiones;
  - Globals Gate: **809 símbolos**, cero duplicados y cero construcciones dinámicas bloqueadas;
  - Bundle Gate: **18/18**, 39 scripts y 40 archivos en el artefacto;
  - ESLint: sin errores.

### En curso

- Reconciliación del estado de entrega 1.0 contra evidencia posterior al documento QA
  inicial.
- Mecanismo AppSheet aprobado: plantilla versionada y copiable; activo pendiente de
  creación y validación.
- Conversión del framework validado en un producto instalable por un usuario no técnico.

### Bloqueado

- El archivo `11_Installer.js` valida una instalación existente, pero no crea una
  instalación, empresa, administrador ni configuración inicial.
- `16_AppSheetGenerator.js` construye y valida un paquete AppSheet descriptivo, pero no
  aprovisiona ni configura una aplicación AppSheet real.
- Los módulos comerciales MVP no disponen todavía de evidencia end-to-end completa de
  CRUD, permisos y operación sin asistencia técnica.
- El control de formato falla en 18 archivos heredados.
- `npm audit` registra seis vulnerabilidades altas en la cadena de herramientas de
  desarrollo. No forman parte del bundle Apps Script, pero requieren actualización o
  aceptación de riesgo documentada.
- Branding y verificación pública OAuth de Google pendientes.
- Documentación de usuario, administrador, instalación, backup/recuperación y release
  1.0 incompleta.
- Beta cerrada no ejecutada.

### Pendiente

- Instalador y onboarding de primera ejecución.
- Administración: empresas, usuarios, roles y permisos.
- CRUD completo de clientes, proveedores y productos.
- Inventario con movimientos y kardex básico.
- Pedidos con edición, aprobación y estados.
- Ventas y reportes básicos operativos.
- Configuración de empresa, moneda, parámetros y seguridad.
- Activo AppSheet versionado y procedimiento de copia/vinculación validado.
- QA de instalación limpia, actualización, regresión, multiempresa, permisos y estados
  vacíos/inválidos.
- Manuales, beta cerrada, decisión de producción y lanzamiento.

## RELEASE_BLOCKERS

| ID    | Bloqueo                                        | Criticidad             | Criterio de cierre                                                                                                      |
| ----- | ---------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| RB-01 | Instalador inexistente                         | Crítica                | Una instalación limpia crea empresa, administrador y configuración sin intervención técnica.                            |
| RB-03 | Plantilla AppSheet no versionada ni validada   | Crítica                | La plantilla aprobada dispone de versión, hash, matriz de roles/vistas, procedimiento de copia y validación end-to-end. |
| RB-04 | Módulos MVP sin aceptación end-to-end          | Crítica                | Cada módulo obligatorio supera CRUD, permisos, datos inválidos y flujo principal.                                       |
| RB-05 | Onboarding y administración incompletos        | Crítica                | Un usuario no técnico termina la primera configuración y puede administrar usuarios, roles y permisos.                  |
| RB-06 | Verificación pública OAuth pendiente           | Alta                   | Consentimiento y branding autorizados para incorporación pública de clientes.                                           |
| RB-07 | Quality Gate incompleto                        | Alta                   | Prettier pasa sobre el inventario aprobado y no introduce cambios funcionales.                                          |
| RB-08 | Dependencias de desarrollo con alertas altas   | Alta                   | Dependencias actualizadas o riesgo residual aprobado y documentado.                                                     |
| RB-09 | Documentación comercial y operativa incompleta | Alta                   | Todos los manuales y procedimientos exigidos están publicados y validados.                                              |
| RB-10 | Beta cerrada pendiente                         | Crítica                | Al menos una beta cerrada completa los flujos principales con aceptación satisfactoria.                                 |
| RB-11 | Producción y clientes no autorizados           | Control de lanzamiento | Existe una decisión formal posterior al cierre de RB-01 a RB-10.                                                        |

## NEXT_ACTIONS

1. Implementar el instalador y onboarding de primera ejecución sobre el plan AERP-040
   validado, con idempotencia, journal y rollback.
2. Crear la matriz de cobertura de los módulos MVP y cerrar primero Administración,
   Productos, Inventario, Pedidos y Ventas con pruebas de permisos y multiempresa.
3. Construir, versionar y validar la plantilla AppSheet aprobada; demostrar una
   instalación limpia de extremo a extremo en un entorno aislado.
4. Cerrar los gates de formato y dependencias; producir evidencia reproducible del
   candidato resultante.
5. Completar manuales, ejecutar beta cerrada y preparar la decisión de lanzamiento.

## DEFERRED_2_0

- Alef Builder y constructor visual de módulos.
- Marketplace y SDK.
- APIs públicas generales.
- Flutter y React como producto operativo.
- Multi-base de datos.
- Inteligencia artificial integrada como producto.
- Automatizaciones avanzadas.
- Constructores visuales de dashboards y vistas.

## Evidencia de esta revisión

- `npm test`: PASS — 263/263.
- `npm run qa:globals`: PASS — 809 símbolos, 0 duplicados, 0 violaciones dinámicas.
- `npm run test:bundle`: PASS — 18/18; 39 scripts y 40 archivos en el artefacto.
- `npm run lint`: PASS.
- `npm run format:check`: FAIL — 18 archivos heredados fuera del formato aprobado.
- `npm audit`: seis alertas altas, todas dentro de la cadena de herramientas de
  desarrollo; no incluidas en el bundle Apps Script.
- Inspección de código: el preflight del instalador ya consume y valida el blueprint y
  su manifiesto de presentación sin conceder permisos ni escribir hojas. Sigue pendiente
  la creación idempotente de la instalación y la vinculación del activo AppSheet aprobado.
