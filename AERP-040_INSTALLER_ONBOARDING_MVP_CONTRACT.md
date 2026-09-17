# AERP-040 — Installer, Onboarding and Commercial Blueprint MVP

## 1. Estado

**Propuesto para aprobación técnica.** No autoriza escrituras en hojas, publicación
Apps Script, acceso de clientes ni producción.

## 2. Objetivo

Permitir que un usuario no técnico convierta una copia limpia y vinculada de Alef ERP
en una instalación operativa mediante este flujo:

```text
Abrir plantilla vinculada
→ Iniciar instalación
→ Registrar empresa
→ Crear administrador
→ Configurar moneda y parámetros básicos
→ Generar módulos comerciales
→ Validar permisos y estructura
→ Comenzar a trabajar
```

## 3. Principios obligatorios

- Metadata Driven: los módulos se definen mediante un blueprint versionado, no con
  lógica específica de un cliente.
- FAIL CLOSED y Default DENY: ningún usuario obtiene permisos por omisión.
- Aislamiento multiempresa: toda entidad operativa debe quedar asociada a una empresa
  y toda lectura/escritura debe aplicar el contexto autorizado.
- Mínimo privilegio OAuth: mantener `script.container.ui` y
  `spreadsheets.currentonly`; cualquier ampliación requiere revisión separada.
- Idempotencia: reintentar la instalación no debe duplicar empresas, usuarios,
  metadata ni módulos.
- Compatibilidad: no reescribir Framework Core, Metadata Engine, Layout Engine,
  Dashboard Framework, UI Framework ni Authorization Engine salvo defecto probado.

## 4. Alcance funcional

### 4.1 Preflight

- Confirmar ejecución en una hoja vinculada.
- Detectar instalación limpia, parcial, completa o incompatible.
- Validar versión del blueprint y del framework.
- Mostrar antes de escribir qué se creará o actualizará.

### 4.2 Blueprint comercial versionado

Debe declarar, como datos reutilizables:

- empresas, usuarios, roles y permisos;
- clientes y proveedores;
- productos;
- inventario, movimientos y kardex básico;
- pedidos y sus líneas;
- ventas;
- configuración y parámetros;
- vistas, formularios, menús, dashboards y relaciones.

El blueprint no incluirá nombres, IDs, correos ni reglas específicas de un cliente.

### 4.3 Onboarding

- Capturar nombre de empresa, identificador normalizado, moneda y zona horaria.
- Crear el primer administrador con identidad verificable del usuario activo cuando la
  plataforma lo permita.
- Aplicar un rol administrador explícito y auditable.
- Crear configuración inicial sin exponer secretos en celdas o logs.

### 4.4 Instalación

- Crear únicamente las hojas y cabeceras ausentes del producto.
- Cargar el blueprint aprobado de manera determinista.
- Ejecutar el pipeline Generator MVP una vez por intento confirmado.
- Registrar journal, versión, estado, duración y resumen sanitizado.
- Finalizar solo si estructura, permisos, metadata y paquete de aplicación son válidos.

### 4.5 Recuperación

- Una instalación fallida queda marcada como incompleta y no utilizable.
- El reintento continúa o reconstruye desde el último estado seguro sin duplicados.
- La actualización conserva datos del cliente y aplica migraciones versionadas.
- Ninguna recuperación debe ampliar permisos ni cruzar empresas.

## 5. Decisión arquitectónica pendiente

El generador actual produce un paquete descriptivo de AppSheet, pero no aprovisiona
una aplicación AppSheet real. Antes de implementar ese paso se debe elegir y aprobar
uno de estos mecanismos:

1. plantilla AppSheet versionada y copiable asociada a la instalación;
2. aprovisionamiento mediante una capacidad oficial compatible con las cuentas objetivo;
3. entrega asistida temporal, documentada como limitación de beta y no como flujo final.

La opción elegida debe respetar el mínimo privilegio y permitir una instalación
reproducible. No se simulará el aprovisionamiento con un paquete descriptivo.

## 6. Criterios de aceptación

- Una hoja limpia compatible completa el onboarding sin editar metadata manualmente.
- La instalación crea todos los módulos MVP y sus relaciones.
- Un segundo intento no duplica registros ni recursos.
- Un usuario sin rol queda denegado por defecto.
- Un administrador de Empresa A no puede leer ni modificar Empresa B.
- Entradas vacías, IDs duplicados, moneda inválida y estado parcial fallan de forma
  controlada y explicativa.
- El flujo produce evidencia sanitizada y no registra secretos o datos personales.
- Las pruebas existentes permanecen y toda nueva ruta incluye pruebas positivas,
  negativas, de límite, seguridad y regresión.
- Lint, formato, Globals Gate, Bundle Gate y suite completa pasan sobre el artefacto
  exacto.

## 7. Riesgos

- Crear un instalador antes de congelar el blueprint provocaría metadata divergente.
- Vincular el administrador a una identidad no verificable rompería Default DENY.
- Automatizar AppSheet mediante una interfaz no oficial crearía deuda y riesgo de
  soporte.
- Formatear masivamente archivos heredados junto con cambios funcionales reduciría la
  revisabilidad; debe hacerse en un cambio separado.

## 8. Rollback

- No se modifica una instalación existente sin preflight y confirmación explícita.
- Cada fase registra un estado antes y después de escribir.
- Una instalación fallida no se activa para uso normal.
- Las migraciones posteriores deberán declarar versión anterior, versión objetivo,
  pasos reversibles y respaldo requerido.
