import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Wind, Timer, Play, Pause, RotateCcw, ChevronUp, ChevronDown, Volume2, VolumeX, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWakeLock } from "@/hooks/useWakeLock";
type BreathPhase = "preparation" | "inhale" | "holdIn" | "exhale" | "holdOut" | "finished";

interface MeditationSettings {
  inhaleDuration: number;
  holdInDuration: number;
  exhaleDuration: number;
  holdOutDuration: number;
  totalDuration: number;
  preparationDelay: number;
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: MeditationSettings = {
  inhaleDuration: 4,
  holdInDuration: 0,
  exhaleDuration: 4,
  holdOutDuration: 0,
  totalDuration: 5,
  preparationDelay: 3,
  soundEnabled: true,
};

// Préréglages prédéfinis
const PRESETS: Record<string, Partial<MeditationSettings>> = {
  coherence: {
    inhaleDuration: 5,
    holdInDuration: 0,
    exhaleDuration: 5,
    holdOutDuration: 0,
    totalDuration: 5,
  },
};

const PHASE_LABELS: Record<BreathPhase, string> = {
  preparation: "Préparation",
  inhale: "Inspirez",
  holdIn: "Retenez",
  exhale: "Expirez",
  holdOut: "Retenez",
  finished: "Terminé",
};

const PHASE_COLORS: Record<BreathPhase, string> = {
  preparation: "text-muted-foreground",
  inhale: "text-blue-500",
  holdIn: "text-purple-500",
  exhale: "text-green-500",
  holdOut: "text-orange-500",
  finished: "text-primary",
};

export default function Meditation() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const presetApplied = useRef(false);
  
  const [settings, setSettings] = useState<MeditationSettings>(() => {
    const saved = localStorage.getItem("meditation-settings");
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  // Appliquer le préréglage depuis l'URL une seule fois
  useEffect(() => {
    if (presetApplied.current) return;
    
    const preset = searchParams.get("preset");
    if (preset && PRESETS[preset]) {
      setSettings(prev => ({ ...prev, ...PRESETS[preset] }));
      // Nettoyer l'URL
      setSearchParams({}, { replace: true });
      presetApplied.current = true;
    }
  }, [searchParams, setSearchParams]);
  
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<BreathPhase>("preparation");
  const [phaseTimeRemaining, setPhaseTimeRemaining] = useState(0);
  const [totalTimeRemaining, setTotalTimeRemaining] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  
  const [breathOpen, setBreathOpen] = useState(true);
  const [sessionOpen, setSessionOpen] = useState(true);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  useWakeLock(isRunning);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem("meditation-settings", JSON.stringify(settings));
  }, [settings]);

  // Initialize AudioContext
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Soft singing bowl sound with gentle harmonics and very smooth decay
  const playBowlSound = useCallback((baseFrequency: number, duration: number = 4) => {
    if (!settings.soundEnabled || !audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // Softer harmonics with lower gains for a more gentle sound
    const harmonics = [
      { ratio: 1, gain: 0.06 },      // Fundamental - very soft
      { ratio: 2.0, gain: 0.03 },    // Octave - subtle
      { ratio: 3.0, gain: 0.015 },   // Perfect fifth - barely audible
    ];

    harmonics.forEach(({ ratio, gain }) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      // Low-pass filter for warmth
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(baseFrequency * 3, ctx.currentTime);
      filter.Q.setValueAtTime(0.5, ctx.currentTime);
      
      // Very subtle vibrato for organic warmth
      const vibrato = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      
      vibrato.frequency.setValueAtTime(2 + Math.random() * 0.5, ctx.currentTime); // 2-2.5 Hz very slow wobble
      vibratoGain.gain.setValueAtTime(baseFrequency * ratio * 0.001, ctx.currentTime); // Very subtle
      
      vibrato.connect(vibratoGain);
      vibratoGain.connect(oscillator.frequency);
      
      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(baseFrequency * ratio, ctx.currentTime);
      
      // Ultra-soft envelope: very slow attack, extremely long smooth decay
      const attackTime = 0.4; // Slow, gentle attack
      const decayStart = ctx.currentTime + attackTime;
      const endTime = ctx.currentTime + duration;
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(gain, decayStart); // Slow fade in
      // Use setTargetAtTime for exponential decay that reaches near-zero smoothly
      gainNode.gain.setTargetAtTime(0, decayStart, (duration - attackTime) / 5); // Smooth exponential decay
      
      oscillator.start(ctx.currentTime);
      vibrato.start(ctx.currentTime);
      oscillator.stop(endTime + 0.5);
      vibrato.stop(endTime + 0.5);
    });
  }, [settings.soundEnabled]);

