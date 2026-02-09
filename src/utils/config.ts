export const config = {
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080',
  API_TIMEOUT: 30000,
  APP_ID: process.env.EXPO_PUBLIC_APP_ID || 'e28208b8-89b4-4682-80dc-925059424b1f',

  // Sentry Configuration
  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  SENTRY_ENABLED: process.env.EXPO_PUBLIC_SENTRY_ENABLED === 'true',
  ENVIRONMENT: process.env.EXPO_PUBLIC_ENVIRONMENT || 'production',
  APP_VERSION: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
  BUILD_NUMBER: process.env.EXPO_PUBLIC_BUILD_NUMBER || '1',

  STORAGE_KEYS: {
    // Secure storage keys (expo-secure-store) - for sensitive data
    AUTH_TOKEN: 'auth_token',
    REFRESH_TOKEN: 'refresh_token',
    TOKEN_EXPIRES_AT: 'token_expires_at',
    REMEMBER_ME: 'remember_me',

    // AsyncStorage keys - for non-sensitive data
    USER: '@joanis:user',
    CURRENT_COMPANY: '@joanis:current_company',
    CURRENT_SITE: '@joanis:current_site',
  },
} as const;

export default config;
