/**
 * ==========================================================
 * ALEF ERP
 * Launch Edition 1.0
 *
 * Módulo: Product Branding
 * ID: AERP-025
 * Autor: Alef Engineering
 * Design System: Alef Design System 1.0
 * Estado: Release Candidate
 * ==========================================================
 *
 * Núcleo visual oficial del ecosistema Alef.
 *
 * Este módulo centraliza:
 * - Identidad de marca.
 * - Activos visuales.
 * - Paleta corporativa.
 * - Tipografía.
 * - Iconografía.
 * - Sistema de layout.
 * - Voz del producto.
 * - Secuencia de lanzamiento.
 *
 * Ningún módulo visual debe definir colores, textos,
 * iconos o recursos corporativos por separado.
 * ==========================================================
 */


/* ==========================================================
 * 1. IDENTIDAD DEL ECOSISTEMA Y DEL PRODUCTO
 * ==========================================================
 */

const AERP_BRAND = Object.freeze({

  /* --------------------------------------------------------
   * Ecosistema
   * --------------------------------------------------------
   */

  ECOSYSTEM: 'Alef',

  COMPANY: 'Alef Advertising',

  ENGINEERING_SIGNATURE: 'Alef Engineering',

  /* --------------------------------------------------------
   * Producto
   * --------------------------------------------------------
   */

  PRODUCT: 'Alef ERP',

  PRODUCT_CODE: 'AERP',

  EDITION: 'Launch Edition 1.0',

  VERSION: '1.0.0',

  DESIGN_SYSTEM_VERSION: '1.0',

  ENGINE_NAME: 'Metadata Engine 3.0',

  /* --------------------------------------------------------
   * Mensajes de marca
   * --------------------------------------------------------
   */

  TAGLINE:
    'Metadata Driven. Business Ready.',

  SECONDARY_TAGLINE:
    'From Metadata to Business.',

  PRESENTATION_TAGLINE:
    'Build once. Scale forever.',

  POWERED_BY:
    'Powered by Alef Engineering',

  COPYRIGHT:
    '© 2026 Alef Advertising. Todos los derechos reservados.',

  /* --------------------------------------------------------
   * Canales corporativos
   * --------------------------------------------------------
   */

  CONTACT: Object.freeze({
    WEBSITE:
      'https://alefadvertising.com',

    EMAIL:
      'rquintana@alefadvertising.com',

    INSTAGRAM:
      '@alefadvertising',

    LINKEDIN:
      '@alefadvertising'
  }),

  /* --------------------------------------------------------
   * Activos visuales
   *
   * Cada valor corresponde al ID de un archivo almacenado
   * en Google Drive.
   * --------------------------------------------------------
   */

  ASSETS: Object.freeze({

    LOGO_ISOTYPE:
      '1v2aRiUPMEh7WkU0EiuCDIH8WoC6F3mKO',

    LOGO_HORIZONTAL:
      '',

    LOGO_NEGATIVE:
      '',

    SPLASH_SCREEN:
      '',

    ICON_512:
      '',

    ICON_256:
      '',

    FAVICON:
      ''
  }),

  /* --------------------------------------------------------
   * Textos alternativos
   * --------------------------------------------------------
   */

  ALT_TEXT: Object.freeze({

    LOGO_ISOTYPE:
      'Isotipo oficial del ecosistema Alef',

    LOGO_HORIZONTAL:
      'Logotipo horizontal oficial de Alef',

    LOGO_NEGATIVE:
      'Logotipo blanco oficial de Alef',

    SPLASH_SCREEN:
      'Pantalla de lanzamiento de Alef ERP',

    ICON_512:
      'Icono de Alef ERP de 512 píxeles',

    ICON_256:
      'Icono de Alef ERP de 256 píxeles',

    FAVICON:
      'Favicon oficial de Alef ERP'
  }),

  /* --------------------------------------------------------
   * Personalidad
   * --------------------------------------------------------
   */

  PERSONALITY: Object.freeze([
    'Inteligente',
    'Elegante',
    'Preciso',
    'Confiable',
    'Moderno',
    'Simple',
    'Humano'
  ]),

  /* --------------------------------------------------------
   * Valores
   * --------------------------------------------------------
   */

  VALUES: Object.freeze([
    'Claridad',
    'Precisión',
    'Elegancia',
    'Innovación',
    'Escalabilidad',
    'Confianza',
    'Simplicidad'
  ])
});


/* ==========================================================
 * 2. REGISTRO OFICIAL DE ACTIVOS
 * ==========================================================
 *
 * Los demás módulos no deben utilizar directamente los IDs
 * almacenados en AERP_BRAND.ASSETS.
 *
 * Los recursos se consumirán mediante los helpers centrales
 * que añadiremos en la Entrega 2.
 * ==========================================================
 */

