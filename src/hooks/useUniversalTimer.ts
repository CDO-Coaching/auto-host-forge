import { useState, useEffect, useCallback, useRef } from "react";

export type TimerType = "chrono" | "countdown" | "emom" | "tabata";
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
  type: "chrono",
  duration: 180,
  workTime: 20,
  restTime: 10,
  rounds: 8,
  emomInterval: 60,
  soundEnabled: true,
};

const SETTINGS_KEY = "universal-timer-settings";
const STATE_KEY = "universal-timer-state";

// ==================== SYSTÈME SONORE ÉLABORÉ ====================
class SoundSystem {
  private ctx: AudioContext | null = null;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  private createOscillator(freq: number, type: OscillatorType = "sine"): OscillatorNode {
    const osc = this.ctx!.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    return osc;
  }

  private createGain(initialGain: number = 0.3): GainNode {
    const gain = this.ctx!.createGain();
    gain.gain.value = initialGain;
    return gain;
  }

  // Son de décompte 3-2-1 (bips courts montants)
  countdown321(count: number) {
    if (!this.ctx) return;
    const freq = 800 + count * 200; // 800, 1000, 1200 Hz
    const osc = this.createOscillator(freq, "sine");
    const gain = this.createGain(0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Son GO ! (accord puissant)
  go() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Triple accord pour un son riche
    [400, 600, 800].forEach((freq, i) => {
      const osc = this.createOscillator(freq, "triangle");
      const gain = this.createGain(0.25);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.start(now + i * 0.02);
      osc.stop(now + 0.4 + i * 0.02);
    });
  }

  // Alerte 5 secondes (série de bips rapides qui s'accélèrent)
  alert5Seconds() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const beeps = [0, 0.15, 0.3, 0.45, 0.55]; // Accélération progressive

    beeps.forEach((delay) => {
      const osc = this.createOscillator(1400, "square");
      const gain = this.createGain(0.35);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      const startTime = now + delay;
      gain.gain.setValueAtTime(0.35, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.08);

      osc.start(startTime);
      osc.stop(startTime + 0.08);
    });
  }

  // Son de transition (passage au tour suivant)
  transition() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Swoosh descendant + bip
    const osc1 = this.createOscillator(1200, "sawtooth");
    const gain1 = this.createGain(0.2);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);

    osc1.frequency.exponentialRampToValueAtTime(600, now + 0.2);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc1.start(now);
    osc1.stop(now + 0.2);

    // Bip de confirmation
    setTimeout(() => {
      const osc2 = this.createOscillator(800, "sine");
      const gain2 = this.createGain(0.3);
      osc2.connect(gain2);
      gain2.connect(this.ctx!.destination);

      const startTime = this.ctx!.currentTime;
      gain2.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

      osc2.start(startTime);
      osc2.stop(startTime + 0.15);
    }, 200);
  }

  // Son de fin complète (mélodie de victoire)
  victory() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const melody = [
      { freq: 523, time: 0, duration: 0.15 }, // C
      { freq: 659, time: 0.15, duration: 0.15 }, // E
      { freq: 784, time: 0.3, duration: 0.3 }, // G
    ];

    melody.forEach((note) => {
      const osc = this.createOscillator(note.freq, "triangle");
      const gain = this.createGain(0.3);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      const startTime = now + note.time;
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + note.duration);

      osc.start(startTime);
      osc.stop(startTime + note.duration);
    });
  }

  // Beep simple (pour milieu de parcours)
  beep(frequency: number, duration: number) {
    if (!this.ctx) return;
    const osc = this.createOscillator(frequency, "sine");
    const gain = this.createGain(0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000);

    osc.start(now);
    osc.stop(now + duration / 1000);
  }

  close() {
    if (this.ctx) {
      this.ctx.close();
    }
  }
}

