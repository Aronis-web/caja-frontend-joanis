/**
 * Route Constants
 */

export const AUTH_ROUTES = {
  LOGIN: 'Login',
} as const;

export const SELECTION_ROUTES = {
  COMPANY_SELECTION: 'CompanySelection',
  SITE_SELECTION: 'SiteSelection',
  CASH_REGISTER_SELECTION: 'CashRegisterSelection',
} as const;

export const POS_ROUTES = {
  POS_DASHBOARD: 'POSDashboard',
  OPEN_SESSION: 'OpenSession',
  CLOSE_SESSION: 'CloseSession',
  NEW_SALE: 'NewSale',
  SALE_DETAIL: 'SaleDetail',
  CASH_TRANSACTION: 'CashTransaction',
} as const;

export const MAIN_ROUTES = {
  HOME: 'Home',
} as const;

export const ROUTES = {
  ...AUTH_ROUTES,
  ...SELECTION_ROUTES,
  ...POS_ROUTES,
  ...MAIN_ROUTES,
} as const;