const AERP_ASSETS = Object.freeze({

  LOGO_ISOTYPE: Object.freeze({
    id:
      AERP_BRAND.ASSETS.LOGO_ISOTYPE,

    type:
      'IMAGE',

    altText:
      AERP_BRAND.ALT_TEXT.LOGO_ISOTYPE,

    recommendedWidth:
      68,

    recommendedHeight:
      68
  }),

  LOGO_HORIZONTAL: Object.freeze({
    id:
      AERP_BRAND.ASSETS.LOGO_HORIZONTAL,

    type:
      'IMAGE',

    altText:
      AERP_BRAND.ALT_TEXT.LOGO_HORIZONTAL,

    recommendedWidth:
      240,

    recommendedHeight:
      80
  }),

  LOGO_NEGATIVE: Object.freeze({
    id:
      AERP_BRAND.ASSETS.LOGO_NEGATIVE,

    type:
      'IMAGE',

    altText:
      AERP_BRAND.ALT_TEXT.LOGO_NEGATIVE,

    recommendedWidth:
      240,

    recommendedHeight:
      80
  }),

  SPLASH_SCREEN: Object.freeze({
    id:
      AERP_BRAND.ASSETS.SPLASH_SCREEN,

    type:
      'IMAGE',

    altText:
      AERP_BRAND.ALT_TEXT.SPLASH_SCREEN,

    recommendedWidth:
      600,

    recommendedHeight:
      340
  }),

  ICON_512: Object.freeze({
    id:
      AERP_BRAND.ASSETS.ICON_512,

    type:
      'IMAGE',

    altText:
      AERP_BRAND.ALT_TEXT.ICON_512,

    recommendedWidth:
      512,

    recommendedHeight:
      512
  }),

  ICON_256: Object.freeze({
    id:
      AERP_BRAND.ASSETS.ICON_256,

    type:
      'IMAGE',

    altText:
      AERP_BRAND.ALT_TEXT.ICON_256,

    recommendedWidth:
      256,

    recommendedHeight:
      256
  }),

  FAVICON: Object.freeze({
    id:
      AERP_BRAND.ASSETS.FAVICON,

    type:
      'IMAGE',

    altText:
      AERP_BRAND.ALT_TEXT.FAVICON,

    recommendedWidth:
      64,

    recommendedHeight:
      64
  })
});


/* ==========================================================
 * 3. PALETA VISUAL OFICIAL
 * ==========================================================
 */

const AERP_THEME = Object.freeze({

  COLORS: Object.freeze({

    /* Marca principal */

    BLACK:
      '#161616',

    CHARCOAL:
      '#2F343B',

    WHITE:
      '#FFFFFF',

    ALEF_BLUE:
      '#38BDF8',

    DEEP_BLUE:
      '#0F4C81',

    /* Estados */

    SUCCESS:
      '#2E8B57',

    WARNING:
      '#F4B400',

    ERROR:
      '#D93025',

    INFO:
      '#38BDF8',

    RUNNING:
      '#0F4C81',

    /* Superficies */

    BACKGROUND:
      '#F5F7FA',

    SURFACE:
      '#FFFFFF',

    SURFACE_ALT:
      '#E8EFEA',

    SURFACE_DARK:
      '#161616',

    /* Texto */

    TEXT_PRIMARY:
      '#161616',

    TEXT_SECONDARY:
      '#5F6368',

    TEXT_INVERSE:
      '#FFFFFF',

    TEXT_MUTED:
      '#7B8794',

    /* Bordes y estados pasivos */

    BORDER:
      '#D9E1E8',

    BORDER_STRONG:
      '#AAB2BD',

    DISABLED:
      '#AAB2BD',

    TRANSPARENT:
      'transparent'
  }),

  STATUS: Object.freeze({

    SUCCESS: Object.freeze({
      background:
        '#2E8B57',

      text:
        '#FFFFFF',

      icon:
        '✅',

      label:
        'BUILD EXITOSO'
    }),

    WARNING: Object.freeze({
      background:
        '#F4B400',

      text:
        '#161616',

      icon:
        '⚠️',

      label:
        'REVISIÓN NECESARIA'
    }),

    ERROR: Object.freeze({
      background:
        '#D93025',

      text:
        '#FFFFFF',

      icon:
        '❌',

      label:
        'BUILD CON ERRORES'
    }),

    RUNNING: Object.freeze({
      background:
        '#0F4C81',

      text:
        '#FFFFFF',

      icon:
        '⏳',

      label:
        'GENERANDO'
    }),

    INFO: Object.freeze({
      background:
        '#38BDF8',

      text:
        '#161616',

      icon:
        'ℹ️',

      label:
        'INFORMACIÓN'
    })
  })
});


/* ==========================================================
 * 4. TIPOGRAFÍA OFICIAL
 * ==========================================================
 */

const AERP_TYPOGRAPHY = Object.freeze({

  FAMILY:
    'Roboto',

  FAMILY_FALLBACK:
    'Arial',

  CODE_FAMILY:
    'Roboto Mono',

  SIZES: Object.freeze({

    DISPLAY:
      26,

    TITLE:
      22,

    SUBTITLE:
      14,

    SECTION:
      13,

    BODY:
      11,

    CAPTION:
      9,

    KPI:
      20,

    BUTTON:
      11
  }),

  WEIGHTS: Object.freeze({

    REGULAR:
      'normal',

    MEDIUM:
      'bold',

    BOLD:
      'bold'
  })
});


/* ==========================================================
 * 5. ICONOGRAFÍA OFICIAL
 * ==========================================================
 */

const AERP_ICONS = Object.freeze({

  /* Identidad */

  BRAND:
    '◉',

  BUILD:
    '🚀',

  ENGINE:
    '⚙️',

  METADATA:
    '🧠',

  PACKAGE:
    '📦',

  DASHBOARD:
    '📊',

  REPORT:
    '📋',

  MODULE:
    '📁',

  SECURITY:
    '🛡️',

  AI:
    '🤖',

  /* Objetos */

  TABLE:
    '📋',

  COLUMN:
    '🧩',

  FORM:
    '📝',

  VIEW:
    '👁️',

  MENU:
    '🧭',

  TIME:
    '⏱️',

  COMPANY:
    '🏢',

  USER:
    '👤',

  SETTINGS:
    '⚙️',

  /* Estados */

  SUCCESS:
    '✅',

  WARNING:
    '⚠️',

  ERROR:
    '❌',

  INFO:
    'ℹ️',

  RUNNING:
    '⏳',

  SPARKLE:
    '✨',

  READY:
    '🟢'
});


/* ==========================================================
 * 6. SISTEMA DE LAYOUT Y ESPACIADO
 * ==========================================================
 */

