// @ts-nocheck
/**
 * ============================================================
 * Alef ERP
 * Enterprise UI Framework
 * ------------------------------------------------------------
 * Module : AERP-027
 * Name   : UI Theme
 * Version: 1.0.0
 * Status : Phase 2 - Component Factory
 * ------------------------------------------------------------
 * Description:
 * Defines the official visual design tokens used across
 * Alef ERP.
 *
 * Public API:
 *   - aerpGetTheme()
 *   - aerpGetThemeToken(path)
 *   - aerpGetComponentPreset(componentPath)
 *   - aerpListComponentPresets()
 *   - aerpValidateUITheme()
 *   - testAerpUITheme()

 *
 * Architecture rule:
 * No Alef ERP module should define visual constants directly.
 * Colors, typography, spacing, radius and shadows must be
 * obtained through this module.
 * ============================================================
 */


/* ============================================================
 * 1. MODULE CONSTANTS
 * ============================================================
 */

/**
 * Current version of the Alef ERP UI Theme.
 *
 * @type {string}
 */
const AERP_UI_THEME_VERSION = '1.0.0';


/**
 * Official Alef ERP Enterprise UI Theme.
 *
 * This object is deeply frozen during initialization.
 * External modules may read its values but must never modify
 * them directly.
 *
 * @type {Object}
 */
