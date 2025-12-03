import { Timer, Play, Pause, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useUniversalTimer, TimerType, EmomInterval, TimerSettings } from "@/hooks/useUniversalTimer";
import { useState, useEffect, useImperativeHandle, forwardRef } from "react";

const TIMER_TYPES: { value: TimerType; label: string }[] = [
  { value: 'chrono', label: 'Chrono simple' },
  { value: 'countdown', label: 'Compte à rebours' },
  { value: 'emom', label: 'EMOM' },
  { value: 'tabata', label: 'Tabata' },
];

const EMOM_INTERVALS: { value: EmomInterval; label: string }[] = [
  { value: 30, label: '30 secondes' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 180, label: '3 minutes' },
];

export interface UniversalTimerRef {
  openWithSettings: (settings: Partial<TimerSettings>) => void;
}

interface UniversalTimerProps {
  ref?: React.Ref<UniversalTimerRef>;
}

export const UniversalTimer = forwardRef<UniversalTimerRef, UniversalTimerProps>((props, ref) => {
  const [open, setOpen] = useState(false);
  const {
    settings,
    isRunning,
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
    }
  }));

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.floor(Math.abs(seconds) % 60);
    return `${seconds < 0 ? '-' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number): string => {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const getProgress = (): number => {
    if (settings.type === 'chrono') return 0;
    
    if (settings.type === 'tabata') {
      const phaseTime = isWorkPhase ? settings.workTime : settings.restTime;
      return ((phaseTime - timeRemaining) / phaseTime) * 100;
    }
    
    if (settings.type === 'emom') {
      return ((settings.emomInterval - timeRemaining) / settings.emomInterval) * 100;
    }
    
    return ((settings.duration - timeRemaining) / settings.duration) * 100;
  };

  const getTotalRounds = (): number => {
    if (settings.type === 'tabata' || settings.type === 'emom') return settings.rounds;
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            className="h-10 w-10"
          >
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
              disabled={isRunning}
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

          {/* Affichage principal du temps - GRAND */}
          <div className="bg-card border-2 border-primary/20 rounded-2xl p-12 text-center space-y-6">
            <div className="font-mono font-bold text-foreground tabular-nums leading-none text-[clamp(3rem,18vw,6rem)] sm:text-[clamp(4rem,14vw,7rem)]">
              {formatTime(timeRemaining)}
            </div>

            {(settings.type === 'tabata' || settings.type === 'emom') && getTotalRounds() > 0 && (
              <div className="space-y-4">
                <div className="text-2xl font-semibold">
                  {settings.type === 'emom' ? (
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

            {settings.type === 'countdown' && (
              <Progress value={getProgress()} className="h-4" />
            )}
          </div>

          {/* Contrôles */}
          <div className="flex gap-4 justify-center">
            {!isRunning ? (
              <Button
                size="lg"
                onClick={startTimer}
                className="px-12 h-16 text-lg bg-green-600 hover:bg-green-700"
              >
                <Play className="h-6 w-6 mr-2" />
                Démarrer
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={pauseTimer}
                variant="secondary"
                className="px-12 h-16 text-lg"
              >
                <Pause className="h-6 w-6 mr-2" />
                Pause
              </Button>
            )}
            <Button
              size="lg"
              onClick={resetTimer}
              variant="outline"
              className="px-8 h-16"
            >
              <RotateCcw className="h-6 w-6" />
            </Button>
          </div>

          {/* Réglages */}
          <div className="space-y-4 pt-6 border-t">
            <h3 className="font-semibold text-xl">Réglages</h3>

            {settings.type === 'countdown' && (
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
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Les changements s'appliquent immédiatement
                </p>
              </div>
            )}

            {settings.type === 'tabata' && (
              <>
                <div className="space-y-2">
                  <Label>Temps de travail</Label>
                  <Select
                    value={settings.workTime.toString()}
                    onValueChange={(value) => updateSettings({ workTime: Number(value) })}
                  >
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {/* 5sec à 55sec par paliers de 5 */}
                      {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((sec) => (
                        <SelectItem key={sec} value={sec.toString()}>
                          {sec} secondes
                        </SelectItem>
                      ))}
                      {/* 1min à 80min par paliers de 30sec */}
                      {Array.from({ length: 160 }, (_, i) => 60 + i * 30).map((sec) => (
                        <SelectItem key={sec} value={sec.toString()}>
                          {Math.floor(sec / 60)}min {sec % 60 > 0 ? `${sec % 60}sec` : ''}
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
                  >
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {/* 5sec à 55sec par paliers de 5 */}
                      {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((sec) => (
                        <SelectItem key={sec} value={sec.toString()}>
                          {sec} secondes
                        </SelectItem>
                      ))}
                      {/* 1min à 80min par paliers de 30sec */}
                      {Array.from({ length: 160 }, (_, i) => 60 + i * 30).map((sec) => (
                        <SelectItem key={sec} value={sec.toString()}>
                          {Math.floor(sec / 60)}min {sec % 60 > 0 ? `${sec % 60}sec` : ''}
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
                  >
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {Array.from({ length: 50 }, (_, i) => i + 1).map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} {num === 1 ? 'tour' : 'tours'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {settings.type === 'emom' && (
              <>
                <div className="space-y-2">
                  <Label>Intervalle</Label>
                  <Select
                    value={(settings.emomInterval || 60).toString()}
                    onValueChange={(value) => updateSettings({ emomInterval: Number(value) as EmomInterval })}
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
                  >
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {Array.from({ length: 60 }, (_, i) => i + 1).map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} {num === 1 ? 'tour' : 'tours'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="flex items-center justify-between">
              <Label>Sons activés</Label>
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
