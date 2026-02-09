import { logger } from './logger';

/**
 * Analytics Tracking Utility
 */

export interface AnalyticsEvent {
  name: string;
  params?: Record<string, any>;
  timestamp?: number;
}

export interface ScreenViewEvent {
  screenName: string;
  screenClass?: string;
  params?: Record<string, any>;
}

export const trackEvent = async (
  eventName: string,
  params?: Record<string, any>
): Promise<void> => {
  try {
    const event: AnalyticsEvent = {
      name: eventName,
      params,
      timestamp: Date.now(),
    };

    if (__DEV__) {
      logger.info(`📊 Analytics Event: ${eventName}`, params);
    }
  } catch (error) {
    logger.error('Analytics tracking error', error);
  }
};

export const trackScreen = async (
  screenName: string,
  screenClass?: string,
  params?: Record<string, any>
): Promise<void> => {
  try {
    const event: ScreenViewEvent = {
      screenName,
      screenClass: screenClass || screenName,
      params,
    };

    if (__DEV__) {
      logger.info(`📱 Screen View: ${screenName}`, params);
    }
  } catch (error) {
    logger.error('Screen tracking error', error);
  }
};

export const trackLogin = (method: string = 'email') => {
  trackEvent('user_login', { method });
};

export const trackLogout = () => {
  trackEvent('user_logout');
};

export const trackLoginFailed = (reason?: string) => {
  trackEvent('login_failed', { reason });
};