const AERP_UI_THEME = aerpDeepFreeze_({

  /* ----------------------------------------------------------
   * Metadata
   * ----------------------------------------------------------
   */

  meta: {
    id: 'AERP_UI_THEME',
    module: 'AERP-027',
    name: 'Alef ERP Enterprise UI Theme',
    version: AERP_UI_THEME_VERSION,
    status: 'ACTIVE',
    schemaVersion: '1.0',
    description:
      'Official design-token foundation for the Alef ERP user interface.'
  },


  /* ----------------------------------------------------------
   * Color system
   * ----------------------------------------------------------
   */

  colors: {

    /**
     * Main brand colors.
     */
    brand: {
      primary: '#2563EB',
      primaryHover: '#1D4ED8',
      primaryActive: '#1E40AF',
      primarySoft: '#EFF6FF',

      secondary: '#0F172A',
      secondaryHover: '#1E293B',
      secondarySoft: '#F1F5F9',

      accent: '#14B8A6',
      accentHover: '#0D9488',
      accentSoft: '#F0FDFA'
    },

    /**
     * Semantic colors communicate system states.
     */
    semantic: {
      success: '#16A34A',
      successDark: '#15803D',
      successSoft: '#F0FDF4',

      warning: '#D97706',
      warningDark: '#B45309',
      warningSoft: '#FFFBEB',

      error: '#DC2626',
      errorDark: '#B91C1C',
      errorSoft: '#FEF2F2',

      info: '#0284C7',
      infoDark: '#0369A1',
      infoSoft: '#F0F9FF'
    },

    /**
     * Surface and background colors.
     */
    surface: {
      page: '#F8FAFC',
      canvas: '#F1F5F9',
      default: '#FFFFFF',
      elevated: '#FFFFFF',
      muted: '#F8FAFC',
      disabled: '#E2E8F0',
      overlay: 'rgba(15, 23, 42, 0.48)'
    },

    /**
     * Text colors.
     */
    text: {
      primary: '#0F172A',
      secondary: '#475569',
      muted: '#64748B',
      subtle: '#94A3B8',
      inverse: '#FFFFFF',
      disabled: '#94A3B8',
      link: '#2563EB',
      linkHover: '#1D4ED8'
    },

    /**
     * Borders and dividers.
     */
    border: {
      subtle: '#E2E8F0',
      default: '#CBD5E1',
      strong: '#94A3B8',
      focus: '#2563EB',
      disabled: '#E2E8F0'
    },

    /**
     * Chart palette.
     *
     * Chart components should consume these colors in order.
     */
    chart: {
      series1: '#2563EB',
      series2: '#14B8A6',
      series3: '#8B5CF6',
      series4: '#F59E0B',
      series5: '#EF4444',
      series6: '#06B6D4',
      series7: '#84CC16',
      series8: '#EC4899'
    }
  },


  /* ----------------------------------------------------------
   * Typography system
   * ----------------------------------------------------------
   */

  typography: {

    fontFamily: {
      primary:
        'Inter, Roboto, Arial, sans-serif',

      monospace:
        'Roboto Mono, Consolas, Courier New, monospace'
    },

    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },

    fontSize: {
      xs: 11,
      sm: 12,
      md: 14,
      lg: 16,
      xl: 18,
      xxl: 20,
      displaySm: 24,
      displayMd: 30,
      displayLg: 36
    },

    lineHeight: {
      compact: 1.2,
      normal: 1.5,
      relaxed: 1.7
    },

    letterSpacing: {
      tight: '-0.02em',
      normal: '0',
      wide: '0.04em'
    },

    styles: {
      displayLarge: {
        fontSize: 36,
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '-0.02em'
      },

      displayMedium: {
        fontSize: 30,
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '-0.02em'
      },

      headingLarge: {
        fontSize: 24,
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '-0.01em'
      },

      headingMedium: {
        fontSize: 20,
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: '-0.01em'
      },

      headingSmall: {
        fontSize: 16,
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: '0'
      },

      bodyLarge: {
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: '0'
      },

      body: {
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: '0'
      },

      bodySmall: {
        fontSize: 12,
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: '0'
      },

      label: {
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: '0.04em'
      },

      button: {
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1.2,
        letterSpacing: '0'
      },

      caption: {
        fontSize: 11,
        fontWeight: 400,
        lineHeight: 1.4,
        letterSpacing: '0'
      },

      metric: {
        fontSize: 30,
        fontWeight: 700,
        lineHeight: 1.1,
        letterSpacing: '-0.02em'
      }
    }
  },


  /* ----------------------------------------------------------
   * Spacing system
   * ----------------------------------------------------------
   */

  spacing: {
    none: 0,
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64
  },


  /* ----------------------------------------------------------
   * Radius system
   * ----------------------------------------------------------
   */

  radius: {
    none: 0,
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    pill: 999
  },


  /* ----------------------------------------------------------
   * Shadow system
   * ----------------------------------------------------------
   */

  shadows: {
    none: 'none',

    level1:
      '0 1px 2px rgba(15, 23, 42, 0.06)',

    level2:
      '0 4px 12px rgba(15, 23, 42, 0.08)',

    level3:
      '0 10px 24px rgba(15, 23, 42, 0.12)',

    level4:
      '0 20px 40px rgba(15, 23, 42, 0.16)',

    focus:
      '0 0 0 3px rgba(37, 99, 235, 0.22)'
  },


  /* ----------------------------------------------------------
   * Border system
   * ----------------------------------------------------------
   */

  borders: {
    width: {
      none: 0,
      thin: 1,
      medium: 2,
      thick: 3
    },

    style: {
      solid: 'solid',
      dashed: 'dashed',
      dotted: 'dotted'
    }
  },


  /* ----------------------------------------------------------
   * Layout system
   * ----------------------------------------------------------
   */

  layout: {
    contentMaxWidth: 1440,
    sidebarWidth: 256,
    sidebarCollapsedWidth: 72,
    headerHeight: 64,
    footerHeight: 48,

    grid: {
      columns: 12,
      gutter: 24,
      rowGap: 24
    },

    card: {
      minWidth: 240,
      defaultPadding: 24,
      compactPadding: 16
    },

    dashboard: {
      pagePaddingDesktop: 32,
      pagePaddingTablet: 24,
      pagePaddingMobile: 16,
      sectionGap: 32,
      componentGap: 24
    }
  },
  /* ----------------------------------------------------------
   * Component Registry
   * ----------------------------------------------------------
   *
   * Component presets reference design tokens using paths
   * prefixed with "$".
   *
   * Example:
   *   '$colors.brand.primary'
   *   '$spacing.lg'
   *   '$radius.md'
   *
   * Presets must never contain arbitrary visual constants when
   * an equivalent design token already exists.
   * ----------------------------------------------------------
   */

  components: {

    /* --------------------------------------------------------
     * Base card
     * --------------------------------------------------------
     */

    card: {
      base: {
        component: 'card',
        variant: 'base',

        container: {
          background: '$colors.surface.default',
          borderColor: '$colors.border.subtle',
          borderWidth: '$borders.width.thin',
          borderStyle: '$borders.style.solid',
          borderRadius: '$radius.lg',
          boxShadow: '$shadows.level1',
          padding: '$spacing.lg',
          gap: '$spacing.md'
        },

        title: {
          typography: '$typography.styles.headingSmall',
          color: '$colors.text.primary'
        },

        subtitle: {
          typography: '$typography.styles.bodySmall',
          color: '$colors.text.secondary'
        },

        footer: {
          typography: '$typography.styles.caption',
          color: '$colors.text.muted'
        },

        interaction: {
          hoverShadow: '$shadows.level2',
          focusShadow: '$shadows.focus',
          transitionDuration: '$motion.duration.normal',
          transitionEasing: '$motion.easing.standard'
        }
      },


      /* ------------------------------------------------------
       * KPI card
       * ------------------------------------------------------
       */

      kpi: {
        component: 'card',
        variant: 'kpi',
        extends: 'components.card.base',

        container: {
          minWidth: '$layout.card.minWidth',
          background: '$colors.surface.default',
          borderColor: '$colors.border.subtle',
          borderWidth: '$borders.width.thin',
          borderStyle: '$borders.style.solid',
          borderRadius: '$radius.lg',
          boxShadow: '$shadows.level1',
          padding: '$layout.card.defaultPadding',
          gap: '$spacing.md'
        },

        icon: {
          size: 40,
          background: '$colors.brand.primarySoft',
          color: '$colors.brand.primary',
          borderRadius: '$radius.md'
        },

        label: {
          typography: '$typography.styles.label',
          color: '$colors.text.secondary'
        },

        value: {
          typography: '$typography.styles.metric',
          color: '$colors.text.primary'
        },

        subtitle: {
          typography: '$typography.styles.bodySmall',
          color: '$colors.text.muted'
        },

        trend: {
          positiveColor: '$colors.semantic.success',
          positiveBackground: '$colors.semantic.successSoft',

          negativeColor: '$colors.semantic.error',
          negativeBackground: '$colors.semantic.errorSoft',

          neutralColor: '$colors.text.secondary',
          neutralBackground: '$colors.surface.muted',

          typography: '$typography.styles.caption',
          borderRadius: '$radius.pill',
          paddingHorizontal: '$spacing.sm',
          paddingVertical: '$spacing.xs'
        }
      },


      /* ------------------------------------------------------
       * Metric card
       * ------------------------------------------------------
       */

      metric: {
        component: 'card',
        variant: 'metric',
        extends: 'components.card.base',

        container: {
          background: '$colors.surface.default',
          borderColor: '$colors.border.subtle',
          borderWidth: '$borders.width.thin',
          borderStyle: '$borders.style.solid',
          borderRadius: '$radius.lg',
          boxShadow: '$shadows.level1',
          padding: '$spacing.lg',
          gap: '$spacing.md'
        },

        title: {
          typography: '$typography.styles.headingSmall',
          color: '$colors.text.primary'
        },

        value: {
          typography: '$typography.styles.metric',
          color: '$colors.text.primary'
        },

        progress: {
          height: 8,
          background: '$colors.surface.disabled',
          fill: '$colors.brand.primary',
          borderRadius: '$radius.pill'
        },

        footer: {
          typography: '$typography.styles.caption',
          color: '$colors.text.secondary'
        }
      },


      /* ------------------------------------------------------
       * Quick-action card
       * ------------------------------------------------------
       */

      quickAction: {
        component: 'card',
        variant: 'quickAction',
        extends: 'components.card.base',

        container: {
          background: '$colors.surface.default',
          borderColor: '$colors.border.subtle',
          borderWidth: '$borders.width.thin',
          borderStyle: '$borders.style.solid',
          borderRadius: '$radius.lg',
          boxShadow: '$shadows.level1',
          padding: '$spacing.lg',
          gap: '$spacing.sm'
        },

        icon: {
          size: 36,
          background: '$colors.brand.primarySoft',
          color: '$colors.brand.primary',
          borderRadius: '$radius.md'
        },

        title: {
          typography: '$typography.styles.headingSmall',
          color: '$colors.text.primary'
        },

        description: {
          typography: '$typography.styles.bodySmall',
          color: '$colors.text.secondary'
        }
      }
    },


    /* --------------------------------------------------------
     * Buttons
     * --------------------------------------------------------
     */

    button: {
      base: {
        component: 'button',
        variant: 'base',

        height: 40,
        paddingHorizontal: '$spacing.md',
        paddingVertical: '$spacing.sm',
        gap: '$spacing.sm',

        typography: '$typography.styles.button',
        borderRadius: '$radius.md',
        borderWidth: '$borders.width.thin',
        borderStyle: '$borders.style.solid',

        transitionDuration: '$motion.duration.fast',
        transitionEasing: '$motion.easing.standard',

        disabledOpacity: 0.5
      },

      primary: {
        component: 'button',
        variant: 'primary',
        extends: 'components.button.base',

        background: '$colors.brand.primary',
        backgroundHover: '$colors.brand.primaryHover',
        backgroundActive: '$colors.brand.primaryActive',

        color: '$colors.text.inverse',
        borderColor: '$colors.brand.primary',

        focusShadow: '$shadows.focus'
      },

      secondary: {
        component: 'button',
        variant: 'secondary',
        extends: 'components.button.base',

        background: '$colors.surface.default',
        backgroundHover: '$colors.surface.muted',
        backgroundActive: '$colors.surface.disabled',

        color: '$colors.text.primary',
        borderColor: '$colors.border.default',

        focusShadow: '$shadows.focus'
      },

      ghost: {
        component: 'button',
        variant: 'ghost',
        extends: 'components.button.base',

        background: 'transparent',
        backgroundHover: '$colors.brand.primarySoft',
        backgroundActive: '$colors.surface.disabled',

        color: '$colors.brand.primary',
        borderColor: 'transparent',

        focusShadow: '$shadows.focus'
      },

      danger: {
        component: 'button',
        variant: 'danger',
        extends: 'components.button.base',

        background: '$colors.semantic.error',
        backgroundHover: '$colors.semantic.errorDark',
        backgroundActive: '$colors.semantic.errorDark',

        color: '$colors.text.inverse',
        borderColor: '$colors.semantic.error',

        focusShadow: '$shadows.focus'
      }
    },


    /* --------------------------------------------------------
     * Status badges
     * --------------------------------------------------------
     */

    badge: {
      base: {
        component: 'badge',
        variant: 'base',

        display: 'inline-flex',
        paddingHorizontal: '$spacing.sm',
        paddingVertical: '$spacing.xs',

        typography: '$typography.styles.label',
        borderRadius: '$radius.pill',

        borderWidth: '$borders.width.thin',
        borderStyle: '$borders.style.solid'
      },

      success: {
        component: 'badge',
        variant: 'success',
        extends: 'components.badge.base',

        background: '$colors.semantic.successSoft',
        color: '$colors.semantic.successDark',
        borderColor: '$colors.semantic.success'
      },

      warning: {
        component: 'badge',
        variant: 'warning',
        extends: 'components.badge.base',

        background: '$colors.semantic.warningSoft',
        color: '$colors.semantic.warningDark',
        borderColor: '$colors.semantic.warning'
      },

      error: {
        component: 'badge',
        variant: 'error',
        extends: 'components.badge.base',

        background: '$colors.semantic.errorSoft',
        color: '$colors.semantic.errorDark',
        borderColor: '$colors.semantic.error'
      },

      info: {
        component: 'badge',
        variant: 'info',
        extends: 'components.badge.base',

        background: '$colors.semantic.infoSoft',
        color: '$colors.semantic.infoDark',
        borderColor: '$colors.semantic.info'
      },

      neutral: {
        component: 'badge',
        variant: 'neutral',
        extends: 'components.badge.base',

        background: '$colors.surface.muted',
        color: '$colors.text.secondary',
        borderColor: '$colors.border.default'
      }
    },


    /* --------------------------------------------------------
     * Alerts
     * --------------------------------------------------------
     */

    alert: {
      base: {
        component: 'alert',
        variant: 'base',

        padding: '$spacing.md',
        gap: '$spacing.sm',

        borderWidth: '$borders.width.thin',
        borderStyle: '$borders.style.solid',
        borderRadius: '$radius.md',

        titleTypography: '$typography.styles.headingSmall',
        bodyTypography: '$typography.styles.bodySmall'
      },

      success: {
        component: 'alert',
        variant: 'success',
        extends: 'components.alert.base',

        background: '$colors.semantic.successSoft',
        borderColor: '$colors.semantic.success',
        iconColor: '$colors.semantic.success',
        titleColor: '$colors.semantic.successDark',
        bodyColor: '$colors.text.primary'
      },

      warning: {
        component: 'alert',
        variant: 'warning',
        extends: 'components.alert.base',

        background: '$colors.semantic.warningSoft',
        borderColor: '$colors.semantic.warning',
        iconColor: '$colors.semantic.warning',
        titleColor: '$colors.semantic.warningDark',
        bodyColor: '$colors.text.primary'
      },

      error: {
        component: 'alert',
        variant: 'error',
        extends: 'components.alert.base',

        background: '$colors.semantic.errorSoft',
        borderColor: '$colors.semantic.error',
        iconColor: '$colors.semantic.error',
        titleColor: '$colors.semantic.errorDark',
        bodyColor: '$colors.text.primary'
      },

      info: {
        component: 'alert',
        variant: 'info',
        extends: 'components.alert.base',

        background: '$colors.semantic.infoSoft',
        borderColor: '$colors.semantic.info',
        iconColor: '$colors.semantic.info',
        titleColor: '$colors.semantic.infoDark',
        bodyColor: '$colors.text.primary'
      }
    },


    /* --------------------------------------------------------
     * Section header
     * --------------------------------------------------------
     */

    sectionHeader: {
      default: {
        component: 'sectionHeader',
        variant: 'default',

        container: {
          gap: '$spacing.xs',
          marginBottom: '$spacing.lg'
        },

        eyebrow: {
          typography: '$typography.styles.label',
          color: '$colors.brand.primary'
        },

        title: {
          typography: '$typography.styles.headingLarge',
          color: '$colors.text.primary'
        },

        description: {
          typography: '$typography.styles.body',
          color: '$colors.text.secondary'
        },

        divider: {
          color: '$colors.border.subtle',
          width: '$borders.width.thin',
          style: '$borders.style.solid'
        }
      }
    },


    /* --------------------------------------------------------
     * Empty state
     * --------------------------------------------------------
     */

    emptyState: {
      default: {
        component: 'emptyState',
        variant: 'default',

        container: {
          background: '$colors.surface.muted',
          borderColor: '$colors.border.subtle',
          borderWidth: '$borders.width.thin',
          borderStyle: '$borders.style.dashed',
          borderRadius: '$radius.lg',
          padding: '$spacing.xxl',
          gap: '$spacing.md'
        },

        icon: {
          size: 48,
          color: '$colors.text.subtle'
        },

        title: {
          typography: '$typography.styles.headingMedium',
          color: '$colors.text.primary'
        },

        description: {
          typography: '$typography.styles.body',
          color: '$colors.text.secondary'
        }
      }
    }
  },

  /* ----------------------------------------------------------
   * Motion system
   * ----------------------------------------------------------
   */

  motion: {
    duration: {
      instant: 0,
      fast: 120,
      normal: 200,
      slow: 320
    },

    easing: {
      standard: 'cubic-bezier(0.2, 0, 0, 1)',
      enter: 'cubic-bezier(0, 0, 0.2, 1)',
      exit: 'cubic-bezier(0.4, 0, 1, 1)'
    }
  },


  /* ----------------------------------------------------------
   * Layer system
   * ----------------------------------------------------------
   */

  zIndex: {
    base: 0,
    raised: 10,
    sticky: 100,
    dropdown: 1000,
    modal: 2000,
    toast: 3000,
    tooltip: 4000
  }
});


