/**
 * ALEF ERP Framework
 * 16_AppSheetGenerator.gs
 *
 * AERP-016 / AERP-038B - In-memory AppSheet consumer.
 */

const AERP_ASG_ERROR_MESSAGE_ = 'No fue posible construir el paquete AppSheet.';
const AERP_ASG_GENERATOR_ERROR_MESSAGE_ = 'El resultado Generator no es válido para AppSheet.';
const AERP_ASG_PACKAGE_ERROR_MESSAGE_ = 'El paquete AppSheet construido no es válido.';
const AERP_ASG_TYPES_ = Object.freeze([
  'Text',
  'LongText',
  'Number',
  'Decimal',
  'Price',
  'Percent',
  'Date',
  'DateTime',
  'Time',
  'YesNo',
  'Email',
  'Phone',
  'URL',
  'Image',
  'File',
  'Enum',
  'EnumList',
  'Ref',
  'LatLong',
  'Color'
]);
const AERP_ASG_TYPE_MAP_ = Object.freeze({
  Text: 'Text',
  LongText: 'LongText',
  Number: 'Number',
  Decimal: 'Decimal',
  Price: 'Price',
  Percent: 'Percent',
  Date: 'Date',
  DateTime: 'DateTime',
  Time: 'Time',
  YesNo: 'Yes/No',
  Email: 'Email',
  Phone: 'Phone',
  URL: 'URL',
  Image: 'Image',
  File: 'File',
  Enum: 'Enum',
  EnumList: 'EnumList',
  Ref: 'Ref',
  LatLong: 'LatLong',
  Color: 'Color'
});

function aerpBuildAppSheetPackageFromGenerator(generatorResult) {
  try {
    if (!aerpAsgValidateGeneratorResult_(generatorResult)) {
      return aerpAsgFailure_('ASG_GENERATOR_RESULT_INVALID', AERP_ASG_GENERATOR_ERROR_MESSAGE_);
    }

    const pkg = {
      app: aerpBuildAppSheetApp_(generatorResult.application),
      tables: generatorResult.tables.map(aerpBuildAppSheetTable_),
      columns: aerpBuildAppSheetColumns_(generatorResult.tables),
      forms: generatorResult.forms.map(aerpBuildAppSheetForm_),
      views: generatorResult.views.map(aerpBuildAppSheetView_),
      menus: generatorResult.menus.map(aerpBuildAppSheetMenu_)
    };
    const builtResult = {
      ok: true,
      lineage: { ...generatorResult.lineage },
      package: pkg,
      summary: {
        tables: pkg.tables.length,
        columns: pkg.columns.length,
        forms: pkg.forms.length,
        views: pkg.views.length,
        menus: pkg.menus.length,
        durationMs: 0
      },
      warnings: [],
      errors: [],
      diagnostics: []
    };
    if (
      !aerpAsgValidateBuiltPackage_(pkg, generatorResult) ||
      !aerpAsgValidateBuiltResult_(builtResult) ||
      !aerpMetadataLineageEquals_(builtResult.lineage, generatorResult.lineage)
    ) {
      return aerpAsgFailure_('ASG_PACKAGE_INVALID', AERP_ASG_PACKAGE_ERROR_MESSAGE_);
    }
    return builtResult;
  } catch (_error) {
    return aerpAsgFailure_('ASG_INTERNAL_ERROR', AERP_ASG_ERROR_MESSAGE_);
  }
}

function aerpBuildAppSheetPackage() {
  try {
    const start = new Date();
    const metadataModel = aerpBuildMetadataModel();
    const generatorResult = aerpBuildGeneratorEngineMVPFromMetadataModel(metadataModel);
    if (!generatorResult.ok) {
      const failed = aerpAsgFailure_(
        'ASG_GENERATOR_RESULT_INVALID',
        AERP_ASG_GENERATOR_ERROR_MESSAGE_
      );
      failed.summary.durationMs = new Date() - start;
      aerpAsgLogSummaryBestEffort_(failed);
      return failed;
    }
    const result = aerpBuildAppSheetPackageFromGenerator(generatorResult);
    const wrapped = aerpAsgCopyResult_(result);
    if (wrapped.ok) wrapped.package.app.generatedAt = new Date();
    wrapped.summary.durationMs = new Date() - start;
    aerpAsgLogSummaryBestEffort_(wrapped);
    return wrapped;
  } catch (_error) {
    return aerpAsgFailure_('ASG_INTERNAL_ERROR', AERP_ASG_ERROR_MESSAGE_);
  }
}

