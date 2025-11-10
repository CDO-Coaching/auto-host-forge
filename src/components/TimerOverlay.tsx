import { X, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface TimerOverlayProps {
  show: boolean;
  onClose: () => void;
  timeRemaining: number;
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  title?: string;
}

export function TimerOverlay({
  show,
  onClose,
  timeRemaining,
  isRunning,
  onStart,
  onPause,
  onReset,
  title = "Récupération",
}: TimerOverlayProps) {
  if (!show) return null;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4">
      <Card className="relative w-full max-w-md p-8 animate-scale-in">
        {/* Bouton fermer */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-2 right-2 h-8 w-8"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Contenu */}
        <div className="space-y-6 text-center">
          {/* Titre */}
          <div>
            <h2 className="text-2xl font-bold mb-2">{title}</h2>
            <div className="h-1 w-20 bg-primary mx-auto rounded-full" />
          </div>

          {/* Chrono géant */}
          <div className="py-8">
            <div
              className={`text-8xl font-bold font-mono transition-colors duration-300 ${
                timeRemaining === 0
                  ? "text-green-500"
                  : timeRemaining <= 10
                  ? "text-red-500 animate-pulse"
                  : "text-foreground"
              }`}
            >
              {formatTime(timeRemaining)}
            </div>
          </div>

          {/* Contrôles */}
          <div className="flex gap-3 justify-center">
            {!isRunning ? (
              <Button
                size="lg"
                onClick={onStart}
                disabled={timeRemaining === 0}
                className="px-8"
              >
                <Play className="h-5 w-5 mr-2" />
                Démarrer
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={onPause}
                variant="secondary"
                className="px-8"
              >
                <Pause className="h-5 w-5 mr-2" />
                Pause
              </Button>
            )}
            <Button
              size="lg"
              onClick={onReset}
              variant="outline"
              className="px-6"
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>

          {/* Message si terminé */}
          {timeRemaining === 0 && (
            <div className="text-green-500 font-semibold text-lg animate-fade-in">
              ✓ Récupération terminée !
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
