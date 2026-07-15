/**
 * ==========================================================
 * ALEF ERP
 * Launch Edition 1.0
 *
 * Módulo: UI Components MVP
 * ID: AERP-026
 * Autor: Alef Engineering
 * Design System: Alef UI Kit 1.0
 * Estado: Release Candidate
 * ==========================================================
 *
 * Biblioteca reutilizable de componentes visuales para
 * Google Sheets.
 *
 * Consume:
 * - AERP_BRAND
 * - AERP_THEME
 * - AERP_TYPOGRAPHY
 * - AERP_LAYOUT
 * - AERP_ICONS
 *
 * No ejecuta lógica de negocio.
 * ==========================================================
 */


/* ==========================================================
 * 1. UTILIDADES BASE
 * ==========================================================
 */

/**
 * Comprueba que exista una hoja válida.
 */
function aerpUiRequireSheet_(sheet) {
  if (!sheet) {
    throw new Error(
      'UI Components: no se recibió una hoja válida.'
    );
  }

  return sheet;
}


/**
 * Devuelve un rango válido.
 */
function aerpUiGetRange_(sheet, rangeA1) {
  aerpUiRequireSheet_(sheet);

  const normalizedRange =
    String(rangeA1 || '').trim();

  if (!normalizedRange) {
    throw new Error(
      'UI Components: no se recibió un rango válido.'
    );
  }

  return sheet.getRange(normalizedRange);
}


/**
 * Descombina un rango antes de reutilizarlo.
 */
function aerpUiResetRange_(sheet, rangeA1) {
  const range =
    aerpUiGetRange_(sheet, rangeA1);

  range.breakApart();
  range.clear();

  return range;
}


/**
 * Combina un rango de forma segura.
 */
function aerpUiMergeRange_(sheet, rangeA1) {
  const range =
    aerpUiGetRange_(sheet, rangeA1);

  range.breakApart();
  range.merge();

  return range;
}


/**
 * Normaliza valores para mostrarlos en pantalla.
 */
function aerpUiText_(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value);
}
/* ==========================================================
 * 1.1 ADAPTADOR DEL ENTERPRISE UI FRAMEWORK
 * ==========================================================
 */

/**
 * Devuelve el Theme Enterprise oficial.
 *
 * @return {Object} Theme inmutable de AERP-027.
 */
function aerpUiGetEnterpriseTheme_() {
  if (
    typeof aerpGetTheme !== 'function'
  ) {
    throw new Error(
      'AERP-026: no está disponible aerpGetTheme() de AERP-027.'
    );
  }

  return aerpGetTheme();
}


/**
 * Construye un componente declarativo mediante el Factory.
 *
 * @param {string} type Tipo de componente.
 * @param {string} variant Variante registrada.
 * @param {Object=} properties Propiedades del componente.
 * @return {Object} Componente resuelto e inmutable.
 */
function aerpUiCreateDefinition_(
  type,
  variant,
  properties
) {
  if (
    typeof aerpCreateComponent !== 'function'
  ) {
    throw new Error(
      'AERP-026: no está disponible aerpCreateComponent() de AERP-027.'
    );
  }

  return aerpCreateComponent(
    type,
    variant,
    properties || {}
  );
}


/**
 * Convierte un peso tipográfico numérico a un valor aceptado
 * por Google Sheets.
 *
 * Google Sheets admite principalmente "normal" y "bold".
 *
 * @param {*} fontWeight Peso tipográfico del Theme.
 * @return {string} Peso compatible con Sheets.
 */
function aerpUiNormalizeFontWeight_(
  fontWeight
) {
  return Number(fontWeight) >= 600
    ? 'bold'
    : 'normal';
}


/**
 * Obtiene el tamaño tipográfico de un preset resuelto.
 *
 * @param {*} typography Preset tipográfico.
 * @param {number=} fallback Tamaño alternativo.
 * @return {number} Tamaño en puntos.
 */
function aerpUiResolveFontSize_(
  typography,
  fallback
) {
  if (
    typography &&
    typeof typography === 'object' &&
    Number(typography.fontSize) > 0
  ) {
    return Number(
      typography.fontSize
    );
  }

  return Number(
    fallback || 14
  );
}


/**
 * Obtiene el peso tipográfico de un preset resuelto.
 *
 * @param {*} typography Preset tipográfico.
 * @return {string} Peso compatible con Sheets.
 */
function aerpUiResolveFontWeight_(
  typography
) {
  if (
    typography &&
    typeof typography === 'object'
  ) {
    return aerpUiNormalizeFontWeight_(
      typography.fontWeight
    );
  }

  return 'normal';
}


/**
 * Convierte un estilo de borde del Theme al equivalente
 * disponible en Google Sheets.
 *
 * @param {string=} borderStyle Estilo semántico.
 * @param {number=} borderWidth Grosor semántico.
 * @return {*} SpreadsheetApp.BorderStyle.
 */
