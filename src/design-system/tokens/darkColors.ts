/**
 * Design System - Dark Mode Color Tokens
 *
 * Paleta de colores para modo oscuro.
 */

export const darkColors = {
  // ============================================
  // PRIMARY - Blanco/Gris claro como color principal en dark mode
  // ============================================
  primary: {
    50: '#0A0A0A',
    100: '#171717',
    200: '#262626',
    300: '#404040',
    400: '#525252',
    500: '#737373',
    600: '#A1A1A1',
    700: '#D1D1D1',
    800: '#E4E4E4',
    900: '#F0F0F0',
    950: '#F8F8F8',
  },

  // ============================================
  // ACCENT - Azul moderno para acentos (más brillante en dark)
  // ============================================
  accent: {
    50: '#1E3A8A',
    100: '#1E40AF',
    200: '#1D4ED8',
    300: '#2563EB',
    400: '#3B82F6',
    500: '#60A5FA',
    600: '#93C5FD',
    700: '#BFDBFE',
    800: '#DBEAFE',
    900: '#EFF6FF',
  },

  // ============================================
  // SEMANTIC COLORS
  // ============================================
  success: {
    50: '#14532D',
    100: '#166534',
    200: '#15803D',
    300: '#16A34A',
    400: '#22C55E',
    500: '#4ADE80',
    600: '#86EFAC',
    700: '#BBF7D0',
    800: '#DCFCE7',
    900: '#F0FDF4',
  },

  warning: {
    50: '#78350F',
    100: '#92400E',
    200: '#B45309',
    300: '#D97706',
    400: '#F59E0B',
    500: '#FBBF24',
    600: '#FCD34D',
    700: '#FDE68A',
    800: '#FEF3C7',
    900: '#FFFBEB',
  },

  danger: {
    50: '#7F1D1D',
    100: '#991B1B',
    200: '#B91C1C',
    300: '#DC2626',
    400: '#EF4444',
    500: '#F87171',
    600: '#FCA5A5',
    700: '#FECACA',
    800: '#FEE2E2',
    900: '#FEF2F2',
  },

  info: {
    50: '#0C4A6E',
    100: '#075985',
    200: '#0369A1',
    300: '#0284C7',
    400: '#0EA5E9',
    500: '#38BDF8',
    600: '#7DD3FC',
    700: '#BAE6FD',
    800: '#E0F2FE',
    900: '#F0F9FF',
  },

  // ============================================
  // NEUTRALS - Grises invertidos para dark mode
  // ============================================
  neutral: {
    0: '#0A0A0A',
    50: '#171717',
    100: '#262626',
    200: '#404040',
    300: '#525252',
    400: '#737373',
    500: '#A3A3A3',
    600: '#D4D4D4',
    700: '#E5E5E5',
    800: '#F5F5F5',
    900: '#FAFAFA',
    950: '#FFFFFF',
  },

  // ============================================
  // BACKGROUND COLORS
  // ============================================
  background: {
    primary: '#0A0A0A',
    secondary: '#171717',
    tertiary: '#262626',
    inverse: '#FFFFFF',
    elevated: '#1A1A1A',
  },

  // ============================================
  // SURFACE COLORS (Cards, Modals, etc.)
  // ============================================
  surface: {
    primary: '#171717',
    secondary: '#262626',
    tertiary: '#333333',
    inverse: '#F5F5F5',
    elevated: '#1F1F1F',
    hover: '#2A2A2A',
    pressed: '#333333',
    disabled: '#1A1A1A',
  },

  // ============================================
  // TEXT COLORS
  // ============================================
  text: {
    primary: '#F5F5F5',
    secondary: '#A3A3A3',
    tertiary: '#737373',
    disabled: '#525252',
    placeholder: '#525252',
    inverse: '#171717',
    link: '#60A5FA',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
  },

  // ============================================
  // BORDER COLORS
  // ============================================
  border: {
    light: '#333333',
    default: '#404040',
    dark: '#525252',
    focus: '#F5F5F5',
    error: '#F87171',
    success: '#4ADE80',
  },

  // ============================================
  // ICON COLORS
  // ============================================
  icon: {
    primary: '#F5F5F5',
    secondary: '#A3A3A3',
    tertiary: '#737373',
    disabled: '#525252',
    inverse: '#171717',
    accent: '#60A5FA',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
  },

  // ============================================
  // STATUS COLORS (Para badges y estados)
  // ============================================
  status: {
    active: {
      background: '#166534',
      text: '#BBF7D0',
      border: '#22C55E',
    },
    pending: {
      background: '#92400E',
      text: '#FDE68A',
      border: '#F59E0B',
    },
    draft: {
      background: '#333333',
      text: '#A3A3A3',
      border: '#525252',
    },
    completed: {
      background: '#1E40AF',
      text: '#BFDBFE',
      border: '#3B82F6',
    },
    cancelled: {
      background: '#991B1B',
      text: '#FECACA',
      border: '#EF4444',
    },
    overdue: {
      background: '#7F1D1D',
      text: '#FEE2E2',
      border: '#DC2626',
    },
    paid: {
      background: '#065F46',
      text: '#A7F3D0',
      border: '#10B981',
    },
    partial: {
      background: '#78350F',
      text: '#FEF3C7',
      border: '#D97706',
    },
  },

  // ============================================
  // OVERLAY
  // ============================================
  overlay: {
    light: 'rgba(0, 0, 0, 0.5)',
    medium: 'rgba(0, 0, 0, 0.7)',
    dark: 'rgba(0, 0, 0, 0.85)',
  },

  // ============================================
  // SHADOWS (para sombras con color)
  // ============================================
  shadow: {
    color: '#000000',
  },
} as const;

export type DarkColors = typeof darkColors;
export default darkColors;