const AERP_LAYOUT = Object.freeze({

  DASHBOARD_COLUMNS:
    8,

  STANDARD_COLUMN_WIDTH:
    115,

  REPORT_COLUMN_WIDTH:
    110,

  ROW_HEIGHT: Object.freeze({

    COMPACT:
      24,

    STANDARD:
      30,

    LARGE:
      36,

    HERO:
      44,

    SPLASH:
      52
  }),

  SPACING: Object.freeze({

    XS:
      4,

    SM:
      8,

    MD:
      16,

    LG:
      24,

    XL:
      32,

    XXL:
      48
  }),

  DASHBOARD: Object.freeze({

    VISIBLE_RANGE:
      'A1:H28',

    HEADER:
      'A1:H3',

    SUBHEADER:
      'A4:H4',

    STATUS:
      'A6:H7',

    FOOTER:
      'A24:H26'
  }),

  BUILD_REPORT: Object.freeze({

    VISIBLE_RANGE:
      'A1:H42',

    HEADER:
      'A1:H3',

    SUBHEADER:
      'A4:H4',

    STATUS:
      'A6:H8',

    FOOTER:
      'A38:H40'
  }),

  LAUNCH_SCREEN: Object.freeze({

    VISIBLE_RANGE:
      'A1:H30',

    HEADER:
      'A1:H5',

    PROGRESS:
      'A9:H20',

    STATUS:
      'A22:H24',

    FOOTER:
      'A27:H29'
  })
});


/* ==========================================================
 * 7. VOZ OFICIAL DEL PRODUCTO
 * ==========================================================
 */

const AERP_COPY = Object.freeze({

  BUILD: Object.freeze({

    START:
      'Preparando el motor de generación...',

    SUCCESS:
      'Tu ERP está listo. Ya puedes continuar con el siguiente paso.',

    READY:
      'Todo está listo. Tu ERP acaba de cobrar vida.',

    FAILURE:
      'No pudimos completar el Build. Revisa el reporte para identificar el paso que requiere atención.'
  }),

  METADATA: Object.freeze({

    START:
      'Analizando la estructura y sincronizando la metadata.',

    SUCCESS:
      'La metadata se sincronizó correctamente.',

    FAILURE:
      'No pudimos completar la sincronización de metadata.'
  }),

  INSTALLATION: Object.freeze({

    START:
      'Verificando la instalación de Alef ERP.',

    SUCCESS:
      'La instalación de Alef ERP está lista.',

    FAILURE:
      'La instalación requiere atención antes de continuar.'
  }),

  PACKAGE: Object.freeze({

    START:
      'Construyendo el paquete de la aplicación.',

    SUCCESS:
      'El paquete de la aplicación está listo.',

    FAILURE:
      'No pudimos completar el paquete de la aplicación.'
  }),

  DEPLOYMENT: Object.freeze({

    START:
      'Registrando el resultado del Build.',

    SUCCESS:
      'El Deployment se registró correctamente.',

    FAILURE:
      'No pudimos registrar el Deployment.'
  }),

  GENERIC: Object.freeze({

    SUCCESS:
      'La operación se completó correctamente.',

    FAILURE:
      'No pudimos completar esta operación.',

    NEXT_STEP:
      'Revisa la información mostrada y continúa con el siguiente paso.',

    RETRY:
      'Vuelve a intentarlo después de revisar la información disponible.'
  })
});


/* ==========================================================
 * 8. SECUENCIA OFICIAL DE LANZAMIENTO
 * ==========================================================
 */

const AERP_LAUNCH_SEQUENCE = Object.freeze([

  Object.freeze({
    id:
      'INITIALIZE',

    order:
      1,

    icon:
      AERP_ICONS.BUILD,

    label:
      'Inicializando Build',

    message:
      'Preparando el motor de generación.'
  }),

  Object.freeze({
    id:
      'FRAMEWORK',

    order:
      2,

    icon:
      AERP_ICONS.ENGINE,

    label:
      'Verificando Framework',

    message:
      'Comprobando la arquitectura y la instalación.'
  }),

  Object.freeze({
    id:
      'METADATA',

    order:
      3,

    icon:
      AERP_ICONS.METADATA,

    label:
      'Analizando Metadata',

    message:
      'Leyendo la fuente oficial de verdad del ERP.'
  }),

  Object.freeze({
    id:
      'COMPONENTS',

    order:
      4,

    icon:
      AERP_ICONS.MODULE,

    label:
      'Construyendo Componentes',

    message:
      'Preparando formularios, vistas y menús.'
  }),

  Object.freeze({
    id:
      'APPSHEET',

    order:
      5,

    icon:
      AERP_ICONS.PACKAGE,

    label:
      'Generando AppSheet Package',

    message:
      'Construyendo el paquete de la aplicación.'
  }),

  Object.freeze({
    id:
      'DEPLOYMENT',

    order:
      6,

    icon:
      AERP_ICONS.BUILD,

    label:
      'Registrando Deployment',

    message:
      'Guardando el resultado y la trazabilidad del Build.'
  }),

  Object.freeze({
    id:
      'DASHBOARD',

    order:
      7,

    icon:
      AERP_ICONS.DASHBOARD,

    label:
      'Actualizando Dashboard',

    message:
      'Preparando el resumen visual de la generación.'
  }),

  Object.freeze({
    id:
      'REPORT',

    order:
      8,

    icon:
      AERP_ICONS.REPORT,

    label:
      'Generando Build Report',

    message:
      'Documentando automáticamente el resultado.'
  }),

  Object.freeze({
    id:
      'COMPLETE',

    order:
      9,

    icon:
      AERP_ICONS.SUCCESS,

    label:
      'Build finalizado',

    message:
      AERP_COPY.BUILD.READY
  })
]);
/* ==========================================================
 * 9. HELPERS DE IDENTIDAD
 * ==========================================================
 */

/**
 * Devuelve el nombre completo del producto.
 */
