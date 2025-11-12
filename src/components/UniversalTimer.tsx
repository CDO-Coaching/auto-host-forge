import { Timer, Play, Pause, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useUniversalTimer, TimerType } from "@/hooks/useUniversalTimer";
import { useState } from "react";

const TIMER_TYPES: { value: TimerType; label: string }[] = [
  { value: 'chrono', label: 'Chrono simple' },
  { value: 'countdown', label: 'Compte à rebours' },
  { value: 'emom', label: 'EMOM' },
  { value: 'amrap', label: 'AMRAP' },
  { value: 'tabata', label: 'Tabata' },
  { value: 'interval', label: 'Intervalle' },
];

export function UniversalTimer() {
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

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    return `${seconds < 0 ? '-' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number): string => {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const getProgress = (): number => {
    if (settings.type === 'chrono') return 0;
    
    if (settings.type === 'tabata' || settings.type === 'interval') {
      const phaseTime = isWorkPhase ? settings.workTime : settings.restTime;
      return ((phaseTime - timeRemaining) / phaseTime) * 100;
    }
    
    return ((settings.duration - timeRemaining) / settings.duration) * 100;
  };

  const getTotalRounds = (): number => {
    if (settings.type === 'tabata') return 8;
    if (settings.type === 'interval' || settings.type === 'emom') return settings.rounds;
    return 0;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed top-4 right-4 z-40 h-12 w-12 rounded-full bg-gradient-cta shadow-glow hover:shadow-glow hover:scale-110 transition-all"
        >
          <Timer className="h-6 w-6" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-background">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold">Minuteur</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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
              <SelectTrigger>
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

          {/* Affichage principal */}
          <div className="bg-card border-2 border-primary/20 rounded-lg p-6 text-center space-y-4">
            <div className="text-7xl font-mono font-bold text-foreground">
              {formatTime(timeRemaining)}
            </div>

            {(settings.type === 'tabata' || settings.type === 'interval' || settings.type === 'emom') && (
              <div className="space-y-2">
                <div className="text-lg font-semibold">
                  {settings.type === 'emom' ? (
                    `Tour ${currentRound} / ${getTotalRounds()}`
                  ) : (
                    <>
                      <span className={isWorkPhase ? "text-green-500" : "text-blue-500"}>
                        {isWorkPhase ? "🔥 TRAVAIL" : "💤 REPOS"}
                      </span>
                      <div className="text-sm text-muted-foreground mt-1">
                        Tour {currentRound} / {getTotalRounds()}
                      </div>
                    </>
                  )}
                </div>
                <Progress value={getProgress()} className="h-3" />
              </div>
            )}

            {settings.type === 'amrap' && (
              <div className="text-sm text-muted-foreground">
                Le plus de tours/reps possible !
              </div>
            )}
          </div>

          {/* Contrôles */}
          <div className="flex gap-3 justify-center">
            {!isRunning ? (
              <Button
                size="lg"
                onClick={startTimer}
                className="px-8 bg-green-600 hover:bg-green-700"
              >
                <Play className="h-5 w-5 mr-2" />
                Démarrer
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={pauseTimer}
                variant="secondary"
                className="px-8"
              >
                <Pause className="h-5 w-5 mr-2" />
                Pause
              </Button>
            )}
            <Button
              size="lg"
              onClick={resetTimer}
              variant="outline"
              className="px-6"
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>

          {/* Réglages */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold">Réglages</h3>

            {settings.type === 'countdown' && (
              <div className="space-y-2">
                <Label>Durée (minutes:secondes)</Label>
                <Input
                  type="text"
                  value={formatDuration(settings.duration)}
                  onChange={(e) => {
                    const [mins, secs] = e.target.value.split(':').map(Number);
                    if (!isNaN(mins) && !isNaN(secs)) {
                      updateSettings({ duration: mins * 60 + secs });
                    }
                  }}
                  disabled={isRunning}
                  placeholder="3:00"
                />
              </div>
            )}

            {settings.type === 'amrap' && (
              <div className="space-y-2">
                <Label>Durée totale (minutes)</Label>
                <Input
                  type="number"
                  value={Math.floor(settings.duration / 60)}
                  onChange={(e) => updateSettings({ duration: Number(e.target.value) * 60 })}
                  disabled={isRunning}
                  min={1}
                  max={60}
                />
              </div>
            )}

            {(settings.type === 'tabata' || settings.type === 'interval') && (
              <>
                <div className="space-y-2">
                  <Label>Temps de travail (secondes)</Label>
                  <Input
                    type="number"
                    value={settings.workTime}
                    onChange={(e) => updateSettings({ workTime: Number(e.target.value) })}
                    disabled={isRunning}
                    min={5}
                    max={300}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Temps de repos (secondes)</Label>
                  <Input
                    type="number"
                    value={settings.restTime}
                    onChange={(e) => updateSettings({ restTime: Number(e.target.value) })}
                    disabled={isRunning}
                    min={5}
                    max={300}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nombre de tours</Label>
                  <Input
                    type="number"
                    value={settings.rounds}
                    onChange={(e) => updateSettings({ rounds: Number(e.target.value) })}
                    disabled={isRunning}
                    min={1}
                    max={50}
                  />
                </div>
              </>
            )}

            {settings.type === 'emom' && (
              <div className="space-y-2">
                <Label>Nombre de minutes</Label>
                <Input
                  type="number"
                  value={settings.rounds}
                  onChange={(e) => updateSettings({ rounds: Number(e.target.value) })}
                  disabled={isRunning}
                  min={1}
                  max={60}
                />
              </div>
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
      </SheetContent>
    </Sheet>
  );
}
