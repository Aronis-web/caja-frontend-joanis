/**
 * Navigation Type Definitions
 */

import { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Auth Stack Parameter List
 */
export type AuthStackParamList = {
  Login: undefined;
};

/**
 * Main Stack Parameter List
 */
export type MainStackParamList = {
  Home: undefined;
};

/**
 * Root Stack Parameter List
 */
export type RootStackParamList = AuthStackParamList & MainStackParamList;

/**
 * Screen Props Type Helpers
 */
export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

/**
 * Navigation Prop Type Helper
 */
export type NavigationProp = NativeStackScreenProps<RootStackParamList>['navigation'];

/**
 * Route Prop Type Helper
 */
export type RouteProp<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>['route'];