function aerpAsgValidateGeneratorResult_(result) {
  if (
    !aerpAsgHasDataFields_(result, [
      'ok',
      'lineage',
      'application',
      'tables',
      'forms',
      'views',
      'menus',
      'summary',
      'diagnostics'
    ]) ||
    result.ok !== true ||
    !aerpIsValidMetadataLineage_(result.lineage) ||
    !aerpAsgValidateApplication_(result.application) ||
    !aerpAsgSafeArray_(result.tables) ||
    !aerpAsgSafeArray_(result.forms) ||
    !aerpAsgSafeArray_(result.views) ||
    !aerpAsgSafeArray_(result.menus) ||
    !aerpAsgSafeArray_(result.diagnostics) ||
    result.diagnostics.length !== 0
  ) {
    return false;
  }
  if (
    !aerpAsgHasDataFields_(result.summary, [
      'tables',
      'forms',
      'views',
      'menus',
      'errors',
      'warnings',
      'durationMs'
    ]) ||
    !aerpAsgSafeArray_(result.summary.errors) ||
    result.summary.errors.length !== 0 ||
    !aerpAsgSafeArray_(result.summary.warnings) ||
    result.summary.warnings.length !== 0 ||
    !result.summary.warnings.every(function (warning) {
      return typeof warning === 'string';
    }) ||
    !Number.isFinite(result.summary.durationMs) ||
    result.summary.durationMs < 0 ||
    !Number.isInteger(result.summary.tables) ||
    !Number.isInteger(result.summary.forms) ||
    !Number.isInteger(result.summary.views) ||
    !Number.isInteger(result.summary.menus) ||
    result.summary.tables !== result.tables.length ||
    result.summary.forms !== result.forms.length ||
    result.summary.views !== result.views.length ||
    result.summary.menus !== result.menus.length
  ) {
    return false;
  }

  const tablesByName = new Map();
  for (let index = 0; index < result.tables.length; index += 1) {
    const table = result.tables[index];
    if (!aerpAsgValidateGeneratorTable_(table) || tablesByName.has(table.physicalName))
      return false;
    tablesByName.set(table.physicalName, table);
  }
  if (tablesByName.size === 0) return false;
  if (!aerpAsgValidateFormsOrViews_(result.forms, tablesByName, 'Form')) return false;
  if (!aerpAsgValidateFormsOrViews_(result.views, tablesByName, null)) return false;
  if (!aerpAsgValidateMenus_(result.menus, tablesByName, result.views)) return false;

  return result.tables.every(function (table) {
    return table.columns.every(function (column) {
      return !column.isRef || tablesByName.has(column.refTable);
    });
  });
}

function aerpAsgValidateApplication_(app) {
  return (
    aerpAsgHasDataFields_(app, [
      'name',
      'edition',
      'version',
      'generatedAt',
      'platform',
      'status'
    ]) &&
    aerpAsgRequiredString_(app.name) &&
    aerpAsgRequiredString_(app.edition) &&
    aerpAsgRequiredString_(app.version) &&
    (app.generatedAt === null ||
      typeof app.generatedAt === 'string' ||
      (app.generatedAt instanceof Date && Number.isFinite(app.generatedAt.getTime()))) &&
    app.platform === 'AppSheet' &&
    aerpAsgRequiredString_(app.status)
  );
}

