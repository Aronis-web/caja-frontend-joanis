import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth';

/**
 * Hook to automatically refresh the session token before it expires
 */
export const useSessionWarning = () => {
  const { tokenExpiresAt, isAuthenticated, refreshAccessToken } = useAuthStore();
  const lastRefreshAttemptRef = useRef<number>(0);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !tokenExpiresAt) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      lastRefreshAttemptRef.current = 0;
      return;
    }

    checkIntervalRef.current = setInterval(async () => {
      const now = Date.now();
      const timeUntilExpiry = tokenExpiresAt - now;
      const tenMinutes = 10 * 60 * 1000;
      const timeSinceLastRefresh = now - lastRefreshAttemptRef.current;
      const minTimeBetweenRefreshes = 2 * 60 * 1000;

      if (
        timeUntilExpiry > 0 &&
        timeUntilExpiry <= tenMinutes &&
        timeSinceLastRefresh >= minTimeBetweenRefreshes
      ) {
        lastRefreshAttemptRef.current = now;

        const minutesRemaining = Math.ceil(timeUntilExpiry / 60000);
        console.log(
          `🔄 Auto-refreshing token (${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''} remaining)...`
        );

        try {
          const success = await refreshAccessToken();
          if (success) {
            console.log('✅ Token auto-refreshed successfully');
          } else {
            console.error('❌ Token auto-refresh failed');
          }
        } catch (error) {
          console.error('❌ Error auto-refreshing token:', error);
        }
      }

      if (timeUntilExpiry > tenMinutes) {
        lastRefreshAttemptRef.current = 0;
      }
    }, 30000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [tokenExpiresAt, isAuthenticated, refreshAccessToken]);
};

export default useSessionWarning;
