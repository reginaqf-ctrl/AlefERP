/**
 * ALEF ERP Metadata Engine 3.0
 * 06_MetadataValidator.gs
 */

const AERP_VALID_TIPO_DATO = [
  'Text','LongText','Number','Decimal','Price','Percent',
  'Date','DateTime','Time','YesNo','Email','Phone','URL',
  'Image','File','Enum','EnumList','Ref','LatLong','Color'
];

const AERP_VALID_TIPO_CONTROL = [
  'Text','Textarea','Dropdown','Checkbox','DatePicker','TimePicker',
  'DateTimePicker','Number','Currency','Percent','Email','Phone',
  'URL','Image','File','ColorPicker','Map','Signature','Barcode','QR'
];

function aerpValidateMetadata(metadataList) {
  const errors = [];
  const warnings = [];
  const seen = {};

  metadataList.forEach(item => {
    const key = item.Tabla + '|' + item.Nombre_Campo;

    if (seen[key]) {
      errors.push('Duplicado: ' + key);
    }

    seen[key] = true;

    if (!item.ID_Columna) errors.push(key + ': falta ID_Columna');
    if (!item.Tabla) errors.push(key + ': falta Tabla');
    if (!item.Nombre_Campo) errors.push(key + ': falta Nombre_Campo');

    if (!AERP_VALID_TIPO_DATO.includes(item.Tipo_Dato)) {
      errors.push(key + ': Tipo_Dato inválido = ' + item.Tipo_Dato);
    }

    if (!AERP_VALID_TIPO_CONTROL.includes(item.Tipo_Control)) {
      errors.push(key + ': Tipo_Control inválido = ' + item.Tipo_Control);
    }

    if (item.Es_Ref === true && !item.Tabla_Referencia) {
      warnings.push(key + ': Es_Ref=TRUE pero no tiene Tabla_Referencia');
    }

    if (item.Es_Key === true && item.Permite_Nulos === true) {
      errors.push(key + ': una Key no puede permitir nulos');
    }
  });

  return {
    ok: errors.length === 0,
    errors: errors,
    warnings: warnings,
    total: metadataList.length
  };
}

function testValidatorCAT_ESTADOS() {
  const metadata = aerpScanTable('CAT_ESTADOS');
  const result = aerpValidateMetadata(metadata);

  Logger.log(JSON.stringify(result, null, 2));
}