function aerpAsgValidateGeneratorTable_(table) {
  if (
    !aerpAsgHasDataFields_(table, [
      'code',
      'name',
      'entity',
      'physicalName',
      'module',
      'category',
      'primaryKey',
      'labelColumn',
      'columns'
    ]) ||
    !aerpAsgRequiredString_(table.code) ||
    !aerpAsgRequiredString_(table.physicalName) ||
    !aerpAsgRequiredString_(table.primaryKey) ||
    !['name', 'entity', 'module', 'category'].every(function (field) {
      return typeof table[field] === 'string';
    }) ||
    typeof table.labelColumn !== 'string' ||
    !aerpAsgSafeArray_(table.columns) ||
    table.columns.length === 0
  ) {
    return false;
  }
  const names = new Set();
  let keys = 0;
  let labels = 0;
  for (let index = 0; index < table.columns.length; index += 1) {
    const column = table.columns[index];
    if (!aerpAsgValidateGeneratorColumn_(column) || names.has(column.name)) return false;
    names.add(column.name);
    keys += column.isKey ? 1 : 0;
    labels += column.isLabel ? 1 : 0;
  }
  return (
    keys === 1 &&
    labels <= 1 &&
    names.has(table.primaryKey) &&
    table.columns.find(function (column) {
      return column.name === table.primaryKey;
    }).isKey &&
    ['Text', 'Number'].includes(
      table.columns.find(function (column) {
        return column.name === table.primaryKey;
      }).type
    ) &&
    table.columns.find(function (column) {
      return column.name === table.primaryKey;
    }).required &&
    !table.columns.find(function (column) {
      return column.name === table.primaryKey;
    }).isRef &&
    (table.labelColumn === '' ||
      (names.has(table.labelColumn) &&
        table.columns.find(function (column) {
          return column.name === table.labelColumn;
        }).isLabel &&
        table.columns.find(function (column) {
          return column.name === table.labelColumn;
        }).type !== 'EnumList'))
  );
}

function aerpAsgValidateGeneratorColumn_(column) {
  if (
    !aerpAsgHasDataFields_(column, [
      'name',
      'displayName',
      'type',
      'control',
      'required',
      'visible',
      'editable',
      'isKey',
      'isLabel',
      'isRef',
      'refTable'
    ]) ||
    !aerpAsgRequiredString_(column.name) ||
    !AERP_ASG_TYPES_.includes(column.type) ||
    typeof column.displayName !== 'string' ||
    typeof column.control !== 'string' ||
    typeof column.refTable !== 'string' ||
    (column.isRef === true && !aerpAsgRequiredString_(column.refTable)) ||
    (column.isRef === false && column.refTable !== '')
  ) {
    return false;
  }
  return ['required', 'visible', 'editable', 'isKey', 'isLabel', 'isRef'].every(function (field) {
    return typeof column[field] === 'boolean';
  });
}

function aerpAsgValidateFormsOrViews_(items, tablesByName, forcedType) {
  if (items.length !== tablesByName.size) return false;
  const ids = new Set();
  const tableNames = new Set();
  return items.every(function (item) {
    if (
      !aerpAsgHasDataFields_(item, [
        'id',
        'name',
        'table',
        'type',
        'columns',
        'primaryKey',
        'labelColumn'
      ]) ||
      !aerpAsgRequiredString_(item.id) ||
      !aerpAsgRequiredString_(item.name) ||
      !aerpAsgRequiredString_(item.table) ||
      !aerpAsgRequiredString_(item.type) ||
      !aerpAsgSafeArray_(item.columns) ||
      ids.has(item.id) ||
      tableNames.has(item.table)
    ) {
      return false;
    }
    const table = tablesByName.get(item.table);
    if (!table || (forcedType && item.type !== forcedType)) return false;
    const expectedColumns = table.columns
      .filter(function (column) {
        return forcedType === 'Form' ? column.editable : column.visible;
      })
      .map(function (column) {
        return column.name;
      });
    if (
      item.primaryKey !== table.primaryKey ||
      item.labelColumn !== table.labelColumn ||
      !aerpAsgSameStringSequence_(item.columns, expectedColumns)
    ) {
      return false;
    }
    ids.add(item.id);
    tableNames.add(item.table);
    return true;
  });
}

function aerpAsgValidateMenus_(menus, tablesByName, views) {
  if (menus.length !== tablesByName.size) return false;
  const viewsById = new Map(
    views.map(function (view) {
      return [view.id, view];
    })
  );
  const ids = new Set();
  const tableNames = new Set();
  return menus.every(function (menu) {
    if (
      !aerpAsgHasDataFields_(menu, ['id', 'name', 'module', 'table', 'view', 'order', 'visible']) ||
      !aerpAsgRequiredString_(menu.id) ||
      !aerpAsgRequiredString_(menu.name) ||
      !aerpAsgRequiredString_(menu.table) ||
      !aerpAsgRequiredString_(menu.view) ||
      !Number.isInteger(menu.order) ||
      menu.order < 1 ||
      typeof menu.visible !== 'boolean' ||
      ids.has(menu.id) ||
      tableNames.has(menu.table) ||
      !tablesByName.has(menu.table) ||
      !viewsById.has(menu.view) ||
      viewsById.get(menu.view).table !== menu.table
    ) {
      return false;
    }
    ids.add(menu.id);
    tableNames.add(menu.table);
    return true;
  });
}

