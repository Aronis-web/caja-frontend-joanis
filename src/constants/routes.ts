/**
 * Route Constants
 */

/**
 * Authentication Routes
 */
export const AUTH_ROUTES = {
  LOGIN: 'Login',
} as const;

/**
 * Main Application Routes
 */
export const MAIN_ROUTES = {
  HOME: 'Home',
} as const;

/**
 * All Routes Combined
 */
export const ROUTES = {
  ...AUTH_ROUTES,
  ...MAIN_ROUTES,
} as const;

/**
 * Helper function to get route name from constant
 */
export function getRouteName<T extends keyof typeof ROUTES>(routeKey: T): (typeof ROUTES)[T] {
  return ROUTES[routeKey];
}

/**
 * Helper function to check if a route requires authentication
 */
export function isAuthRoute(routeName: string): boolean {
  return Object.values(AUTH_ROUTES).includes(routeName as any);
}

/**
 * Helper function to check if a route is in the main app
 */
export function isMainRoute(routeName: string): boolean {
  return Object.values(MAIN_ROUTES).includes(routeName as any);
}
