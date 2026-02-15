export const config = {
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080',
  API_TIMEOUT: 30000,
  APP_ID: process.env.EXPO_PUBLIC_APP_ID || 'e28208b8-89b4-4682-80dc-925059424b1f',

  STORAGE_KEYS: {
    // Secure storage keys (expo-secure-store) - for sensitive data
    AUTH_TOKEN: 'auth_token',
    REFRESH_TOKEN: 'refresh_token',
    TOKEN_EXPIRES_AT: 'token_expires_at',
    REMEMBER_ME: 'remember_me',

    // AsyncStorage keys - for non-sensitive data
    USER: '@caja:user',
  },
} as const;

export default config;