function aerpAsgHasDataFields_(value, fields) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== fields.length ||
    keys.some(function (key) {
      return typeof key !== 'string';
    })
  ) {
    return false;
  }
  const expected = new Set(fields);
  return keys.every(function (key) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return (
      expected.has(key) && descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
    );
  });
}

function aerpAsgSafeArray_(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || keys[keys.length - 1] !== 'length') return false;
  for (let index = 0; index < value.length; index += 1) {
    if (keys[index] !== String(index)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return false;
  }
  return true;
}

function aerpAsgRequiredString_(value) {
  return typeof value === 'string' && value !== '' && value === value.trim();
}

function aerpAsgSameStringSequence_(actual, expected) {
  if (!aerpAsgSafeArray_(actual) || actual.length !== expected.length) return false;
  for (let index = 0; index < actual.length; index += 1) {
    if (typeof actual[index] !== 'string' || actual[index] !== expected[index]) return false;
  }
  return true;
}

function aerpBuildAppSheetApp_(app) {
  return {
    name: app.name,
    edition: app.edition,
    version: app.version,
    platform: 'AppSheet',
    locale: 'es-ES',
    generatedAt: null,
    status: 'PackageReady'
  };
}

function aerpBuildAppSheetTable_(table) {
  return {
    id: 'TABLE_' + table.physicalName,
    name: table.name || table.physicalName,
    sourceName: table.physicalName,
    entity: table.entity,
    module: table.module,
    category: table.category,
    keyColumn: table.primaryKey,
    labelColumn: table.labelColumn,
    columns: table.columns.map(function (column) {
      return column.name;
    }),
    sync: true,
    readOnly: false,
    enabled: true
  };
}

function aerpBuildAppSheetColumns_(tables) {
  const columns = [];
  tables.forEach(function (table) {
    table.columns.forEach(function (column) {
      const mappedType = aerpMapToAppSheetType_(column);
      if (mappedType === null) throw new Error('Unsupported type');
      columns.push({
        id: 'COL_' + table.physicalName + '_' + column.name,
        table: table.physicalName,
        name: column.name,
        displayName: column.displayName,
        type: mappedType,
        control: column.control,
        required: column.required,
        visible: column.visible,
        editable: column.editable,
        isKey: column.isKey,
        isLabel: column.isLabel,
        isRef: column.isRef,
        refTable: column.refTable,
        initialValue: aerpGetAppSheetInitialValue_(column),
        appFormula: '',
        validIf: ''
      });
    });
  });
  return columns;
}

function aerpBuildAppSheetForm_(form) {
  return {
    id: form.id,
    name: form.name,
    table: form.table,
    type: 'Form',
    position: 'ref',
    columns: [...form.columns],
    primaryKey: form.primaryKey,
    labelColumn: form.labelColumn,
    enabled: true
  };
}

function aerpBuildAppSheetView_(view) {
  return {
    id: view.id,
    name: view.name,
    table: view.table,
    type: view.type,
    position: 'menu',
    columns: [...view.columns],
    primaryKey: view.primaryKey,
    labelColumn: view.labelColumn,
    enabled: true
  };
}

function aerpBuildAppSheetMenu_(menu) {
  return {
    id: menu.id,
    name: menu.name,
    module: menu.module,
    table: menu.table,
    view: menu.view,
    order: menu.order,
    visible: menu.visible
  };
}

function aerpMapToAppSheetType_(column) {
  return Object.prototype.hasOwnProperty.call(AERP_ASG_TYPE_MAP_, column.type)
    ? AERP_ASG_TYPE_MAP_[column.type]
    : null;
}

function aerpGetAppSheetInitialValue_(column) {
  const name = column.name;
  if (name === 'Activo') return 'TRUE';
  if (name === 'Fecha_Creacion') return 'NOW()';
  if (name === 'Creado_Por' || name === 'Modificado_Por') return 'USEREMAIL()';
  return '';
}

