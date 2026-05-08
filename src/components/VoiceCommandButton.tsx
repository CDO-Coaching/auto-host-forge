import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  MicOff,
  Check,
  X,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Send,
  RotateCcw,
} from "lucide-react";
import { useVoiceCommand } from "@/hooks/useVoiceCommand";
import { parseWithGroq, type SessionExercise } from "@/lib/groqVoiceCommand";
import type { VoiceChanges, VoiceCommand } from "@/lib/parseVoiceCommand";
import { toast } from "sonner";

interface Exercise extends SessionExercise {}

interface VoiceCommandButtonProps {
  exercises: Exercise[];
  onApply: (exerciseId: number, changes: VoiceChanges, seriesOverrides?: Record<number, Partial<VoiceChanges>>) => void;
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

function ChangeRow({ field, oldValue, newValue }: { field: string; oldValue: string; newValue: string }) {
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

function CommandCard({ cmd, exercise }: { cmd: VoiceCommand; exercise?: Exercise }) {
  const isDelete = cmd.type === "delete";
  const isAdd = cmd.type === "add";
  const changes = cmd.changes ?? {};
  const hasChanges = Object.keys(changes).length > 0;

  const cfg = isDelete
    ? { icon: <Trash2 className="h-3.5 w-3.5" />, color: "text-red-400", bg: "bg-red-400/10 border-red-400/30", label: "Supprimer" }
    : isAdd
    ? { icon: <Plus className="h-3.5 w-3.5" />, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30", label: "Ajouter" }
    : { icon: <Pencil className="h-3.5 w-3.5" />, color: "text-primary", bg: "bg-secondary/30 border-border/40", label: "Modifier" };

  return (
    <div className={`rounded-lg border ${cfg.bg} p-2.5 space-y-1.5`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cfg.color}>{cfg.icon}</span>
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
        <Badge variant="secondary" className="text-xs font-medium ml-1">{cmd.exerciseName}</Badge>
      </div>
      {isDelete && <p className="text-xs text-muted-foreground italic">Cette ligne sera supprimée.</p>}
      {!isDelete && hasChanges && (
        <div className="rounded border border-border/30 bg-secondary/20 px-2 py-0.5">
          {Object.entries(changes).map(([field, value]) => (
            <ChangeRow key={field} field={field} oldValue={exercise ? ((exercise as any)[field] ?? "") : ""} newValue={value} />
          ))}
        </div>
      )}
      {!isDelete && cmd.seriesOverrides && Object.keys(cmd.seriesOverrides).length > 0 && (
        <div className="rounded border border-primary/20 bg-primary/5 px-2 py-1 space-y-0.5">
          <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-wide mb-1">Exceptions par série</p>
          {Object.entries(cmd.seriesOverrides)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([serieNum, override]) => (
              <div key={serieNum} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground shrink-0">Série {serieNum} :</span>
                <span className="text-primary font-medium">
                  {Object.entries(override).map(([f, v]) => `${FIELD_LABELS[f as keyof VoiceChanges] ?? f} → ${v}`).join(", ")}
                </span>
              </div>
            ))}
        </div>
      )}
      {!isDelete && !hasChanges && !cmd.seriesOverrides && <p className="text-xs text-muted-foreground italic">Aucune valeur précisée.</p>}
    </div>
  );
}

// ─── États possibles du flux ──────────────────────────────────────────────────
// idle → listening → editing (texte éditable) → analyzing → confirming → idle

export function VoiceCommandButton({ exercises, onApply, onAddExercise, onDeleteExercise, disabled }: VoiceCommandButtonProps) {
  // Étape 1 : texte éditable après la dictée
  const [editState, setEditState] = useState<{ text: string; originalText: string } | null>(null);
  // Étape 2 : actions à confirmer après analyse Groq
  const [preview, setPreview] = useState<{ commands: VoiceCommand[]; transcript: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quand la dictée est finie → on ouvre l'éditeur de texte (pas encore Groq)
  const handleResult = useCallback((transcript: string) => {
    setError(null);
    setEditState({ text: transcript, originalText: transcript });
  }, []);

  const { state, interimTranscript, error: micError, isSupported, startListening, stopListening, reset } =
    useVoiceCommand(handleResult);

  // Envoyer le texte (édité ou non) à Groq
  const analyzeText = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const commands = await parseWithGroq(text, exercises);
      if (commands.length === 0) {
        toast.error("Aucune action détectée. Précise l'exercice et ce que tu veux changer.");
        return;
      }
      setEditState(null);
      setPreview({ commands, transcript: text });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.error("[VoiceCommand] Groq error:", msg);
      setError(msg.length < 100 ? msg : "Erreur d'analyse — voir la console");
    } finally {
      setIsAnalyzing(false);
    }
  }, [exercises]);

  const handleConfirm = () => {
    if (!preview) return;
    let modified = 0, added = 0, deleted = 0;
    for (const cmd of preview.commands) {
      if (cmd.type === "modify" && cmd.exerciseId != null && cmd.changes) { onApply(cmd.exerciseId, cmd.changes, cmd.seriesOverrides); modified++; }
      else if (cmd.type === "add") { onAddExercise(cmd.exerciseName, cmd.changes ?? {}); added++; }
      else if (cmd.type === "delete" && cmd.exerciseId != null) { onDeleteExercise(cmd.exerciseId); deleted++; }
    }
    const parts: string[] = [];
    if (modified) parts.push(`${modified} modif.`);
    if (added) parts.push(`${added} ajout`);
    if (deleted) parts.push(`${deleted} suppr.`);
    toast.success(`Vocal — ${parts.join(", ")} appliqué(s)`);
    setPreview(null);
    reset();
  };