/* ============================================================
 * 2. PUBLIC API
 * ============================================================
 */

/**
 * Returns the official Alef ERP UI Theme.
 *
 * The returned object is deeply frozen and must be treated
 * as read-only.
 *
 * Example:
 *
 * const theme = aerpGetTheme();
 * const primaryColor = theme.colors.brand.primary;
 *
 * @return {Object} Deeply frozen UI Theme object.
 */
function aerpGetTheme() {
  return AERP_UI_THEME;
}


/**
 * Returns a specific token from the UI Theme using dot notation.
 *
 * Example:
 *
 * aerpGetThemeToken('colors.brand.primary');
 * aerpGetThemeToken('spacing.md');
 * aerpGetThemeToken('typography.styles.headingLarge');
 *
 * @param {string} path Dot-separated token path.
 * @return {*} Token value.
 * @throws {Error} When the path is invalid or does not exist.
 */
function aerpGetThemeToken(path) {
  if (
    typeof path !== 'string' ||
    path.trim() === ''
  ) {
    throw new Error(
      '[AERP-027] Theme token path must be a non-empty string.'
    );
  }

  const normalizedPath = path.trim();
  const pathParts = normalizedPath.split('.');

  let currentValue = AERP_UI_THEME;

  for (let index = 0; index < pathParts.length; index += 1) {
    const key = pathParts[index];

    if (
      currentValue === null ||
      currentValue === undefined ||
      !Object.prototype.hasOwnProperty.call(currentValue, key)
    ) {
      throw new Error(
        '[AERP-027] Theme token not found: ' + normalizedPath
      );
    }

    currentValue = currentValue[key];
  }

  return currentValue;
}
/**
 * Returns a resolved component preset from the registry.
 *
 * The function:
 *   1. Finds the requested preset.
 *   2. Resolves its optional inheritance chain.
 *   3. Resolves all "$token.path" references.
 *   4. Returns a deeply frozen result.
 *
 * Examples:
 *
 * const kpi =
 *   aerpGetComponentPreset('card.kpi');
 *
 * const primaryButton =
 *   aerpGetComponentPreset('button.primary');
 *
 * const successBadge =
 *   aerpGetComponentPreset('badge.success');
 *
 * @param {string} componentPath Path inside theme.components.
 * @return {Object} Resolved and deeply frozen component preset.
 * @throws {Error} When the component path is invalid.
 */
