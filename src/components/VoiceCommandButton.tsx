import { useState, useCallback } from "react";
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
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">
        {FIELD_LABELS[field as keyof VoiceChanges] ?? field}
      </span>
      <div className="flex items-center gap-2 min-w-0">
        {oldValue && (
          <>
            <span className="text-xs line-through text-muted-foreground truncate">{oldValue}</span>
            <span className="text-muted-foreground text-xs shrink-0">→</span>
          </>
        )}
        <span className="text-xs font-bold text-primary">{newValue}</span>
      </div>
    </div>
  );
}

function CommandCard({ cmd, exercise, exerciseIndex }: { cmd: VoiceCommand; exercise?: Exercise; exerciseIndex?: number }) {
  const isDelete = cmd.type === "delete";
  const isAdd = cmd.type === "add";
  const changes = cmd.changes ?? {};
  const hasChanges = Object.keys(changes).length > 0;

  const cfg = isDelete
    ? { icon: <Trash2 className="h-4 w-4" />, color: "text-red-400", bg: "bg-red-400/10 border-red-400/30", label: "Supprimer" }
    : isAdd
    ? { icon: <Plus className="h-4 w-4" />, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30", label: "Ajouter" }
    : { icon: <Pencil className="h-4 w-4" />, color: "text-primary", bg: "bg-secondary/30 border-border/40", label: "Modifier" };

  return (
    <div className={`rounded-xl border ${cfg.bg} p-3 space-y-2`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cfg.color}>{cfg.icon}</span>
        <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
        {exerciseIndex != null && (
          <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground px-1.5">
            #{exerciseIndex + 1}
          </Badge>
        )}
        <Badge variant="secondary" className="text-xs font-medium">{cmd.exerciseName}</Badge>
      </div>
      {isDelete && <p className="text-xs text-muted-foreground italic">Cette ligne sera supprimée.</p>}
      {!isDelete && hasChanges && (
        <div className="rounded-lg border border-border/30 bg-secondary/20 px-3 py-1">
          {Object.entries(changes).map(([field, value]) => (
            <ChangeRow key={field} field={field} oldValue={exercise ? ((exercise as any)[field] ?? "") : ""} newValue={value} />
          ))}
        </div>
      )}
      {!isDelete && cmd.seriesOverrides && Object.keys(cmd.seriesOverrides).length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 space-y-1">
          <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-wide">Exceptions par série</p>
          {Object.entries(cmd.seriesOverrides)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([serieNum, override]) => (
              <div key={serieNum} className="flex items-start gap-2 text-xs">
                <span className="text-muted-foreground shrink-0 pt-px">Série {serieNum} :</span>
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
  const [editState, setEditState] = useState<{ text: string; originalText: string } | null>(null);
  const [preview, setPreview] = useState<{ commands: VoiceCommand[]; transcript: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResult = useCallback((transcript: string) => {
    setError(null);
    setEditState({ text: transcript, originalText: transcript });
  }, []);

  const { state, accumulated, interimHint, error: micError, isSupported, startListening, stopListening, updateAccumulated, reset } =
    useVoiceCommand(handleResult);

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
        className={`h-9 sm:h-7 px-3 gap-1.5 text-sm sm:text-xs transition-all touch-manipulation ${
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
          <Mic className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        )}
        {isListening ? "En cours…" : "Vocal"}
      </Button>

      {/* ── Panneau flottant mobile : bulle compacte haut-droite ────────── */}
      {isListening && (
        <>
          {/* MOBILE : petite bulle en haut à droite */}
          <div className="sm:hidden fixed top-4 right-4 z-50 w-52 bg-card border border-red-500/50 rounded-2xl shadow-xl shadow-black/40 overflow-hidden">
            {/* Indicateur + label */}
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border-b border-red-500/20">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wide">
                Vocal en cours
              </span>
            </div>

            {/* Texte accumulé (aperçu compact) */}
            <div className="px-3 py-2 min-h-[36px] max-h-[60px] overflow-hidden">
              {accumulated ? (
                <p className="text-xs text-foreground/80 leading-snug line-clamp-3">{accumulated}</p>
              ) : (
                <p className="text-xs text-muted-foreground/50 italic">
                  {interimHint || "Parle…"}
                </p>
              )}
            </div>

            {/* Boutons */}
            <div className="flex gap-1.5 px-3 pb-3">
              <button
                type="button"
                onClick={handleCancelAll}
                className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg border border-border/60 text-muted-foreground text-xs touch-manipulation bg-secondary/30 active:bg-secondary/60"
              >
                <X className="h-3 w-3" />
                Annuler
              </button>
              <button
                type="button"
                onClick={stopListening}
                className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-red-500 text-white text-xs font-semibold touch-manipulation active:bg-red-600"
              >
                <MicOff className="h-3 w-3" />
                Stop
              </button>
            </div>
          </div>

          {/* DESKTOP : grand panneau centré en bas */}
          <div className="hidden sm:flex fixed bottom-0 left-0 right-0 z-50 justify-center pointer-events-none">
            <div className="pointer-events-auto w-full max-w-3xl mx-4 mb-4 bg-card border border-red-500/40 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-red-500/10 border-b border-red-500/20">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                  </span>
                  <span className="text-xs font-semibold text-red-400 uppercase tracking-wide">
                    Enregistrement vocal
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCancelAll}
                    className="h-7 px-2.5 text-xs border-border/60 text-muted-foreground hover:text-foreground gap-1"
                  >
                    <X className="h-3 w-3" />
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={stopListening}
                    className="h-7 px-4 text-xs bg-red-500 hover:bg-red-600 text-white border-0 gap-1.5"
                  >
                    <MicOff className="h-3.5 w-3.5" />
                    Stop &amp; analyser
                  </Button>
                </div>
              </div>
              {/* Zone de texte */}
              <div className="px-4 pt-3 pb-2">
                <textarea
                  value={accumulated}
                  onChange={(e) => updateAccumulated(e.target.value)}
                  placeholder="Parle… Ex : « Squat charge à 80kg, 4 reps, 3 séries »"
                  rows={5}
                  className="w-full resize-y rounded-lg bg-secondary/20 border border-border/40 focus:border-red-500/40 focus:outline-none text-base text-foreground/90 placeholder:text-muted-foreground/40 placeholder:italic px-3 py-2.5 leading-relaxed font-medium"
                />
                {interimHint && (
                  <p className="text-sm text-muted-foreground/50 italic mt-1.5 px-1 leading-snug">
                    {interimHint}
                    <span className="inline-block w-0.5 h-3.5 bg-red-400/60 ml-0.5 animate-pulse align-middle" />
                  </p>
                )}
              </div>
              <div className="px-4 pb-3">
                <p className="text-[11px] text-muted-foreground/50">
                  Corrige le texte si besoin · Clique <strong className="text-muted-foreground/70">Stop &amp; analyser</strong> quand tu as terminé
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Erreur ───────────────────────────────────────────────────── */}
      {displayError && !editState && !preview && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}

      {/* ── ÉTAPE 1 : Éditeur de texte ───────────────────────────────── */}
      <Dialog open={!!editState} onOpenChange={(open) => { if (!open) handleCancelAll(); }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90dvh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mic className="h-4 w-4 text-primary shrink-0" />
              Vérifier la commande vocale
            </DialogTitle>
          </DialogHeader>

          {editState && (
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Corrige le texte si besoin, puis appuie sur <strong>Analyser</strong>.
              </p>
              <Textarea
                value={editState.text}
                onChange={(e) => setEditState((s) => s ? { ...s, text: e.target.value } : s)}
                className="min-h-[120px] sm:min-h-[160px] text-base resize-none sm:resize-y bg-secondary/30 border-border/50 focus:border-primary/50 leading-relaxed rounded-xl"
                placeholder="Tape ou corrige ta commande ici…"
              />
              {editState.text !== editState.originalText && (
                <button
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                  onClick={() => setEditState((s) => s ? { ...s, text: s.originalText } : s)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Remettre le texte original
                </button>
              )}
              {error && (
                <div className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-row gap-2 px-5 py-4 border-t border-border/40 shrink-0">
            <Button
              variant="outline"
              onClick={handleCancelAll}
              className="flex-1 h-12 sm:h-9 text-sm touch-manipulation"
              disabled={isAnalyzing}
            >
              <X className="h-4 w-4 mr-1.5" />
              Annuler
            </Button>
            <Button
              onClick={() => editState && analyzeText(editState.text)}
              className="flex-1 h-12 sm:h-9 text-sm touch-manipulation"
              disabled={isAnalyzing || !editState?.text.trim()}
            >
              {isAnalyzing ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Analyse…</>
              ) : (
                <><Send className="h-4 w-4 mr-1.5" />Analyser</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ÉTAPE 2 : Confirmation des actions ───────────────────────── */}
      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) handleCancelAll(); }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90dvh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Check className="h-4 w-4 text-primary shrink-0" />
              Confirmer les modifications
            </DialogTitle>
          </DialogHeader>

          {preview && (
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <div className="bg-secondary/40 border border-border/40 rounded-xl px-4 py-3">
                <p className="text-[11px] text-muted-foreground mb-1">Commande analysée</p>
                <p className="text-sm italic text-foreground leading-snug">« {preview.transcript} »</p>
              </div>

              {preview.commands.length > 1 && (
                <p className="text-sm text-muted-foreground">{preview.commands.length} actions détectées :</p>
              )}

              <div className="space-y-2">
                {preview.commands.map((cmd, i) => {
                  const exIdx = cmd.exerciseId != null
                    ? exercises.findIndex((e) => e.id === cmd.exerciseId)
                    : -1;
                  const ex = exIdx >= 0 ? exercises[exIdx] : undefined;
                  return <CommandCard key={i} cmd={cmd} exercise={ex} exerciseIndex={exIdx >= 0 ? exIdx : undefined} />;
                })}
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-row gap-2 px-5 py-4 border-t border-border/40 shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                if (preview) setEditState({ text: preview.transcript, originalText: preview.transcript });
                setPreview(null);
              }}
              className="flex-1 h-12 sm:h-9 text-sm touch-manipulation"
            >
              <Pencil className="h-4 w-4 mr-1.5" />
              Modifier
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-1 h-12 sm:h-9 text-sm touch-manipulation"
            >
              <Check className="h-4 w-4 mr-1.5" />
              Appliquer tout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
