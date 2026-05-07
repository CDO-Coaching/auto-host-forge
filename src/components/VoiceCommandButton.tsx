import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Check, X, AlertCircle, Loader2 } from "lucide-react";
import { useVoiceCommand } from "@/hooks/useVoiceCommand";
import { parseVoiceCommand, type ExerciseTarget, type VoiceChanges } from "@/lib/parseVoiceCommand";
import { toast } from "sonner";

interface Exercise extends ExerciseTarget {
  charge: string;
  reps: string;
  series: string;
  rpe: string;
  recuperation: string;
  tempo: string;
}

interface VoiceCommandButtonProps {
  exercises: Exercise[];
  onApply: (exerciseId: number, changes: VoiceChanges) => void;
  disabled?: boolean;
}

const FIELD_LABELS: Record<keyof VoiceChanges, string> = {
  charge: "Charge (kg)",
  reps: "Répétitions",
  series: "Séries",
  rpe: "RPE",
  recuperation: "Récupération",
  tempo: "Tempo",
};

function ChangeRow({
  field,
  oldValue,
  newValue,
}: {
  field: string;
  oldValue: string;
  newValue: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground">{FIELD_LABELS[field as keyof VoiceChanges] ?? field}</span>
      <div className="flex items-center gap-2">
        {oldValue && (
          <>
            <span className="text-sm line-through text-muted-foreground">{oldValue}</span>
            <span className="text-muted-foreground">→</span>
          </>
        )}
        <span className="text-sm font-bold text-primary">{newValue}</span>
      </div>
    </div>
  );
}

export function VoiceCommandButton({ exercises, onApply, disabled }: VoiceCommandButtonProps) {
  const [preview, setPreview] = useState<{
    exerciseId: number;
    exerciseName: string;
    changes: VoiceChanges;
    currentValues: Partial<Exercise>;
    transcript: string;
  } | null>(null);

  const handleResult = useCallback(
    (transcript: string) => {
      const targets: ExerciseTarget[] = exercises.map((e) => ({ id: e.id, name: e.name }));
      const parsed = parseVoiceCommand(transcript, targets);

      if (!parsed) {
        toast.error("Commande non comprise. Réessaie en mentionnant l'exercice et le champ à modifier.");
        return;
      }

      const ex = exercises.find((e) => e.id === parsed.exerciseId);
      if (!ex) return;

      setPreview({
        exerciseId: parsed.exerciseId,
        exerciseName: parsed.exerciseName,
        changes: parsed.changes,
        currentValues: {
          charge: ex.charge,
          reps: ex.reps,
          series: ex.series,
          rpe: ex.rpe,
          recuperation: ex.recuperation,
          tempo: ex.tempo,
        },
        transcript,
      });
    },
    [exercises]
  );

  const { state, interimTranscript, error, isSupported, startListening, stopListening, reset } =
    useVoiceCommand(handleResult);

  const handleConfirm = () => {
    if (!preview) return;
    onApply(preview.exerciseId, preview.changes);
    const count = Object.keys(preview.changes).length;
    toast.success(`${preview.exerciseName} — ${count} modification(s) appliquée(s)`);
    setPreview(null);
    reset();
  };

  const handleCancel = () => {
    setPreview(null);
    reset();
  };

  if (!isSupported) return null;

  const isListening = state === "listening";
  const isProcessing = state === "processing" && !preview;

  return (
    <>
      {/* Mic button */}
      <Button
        type="button"
        variant={isListening ? "default" : "outline"}
        size="sm"
        className={`h-7 gap-1.5 text-xs transition-all ${
          isListening
            ? "bg-red-500 hover:bg-red-600 border-red-500 text-white animate-pulse"
            : "border-border/60"
        }`}
        onClick={isListening ? stopListening : startListening}
        disabled={disabled || isProcessing}
        title="Modifier par la voix"
      >
        {isProcessing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isListening ? (
          <MicOff className="h-3.5 w-3.5" />
        ) : (
          <Mic className="h-3.5 w-3.5" />
        )}
        {isListening ? "Stop" : "Vocal"}
      </Button>

      {/* Live transcript bubble */}
      {isListening && interimTranscript && (
        <div className="absolute z-10 mt-8 left-0 right-0 mx-4 bg-card border border-primary/30 rounded-lg px-3 py-2 text-sm text-muted-foreground shadow-lg">
          <span className="text-primary">🎤</span> {interimTranscript}…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {/* Confirmation dialog */}
      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mic className="h-4 w-4 text-primary" />
              Confirmer les modifications
            </DialogTitle>
          </DialogHeader>

          {preview && (
            <div className="space-y-3">
              {/* Transcript */}
              <div className="bg-secondary/40 border border-border/40 rounded-lg px-3 py-2">
                <p className="text-[11px] text-muted-foreground mb-0.5">Commande entendue</p>
                <p className="text-sm italic text-foreground">« {preview.transcript} »</p>
              </div>

              {/* Exercise */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Exercice :</span>
                <Badge variant="secondary" className="text-xs font-medium">
                  {preview.exerciseName}
                </Badge>
              </div>

              {/* Changes */}
              <div className="rounded-lg border border-border/40 bg-secondary/20 px-3 py-1">
                {Object.entries(preview.changes).map(([field, value]) => (
                  <ChangeRow
                    key={field}
                    field={field}
                    oldValue={(preview.currentValues as any)[field] || ""}
                    newValue={value}
                  />
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel} className="flex-1">
              <X className="h-3.5 w-3.5 mr-1" />
              Annuler
            </Button>
            <Button size="sm" onClick={handleConfirm} className="flex-1">
              <Check className="h-3.5 w-3.5 mr-1" />
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
