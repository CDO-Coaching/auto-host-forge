import { useState, useEffect, useCallback, useRef } from 'react';
import { SoundSystem } from '@/lib/soundSystem';

interface TimerState {
  [key: string]: {
    startTime: number | null;
    targetTime: number;
    pausedTime: number;
    isRunning: boolean;
  };
}

export function useRecoveryTimer() {
  const [timers, setTimers] = useState<{ [key: string]: number }>({});
  const [isRunning, setIsRunning] = useState<{ [key: string]: boolean }>({});
  const stateRef = useRef<TimerState>({});
  const intervalsRef = useRef<{ [key: string]: ReturnType<typeof setInterval> }>({});
  // Signaux sonores (bips décompte + fin de récup), comme les autres minuteurs.
  const soundRef = useRef<SoundSystem | null>(null);
  const lastWholeRef = useRef<{ [key: string]: number }>({});

  // Gérer la visibilité de la page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        Object.keys(stateRef.current).forEach((id) => {
          if (stateRef.current[id].isRunning) {
            updateTimer(id);
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      Object.values(intervalsRef.current).forEach(clearInterval);
      try { soundRef.current?.close(); soundRef.current = null; } catch { /* ignore */ }
    };
  }, []);

  const parseRecuperationTime = (timeStr: string): number => {
    if (!timeStr) return 0;
    let totalSeconds = 0;
    const minMatch = timeStr.match(/(\d+)min/);
    const secMatch = timeStr.match(/(\d+)s/);
    if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
    if (secMatch) totalSeconds += parseInt(secMatch[1]);
    return totalSeconds;
  };

  const updateTimer = useCallback((id: string) => {
    const state = stateRef.current[id];
    if (!state || !state.startTime) return;

    const now = Date.now();
    const elapsed = Math.floor((now - state.startTime) / 1000);
    const remaining = Math.max(0, state.targetTime - elapsed);

    setTimers((prev) => ({ ...prev, [id]: remaining }));

    // Signal à 10 s de la fin (préavis) + signal de fin (une fois par seconde franchie)
    if (lastWholeRef.current[id] !== remaining) {
      if (remaining === 10) {
        try { soundRef.current?.beep(880, 0.12); } catch { /* ignore */ }
      } else if (remaining === 0) {
        try { soundRef.current?.go(); } catch { /* ignore */ }
      }
      lastWholeRef.current[id] = remaining;
    }

    if (remaining === 0) {
      pauseTimer(id);
    }
  }, []);

  const startTimer = useCallback((id: string, recuperation: string) => {
    if (intervalsRef.current[id]) {
      clearInterval(intervalsRef.current[id]);
    }

    const targetSeconds = parseRecuperationTime(recuperation);
    const now = Date.now();

    // Prépare l'audio dans le geste utilisateur (démarrage de récup) pour autoriser le son.
    if (!soundRef.current) {
      try { soundRef.current = new SoundSystem('gym'); } catch { /* audio indispo */ }
    }
    // Débloque l'audio synthétisé sans jouer de clip (évite le son de fin au lancement).
    soundRef.current?.prime?.();
    lastWholeRef.current[id] = targetSeconds;

    if (!stateRef.current[id] || stateRef.current[id].pausedTime === 0) {
      // Nouveau démarrage
      stateRef.current[id] = {
        startTime: now,
        targetTime: targetSeconds,
        pausedTime: 0,
        isRunning: true,
      };
    } else {
      // Reprendre après pause
      const pausedTime = stateRef.current[id].pausedTime;
      stateRef.current[id] = {
        ...stateRef.current[id],
        startTime: now - (stateRef.current[id].targetTime - pausedTime) * 1000,
        isRunning: true,
      };
    }

    setTimers((prev) => ({ ...prev, [id]: targetSeconds }));
    setIsRunning((prev) => ({ ...prev, [id]: true }));

    const interval = setInterval(() => updateTimer(id), 100);
    intervalsRef.current[id] = interval;
    updateTimer(id);
  }, [updateTimer]);

  const pauseTimer = useCallback((id: string) => {
    if (intervalsRef.current[id]) {
      clearInterval(intervalsRef.current[id]);
      delete intervalsRef.current[id];
    }

    if (stateRef.current[id]) {
      const state = stateRef.current[id];
      if (state.startTime) {
        const now = Date.now();
        const elapsed = Math.floor((now - state.startTime) / 1000);
        const remaining = Math.max(0, state.targetTime - elapsed);
        stateRef.current[id].pausedTime = remaining;
      }
      stateRef.current[id].isRunning = false;
    }

    setIsRunning((prev) => ({ ...prev, [id]: false }));
  }, []);

  const resetTimer = useCallback((id: string) => {
    if (intervalsRef.current[id]) {
      clearInterval(intervalsRef.current[id]);
      delete intervalsRef.current[id];
    }

    delete stateRef.current[id];
    setTimers((prev) => ({ ...prev, [id]: 0 }));
    setIsRunning((prev) => ({ ...prev, [id]: false }));
  }, []);

  const initializeTimer = useCallback((id: string) => {
    setTimers((prev) => ({ ...prev, [id]: 0 }));
    setIsRunning((prev) => ({ ...prev, [id]: false }));
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return {
    timers,
    isRunning,
    startTimer,
    pauseTimer,
    resetTimer,
    initializeTimer,
    formatTime,
  };
}
