# AERP-040 — Preflight de copia aislada

## Alcance

`aerpPreviewCommercialInstallation(request)` es una comprobación de solo lectura
anterior a cualquier instalación comercial. Exige dos IDs distintos (origen y
copia), verifica que el script está vinculado a la copia esperada, reutiliza el
plan comercial validado y el chequeo de instalación base, y revisa las cabeceras
físicas de las 17 tablas. También detecta colisiones de identidad en
`CORE_TABLAS` y `CORE_COLUMNAS`.

El resultado `READY_FOR_STRUCTURE` **no** significa instalación completa ni
concede acceso. No se crean hojas, empresas, usuarios, permisos ni aplicaciones
AppSheet. Ante incompatibilidad, dependencia ausente o error devuelve un estado
denegado/incompatible y no escribe datos.

## Prueba

La prueba cubre copia distinta, target vinculado, cabeceras existentes,
conservación de filas, conflicto de esquema, colisión en el registro, baseline
incompleto, solicitud inválida y ausencia de escrituras. El inventario canónico
sube de 263 a 264 pruebas.

## Próxima fase de instalación aislada

Requiere identificar la copia real y su script vinculado, completar el escritor
idempotente con journal y metadata, ejecutar el Generator MVP una vez por intento
confirmado, vincular la plantilla AppSheet versionada y validar el primer
administrador mediante una identidad confiable. Hasta entonces RB-01 y RB-03
permanecen abiertos y Alef ERP 1.0 sigue en NO-GO.
