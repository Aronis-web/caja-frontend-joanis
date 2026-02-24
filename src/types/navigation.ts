import { AUTH_ROUTES, SELECTION_ROUTES, POS_ROUTES, MAIN_ROUTES } from '@/constants/routes';

export type AuthStackParamList = {
  [AUTH_ROUTES.LOGIN]: undefined;
};

export type SelectionStackParamList = {
  [SELECTION_ROUTES.COMPANY_SELECTION]: undefined;
  [SELECTION_ROUTES.SITE_SELECTION]: undefined;
  [SELECTION_ROUTES.CASH_REGISTER_SELECTION]: undefined;
};

export type POSStackParamList = {
  [POS_ROUTES.POS_DASHBOARD]: undefined;
  [POS_ROUTES.OPEN_SESSION]: undefined;
  [POS_ROUTES.CLOSE_SESSION]: undefined;
  [POS_ROUTES.NEW_SALE]: undefined;
  [POS_ROUTES.SALE_DETAIL]: { saleId: string };
  [POS_ROUTES.CASH_TRANSACTION]: { type: 'cash_in' | 'cash_out' };
};

export type MainStackParamList = {
  [MAIN_ROUTES.HOME]: undefined;
};

export type RootStackParamList = AuthStackParamList &
  SelectionStackParamList &
  POSStackParamList &
  MainStackParamList;