function aerpGetComponentPreset(componentPath) {
  if (
    typeof componentPath !== 'string' ||
    componentPath.trim() === ''
  ) {
    throw new Error(
      '[AERP-027] Component preset path must be a non-empty string.'
    );
  }

  const normalizedPath = componentPath.trim();

  let preset;

  try {
    preset = aerpGetThemeToken(
      'components.' + normalizedPath
    );
  } catch (error) {
    throw new Error(
      '[AERP-027] Component preset not found: ' +
      normalizedPath
    );
  }

  if (
    preset === null ||
    typeof preset !== 'object' ||
    Array.isArray(preset)
  ) {
    throw new Error(
      '[AERP-027] Invalid component preset: ' +
      normalizedPath
    );
  }

  const resolvedPreset =
    aerpResolveComponentPreset_(
      preset,
      []
    );

  return aerpDeepFreeze_(resolvedPreset);
}


/**
 * Lists all registered component preset paths.
 *
 * Example result:
 *
 * [
 *   'card.base',
 *   'card.kpi',
 *   'button.primary',
 *   'badge.success'
 * ]
 *
 * @return {Array<string>} Registered component preset paths.
 */
function aerpListComponentPresets() {
  const presetPaths = [];

  aerpCollectComponentPaths_(
    AERP_UI_THEME.components,
    '',
    presetPaths
  );

  return presetPaths.sort();
}
/**
 * Creates a declarative UI component using a registered preset.
 *
 * The factory:
 *   1. Validates component type and variant.
 *   2. Loads and resolves the registered preset.
 *   3. Normalizes custom properties.
 *   4. Creates standard component metadata.
 *   5. Validates the final definition.
 *   6. Returns a deeply frozen component object.
 *
 * Example:
 *
 * const component = aerpCreateComponent(
 *   'card',
 *   'kpi',
 *   {
 *     id: 'sales-month',
 *     title: 'Ventas del mes',
 *     value: '€58.240',
 *     subtitle: 'Facturación acumulada',
 *     icon: 'payments'
 *   }
 * );
 *
 * @param {string} type Registered component type.
 * @param {string} variant Registered component variant.
 * @param {Object=} properties Custom component properties.
 * @return {Object} Validated and deeply frozen component.
 * @throws {Error} When the component definition is invalid.
 */
function aerpCreateComponent(
  type,
  variant,
  properties
) {
  const normalizedType =
    aerpNormalizeComponentIdentity_(
      type,
      'type'
    );

  const normalizedVariant =
    aerpNormalizeComponentIdentity_(
      variant,
      'variant'
    );

  const normalizedProperties =
    aerpNormalizeComponentProperties_(
      properties
    );

  const presetPath =
    normalizedType +
    '.' +
    normalizedVariant;

  const preset =
    aerpGetComponentPreset(
      presetPath
    );

  const componentId =
    normalizedProperties.id ||
    aerpGenerateComponentId_(
      normalizedType,
      normalizedVariant
    );

  const component = {
    id: componentId,

    component: normalizedType,
    variant: normalizedVariant,

    schemaVersion: '1.0',
    factoryVersion: AERP_UI_THEME_VERSION,

    preset: preset,

    properties:
      aerpRemoveReservedComponentProperties_(
        normalizedProperties
      ),

    state: {
      visible:
        normalizedProperties.visible !== false,

      enabled:
        normalizedProperties.enabled !== false,

      loading:
        normalizedProperties.loading === true
    },

    metadata: {
      module: 'AERP-027',
      source: 'ComponentFactory',
      presetPath: presetPath,
      createdAt: new Date().toISOString()
    }
  };

  const validation =
    aerpValidateComponentDefinition(
      component
    );

  if (!validation.ok) {
    throw new Error(
      '[AERP-027] Invalid component definition: ' +
      validation.errors.join(' | ')
    );
  }

  return aerpDeepFreeze_(
    component
  );
}