// ==================== HOOK PRINCIPAL ====================
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
  const [countdownValue, setCountdownValue] = useState(10);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [isWorkPhase, setIsWorkPhase] = useState(true);

  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const soundSystemRef = useRef<SoundSystem | null>(null);
  const hasPlayed5SecAlertRef = useRef(false);

  // Sauvegarder les réglages
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Initialiser le système sonore
  useEffect(() => {
    soundSystemRef.current = new SoundSystem();
    return () => {
      if (soundSystemRef.current) {
        soundSystemRef.current.close();
      }
    };
  }, []);

  // Fonction pour jouer les sons
  const playSound = useCallback(
    (soundType: string, ...args: any[]) => {
      if (!settings.soundEnabled || !soundSystemRef.current) return;

      try {
        switch (soundType) {
          case "countdown321":
            soundSystemRef.current.countdown321(args[0]);
            break;
          case "go":
            soundSystemRef.current.go();
            break;
          case "alert5":
            soundSystemRef.current.alert5Seconds();
            break;
          case "transition":
            soundSystemRef.current.transition();
            break;
          case "victory":
            soundSystemRef.current.victory();
            break;
          case "beep":
            soundSystemRef.current.beep(args[0], args[1]);
            break;
        }
      } catch (error) {
        console.error("Error playing sound:", error);
      }
    },
    [settings.soundEnabled],
  );

  // Mise à jour du timer
  const updateTimerDisplay = useCallback(() => {
    if (!isRunning || !startTimeRef.current) return;

    const now = performance.now();
    const elapsed = (now - startTimeRef.current + pausedTimeRef.current) / 1000;

    // ============ CHRONO ============
    if (settings.type === "chrono") {
      setTimeRemaining(elapsed);
    }

    // ============ COUNTDOWN ============
    else if (settings.type === "countdown") {
      const remaining = Math.max(0, settings.duration - elapsed);
      setTimeRemaining(remaining);

      // Alerte à 5 secondes
      if (remaining <= 5 && remaining > 4.9 && !hasPlayed5SecAlertRef.current) {
        playSound("alert5");
        hasPlayed5SecAlertRef.current = true;
      }

      // Fin du countdown
      if (remaining <= 0) {
        stopTimer();
        playSound("victory");
        setTimeRemaining(0);
      }
    }

    // ============ EMOM ============
    else if (settings.type === "emom") {
      const totalDuration = settings.rounds * settings.emomInterval;

      if (elapsed >= totalDuration) {
        stopTimer();
        playSound("victory");
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

      // Alerte à 5 secondes de la fin de l'intervalle
      if (remaining <= 5 && remaining > 4.9 && !hasPlayed5SecAlertRef.current) {
        playSound("alert5");
        hasPlayed5SecAlertRef.current = true;
      }

      // Transition au nouvel intervalle
      if (timeInInterval < 0.1 && currentInterval > 0) {
        playSound("transition");
        hasPlayed5SecAlertRef.current = false;
      }
    }

    // ============ TABATA ============
    else if (settings.type === "tabata") {
      const cycleTime = settings.workTime + settings.restTime;
      const totalDuration = settings.rounds * cycleTime;

      if (elapsed >= totalDuration) {
        stopTimer();
        playSound("victory");
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

      // Changement de phase
      if (isWork !== isWorkPhase) {
        setIsWorkPhase(isWork);
        playSound("transition");
        hasPlayed5SecAlertRef.current = false;
      }

      if (isWork) {
        const workRemaining = settings.workTime - timeInCycle;
        setTimeRemaining(workRemaining);

        // Alerte à 5 secondes
        if (workRemaining <= 5 && workRemaining > 4.9 && !hasPlayed5SecAlertRef.current) {
          playSound("alert5");
          hasPlayed5SecAlertRef.current = true;
        }
      } else {
        const restElapsed = timeInCycle - settings.workTime;
        const restRemaining = settings.restTime - restElapsed;
        setTimeRemaining(restRemaining);

        // Alerte à 5 secondes
        if (restRemaining <= 5 && restRemaining > 4.9 && !hasPlayed5SecAlertRef.current) {
          playSound("alert5");
          hasPlayed5SecAlertRef.current = true;
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(updateTimerDisplay);
  }, [isRunning, settings, playSound, isWorkPhase]);

  // Arrêt complet du timer
  const stopTimer = useCallback(() => {
    setIsRunning(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    localStorage.removeItem(STATE_KEY);
  }, []);

  // Démarrage du timer avec décompte de 10 secondes
  const startTimer = useCallback(() => {
    if (isRunning || isCountingDown) return;

    setIsCountingDown(true);
    setCountdownValue(10);

    let count = 10;
    const countdownInterval = setInterval(() => {
      count--;
      setCountdownValue(count);

      // Sons 3-2-1-GO
      if (count === 3 || count === 2 || count === 1) {
        playSound("countdown321", count);
      } else if (count === 0) {
        playSound("go");
        clearInterval(countdownInterval);

        // Démarrage réel du timer après "GO"
        setTimeout(() => {
          setIsCountingDown(false);
          const now = performance.now();
          startTimeRef.current = now;
          setIsRunning(true);
          hasPlayed5SecAlertRef.current = false;

          localStorage.setItem(
            STATE_KEY,
            JSON.stringify({
              startTime: Date.now(),
              pausedTime: pausedTimeRef.current,
              currentRound,
              isWorkPhase,
            }),
          );
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
        cancelAnimationFrame(animationFrameRef.current);
      }
      localStorage.removeItem(STATE_KEY);
    }
  }, [isRunning]);

  // Réinitialisation du timer
  const resetTimer = useCallback(() => {
    stopTimer();
    setIsCountingDown(false);
    setCountdownValue(10);
    startTimeRef.current = null;
    pausedTimeRef.current = 0;
    setTimeRemaining(0);
    setCurrentRound(1);
    setIsWorkPhase(true);
    hasPlayed5SecAlertRef.current = false;
    localStorage.removeItem(STATE_KEY);
  }, [stopTimer]);

  // Mise à jour des réglages
  const updateSettings = useCallback(
    (newSettings: Partial<TimerSettings>) => {
      setSettings((prev) => {
        const updated = { ...prev, ...newSettings };

        if (newSettings.type && newSettings.type !== prev.type) {
          resetTimer();
        }

        return updated;
      });
    },
    [resetTimer],
  );

  // Effet pour la boucle d'animation
  useEffect(() => {
    if (isRunning) {
      animationFrameRef.current = requestAnimationFrame(updateTimerDisplay);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
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

// ==================== COMPOSANT UI ====================
import { Timer, Play, Pause, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { forwardRef, useImperativeHandle } from "react";

const TIMER_TYPES: { value: TimerType; label: string }[] = [
  { value: "chrono", label: "Chrono simple" },
  { value: "countdown", label: "Compte à rebours" },
  { value: "emom", label: "EMOM" },
  { value: "tabata", label: "Tabata" },
];

const EMOM_INTERVALS: { value: EmomInterval; label: string }[] = [
  { value: 30, label: "30 secondes" },
  { value: 60, label: "1 minute" },
  { value: 120, label: "2 minutes" },
  { value: 180, label: "3 minutes" },
];

export interface UniversalTimerRef {
  openWithSettings: (settings: Partial<TimerSettings>) => void;
}

export const UniversalTimer = forwardRef<UniversalTimerRef, {}>((props, ref) => {
  const [open, setOpen] = useState(false);
  const {
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
  } = useUniversalTimer();

  useImperativeHandle(ref, () => ({
    openWithSettings: (newSettings: Partial<TimerSettings>) => {
      updateSettings(newSettings);
      setOpen(true);
    },
  }));

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.floor(Math.abs(seconds) % 60);
    return `${seconds < 0 ? "-" : ""}${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getProgress = (): number => {
    if (settings.type === "chrono") return 0;

    if (settings.type === "tabata") {
      const phaseTime = isWorkPhase ? settings.workTime : settings.restTime;
      return ((phaseTime - timeRemaining) / phaseTime) * 100;
    }

    if (settings.type === "emom") {
      return ((settings.emomInterval - timeRemaining) / settings.emomInterval) * 100;
    }

    return ((settings.duration - timeRemaining) / settings.duration) * 100;
  };

  const getTotalRounds = (): number => {
    if (settings.type === "tabata" || settings.type === "emom") return settings.rounds;
    return 0;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="fixed top-4 right-4 z-40 h-12 w-12 rounded-full bg-gradient-cta shadow-glow hover:shadow-glow hover:scale-110 transition-all"
        >
          <Timer className="h-6 w-6" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-full h-screen max-h-screen p-6 overflow-y-auto bg-background flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Minuteur</h2>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-10 w-10">
            <X className="h-6 w-6" />
          </Button>
        </div>

        <div className="flex-1 flex flex-col justify-center space-y-8 max-w-2xl mx-auto w-full">
          {/* Sélection du type */}
          <div className="space-y-2">
            <Label>Type de minuteur</Label>
            <Select
              value={settings.type}
              onValueChange={(value) => {
                updateSettings({ type: value as TimerType });
                resetTimer();
              }}
              disabled={isRunning || isCountingDown}
            >
              <SelectTrigger className="h-12 text-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMER_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Affichage principal du temps */}
          <div className="bg-card border-2 border-primary/20 rounded-2xl p-12 text-center space-y-6">
            {isCountingDown ? (
              <div className="space-y-4">
                <div className="text-2xl font-semibold text-muted-foreground">Préparation...</div>
                <div
                  className={`font-mono font-bold tabular-nums leading-none text-[clamp(4rem,20vw,8rem)] transition-all duration-300 ${
                    countdownValue <= 3 ? "text-orange-500 scale-110" : "text-foreground"
                  }`}
                >
                  {countdownValue === 0 ? "GO!" : countdownValue}
                </div>
              </div>
            ) : (
              <>
                <div className="font-mono font-bold text-foreground tabular-nums leading-none text-[clamp(3rem,18vw,6rem)] sm:text-[clamp(4rem,14vw,7rem)]">
                  {formatTime(timeRemaining)}
                </div>

                {(settings.type === "tabata" || settings.type === "emom") && getTotalRounds() > 0 && (
                  <div className="space-y-4">
                    <div className="text-2xl font-semibold">
                      {settings.type === "emom" ? (
                        `Tour ${currentRound} / ${getTotalRounds()}`
                      ) : (
                        <>
                          <span className={isWorkPhase ? "text-green-500" : "text-blue-500"}>
                            {isWorkPhase ? "🔥 TRAVAIL" : "💤 REPOS"}
                          </span>
                          <div className="text-lg text-muted-foreground mt-2">
                            Tour {currentRound} / {getTotalRounds()}
                          </div>
                        </>
                      )}
                    </div>
                    <Progress value={getProgress()} className="h-4" />
                  </div>
                )}

                {settings.type === "countdown" && <Progress value={getProgress()} className="h-4" />}
              </>
            )}
          </div>

          {/* Contrôles */}
          <div className="flex gap-4 justify-center">
            {!isRunning && !isCountingDown ? (
              <Button size="lg" onClick={startTimer} className="px-12 h-16 text-lg bg-green-600 hover:bg-green-700">
                <Play className="h-6 w-6 mr-2" />
                Démarrer
              </Button>
            ) : isCountingDown ? (
              <Button size="lg" disabled className="px-12 h-16 text-lg">
                <Timer className="h-6 w-6 mr-2 animate-pulse" />
                Préparation...
              </Button>
            ) : (
              <Button size="lg" onClick={pauseTimer} variant="secondary" className="px-12 h-16 text-lg">
                <Pause className="h-6 w-6 mr-2" />
                Pause
              </Button>
            )}
            <Button size="lg" onClick={resetTimer} variant="outline" className="px-8 h-16" disabled={isCountingDown}>
              <RotateCcw className="h-6 w-6" />
            </Button>
          </div>

          {/* Réglages */}
          <div className="space-y-4 pt-6 border-t">
            <h3 className="font-semibold text-xl">Réglages</h3>

            {settings.type === "countdown" && (
              <div className="space-y-2">
                <Label>Durée (minutes:secondes)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Minutes"
                    value={Math.floor(settings.duration / 60)}
                    onChange={(e) => {
                      const mins = Number(e.target.value) || 0;
                      const secs = settings.duration % 60;
                      updateSettings({ duration: mins * 60 + secs });
                    }}
                    min={0}
                    max={99}
                    className="w-28 h-12 text-lg"
                    disabled={isRunning || isCountingDown}
                  />
                  <span className="flex items-center text-xl">:</span>
                  <Input
                    type="number"
                    placeholder="Secondes"
                    value={settings.duration % 60}
                    onChange={(e) => {
                      const mins = Math.floor(settings.duration / 60);
                      const secs = Number(e.target.value) || 0;
                      updateSettings({ duration: mins * 60 + secs });
                    }}
                    min={0}
                    max={59}
                    className="w-28 h-12 text-lg"
                    disabled={isRunning || isCountingDown}
                  />
                </div>
              </div>
            )}

            {settings.type === "tabata" && (
              <>
                <div className="space-y-2">
                  <Label>Temps de travail</Label>
                  <Select
                    value={settings.workTime.toString()}
                    onValueChange={(value) => updateSettings({ workTime: Number(value) })}
                    disabled={isRunning || isCountingDown}
                  >
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((sec) => (
                        <SelectItem key={sec} value={sec.toString()}>
                          {sec} secondes
                        </SelectItem>
                      ))}
                      {Array.from({ length: 160 }, (_, i) => 60 + i * 30).map((sec) => (
                        <SelectItem key={sec} value={sec.toString()}>
                          {Math.floor(sec / 60)}min {sec % 60 > 0 ? `${sec % 60}sec` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Temps de repos</Label>
                  <Select
                    value={settings.restTime.toString()}
                    onValueChange={(value) => updateSettings({ restTime: Number(value) })}
                    disabled={isRunning || isCountingDown}
                  >
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((sec) => (
                        <SelectItem key={sec} value={sec.toString()}>
                          {sec} secondes
                        </SelectItem>
                      ))}
                      {Array.from({ length: 160 }, (_, i) => 60 + i * 30).map((sec) => (
                        <SelectItem key={sec} value={sec.toString()}>
                          {Math.floor(sec / 60)}min {sec % 60 > 0 ? `${sec % 60}sec` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nombre de tours</Label>
                  <Select
                    value={settings.rounds.toString()}
                    onValueChange={(value) => updateSettings({ rounds: Number(value) })}
                    disabled={isRunning || isCountingDown}
                  >
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {Array.from({ length: 50 }, (_, i) => i + 1).map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} {num === 1 ? "tour" : "tours"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {settings.type === "emom" && (
              <>
                <div className="space-y-2">
                  <Label>Intervalle</Label>
                  <Select
                    value={(settings.emomInterval || 60).toString()}
                    onValueChange={(value) => updateSettings({ emomInterval: Number(value) as EmomInterval })}
                    disabled={isRunning || isCountingDown}
                  >
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMOM_INTERVALS.map((interval) => (
                        <SelectItem key={interval.value} value={interval.value.toString()}>
                          {interval.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nombre de tours</Label>
                  <Select
                    value={settings.rounds.toString()}
                    onValueChange={(value) => updateSettings({ rounds: Number(value) })}
                    disabled={isRunning || isCountingDown}
                  >
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {Array.from({ length: 60 }, (_, i) => i + 1).map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} {num === 1 ? "tour" : "tours"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Sons activés</Label>
                <p className="text-xs text-muted-foreground">Décompte 3-2-1-GO + alertes sonores</p>
              </div>
              <Switch
                checked={settings.soundEnabled}
                onCheckedChange={(checked) => updateSettings({ soundEnabled: checked })}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

UniversalTimer.displayName = "UniversalTimer";

export default UniversalTimer;
