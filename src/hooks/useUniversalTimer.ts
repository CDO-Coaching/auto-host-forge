import { useState, useEffect, useCallback, useRef } from 'react';
import { SoundSystem, type SoundPreset } from '@/lib/soundSystem';

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
  soundPreset: SoundPreset;
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
  soundPreset: 'gym',
};

// Délai (ms) après l'appui avant de lancer l'enregistrement de départ.
const START_CLIP_DELAY_MS = 1800;
// Décalage (secondes) du signal de moitié pour compenser l'intro de
// l'enregistrement. Négatif = déclenche plus tôt (le bip du fichier tombe pile
// à la moitié). Positif = plus tard.
const HALF_OFFSET_SEC = -2;
// Combien de secondes AVANT la fin d'un effort Tabata l'enregistrement de fin
// démarre (compense l'intro du fichier pour tomber pile à la fin du travail).
const EFFORT_END_LEAD_SEC = 5;
// Combien de secondes AVANT la fin de la récup l'enregistrement de départ
// démarre (pour que son "GO" tombe pile au début du nouvel effort).
const REST_END_LEAD_SEC = 4.5;

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
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownValue, setCountdownValue] = useState(5);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [isWorkPhase, setIsWorkPhase] = useState(true);

  // Refs for precision timing with performance.now()
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const soundSystemRef = useRef<SoundSystem | null>(null);
  const hasPlayed5SecAlertRef = useRef(false);
  const hasPlayedHalfRef = useRef(false);
  const hasPlayedEffortEndRef = useRef(false);
  const hasPlayedRestEndRef = useRef(false);
  const lastPhaseRef = useRef<boolean>(true);
  const lastRoundRef = useRef<number>(1);

  // Sauvegarder les réglages
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Initialiser le système sonore
  useEffect(() => {
    soundSystemRef.current = new SoundSystem(settings.soundPreset);
    return () => {
      if (soundSystemRef.current) {
        soundSystemRef.current.close();
      }
    };
  }, []);

  // Appliquer le preset sonore choisi
  useEffect(() => {
    soundSystemRef.current?.setPreset(settings.soundPreset);
  }, [settings.soundPreset]);

  // Fonction pour jouer les sons
  const playSound = useCallback((soundType: string, ...args: any[]) => {
    // Vibrate on key transitions (works even if sound disabled)
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        if (soundType === 'alert5') navigator.vibrate(80);
        else if (soundType === 'victory') navigator.vibrate([120, 60, 120, 60, 200]);
        else if (soundType === 'transition') navigator.vibrate(60);
        else if (soundType === 'go') navigator.vibrate(150);
        else if (soundType === 'half') navigator.vibrate([50, 40, 50]);
      }
    } catch {}
    if (!settings.soundEnabled || !soundSystemRef.current) return;
    
    try {
      switch (soundType) {
        case 'countdown321':
          soundSystemRef.current.countdown321(args[0]);
          break;
        case 'go':
          soundSystemRef.current.go();
          break;
        case 'alert5':
          soundSystemRef.current.alert5Seconds();
          break;
        case 'transition':
          soundSystemRef.current.transition();
          break;
        case 'victory':
          soundSystemRef.current.victory();
          break;
        case 'startCue':
          soundSystemRef.current.startCue();
          break;
        case 'half':
          soundSystemRef.current.half();
          break;
        case 'beep':
          soundSystemRef.current.beep(args[0], args[1]);
          break;
      }
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }, [settings.soundEnabled]);

  // Déclenche le signal de moitié : enregistrement retardé (pour caler son intro)
  // ou signal immédiat si pas d'enregistrement.
  const triggerHalf = useCallback(() => {
    playSound('half');
  }, [playSound]);

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

      // Signal "half" à la moitié (avec décalage de compensation)
      if (settings.duration >= 10 && elapsed >= settings.duration / 2 + HALF_OFFSET_SEC && !hasPlayedHalfRef.current) {
        triggerHalf();
        hasPlayedHalfRef.current = true;
      }

      // Alerte à 5 secondes
      if (remaining <= 5 && remaining > 4.9 && !hasPlayed5SecAlertRef.current) {
        playSound('alert5');
        hasPlayed5SecAlertRef.current = true;
      }

      // Fin du countdown
      if (remaining <= 0) {
        stopTimer();
        playSound('victory');
        setTimeRemaining(0);
      }
    }
    
    // ============ EMOM ============
    else if (settings.type === 'emom') {
      const totalDuration = settings.rounds * settings.emomInterval;
      
      // Vérification de fin AVANT tous les calculs
      if (elapsed >= totalDuration) {
        stopTimer();
        playSound('victory');
        setTimeRemaining(0);
        setCurrentRound(settings.rounds);
        return;
      }

      const currentInterval = Math.floor(elapsed / settings.emomInterval);
      const timeInInterval = elapsed % settings.emomInterval;
      const remaining = settings.emomInterval - timeInInterval;
      const roundNum = currentInterval + 1;
      
      setTimeRemaining(remaining);
      setCurrentRound(roundNum);

      // Signal "half" à la moitié de l'intervalle (avec décalage de compensation)
      if (settings.emomInterval >= 10 && timeInInterval >= settings.emomInterval / 2 + HALF_OFFSET_SEC && !hasPlayedHalfRef.current) {
        triggerHalf();
        hasPlayedHalfRef.current = true;
      }

      // Son de reprise : enregistrement de départ joué avant la fin de l'intervalle
      // (remplace l'ancienne alerte 5 s et le son de transition).
      if (soundSystemRef.current?.hasClip('start')) {
        if (remaining <= REST_END_LEAD_SEC && !hasPlayedRestEndRef.current) {
          playSound('startCue');
          hasPlayedRestEndRef.current = true;
        }
      } else if (remaining <= 5 && remaining > 4.9 && !hasPlayed5SecAlertRef.current) {
        playSound('alert5');
        hasPlayed5SecAlertRef.current = true;
      }

      // Changement d'intervalle : réinitialise les repères (le son est joué en
      // anticipé ci-dessus).
      if (roundNum !== lastRoundRef.current && currentInterval > 0) {
        hasPlayed5SecAlertRef.current = false;
        hasPlayedHalfRef.current = false;
        hasPlayedRestEndRef.current = false;
        lastRoundRef.current = roundNum;
      }
    }
    
    // ============ TABATA ============
    else if (settings.type === 'tabata') {
      const cycleTime = settings.workTime + settings.restTime;
      const totalDuration = settings.rounds * cycleTime;
      
      // Vérification de fin AVANT tous les calculs
      if (elapsed >= totalDuration) {
        stopTimer();
        playSound('victory');
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
      
      // Changement de phase : les sons de fin d'effort et de reprise sont joués
      // en anticipé (voir ci-dessous). Fallback synthé au début d'effort si pas
      // d'enregistrement de départ.
      if (isWork !== lastPhaseRef.current) {
        setIsWorkPhase(isWork);
        if (isWork && !soundSystemRef.current?.hasClip('start')) {
          playSound('transition');
        }
        hasPlayed5SecAlertRef.current = false;
        hasPlayedHalfRef.current = false;
        hasPlayedEffortEndRef.current = false;
        hasPlayedRestEndRef.current = false;
        lastPhaseRef.current = isWork;
      }

      if (isWork) {
        const workRemaining = settings.workTime - timeInCycle;
        setTimeRemaining(workRemaining);

        // Signal "half" à la moitié du travail (avec décalage de compensation)
        if (settings.workTime >= 6 && timeInCycle >= settings.workTime / 2 + HALF_OFFSET_SEC && !hasPlayedHalfRef.current) {
          triggerHalf();
          hasPlayedHalfRef.current = true;
        }

        // Son de fin d'effort : démarre EFFORT_END_LEAD_SEC avant la fin du travail
        // (remplace l'ancienne alerte 5 s pendant le travail)
        if (workRemaining <= EFFORT_END_LEAD_SEC && !hasPlayedEffortEndRef.current) {
          playSound('victory');
          hasPlayedEffortEndRef.current = true;
        }
      } else {
        const restElapsed = timeInCycle - settings.workTime;
        const restRemaining = settings.restTime - restElapsed;
        setTimeRemaining(restRemaining);

        // Son de reprise : enregistrement de départ joué en fin de récup
        if (soundSystemRef.current?.hasClip('start')) {
          if (restRemaining <= REST_END_LEAD_SEC && !hasPlayedRestEndRef.current) {
            playSound('startCue');
            hasPlayedRestEndRef.current = true;
          }
        } else if (restRemaining <= 5 && restRemaining > 4.9 && !hasPlayed5SecAlertRef.current) {
          // Fallback : ancienne alerte 5 s si pas d'enregistrement de départ
          playSound('alert5');
          hasPlayed5SecAlertRef.current = true;
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(updateTimerDisplay) as any;
  }, [isRunning, settings, playSound, triggerHalf]);

  // Arrêt complet du timer
  const stopTimer = useCallback(() => {
    setIsRunning(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current as any);
    }
    localStorage.removeItem(STATE_KEY);
  }, []);

  // Démarrage du timer avec décompte de 5 secondes
  const startTimer = useCallback(() => {
    if (isRunning || isCountingDown) return;
    
    setIsCountingDown(true);
    setCountdownValue(5);

    // Débloque les enregistrements pour iOS (dans le geste utilisateur)
    soundSystemRef.current?.primeClips();

    // Si un enregistrement de départ existe, il remplace les bips 3-2-1-GO.
    // Il est lancé à un délai fixe après l'appui pour caler un intro "3-2-1-GO".
    const useStartClip = !!soundSystemRef.current?.hasClip('start');
    if (useStartClip) {
      setTimeout(() => playSound('startCue'), START_CLIP_DELAY_MS);
    }

    let count = 5;
    const countdownInterval = setInterval(() => {
      count--;
      setCountdownValue(count);

      // Bips 3-2-1-GO (synthèse uniquement si pas d'enregistrement de départ)
      if (count === 3 || count === 2 || count === 1) {
        if (!useStartClip) playSound('countdown321', count);
      } else if (count === 0) {
        if (!useStartClip) playSound('go');
        else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) { try { navigator.vibrate(150); } catch {} }
        clearInterval(countdownInterval);
        
        // Démarrage réel du timer après "GO"
        setTimeout(() => {
          setIsCountingDown(false);
          const now = performance.now();
          startTimeRef.current = now;
          setIsRunning(true);
          hasPlayed5SecAlertRef.current = false;
          hasPlayedHalfRef.current = false;
          hasPlayedEffortEndRef.current = false;
          hasPlayedRestEndRef.current = false;
          lastPhaseRef.current = true;
          lastRoundRef.current = 1;

          localStorage.setItem(STATE_KEY, JSON.stringify({
            startTime: Date.now(),
            pausedTime: pausedTimeRef.current,
            currentRound,
            isWorkPhase
          }));
        }, 500);
      }
    }, 1000);
  }, [isRunning, isCountingDown, playSound, currentRound, isWorkPhase]);

  // Pause du timer
  const pauseTimer = useCallback(() => {
    if (isRunning && startTimeRef.current) {
      const now = performance.now();
      pausedTimeRef.current += now - startTimeRef.current;
      setIsRunning(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current as any);
      }
      localStorage.removeItem(STATE_KEY);
    }
  }, [isRunning]);

  // Réinitialisation du timer
  const resetTimer = useCallback(() => {
    stopTimer();
    setIsCountingDown(false);
    setCountdownValue(5);
    startTimeRef.current = null;
    pausedTimeRef.current = 0;
    setTimeRemaining(0);
    setCurrentRound(1);
    setIsWorkPhase(true);
    hasPlayed5SecAlertRef.current = false;
    hasPlayedHalfRef.current = false;
    hasPlayedEffortEndRef.current = false;
    hasPlayedRestEndRef.current = false;
    lastPhaseRef.current = true;
    lastRoundRef.current = 1;
    localStorage.removeItem(STATE_KEY);
  }, [stopTimer]);

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

  // Effet pour la boucle d'animation
  useEffect(() => {
    if (isRunning) {
      animationFrameRef.current = requestAnimationFrame(updateTimerDisplay) as any;
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current as any);
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
    isCountingDown,
    countdownValue,
    timeRemaining,
    currentRound,
    isWorkPhase,
    startTimer,
    pauseTimer,
    resetTimer,
    updateSettings,
  };
}
