/**
 * ALEF ERP Metadata Engine 3.0
 * 04_ActionEngine.gs
 */

function aerpBuildColumnMetadata(tableName, columnName, order) {
  const rule = aerpFindRule(columnName);

  return {
    ID_Columna: Utilities.getUuid(),
    Tabla: tableName,
    Nombre_Campo: columnName,
    Nombre_Mostrar: aerpHumanize(columnName),

    Tipo_Dato: aerpNormalizeTipoDato(rule.Tipo_Dato),
    Tipo_Control: aerpNormalizeTipoControl(rule.Tipo_Control),

    Es_Key: aerpIsPrimaryKey(columnName, rule, order),
    Es_Label: aerpToBool(rule.Es_Label),
    Es_Requerido: aerpToBool(rule.Requerido),
    Permite_Nulos: aerpToBoolDefault(rule.Permite_Nulos, true),

    Valor_Inicial: aerpGetInitialValue(columnName, rule),
    Formula_App: rule.Formula || '',
    Tabla_Referencia: aerpGetReferenceTable(columnName, rule, order),

    Longitud: '',
    Orden: order,
    Activo: true,
    Estado: '',

    Fecha_Creacion: new Date(),
    Fecha_Actualizacion: '',

    Visible: aerpToBoolDefault(rule.Visible, true),
    Editable: aerpToBoolDefault(rule.Editable, true),

    Es_Ref: aerpIsReference(columnName, rule, order),
    Es_Virtual: false,

    Es_Buscable: true,
    Es_Filtrable: true,
    Es_Ordenable: true,
    Es_Indexado: false,

    Grupo_Formulario: '',
    Ayuda: rule.Descripcion || '',
    Placeholder: ''
  };
}

function aerpIsPrimaryKey(columnName, rule, order) {
  const name = String(columnName || '');

  if (Number(order) === 1 && name.startsWith('ID_')) {
    return true;
  }

  return aerpToBool(rule.Es_Key);
}

function aerpIsReference(columnName, rule, order) {
  const name = String(columnName || '');

  if (Number(order) === 1 && name.startsWith('ID_')) {
    return false;
  }

  if (aerpToBool(rule.Es_Ref)) {
    return true;
  }

  if (!name.startsWith('ID_')) {
    return false;
  }

  return true;
}

function aerpGetInitialValue(columnName, rule) {
  const name = String(columnName || '');

  if (name === 'Activo') return 'TRUE';
  if (name === 'Fecha_Creacion') return 'NOW()';
  if (name === 'Creado_Por') return 'USEREMAIL()';
  if (name === 'Modificado_Por') return 'USEREMAIL()';
  if (name === 'Version') return '"' + AERP_DEFAULTS.VERSION + '"';

  return rule.Formula || '';
}

function aerpGetReferenceTable(columnName, rule, order) {
  const name = String(columnName || '');

  if (Number(order) === 1 && name.startsWith('ID_')) {
    return '';
  }

  if (rule.ID_TablaReferencia) {
    return rule.ID_TablaReferencia;
  }

  if (!name.startsWith('ID_')) {
    return '';
  }

  const suffix = name.replace('ID_', '').toUpperCase();

  const explicitMap = {
    ESTADO: 'CAT_ESTADOS',
    EMPRESA: 'CORE_EMPRESAS',
    USUARIO: 'CORE_USUARIOS',
    ROL: 'CORE_ROLES',
    MODULO: 'CORE_MODULOS',
    MONEDA: 'CAT_MONEDAS',
    PAIS: 'CAT_PAISES',
    IDIOMA: 'CAT_IDIOMAS'
  };

  if (explicitMap[suffix]) {
    return explicitMap[suffix];
  }

  return aerpInferReferenceTableBySuffix(suffix);
}

function aerpInferReferenceTableBySuffix(suffix) {
  try {
    const data = aerpGetTable(AERP_SHEETS.CORE_TABLAS);
    const idxCodigo = data.headers.indexOf('Codigo');
    const idxFisica = data.headers.indexOf('Tabla_Fisica');

    for (const row of data.rows) {
      const codigo = String(row[idxCodigo] || '').toUpperCase();
      const fisica = String(row[idxFisica] || '').toUpperCase();

      if (codigo.endsWith(suffix) || fisica.endsWith(suffix)) {
        return row[idxFisica] || row[idxCodigo];
      }
    }
  } catch (error) {
    return '';
  }

  return '';
}

function aerpMetadataToRow(metadata, headers) {
  return headers.map(header => {
    const key = String(header).trim();
    return Object.prototype.hasOwnProperty.call(metadata, key)
      ? metadata[key]
      : '';
  });
}

function testActionEngine() {
  const metadata = aerpBuildColumnMetadata('CAT_ESTADOS', 'ID_Estado', 1);
  Logger.log(JSON.stringify(metadata, null, 2));
}