  const playPhaseSound = useCallback((phase: BreathPhase) => {
    switch (phase) {
      case "inhale":
        playBowlSound(220, 5); // Lower, longer for gentle inhale
        break;
      case "holdIn":
        playBowlSound(280, 3); // Soft mid-range
        break;
      case "exhale":
        playBowlSound(180, 5); // Deep and soothing for exhale
        break;
      case "holdOut":
        playBowlSound(150, 3); // Very deep, calming
        break;
      case "finished":
        // Play a gentle chord of bowls with staggered timing for peaceful ending
        playBowlSound(180, 6);
        setTimeout(() => playBowlSound(220, 6), 500);
        setTimeout(() => playBowlSound(260, 6), 1000);
        break;
    }
  }, [playBowlSound]);

  const getCycleDuration = useCallback(() => {
    return settings.inhaleDuration + settings.holdInDuration + 
           settings.exhaleDuration + settings.holdOutDuration;
  }, [settings]);

  const getNextPhase = useCallback((current: BreathPhase): BreathPhase => {
    switch (current) {
      case "preparation": return "inhale";
      case "inhale": return settings.holdInDuration > 0 ? "holdIn" : "exhale";
      case "holdIn": return "exhale";
      case "exhale": return settings.holdOutDuration > 0 ? "holdOut" : "inhale";
      case "holdOut": return "inhale";
      default: return "inhale";
    }
  }, [settings]);

  const getPhaseDuration = useCallback((phase: BreathPhase): number => {
    switch (phase) {
      case "preparation": return settings.preparationDelay;
      case "inhale": return settings.inhaleDuration;
      case "holdIn": return settings.holdInDuration;
      case "exhale": return settings.exhaleDuration;
      case "holdOut": return settings.holdOutDuration;
      default: return 0;
    }
  }, [settings]);

  const startMeditation = useCallback(() => {
    setIsRunning(true);
    setCycleCount(0);
    
    const startPhase = settings.preparationDelay > 0 ? "preparation" : "inhale";
    setCurrentPhase(startPhase);
    setPhaseTimeRemaining(getPhaseDuration(startPhase));
    setTotalTimeRemaining(settings.totalDuration * 60);
    
    if (startPhase === "inhale") {
      playPhaseSound("inhale");
    }
  }, [settings, getPhaseDuration, playPhaseSound]);

  const pauseMeditation = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resetMeditation = useCallback(() => {
    setIsRunning(false);
    setCurrentPhase("preparation");
    setPhaseTimeRemaining(0);
    setTotalTimeRemaining(0);
    setCycleCount(0);
  }, []);

  // Main timer loop
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTotalTimeRemaining(prev => {
        if (prev <= 1) {
          setIsRunning(false);
          setCurrentPhase("finished");
          playPhaseSound("finished");
          return 0;
        }
        return prev - 1;
      });