function aerpUiResolveBorderStyle_(
  borderStyle,
  borderWidth
) {
  const normalizedStyle =
    String(borderStyle || 'solid')
      .toLowerCase();

  const normalizedWidth =
    Number(borderWidth || 1);

  if (normalizedStyle === 'dashed') {
    return SpreadsheetApp
      .BorderStyle
      .DASHED;
  }

  if (normalizedStyle === 'dotted') {
    return SpreadsheetApp
      .BorderStyle
      .DOTTED;
  }

  if (normalizedWidth >= 2) {
    return SpreadsheetApp
      .BorderStyle
      .SOLID_MEDIUM;
  }

  return SpreadsheetApp
    .BorderStyle
    .SOLID;
}


/**
 * Aplica un preset de contenedor resuelto a un rango.
 *
 * @param {*} range Rango de Google Sheets.
 * @param {Object=} container Preset visual del contenedor.
 * @return {*} Rango estilizado.
 */
function aerpUiApplyContainerPreset_(
  range,
  container
) {
  if (!range) {
    throw new Error(
      'AERP-026: no se recibió un rango válido.'
    );
  }

  const style =
    container || {};

  if (style.background) {
    range.setBackground(
      style.background
    );
  }

  if (style.borderColor) {
    range.setBorder(
      true,
      true,
      true,
      true,
      false,
      false,
      style.borderColor,
      aerpUiResolveBorderStyle_(
        style.borderStyle,
        style.borderWidth
      )
    );
  }

  return range;
}


/**
 * Aplica un preset tipográfico resuelto a un rango.
 *
 * @param {*} range Rango de Google Sheets.
 * @param {Object=} textPreset Preset de texto.
 * @param {Object=} options Opciones adicionales.
 * @return {*} Rango estilizado.
 */
function aerpUiApplyTextPreset_(
  range,
  textPreset,
  options
) {
  if (!range) {
    throw new Error(
      'AERP-026: no se recibió un rango válido.'
    );
  }

  const preset =
    textPreset || {};

  const config =
    options || {};

  const typography =
    preset.typography || preset;

  const theme =
    aerpUiGetEnterpriseTheme_();

  range
    .setFontFamily(
      config.fontFamily ||
      theme.typography.fontFamily.primary
    )
    .setFontSize(
      Number(
        config.fontSize ||
        aerpUiResolveFontSize_(
          typography,
          14
        )
      )
    )
    .setFontWeight(
      config.fontWeight ||
      aerpUiResolveFontWeight_(
        typography
      )
    );

  if (
    config.color ||
    preset.color
  ) {
    range.setFontColor(
      config.color ||
      preset.color
    );
  }

  return range;
}


/* ==========================================================
 * 2. PREPARACIÓN DE HOJAS
 * ==========================================================
 */

/**
 * Prepara una hoja para utilizar el Alef UI Kit.
 */
function aerpPrepareUiSheet_(
  sheet,
  visibleRows,
  visibleColumns,
  columnWidth
) {
  aerpUiRequireSheet_(sheet);

  const rows =
    Math.max(
      Number(visibleRows || 30),
      1
    );

  const columns =
    Math.max(
      Number(
        visibleColumns ||
        AERP_LAYOUT.DASHBOARD_COLUMNS
      ),
      1
    );

  const width =
    Number(
      columnWidth ||
      AERP_LAYOUT.STANDARD_COLUMN_WIDTH
    );

  aerpEnsureSheetSize_(
    sheet,
    rows,
    columns
  );

  aerpRestoreSheetView_(sheet);

  sheet.setHiddenGridlines(true);

  sheet.setColumnWidths(
    1,
    columns,
    width
  );

  for (
    let row = 1;
    row <= rows;
    row++
  ) {
    sheet.setRowHeight(
      row,
      AERP_LAYOUT.ROW_HEIGHT.STANDARD
    );
  }

  aerpConstrainSheetView_(
    sheet,
    rows,
    columns
  );

  aerpApplyAlefTheme_(
    sheet,
    sheet.getRange(
      1,
      1,
      rows,
      columns
    ).getA1Notation()
  );

  return sheet;
}


/**
 * Elimina una hoja anterior y crea una nueva.
 */
function aerpCreateFreshUiSheet_(
  spreadsheet,
  sheetName,
  visibleRows,
  visibleColumns,
  columnWidth
) {
  if (!spreadsheet) {
    throw new Error(
      'UI Components: no se recibió un Spreadsheet.'
    );
  }

  const normalizedName =
    String(sheetName || '').trim();

  if (!normalizedName) {
    throw new Error(
      'UI Components: el nombre de la hoja es obligatorio.'
    );
  }

  const previousSheet =
    spreadsheet.getSheetByName(
      normalizedName
    );

  if (previousSheet) {
    spreadsheet.deleteSheet(
      previousSheet
    );

    SpreadsheetApp.flush();
  }

  const sheet =
    spreadsheet.insertSheet(
      normalizedName
    );

  aerpPrepareUiSheet_(
    sheet,
    visibleRows,
    visibleColumns,
    columnWidth
  );

  return sheet;
}


