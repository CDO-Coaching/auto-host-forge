import { useState, useEffect, useCallback, useRef } from 'react';

export type TimerType = 'chrono' | 'countdown' | 'emom' | 'tabata';
export type EmomInterval = 30 | 60 | 120 | 180;

export interface TimerSettings {
  type: TimerType;
  duration: number;
  workTime: number;
  restTime: number;
  rounds: number;
  emomInterval: EmomInterval;
  soundEnabled: boolean;
}

interface TimerState {
  startTime: number | null;
  pausedTime: number;
  currentRound: number;
  isWorkPhase: boolean;
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

const SETTINGS_KEY = 'universal-timer-settings';
const STATE_KEY = 'universal-timer-state';

export function useUniversalTimer() {
  const [settings, setSettings] = useState<TimerSettings>(() => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [isRunning, setIsRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [isWorkPhase, setIsWorkPhase] = useState(true);

  // Refs for precision timing with performance.now()
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const beepedRef = useRef({
    halfway: false,
    lastThree: false,
    lastTwo: false,
    lastOne: false,
    halfInterval: false,
    intervalEnd: false,
  });

  // Sauvegarder les réglages
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Initialiser l'AudioContext
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Fonction de beep optimisée avec AudioContext
  const playBeep = useCallback((frequency: number, duration: number) => {
    if (!settings.soundEnabled || !audioContextRef.current) return;
    
    try {
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration / 1000);
    } catch (error) {
      console.error('Error playing beep:', error);
    }
  }, [settings.soundEnabled]);

  // Réinitialisation des flags de beep
  const resetBeepFlags = useCallback(() => {
    beepedRef.current = {
      halfway: false,
      lastThree: false,
      lastTwo: false,
      lastOne: false,
      halfInterval: false,
      intervalEnd: false,
    };
  }, []);

  // Mise à jour du timer - CŒUR DE LA LOGIQUE avec performance.now()
  const updateTimerDisplay = useCallback(() => {
    if (!isRunning || !startTimeRef.current) return;

    const now = performance.now();
    const elapsed = (now - startTimeRef.current + pausedTimeRef.current) / 1000;

    // ============ CHRONO ============
    if (settings.type === 'chrono') {
      setTimeRemaining(elapsed);
    }
    
    // ============ COUNTDOWN ============
    else if (settings.type === 'countdown') {
      const remaining = Math.max(0, settings.duration - elapsed);
      setTimeRemaining(remaining);

      // Beep à mi-parcours
      if (!beepedRef.current.halfway && elapsed >= settings.duration / 2 && elapsed < settings.duration / 2 + 0.1) {
        playBeep(800, 150);
        beepedRef.current.halfway = true;
      }

      // Beeps sur les 3 dernières secondes
      if (remaining <= 3 && remaining > 2.5 && !beepedRef.current.lastThree) {
        playBeep(1000, 100);
        beepedRef.current.lastThree = true;
      } else if (remaining <= 2 && remaining > 1.5 && !beepedRef.current.lastTwo) {
        playBeep(1000, 100);
        beepedRef.current.lastTwo = true;
      } else if (remaining <= 1 && remaining > 0.5 && !beepedRef.current.lastOne) {
        playBeep(1000, 100);
        beepedRef.current.lastOne = true;
      }

      // Fin du countdown
      if (remaining <= 0) {
        stopTimer();
        playBeep(1200, 400);
        setTimeRemaining(0);
      }
    }
    
    // ============ EMOM ============
    else if (settings.type === 'emom') {
      const totalDuration = settings.rounds * settings.emomInterval;
      
      // Vérification de fin AVANT tous les calculs
      if (elapsed >= totalDuration) {
        stopTimer();
        playBeep(1200, 400);
        setTimeRemaining(0);
        setCurrentRound(settings.rounds);
        return;
      }

      const currentInterval = Math.floor(elapsed / settings.emomInterval);
      const timeInInterval = elapsed % settings.emomInterval;
      const roundNum = currentInterval + 1;
      
      setTimeRemaining(timeInInterval);
      setCurrentRound(roundNum);

      // Beep à mi-intervalle
      const halfPoint = settings.emomInterval / 2;
      if (timeInInterval >= halfPoint - 0.1 && timeInInterval < halfPoint + 0.1 && !beepedRef.current.halfInterval) {
        playBeep(800, 120);
        beepedRef.current.halfInterval = true;
      }

      // Beep de fin d'intervalle (sauf au dernier round)
      const nearEnd = settings.emomInterval - 0.5;
      if (timeInInterval >= nearEnd && currentInterval < settings.rounds - 1 && !beepedRef.current.intervalEnd) {
        playBeep(1000, 200);
        beepedRef.current.intervalEnd = true;
      }

      // Reset des flags au début de chaque intervalle
      if (timeInInterval < 0.2) {
        beepedRef.current.halfInterval = false;
        beepedRef.current.intervalEnd = false;
      }
    }
    
    // ============ TABATA ============
    else if (settings.type === 'tabata') {
      const cycleTime = settings.workTime + settings.restTime;
      const totalDuration = settings.rounds * cycleTime;
      
      // Vérification de fin AVANT tous les calculs
      if (elapsed >= totalDuration) {
        stopTimer();
        playBeep(1200, 400);
        setTimeRemaining(0);
        setCurrentRound(settings.rounds);
        setIsWorkPhase(false);
        return;
      }

      const currentCycle = Math.floor(elapsed / cycleTime);
      const timeInCycle = elapsed % cycleTime;
      const isWork = timeInCycle < settings.workTime;
      const roundNum = currentCycle + 1;
      
      setCurrentRound(roundNum);
      setIsWorkPhase(isWork);

      if (isWork) {
        const workRemaining = settings.workTime - timeInCycle;
        setTimeRemaining(workRemaining);
        
        // Beeps sur les 3 dernières secondes du travail
        if (workRemaining <= 3 && workRemaining > 2.5 && !beepedRef.current.lastThree) {
          playBeep(1000, 100);
          beepedRef.current.lastThree = true;
        } else if (workRemaining <= 2 && workRemaining > 1.5 && !beepedRef.current.lastTwo) {
          playBeep(1000, 100);
          beepedRef.current.lastTwo = true;
        } else if (workRemaining <= 1 && workRemaining > 0.5 && !beepedRef.current.lastOne) {
          playBeep(1000, 100);
          beepedRef.current.lastOne = true;
        }
        
        // Reset des flags en milieu de phase
        if (workRemaining > 4) {
          beepedRef.current.lastThree = false;
          beepedRef.current.lastTwo = false;
          beepedRef.current.lastOne = false;
        }
      } else {
        const restElapsed = timeInCycle - settings.workTime;
        const restRemaining = settings.restTime - restElapsed;
        setTimeRemaining(restRemaining);
        
        // Beeps sur les 3 dernières secondes du repos
        if (restRemaining <= 3 && restRemaining > 2.5 && !beepedRef.current.lastThree) {
          playBeep(800, 100);
          beepedRef.current.lastThree = true;
        } else if (restRemaining <= 2 && restRemaining > 1.5 && !beepedRef.current.lastTwo) {
          playBeep(800, 100);
          beepedRef.current.lastTwo = true;
        } else if (restRemaining <= 1 && restRemaining > 0.5 && !beepedRef.current.lastOne) {
          playBeep(800, 100);
          beepedRef.current.lastOne = true;
        }
        
        // Reset des flags en milieu de phase
        if (restRemaining > 4) {
          beepedRef.current.lastThree = false;
          beepedRef.current.lastTwo = false;
          beepedRef.current.lastOne = false;
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(updateTimerDisplay);
  }, [isRunning, settings, playBeep]);

  // Démarrage du timer avec performance.now()
  const startTimer = useCallback(() => {
    if (!isRunning) {
      const now = performance.now();
      startTimeRef.current = now;
      setIsRunning(true);
      localStorage.setItem(STATE_KEY, JSON.stringify({
        startTime: Date.now(),
        pausedTime: pausedTimeRef.current,
        currentRound,
        isWorkPhase
      }));
    }
  }, [isRunning, currentRound, isWorkPhase]);

  // Pause du timer
  const pauseTimer = useCallback(() => {
    if (isRunning && startTimeRef.current) {
      const now = performance.now();
      pausedTimeRef.current += now - startTimeRef.current;
      setIsRunning(false);
      if (animationFrameRef.current) {
        clearInterval(animationFrameRef.current as any);
      }
      localStorage.removeItem(STATE_KEY);
    }
  }, [isRunning]);

  // Arrêt complet du timer
  const stopTimer = useCallback(() => {
    setIsRunning(false);
    if (animationFrameRef.current) {
      clearInterval(animationFrameRef.current as any);
    }
    localStorage.removeItem(STATE_KEY);
  }, []);

  // Réinitialisation du timer
  const resetTimer = useCallback(() => {
    stopTimer();
    startTimeRef.current = null;
    pausedTimeRef.current = 0;
    setTimeRemaining(0);
    setCurrentRound(1);
    setIsWorkPhase(true);
    resetBeepFlags();
    localStorage.removeItem(STATE_KEY);
  }, [stopTimer, resetBeepFlags]);

  // Mise à jour des réglages
  const updateSettings = useCallback((newSettings: Partial<TimerSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      
      if (newSettings.type && newSettings.type !== prev.type) {
        resetTimer();
      }
      
      return updated;
    });
  }, [resetTimer]);

  // Effet pour la boucle d'animation avec setInterval (100ms au lieu de requestAnimationFrame pour éviter le lag)
  useEffect(() => {
    if (isRunning) {
      const intervalId = setInterval(updateTimerDisplay, 100);
      animationFrameRef.current = intervalId as any;
    }
    return () => {
      if (animationFrameRef.current) {
        clearInterval(animationFrameRef.current as any);
      }
    };
  }, [isRunning, updateTimerDisplay]);

  // Restaurer l'état au chargement
  useEffect(() => {
    const storedState = localStorage.getItem(STATE_KEY);
    if (storedState) {
      try {
        const state: TimerState = JSON.parse(storedState);
        if (state.startTime) {
          const elapsed = (Date.now() - state.startTime) / 1000;
          pausedTimeRef.current = elapsed * 1000;
          setCurrentRound(state.currentRound);
          setIsWorkPhase(state.isWorkPhase);
        }
      } catch {}
    }
  }, []);

  // Gérer la visibilité de la page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunning) {
        updateTimerDisplay();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRunning, updateTimerDisplay]);

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