  const handleCancelAll = () => {
    setEditState(null);
    setPreview(null);
    setError(null);
    reset();
  };

  if (!isSupported) return null;

  const isListening = state === "listening";
  const isBusy = isAnalyzing;
  const displayError = micError || error;

  return (
    <>
      {/* ── Bouton micro ─────────────────────────────────────────────── */}
      <Button
        type="button"
        variant={isListening ? "default" : "outline"}
        size="sm"
        className={`h-7 gap-1.5 text-xs transition-all ${
          isListening
            ? "bg-red-500 hover:bg-red-600 border-red-500 text-white animate-pulse"
            : "border-border/60"
        }`}
        onClick={startListening}
        disabled={disabled || isBusy || isListening || !!editState || !!preview}
        title="Commande vocale"
      >
        {isListening ? (
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
        ) : (
          <Mic className="h-3.5 w-3.5" />
        )}
        {isListening ? "En cours…" : "Vocal"}
      </Button>

      {/* ── Panneau flottant (fixe, visible en scroll) ───────────────── */}
      {isListening && (
        <div className="fixed bottom-6 right-6 z-50 w-80 max-w-[calc(100vw-3rem)] bg-card border border-red-500/40 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-red-500/10 border-b border-red-500/20">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-xs font-semibold text-red-400 uppercase tracking-wide">Enregistrement</span>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={stopListening}
              className="h-7 px-3 text-xs bg-red-500 hover:bg-red-600 text-white border-0 gap-1.5"
            >
              <MicOff className="h-3.5 w-3.5" />
              Stop
            </Button>
          </div>

          {/* Transcript */}
          <div className="px-3 py-2.5 min-h-[56px] max-h-36 overflow-y-auto">
            {interimTranscript ? (
              <p className="text-sm text-foreground/90 leading-relaxed">
                {interimTranscript}
                <span className="inline-block w-0.5 h-3.5 bg-primary ml-0.5 animate-pulse align-middle" />
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">Parle… je t'écoute</p>
            )}
          </div>

          {/* Hint */}
          <div className="px-3 pb-2">
            <p className="text-[10px] text-muted-foreground/60">
              Prends ton temps — clique Stop quand tu as fini
            </p>
          </div>
        </div>
      )}

      {/* ── Erreur ───────────────────────────────────────────────────── */}
      {displayError && !editState && !preview && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {displayError}
        </div>
      )}

      {/* ── ÉTAPE 1 : Éditeur de texte ───────────────────────────────── */}
      <Dialog open={!!editState} onOpenChange={(open) => { if (!open) handleCancelAll(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mic className="h-4 w-4 text-primary" />
              Vérifier la commande
            </DialogTitle>
          </DialogHeader>

          {editState && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Corrige le texte si besoin, puis clique sur <strong>Analyser</strong>.
              </p>
              <Textarea
                value={editState.text}
                onChange={(e) => setEditState((s) => s ? { ...s, text: e.target.value } : s)}
                className="min-h-[80px] text-sm resize-none bg-secondary/30 border-border/50 focus:border-primary/50"
                placeholder="Tape ou corrige ta commande ici…"
                autoFocus
              />
              {editState.text !== editState.originalText && (
                <button
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setEditState((s) => s ? { ...s, text: s.originalText } : s)}
                >
                  <RotateCcw className="h-3 w-3" />
                  Remettre le texte original
                </button>
              )}
              {error && (
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {error}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={handleCancelAll} className="flex-1" disabled={isAnalyzing}>
              <X className="h-3.5 w-3.5 mr-1" />
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={() => editState && analyzeText(editState.text)}
              className="flex-1"
              disabled={isAnalyzing || !editState?.text.trim()}
            >
              {isAnalyzing ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Analyse…</>
              ) : (
                <><Send className="h-3.5 w-3.5 mr-1" />Analyser</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ÉTAPE 2 : Confirmation des actions ───────────────────────── */}
      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) handleCancelAll(); }}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Check className="h-4 w-4 text-primary" />
              Confirmer les modifications
            </DialogTitle>
          </DialogHeader>

          {preview && (
            <div className="space-y-3">
              <div className="bg-secondary/40 border border-border/40 rounded-lg px-3 py-2">
                <p className="text-[11px] text-muted-foreground mb-0.5">Commande analysée</p>
                <p className="text-sm italic text-foreground">« {preview.transcript} »</p>
              </div>

              {preview.commands.length > 1 && (
                <p className="text-xs text-muted-foreground">{preview.commands.length} actions détectées :</p>
              )}

              <div className="space-y-2">
                {preview.commands.map((cmd, i) => {
                  const ex = exercises.find((e) => e.id === cmd.exerciseId);
                  return <CommandCard key={i} cmd={cmd} exercise={ex} />;
                })}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Retour à l'éditeur avec le même texte
                if (preview) setEditState({ text: preview.transcript, originalText: preview.transcript });
                setPreview(null);
              }}
              className="flex-1"
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Modifier
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
