// @ts-nocheck
/**
 * Alef ERP 1.0 - AERP-040 Commercial Blueprint.
 *
 * Declares the customer-neutral FrameworkSchema consumed by the existing
 * Metadata Builder Enterprise. This module is pure: it does not read or write
 * spreadsheets, create users, grant permissions or call external services.
 */

const AERP_COMMERCIAL_BLUEPRINT_VERSION = '1.0.0';
const AERP_COMMERCIAL_BLUEPRINT_RELEASED_AT_ = '2026-09-17T00:00:00.000Z';
const AERP_COMMERCIAL_TENANT_TABLE_ = 'CORE_EMPRESAS';
const AERP_COMMERCIAL_TENANT_COLUMN_ = 'ID_Empresa';

const AERP_COMMERCIAL_REQUIRED_MODULES_ = Object.freeze([
  'ADMINISTRACION',
  'CLIENTES',
  'CONFIGURACION',
  'INVENTARIO',
  'PEDIDOS',
  'PRODUCTOS',
  'PROVEEDORES',
  'VENTAS'
]);

const AERP_COMMERCIAL_TABLE_SPECS_ = aerpCommercialDeepFreeze_([
  {
    physicalName: 'CORE_EMPRESAS',
    code: 'EMPRESAS',
    name: 'Empresas',
    entity: 'Empresa',
    module: 'ADMINISTRACION',
    category: 'Seguridad',
    type: 'SECURITY',
    key: ['ID_Empresa', 'ID empresa'],
    columns: [
      ['Codigo', 'Código', 'Text', { required: true, indexed: true }],
      ['Nombre', 'Empresa', 'Text', { label: true, required: true, searchable: true }],
      ['Moneda', 'Moneda', 'Enum', { required: true }],
      ['Zona_Horaria', 'Zona horaria', 'Text', { required: true }]
    ]
  },
  {
    physicalName: 'CORE_USUARIOS',
    code: 'USUARIOS',
    name: 'Usuarios',
    entity: 'Usuario',
    module: 'ADMINISTRACION',
    category: 'Seguridad',
    type: 'SECURITY',
    key: ['ID_Usuario', 'ID usuario'],
    columns: [
      ['Email', 'Correo', 'Email', { label: true, required: true, indexed: true }],
      ['Nombre', 'Nombre', 'Text', { required: true, searchable: true }]
    ]
  },
  {
    physicalName: 'CORE_ROLES',
    code: 'ROLES',
    name: 'Roles',
    entity: 'Rol',
    module: 'ADMINISTRACION',
    category: 'Seguridad',
    type: 'SECURITY',
    key: ['ID_Rol', 'ID rol'],
    columns: [
      ['Codigo', 'Código', 'Text', { required: true, indexed: true }],
      ['Nombre', 'Rol', 'Text', { label: true, required: true, searchable: true }]
    ]
  },
  {
    physicalName: 'CORE_MODULOS',
    code: 'MODULOS',
    name: 'Módulos',
    entity: 'Modulo',
    module: 'ADMINISTRACION',
    category: 'Seguridad',
    type: 'SECURITY',
    key: ['ID_Modulo', 'ID módulo'],
    columns: [
      ['Codigo', 'Código', 'Text', { required: true, indexed: true }],
      ['Nombre', 'Módulo', 'Text', { label: true, required: true, searchable: true }],
      ['Orden', 'Orden', 'Number', { required: true }]
    ]
  },
  {
    physicalName: 'CORE_USUARIO_ROL',
    code: 'USUARIO_ROL',
    name: 'Asignaciones de rol',
    entity: 'UsuarioRol',
    module: 'ADMINISTRACION',
    category: 'Seguridad',
    type: 'SECURITY',
    key: ['ID_Usuario_Rol', 'ID asignación'],
    columns: [
      [
        'ID_Usuario',
        'Usuario',
        'Ref',
        { required: true, referenceTable: 'CORE_USUARIOS', indexed: true }
      ],
      ['ID_Rol', 'Rol', 'Ref', { required: true, referenceTable: 'CORE_ROLES', indexed: true }]
    ]
  },
  {
    physicalName: 'CORE_ROL_MODULO',
    code: 'ROL_MODULO',
    name: 'Módulos por rol',
    entity: 'RolModulo',
    module: 'ADMINISTRACION',
    category: 'Seguridad',
    type: 'SECURITY',
    key: ['ID_Rol_Modulo', 'ID asignación'],
    columns: [
      ['ID_Rol', 'Rol', 'Ref', { required: true, referenceTable: 'CORE_ROLES', indexed: true }],
      [
        'ID_Modulo',
        'Módulo',
        'Ref',
        { required: true, referenceTable: 'CORE_MODULOS', indexed: true }
      ],
      ['Visible_Menu', 'Visible en menú', 'YesNo', { required: true, initialValue: 'FALSE' }]
    ]
  },
  {
    physicalName: 'CORE_PERMISOS',
    code: 'PERMISOS',
    name: 'Permisos',
    entity: 'Permiso',
    module: 'ADMINISTRACION',
    category: 'Seguridad',
    type: 'SECURITY',
    key: ['ID_Permiso', 'ID permiso'],
    columns: [
      ['ID_Rol', 'Rol', 'Ref', { required: true, referenceTable: 'CORE_ROLES', indexed: true }],
      [
        'ID_Modulo',
        'Módulo',
        'Ref',
        { required: true, referenceTable: 'CORE_MODULOS', indexed: true }
      ],
      ['Nivel_Acceso', 'Nivel de acceso', 'Enum', { required: true, initialValue: 'DENY' }],
      ['Puede_Ver', 'Puede ver', 'YesNo', { required: true, initialValue: 'FALSE' }],
      ['Puede_Crear', 'Puede crear', 'YesNo', { required: true, initialValue: 'FALSE' }],
      ['Puede_Editar', 'Puede editar', 'YesNo', { required: true, initialValue: 'FALSE' }],
      ['Puede_Eliminar', 'Puede eliminar', 'YesNo', { required: true, initialValue: 'FALSE' }],
      ['Puede_Aprobar', 'Puede aprobar', 'YesNo', { required: true, initialValue: 'FALSE' }],
      ['Puede_Exportar', 'Puede exportar', 'YesNo', { required: true, initialValue: 'FALSE' }],
      ['Puede_Importar', 'Puede importar', 'YesNo', { required: true, initialValue: 'FALSE' }],
      ['Puede_Imprimir', 'Puede imprimir', 'YesNo', { required: true, initialValue: 'FALSE' }],
      ['Puede_Administrar', 'Puede administrar', 'YesNo', { required: true, initialValue: 'FALSE' }]
    ]
  },
  {
    physicalName: 'CORE_CONFIGURACION',
    code: 'CONFIGURACION',
    name: 'Configuración',
    entity: 'Configuracion',
    module: 'CONFIGURACION',
    category: 'Sistema',
    type: 'CONFIGURATION',
    key: ['ID_Configuracion', 'ID configuración'],
    columns: [
      ['Clave', 'Clave', 'Text', { label: true, required: true, indexed: true }],
      ['Valor', 'Valor', 'LongText', { required: true }]
    ]
  },
  {
    physicalName: 'ERP_CLIENTES',
    code: 'CLIENTES',
    name: 'Clientes',
    entity: 'Cliente',
    module: 'CLIENTES',
    category: 'Comercial',
    type: 'MASTER_DATA',
    key: ['ID_Cliente', 'ID cliente'],
    columns: [
      ['Codigo', 'Código', 'Text', { required: true, indexed: true }],
      ['Nombre', 'Cliente', 'Text', { label: true, required: true, searchable: true }],
      ['Email', 'Correo', 'Email', {}],
      ['Telefono', 'Teléfono', 'Phone', {}],
      ['Limite_Credito', 'Límite de crédito', 'Price', { initialValue: '0' }],
      ['Dias_Credito', 'Días de crédito', 'Number', { initialValue: '0' }]
    ]
  },
  {
    physicalName: 'ERP_PROVEEDORES',
    code: 'PROVEEDORES',
    name: 'Proveedores',
    entity: 'Proveedor',
    module: 'PROVEEDORES',
    category: 'Compras',
    type: 'MASTER_DATA',
    key: ['ID_Proveedor', 'ID proveedor'],
    columns: [
      ['Codigo', 'Código', 'Text', { required: true, indexed: true }],
      ['Nombre', 'Proveedor', 'Text', { label: true, required: true, searchable: true }],
      ['Email', 'Correo', 'Email', {}],
      ['Telefono', 'Teléfono', 'Phone', {}]
    ]
  },
  {
    physicalName: 'ERP_PRODUCTOS',
    code: 'PRODUCTOS',
    name: 'Productos',
    entity: 'Producto',
    module: 'PRODUCTOS',
    category: 'Catálogo',
    type: 'MASTER_DATA',
    key: ['ID_Producto', 'ID producto'],
    columns: [
      ['SKU', 'SKU', 'Text', { required: true, indexed: true }],
      ['Nombre', 'Producto', 'Text', { label: true, required: true, searchable: true }],
      ['Categoria', 'Categoría', 'Text', { filterable: true }],
      ['Costo', 'Costo', 'Price', { required: true, initialValue: '0' }],
      ['Precio_Venta', 'Precio de venta', 'Price', { required: true, initialValue: '0' }],
      ['Stock_Minimo', 'Stock mínimo', 'Decimal', { required: true, initialValue: '0' }]
    ]
  },
  {
    physicalName: 'ERP_INVENTARIO',
    code: 'INVENTARIO',
    name: 'Inventario',
    entity: 'Inventario',
    module: 'INVENTARIO',
    category: 'Operaciones',
    type: 'OPERATIONAL',
    key: ['ID_Inventario', 'ID inventario'],
    columns: [
      [
        'ID_Producto',
        'Producto',
        'Ref',
        {
          label: true,
          required: true,
          referenceTable: 'ERP_PRODUCTOS',
          indexed: true
        }
      ],
      ['Stock_Actual', 'Stock actual', 'Decimal', { required: true, initialValue: '0' }],
      ['Stock_Reservado', 'Stock reservado', 'Decimal', { required: true, initialValue: '0' }],
      ['Fecha_Actualizacion', 'Actualizado', 'DateTime', { editable: false }]
    ]
  },
  {
    physicalName: 'ERP_MOVIMIENTOS_INVENTARIO',
    code: 'MOVIMIENTOS_INVENTARIO',
    name: 'Movimientos de inventario',
    entity: 'MovimientoInventario',
    module: 'INVENTARIO',
    category: 'Operaciones',
    type: 'TRANSACTION',
    key: ['ID_Movimiento', 'ID movimiento'],
    columns: [
      [
        'ID_Producto',
        'Producto',
        'Ref',
        { required: true, referenceTable: 'ERP_PRODUCTOS', indexed: true }
      ],
      ['Tipo_Movimiento', 'Tipo', 'Enum', { label: true, required: true }],
      ['Cantidad', 'Cantidad', 'Decimal', { required: true }],
      ['Fecha_Movimiento', 'Fecha', 'DateTime', { required: true }],
      ['Referencia', 'Referencia', 'Text', {}],
      ['Estado', 'Estado', 'Enum', { required: true, initialValue: 'REGISTRADO' }],
      ['ID_Usuario', 'Usuario', 'Ref', { referenceTable: 'CORE_USUARIOS', indexed: true }]
    ]
  },
  {
    physicalName: 'ERP_PEDIDOS',
    code: 'PEDIDOS',
    name: 'Pedidos',
    entity: 'Pedido',
    module: 'PEDIDOS',
    category: 'Comercial',
    type: 'TRANSACTION',
    key: ['ID_Pedido', 'ID pedido'],
    columns: [
      ['Nro_Pedido', 'Número de pedido', 'Text', { label: true, required: true, indexed: true }],
      ['ID_Cliente', 'Cliente', 'Ref', { required: true, referenceTable: 'ERP_CLIENTES' }],
      ['Fecha_Pedido', 'Fecha', 'Date', { required: true }],
      ['Estado', 'Estado', 'Enum', { required: true, initialValue: 'BORRADOR' }],
      ['Tipo_Venta', 'Tipo de venta', 'Enum', { required: true }],
      ['Moneda', 'Moneda', 'Enum', { required: true }],
      ['Subtotal', 'Subtotal', 'Price', { required: true, initialValue: '0' }],
      ['Total', 'Total', 'Price', { required: true, initialValue: '0' }]
    ]
  },
  {
    physicalName: 'ERP_PEDIDO_DETALLE',
    code: 'PEDIDO_DETALLE',
    name: 'Detalle de pedidos',
    entity: 'PedidoDetalle',
    module: 'PEDIDOS',
    category: 'Comercial',
    type: 'TRANSACTION',
    key: ['ID_Pedido_Detalle', 'ID línea'],
    columns: [
      ['ID_Pedido', 'Pedido', 'Ref', { required: true, referenceTable: 'ERP_PEDIDOS' }],
      ['ID_Producto', 'Producto', 'Ref', { required: true, referenceTable: 'ERP_PRODUCTOS' }],
      ['Cantidad', 'Cantidad', 'Decimal', { required: true }],
      ['Precio_Unitario', 'Precio unitario', 'Price', { required: true }],
      ['Total_Linea', 'Total línea', 'Price', { required: true, editable: false }]
    ]
  },
  {
    physicalName: 'ERP_VENTAS',
    code: 'VENTAS',
    name: 'Ventas',
    entity: 'Venta',
    module: 'VENTAS',
    category: 'Comercial',
    type: 'TRANSACTION',
    key: ['ID_Venta', 'ID venta'],
    columns: [
      ['Nro_Venta', 'Número de venta', 'Text', { label: true, required: true, indexed: true }],
      ['ID_Pedido', 'Pedido', 'Ref', { referenceTable: 'ERP_PEDIDOS' }],
      ['ID_Cliente', 'Cliente', 'Ref', { required: true, referenceTable: 'ERP_CLIENTES' }],
      ['Fecha_Venta', 'Fecha', 'Date', { required: true }],
      ['Estado', 'Estado', 'Enum', { required: true, initialValue: 'REGISTRADA' }],
      ['Moneda', 'Moneda', 'Enum', { required: true }],
      ['Total', 'Total', 'Price', { required: true, initialValue: '0' }]
    ]
  },
  {
    physicalName: 'ERP_VENTA_DETALLE',
    code: 'VENTA_DETALLE',
    name: 'Detalle de ventas',
    entity: 'VentaDetalle',
    module: 'VENTAS',
    category: 'Comercial',
    type: 'TRANSACTION',
    key: ['ID_Venta_Detalle', 'ID línea'],
    columns: [
      ['ID_Venta', 'Venta', 'Ref', { required: true, referenceTable: 'ERP_VENTAS' }],
      ['ID_Producto', 'Producto', 'Ref', { required: true, referenceTable: 'ERP_PRODUCTOS' }],
      ['Cantidad', 'Cantidad', 'Decimal', { required: true }],
      ['Precio_Unitario', 'Precio unitario', 'Price', { required: true }],
      ['Total_Linea', 'Total línea', 'Price', { required: true, editable: false }]
    ]
  }
]);

