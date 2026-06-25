/**
 * Design System - Main Entry Point
 *
 * Sistema de diseño unificado para la aplicación.
 * Exporta todos los tokens y componentes.
 */

// ============================================
// TOKENS
// ============================================
export {
  // Colors
  colors,
  // Typography
  fontFamilies,
  fontSizes,
  lineHeights,
  fontWeights,
  letterSpacing,
  textVariants,
  // Spacing
  spacing,
  semanticSpacing,
  borderRadius,
  semanticBorderRadius,
  iconSizes,
  avatarSizes,
  touchTargets,
  zIndex,
  // Shadows
  shadows,
  semanticShadows,
  innerShadows,
  glowEffects,
  // Animations
  durations,
  easings,
  springConfigs,
  semanticAnimations,
  activeOpacity,
  // Consolidated theme object
  designTokens,
} from './tokens';

export type {
  Colors,
  TextVariants,
  TextVariantKey,
  Spacing,
  BorderRadius,
  Shadows,
  SemanticShadows,
  Durations,
  SpringConfigs,
  DesignTokens,
} from './tokens';

// ============================================
// COMPONENTS
// ============================================
export {
  // Primitives
  Text,
  DisplayText,
  Heading,
  Title,
  Body,
  Label,
  Caption,
  Numeric,
  Button,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardDivider,
  Input,
  Badge,
  StatusBadge,
  CounterBadge,
  IconButton,
  Avatar,
  AvatarGroup,
  Divider,
  Chip,
  ChipGroup,
  // Layout
  ScreenHeader,
  LargeHeader,
  ScreenContainer,
  Section,
  Row,
  Spacer,
  // Patterns
  SearchBar,
  SearchWithFilters,
  EmptyState,
  ErrorState,
  NoResultsState,
  NoConnectionState,
  ListItem,
  ListSectionHeader,
  FAB,
  FABGroup,
  Pagination,
} from './components';

export type {
  // Primitives
  TextProps,
  ButtonProps,
  ButtonVariant,
  ButtonSize,
  CardProps,
  CardVariant,
  CardPadding,
  CardHeaderProps,
  CardContentProps,
  CardFooterProps,
  CardDividerProps,
  InputProps,
  InputSize,
  BadgeProps,
  BadgeVariant,
  BadgeSize,
  StatusBadgeProps,
  CounterBadgeProps,
  IconButtonProps,
  IconButtonVariant,
  IconButtonSize,
  AvatarProps,
  AvatarSize,
  AvatarGroupProps,
  DividerProps,
  ChipProps,
  ChipVariant,
  ChipSize,
  ChipGroupProps,
  // Layout
  ScreenHeaderProps,
  ScreenHeaderAction,
  LargeHeaderProps,
  ScreenContainerProps,
  SectionProps,
  RowProps,
  SpacerProps,
  // Patterns
  SearchBarProps,
  SearchWithFiltersProps,
  EmptyStateProps,
  ErrorStateProps,
  NoResultsStateProps,
  NoConnectionStateProps,
  ListItemProps,
  ListSectionHeaderProps,
  FABProps,
  FABSize,
  FABVariant,
  FABGroupProps,
  FABAction,
  PaginationProps,
} from './components';

// ============================================
// THEMES (semantic theming + provider)
// ============================================
export {
  defaultLight,
  defaultDark,
  themes,
  ThemeProvider,
  useTheme,
  useThemeValue,
  useThemeActions,
  useThemedStyles,
  useThemeStore,
} from './themes';
export type { Theme, ThemeName, ThemeMode } from './themes';

// ============================================
// LAYOUT (floating footer registry)
// ============================================
export {
  FloatingFooterProvider,
  getFloatingActionBottomOffset,
  useFloatingActionBottomOffset,
  useFloatingFooterHeight,
  useRegisterFloatingFooter,
  useMeasuredFloatingFooter,
} from './layout/FloatingFooterProvider';

// ============================================
// DEFAULT EXPORT
// ============================================
import { designTokens } from './tokens';
export default designTokens;
