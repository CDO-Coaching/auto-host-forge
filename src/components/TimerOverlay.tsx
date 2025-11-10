import { X, Play, Pause, RotateCcw, CheckCircle } from "lucide-react";
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

  const isFinished = timeRemaining === 0;

  return (
    <div className={`fixed inset-0 z-50 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4 ${
      isFinished ? "bg-green-500/20" : "bg-background/95"
    } transition-colors duration-500`}>
      <Card className={`relative w-full max-w-md p-8 animate-scale-in ${
        isFinished ? "border-4 border-green-500 shadow-2xl shadow-green-500/50" : ""
      } transition-all duration-500`}>
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
          {/* Titre ou message terminé */}
          {!isFinished ? (
            <div>
              <h2 className="text-2xl font-bold mb-2">{title}</h2>
              <div className="h-1 w-20 bg-primary mx-auto rounded-full" />
            </div>
          ) : (
            <div className="animate-scale-in">
              <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-3 animate-pulse" />
              <h2 className="text-3xl font-bold text-green-500 mb-2">C'est bon !</h2>
              <p className="text-lg text-green-600 font-semibold">Tu peux recommencer 💪</p>
            </div>
          )}

          {/* Chrono géant */}
          {!isFinished ? (
            <div className="py-8">
              <div
                className={`text-8xl font-bold font-mono transition-colors duration-300 ${
                  timeRemaining <= 10
                    ? "text-red-500 animate-pulse"
                    : "text-foreground"
                }`}
              >
                {formatTime(timeRemaining)}
              </div>
            </div>
          ) : (
            <div className="py-4">
              <div className="text-7xl font-bold text-green-500 animate-pulse">
                ✓
              </div>
            </div>
          )}

          {/* Contrôles */}
          <div className="flex gap-3 justify-center">
            {isFinished ? (
              <Button
                size="lg"
                onClick={onClose}
                className="px-12 py-6 text-lg bg-green-500 hover:bg-green-600 animate-pulse"
              >
                Continuer l'entraînement
              </Button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
