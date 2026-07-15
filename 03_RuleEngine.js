function aerpGetRules() {
  const data = aerpGetTable(AERP_SHEETS.GEN_REGLAS);

  return data.rows
    .filter(row => row[0])
    .map(row => aerpRowToObject(data.headers, row))
    .filter(rule => aerpToBool(rule.Activo))
    .sort((a, b) => {
      const prioridadA = Number(a.Prioridad || 999);
      const prioridadB = Number(b.Prioridad || 999);
      const nivelA = Number(a.Nivel || 0);
      const nivelB = Number(b.Nivel || 0);
      return prioridadA - prioridadB || nivelB - nivelA;
    });
}

function aerpFindRule(columnName) {
  const rules = aerpGetRules();

  for (const rule of rules) {
    if (aerpMatchesRule(columnName, rule)) return rule;
  }

  return aerpDefaultRule();
}

function aerpMatchesRule(columnName, rule) {
  const value = String(columnName || '').trim();
  const pattern = String(rule.Patron || '').trim();
  const type = String(rule.Tipo_Patron || '').trim();

  if (!value || !pattern) return false;

  switch (type) {
    case 'Exacto':
      return value === pattern;
    case 'EmpiezaCon':
      return value.startsWith(pattern);
    case 'Contiene':
      return value.toLowerCase().includes(pattern.toLowerCase());
    case 'TerminaCon':
      return value.endsWith(pattern);
    case 'Regex':
      return new RegExp(pattern).test(value);
    default:
      return false;
  }
}

function aerpDefaultRule() {
  return {
    ID_Regla: 'DEFAULT',
    Version: AERP_DEFAULTS.VERSION,
    Prioridad: 999,
    Nivel: 0,
    Activo: true,
    Nombre_Regla: 'Regla por defecto',
    Tipo_Dato: AERP_DEFAULTS.TIPO_DATO,
    Tipo_Control: AERP_DEFAULTS.TIPO_CONTROL,
    Categoria: AERP_DEFAULTS.CATEGORIA,
    Requerido: false,
    Permite_Nulos: true,
    Es_Key: false,
    Es_Label: false,
    Es_Ref: false,
    Visible: true,
    Editable: true,
    ID_TablaReferencia: '',
    Formula: '',
    Descripcion: 'Regla por defecto.'
  };
}