function aerpAsgValidateBuiltPackage_(pkg, generatorResult) {
  if (
    !aerpAsgHasDataFields_(pkg, ['app', 'tables', 'columns', 'forms', 'views', 'menus']) ||
    !aerpAsgSafeArray_(pkg.tables) ||
    !aerpAsgSafeArray_(pkg.columns) ||
    !aerpAsgSafeArray_(pkg.forms) ||
    !aerpAsgSafeArray_(pkg.views) ||
    !aerpAsgSafeArray_(pkg.menus) ||
    pkg.tables.length === 0 ||
    pkg.columns.length === 0 ||
    pkg.tables.length !== generatorResult.tables.length ||
    pkg.forms.length !== generatorResult.forms.length ||
    pkg.views.length !== generatorResult.views.length ||
    pkg.menus.length !== generatorResult.menus.length ||
    pkg.columns.length !==
      generatorResult.tables.reduce(function (total, table) {
        return total + table.columns.length;
      }, 0) ||
    !aerpAsgValidateBuiltApp_(pkg.app, generatorResult.application)
  ) {
    return false;
  }

  const tablesByName = new Map();
  for (let index = 0; index < pkg.tables.length; index += 1) {
    const table = pkg.tables[index];
    const source = generatorResult.tables[index];
    if (!aerpAsgValidateBuiltTable_(table, source) || tablesByName.has(table.sourceName))
      return false;
    tablesByName.set(table.sourceName, table);
  }

  const columnIds = new Set();
  let columnIndex = 0;
  for (let tableIndex = 0; tableIndex < generatorResult.tables.length; tableIndex += 1) {
    const sourceTable = generatorResult.tables[tableIndex];
    for (let sourceIndex = 0; sourceIndex < sourceTable.columns.length; sourceIndex += 1) {
      const column = pkg.columns[columnIndex];
      if (
        !aerpAsgValidateBuiltColumn_(column, sourceTable, sourceTable.columns[sourceIndex]) ||
        columnIds.has(column.id)
      ) {
        return false;
      }
      columnIds.add(column.id);
      columnIndex += 1;
    }
  }
  for (let index = 0; index < pkg.forms.length; index += 1) {
    if (!aerpAsgValidateBuiltFormOrView_(pkg.forms[index], generatorResult.forms[index], true))
      return false;
    if (!aerpAsgValidateBuiltFormOrView_(pkg.views[index], generatorResult.views[index], false))
      return false;
  }
  const viewsById = new Map(
    pkg.views.map(function (view) {
      return [view.id, view];
    })
  );
  const menuIds = new Set();
  for (let index = 0; index < pkg.menus.length; index += 1) {
    const menu = pkg.menus[index];
    if (
      !aerpAsgValidateBuiltMenu_(menu, generatorResult.menus[index], tablesByName, viewsById) ||
      menuIds.has(menu.id)
    ) {
      return false;
    }
    menuIds.add(menu.id);
  }
  return true;
}

function aerpAsgValidateBuiltResult_(result) {
  return (
    aerpAsgHasDataFields_(result, [
      'ok',
      'lineage',
      'package',
      'summary',
      'warnings',
      'errors',
      'diagnostics'
    ]) &&
    result.ok === true &&
    aerpIsValidMetadataLineage_(result.lineage) &&
    aerpAsgHasDataFields_(result.summary, [
      'tables',
      'columns',
      'forms',
      'views',
      'menus',
      'durationMs'
    ]) &&
    result.summary.tables === result.package.tables.length &&
    result.summary.columns === result.package.columns.length &&
    result.summary.forms === result.package.forms.length &&
    result.summary.views === result.package.views.length &&
    result.summary.menus === result.package.menus.length &&
    result.summary.durationMs === 0 &&
    aerpAsgSafeArray_(result.warnings) &&
    result.warnings.length === 0 &&
    aerpAsgSafeArray_(result.errors) &&
    result.errors.length === 0 &&
    aerpAsgSafeArray_(result.diagnostics) &&
    result.diagnostics.length === 0
  );
}

function aerpAsgValidateBuiltApp_(app, source) {
  return (
    aerpAsgHasDataFields_(app, [
      'name',
      'edition',
      'version',
      'platform',
      'locale',
      'generatedAt',
      'status'
    ]) &&
    app.name === source.name &&
    app.edition === source.edition &&
    app.version === source.version &&
    app.platform === 'AppSheet' &&
    app.locale === 'es-ES' &&
    app.generatedAt === null &&
    app.status === 'PackageReady'
  );
}

