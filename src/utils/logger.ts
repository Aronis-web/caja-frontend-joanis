/**
 * Production-Safe Logger Utility
 *
 * Conditional logging based on environment:
 * - Development: All logs enabled
 * - Production: Only errors and critical warnings
 */

import { captureException, captureMessage, addSentryBreadcrumb } from '@/config/sentry';

// Determine environment
const isDevelopment = __DEV__;
const isProduction = !__DEV__;

/**
 * Format log message with timestamp and context
 */
function formatMessage(level: string, ...args: any[]): any[] {
  if (!isDevelopment) {
    return args;
  }
  const timestamp = new Date().toISOString();
  return [`[${timestamp}] [${level}]`, ...args];
}

/**
 * Sanitize sensitive data from logs
 */
function sanitizeArgs(args: any[]): any[] {
  if (!isProduction) {
    return args;
  }

  return args.map((arg) => {
    if (typeof arg === 'object' && arg !== null) {
      const sanitized = { ...arg };

      const sensitiveKeys = [
        'token',
        'password',
        'accessToken',
        'refreshToken',
        'authorization',
        'apiKey',
        'secret',
        'credential',
      ];

      for (const key in sanitized) {
        if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
          sanitized[key] = '[REDACTED]';
        }
      }

      return sanitized;
    }
    return arg;
  });
}

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...formatMessage('LOG', ...args));
    }
  },

  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...formatMessage('INFO', ...args));
    }
    if (typeof args[0] === 'string') {
      addSentryBreadcrumb(args[0], 'info', 'info', args[1]);
    }
  },

  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...formatMessage('WARN', ...args));
    } else if (isProduction) {
      const message = args[0];
      if (
        typeof message === 'string' &&
        (message.includes('CRITICAL') || message.includes('Security') || message.includes('Auth'))
      ) {
        console.warn(...formatMessage('WARN', ...sanitizeArgs(args)));
        captureMessage(message, 'warning', args[1]);
      }
    }
  },

  error: (...args: any[]) => {
    console.error(...formatMessage('ERROR', ...sanitizeArgs(args)));

    if (args[0] instanceof Error) {
      const error = args[0];
      const context = args[1] && typeof args[1] === 'object' ? args[1] : undefined;
      captureException(error, context);
    } else if (typeof args[0] === 'string') {
      captureMessage(args[0], 'error', args[1]);
    }
  },

  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...formatMessage('DEBUG', ...args));
    }
  },

  perf: (label: string, startTime: number) => {
    if (isDevelopment) {
      const duration = Date.now() - startTime;
      console.log(...formatMessage('PERF', `${label}: ${duration}ms`));
    }
  },

  security: (...args: any[]) => {
    console.log(...formatMessage('SECURITY', ...sanitizeArgs(args)));
  },
};

export default logger;
