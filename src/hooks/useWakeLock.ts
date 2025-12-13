import { useEffect, useRef, useCallback } from 'react';

export const useWakeLock = (enabled: boolean = true) => {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    if (!enabled) return;
    
    // Check if Wake Lock API is supported
    if (!('wakeLock' in navigator)) {
      console.log('Wake Lock API not supported');
      return;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      console.log('Wake Lock activated');
      
      wakeLockRef.current.addEventListener('release', () => {
        console.log('Wake Lock released');
      });
    } catch (err) {
      console.log('Wake Lock request failed:', err);
    }
  }, [enabled]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.log('Wake Lock release failed:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    // Re-acquire wake lock when returning to the app
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [enabled, requestWakeLock, releaseWakeLock]);

  return { requestWakeLock, releaseWakeLock };
};
