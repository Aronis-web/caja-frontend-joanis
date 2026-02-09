import { useEffect, useRef } from 'react';
import { trackScreen } from '@/utils/analytics';
import { logger } from '@/utils/logger';
import * as Sentry from '@sentry/react-native';

/**
 * Hook to automatically track screen views and time spent on screen
 */
export const useScreenTracking = (
  screenName: string,
  screenClass?: string,
  params?: Record<string, any>
) => {
  const startTime = useRef(Date.now());
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!hasTracked.current) {
      trackScreen(screenName, screenClass, params);
      hasTracked.current = true;

      Sentry.addBreadcrumb({
        category: 'navigation',
        message: `Screen viewed: ${screenName}`,
        level: 'info',
        data: params,
      });

      if (__DEV__) {
        logger.info(`📱 Screen Tracking: ${screenName}`, params);
      }
    }

    return () => {
      const timeSpent = Date.now() - startTime.current;
      const timeSpentSeconds = Math.round(timeSpent / 1000);

      if (__DEV__) {
        logger.info(`⏱️ Time on ${screenName}: ${timeSpentSeconds}s`);
      }

      Sentry.addBreadcrumb({
        category: 'navigation',
        message: `Time on ${screenName}: ${timeSpentSeconds}s`,
        level: 'info',
        data: {
          screen_name: screenName,
          duration_seconds: timeSpentSeconds,
          duration_ms: timeSpent,
        },
      });
    };
  }, [screenName, screenClass, params]);
};
