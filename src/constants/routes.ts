/**
 * Route Constants
 */

export const AUTH_ROUTES = {
  LOGIN: 'Login',
} as const;

export const MAIN_ROUTES = {
  HOME: 'Home',
} as const;

export const ROUTES = {
  ...AUTH_ROUTES,
  ...MAIN_ROUTES,
} as const;