      setPhaseTimeRemaining(prev => {
        if (prev <= 1) {
          // Move to next phase
          setCurrentPhase(current => {
            const next = getNextPhase(current);
            const nextDuration = getPhaseDuration(next);
            
            // Track cycles
            if (next === "inhale" && current !== "preparation") {
              setCycleCount(c => c + 1);
            }
            
            playPhaseSound(next);
            setPhaseTimeRemaining(nextDuration);
            return next;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, getNextPhase, getPhaseDuration, playPhaseSound]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const updateSetting = <K extends keyof MeditationSettings>(
    key: K,
    value: MeditationSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Calculate progress for the breathing circle animation
  const getBreathProgress = (): number => {
    if (!isRunning || currentPhase === "preparation" || currentPhase === "finished") return 0.5;
    
    const phaseDuration = getPhaseDuration(currentPhase);
    const progress = 1 - (phaseTimeRemaining / phaseDuration);
    
    if (currentPhase === "inhale") {
      return 0.5 + (progress * 0.5); // 0.5 -> 1.0
    } else if (currentPhase === "exhale") {
      return 1.0 - (progress * 0.5); // 1.0 -> 0.5
    }
    return currentPhase === "holdIn" ? 1.0 : 0.5;
  };

  const breathScale = getBreathProgress();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Méditation</h1>
          <p className="text-muted-foreground text-sm">Exercice de respiration guidée</p>
        </div>
      </div>

      {/* Timer Display */}
      {(isRunning || currentPhase === "finished") && (
        <Card className="border-2 border-primary/20">
          <CardContent className="py-8">
            <div className="flex flex-col items-center space-y-6">
              {/* Breathing Circle */}
              <div className="relative w-48 h-48 flex items-center justify-center">
                <div
                  className={`absolute rounded-full bg-primary/20 transition-transform duration-1000 ease-in-out`}
                  style={{
                    width: "100%",
                    height: "100%",
                    transform: `scale(${breathScale})`,
                  }}
                />
                <div className="relative z-10 text-center">
                  <p className={`text-2xl font-bold ${PHASE_COLORS[currentPhase]}`}>
                    {PHASE_LABELS[currentPhase]}
                  </p>
                  {currentPhase !== "finished" && (
                    <p className="text-4xl font-mono font-bold mt-2">
                      {phaseTimeRemaining}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-8 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Temps restant</p>
                  <p className="text-2xl font-mono font-bold">{formatTime(totalTimeRemaining)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cycles</p>
                  <p className="text-2xl font-mono font-bold">{cycleCount}</p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex gap-3">
                {currentPhase === "finished" ? (
                  <Button onClick={resetMeditation} size="lg">
                    <RotateCcw className="h-5 w-5 mr-2" />
                    Nouvelle session
                  </Button>
                ) : (
                  <>
                    {isRunning ? (
                      <Button onClick={pauseMeditation} variant="secondary" size="lg">
                        <Pause className="h-5 w-5 mr-2" />
                        Pause
                      </Button>
                    ) : (
                      <Button onClick={() => setIsRunning(true)} size="lg">
                        <Play className="h-5 w-5 mr-2" />
                        Reprendre
                      </Button>
                    )}
                    <Button onClick={resetMeditation} variant="outline" size="lg">
                      <RotateCcw className="h-5 w-5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings */}
      {!isRunning && currentPhase !== "finished" && (
        <>
          {/* Breathing Cycle Settings */}
          <Collapsible open={breathOpen} onOpenChange={setBreathOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wind className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Cycle de respiration</CardTitle>
                    </div>
                    {breathOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  {/* Inhale Duration */}
                  <div className="space-y-3">
                    <Label>Durée d'inspiration</Label>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-12">2.0 s</span>
                      <Slider
                        value={[settings.inhaleDuration]}
                        onValueChange={([v]) => updateSetting("inhaleDuration", v)}
                        min={2}
                        max={10}
                        step={0.5}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-12">10.0 s</span>
                    </div>
                    <p className="text-center text-sm font-medium text-primary">{settings.inhaleDuration.toFixed(1)} s</p>
                  </div>

                  {/* Hold After Inhale */}
                  <div className="space-y-3">
                    <Label>Durée d'apnée après inspiration</Label>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-12">0.0 s</span>
                      <Slider
                        value={[settings.holdInDuration]}
                        onValueChange={([v]) => updateSetting("holdInDuration", v)}
                        min={0}
                        max={10}
                        step={0.5}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-12">10.0 s</span>
                    </div>
                    <p className="text-center text-sm font-medium text-primary">{settings.holdInDuration.toFixed(1)} s</p>
                  </div>

                  {/* Exhale Duration */}
                  <div className="space-y-3">
                    <Label>Durée d'expiration</Label>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-12">2.0 s</span>
                      <Slider
                        value={[settings.exhaleDuration]}
                        onValueChange={([v]) => updateSetting("exhaleDuration", v)}
                        min={2}
                        max={10}
                        step={0.5}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-12">10.0 s</span>
                    </div>
                    <p className="text-center text-sm font-medium text-primary">{settings.exhaleDuration.toFixed(1)} s</p>
                  </div>

                  {/* Hold After Exhale */}
                  <div className="space-y-3">
                    <Label>Durée d'apnée après expiration</Label>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-12">0.0 s</span>
                      <Slider
                        value={[settings.holdOutDuration]}
                        onValueChange={([v]) => updateSetting("holdOutDuration", v)}
                        min={0}
                        max={10}
                        step={0.5}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-12">10.0 s</span>
                    </div>
                    <p className="text-center text-sm font-medium text-primary">{settings.holdOutDuration.toFixed(1)} s</p>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Session Settings */}
          <Collapsible open={sessionOpen} onOpenChange={setSessionOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Timer className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Séance</CardTitle>
                    </div>
                    {sessionOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  {/* Total Duration */}
                  <div className="space-y-3">
                    <Label>Durée totale</Label>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-12">1 min</span>
                      <Slider
                        value={[settings.totalDuration]}
                        onValueChange={([v]) => updateSetting("totalDuration", v)}
                        min={1}
                        max={20}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-12">20 min</span>
                    </div>
                    <p className="text-center text-sm font-medium text-primary">{settings.totalDuration} min</p>
                  </div>

                  {/* Preparation Delay */}
                  <div className="space-y-3">
                    <div>
                      <Label>Délai de préparation</Label>
                      <p className="text-xs text-muted-foreground">Délai d'attente avant le début de l'exercice</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-12">0 s</span>
                      <Slider
                        value={[settings.preparationDelay]}
                        onValueChange={([v]) => updateSetting("preparationDelay", v)}
                        min={0}
                        max={10}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-12">10 s</span>
                    </div>
                    <p className="text-center text-sm font-medium text-primary">{settings.preparationDelay} s</p>
                  </div>

                  {/* Sound Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {settings.soundEnabled ? (
                        <Volume2 className="h-5 w-5 text-primary" />
                      ) : (
                        <VolumeX className="h-5 w-5 text-muted-foreground" />
                      )}
                      <Label>Sons activés</Label>
                    </div>
                    <Switch
                      checked={settings.soundEnabled}
                      onCheckedChange={(v) => updateSetting("soundEnabled", v)}
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Start Button */}
          <Button onClick={startMeditation} size="lg" className="w-full py-6 text-lg">
            <Play className="h-6 w-6 mr-2" />
            Commencer la méditation
          </Button>
        </>
      )}
    </div>
  );
}