function aerpBrandProductName_() {
  return (
    AERP_BRAND.PRODUCT +
    ' | ' +
    AERP_BRAND.EDITION
  );
}


/**
 * Devuelve el encabezado institucional.
 */
function aerpBrandHeaderText_() {
  return AERP_BRAND.PRODUCT;
}


/**
 * Devuelve el tagline principal.
 */
function aerpBrandTagline_() {
  return AERP_BRAND.TAGLINE;
}


/**
 * Devuelve el pie institucional.
 */
function aerpBrandFooterText_() {
  return AERP_BRAND.POWERED_BY;
}


/**
 * Devuelve un identificador único del Build.
 *
 * Ejemplo:
 * AERP-20260711-103512
 */
function aerpCreateBuildId_() {
  const timezone =
    Session.getScriptTimeZone() ||
    'Europe/Madrid';

  return (
    AERP_BRAND.PRODUCT_CODE +
    '-' +
    Utilities.formatDate(
      new Date(),
      timezone,
      'yyyyMMdd-HHmmss'
    )
  );
}


/**
 * Devuelve información resumida de la marca.
 */
function aerpGetBrandSummary_() {
  return {
    ecosystem:
      AERP_BRAND.ECOSYSTEM,

    company:
      AERP_BRAND.COMPANY,

    product:
      AERP_BRAND.PRODUCT,

    edition:
      AERP_BRAND.EDITION,

    version:
      AERP_BRAND.VERSION,

    tagline:
      AERP_BRAND.TAGLINE,

    engine:
      AERP_BRAND.ENGINE_NAME,

    designSystemVersion:
      AERP_BRAND.DESIGN_SYSTEM_VERSION
  };
}


/* ==========================================================
 * 10. HELPERS DE ACTIVOS VISUALES
 * ==========================================================
 */

/**
 * Devuelve la configuración de un activo.
 */
function aerpGetBrandAsset_(assetName) {
  const normalizedName =
    String(assetName || '')
      .trim()
      .toUpperCase();

  const asset =
    AERP_ASSETS[normalizedName];

  if (!asset) {
    throw new Error(
      'El activo de marca "' +
      normalizedName +
      '" no está registrado.'
    );
  }

  return asset;
}


/**
 * Comprueba si un activo tiene un archivo configurado.
 */
function aerpHasBrandAsset_(assetName) {
  try {
    const asset =
      aerpGetBrandAsset_(assetName);

    return Boolean(
      asset &&
      String(asset.id || '').trim()
    );

  } catch (error) {
    return false;
  }
}


/**
 * Obtiene el archivo de Google Drive asociado.
 */
function aerpGetBrandAssetFile_(assetName) {
  const asset =
    aerpGetBrandAsset_(assetName);

  const fileId =
    String(asset.id || '').trim();

  if (!fileId) {
    throw new Error(
      'El activo "' +
      assetName +
      '" todavía no tiene un archivo configurado.'
    );
  }

  return DriveApp.getFileById(fileId);
}


/**
 * Obtiene el blob de un activo visual.
 */
function aerpGetBrandAssetBlob_(assetName) {
  return aerpGetBrandAssetFile_(assetName)
    .getBlob();
}


/**
 * Inserta un activo registrado en una hoja.
 */
function aerpInsertBrandAsset_(
  sheet,
  assetName,
  anchorColumn,
  anchorRow,
  width,
  height
) {
  if (!sheet) {
    throw new Error(
      'No se recibió una hoja para insertar el activo.'
    );
  }

  const asset =
    aerpGetBrandAsset_(assetName);

  const blob =
    aerpGetBrandAssetBlob_(assetName);

  const image =
    sheet.insertImage(
      blob,
      Number(anchorColumn || 1),
      Number(anchorRow || 1)
    );

  image
    .setWidth(
      Number(
        width ||
        asset.recommendedWidth ||
        72
      )
    )
    .setHeight(
      Number(
        height ||
        asset.recommendedHeight ||
        72
      )
    )
    .setAltTextDescription(
      asset.altText || assetName
    );

  return image;
}


/**
 * Elimina de una hoja las imágenes registradas
 * como activos oficiales de Alef.
 */
function aerpRemoveBrandAssetsFromSheet_(sheet) {
  if (!sheet) {
    return;
  }

  const registeredAltTexts =
    Object.keys(AERP_ASSETS)
      .map(function(key) {
        return AERP_ASSETS[key].altText;
      });

  sheet.getImages().forEach(function(image) {
    const altText =
      String(
        image.getAltTextDescription() || ''
      );

    if (
      registeredAltTexts.indexOf(altText) !== -1
    ) {
      image.remove();
    }
  });
}


/**
 * Inserta el isotipo oficial de Alef.
 */
function aerpInsertAlefLogo_(
  sheet,
  anchorColumn,
  anchorRow,
  width,
  height
) {
  aerpRemoveBrandAssetsFromSheet_(sheet);

  const image =
    aerpInsertBrandAsset_(
      sheet,
      'LOGO_ISOTYPE',
      anchorColumn || 1,
      anchorRow || 1,
      width || 68,
      height || 68
    );

  image
    .setAnchorCellXOffset(12)
    .setAnchorCellYOffset(4);

  return image;
}


/* ==========================================================
 * 11. HELPERS DE PREPARACIÓN DE HOJAS
 * ==========================================================
 */

/**
 * Garantiza que una hoja tenga las dimensiones necesarias.
 */
function aerpEnsureSheetSize_(
  sheet,
  requiredRows,
  requiredColumns
) {
  if (!sheet) {
    throw new Error(
      'No se recibió una hoja para verificar dimensiones.'
    );
  }

  const rows =
    Number(requiredRows || 1);

  const columns =
    Number(requiredColumns || 1);

  if (sheet.getMaxRows() < rows) {
    sheet.insertRowsAfter(
      sheet.getMaxRows(),
      rows - sheet.getMaxRows()
    );
  }

  if (sheet.getMaxColumns() < columns) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      columns - sheet.getMaxColumns()
    );
  }

  return sheet;
}


