import { useState, useEffect, useCallback, useRef } from 'react';

export type TimerType = 'chrono' | 'countdown' | 'emom' | 'tabata';
export type EmomInterval = 30 | 60 | 120 | 180;

export interface TimerSettings {
  type: TimerType;
  duration: number; // en secondes
  workTime: number;
  restTime: number;
  rounds: number;
  emomInterval: EmomInterval;
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: TimerSettings = {
  type: 'chrono',
  duration: 180,
  workTime: 20,
  restTime: 10,
  rounds: 8,
  emomInterval: 60,
  soundEnabled: true,
};

const STORAGE_KEY = 'universal-timer-settings';

export function useUniversalTimer() {
  const [settings, setSettings] = useState<TimerSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Assurer que tous les champs obligatoires existent avec des valeurs par défaut
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          emomInterval: parsed.emomInterval || DEFAULT_SETTINGS.emomInterval,
        };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [isRunning, setIsRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(() => {
    if (settings.type === 'chrono') return 0;
    if (settings.type === 'tabata') return settings.workTime;
    if (settings.type === 'emom') return settings.emomInterval;
    return settings.duration;
  });
  const [currentRound, setCurrentRound] = useState(1);
  const [isWorkPhase, setIsWorkPhase] = useState(true);
  const isWorkPhaseRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const finalBeepRef = useRef<HTMLAudioElement | null>(null);

  // Sauvegarder les réglages dans localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Initialiser les sons
  useEffect(() => {
    // Son normal (court)
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTaM0fPTgjMGHm7A7+OZTA0PVqzn77BdGAo+ltryxnMpBSuBzvLaiTcIGWi77eefTRAMUKfj8LZjHAY4ktfyy3ksBSR3x/DdkEAKFF606+uoVRQKRp/g8r5sIQU2jNHz04IzBh5uwO/jmUwND1as5++wXRgKPpba8sZzKQUrgc7y2ok3CBlou+3nn00QDFC');
    
    // Son final (plus long et fort)
    finalBeepRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTaM0fPTgjMGHm7A7+OZTA0PVqzn77BdGAo+ltryxnMpBSuBzvLaiTcIGWi77eefTRAMUKfj8LZjHAY4ktfyy3ksBSR3x/DdkEAKFF606+uoVRQKRp/g8r5sIQU2jNHz04IzBh5uwO/jmUwND1as5++wXRgKPpba8sZzKQUrgc7y2ok3CBlou+3nn00QDFC');
    if (finalBeepRef.current) {
      finalBeepRef.current.volume = 1.0; // Volume maximum pour le bip final
    }
  }, []);

  const playSound = useCallback((isFinal = false) => {
    if (settings.soundEnabled) {
      const audio = isFinal ? finalBeepRef.current : audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    }
  }, [settings.soundEnabled]);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setCurrentRound(1);
    setIsWorkPhase(true);
    isWorkPhaseRef.current = true;
    
    if (settings.type === 'chrono') {
      setTimeRemaining(0);
    } else if (settings.type === 'tabata') {
      setTimeRemaining(settings.workTime);
    } else if (settings.type === 'emom') {
      setTimeRemaining(settings.emomInterval);
    } else {
      setTimeRemaining(settings.duration);
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [settings]);

  // Garder une référence à la phase de travail actuelle pour éviter les problèmes de fermeture
  useEffect(() => {
    isWorkPhaseRef.current = isWorkPhase;
  }, [isWorkPhase]);

  const startTimer = useCallback(() => {
    setIsRunning(true);
    playSound();

    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (settings.type === 'chrono') {
          return prev + 1;
        }

        const newTime = prev - 1;

        // Signal sonore pour les 3 dernières secondes (dernier bip différent)
        if (newTime === 1) {
          playSound(true); // Bip final plus fort
        } else if (newTime === 2 || newTime === 3) {
          playSound(false); // Bip normal
        }

        // Signal sonore à la moitié (countdown et EMOM uniquement)
        if (settings.type === 'countdown') {
          const halfTime = Math.floor(settings.duration / 2);
          if (newTime === halfTime && halfTime > 3) {
            playSound(false);
          }
        }
        if (settings.type === 'emom') {
          const halfTime = Math.floor(settings.emomInterval / 2);
          if (newTime === halfTime && halfTime > 3) {
            playSound(false);
          }
        }

        // Gestion des différents types de minuteurs
        if (newTime <= 0) {
          if (settings.type === 'tabata') {
            if (isWorkPhaseRef.current) {
              // Fin du travail -> lancer repos
              setIsWorkPhase(false);
              isWorkPhaseRef.current = false;
              playSound(true);
              return settings.restTime;
            } else {
              // Fin du repos -> passer au tour suivant ou terminer
              let finished = false;
              setCurrentRound((round) => {
                const next = round + 1;
                if (next <= settings.rounds) {
                  return next;
                } else {
                  finished = true;
                  return round;
                }
              });
              if (finished) {
                setIsRunning(false);
                if (intervalRef.current) clearInterval(intervalRef.current);
                playSound(true);
                return 0;
              } else {
                setIsWorkPhase(true);
                isWorkPhaseRef.current = true;
                playSound(false);
                return settings.workTime;
              }
            }
          } else if (settings.type === 'emom') {
            setCurrentRound((round) => {
              const nextRound = round + 1;
              if (nextRound <= settings.rounds) {
                playSound(true);
                return nextRound;
              } else {
                setIsRunning(false);
                if (intervalRef.current) clearInterval(intervalRef.current);
                playSound(true);
                return round;
              }
            });
            return settings.emomInterval;
          } else {
            // countdown terminé
            setIsRunning(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
            playSound(true);
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
      
      // Réinitialiser le temps seulement si le type change
      if (newSettings.type) {
        if (newSettings.type === 'chrono') {
          setTimeRemaining(0);
        } else if (newSettings.type === 'tabata') {
          setTimeRemaining(updated.workTime);
        } else if (newSettings.type === 'emom') {
          setTimeRemaining(updated.emomInterval);
        } else {
          setTimeRemaining(updated.duration);
        }
        setCurrentRound(1);
        setIsWorkPhase(true);
      } else if (!isRunning) {
        // Si on modifie les paramètres alors que le minuteur n'est pas en cours, mettre à jour le temps
        if (prev.type === 'countdown' && newSettings.duration !== undefined) {
          setTimeRemaining(newSettings.duration);
        } else if (prev.type === 'tabata' && newSettings.workTime !== undefined) {
          setTimeRemaining(newSettings.workTime);
        } else if (prev.type === 'emom' && newSettings.emomInterval !== undefined) {
          setTimeRemaining(newSettings.emomInterval);
        }
      }
      
      return updated;
    });
  }, [isRunning]);

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