function aerpCommercialDeepFreeze_(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.keys(value).forEach(function (key) {
      aerpCommercialDeepFreeze_(value[key]);
    });
  }
  return value;
}

function aerpCommercialControlType_(dataType) {
  const controls = {
    Date: 'DatePicker',
    DateTime: 'DateTimePicker',
    Decimal: 'Number',
    Email: 'Email',
    Enum: 'Dropdown',
    LongText: 'Textarea',
    Number: 'Number',
    Phone: 'Phone',
    Price: 'Number',
    Ref: 'Dropdown',
    Text: 'Text',
    YesNo: 'Checkbox'
  };
  return controls[dataType] || 'Text';
}

function aerpCommercialColumnId_(tableName, columnName) {
  return ('AERP1_COL_' + tableName + '_' + columnName).toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function aerpCommercialBuildColumn_(tableName, descriptor, order) {
  const name = descriptor[0];
  const displayName = descriptor[1];
  const dataType = descriptor[2];
  const options = descriptor[3] || {};
  const isKey = options.key === true;
  const isRef = typeof options.referenceTable === 'string' && options.referenceTable !== '';
  const required = isKey || options.required === true;

  return {
    ID_Columna: aerpCommercialColumnId_(tableName, name),
    Tabla: tableName,
    Nombre_Campo: name,
    Nombre_Mostrar: displayName,
    Tipo_Dato: dataType,
    Tipo_Control: options.control || aerpCommercialControlType_(dataType),
    Es_Key: isKey,
    Es_Label: options.label === true,
    Es_Requerido: required,
    Permite_Nulos: !required,
    Valor_Inicial: options.initialValue || '',
    Formula_App: '',
    Tabla_Referencia: isRef ? options.referenceTable : '',
    Longitud: options.length || '',
    Orden: order,
    Activo: true,
    Estado: 'ENABLED',
    Fecha_Creacion: '',
    Fecha_Actualizacion: '',
    Visible: options.visible !== false && !isKey,
    Editable: options.editable !== false && !isKey,
    Es_Ref: isRef,
    Es_Virtual: false,
    Es_Buscable: options.searchable === true || options.label === true,
    Es_Filtrable: options.filterable === true || isRef,
    Es_Ordenable: options.sortable !== false,
    Es_Indexado: options.indexed === true || isKey || isRef,
    Grupo_Formulario: options.formGroup || '',
    Ayuda: options.help || '',
    Placeholder: options.placeholder || ''
  };
}

function aerpCommercialBuildTable_(spec) {
  const tableName = spec.physicalName;
  const descriptors = [
    [spec.key[0], spec.key[1], 'Text', { key: true, required: true, indexed: true }]
  ];

  if (tableName !== AERP_COMMERCIAL_TENANT_TABLE_) {
    descriptors.push([
      AERP_COMMERCIAL_TENANT_COLUMN_,
      'Empresa',
      'Ref',
      {
        required: true,
        referenceTable: AERP_COMMERCIAL_TENANT_TABLE_,
        visible: false,
        editable: false,
        indexed: true
      }
    ]);
  }

  spec.columns.forEach(function (column) {
    descriptors.push(column);
  });
  descriptors.push([
    'Activo',
    'Activo',
    'YesNo',
    { required: true, initialValue: 'TRUE', filterable: true }
  ]);

  return {
    id: 'AERP1_TABLE_' + tableName,
    code: spec.code,
    name: spec.name,
    entity: spec.entity,
    module: spec.module,
    category: spec.category,
    type: spec.type,
    physicalName: tableName,
    prefix: tableName.indexOf('CORE_') === 0 ? 'CORE' : 'ERP',
    active: true,
    columns: descriptors.map(function (descriptor, index) {
      return aerpCommercialBuildColumn_(tableName, descriptor, index + 1);
    })
  };
}

function aerpBuildCommercialBlueprint() {
  const tables = AERP_COMMERCIAL_TABLE_SPECS_.map(aerpCommercialBuildTable_);
  const columns = tables.reduce(function (total, table) {
    return total + table.columns.length;
  }, 0);
  const relations = tables.reduce(function (total, table) {
    return (
      total +
      table.columns.filter(function (column) {
        return column.Es_Ref;
      }).length
    );
  }, 0);

  return {
    version: AERP_COMMERCIAL_BLUEPRINT_VERSION,
    generatedAt: AERP_COMMERCIAL_BLUEPRINT_RELEASED_AT_,
    tables: tables,
    summary: {
      tables: tables.length,
      columns: columns,
      relations: relations,
      views: tables.length,
      warnings: [],
      errors: [],
      durationMs: 0
    }
  };
}

function aerpCommercialEmptyValidationSummary_(version) {
  return {
    version: typeof version === 'string' ? version : null,
    tables: 0,
    columns: 0,
    tenantScopedTables: 0,
    modules: 0
  };
}

function aerpCommercialIsPlainObject_(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

function aerpValidateCommercialBlueprint_(blueprint) {
  const summary = aerpCommercialEmptyValidationSummary_(blueprint && blueprint.version);
  const errors = [];

  if (!aerpCommercialIsPlainObject_(blueprint) || !Array.isArray(blueprint.tables)) {
    return { ok: false, errors: ['AERP_BP_INVALID_BLUEPRINT'], summary: summary };
  }

  if (blueprint.version !== AERP_COMMERCIAL_BLUEPRINT_VERSION) {
    errors.push('AERP_BP_VERSION_MISMATCH');
  }

  const expectedTables = AERP_COMMERCIAL_TABLE_SPECS_.map(function (spec) {
    return spec.physicalName;
  }).sort();
  const physicalNames = [];
  const tableIndex = {};

  blueprint.tables.forEach(function (table) {
    if (!aerpCommercialIsPlainObject_(table) || !Array.isArray(table.columns)) {
      errors.push('AERP_BP_INVALID_TABLE');
      return;
    }
    physicalNames.push(table.physicalName);
    if (!tableIndex[table.physicalName]) tableIndex[table.physicalName] = table;
  });

  const actualTables = physicalNames.slice().sort();
  if (JSON.stringify(actualTables) !== JSON.stringify(expectedTables)) {
    errors.push('AERP_BP_TABLE_SET_MISMATCH');
  }
  if (new Set(physicalNames).size !== physicalNames.length) {
    errors.push('AERP_BP_DUPLICATE_TABLE');
  }

  const modules = new Set();
  let columns = 0;
  let tenantScopedTables = 0;

  blueprint.tables.forEach(function (table) {
    if (!aerpCommercialIsPlainObject_(table) || !Array.isArray(table.columns)) return;
    modules.add(table.module);
    columns += table.columns.length;

    if (table.physicalName !== AERP_COMMERCIAL_TENANT_TABLE_) {
      const tenantColumns = table.columns.filter(function (column) {
        return column && column.Nombre_Campo === AERP_COMMERCIAL_TENANT_COLUMN_;
      });
      if (tenantColumns.length !== 1) {
        errors.push('AERP_BP_MISSING_TENANT_COLUMN:' + table.physicalName);
      } else {
        const tenantColumn = tenantColumns[0];
        tenantScopedTables += 1;
        if (
          tenantColumn.Tipo_Dato !== 'Ref' ||
          tenantColumn.Tabla_Referencia !== AERP_COMMERCIAL_TENANT_TABLE_ ||
          tenantColumn.Es_Ref !== true ||
          tenantColumn.Es_Requerido !== true ||
          tenantColumn.Permite_Nulos !== false ||
          tenantColumn.Visible !== false ||
          tenantColumn.Editable !== false
        ) {
          errors.push('AERP_BP_INVALID_TENANT_COLUMN:' + table.physicalName);
        }
      }
    }

    table.columns.forEach(function (column) {
      if (
        column &&
        column.Es_Ref === true &&
        !Object.prototype.hasOwnProperty.call(tableIndex, column.Tabla_Referencia)
      ) {
        errors.push(
          'AERP_BP_UNRESOLVABLE_REFERENCE:' +
            table.physicalName +
            '.' +
            String(column.Nombre_Campo || '')
        );
      }
    });
  });

  AERP_COMMERCIAL_REQUIRED_MODULES_.forEach(function (moduleCode) {
    if (!modules.has(moduleCode)) errors.push('AERP_BP_MISSING_MODULE:' + moduleCode);
  });

  summary.tables = blueprint.tables.length;
  summary.columns = columns;
  summary.tenantScopedTables = tenantScopedTables;
  summary.modules = modules.size;
  errors.sort();

  return {
    ok: errors.length === 0,
    errors: errors,
    summary: summary
  };
}

function aerpValidateCommercialBlueprint(blueprint) {
  try {
    return aerpValidateCommercialBlueprint_(blueprint);
  } catch (_error) {
    return {
      ok: false,
      errors: ['AERP_BP_INVALID_BLUEPRINT'],
      summary: aerpCommercialEmptyValidationSummary_(null)
    };
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.aerpBuildCommercialBlueprint = aerpBuildCommercialBlueprint;
  globalThis.aerpValidateCommercialBlueprint = aerpValidateCommercialBlueprint;
}
