import * as Sentry from '@sentry/react-native';
import { config } from '@/utils/config';

/**
 * Sentry Configuration for Error Tracking
 */

export const initSentry = () => {
  const shouldInitialize = !__DEV__ || config.SENTRY_ENABLED;

  if (!shouldInitialize) {
    console.log('🔕 Sentry disabled in development');
    return;
  }

  const sentryDsn = config.SENTRY_DSN;

  if (!sentryDsn) {
    console.warn('⚠️ Sentry DSN not configured. Skipping Sentry initialization.');
    return;
  }

  try {
    Sentry.init({
      dsn: sentryDsn,
      environment: config.ENVIRONMENT || (__DEV__ ? 'development' : 'production'),
      release: config.APP_VERSION,
      dist: config.BUILD_NUMBER,
      tracesSampleRate: __DEV__ ? 1.0 : 0.2,
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,
      enableNative: true,
      enableNativeCrashHandling: true,
      enableNativeNagger: false,
      maxBreadcrumbs: 100,
      attachStacktrace: true,
      enableAutoPerformanceTracing: true,
      enableOutOfMemoryTracking: true,

      beforeSend(event, hint) {
        if (event.request) {
          if (event.request.headers) {
            delete event.request.headers['Authorization'];
            delete event.request.headers['X-Auth-Token'];
          }
        }

        if (event.extra) {
          delete event.extra.token;
          delete event.extra.password;
          delete event.extra.apiKey;
        }

        return event;
      },

      beforeBreadcrumb(breadcrumb, hint) {
        if (!__DEV__ && breadcrumb.category === 'console') {
          return null;
        }
        return breadcrumb;
      },
    });

    console.log('✅ Sentry initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Sentry:', error);
  }
};

export const setSentryUser = (user: {
  id: string;
  email?: string;
  username?: string;
  companyId?: string;
  siteId?: string;
}) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });

  Sentry.setContext('company', {
    companyId: user.companyId,
  });

  Sentry.setContext('site', {
    siteId: user.siteId,
  });
};

export const clearSentryUser = () => {
  Sentry.setUser(null);
  Sentry.setContext('company', null);
  Sentry.setContext('site', null);
};

export const addSentryBreadcrumb = (
  message: string,
  category: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info',
  data?: Record<string, any>
) => {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
};

export const captureException = (error: Error, context?: Record<string, any>) => {
  if (context) {
    Sentry.setContext('error_context', context);
  }
  Sentry.captureException(error);
};

export const captureMessage = (
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info',
  context?: Record<string, any>
) => {
  if (context) {
    Sentry.setContext('message_context', context);
  }
  Sentry.captureMessage(message, level);
};

export default Sentry;
