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
  
  const stateRef = useRef<TimerState>({
    startTime: null,
    pausedTime: 0,
    currentRound: 1,
    isWorkPhase: true,
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const finalBeepRef = useRef<HTMLAudioElement | null>(null);
  const lastBeepTimeRef = useRef<number>(0);

  // Sauvegarder les réglages
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Initialiser les sons
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTaM0fPTgjMGHm7A7+OZTA0PVqzn77BdGAo+ltryxnMpBSuBzvLaiTcIGWi77eefTRAMUKfj8LZjHAY4ktfyy3ksBSR3x/DdkEAKFF606+uoVRQKRp/g8r5sIQU2jNHz04IzBh5uwO/jmUwND1as5++wXRgKPpba8sZzKQUrgc7y2ok3CBlou+3nn00QDFC');
    finalBeepRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTaM0fPTgjMGHm7A7+OZTA0PVqzn77BdGAo+ltryxnMpBSuBzvLaiTcIGWi77eefTRAMUKfj8LZjHAY4ktfyy3ksBSR3x/DdkEAKFF606+uoVRQKRp/g8r5sIQU2jNHz04IzBh5uwO/jmUwND1as5++wXRgKPpba8sZzKQUrgc7y2ok3CBlou+3nn00QDFC');
    if (finalBeepRef.current) {
      finalBeepRef.current.volume = 1.0;
    }
  }, []);

  // Restaurer l'état et gérer la visibilité
  useEffect(() => {
    const storedState = localStorage.getItem(STATE_KEY);
    if (storedState) {
      try {
        const state: TimerState = JSON.parse(storedState);
        if (state.startTime) {
          stateRef.current = state;
          setCurrentRound(state.currentRound);
          setIsWorkPhase(state.isWorkPhase);
          setIsRunning(true);
        }
      } catch {}
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && stateRef.current.startTime) {
        updateTimerDisplay();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  const updateTimerDisplay = useCallback(() => {
    if (!stateRef.current.startTime) return;

    const now = Date.now();
    const elapsed = Math.floor((now - stateRef.current.startTime + stateRef.current.pausedTime * 1000) / 1000);

    if (settings.type === 'chrono') {
      setTimeRemaining(elapsed);
    } else if (settings.type === 'countdown') {
      const remaining = Math.max(0, settings.duration - elapsed);
      setTimeRemaining(remaining);

      const halfTime = Math.floor(settings.duration / 2);
      if (elapsed === halfTime && elapsed !== lastBeepTimeRef.current) {
        playSound(false);
        lastBeepTimeRef.current = elapsed;
      }
      if (remaining <= 3 && remaining > 0 && Math.floor(elapsed) !== lastBeepTimeRef.current) {
        playSound(remaining === 1);
        lastBeepTimeRef.current = Math.floor(elapsed);
      }

      if (remaining === 0) {
        pauseTimer();
      }
    } else if (settings.type === 'emom') {
      const currentInterval = Math.floor(elapsed / settings.emomInterval);
      const roundNum = Math.min(currentInterval + 1, settings.rounds);
      const timeInInterval = elapsed % settings.emomInterval;
      const remaining = settings.emomInterval - timeInInterval;

      setCurrentRound(roundNum);
      setTimeRemaining(remaining);

      const halfInterval = Math.floor(settings.emomInterval / 2);
      if (timeInInterval === halfInterval && Math.floor(elapsed) !== lastBeepTimeRef.current) {
        playSound(false);
        lastBeepTimeRef.current = Math.floor(elapsed);
      }
      if (remaining <= 3 && remaining > 0 && Math.floor(elapsed) !== lastBeepTimeRef.current) {
        playSound(remaining === 1);
        lastBeepTimeRef.current = Math.floor(elapsed);
      }

      if (roundNum >= settings.rounds && remaining === 0) {
        pauseTimer();
      }
    } else if (settings.type === 'tabata') {
      const totalCycleTime = settings.workTime + settings.restTime;
      const currentCycle = Math.floor(elapsed / totalCycleTime);
      const roundNum = Math.min(currentCycle + 1, settings.rounds);
      const timeInCycle = elapsed % totalCycleTime;
      
      const isWork = timeInCycle < settings.workTime;
      const phaseTime = isWork ? settings.workTime : settings.restTime;
      const timeInPhase = isWork ? timeInCycle : timeInCycle - settings.workTime;
      const remaining = phaseTime - timeInPhase;

      setCurrentRound(roundNum);
      setIsWorkPhase(isWork);
      setTimeRemaining(remaining);
      stateRef.current.isWorkPhase = isWork;
      stateRef.current.currentRound = roundNum;

      if (remaining <= 3 && remaining > 0 && Math.floor(elapsed) !== lastBeepTimeRef.current) {
        playSound(remaining === 1);
        lastBeepTimeRef.current = Math.floor(elapsed);
      }

      if (roundNum >= settings.rounds && remaining === 0 && !isWork) {
        pauseTimer();
      }
    }
  }, [settings, playSound]);

  const startTimer = useCallback(() => {
    if (stateRef.current.startTime === null) {
      stateRef.current.startTime = Date.now();
      stateRef.current.pausedTime = 0;
    } else {
      const pauseDuration = Date.now() - (stateRef.current.startTime + stateRef.current.pausedTime * 1000);
      stateRef.current.pausedTime += Math.floor(pauseDuration / 1000);
      stateRef.current.startTime = Date.now() - stateRef.current.pausedTime * 1000;
    }

    setIsRunning(true);
    localStorage.setItem(STATE_KEY, JSON.stringify(stateRef.current));

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(updateTimerDisplay, 100);
    updateTimerDisplay();
  }, [updateTimerDisplay]);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (stateRef.current.startTime) {
      const now = Date.now();
      stateRef.current.pausedTime = Math.floor((now - stateRef.current.startTime) / 1000);
    }
    
    localStorage.removeItem(STATE_KEY);
  }, []);

  const resetTimer = useCallback(() => {
    pauseTimer();
    
    stateRef.current = {
      startTime: null,
      pausedTime: 0,
      currentRound: 1,
      isWorkPhase: true,
    };
    
    setCurrentRound(1);
    setIsWorkPhase(true);
    lastBeepTimeRef.current = 0;
    
    if (settings.type === 'chrono') {
      setTimeRemaining(0);
    } else if (settings.type === 'tabata') {
      setTimeRemaining(settings.workTime);
    } else if (settings.type === 'emom') {
      setTimeRemaining(settings.emomInterval);
    } else {
      setTimeRemaining(settings.duration);
    }
    
    localStorage.removeItem(STATE_KEY);
  }, [settings, pauseTimer]);

  const updateSettings = useCallback((newSettings: Partial<TimerSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      
      if (newSettings.type && newSettings.type !== prev.type) {
        resetTimer();
      }
      
      return updated;
    });
  }, [resetTimer]);

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