/**
 * Oculta columnas y filas fuera del área visual.
 */
function aerpConstrainSheetView_(
  sheet,
  visibleRows,
  visibleColumns
) {
  if (!sheet) {
    throw new Error(
      'No se recibió una hoja para limitar la vista.'
    );
  }

  const rows =
    Number(visibleRows || 30);

  const columns =
    Number(visibleColumns || 8);

  aerpEnsureSheetSize_(
    sheet,
    rows,
    columns
  );

  const maxColumns =
    sheet.getMaxColumns();

  if (maxColumns > columns) {
    sheet.hideColumns(
      columns + 1,
      maxColumns - columns
    );
  }

  const maxRows =
    sheet.getMaxRows();

  if (maxRows > rows) {
    sheet.hideRows(
      rows + 1,
      maxRows - rows
    );
  }

  return sheet;
}


/**
 * Restaura la visibilidad completa de una hoja.
 */
function aerpRestoreSheetView_(sheet) {
  if (!sheet) {
    return;
  }

  try {
    sheet.showColumns(
      1,
      sheet.getMaxColumns()
    );
  } catch (error) {
    // No requiere acción.
  }

  try {
    sheet.showRows(
      1,
      sheet.getMaxRows()
    );
  } catch (error) {
    // No requiere acción.
  }
}


/**
 * Limpia de forma segura un área visual.
 */
function aerpClearVisualRange_(
  sheet,
  rangeA1
) {
  if (!sheet) {
    throw new Error(
      'No se recibió una hoja para limpiar.'
    );
  }

  const range =
    sheet.getRange(rangeA1);

  range.breakApart();
  range.clear();

  return range;
}


/* ==========================================================
 * 12. HELPERS DE TEMA
 * ==========================================================
 */

/**
 * Aplica la apariencia base de Alef.
 */
