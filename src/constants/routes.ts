/**
 * Route Constants
 */

export const AUTH_ROUTES = {
  LOGIN: 'Login',
} as const;

export const SELECTION_ROUTES = {
  COMPANY_SELECTION: 'CompanySelection',
  SITE_SELECTION: 'SiteSelection',
} as const;

export const MAIN_ROUTES = {
  HOME: 'Home',
} as const;

export const ROUTES = {
  ...AUTH_ROUTES,
  ...SELECTION_ROUTES,
  ...MAIN_ROUTES,
} as const;
