/**
 * Design System - Color Tokens
 *
 * Paleta de colores profesional con negro como color principal.
 * Diseño moderno y elegante.
 */

export const colors = {
  // ============================================
  // PRIMARY - Negro como color principal
  // ============================================
  primary: {
    50: '#F8F8F8',
    100: '#F0F0F0',
    200: '#E4E4E4',
    300: '#D1D1D1',
    400: '#A1A1A1',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0A0A0A',
  },

  // ============================================
  // ACCENT - Azul moderno para acentos
  // ============================================
  accent: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },

  // ============================================
  // SEMANTIC COLORS
  // ============================================
  success: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
  },

  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },

  danger: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
  },

  info: {
    50: '#F0F9FF',
    100: '#E0F2FE',
    200: '#BAE6FD',
    300: '#7DD3FC',
    400: '#38BDF8',
    500: '#0EA5E9',
    600: '#0284C7',
    700: '#0369A1',
    800: '#075985',
    900: '#0C4A6E',
  },

  // ============================================
  // NEUTRALS - Grises para fondos y bordes
  // ============================================
  neutral: {
    0: '#FFFFFF',
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0A0A0A',
  },

  // ============================================
  // BACKGROUND COLORS
  // ============================================
  background: {
    primary: '#FFFFFF',
    secondary: '#FAFAFA',
    tertiary: '#F5F5F5',
    inverse: '#171717',
    elevated: '#FFFFFF',
  },

  // ============================================
  // SURFACE COLORS (Cards, Modals, etc.)
  // ============================================
  surface: {
    primary: '#FFFFFF',
    secondary: '#FAFAFA',
    tertiary: '#F5F5F5',
    inverse: '#262626',
    elevated: '#FFFFFF',
    hover: '#F5F5F5',
    pressed: '#E5E5E5',
    disabled: '#FAFAFA',
  },

  // ============================================
  // TEXT COLORS
  // ============================================
  text: {
    primary: '#171717',
    secondary: '#525252',
    tertiary: '#737373',
    disabled: '#A3A3A3',
    placeholder: '#A3A3A3',
    inverse: '#FFFFFF',
    link: '#3B82F6',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
  },

  // ============================================
  // BORDER COLORS
  // ============================================
  border: {
    light: '#E5E5E5',
    default: '#D4D4D4',
    dark: '#A3A3A3',
    focus: '#171717',
    error: '#EF4444',
    success: '#22C55E',
  },

  // ============================================
  // ICON COLORS
  // ============================================
  icon: {
    primary: '#171717',
    secondary: '#525252',
    tertiary: '#737373',
    disabled: '#A3A3A3',
    inverse: '#FFFFFF',
    accent: '#3B82F6',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
  },

  // ============================================
  // STATUS COLORS (Para badges y estados)
  // ============================================
  status: {
    active: {
      background: '#DCFCE7',
      text: '#166534',
      border: '#22C55E',
    },
    pending: {
      background: '#FEF3C7',
      text: '#92400E',
      border: '#F59E0B',
    },
    draft: {
      background: '#F5F5F5',
      text: '#525252',
      border: '#D4D4D4',
    },
    completed: {
      background: '#DBEAFE',
      text: '#1E40AF',
      border: '#3B82F6',
    },
    cancelled: {
      background: '#FEE2E2',
      text: '#991B1B',
      border: '#EF4444',
    },
    overdue: {
      background: '#FEE2E2',
      text: '#7F1D1D',
      border: '#DC2626',
    },
    paid: {
      background: '#D1FAE5',
      text: '#065F46',
      border: '#10B981',
    },
    partial: {
      background: '#FEF3C7',
      text: '#78350F',
      border: '#D97706',
    },
  },

  // ============================================
  // OVERLAY
  // ============================================
  overlay: {
    light: 'rgba(0, 0, 0, 0.3)',
    medium: 'rgba(0, 0, 0, 0.5)',
    dark: 'rgba(0, 0, 0, 0.7)',
  },

  // ============================================
  // SHADOWS (para sombras con color)
  // ============================================
  shadow: {
    color: '#000000',
  },
} as const;

export type Colors = typeof colors;
export default colors;