function aerpApplyAlefTheme_(
  sheet,
  rangeA1
) {
  if (!sheet) {
    throw new Error(
      'No se recibió una hoja para aplicar el tema Alef.'
    );
  }

  const targetRange =
    sheet.getRange(
      rangeA1 ||
      AERP_LAYOUT.DASHBOARD.VISIBLE_RANGE
    );

  sheet.setHiddenGridlines(true);

  targetRange
    .setFontFamily(
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontColor(
      AERP_THEME.COLORS.TEXT_PRIMARY
    )
    .setBackground(
      AERP_THEME.COLORS.SURFACE
    )
    .setVerticalAlignment('middle');

  return sheet;
}


/**
 * Aplica el encabezado oficial.
 */
function aerpApplyAlefHeader_(
  sheet,
  rangeA1,
  title,
  subtitle
) {
  const range =
    sheet.getRange(rangeA1);

  range.merge();

  range
    .setValue(
      title ||
      aerpBrandHeaderText_()
    )
    .setBackground(
      AERP_THEME.COLORS.BLACK
    )
    .setFontColor(
      AERP_THEME.COLORS.TEXT_INVERSE
    )
    .setFontFamily(
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontSize(
      AERP_TYPOGRAPHY.SIZES.TITLE
    )
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  if (subtitle) {
    range.setNote(subtitle);
  }

  return range;
}


/**
 * Aplica un subtítulo institucional.
 */
function aerpApplyAlefSubheader_(
  sheet,
  rangeA1,
  text
) {
  const range =
    sheet.getRange(rangeA1);

  range.merge();

  range
    .setValue(
      text ||
      aerpBrandTagline_()
    )
    .setBackground(
      AERP_THEME.COLORS.DEEP_BLUE
    )
    .setFontColor(
      AERP_THEME.COLORS.TEXT_INVERSE
    )
    .setFontFamily(
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontSize(
      AERP_TYPOGRAPHY.SIZES.SUBTITLE
    )
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  return range;
}


/**
 * Aplica una banda de estado.
 */
function aerpApplyAlefStatus_(
  sheet,
  rangeA1,
  status,
  text
) {
  const normalizedStatus =
    String(status || 'SUCCESS')
      .trim()
      .toUpperCase();

  const statusTheme =
    AERP_THEME.STATUS[normalizedStatus] ||
    AERP_THEME.STATUS.SUCCESS;

  const range =
    sheet.getRange(rangeA1);

  range.merge();

  range
    .setValue(
      text ||
      (
        statusTheme.icon +
        ' ' +
        statusTheme.label
      )
    )
    .setBackground(
      statusTheme.background
    )
    .setFontColor(
      statusTheme.text
    )
    .setFontFamily(
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontSize(
      AERP_TYPOGRAPHY.SIZES.SUBTITLE
    )
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  return range;
}


/**
 * Construye una tarjeta KPI oficial.
 */
function aerpApplyAlefKpiCard_(
  sheet,
  rangeA1,
  icon,
  title,
  value
) {
  const range =
    sheet.getRange(rangeA1);

  range.merge();

  const displayIcon =
    icon || AERP_ICONS.INFO;

  range
    .setValue(
      displayIcon +
      ' ' +
      String(title || '') +
      '\n\n' +
      String(
        value === undefined
          ? ''
          : value
      )
    )
    .setBackground(
      AERP_THEME.COLORS.BACKGROUND
    )
    .setFontColor(
      AERP_THEME.COLORS.TEXT_PRIMARY
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

  range.setBorder(
    true,
    true,
    true,
    true,
    false,
    false,
    AERP_THEME.COLORS.BORDER,
    SpreadsheetApp.BorderStyle.SOLID
  );

  return range;
}


/**
 * Aplica el pie institucional oficial.
 */
function aerpApplyAlefFooter_(
  sheet,
  rangeA1,
  text
) {
  const range =
    sheet.getRange(rangeA1);

  range.merge();

  range
    .setValue(
      text ||
      aerpBrandFooterText_()
    )
    .setBackground(
      AERP_THEME.COLORS.BLACK
    )
    .setFontColor(
      AERP_THEME.COLORS.TEXT_INVERSE
    )
    .setFontFamily(
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontSize(
      AERP_TYPOGRAPHY.SIZES.CAPTION
    )
    .setFontStyle('italic')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  return range;
}


/**
 * Aplica una sección informativa.
 */
function aerpApplyAlefSection_(
  sheet,
  rangeA1,
  title
) {
  const range =
    sheet.getRange(rangeA1);

  range.merge();

  range
    .setValue(
      String(title || '')
    )
    .setBackground(
      AERP_THEME.COLORS.SURFACE_ALT
    )
    .setFontColor(
      AERP_THEME.COLORS.TEXT_PRIMARY
    )
    .setFontFamily(
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontSize(
      AERP_TYPOGRAPHY.SIZES.SECTION
    )
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  return range;
}


/* ==========================================================
 * 13. HELPERS DE MENSAJES
 * ==========================================================
 */

/**
 * Construye el mensaje final de éxito.
 */
function aerpBrandBuildSuccessMessage_(
  summary
) {
  const data =
    summary || {};

  return [
    AERP_ICONS.SUCCESS +
      ' ' +
      AERP_COPY.BUILD.READY,

    '',

    AERP_ICONS.TABLE +
      ' Tablas: ' +
      Number(data.tables || 0),

    AERP_ICONS.COLUMN +
      ' Columnas: ' +
      Number(data.columns || 0),

    AERP_ICONS.FORM +
      ' Formularios: ' +
      Number(data.forms || 0),

    AERP_ICONS.VIEW +
      ' Vistas: ' +
      Number(data.views || 0),

    AERP_ICONS.MENU +
      ' Menús: ' +
      Number(data.menus || 0),

    AERP_ICONS.TIME +
      ' Duración: ' +
      aerpFormatDuration_(
        Number(data.durationMs || 0)
      ),

    '',

    AERP_BRAND.TAGLINE
  ].join('\n');
}


/**
 * Construye el mensaje oficial de error.
 */
function aerpBrandErrorMessage_(error) {
  const technicalMessage =
    error && error.message
      ? error.message
      : String(error || '');

  return [
    AERP_COPY.BUILD.FAILURE,
    '',
    technicalMessage,
    '',
    'Revisa AERP_BUILD y AERP_BUILD_REPORT para continuar.'
  ].join('\n');
}


/**
 * Construye un mensaje informativo genérico.
 */
function aerpBrandInfoMessage_(
  title,
  message
) {
  return [
    AERP_ICONS.INFO +
      ' ' +
      String(title || 'Información'),

    '',

    String(message || '')
  ].join('\n');
}


/* ==========================================================
 * 14. HELPERS DE PROGRESO
 * ==========================================================
 */

/**
 * Devuelve un paso de la secuencia oficial.
 */
function aerpGetLaunchStep_(stepId) {
  const normalizedId =
    String(stepId || '')
      .trim()
      .toUpperCase();

  const step =
    AERP_LAUNCH_SEQUENCE.find(
      function(item) {
        return item.id === normalizedId;
      }
    );

  if (!step) {
    throw new Error(
      'El paso de lanzamiento "' +
      normalizedId +
      '" no existe.'
    );
  }

  return step;
}


/**
 * Construye una barra de progreso textual.
 */
function aerpBuildProgressBar_(
  current,
  total,
  width
) {
  const safeTotal =
    Math.max(
      Number(total || 1),
      1
    );

  const safeCurrent =
    Math.min(
      Math.max(
        Number(current || 0),
        0
      ),
      safeTotal
    );

  const barWidth =
    Math.max(
      Number(width || 20),
      5
    );

  const completed =
    Math.round(
      (
        safeCurrent /
        safeTotal
      ) *
      barWidth
    );

  const pending =
    barWidth - completed;

  const percentage =
    Math.round(
      (
        safeCurrent /
        safeTotal
      ) *
      100
    );

  return (
    '█'.repeat(completed) +
    '░'.repeat(pending) +
    ' ' +
    percentage +
    '%'
  );
}


/**
 * Devuelve la secuencia ordenada.
 */
function aerpGetLaunchSequence_() {
  return AERP_LAUNCH_SEQUENCE
    .slice()
    .sort(function(a, b) {
      return a.order - b.order;
    });
}
/* ==========================================================
 * 15. VALIDACIÓN DEL SISTEMA DE BRANDING
 * ==========================================================
 */

/**
 * Valida que la configuración esencial del Design System
 * esté disponible y sea consistente.
 */
function aerpValidateProductBranding_() {
  const errors = [];
  const warnings = [];

  const requiredBrandFields = [
    'ECOSYSTEM',
    'COMPANY',
    'PRODUCT',
    'PRODUCT_CODE',
    'EDITION',
    'VERSION',
    'TAGLINE',
    'DESIGN_SYSTEM_VERSION'
  ];

  requiredBrandFields.forEach(function(fieldName) {
    const value = AERP_BRAND[fieldName];

    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ''
    ) {
      errors.push(
        'Falta el campo de marca: ' +
        fieldName
      );
    }
  });

  const requiredColors = [
    'BLACK',
    'WHITE',
    'ALEF_BLUE',
    'DEEP_BLUE',
    'SUCCESS',
    'WARNING',
    'ERROR',
    'BACKGROUND',
    'SURFACE',
    'TEXT_PRIMARY',
    'TEXT_INVERSE',
    'BORDER'
  ];

  requiredColors.forEach(function(colorName) {
    if (!AERP_THEME.COLORS[colorName]) {
      errors.push(
        'Falta el color oficial: ' +
        colorName
      );
    }
  });

  const requiredIcons = [
    'BUILD',
    'ENGINE',
    'METADATA',
    'PACKAGE',
    'DASHBOARD',
    'REPORT',
    'TABLE',
    'COLUMN',
    'FORM',
    'VIEW',
    'MENU',
    'SUCCESS',
    'WARNING',
    'ERROR'
  ];

  requiredIcons.forEach(function(iconName) {
    if (!AERP_ICONS[iconName]) {
      errors.push(
        'Falta el icono oficial: ' +
        iconName
      );
    }
  });

  const requiredAssets = [
    'LOGO_ISOTYPE'
  ];

  requiredAssets.forEach(function(assetName) {
    if (!aerpHasBrandAsset_(assetName)) {
      errors.push(
        'El activo obligatorio no está configurado: ' +
        assetName
      );
    }
  });

  [
    'LOGO_HORIZONTAL',
    'LOGO_NEGATIVE',
    'SPLASH_SCREEN',
    'ICON_512',
    'ICON_256',
    'FAVICON'
  ].forEach(function(assetName) {
    if (!aerpHasBrandAsset_(assetName)) {
      warnings.push(
        'Activo preparado pero aún no configurado: ' +
        assetName
      );
    }
  });

  if (
    !AERP_LAUNCH_SEQUENCE ||
    AERP_LAUNCH_SEQUENCE.length === 0
  ) {
    errors.push(
      'La secuencia de lanzamiento está vacía.'
    );
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}


/**
 * Comprueba que el archivo del isotipo pueda leerse
 * correctamente desde Google Drive.
 */
function aerpValidateAlefLogoFile_() {
  try {
    const asset =
      aerpGetBrandAsset_(
        'LOGO_ISOTYPE'
      );

    const file =
      aerpGetBrandAssetFile_(
        'LOGO_ISOTYPE'
      );

    const blob =
      file.getBlob();

    const mimeType =
      String(
        blob.getContentType() || ''
      );

    const isImage =
      mimeType.indexOf('image/') === 0;

    return {
      ok: isImage,
      fileId: file.getId(),
      fileName: file.getName(),
      mimeType: mimeType,
      sizeBytes: blob.getBytes().length,
      altText: asset.altText,
      error: isImage
        ? ''
        : 'El archivo configurado no es una imagen.'
    };

  } catch (error) {
    return {
      ok: false,
      fileId: '',
      fileName: '',
      mimeType: '',
      sizeBytes: 0,
      altText: '',
      error:
        error && error.message
          ? error.message
          : String(error)
    };
  }
}


/* ==========================================================
 * 16. PRUEBA TÉCNICA COMPLETA
 * ==========================================================
 */

/**
 * Prueba técnica del núcleo visual.
 *
 * No crea hojas ni modifica el producto.
 */
function testProductBranding() {
  const validation =
    aerpValidateProductBranding_();

  const logoValidation =
    aerpValidateAlefLogoFile_();

  const brandSummary =
    aerpGetBrandSummary_();

  const launchSequence =
    aerpGetLaunchSequence_();

  const result = {
    ok:
      validation.ok &&
      logoValidation.ok,

    brand:
      brandSummary,

    assets: {
      registered:
        Object.keys(AERP_ASSETS).length,

      logoAvailable:
        logoValidation.ok,

      logoFileId:
        logoValidation.fileId,

      logoFileName:
        logoValidation.fileName,

      logoMimeType:
        logoValidation.mimeType,

      logoSizeBytes:
        logoValidation.sizeBytes
    },

    designSystem: {
      colors:
        Object.keys(
          AERP_THEME.COLORS
        ).length,

      statuses:
        Object.keys(
          AERP_THEME.STATUS
        ).length,

      icons:
        Object.keys(
          AERP_ICONS
        ).length,

      launchSteps:
        launchSequence.length,

      version:
        AERP_BRAND
          .DESIGN_SYSTEM_VERSION
    },

    sampleBuildId:
      aerpCreateBuildId_(),

    sampleProgress:
      aerpBuildProgressBar_(
        7,
        9,
        20
      ),

    warnings:
      validation.warnings,

    errors:
      validation.errors.concat(
        logoValidation.ok
          ? []
          : [
              'Logo: ' +
              logoValidation.error
            ]
      )
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
      'Product Branding incompleto: ' +
      result.errors.join(' | ')
    );
  }

  Logger.log(
    'Product Branding OK | ' +
    AERP_BRAND.PRODUCT +
    ' | ' +
    AERP_BRAND.TAGLINE
  );

  return result;
}


/* ==========================================================
 * 17. PREVISUALIZACIÓN OFICIAL
 * ==========================================================
 */

/**
 * Crea la hoja visual oficial del Alef Design System.
 */
function demoProductBranding() {
  const ss =
    aerpGetSpreadsheet();

  const sheetName =
    'AERP_BRAND_PREVIEW';

  const previousSheet =
    ss.getSheetByName(sheetName);

  if (previousSheet) {
    ss.deleteSheet(previousSheet);
    SpreadsheetApp.flush();
  }

  const sheet =
    ss.insertSheet(sheetName);

  const visibleRows = 28;
  const visibleColumns =
    AERP_LAYOUT.DASHBOARD_COLUMNS;

  aerpEnsureSheetSize_(
    sheet,
    visibleRows,
    visibleColumns
  );

  sheet.setColumnWidths(
    1,
    visibleColumns,
    AERP_LAYOUT
      .STANDARD_COLUMN_WIDTH
  );

  for (
    let row = 1;
    row <= visibleRows;
    row++
  ) {
    sheet.setRowHeight(
      row,
      AERP_LAYOUT
        .ROW_HEIGHT
        .STANDARD
    );
  }

  sheet.setRowHeights(
    1,
    3,
    AERP_LAYOUT
      .ROW_HEIGHT
      .HERO
  );

  aerpConstrainSheetView_(
    sheet,
    visibleRows,
    visibleColumns
  );

  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(4);

  aerpApplyAlefTheme_(
    sheet,
    'A1:H28'
  );

  /*
   * Encabezado con logotipo real.
   */

  const logoArea =
    sheet.getRange('A1:B3');

  logoArea.merge()
    .setBackground(
      AERP_THEME.COLORS.BLACK
    );

  const titleArea =
    sheet.getRange('C1:H3');

  titleArea.merge()
    .setValue(
      AERP_BRAND.PRODUCT
    )
    .setBackground(
      AERP_THEME.COLORS.BLACK
    )
    .setFontColor(
      AERP_THEME.COLORS.TEXT_INVERSE
    )
    .setFontFamily(
      AERP_TYPOGRAPHY.FAMILY
    )
    .setFontSize(
      AERP_TYPOGRAPHY.SIZES.TITLE
    )
    .setFontWeight('bold')
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle');

  aerpInsertAlefLogo_(
    sheet,
    1,
    1,
    68,
    68
  );

  aerpApplyAlefSubheader_(
    sheet,
    'A4:H4',
    AERP_BRAND.TAGLINE
  );

  aerpApplyAlefStatus_(
    sheet,
    'A6:H7',
    'SUCCESS',
    AERP_ICONS.SUCCESS +
      ' BUILD EXITOSO'
  );

  /*
   * Tarjetas del Design System.
   */

  aerpApplyAlefKpiCard_(
    sheet,
    'A9:B12',
    AERP_ICONS.TABLE,
    'TABLAS',
    23
  );

  aerpApplyAlefKpiCard_(
    sheet,
    'C9:D12',
    AERP_ICONS.COLUMN,
    'COLUMNAS',
    276
  );

  aerpApplyAlefKpiCard_(
    sheet,
    'E9:F12',
    AERP_ICONS.FORM,
    'FORMULARIOS',
    23
  );

  aerpApplyAlefKpiCard_(
    sheet,
    'G9:H12',
    AERP_ICONS.VIEW,
    'VISTAS',
    23
  );

  aerpApplyAlefKpiCard_(
    sheet,
    'A14:B17',
    AERP_ICONS.MENU,
    'MENÚS',
    23
  );

  aerpApplyAlefKpiCard_(
    sheet,
    'C14:D17',
    AERP_ICONS.WARNING,
    'ADVERTENCIAS',
    0
  );

  aerpApplyAlefKpiCard_(
    sheet,
    'E14:F17',
    AERP_ICONS.ERROR,
    'ERRORES',
    0
  );

  aerpApplyAlefKpiCard_(
    sheet,
    'G14:H17',
    AERP_ICONS.TIME,
    'DURACIÓN',
    '36.35 s'
  );

  /*
   * Información de arquitectura.
   */

  aerpApplyAlefSection_(
    sheet,
    'A19:H20',
    AERP_BRAND.ENGINE_NAME
  );

  const flowRange =
    sheet.getRange('A21:H22');

  flowRange.merge()
    .setValue(
      'Metadata → Generator Engine → AppSheet Package → Deployment'
    )
    .setBackground(
      AERP_THEME.COLORS.SURFACE
    )
    .setFontColor(
      AERP_THEME.COLORS.TEXT_SECONDARY
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

  /*
   * Pie institucional.
   */

  aerpApplyAlefFooter_(
    sheet,
    'A24:H26',
    AERP_BRAND.TAGLINE +
      '\n' +
      AERP_BRAND.POWERED_BY
  );

  const buildIdRange =
    sheet.getRange('A27:H28');

  buildIdRange.merge()
    .setValue(
      'Design System ' +
      AERP_BRAND
        .DESIGN_SYSTEM_VERSION +
      ' | ' +
      aerpCreateBuildId_()
    )
    .setBackground(
      AERP_THEME.COLORS.SURFACE
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
    sheet: sheetName,
    brand:
      AERP_BRAND.PRODUCT,
    tagline:
      AERP_BRAND.TAGLINE,
    logoInserted: true,
    visibleArea: 'A1:H28',
    designSystemVersion:
      AERP_BRAND
        .DESIGN_SYSTEM_VERSION
  };
}


/* ==========================================================
 * 18. PRUEBA DE LA PREVISUALIZACIÓN
 * ==========================================================
 */

/**
 * Ejecuta la validación y genera la vista visual oficial.
 */
function testProductBrandingPreview() {
  const technicalResult =
    testProductBranding();

  const previewResult =
    demoProductBranding();

  const result = {
    ok:
      technicalResult.ok &&
      previewResult.ok,

    technical:
      technicalResult,

    preview:
      previewResult
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
      'La previsualización del Product Branding falló.'
    );
  }

  Logger.log(
    'Product Branding Preview OK | ' +
    previewResult.sheet
  );

  return result;
}


/* ==========================================================
 * 19. DEMOSTRACIÓN DE LA SECUENCIA DE LANZAMIENTO
 * ==========================================================
 */

/**
 * Imprime en el registro la secuencia completa de lanzamiento.
 *
 * Esta prueba no ejecuta procesos reales.
 */
function testLaunchSequenceBranding() {
  const steps =
    aerpGetLaunchSequence_();

  const output =
    steps.map(function(step, index) {
      return {
        order:
          step.order,

        id:
          step.id,

        label:
          step.icon +
          ' ' +
          step.label,

        message:
          step.message,

        progress:
          aerpBuildProgressBar_(
            index + 1,
            steps.length,
            20
          )
      };
    });

  Logger.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );

  Logger.log(
    'Launch Sequence OK | ' +
    output.length +
    ' pasos'
  );

  return output;
}