/**
 * Validates a declarative component definition.
 *
 * @param {Object} component Component definition.
 * @return {Object} Validation result.
 */
function aerpValidateComponentDefinition(
  component
) {
  const errors = [];

  if (
    component === null ||
    typeof component !== 'object' ||
    Array.isArray(component)
  ) {
    errors.push(
      'Component definition must be an object.'
    );

    return {
      ok: false,
      errors: errors
    };
  }

  if (
    typeof component.id !== 'string' ||
    component.id.trim() === ''
  ) {
    errors.push(
      'Component id must be a non-empty string.'
    );
  }

  if (
    typeof component.component !== 'string' ||
    component.component.trim() === ''
  ) {
    errors.push(
      'Component type must be a non-empty string.'
    );
  }

  if (
    typeof component.variant !== 'string' ||
    component.variant.trim() === ''
  ) {
    errors.push(
      'Component variant must be a non-empty string.'
    );
  }

  if (
    component.preset === null ||
    typeof component.preset !== 'object' ||
    Array.isArray(component.preset)
  ) {
    errors.push(
      'Component preset must be a resolved object.'
    );
  }

  if (
    component.properties === null ||
    typeof component.properties !== 'object' ||
    Array.isArray(component.properties)
  ) {
    errors.push(
      'Component properties must be an object.'
    );
  }

  if (
    component.state === null ||
    typeof component.state !== 'object' ||
    Array.isArray(component.state)
  ) {
    errors.push(
      'Component state must be an object.'
    );
  } else {
    if (
      typeof component.state.visible !== 'boolean'
    ) {
      errors.push(
        'Component state.visible must be boolean.'
      );
    }

    if (
      typeof component.state.enabled !== 'boolean'
    ) {
      errors.push(
        'Component state.enabled must be boolean.'
      );
    }

    if (
      typeof component.state.loading !== 'boolean'
    ) {
      errors.push(
        'Component state.loading must be boolean.'
      );
    }
  }

  if (
    component.metadata === null ||
    typeof component.metadata !== 'object' ||
    Array.isArray(component.metadata)
  ) {
    errors.push(
      'Component metadata must be an object.'
    );
  }

  if (
    component.preset &&
    component.preset.component !==
      component.component
  ) {
    errors.push(
      'Component type does not match preset type.'
    );
  }

  if (
    component.preset &&
    component.preset.variant !==
      component.variant
  ) {
    errors.push(
      'Component variant does not match preset variant.'
    );
  }

  const unresolvedReferences = [];

  aerpFindUnresolvedTokenReferences_(
    component.preset,
    'component.preset',
    unresolvedReferences
  );

  unresolvedReferences.forEach(function(reference) {
    errors.push(
      'Unresolved token reference: ' +
      reference
    );
  });

  return {
    ok: errors.length === 0,
    componentId:
      component.id || null,
    component:
      component.component || null,
    variant:
      component.variant || null,
    errors: errors
  };
}
/**
 * Validates the structure and essential tokens of AERP_UI_THEME.
 *
 * @return {Object} Validation result.
 */
function aerpValidateUITheme() {
  const errors = [];
  const requiredPaths = [
    'meta.id',
    'meta.module',
    'meta.version',

    'colors.brand.primary',
    'colors.brand.secondary',
    'colors.semantic.success',
    'colors.semantic.warning',
    'colors.semantic.error',
    'colors.surface.page',
    'colors.surface.default',
    'colors.text.primary',
    'colors.text.secondary',
    'colors.border.default',

    'typography.fontFamily.primary',
    'typography.fontWeight.regular',
    'typography.fontWeight.semibold',
    'typography.styles.headingLarge',
    'typography.styles.body',
    'typography.styles.metric',

    'spacing.xs',
    'spacing.sm',
    'spacing.md',
    'spacing.lg',
    'spacing.xl',

    'radius.sm',
    'radius.md',
    'radius.lg',
    'radius.pill',

    'shadows.none',
    'shadows.level1',
    'shadows.level2',
    'shadows.level3',

    'layout.grid.columns',
    'layout.card.defaultPadding',
    'layout.dashboard.componentGap',

    'motion.duration.fast',
    'motion.duration.normal',
    'motion.easing.standard',

    'components.card.base',
    'components.card.kpi',
    'components.card.metric',
    'components.card.quickAction',

    'components.button.base',
    'components.button.primary',
    'components.button.secondary',
    'components.button.ghost',
    'components.button.danger',

    'components.badge.base',
    'components.badge.success',
    'components.badge.warning',
    'components.badge.error',
    'components.badge.info',
    'components.badge.neutral',

    'components.alert.base',
    'components.alert.success',
    'components.alert.warning',
    'components.alert.error',
    'components.alert.info',

    'components.sectionHeader.default',
    'components.emptyState.default'
  ];

  requiredPaths.forEach(function(path) {
    try {
      const value = aerpGetThemeToken(path);

      if (
        value === null ||
        value === undefined ||
        value === ''
      ) {
        errors.push(
          'Empty theme token: ' + path
        );
      }
    } catch (error) {
      errors.push(error.message);
    }
  });

  aerpValidateColorTokens_(errors);
  aerpValidateSpacingScale_(errors);
  aerpValidateRadiusScale_(errors);
  aerpValidateThemeMetadata_(errors);
  aerpValidateComponentRegistry_(errors);

  return {
    ok: errors.length === 0,
    module: 'AERP-027',
    version: AERP_UI_THEME_VERSION,
    checkedAt: new Date().toISOString(),
    errors: errors
  };
}


/* ============================================================
 * 3. TESTS
 * ============================================================
 */

/**
 * Runs the official Component Registry test for
 * AERP-027_UITheme.gs.
 *
 * Execute this function manually from Apps Script.
 *
 * @return {Object} Test result.
 */
