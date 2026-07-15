/**
 * ALEF ERP Framework
 * 16_AppSheetGenerator.gs
 *
 * AERP-016 - AppSheet Generator MVP
 * Convierte Generator Engine MVP en un AppSheet Package.
 */

function aerpBuildAppSheetPackage() {
  const start = new Date();
  const generatorApp = aerpBuildGeneratorEngineMVP();

  const result = {
    ok: true,
    package: {
      app: aerpBuildAppSheetApp_(generatorApp.application),
      tables: generatorApp.tables.map(aerpBuildAppSheetTable_),
      columns: aerpBuildAppSheetColumns_(generatorApp.tables),
      forms: generatorApp.forms.map(aerpBuildAppSheetForm_),
      views: generatorApp.views.map(aerpBuildAppSheetView_),
      menus: generatorApp.menus.map(aerpBuildAppSheetMenu_)
    },
    summary: {
      tables: 0,
      columns: 0,
      forms: 0,
      views: 0,
      menus: 0,
      durationMs: 0
    },
    warnings: [],
    errors: []
  };

  result.summary.tables = result.package.tables.length;
  result.summary.columns = result.package.columns.length;
  result.summary.forms = result.package.forms.length;
  result.summary.views = result.package.views.length;
  result.summary.menus = result.package.menus.length;
  result.summary.durationMs = new Date() - start;

  const validation = aerpValidateAppSheetPackage(result.package);

  result.ok = validation.ok;
  result.errors = validation.errors;
  result.warnings = validation.warnings;

  Logger.log(JSON.stringify(result.summary, null, 2));

  return result;
}

function aerpBuildAppSheetApp_(app) {
  return {
    name: app.name || 'Alef ERP',
    edition: app.edition || 'Launch Edition',
    version: app.version || AERP_VERSION,
    platform: 'AppSheet',
    locale: 'es-ES',
    generatedAt: new Date(),
    status: 'PackageReady'
  };
}

function aerpBuildAppSheetTable_(table) {
  return {
    id: 'TABLE_' + table.physicalName,
    name: table.name || table.physicalName,
    sourceName: table.physicalName,
    entity: table.entity || '',
    module: table.module || '',
    category: table.category || '',
    keyColumn: table.primaryKey || '',
    labelColumn: table.labelColumn || '',
    columns: table.columns.map(function(col) {
      return col.name;
    }),
    sync: true,
    readOnly: false,
    enabled: true
  };
}

function aerpBuildAppSheetColumns_(tables) {
  let columns = [];

  tables.forEach(function(table) {
    table.columns.forEach(function(col) {
      columns.push({
        id: 'COL_' + table.physicalName + '_' + col.name,
        table: table.physicalName,
        name: col.name,
        displayName: col.displayName,
        type: aerpMapToAppSheetType_(col),
        control: col.control,
        required: col.required,
        visible: col.visible,
        editable: col.editable,
        isKey: col.isKey,
        isLabel: col.isLabel,
        isRef: col.isRef,
        refTable: col.refTable || '',
        initialValue: aerpGetAppSheetInitialValue_(col),
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
    columns: form.columns,
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
    type: view.type || 'Table',
    position: 'menu',
    columns: view.columns,
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
    order: menu.order || 1,
    visible: menu.visible !== false
  };
}

function aerpMapToAppSheetType_(col) {
  const type = String(col.type || 'Text');

  const map = {
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
  };

  return map[type] || 'Text';
}

function aerpGetAppSheetInitialValue_(col) {
  const name = String(col.name || '');

  if (name === 'Activo') return 'TRUE';
  if (name === 'Fecha_Creacion') return 'NOW()';
  if (name === 'Creado_Por') return 'USEREMAIL()';
  if (name === 'Modificado_Por') return 'USEREMAIL()';

  return '';
}

function aerpValidateAppSheetPackage(pkg) {
  const errors = [];
  const warnings = [];

  if (!pkg.app) errors.push('Falta objeto app.');
  if (!pkg.tables || pkg.tables.length === 0) errors.push('No hay tablas.');
  if (!pkg.columns || pkg.columns.length === 0) errors.push('No hay columnas.');

  const tableNames = {};
  (pkg.tables || []).forEach(function(table) {
    tableNames[table.sourceName] = true;

    if (!table.keyColumn) {
      warnings.push('Tabla sin keyColumn: ' + table.sourceName);
    }

    if (!table.labelColumn) {
      warnings.push('Tabla sin labelColumn: ' + table.sourceName);
    }
  });

  (pkg.columns || []).forEach(function(col) {
    if (!tableNames[col.table]) {
      errors.push('Columna apunta a tabla inexistente: ' + col.table + '.' + col.name);
    }

    if (col.isRef && !col.refTable) {
      warnings.push('Ref sin refTable: ' + col.table + '.' + col.name);
    }
  });

  return {
    ok: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

function aerpAppSheetPackageToJSON() {
  const result = aerpBuildAppSheetPackage();
  return JSON.stringify(result, null, 2);
}

function testAppSheetGeneratorMVP() {
  const result = aerpBuildAppSheetPackage();

  Logger.log(JSON.stringify({
    ok: result.ok,
    tables: result.summary.tables,
    columns: result.summary.columns,
    forms: result.summary.forms,
    views: result.summary.views,
    menus: result.summary.menus,
    errors: result.errors,
    warnings: result.warnings,
    durationMs: result.summary.durationMs
  }, null, 2));

  if (!result.ok) {
    throw new Error('AppSheet Generator MVP tiene errores. Revisa el log.');
  }

  Logger.log('AppSheet Generator MVP OK');
}

