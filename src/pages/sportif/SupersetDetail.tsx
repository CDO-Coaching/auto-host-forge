import { useState, useEffect, useCallback, useRef } from "react";

interface TimerState {
  remainingSeconds: number;
  startTimestamp: number | null;
  targetDuration: number;
  isRunning: boolean;
}

export function useRecoveryTimer() {
  const [timers, setTimers] = useState<{ [key: string]: number }>({});
  const [isRunning, setIsRunning] = useState<{ [key: string]: boolean }>({});
  const timerStatesRef = useRef<{ [key: string]: TimerState }>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Charger les états sauvegardés au démarrage
  useEffect(() => {
    const savedStates = localStorage.getItem("recovery-timers");
    if (savedStates) {
      try {
        const parsed = JSON.parse(savedStates);
        timerStatesRef.current = parsed;

        // Recalculer les temps restants basés sur le timestamp actuel
        const now = Date.now();
        const newTimers: { [key: string]: number } = {};
        const newIsRunning: { [key: string]: boolean } = {};

        Object.keys(parsed).forEach((key) => {
          const state = parsed[key];
          if (state.isRunning && state.startTimestamp) {
            const elapsedSeconds = Math.floor((now - state.startTimestamp) / 1000);
            const remaining = Math.max(0, state.targetDuration - elapsedSeconds);
            newTimers[key] = remaining;
            newIsRunning[key] = remaining > 0;

            // Si le timer est terminé, le marquer comme non actif
            if (remaining === 0) {
              timerStatesRef.current[key].isRunning = false;
            }
          } else {
            newTimers[key] = state.remainingSeconds;
            newIsRunning[key] = false;
          }
        });

        setTimers(newTimers);
        setIsRunning(newIsRunning);
      } catch (error) {
        console.error("Erreur lors de la restauration des timers:", error);
      }
    }
  }, []);

  // Sauvegarder les états dans localStorage
  const saveStates = useCallback(() => {
    localStorage.setItem("recovery-timers", JSON.stringify(timerStatesRef.current));
  }, []);

  // Boucle de mise à jour basée sur les timestamps
  useEffect(() => {
    const updateTimers = () => {
      const now = Date.now();
      let hasActiveTimer = false;

      setTimers((prev) => {
        const updated = { ...prev };

        Object.keys(timerStatesRef.current).forEach((key) => {
          const state = timerStatesRef.current[key];

          if (state.isRunning && state.startTimestamp) {
            const elapsedSeconds = Math.floor((now - state.startTimestamp) / 1000);
            const remaining = Math.max(0, state.targetDuration - elapsedSeconds);

            updated[key] = remaining;

            if (remaining > 0) {
              hasActiveTimer = true;
            } else {
              // Timer terminé
              timerStatesRef.current[key].isRunning = false;
              timerStatesRef.current[key].remainingSeconds = 0;
              setIsRunning((prev) => ({ ...prev, [key]: false }));
            }
          }
        });

        return updated;
      });

      // Arrêter l'interval si aucun timer n'est actif
      if (!hasActiveTimer && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      saveStates();
    };

    // Démarrer l'interval seulement si au moins un timer est actif
    const hasActiveTimer = Object.values(timerStatesRef.current).some((state) => state.isRunning);

    if (hasActiveTimer && !intervalRef.current) {
      intervalRef.current = setInterval(updateTimers, 100); // Mise à jour toutes les 100ms pour plus de précision
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [saveStates]);

  const initializeTimer = useCallback(
    (id: string) => {
      if (!timerStatesRef.current[id]) {
        timerStatesRef.current[id] = {
          remainingSeconds: 0,
          startTimestamp: null,
          targetDuration: 0,
          isRunning: false,
        };
        setTimers((prev) => ({ ...prev, [id]: 0 }));
        setIsRunning((prev) => ({ ...prev, [id]: false }));
        saveStates();
      }
    },
    [saveStates],
  );

  const startTimer = useCallback(
    (id: string, recoveryTime?: string) => {
      if (!timerStatesRef.current[id]) {
        initializeTimer(id);
      }

      const state = timerStatesRef.current[id];

      // Si le timer est à 0 ou on fournit un nouveau temps de récup, on le réinitialise
      if (state.remainingSeconds === 0 || recoveryTime) {
        const seconds = recoveryTime ? parseRecoveryTime(recoveryTime) : state.targetDuration;
        const now = Date.now();

        timerStatesRef.current[id] = {
          remainingSeconds: seconds,
          startTimestamp: now,
          targetDuration: seconds,
          isRunning: true,
        };

        setTimers((prev) => ({ ...prev, [id]: seconds }));
        setIsRunning((prev) => ({ ...prev, [id]: true }));
      } else {
        // Reprendre depuis le temps restant
        const now = Date.now();
        timerStatesRef.current[id] = {
          ...state,
          startTimestamp: now,
          targetDuration: state.remainingSeconds,
          isRunning: true,
        };
        setIsRunning((prev) => ({ ...prev, [id]: true }));
      }

      saveStates();

      // Forcer une mise à jour immédiate
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => {
          const now = Date.now();
          setTimers((prev) => {
            const updated = { ...prev };

            Object.keys(timerStatesRef.current).forEach((key) => {
              const st = timerStatesRef.current[key];
              if (st.isRunning && st.startTimestamp) {
                const elapsedSeconds = Math.floor((now - st.startTimestamp) / 1000);
                const remaining = Math.max(0, st.targetDuration - elapsedSeconds);
                updated[key] = remaining;

                if (remaining === 0) {
                  timerStatesRef.current[key].isRunning = false;
                  setIsRunning((prev) => ({ ...prev, [key]: false }));
                }
              }
            });

            return updated;
          });
          saveStates();
        }, 100);
      }
    },
    [initializeTimer, saveStates],
  );

  const pauseTimer = useCallback(
    (id: string) => {
      const state = timerStatesRef.current[id];
      if (state && state.isRunning) {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - (state.startTimestamp || now)) / 1000);
        const remaining = Math.max(0, state.targetDuration - elapsedSeconds);

        timerStatesRef.current[id] = {
          remainingSeconds: remaining,
          startTimestamp: null,
          targetDuration: remaining,
          isRunning: false,
        };

        setTimers((prev) => ({ ...prev, [id]: remaining }));
        setIsRunning((prev) => ({ ...prev, [id]: false }));
        saveStates();
      }
    },
    [saveStates],
  );

  const resetTimer = useCallback(
    (id: string) => {
      timerStatesRef.current[id] = {
        remainingSeconds: 0,
        startTimestamp: null,
        targetDuration: 0,
        isRunning: false,
      };
      setTimers((prev) => ({ ...prev, [id]: 0 }));
      setIsRunning((prev) => ({ ...prev, [id]: false }));
      saveStates();
    },
    [saveStates],
  );

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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

function parseRecoveryTime(timeStr: string): number {
  // Format attendu: "1min30", "2min", "45s", etc.
  const minMatch = timeStr.match(/(\d+)\s*min/);
  const secMatch = timeStr.match(/(\d+)\s*s/);

  let totalSeconds = 0;
  if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
  if (secMatch) totalSeconds += parseInt(secMatch[1]);

  return totalSeconds;
}