function testAerpUITheme() {
  const validation =
    aerpValidateUITheme();

  const result = {
    ok: validation.ok,
    module: 'AERP-027',
    phase: 'Phase 1 - Component Registry',
    version: AERP_UI_THEME_VERSION,

    tests: {
      themeAvailable: false,
      primaryColorAvailable: false,
      spacingAvailable: false,
      typographyAvailable: false,
      immutabilityEnabled: false,

      componentRegistryAvailable: false,
      componentListAvailable: false,
      kpiPresetResolved: false,
      inheritanceResolved: false,
      tokenReferencesResolved: false,
      resolvedPresetImmutable: false,

      validationPassed: validation.ok
    },

    registry: {
      presetCount: 0,
      presets: []
    },

    validationErrors:
      validation.errors.slice()
  };

  try {
    const theme =
      aerpGetTheme();

    result.tests.themeAvailable =
      Boolean(theme);

    result.tests.primaryColorAvailable =
      theme.colors.brand.primary === '#2563EB';

    result.tests.spacingAvailable =
      theme.spacing.md === 16;

    result.tests.typographyAvailable =
      Boolean(
        theme.typography.styles.headingLarge
      );

    result.tests.immutabilityEnabled =
      Object.isFrozen(theme) &&
      Object.isFrozen(theme.colors) &&
      Object.isFrozen(theme.components);

    result.tests.componentRegistryAvailable =
      Boolean(
        theme.components &&
        theme.components.card &&
        theme.components.card.kpi
      );

    const componentPaths =
      aerpListComponentPresets();

    result.registry.presetCount =
      componentPaths.length;

    result.registry.presets =
      componentPaths;

    result.tests.componentListAvailable =
      componentPaths.length >= 20;

    const kpiPreset =
      aerpGetComponentPreset('card.kpi');

    result.tests.kpiPresetResolved =
      kpiPreset.component === 'card' &&
      kpiPreset.variant === 'kpi';

    result.tests.inheritanceResolved =
      Boolean(
        kpiPreset.interaction &&
        kpiPreset.interaction.hoverShadow
      );

    result.tests.tokenReferencesResolved =
      kpiPreset.container.background ===
        theme.colors.surface.default &&
      kpiPreset.container.padding ===
        theme.layout.card.defaultPadding &&
      kpiPreset.value.color ===
        theme.colors.text.primary;

    result.tests.resolvedPresetImmutable =
      Object.isFrozen(kpiPreset) &&
      Object.isFrozen(kpiPreset.container) &&
      Object.isFrozen(kpiPreset.trend);

  } catch (error) {
    result.ok = false;

    result.validationErrors.push(
      '[AERP-027] Test execution error: ' +
      error.message
    );
  }

  const testValues =
    Object.keys(result.tests).map(function(testName) {
      return result.tests[testName];
    });

  result.ok =
    validation.ok &&
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
 * Runs the official Component Factory test.
 *
 * Execute this function manually from Apps Script.
 *
 * @return {Object} Test result.
 */
function testAerpComponentFactory() {
  const result = {
    ok: false,
    module: 'AERP-027',
    phase: 'Phase 2 - Component Factory',
    version: AERP_UI_THEME_VERSION,

    tests: {
      componentCreated: false,
      generatedIdAvailable: false,
      customIdPreserved: false,
      presetResolved: false,
      propertiesPreserved: false,
      reservedPropertiesRemoved: false,
      stateNormalized: false,
      metadataAvailable: false,
      componentImmutable: false,
      nestedObjectsImmutable: false,
      invalidPresetRejected: false,
      invalidPropertiesRejected: false,
      validationPassed: false
    },

    samples: {},

    errors: []
  };

  try {
    const generatedComponent =
      aerpCreateComponent(
        'card',
        'kpi',
        {
          title: 'Ventas del mes',
          value: '€58.240',
          subtitle: 'Facturación acumulada',
          icon: 'payments'
        }
      );

    result.samples.generatedComponentId =
      generatedComponent.id;

    result.tests.componentCreated =
      generatedComponent.component === 'card' &&
      generatedComponent.variant === 'kpi';

    result.tests.generatedIdAvailable =
      typeof generatedComponent.id === 'string' &&
      generatedComponent.id.indexOf(
        'card-kpi-'
      ) === 0;

    result.tests.presetResolved =
      generatedComponent.preset
        .container
        .background ===
      AERP_UI_THEME.colors.surface.default;

    result.tests.propertiesPreserved =
      generatedComponent.properties.title ===
        'Ventas del mes' &&
      generatedComponent.properties.value ===
        '€58.240';

    result.tests.stateNormalized =
      generatedComponent.state.visible === true &&
      generatedComponent.state.enabled === true &&
      generatedComponent.state.loading === false;

    result.tests.metadataAvailable =
      generatedComponent.metadata.module ===
        'AERP-027' &&
      generatedComponent.metadata.source ===
        'ComponentFactory' &&
      generatedComponent.metadata.presetPath ===
        'card.kpi';

    result.tests.componentImmutable =
      Object.isFrozen(
        generatedComponent
      );

    result.tests.nestedObjectsImmutable =
      Object.isFrozen(
        generatedComponent.preset
      ) &&
      Object.isFrozen(
        generatedComponent.properties
      ) &&
      Object.isFrozen(
        generatedComponent.state
      ) &&
      Object.isFrozen(
        generatedComponent.metadata
      );

    const customComponent =
      aerpCreateComponent(
        'badge',
        'success',
        {
          id: 'status-active',
          label: 'ACTIVO',
          visible: false,
          enabled: true,
          loading: false
        }
      );

    result.samples.customComponentId =
      customComponent.id;

    result.tests.customIdPreserved =
      customComponent.id ===
      'status-active';

    result.tests.reservedPropertiesRemoved =
      !Object.prototype.hasOwnProperty.call(
        customComponent.properties,
        'id'
      ) &&
      !Object.prototype.hasOwnProperty.call(
        customComponent.properties,
        'visible'
      ) &&
      !Object.prototype.hasOwnProperty.call(
        customComponent.properties,
        'enabled'
      ) &&
      !Object.prototype.hasOwnProperty.call(
        customComponent.properties,
        'loading'
      );

    const validation =
      aerpValidateComponentDefinition(
        generatedComponent
      );

    result.tests.validationPassed =
      validation.ok === true &&
      validation.errors.length === 0;

  } catch (error) {
    result.errors.push(
      '[Factory creation test] ' +
      error.message
    );
  }

  try {
    aerpCreateComponent(
      'card',
      'nonExistingVariant',
      {}
    );

  } catch (error) {
    result.tests.invalidPresetRejected =
      true;
  }

  try {
    aerpCreateComponent(
      'card',
      'kpi',
      'invalid properties'
    );

  } catch (error) {
    result.tests.invalidPropertiesRejected =
      true;
  }

  const testValues =
    Object.keys(result.tests).map(function(testName) {
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

/* ============================================================
 * 4. PRIVATE COMPONENT REGISTRY HELPERS
 * ============================================================
 */

/**
 * Resolves a component preset, including inheritance and tokens.
 *
 * @param {Object} preset Component preset.
 * @param {Array<string>} inheritanceStack Current inheritance stack.
 * @return {Object} Resolved component preset.
 * @private
 */
function aerpResolveComponentPreset_(
  preset,
  inheritanceStack
) {
  let resolvedPreset = {};

  if (preset.extends) {
    const parentPath = preset.extends;

    if (
      inheritanceStack.indexOf(parentPath) !== -1
    ) {
      throw new Error(
        '[AERP-027] Circular component inheritance detected: ' +
        inheritanceStack
          .concat([parentPath])
          .join(' -> ')
      );
    }

    const parentPreset =
      aerpGetThemeToken(parentPath);

    resolvedPreset =
      aerpResolveComponentPreset_(
        parentPreset,
        inheritanceStack.concat([parentPath])
      );
  }

  const childPreset =
    aerpCloneObject_(preset);

  delete childPreset.extends;

  resolvedPreset =
    aerpDeepMerge_(
      resolvedPreset,
      childPreset
    );

  return aerpResolveTokenReferences_(
    resolvedPreset
  );
}


/**
 * Resolves all theme token references inside a value.
 *
 * Token references start with "$".
 *
 * Example:
 *   '$colors.brand.primary'
 *
 * @param {*} value Value to resolve.
 * @return {*} Resolved value.
 * @private
 */
function aerpResolveTokenReferences_(value) {
  if (
    typeof value === 'string' &&
    value.charAt(0) === '$'
  ) {
    const tokenPath =
      value.substring(1);

    return aerpGetThemeToken(tokenPath);
  }

  if (Array.isArray(value)) {
    return value.map(function(item) {
      return aerpResolveTokenReferences_(item);
    });
  }

  if (
    value !== null &&
    typeof value === 'object'
  ) {
    const resolvedObject = {};

    Object.keys(value).forEach(function(key) {
      resolvedObject[key] =
        aerpResolveTokenReferences_(
          value[key]
        );
    });

    return resolvedObject;
  }

  return value;
}


/**
 * Deeply merges two objects.
 *
 * Child values override parent values.
 *
 * @param {Object} target Parent object.
 * @param {Object} source Child object.
 * @return {Object} Merged object.
 * @private
 */
function aerpDeepMerge_(target, source) {
  const output =
    aerpCloneObject_(target);

  Object.keys(source).forEach(function(key) {
    const sourceValue = source[key];
    const targetValue = output[key];

    if (
      aerpIsPlainObject_(sourceValue) &&
      aerpIsPlainObject_(targetValue)
    ) {
      output[key] =
        aerpDeepMerge_(
          targetValue,
          sourceValue
        );

      return;
    }

    output[key] =
      aerpCloneObject_(sourceValue);
  });

  return output;
}


/**
 * Creates a recursive clone of supported values.
 *
 * @param {*} value Value to clone.
 * @return {*} Cloned value.
 * @private
 */
function aerpCloneObject_(value) {
  if (Array.isArray(value)) {
    return value.map(function(item) {
      return aerpCloneObject_(item);
    });
  }

  if (aerpIsPlainObject_(value)) {
    const clone = {};

    Object.keys(value).forEach(function(key) {
      clone[key] =
        aerpCloneObject_(
          value[key]
        );
    });

    return clone;
  }

  return value;
}


/**
 * Checks whether a value is a plain object.
 *
 * @param {*} value Value to inspect.
 * @return {boolean} True when the value is a plain object.
 * @private
 */
function aerpIsPlainObject_(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}


/**
 * Collects all final component preset paths.
 *
 * A registry node is considered a preset when it contains
 * both "component" and "variant".
 *
 * @param {Object} node Registry node.
 * @param {string} parentPath Current path.
 * @param {Array<string>} output Collected paths.
 * @private
 */
function aerpCollectComponentPaths_(
  node,
  parentPath,
  output
) {
  Object.keys(node).forEach(function(key) {
    const value = node[key];

    const currentPath =
      parentPath
        ? parentPath + '.' + key
        : key;

    if (
      aerpIsPlainObject_(value) &&
      typeof value.component === 'string' &&
      typeof value.variant === 'string'
    ) {
      output.push(currentPath);
      return;
    }

    if (aerpIsPlainObject_(value)) {
      aerpCollectComponentPaths_(
        value,
        currentPath,
        output
      );
    }
  });
}
/* ============================================================
 * 5. PRIVATE COMPONENT FACTORY HELPERS
 * ============================================================
 */

/**
 * Normalizes and validates a component identity value.
 *
 * @param {*} value Identity value.
 * @param {string} fieldName Field being validated.
 * @return {string} Normalized value.
 * @throws {Error} When invalid.
 * @private
 */
function aerpNormalizeComponentIdentity_(
  value,
  fieldName
) {
  if (
    typeof value !== 'string' ||
    value.trim() === ''
  ) {
    throw new Error(
      '[AERP-027] Component ' +
      fieldName +
      ' must be a non-empty string.'
    );
  }

  const normalizedValue =
    value.trim();

  const validPattern =
    /^[A-Za-z][A-Za-z0-9_-]*$/;

  if (
    !validPattern.test(normalizedValue)
  ) {
    throw new Error(
      '[AERP-027] Invalid component ' +
      fieldName +
      ': ' +
      normalizedValue
    );
  }

  return normalizedValue;
}


/**
 * Normalizes custom component properties.
 *
 * @param {*=} properties Custom properties.
 * @return {Object} Cloned properties.
 * @throws {Error} When properties are invalid.
 * @private
 */
function aerpNormalizeComponentProperties_(
  properties
) {
  if (
    properties === undefined ||
    properties === null
  ) {
    return {};
  }

  if (
    !aerpIsPlainObject_(properties)
  ) {
    throw new Error(
      '[AERP-027] Component properties must be a plain object.'
    );
  }

  return aerpCloneObject_(
    properties
  );
}


/**
 * Removes properties managed internally by the factory.
 *
 * These values are represented in component.id or
 * component.state and must not be duplicated.
 *
 * @param {Object} properties Normalized properties.
 * @return {Object} Public component properties.
 * @private
 */
function aerpRemoveReservedComponentProperties_(
  properties
) {
  const cleanProperties =
    aerpCloneObject_(
      properties
    );

  delete cleanProperties.id;
  delete cleanProperties.visible;
  delete cleanProperties.enabled;
  delete cleanProperties.loading;

  return cleanProperties;
}


/**
 * Generates a unique component identifier.
 *
 * Example:
 *   card-kpi-1720795800000-a4f9
 *
 * @param {string} type Component type.
 * @param {string} variant Component variant.
 * @return {string} Generated component id.
 * @private
 */
function aerpGenerateComponentId_(
  type,
  variant
) {
  const timestamp =
    new Date().getTime();

  const randomSuffix =
    Math.random()
      .toString(36)
      .substring(2, 6);

  return [
    type,
    variant,
    timestamp,
    randomSuffix
  ].join('-');
}

/* ============================================================
 * 6. PRIVATE VALIDATION HELPERS
 * ============================================================
 */

/**
 * Validates theme metadata.
 *
 * @param {Array<string>} errors Validation errors.
 * @private
 */
function aerpValidateThemeMetadata_(errors) {
  const meta = AERP_UI_THEME.meta;

  if (meta.module !== 'AERP-027') {
    errors.push(
      'Invalid module identifier in theme metadata.'
    );
  }

  if (meta.version !== AERP_UI_THEME_VERSION) {
    errors.push(
      'Theme metadata version does not match module version.'
    );
  }

  if (meta.status !== 'ACTIVE') {
    errors.push(
      'UI Theme status must be ACTIVE.'
    );
  }
}


/**
 * Validates hexadecimal and rgba color tokens.
 *
 * @param {Array<string>} errors Validation errors.
 * @private
 */
function aerpValidateColorTokens_(errors) {
  const colorGroups = AERP_UI_THEME.colors;

  Object.keys(colorGroups).forEach(function(groupName) {
    const group = colorGroups[groupName];

    Object.keys(group).forEach(function(tokenName) {
      const colorValue = group[tokenName];

      if (
        typeof colorValue !== 'string' ||
        !aerpIsValidColor_(colorValue)
      ) {
        errors.push(
          'Invalid color token: colors.' +
          groupName +
          '.' +
          tokenName
        );
      }
    });
  });
}


/**
 * Validates that the spacing scale is ordered.
 *
 * @param {Array<string>} errors Validation errors.
 * @private
 */
function aerpValidateSpacingScale_(errors) {
  const spacingKeys = [
    'none',
    'xxs',
    'xs',
    'sm',
    'md',
    'lg',
    'xl',
    'xxl',
    'xxxl'
  ];

  let previousValue = -1;

  spacingKeys.forEach(function(key) {
    const value = AERP_UI_THEME.spacing[key];

    if (
      typeof value !== 'number' ||
      value < previousValue
    ) {
      errors.push(
        'Invalid spacing scale at: spacing.' + key
      );
    }

    previousValue = value;
  });
}


/**
 * Validates that the radius scale is ordered.
 *
 * @param {Array<string>} errors Validation errors.
 * @private
 */
function aerpValidateRadiusScale_(errors) {
  const radiusKeys = [
    'none',
    'xs',
    'sm',
    'md',
    'lg',
    'xl',
    'xxl',
    'pill'
  ];

  let previousValue = -1;

  radiusKeys.forEach(function(key) {
    const value = AERP_UI_THEME.radius[key];

    if (
      typeof value !== 'number' ||
      value < previousValue
    ) {
      errors.push(
        'Invalid radius scale at: radius.' + key
      );
    }

    previousValue = value;
  });
}
/**
 * Validates all registered component presets.
 *
 * @param {Array<string>} errors Validation errors.
 * @private
 */
function aerpValidateComponentRegistry_(errors) {
  const presetPaths =
    aerpListComponentPresets();

  if (presetPaths.length === 0) {
    errors.push(
      'Component Registry does not contain presets.'
    );

    return;
  }

  presetPaths.forEach(function(componentPath) {
    try {
      const preset =
        aerpGetComponentPreset(componentPath);

      if (
        !preset.component ||
        !preset.variant
      ) {
        errors.push(
          'Component preset lacks identity: ' +
          componentPath
        );
      }

      const unresolvedReferences = [];

      aerpFindUnresolvedTokenReferences_(
        preset,
        componentPath,
        unresolvedReferences
      );

      unresolvedReferences.forEach(function(reference) {
        errors.push(
          'Unresolved component token: ' +
          reference
        );
      });

    } catch (error) {
      errors.push(
        'Invalid component preset "' +
        componentPath +
        '": ' +
        error.message
      );
    }
  });
}


/**
 * Finds unresolved "$token" references recursively.
 *
 * @param {*} value Value to inspect.
 * @param {string} currentPath Current validation path.
 * @param {Array<string>} output Found references.
 * @private
 */
function aerpFindUnresolvedTokenReferences_(
  value,
  currentPath,
  output
) {
  if (
    typeof value === 'string' &&
    value.charAt(0) === '$'
  ) {
    output.push(
      currentPath + ' = ' + value
    );

    return;
  }

  if (Array.isArray(value)) {
    value.forEach(function(item, index) {
      aerpFindUnresolvedTokenReferences_(
        item,
        currentPath + '[' + index + ']',
        output
      );
    });

    return;
  }

  if (
    value !== null &&
    typeof value === 'object'
  ) {
    Object.keys(value).forEach(function(key) {
      aerpFindUnresolvedTokenReferences_(
        value[key],
        currentPath + '.' + key,
        output
      );
    });
  }
}

/**
 * Checks whether a string is a supported color value.
 *
 * @param {string} value Color value.
 * @return {boolean} True when valid.
 * @private
 */
function aerpIsValidColor_(value) {
  const hexPattern =
    /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;

  const rgbaPattern =
    /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/;

  return (
    hexPattern.test(value) ||
    rgbaPattern.test(value)
  );
}


/* ============================================================
 * 7. PRIVATE IMMUTABILITY HELPERS
 * ============================================================
 */

/**
 * Deeply freezes an object and all nested objects.
 *
 * This prevents accidental modification of the official
 * Alef ERP design tokens.
 *
 * @param {*} value Value to freeze.
 * @return {*} Frozen value.
 * @private
 */
function aerpDeepFreeze_(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  Object.getOwnPropertyNames(value).forEach(function(propertyName) {
    const propertyValue = value[propertyName];

    aerpDeepFreeze_(propertyValue);
  });

  return Object.freeze(value);
}
