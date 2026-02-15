import { AUTH_ROUTES, MAIN_ROUTES } from '@/constants/routes';

export type AuthStackParamList = {
  [AUTH_ROUTES.LOGIN]: undefined;
};

export type MainStackParamList = {
  [MAIN_ROUTES.HOME]: undefined;
};

export type RootStackParamList = AuthStackParamList & MainStackParamList;
