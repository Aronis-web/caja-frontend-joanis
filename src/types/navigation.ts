import { AUTH_ROUTES, SELECTION_ROUTES, MAIN_ROUTES } from '@/constants/routes';

export type AuthStackParamList = {
  [AUTH_ROUTES.LOGIN]: undefined;
};

export type SelectionStackParamList = {
  [SELECTION_ROUTES.COMPANY_SELECTION]: undefined;
  [SELECTION_ROUTES.SITE_SELECTION]: undefined;
};

export type MainStackParamList = {
  [MAIN_ROUTES.HOME]: undefined;
};

export type RootStackParamList = AuthStackParamList & SelectionStackParamList & MainStackParamList;
