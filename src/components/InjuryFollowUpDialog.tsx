import { useEffect, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { QuickRatingInput } from "./QuickRatingInput";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, Equal, Ban, Heart } from "lucide-react";

const injuryLevelLabels = ["Gêne", "Très légère", "Légère", "Modérée", "Gênante", "Importante", "Très forte"];
const injuryLevelEmojis = ["🩹", "😕", "😣", "😖", "😫", "🤕", "🚑"];

type Evolution = "same" | "better" | "worse" | "gone" | null;

interface Props {
  open: boolean;
  onClose: () => void;
  previousLocation: string | null;
  previousLevel: number;
}

function toLocalDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function InjuryFollowUpDialog({ open, onClose, previousLocation, previousLevel }: Props) {
  const { toast } = useToast();
  const [evolution, setEvolution] = useState<Evolution>(null);
  const [level, setLevel] = useState(previousLevel || 3);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setEvolution(null);
      setLevel(previousLevel || 3);
    }
  }, [open, previousLevel]);

  const pickEvolution = (e: Evolution) => {
    setEvolution(e);
    if (e === "gone") return;
    if (e === "better") setLevel(Math.max(1, previousLevel - 1));
    else if (e === "worse") setLevel(Math.min(7, previousLevel + 1));
    else if (e === "same") setLevel(previousLevel);
  };

  const handleSubmit = async () => {
    if (!evolution) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const dateToSave = toLocalDateKey(new Date());
      const gone = evolution === "gone";
      const injuryFields = {
        has_injury: !gone,
        injury_level: gone ? 0 : level,
        injury_location: previousLocation,
      };

      const { data: existing } = await supabase
        .from("daily_fatigue_log")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", dateToSave)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("daily_fatigue_log")
          .update(injuryFields)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("daily_fatigue_log")
          .insert({ user_id: user.id, date: dateToSave, fatigue: 1, courbatures: 1, sommeil: 1, stress: 1, ...injuryFields });
        if (error) throw error;
      }

      toast({
        title: gone ? "Super, plus de douleur 🎉" : "Merci, c'est noté 🙏",
        description: gone
          ? "Je n'afficherai plus ce suivi."
          : "Ton coach voit l'évolution et adapte ta séance.",
      });
      onClose();
    } catch (error: any) {
      console.error("Erreur suivi douleur:", error);
      toast({ title: "Erreur", description: error.message || "Impossible d'enregistrer.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="pb-1 pt-3">
          <div className="flex items-center gap-2 justify-center">
            <Heart className="h-5 w-5" style={{ color: "#ff7a5c" }} />
            <DrawerTitle className="text-base">Suivi de ta douleur</DrawerTitle>
          </div>
          <DrawerDescription className="text-xs text-center">
            {previousLocation
              ? <>Hier : <b className="text-foreground">{previousLocation}</b> — comment ça va aujourd'hui&nbsp;?</>
              : "Comment évolue ta douleur aujourd'hui ?"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => pickEvolution("same")}
              className={`py-2.5 px-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 border transition-colors ${evolution === "same" ? "bg-blue-500/20 text-blue-400 border-blue-500/50" : "bg-muted/40 text-muted-foreground border-border"}`}>
              <Equal className="h-4 w-4" /> Pareil
            </button>
            <button type="button" onClick={() => pickEvolution("better")}
              className={`py-2.5 px-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 border transition-colors ${evolution === "better" ? "bg-green-500/20 text-green-400 border-green-500/50" : "bg-muted/40 text-muted-foreground border-border"}`}>
              <ArrowDown className="h-4 w-4" /> Mieux
            </button>
            <button type="button" onClick={() => pickEvolution("worse")}
              className={`py-2.5 px-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 border transition-colors ${evolution === "worse" ? "bg-orange-500/20 text-orange-400 border-orange-500/50" : "bg-muted/40 text-muted-foreground border-border"}`}>
              <ArrowUp className="h-4 w-4" /> Pire
            </button>
            <button type="button" onClick={() => pickEvolution("gone")}
              className={`py-2.5 px-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 border transition-colors ${evolution === "gone" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : "bg-muted/40 text-muted-foreground border-border"}`}>
              <Ban className="h-4 w-4" /> Plus rien
            </button>
          </div>

          {evolution && evolution !== "gone" && (
            <div className="space-y-1.5 pt-1">
              <Label className="text-sm font-medium">Niveau actuel de douleur</Label>
              <QuickRatingInput value={level} onChange={setLevel} min={1} max={7} labels={injuryLevelLabels} emojis={injuryLevelEmojis} variant="destructive" compact />
            </div>
          )}

          <Button onClick={handleSubmit} disabled={!evolution || submitting} className="w-full h-11 mt-1">
            {submitting ? "..." : "Valider"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
