import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useVoiceCommand } from "@/hooks/useVoiceCommand";
import { generateSessionReport } from "@/lib/groqSessionReport";

/**
 * Note vocale → IA : le coach dicte ses notes de séance, l'IA produit un
 * compte-rendu + plan de suite, déposé dans le champ de note (onResult).
 */
export function VoiceNoteAI({ onResult }: { onResult: (text: string) => void }) {
  const [generating, setGenerating] = useState(false);
  const [transcript, setTranscript] = useState("");

  const handleTranscript = useCallback((finalTranscript: string) => {
    setTranscript(finalTranscript);
  }, []);

  const { state, accumulated, interimHint, error, isSupported, startListening, stopListening, reset } =
    useVoiceCommand(handleTranscript);

  const listening = state === "listening";
  const liveText = [accumulated, interimHint].filter(Boolean).join(" ");
  const currentText = transcript || liveText;

  const generate = async () => {
    const text = (transcript || accumulated).trim();
    if (!text) {
      toast.error("Aucune dictée à analyser.");
      return;
    }
    setGenerating(true);
    try {
      const report = await generateSessionReport(text);
      if (!report) throw new Error("Réponse vide de l'IA");
      onResult(report);
      toast.success("Compte-rendu généré — relis et enregistre.");
      reset();
      setTranscript("");
    } catch (e: any) {
      toast.error(`Erreur IA : ${e?.message || e}`);
    } finally {
      setGenerating(false);
    }
  };

  if (!isSupported) {
    return (
      <p className="text-xs text-muted-foreground">
        🎙️ La note vocale nécessite Chrome (reconnaissance vocale non supportée par ce navigateur).
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Mic className="h-4 w-4 text-primary" /> Note vocale → compte-rendu IA
        </p>
        {!listening ? (
          <Button size="sm" variant="outline" onClick={startListening} disabled={generating}>
            <Mic className="h-4 w-4 mr-1" /> Dicter
          </Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={stopListening}>
            <Square className="h-4 w-4 mr-1" /> Arrêter
          </Button>
        )}
      </div>

      {listening && (
        <p className="text-xs text-muted-foreground animate-pulse">🔴 Enregistrement… parle librement.</p>
      )}

      {currentText && (
        <Textarea
          value={currentText}
          onChange={(e) => setTranscript(e.target.value)}
          rows={5}
          className="resize-y min-h-[120px] text-sm"
          placeholder="Ta dictée apparaîtra ici…"
        />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {currentText && !listening && (
        <Button size="sm" onClick={generate} disabled={generating} className="w-full">
          {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
          {generating ? "Génération…" : "Générer le compte-rendu"}
        </Button>
      )}
    </div>
  );
}
