import { colors } from '@/theme/colors';
import { spacing, borderRadius, fontSize } from '@/theme/spacing';

export const theme = {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fonts: {
    bold: 'Baloo2_700Bold',
    semibold: 'Baloo2_600SemiBold',
    medium: 'Baloo2_500Medium',
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.18,
      shadowRadius: 1.0,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.23,
      shadowRadius: 2.62,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
      elevation: 8,
    },
  },
} as const;

export type Theme = typeof theme;

export default theme;
