import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Bouton + formulaire permettant à l'athlète d'ajouter un exercice réalisé
 * dans sa séance (si le coach l'a autorisé). Écrit dans session_exercises,
 * visible côté coach.
 */
export function AthleteAddExerciseButton({ sessionId, onAdded }: { sessionId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exercice, setExercice] = useState("");
  const [series, setSeries] = useState("");
  const [reps, setReps] = useState("");
  const [charge, setCharge] = useState("");
  const [rpe, setRpe] = useState("");
  const [commentaire, setCommentaire] = useState("");

  const reset = () => {
    setExercice(""); setSeries(""); setReps(""); setCharge(""); setRpe(""); setCommentaire("");
  };

  const submit = async () => {
    if (!exercice.trim()) {
      toast.error("Indique le nom de l'exercice");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("athlete_add_exercise", {
      p_session_id: sessionId,
      p_exercice: exercice.trim(),
      p_series: series.trim() || null,
      p_reps: reps.trim() || null,
      p_charge: charge.trim() || null,
      p_rpe: rpe.trim() || null,
      p_commentaire: commentaire.trim() || null,
    } as any);
    setBusy(false);
    if (error) {
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    toast.success("Exercice ajouté");
    setOpen(false);
    reset();
    onAdded();
  };

  return (
    <>
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" /> Ajouter un exercice
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter un exercice réalisé</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="add-ex-name">Exercice</Label>
              <Input id="add-ex-name" value={exercice} onChange={(e) => setExercice(e.target.value)} placeholder="Ex: Développé couché" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="add-ex-series">Séries</Label>
                <Input id="add-ex-series" value={series} onChange={(e) => setSeries(e.target.value)} placeholder="4" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-ex-reps">Reps</Label>
                <Input id="add-ex-reps" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="10" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-ex-charge">Charge</Label>
                <Input id="add-ex-charge" value={charge} onChange={(e) => setCharge(e.target.value)} placeholder="80 kg" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-ex-rpe">RPE (1-10)</Label>
              <Input id="add-ex-rpe" type="number" min="1" max="10" value={rpe} onChange={(e) => setRpe(e.target.value)} placeholder="8" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-ex-comment">Commentaire</Label>
              <Textarea id="add-ex-comment" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2} placeholder="Optionnel" />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy} className="w-full sm:w-auto">Annuler</Button>
            <Button onClick={submit} disabled={busy} className="w-full sm:w-auto">{busy ? "Ajout…" : "Ajouter"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
