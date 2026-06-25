import { Platform } from 'react-native';
import type { AppUpdatePlatform } from '@/types/appUpdates';

const DEFAULT_APP_ID = 'e28208b8-89b4-4682-80dc-925059424b1f';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const envAppId = process.env.EXPO_PUBLIC_APP_ID;
const resolvedAppId = envAppId && UUID_REGEX.test(envAppId) ? envAppId : DEFAULT_APP_ID;

if (envAppId && !UUID_REGEX.test(envAppId)) {
  console.warn(
    `⚠️ [CONFIG] EXPO_PUBLIC_APP_ID inválido ("${envAppId}"). Usando APP_ID por defecto UUID.`
  );
}

export const APP_SLUG = process.env.EXPO_PUBLIC_APP_SLUG || 'pos';

export function getUpdatePlatform(): AppUpdatePlatform {
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const w = window as unknown as {
        electronAPI?: { platform?: NodeJS.Platform | string };
      };
      const electronPlatform = w.electronAPI?.platform;
      if (electronPlatform === 'win32') return 'windows';
      if (electronPlatform === 'darwin') return 'mac';
      if (electronPlatform === 'linux') return 'linux';
    }
    return 'web';
  }
  return 'web';
}

export const config = {
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'https://pos-erp-aio.com',
  API_TIMEOUT: 30000,
  APP_ID: resolvedAppId,
  APP_SLUG,

  STORAGE_KEYS: {
    // Secure storage keys (expo-secure-store) - for sensitive data
    AUTH_TOKEN: 'auth_token',
    REFRESH_TOKEN: 'refresh_token',
    TOKEN_EXPIRES_AT: 'token_expires_at',
    REMEMBER_ME: 'remember_me',

    // AsyncStorage keys - for non-sensitive data
    USER: '@caja:user',
    CURRENT_COMPANY: '@caja:current_company',
    CURRENT_SITE: '@caja:current_site',
    SELECTED_CASH_REGISTER: '@caja:selected_cash_register',
    LAST_EMAIL: '@caja:last_email',
  },
} as const;

export default config;
