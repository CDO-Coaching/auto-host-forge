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
import { Mic, MicOff, Check, X, AlertCircle, Loader2, Plus, Trash2, Pencil } from "lucide-react";
import { useVoiceCommand } from "@/hooks/useVoiceCommand";
import {
  parseVoiceCommands,
  type ExerciseTarget,
  type VoiceChanges,
  type VoiceCommand,
} from "@/lib/parseVoiceCommand";
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
  onAddExercise: (name: string, changes: VoiceChanges) => void;
  onDeleteExercise: (exerciseId: number) => void;
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
    <div className="flex items-center justify-between gap-3 py-1 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">
        {FIELD_LABELS[field as keyof VoiceChanges] ?? field}
      </span>
      <div className="flex items-center gap-2">
        {oldValue && (
          <>
            <span className="text-xs line-through text-muted-foreground">{oldValue}</span>
            <span className="text-muted-foreground text-xs">→</span>
          </>
        )}
        <span className="text-xs font-bold text-primary">{newValue}</span>
      </div>
    </div>
  );
}

function CommandCard({
  cmd,
  exercise,
}: {
  cmd: VoiceCommand;
  exercise?: Exercise;
}) {
  const isDelete = cmd.type === "delete";
  const isAdd = cmd.type === "add";
  const changes = cmd.changes ?? {};
  const hasChanges = Object.keys(changes).length > 0;

  const typeConfig = isDelete
    ? { icon: <Trash2 className="h-3.5 w-3.5" />, color: "text-red-400", bg: "bg-red-400/10 border-red-400/30", label: "Supprimer" }
    : isAdd
    ? { icon: <Plus className="h-3.5 w-3.5" />, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30", label: "Ajouter" }
    : { icon: <Pencil className="h-3.5 w-3.5" />, color: "text-primary", bg: "bg-secondary/30 border-border/40", label: "Modifier" };

  return (
    <div className={`rounded-lg border ${typeConfig.bg} p-2.5 space-y-1.5`}>
      <div className="flex items-center gap-1.5">
        <span className={typeConfig.color}>{typeConfig.icon}</span>
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${typeConfig.color}`}>
          {typeConfig.label}
        </span>
        <Badge variant="secondary" className="text-xs font-medium ml-1">
          {cmd.exerciseName}
        </Badge>
      </div>

      {isDelete && (
        <p className="text-xs text-muted-foreground italic">Cette ligne sera supprimée.</p>
      )}

      {!isDelete && hasChanges && (
        <div className="rounded border border-border/30 bg-secondary/20 px-2 py-0.5">
          {Object.entries(changes).map(([field, value]) => (
            <ChangeRow
              key={field}
              field={field}
              oldValue={exercise ? (exercise as any)[field] ?? "" : ""}
              newValue={value}
            />
          ))}
        </div>
      )}

      {!isDelete && !hasChanges && (
        <p className="text-xs text-muted-foreground italic">Aucune valeur précisée.</p>
      )}
    </div>
  );
}

export function VoiceCommandButton({
  exercises,
  onApply,
  onAddExercise,
  onDeleteExercise,
  disabled,
}: VoiceCommandButtonProps) {
  const [preview, setPreview] = useState<{
    commands: VoiceCommand[];
    transcript: string;
  } | null>(null);

  const handleResult = useCallback(
    (transcript: string) => {
      const targets: ExerciseTarget[] = exercises.map((e) => ({ id: e.id, name: e.name }));
      const parsed = parseVoiceCommands(transcript, targets);

      if (!parsed || parsed.commands.length === 0) {
        toast.error("Commande non comprise. Mentionne l'exercice et ce que tu veux changer.");
        return;
      }

      setPreview({ commands: parsed.commands, transcript });
    },
    [exercises],
  );

  const { state, interimTranscript, error, isSupported, startListening, stopListening, reset } =
    useVoiceCommand(handleResult);

  const handleConfirm = () => {
    if (!preview) return;

    let modified = 0, added = 0, deleted = 0;

    for (const cmd of preview.commands) {
      if (cmd.type === "modify" && cmd.exerciseId && cmd.changes) {
        onApply(cmd.exerciseId, cmd.changes);
        modified++;
      } else if (cmd.type === "add") {
        onAddExercise(cmd.exerciseName, cmd.changes ?? {});
        added++;
      } else if (cmd.type === "delete" && cmd.exerciseId) {
        onDeleteExercise(cmd.exerciseId);
        deleted++;
      }
    }

    const parts: string[] = [];
    if (modified) parts.push(`${modified} modif.`);
    if (added) parts.push(`${added} ajout`);
    if (deleted) parts.push(`${deleted} suppr.`);
    toast.success(`Vocal — ${parts.join(", ")} appliqué(s)`);

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
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      >
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
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

              {/* Nombre de commandes */}
              {preview.commands.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  {preview.commands.length} actions détectées :
                </p>
              )}

              {/* Une card par commande */}
              <div className="space-y-2">
                {preview.commands.map((cmd, i) => {
                  const ex = exercises.find((e) => e.id === cmd.exerciseId);
                  return <CommandCard key={i} cmd={cmd} exercise={ex} />;
                })}
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
              Appliquer tout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