function aerpAsgValidateBuiltTable_(table, source) {
  return (
    aerpAsgHasDataFields_(table, [
      'id',
      'name',
      'sourceName',
      'entity',
      'module',
      'category',
      'keyColumn',
      'labelColumn',
      'columns',
      'sync',
      'readOnly',
      'enabled'
    ]) &&
    table.id === 'TABLE_' + source.physicalName &&
    table.name === (source.name || source.physicalName) &&
    table.sourceName === source.physicalName &&
    table.entity === source.entity &&
    table.module === source.module &&
    table.category === source.category &&
    table.keyColumn === source.primaryKey &&
    table.labelColumn === source.labelColumn &&
    aerpAsgSameStringSequence_(
      table.columns,
      source.columns.map(function (column) {
        return column.name;
      })
    ) &&
    table.sync === true &&
    table.readOnly === false &&
    table.enabled === true
  );
}

function aerpAsgValidateBuiltColumn_(column, sourceTable, source) {
  return (
    aerpAsgHasDataFields_(column, [
      'id',
      'table',
      'name',
      'displayName',
      'type',
      'control',
      'required',
      'visible',
      'editable',
      'isKey',
      'isLabel',
      'isRef',
      'refTable',
      'initialValue',
      'appFormula',
      'validIf'
    ]) &&
    column.id === 'COL_' + sourceTable.physicalName + '_' + source.name &&
    column.table === sourceTable.physicalName &&
    column.name === source.name &&
    column.displayName === source.displayName &&
    column.type === aerpMapToAppSheetType_(source) &&
    column.control === source.control &&
    column.required === source.required &&
    column.visible === source.visible &&
    column.editable === source.editable &&
    column.isKey === source.isKey &&
    column.isLabel === source.isLabel &&
    column.isRef === source.isRef &&
    column.refTable === source.refTable &&
    column.initialValue === aerpGetAppSheetInitialValue_(source) &&
    column.appFormula === '' &&
    column.validIf === ''
  );
}

function aerpAsgValidateBuiltFormOrView_(item, source, isForm) {
  return (
    aerpAsgHasDataFields_(item, [
      'id',
      'name',
      'table',
      'type',
      'position',
      'columns',
      'primaryKey',
      'labelColumn',
      'enabled'
    ]) &&
    item.id === source.id &&
    item.name === source.name &&
    item.table === source.table &&
    item.type === (isForm ? 'Form' : source.type) &&
    item.position === (isForm ? 'ref' : 'menu') &&
    aerpAsgSameStringSequence_(item.columns, source.columns) &&
    item.primaryKey === source.primaryKey &&
    item.labelColumn === source.labelColumn &&
    item.enabled === true
  );
}

function aerpAsgValidateBuiltMenu_(menu, source, tablesByName, viewsById) {
  return (
    aerpAsgHasDataFields_(menu, ['id', 'name', 'module', 'table', 'view', 'order', 'visible']) &&
    menu.id === source.id &&
    menu.name === source.name &&
    menu.module === source.module &&
    menu.table === source.table &&
    menu.view === source.view &&
    menu.order === source.order &&
    menu.visible === source.visible &&
    tablesByName.has(menu.table) &&
    viewsById.has(menu.view) &&
    viewsById.get(menu.view).table === menu.table
  );
}

function aerpAsgFailure_(code, message) {
  return {
    ok: false,
    lineage: null,
    package: null,
    summary: { tables: 0, columns: 0, forms: 0, views: 0, menus: 0, durationMs: 0 },
    warnings: [],
    errors: [message],
    diagnostics: [{ code, severity: 'ERROR', stage: 'APPSHEET_PACKAGE', message }]
  };
}

function aerpAsgCopyResult_(result) {
  return {
    ok: result.ok,
    lineage: result.lineage ? { ...result.lineage } : null,
    package: result.package
      ? {
          app: { ...result.package.app },
          tables: result.package.tables.map(function (table) {
            return { ...table, columns: [...table.columns] };
          }),
          columns: result.package.columns.map(function (column) {
            return { ...column };
          }),
          forms: result.package.forms.map(function (form) {
            return { ...form, columns: [...form.columns] };
          }),
          views: result.package.views.map(function (view) {
            return { ...view, columns: [...view.columns] };
          }),
          menus: result.package.menus.map(function (menu) {
            return { ...menu };
          })
        }
      : null,
    summary: { ...result.summary },
    warnings: [...result.warnings],
    errors: [...result.errors],
    diagnostics: result.diagnostics.map(function (diagnostic) {
      return { ...diagnostic };
    })
  };
}

