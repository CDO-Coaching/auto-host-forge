import { useState, useEffect, useCallback, useRef } from 'react';

export type TimerType = 'chrono' | 'countdown' | 'emom' | 'amrap' | 'tabata' | 'interval' | 'circuit';

export interface TimerSettings {
  type: TimerType;
  duration: number; // en secondes
  workTime: number;
  restTime: number;
  rounds: number;
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: TimerSettings = {
  type: 'countdown',
  duration: 180,
  workTime: 20,
  restTime: 10,
  rounds: 8,
  soundEnabled: true,
};

const STORAGE_KEY = 'universal-timer-settings';

export function useUniversalTimer() {
  const [settings, setSettings] = useState<TimerSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
  });

  const [isRunning, setIsRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(settings.duration);
  const [currentRound, setCurrentRound] = useState(1);
  const [isWorkPhase, setIsWorkPhase] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sauvegarder les réglages dans localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Initialiser l'audio
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTaM0fPTgjMGHm7A7+OZTA0PVqzn77BdGAo+ltryxnMpBSuBzvLaiTcIGWi77eefTRAMUKfj8LZjHAY4ktfyy3ksBSR3x/DdkEAKFF606+uoVRQKRp/g8r5sIQU2jNHz04IzBh5uwO/jmUwND1as5++wXRgKPpba8sZzKQUrgc7y2ok3CBlou+3nn00QDFC');
  }, []);

  const playSound = useCallback(() => {
    if (settings.soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [settings.soundEnabled]);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setCurrentRound(1);
    setIsWorkPhase(true);
    
    if (settings.type === 'chrono') {
      setTimeRemaining(0);
    } else if (settings.type === 'tabata' || settings.type === 'interval') {
      setTimeRemaining(settings.workTime);
    } else {
      setTimeRemaining(settings.duration);
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [settings]);

  const startTimer = useCallback(() => {
    setIsRunning(true);
    playSound();

    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (settings.type === 'chrono') {
          return prev + 1;
        }

        const newTime = prev - 1;

        // Gestion des différents types de minuteurs
        if (newTime <= 0) {
          if (settings.type === 'tabata' || settings.type === 'interval') {
            setIsWorkPhase((phase) => {
              const nextPhase = !phase;
              
              if (!nextPhase) {
                // Passage au repos
                setTimeRemaining(settings.restTime);
                playSound();
                return false;
              } else {
                // Passage au travail
                setCurrentRound((round) => {
                  const nextRound = round + 1;
                  if (nextRound <= settings.rounds) {
                    setTimeRemaining(settings.workTime);
                    playSound();
                    return nextRound;
                  } else {
                    // Fin du circuit
                    setIsRunning(false);
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    playSound();
                    return round;
                  }
                });
                return true;
              }
            });
            return 0;
          } else if (settings.type === 'emom') {
            setCurrentRound((round) => {
              const nextRound = round + 1;
              if (nextRound <= settings.rounds) {
                setTimeRemaining(60);
                playSound();
                return nextRound;
              } else {
                setIsRunning(false);
                if (intervalRef.current) clearInterval(intervalRef.current);
                playSound();
                return round;
              }
            });
            return 60;
          } else {
            // countdown, amrap terminés
            setIsRunning(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
            playSound();
            return 0;
          }
        }

        return newTime;
      });
    }, 1000);
  }, [settings, playSound]);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const updateSettings = useCallback((newSettings: Partial<TimerSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      
      // Réinitialiser le temps en fonction du nouveau type
      if (newSettings.type) {
        if (newSettings.type === 'chrono') {
          setTimeRemaining(0);
        } else if (newSettings.type === 'tabata' || newSettings.type === 'interval') {
          setTimeRemaining(updated.workTime);
        } else {
          setTimeRemaining(updated.duration);
        }
        setCurrentRound(1);
        setIsWorkPhase(true);
      }
      
      return updated;
    });
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    settings,
    isRunning,
    timeRemaining,
    currentRound,
    isWorkPhase,
    startTimer,
    pauseTimer,
    resetTimer,
    updateSettings,
  };
}
