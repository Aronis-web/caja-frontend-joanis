/**
 * Design System Components - Main Exports
 */

// ============================================
// PRIMITIVES
// ============================================
export {
  // Text
  Text,
  DisplayText,
  Heading,
  Title,
  Body,
  Label,
  Caption,
  Numeric,
  // Button
  Button,
  // Card
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardDivider,
  // Input
  Input,
  // Badge
  Badge,
  StatusBadge,
  CounterBadge,
  // IconButton
  IconButton,
  // Avatar
  Avatar,
  AvatarGroup,
  // Divider
  Divider,
  // Chip
  Chip,
  ChipGroup,
} from './primitives';

export type {
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
} from './primitives';

// ============================================
// LAYOUT
// ============================================
export { ScreenHeader, LargeHeader, ScreenContainer, Section, Row, Spacer } from './layout';

export type {
  ScreenHeaderProps,
  ScreenHeaderAction,
  LargeHeaderProps,
  ScreenContainerProps,
  SectionProps,
  RowProps,
  SpacerProps,
} from './layout';

// ============================================
// PATTERNS
// ============================================
export {
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
} from './patterns';

export type {
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
} from './patterns';