function aerpAsgLogSummaryBestEffort_(result) {
  try {
    if (typeof Logger !== 'undefined' && Logger && typeof Logger.log === 'function') {
      Logger.log(
        JSON.stringify({
          ok: result.ok,
          tables: result.summary.tables,
          columns: result.summary.columns,
          forms: result.summary.forms,
          views: result.summary.views,
          menus: result.summary.menus,
          errors: result.errors.length,
          warnings: result.warnings.length,
          diagnosticCodes: result.diagnostics.map(function (item) {
            return item.code;
          }),
          durationMs: result.summary.durationMs
        })
      );
    }
  } catch (_error) {
    // Logging is best effort and cannot replace the constructed result.
  }
}

function aerpValidateAppSheetPackage(pkg) {
  try {
    const errors = [];
    const warnings = [];
    if (pkg === null || typeof pkg !== 'object' || Array.isArray(pkg)) {
      return { ok: false, errors: ['Paquete AppSheet inválido.'], warnings: [] };
    }
    const appDescriptor = Object.getOwnPropertyDescriptor(pkg, 'app');
    const tablesDescriptor = Object.getOwnPropertyDescriptor(pkg, 'tables');
    const columnsDescriptor = Object.getOwnPropertyDescriptor(pkg, 'columns');
    if (!appDescriptor || !Object.prototype.hasOwnProperty.call(appDescriptor, 'value')) {
      errors.push('Falta objeto app.');
    }
    const tables =
      tablesDescriptor && Object.prototype.hasOwnProperty.call(tablesDescriptor, 'value')
        ? tablesDescriptor.value
        : null;
    const columns =
      columnsDescriptor && Object.prototype.hasOwnProperty.call(columnsDescriptor, 'value')
        ? columnsDescriptor.value
        : null;
    if (!aerpAsgSafeArray_(tables) || tables.length === 0) errors.push('No hay tablas.');
    if (!aerpAsgSafeArray_(columns) || columns.length === 0) errors.push('No hay columnas.');
    if (errors.length > 0) return { ok: false, errors, warnings };

    const tableNames = new Set();
    tables.forEach(function (table) {
      const sourceName = aerpAsgDataField_(table, 'sourceName');
      const keyColumn = aerpAsgDataField_(table, 'keyColumn');
      const labelColumn = aerpAsgDataField_(table, 'labelColumn');
      if (
        table === null ||
        typeof table !== 'object' ||
        !sourceName.ok ||
        !aerpAsgRequiredString_(sourceName.value)
      ) {
        errors.push('Tabla AppSheet inválida.');
        return;
      }
      tableNames.add(sourceName.value);
      if (!keyColumn.ok || !aerpAsgRequiredString_(keyColumn.value))
        warnings.push('Tabla sin keyColumn.');
      if (!labelColumn.ok || !aerpAsgRequiredString_(labelColumn.value))
        warnings.push('Tabla sin labelColumn.');
    });
    columns.forEach(function (column) {
      const table = aerpAsgDataField_(column, 'table');
      const isRef = aerpAsgDataField_(column, 'isRef');
      const refTable = aerpAsgDataField_(column, 'refTable');
      if (
        column === null ||
        typeof column !== 'object' ||
        !table.ok ||
        !tableNames.has(table.value)
      ) {
        errors.push('Columna asociada a tabla inexistente.');
        return;
      }
      if (
        isRef.ok &&
        isRef.value === true &&
        (!refTable.ok || !aerpAsgRequiredString_(refTable.value))
      ) {
        warnings.push('Referencia sin destino.');
      } else if (isRef.ok && isRef.value === true && !tableNames.has(refTable.value)) {
        errors.push('Referencia asociada a tabla inexistente.');
      }
    });
    return { ok: errors.length === 0, errors, warnings };
  } catch (_error) {
    return { ok: false, errors: ['Paquete AppSheet inválido.'], warnings: [] };
  }
}

function aerpAsgDataField_(value, field) {
  if (value === null || typeof value !== 'object') return { ok: false, value: undefined };
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    return { ok: false, value: undefined };
  }
  return { ok: true, value: descriptor.value };
}

function aerpAppSheetPackageToJSON() {
  return JSON.stringify(aerpBuildAppSheetPackage(), null, 2);
}

function testAppSheetGeneratorMVP() {
  const result = aerpBuildAppSheetPackage();
  aerpAsgLogSummaryBestEffort_(result);
  if (!result.ok) {
    throw new Error('AppSheet Generator no pudo construir un paquete válido.');
  }
  return result;
}
