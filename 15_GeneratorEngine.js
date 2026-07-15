/**
 * ALEF ERP Framework
 * 15_GeneratorEngine.gs
 *
 * AERP-015 - Generator Engine MVP
 * Convierte MetadataModel en objetos base para generar la aplicación.
 */

function aerpBuildGeneratorEngineMVP() {
  const start = new Date();
  const metadataModel = aerpBuildMetadataModel();

  const app = {
    application: aerpBuildApplicationObject_(),
    tables: [],
    forms: [],
    views: [],
    menus: [],
    summary: {
      tables: 0,
      forms: 0,
      views: 0,
      menus: 0,
      errors: [],
      warnings: [],
      durationMs: 0
    }
  };

  metadataModel.tables.forEach(function(table) {
    const tableObject = aerpBuildGeneratorTable_(table);
    const formObject = aerpBuildGeneratorForm_(table);
    const viewObject = aerpBuildGeneratorView_(table);
    const menuObject = aerpBuildGeneratorMenu_(table);

    app.tables.push(tableObject);
    app.forms.push(formObject);
    app.views.push(viewObject);
    app.menus.push(menuObject);
  });

  app.summary.tables = app.tables.length;
  app.summary.forms = app.forms.length;
  app.summary.views = app.views.length;
  app.summary.menus = app.menus.length;
  app.summary.durationMs = new Date() - start;

  Logger.log(JSON.stringify(app.summary, null, 2));

  return app;
}

function aerpBuildApplicationObject_() {
  return {
    name: 'Alef ERP',
    edition: 'Launch Edition',
    version: AERP_VERSION,
    generatedAt: new Date(),
    platform: 'AppSheet',
    status: 'MVP'
  };
}

function aerpBuildGeneratorTable_(table) {
  return {
    code: table.code,
    name: table.name,
    entity: table.entity,
    physicalName: table.physicalName,
    module: table.module,
    category: table.category,
    primaryKey: table.primaryKey ? table.primaryKey.Nombre_Campo : '',
    labelColumn: table.labelColumn ? table.labelColumn.Nombre_Campo : '',
    columns: table.columns.map(function(col) {
      return {
        name: col.Nombre_Campo,
        displayName: col.Nombre_Mostrar,
        type: col.Tipo_Dato,
        control: col.Tipo_Control,
        required: aerpBoolFromMetadata_(col.Es_Requerido),
        visible: aerpBoolFromMetadata_(col.Visible),
        editable: aerpBoolFromMetadata_(col.Editable),
        isKey: aerpBoolFromMetadata_(col.Es_Key),
        isLabel: aerpBoolFromMetadata_(col.Es_Label),
        isRef: aerpBoolFromMetadata_(col.Es_Ref),
        refTable: col.Tabla_Referencia || ''
      };
    })
  };
}

function aerpBuildGeneratorForm_(table) {
  return {
    id: 'FORM_' + table.physicalName,
    name: 'Formulario ' + (table.entity || table.name || table.physicalName),
    table: table.physicalName,
    type: 'Form',
    columns: table.editableColumns.map(function(col) {
      return col.Nombre_Campo;
    }),
    primaryKey: table.primaryKey ? table.primaryKey.Nombre_Campo : '',
    labelColumn: table.labelColumn ? table.labelColumn.Nombre_Campo : ''
  };
}

function aerpBuildGeneratorView_(table) {
  return {
    id: 'VIEW_' + table.physicalName,
    name: table.name || table.physicalName,
    table: table.physicalName,
    type: 'Table',
    columns: table.visibleColumns.map(function(col) {
      return col.Nombre_Campo;
    }),
    primaryKey: table.primaryKey ? table.primaryKey.Nombre_Campo : '',
    labelColumn: table.labelColumn ? table.labelColumn.Nombre_Campo : ''
  };
}

function aerpBuildGeneratorMenu_(table) {
  return {
    id: 'MENU_' + table.physicalName,
    name: table.name || table.physicalName,
    module: table.module || '',
    table: table.physicalName,
    view: 'VIEW_' + table.physicalName,
    order: 1,
    visible: true
  };
}

function aerpGeneratorEngineToJSON() {
  const app = aerpBuildGeneratorEngineMVP();
  return JSON.stringify(app, null, 2);
}

function testGeneratorEngineMVP() {
  const app = aerpBuildGeneratorEngineMVP();

  Logger.log(JSON.stringify({
    application: app.application.name,
    edition: app.application.edition,
    tables: app.tables.length,
    forms: app.forms.length,
    views: app.views.length,
    menus: app.menus.length,
    errors: app.summary.errors,
    warnings: app.summary.warnings,
    durationMs: app.summary.durationMs
  }, null, 2));

  if (app.tables.length === 0) {
    throw new Error('Generator Engine no generó tablas.');
  }

  Logger.log('Generator Engine MVP OK');
}

