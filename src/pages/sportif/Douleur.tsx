import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, MapPin, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { InjuryBodyDialog } from "@/components/InjuryBodyDialog";

const injuryLevelLabels = ["Gêne", "Très légère", "Légère", "Modérée", "Gênante", "Importante", "Très forte"];
const injuryLevelEmojis = ["🩹", "😕", "😣", "😖", "😫", "🤕", "🚑"];

function toLocalDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Douleur() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [location, setLocation] = useState("");
  const [level, setLevel] = useState(0);
  const [description, setDescription] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const hasZone = !!location;

  const handleSubmit = async () => {
    if (!user) return;
    if (!hasZone) {
      setPickerOpen(true);
      return;
    }
    setSubmitting(true);
    try {
      const dateToSave = toLocalDateKey(new Date());
      const finalLocation = description.trim()
        ? `${location} — ${description.trim()}`
        : location;

      // Une seule ligne par jour : on met à jour si elle existe déjà
      // (ex. questionnaire de fatigue rempli plus tôt), sinon on l'insère.
      const { data: existing } = await supabase
        .from("daily_fatigue_log")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", dateToSave)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("daily_fatigue_log")
          .update({ has_injury: true, injury_level: level, injury_location: finalLocation })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Pas encore de ligne aujourd'hui : on crée l'entrée douleur.
        // Les scores de bien-être prennent la meilleure valeur (1) pour ne pas
        // générer de fausse alerte de fatigue — le questionnaire de fatigue
        // mettra à jour ces champs s'il est rempli ensuite.
        const { error } = await supabase
          .from("daily_fatigue_log")
          .insert({
            user_id: user.id,
            date: dateToSave,
            fatigue: 1,
            courbatures: 1,
            sommeil: 1,
            stress: 1,
            has_injury: true,
            injury_level: level,
            injury_location: finalLocation,
          });
        if (error) throw error;
      }

      toast({
        title: "Douleur signalée 🙏",
        description: "Ton coach est prévenu et adaptera ta prochaine séance.",
      });
      navigate("/sportif/dashboard");
    } catch (error: any) {
      console.error("Erreur enregistrement douleur:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'enregistrer la douleur.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-24 sm:pb-6 max-w-lg mx-auto">
      <button
        onClick={() => navigate("/sportif/dashboard")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground active:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      {/* En-tête */}
      <div
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{
          background: "linear-gradient(135deg, rgba(239,90,60,0.16), rgba(22,21,20,0.35) 65%)",
          border: "1px solid rgba(239,90,60,0.4)",
        }}
      >
        <span className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(239,90,60,0.2)" }}>
          <Heart className="h-6 w-6" style={{ color: "#ff7a5c" }} />
        </span>
        <div className="min-w-0">
          <h1 className="text-[17px] font-bold" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Signaler une douleur</h1>
          <p className="text-[12.5px] text-muted-foreground leading-snug mt-0.5">
            Même une petite gêne. Ton coach <b className="text-foreground">adapte ta séance</b> pour ne pas l'aggraver.
          </p>
        </div>
      </div>

      {/* Zone + intensité */}
      {!hasZone ? (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full h-14 rounded-2xl border-2 border-[rgba(239,90,60,0.4)] bg-[rgba(239,90,60,0.08)] flex items-center justify-center gap-2 text-[15px] font-bold text-[#ff9a80] active:scale-[0.99] transition-transform"
          style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
        >
          <MapPin className="h-5 w-5" />
          Où as-tu mal ?
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full flex items-center justify-between gap-2 rounded-2xl border border-[rgba(239,90,60,0.4)] bg-[rgba(239,90,60,0.08)] px-4 py-3 text-left"
        >
          <div className="min-w-0">
            <p className="text-[15px] font-bold truncate" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>{location}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Douleur {injuryLevelLabels[level - 1]?.toLowerCase()} {injuryLevelEmojis[level - 1]}
            </p>
          </div>
          <span className="flex items-center gap-1 text-[12px] font-semibold text-[#ff9a80] shrink-0">
            <Pencil className="h-3.5 w-3.5" /> Modifier
          </span>
        </button>
      )}

      {/* Explication */}
      <div className="space-y-1.5">
        <label className="text-[13px] font-semibold text-muted-foreground">
          Explique ta douleur (optionnel)
        </label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Depuis quand, dans quel mouvement, ça tire / ça pique / ça lance..."
          rows={4}
          className="resize-none"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full h-12 text-[15px] font-bold"
        style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
      >
        {submitting ? "..." : hasZone ? "Envoyer à mon coach" : "Indiquer où j'ai mal"}
      </Button>

      <InjuryBodyDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initialLocation={location}
        initialLevel={level || 3}
        onValidate={(loc, lvl) => { setLocation(loc); setLevel(lvl); }}
      />
    </div>
  );
}