/* ==========================================================
 * 3. ENCABEZADOS
 * ==========================================================
 */

/**
 * Crea el encabezado oficial con logotipo real.
 *
 * Ejemplo:
 * logoRange: A1:B3
 * titleRange: C1:H3
 */
function aerpCreateHeader_(
  sheet,
  logoRangeA1,
  titleRangeA1,
  title,
  options
) {
  aerpUiRequireSheet_(sheet);

  const config =
    options || {};

  const logoRange =
    aerpUiMergeRange_(
      sheet,
      logoRangeA1
    );

  logoRange
    .setBackground(
      config.background ||
      AERP_THEME.COLORS.BLACK
    );

  const titleRange =
    aerpUiMergeRange_(
      sheet,
      titleRangeA1
    );

  titleRange
    .setValue(
      title ||
      AERP_BRAND.PRODUCT
    )
    .setBackground(
      config.background ||
      AERP_THEME.COLORS.BLACK
    )
    .setFontColor(
      config.textColor ||
      AERP_THEME.COLORS.TEXT_INVERSE
    )
    .setFontFamily(
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontSize(
      Number(
        config.fontSize ||
        AERP_TYPOGRAPHY.SIZES.TITLE
      )
    )
    .setFontWeight('bold')
    .setHorizontalAlignment(
      config.alignment || 'left'
    )
    .setVerticalAlignment('middle');

  if (
  config.insertLogo !== false &&
  aerpHasBrandAsset_('LOGO_ISOTYPE')
) {
  try {
    aerpInsertAlefLogo_(
      sheet,
      Number(config.logoColumn || 1),
      Number(config.logoRow || 1),
      Number(config.logoWidth || 68),
      Number(config.logoHeight || 68)
    );

  } catch (error) {
    console.warn(
      'No se pudo insertar el logotipo: ' +
      (
        error && error.message
          ? error.message
          : String(error)
      )
    );

    logoRange
      .setValue(AERP_BRAND.PRODUCT_CODE)
      .setFontFamily(AERP_TYPOGRAPHY.FAMILY)
      .setFontSize(AERP_TYPOGRAPHY.SIZES.SUBTITLE)
      .setFontWeight('bold')
      .setFontColor(AERP_THEME.COLORS.TEXT_INVERSE)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  }
}

  return {
    logoRange: logoRange,
    titleRange: titleRange
  };
}


/**
 * Crea el subtítulo oficial.
 */
function aerpCreateSubHeader_(
  sheet,
  rangeA1,
  text,
  options
) {
  const config =
    options || {};

  const range =
    aerpUiMergeRange_(
      sheet,
      rangeA1
    );

  range
    .setValue(
      text ||
      AERP_BRAND.TAGLINE
    )
    .setBackground(
      config.background ||
      AERP_THEME.COLORS.DEEP_BLUE
    )
    .setFontColor(
      config.textColor ||
      AERP_THEME.COLORS.TEXT_INVERSE
    )
    .setFontFamily(
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontSize(
      Number(
        config.fontSize ||
        AERP_TYPOGRAPHY.SIZES.SUBTITLE
      )
    )
    .setFontWeight('bold')
    .setHorizontalAlignment(
      config.alignment || 'center'
    )
    .setVerticalAlignment('middle');

  return range;
}


/* ==========================================================
 * 4. ESTADOS Y FEEDBACK
 * ==========================================================
 */

/**
 * Crea una banda oficial de estado.
 */
function aerpCreateStatusBanner_(
  sheet,
  rangeA1,
  status,
  text
) {
  const normalizedStatus =
    String(status || 'SUCCESS')
      .trim()
      .toUpperCase();

  const theme =
    AERP_THEME.STATUS[
      normalizedStatus
    ] ||
    AERP_THEME.STATUS.INFO;

  const range =
    aerpUiMergeRange_(
      sheet,
      rangeA1
    );

  range
    .setValue(
      text ||
      (
        theme.icon +
        ' ' +
        theme.label
      )
    )
    .setBackground(
      theme.background
    )
    .setFontColor(
      theme.text
    )
    .setFontFamily(
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontSize(
      AERP_TYPOGRAPHY.SIZES.SUBTITLE
    )
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  return range;
}


/**
 * Muestra una notificación no bloqueante.
 */
function aerpCreateToast_(
  message,
  title,
  seconds
) {
  const ss =
    aerpGetSpreadsheet();

  ss.toast(
    aerpUiText_(message),
    title ||
      AERP_BRAND.PRODUCT,
    Number(seconds || 5)
  );
}


/* ==========================================================
 * 5. TARJETAS
 * ==========================================================
 */

/**
 * Crea una tarjeta KPI.
 */
/**
 * Crea una tarjeta KPI Enterprise en Google Sheets.
 *
 * Mantiene compatibilidad con la firma original:
 *
 * aerpCreateKpiCard_(
 *   sheet,
 *   rangeA1,
 *   icon,
 *   title,
 *   value,
 *   options
 * )
 *
 * Consume:
 * - AERP-027 Component Factory
 * - components.card.kpi
 *
 * @param {*} sheet Hoja de Google Sheets.
 * @param {string} rangeA1 Rango A1 que ocupará la tarjeta.
 * @param {*} icon Icono visible.
 * @param {*} title Título de la tarjeta.
 * @param {*} value Valor principal.
 * @param {Object=} options Configuración opcional.
 * @return {*} Rango estilizado.
 */
function aerpCreateKpiCard_(
  sheet,
  rangeA1,
  icon,
  title,
  value,
  options
) {
  aerpUiRequireSheet_(sheet);

  const config =
    options || {};

  /*
   * 1. Crear definición declarativa mediante el Factory.
   */
  const component =
    aerpUiCreateDefinition_(
      'card',
      'kpi',
      {
        id:
          config.id ||
          null,

        icon:
          icon ||
          AERP_ICONS.INFO,

        title:
          aerpUiText_(title),

        value:
          aerpUiText_(value),

        subtitle:
          aerpUiText_(
            config.subtitle
          ),

        trend:
          config.trend || null,

        visible:
          config.visible !== false,

        enabled:
          config.enabled !== false,

        loading:
          config.loading === true
      }
    );

  /*
   * 2. Obtener preset resuelto.
   */
  const preset =
    component.preset;

  /*
   * 3. Preparar y combinar el rango.
   */
  const range =
    aerpUiMergeRange_(
      sheet,
      rangeA1
    );

  /*
   * 4. Construir el contenido visible.
   */
  const lines = [];

  const iconText =
    aerpUiText_(
      component.properties.icon
    );

  const titleText =
    aerpUiText_(
      component.properties.title
    );

  const valueText =
    aerpUiText_(
      component.properties.value
    );

  const subtitleText =
    aerpUiText_(
      component.properties.subtitle
    );

  lines.push(
    (
      iconText
        ? iconText + ' '
        : ''
    ) +
    titleText
  );

  lines.push('');
  lines.push(valueText);

  if (subtitleText) {
    lines.push('');
    lines.push(subtitleText);
  }

  /*
   * 5. Aplicar preset Enterprise.
   */
  range
    .setValue(
      lines.join('\n')
    )
    .setHorizontalAlignment(
      config.alignment ||
      'center'
    )
    .setVerticalAlignment(
      config.verticalAlignment ||
      'middle'
    )
    .setWrap(true);

  aerpUiApplyContainerPreset_(
    range,
    {
      background:
        config.background ||
        preset.container.background,

      borderColor:
        config.borderColor ||
        preset.container.borderColor,

      borderWidth:
        config.borderWidth ||
        preset.container.borderWidth,

      borderStyle:
        config.borderStyle ||
        preset.container.borderStyle
    }
  );

  aerpUiApplyTextPreset_(
    range,
    preset.value,
    {
      fontFamily:
        config.fontFamily,

      fontSize:
        config.fontSize,

      fontWeight:
        config.fontWeight ||
        'bold',

      color:
        config.textColor ||
        preset.value.color
    }
  );

  /*
   * 6. Aplicar estado visual básico.
   */
  if (
    component.state.enabled === false
  ) {
    range.setFontColor(
      aerpUiGetEnterpriseTheme_()
        .colors
        .text
        .disabled
    );
  }

  if (
    component.state.loading === true
  ) {
    range.setValue(
      aerpUiText_(
        config.loadingText ||
        'Cargando...'
      )
    );
  }

  /*
   * Google Sheets no permite ocultar un rango individual.
   * Para visible:false se limpia el contenido, pero se conserva
   * la superficie para no romper el layout.
   */
  if (
    component.state.visible === false
  ) {
    range.clearContent();
  }

  return range;
}


/**
 * Crea una tarjeta métrica con descripción.
 */
function aerpCreateMetricCard_(
  sheet,
  rangeA1,
  icon,
  title,
  value,
  description,
  options
) {
  const config =
    options || {};

  const range =
    aerpUiMergeRange_(
      sheet,
      rangeA1
    );

  const lines = [
    aerpUiText_(
      icon || AERP_ICONS.INFO
    ) +
      ' ' +
      aerpUiText_(title),

    '',

    aerpUiText_(value)
  ];

  if (description) {
    lines.push(
      '',
      aerpUiText_(description)
    );
  }

  range
    .setValue(
      lines.join('\n')
    )
    .setBackground(
      config.background ||
      AERP_THEME.COLORS.SURFACE
    )
    .setFontColor(
      config.textColor ||
      AERP_THEME.COLORS.TEXT_PRIMARY
    )
    .setFontFamily(
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontSize(
      AERP_TYPOGRAPHY.SIZES.BODY
    )
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  range.setBorder(
    true,
    true,
    true,
    true,
    false,
    false,
    config.borderColor ||
      AERP_THEME.COLORS.BORDER,
    SpreadsheetApp
      .BorderStyle
      .SOLID
  );

  return range;
}


/**
 * Crea una tarjeta especializada para pasos del Build.
 */
function aerpCreateBuildCard_(
  sheet,
  rangeA1,
  title,
  status,
  duration,
  message
) {
  const normalizedStatus =
    String(status || 'INFO')
      .trim()
      .toUpperCase();

  const theme =
    AERP_THEME.STATUS[
      normalizedStatus
    ] ||
    AERP_THEME.STATUS.INFO;

  const range =
    aerpUiMergeRange_(
      sheet,
      rangeA1
    );

  const lines = [
    theme.icon +
      ' ' +
      aerpUiText_(title),

    '',

    theme.label
  ];

  if (duration) {
    lines.push(
      aerpUiText_(duration)
    );
  }

  if (message) {
    lines.push(
      '',
      aerpUiText_(message)
    );
  }

  range
    .setValue(
      lines.join('\n')
    )
    .setBackground(
      AERP_THEME.COLORS.SURFACE
    )
    .setFontColor(
      AERP_THEME.COLORS.TEXT_PRIMARY
    )
    .setFontFamily(
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontSize(
      AERP_TYPOGRAPHY.SIZES.BODY
    )
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  range.setBorder(
    true,
    true,
    true,
    true,
    false,
    false,
    theme.background,
    SpreadsheetApp
      .BorderStyle
      .SOLID_MEDIUM
  );

  return range;
}


/* ==========================================================
 * 6. SECCIONES Y PIES
 * ==========================================================
 */

/**
 * Crea una sección visual.
 */
function aerpCreateSection_(
  sheet,
  rangeA1,
  title,
  options
) {
  const config =
    options || {};

  const range =
    aerpUiMergeRange_(
      sheet,
      rangeA1
    );

  range
    .setValue(
      aerpUiText_(title)
    )
    .setBackground(
      config.background ||
      AERP_THEME.COLORS.SURFACE_ALT
    )
    .setFontColor(
      config.textColor ||
      AERP_THEME.COLORS.TEXT_PRIMARY
    )
    .setFontFamily(
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontSize(
      Number(
        config.fontSize ||
        AERP_TYPOGRAPHY.SIZES.SECTION
      )
    )
    .setFontWeight('bold')
    .setHorizontalAlignment(
      config.alignment || 'center'
    )
    .setVerticalAlignment('middle')
    .setWrap(true);

  return range;
}


/**
 * Crea el pie institucional.
 */
function aerpCreateFooter_(
  sheet,
  rangeA1,
  text,
  options
) {
  const config =
    options || {};

  const range =
    aerpUiMergeRange_(
      sheet,
      rangeA1
    );

  range
    .setValue(
      text ||
      (
        AERP_BRAND.TAGLINE +
        '\n' +
        AERP_BRAND.POWERED_BY
      )
    )
    .setBackground(
      config.background ||
      AERP_THEME.COLORS.BLACK
    )
    .setFontColor(
      config.textColor ||
      AERP_THEME.COLORS.TEXT_INVERSE
    )
    .setFontFamily(
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontSize(
      Number(
        config.fontSize ||
        AERP_TYPOGRAPHY.SIZES.CAPTION
      )
    )
    .setFontStyle('italic')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  return range;
}


/* ==========================================================
 * 7. BOTONES SIMULADOS PARA GOOGLE SHEETS
 * ==========================================================
 *
 * Google Sheets no crea botones nativos mediante celdas.
 * Estos componentes crean superficies visuales que pueden
 * asociarse posteriormente a dibujos, imágenes o menús.
 * ==========================================================
 */

/**
 * Crea un botón primario visual.
 */
function aerpCreatePrimaryButton_(
  sheet,
  rangeA1,
  label,
  icon
) {
  const range =
    aerpUiMergeRange_(
      sheet,
      rangeA1
    );

  range
    .setValue(
      (
        icon
          ? icon + ' '
          : ''
      ) +
      aerpUiText_(label)
    )
    .setBackground(
      AERP_THEME.COLORS.ALEF_BLUE
    )
    .setFontColor(
      AERP_THEME.COLORS.TEXT_PRIMARY
    )
    .setFontFamily(
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontSize(
      AERP_TYPOGRAPHY.SIZES.BUTTON
    )
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  range.setBorder(
    true,
    true,
    true,
    true,
    false,
    false,
    AERP_THEME.COLORS.DEEP_BLUE,
    SpreadsheetApp
      .BorderStyle
      .SOLID
  );

  return range;
}


/**
 * Crea un botón secundario visual.
 */
function aerpCreateSecondaryButton_(
  sheet,
  rangeA1,
  label,
  icon
) {
  const range =
    aerpUiMergeRange_(
      sheet,
      rangeA1
    );

  range
    .setValue(
      (
        icon
          ? icon + ' '
          : ''
      ) +
      aerpUiText_(label)
    )
    .setBackground(
      AERP_THEME.COLORS.SURFACE
    )
    .setFontColor(
      AERP_THEME.COLORS.DEEP_BLUE
    )
    .setFontFamily(
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontSize(
      AERP_TYPOGRAPHY.SIZES.BUTTON
    )
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  range.setBorder(
    true,
    true,
    true,
    true,
    false,
    false,
    AERP_THEME.COLORS.DEEP_BLUE,
    SpreadsheetApp
      .BorderStyle
      .SOLID
  );

  return range;
}


/* ==========================================================
 * 8. HELPERS DE ESTILO
 * ==========================================================
 */

/**
 * Aplica un borde oficial.
 */
function aerpApplyBorder_(
  range,
  borderColor,
  borderStyle
) {
  if (!range) {
    throw new Error(
      'UI Components: no se recibió un rango para aplicar borde.'
    );
  }

  range.setBorder(
    true,
    true,
    true,
    true,
    false,
    false,
    borderColor ||
      AERP_THEME.COLORS.BORDER,
    borderStyle ||
      SpreadsheetApp
        .BorderStyle
        .SOLID
  );

  return range;
}


/**
 * Aplica alineación y tipografía base.
 */
function aerpApplyTheme_(
  range,
  options
) {
  if (!range) {
    throw new Error(
      'UI Components: no se recibió un rango para aplicar tema.'
    );
  }

  const config =
    options || {};

  range
    .setFontFamily(
      config.fontFamily ||
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontSize(
      Number(
        config.fontSize ||
        AERP_TYPOGRAPHY.SIZES.BODY
      )
    )
    .setFontColor(
      config.textColor ||
      AERP_THEME.COLORS.TEXT_PRIMARY
    )
    .setBackground(
      config.background ||
      AERP_THEME.COLORS.SURFACE
    )
    .setVerticalAlignment(
      config.verticalAlignment ||
      'middle'
    )
    .setHorizontalAlignment(
      config.horizontalAlignment ||
      'left'
    );

  return range;
}


/**
 * Aplica altura visual a un grupo de filas.
 */
function aerpApplySpacing_(
  sheet,
  startRow,
  numberOfRows,
  height
) {
  aerpUiRequireSheet_(sheet);

  sheet.setRowHeights(
    Number(startRow || 1),
    Number(numberOfRows || 1),
    Number(
      height ||
      AERP_LAYOUT.ROW_HEIGHT.STANDARD
    )
  );

  return sheet;
}


/* ==========================================================
 * 9. VALIDACIÓN DEL UI KIT
 * ==========================================================
 */

/**
 * Valida dependencias y funciones esenciales.
 */
function aerpValidateUiComponents_() {
  const errors = [];

  const requiredGlobals = [
    ['AERP_BRAND', typeof AERP_BRAND],
    ['AERP_THEME', typeof AERP_THEME],
    ['AERP_TYPOGRAPHY', typeof AERP_TYPOGRAPHY],
    ['AERP_LAYOUT', typeof AERP_LAYOUT],
    ['AERP_ICONS', typeof AERP_ICONS]
  ];

  requiredGlobals.forEach(
    function(item) {
      if (
        item[1] === 'undefined'
      ) {
        errors.push(
          'Falta la dependencia: ' +
          item[0]
        );
      }
    }
  );

  const requiredFunctions = [
    'aerpCreateHeader_',
    'aerpCreateSubHeader_',
    'aerpCreateStatusBanner_',
    'aerpCreateKpiCard_',
    'aerpCreateMetricCard_',
    'aerpCreateBuildCard_',
    'aerpCreateSection_',
    'aerpCreateFooter_',
    'aerpCreatePrimaryButton_',
    'aerpCreateSecondaryButton_'
  ];

  requiredFunctions.forEach(
    function(functionName) {
      try {
        const fn =
          eval(functionName);

        if (
          typeof fn !== 'function'
        ) {
          errors.push(
            'Función no disponible: ' +
            functionName
          );
        }
      } catch (error) {
        errors.push(
          'Función no disponible: ' +
          functionName
        );
      }
    }
  );

  return {
    ok: errors.length === 0,
    errors: errors,
    components:
      requiredFunctions.length
  };
}


/* ==========================================================
 * 10. PRUEBA TÉCNICA
 * ==========================================================
 */

/**
 * Prueba técnica sin crear hojas.
 */
function testUIComponents() {
  const validation =
    aerpValidateUiComponents_();

  const result = {
    ok: validation.ok,

    module:
      'AERP-026 UI Components MVP',

    components:
      validation.components,

    designSystem:
      AERP_BRAND
        .DESIGN_SYSTEM_VERSION,

    themeColors:
      Object.keys(
        AERP_THEME.COLORS
      ).length,

    errors:
      validation.errors
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  if (!result.ok) {
    throw new Error(
      'UI Components incompleto: ' +
      result.errors.join(' | ')
    );
  }

  Logger.log(
    'UI Components MVP OK | ' +
    result.components +
    ' componentes'
  );

  return result;
}


/* ==========================================================
 * 11. DEMOSTRACIÓN VISUAL
 * ==========================================================
 */

/**
 * Genera una hoja de demostración del UI Kit.
 */
function demoUIComponents() {
  const ss =
    aerpGetSpreadsheet();

  const sheet =
    aerpCreateFreshUiSheet_(
      ss,
      'AERP_UI_COMPONENTS',
      36,
      8,
      AERP_LAYOUT
        .STANDARD_COLUMN_WIDTH
    );

  sheet.setFrozenRows(4);

  sheet.setRowHeights(
    1,
    3,
    AERP_LAYOUT.ROW_HEIGHT.HERO
  );

  aerpCreateHeader_(
    sheet,
    'A1:B3',
    'C1:H3',
    AERP_BRAND.PRODUCT,
    {
      insertLogo: true,
      alignment: 'left'
    }
  );

  aerpCreateSubHeader_(
    sheet,
    'A4:H4',
    'Alef UI Components MVP'
  );

  aerpCreateStatusBanner_(
    sheet,
    'A6:H7',
    'SUCCESS',
    AERP_ICONS.SUCCESS +
      ' COMPONENTES DISPONIBLES'
  );

  aerpCreateKpiCard_(
    sheet,
    'A9:B12',
    AERP_ICONS.TABLE,
    'TABLAS',
    23
  );

  aerpCreateKpiCard_(
    sheet,
    'C9:D12',
    AERP_ICONS.COLUMN,
    'COLUMNAS',
    276
  );

  aerpCreateMetricCard_(
    sheet,
    'E9:F12',
    AERP_ICONS.BUILD,
    'BUILD',
    'SUCCESS',
    '36.35 s'
  );

  aerpCreateBuildCard_(
    sheet,
    'G9:H12',
    'Metadata Engine',
    'SUCCESS',
    '18.20 s',
    'Metadata lista'
  );

  aerpCreateSection_(
    sheet,
    'A14:H15',
    'Botones oficiales'
  );

  aerpCreatePrimaryButton_(
    sheet,
    'B17:D18',
    'Generar ERP',
    AERP_ICONS.BUILD
  );

  aerpCreateSecondaryButton_(
    sheet,
    'E17:G18',
    'Ver reporte',
    AERP_ICONS.REPORT
  );

  aerpCreateSection_(
    sheet,
    'A21:H22',
    'Estados oficiales'
  );

  aerpCreateStatusBanner_(
    sheet,
    'A24:B26',
    'SUCCESS'
  );

  aerpCreateStatusBanner_(
    sheet,
    'C24:D26',
    'RUNNING'
  );

  aerpCreateStatusBanner_(
    sheet,
    'E24:F26',
    'WARNING'
  );

  aerpCreateStatusBanner_(
    sheet,
    'G24:H26',
    'ERROR'
  );

  aerpCreateFooter_(
    sheet,
    'A31:H33'
  );

  const versionRange =
    aerpUiMergeRange_(
      sheet,
      'A35:H36'
    );

  versionRange
    .setValue(
      'Alef UI Kit 1.0 | ' +
      aerpCreateBuildId_()
    )
    .setFontColor(
      AERP_THEME.COLORS.TEXT_MUTED
    )
    .setFontFamily(
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontSize(
      AERP_TYPOGRAPHY.SIZES.CAPTION
    )
    .setHorizontalAlignment('center');

  SpreadsheetApp.flush();

  return {
    ok: true,
    sheet: 'AERP_UI_COMPONENTS',
    components: 10,
    designSystem:
      AERP_BRAND
        .DESIGN_SYSTEM_VERSION
  };
}


/**
 * Ejecuta prueba técnica y visual.
 */
function testUIComponentsPreview() {
  const technical =
    testUIComponents();

  const preview =
    demoUIComponents();

  const result = {
    ok:
      technical.ok &&
      preview.ok,

    technical:
      technical,

    preview:
      preview
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  if (!result.ok) {
    throw new Error(
      'La previsualización del UI Kit falló.'
    );
  }

  Logger.log(
    'UI Components Preview OK'
  );

  return result;
}
/**
 * Valida la conexión entre AERP-026 y AERP-027.
 *
 * @return {Object} Resultado de integración.
 */
function testAerpUiComponentsIntegration() {
  const result = {
    ok: false,
    module: 'AERP-026',
    phase: 'Enterprise Factory Integration',
    tests: {
      themeAvailable: false,
      factoryAvailable: false,
      kpiDefinitionCreated: false,
      presetResolved: false,
      typographyResolved: false
    },
    errors: []
  };

  try {
    const theme =
      aerpUiGetEnterpriseTheme_();

    result.tests.themeAvailable =
      Boolean(
        theme &&
        theme.colors &&
        theme.typography
      );

    result.tests.factoryAvailable =
      typeof aerpCreateComponent ===
      'function';

    const kpi =
      aerpUiCreateDefinition_(
        'card',
        'kpi',
        {
          id: 'integration-test-kpi',
          title: 'Ventas',
          value: '€58.240'
        }
      );

    result.tests.kpiDefinitionCreated =
      kpi.component === 'card' &&
      kpi.variant === 'kpi';

    result.tests.presetResolved =
      Boolean(
        kpi.preset &&
        kpi.preset.container &&
        kpi.preset.value
      );

    result.tests.typographyResolved =
      Number(
        kpi.preset
          .value
          .typography
          .fontSize
      ) > 0;

  } catch (error) {
    result.errors.push(
      error && error.message
        ? error.message
        : String(error)
    );
  }

  const testValues =
    Object.keys(
      result.tests
    ).map(function(testName) {
      return result.tests[testName];
    });

  result.ok =
    result.errors.length === 0 &&
    testValues.every(function(value) {
      return value === true;
    });

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}
/**
 * Valida el renderizado Enterprise de la KPI Card.
 *
 * Crea una hoja temporal de prueba.
 *
 * @return {Object} Resultado de la prueba.
 */
function testAerpKpiCardEnterprise() {
  const result = {
    ok: false,
    module: 'AERP-026',
    component: 'card.kpi',
    phase: 'Enterprise KPI Refactor',

    tests: {
      sheetCreated: false,
      rangeCreated: false,
      contentRendered: false,
      backgroundApplied: false,
      borderApplied: false,
      typographyApplied: false,
      customOptionsApplied: false
    },

    sheet: null,
    errors: []
  };

  try {
    const ss =
      aerpGetSpreadsheet();

    const sheetName =
      'AERP_TEST_KPI';

    const previousSheet =
      ss.getSheetByName(
        sheetName
      );

    if (previousSheet) {
      ss.deleteSheet(
        previousSheet
      );

      SpreadsheetApp.flush();
    }

    const sheet =
      ss.insertSheet(
        sheetName
      );

    result.sheet =
      sheetName;

    result.tests.sheetCreated =
      Boolean(sheet);

    const range =
      aerpCreateKpiCard_(
        sheet,
        'A1:D5',
        '📊',
        'VENTAS DEL MES',
        '€58.240',
        {
          subtitle:
            'Facturación acumulada',

          borderWidth: 2
        }
      );

    SpreadsheetApp.flush();

    result.tests.rangeCreated =
      Boolean(range);

    const renderedValue =
      range.getDisplayValue();

    result.tests.contentRendered =
      renderedValue.indexOf(
        'VENTAS DEL MES'
      ) !== -1 &&
      renderedValue.indexOf(
        '€58.240'
      ) !== -1 &&
      renderedValue.indexOf(
        'Facturación acumulada'
      ) !== -1;

    const component =
      aerpUiCreateDefinition_(
        'card',
        'kpi',
        {}
      );

    result.tests.backgroundApplied =
      range.getBackground() ===
      component.preset
        .container
        .background;

    result.tests.borderApplied =
      Boolean(
        component.preset
          .container
          .borderColor
      );

    result.tests.typographyApplied =
      range.getFontSize() ===
      component.preset
        .value
        .typography
        .fontSize;

    const customRange =
      aerpCreateKpiCard_(
        sheet,
        'F1:I5',
        '📦',
        'INVENTARIO',
        '1.248',
        {
          background: '#FFFFFF',
          textColor: '#0F172A',
          fontSize: 18
        }
      );

    SpreadsheetApp.flush();

    result.tests.customOptionsApplied =
      customRange.getBackground() ===
        '#FFFFFF' &&
      customRange.getFontColor() ===
        '#0F172A' &&
      customRange.getFontSize() ===
        18;

  } catch (error) {
    result.errors.push(
      error && error.message
        ? error.message
        : String(error)
    );
  }

  const testValues =
    Object.keys(
      result.tests
    ).map(function(testName) {
      return result.tests[testName];
    });

  result.ok =
    result.errors.length === 0 &&
    testValues.every(function(value) {
      return value === true;
    });

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}

