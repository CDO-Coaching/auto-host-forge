import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CustomSessionDialogProps {
  onSessionCreated?: () => void;
}

export function CustomSessionDialog({ onSessionCreated }: CustomSessionDialogProps) {
  const [open, setOpen] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sessionName.trim()) {
      toast.error("Veuillez entrer un nom de séance");
      return;
    }

    const durationValue = parseInt(duration);
    if (isNaN(durationValue) || durationValue <= 0 || durationValue > 600) {
      toast.error("Veuillez entrer une durée valide (entre 1 et 600 minutes)");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non connecté");

      const { error } = await supabase
        .from("custom_sessions")
        .insert({
          user_id: user.id,
          session_name: sessionName.trim(),
          description: description.trim() || null,
          duration_minutes: durationValue,
        });

      if (error) throw error;

      toast.success("Séance perso enregistrée !");
      setSessionName("");
      setDescription("");
      setDuration("");
      setOpen(false);
      onSessionCreated?.();
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      toast.error("Erreur lors de l'enregistrement de la séance");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter une séance perso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Créer une séance perso</DialogTitle>
          <DialogDescription>
            Enregistre une séance supplémentaire que tu as réalisée en dehors du programme
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-name">Nom de la séance *</Label>
            <Input
              id="session-name"
              placeholder="Ex: Course à pied, Natation, Yoga..."
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Durée (minutes) *</Label>
            <Input
              id="duration"
              type="number"
              placeholder="Ex: 45"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="1"
              max="600"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea
              id="description"
              placeholder="Décrivez brièvement votre séance..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
