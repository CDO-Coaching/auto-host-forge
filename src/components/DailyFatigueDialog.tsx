import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Dialog, DialogOverlay } from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Activity, X, ArrowDown, ArrowUp, Equal, Ban, Sparkles, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfettiEffect } from "./ConfettiEffect";
import { useIsMobile } from "@/hooks/use-mobile";

interface DailyFatigueDialogProps {
  open: boolean;
  onClose: () => void;
  includeInjuryQuestions?: boolean;
  isFemale?: boolean;
}

const questions = [
  {
    id: "fatigue",
    label: "Niveau de fatigue",
    labels: ["Très frais", "Frais", "Légèrement fatigué", "Fatigué", "Très fatigué", "Épuisé", "Exténué"],
    emojis: ["💪", "😊", "😐", "😓", "😩", "🥵", "💀"],
  },
  {
    id: "courbatures",
    label: "Niveau de courbatures",
    labels: ["Aucune", "Très légères", "Légères", "Modérées", "Importantes", "Très importantes", "Sévères"],
    emojis: ["✨", "👌", "🤏", "😬", "😣", "😖", "🤕"],
  },
  {
    id: "sommeil",
    label: "Qualité du sommeil",
    labels: ["Catastrophique", "Très mauvais", "Mauvais", "Moyen", "Bon", "Très bon", "Excellent"],
    emojis: ["😵", "😫", "😪", "🥱", "😌", "😴", "🌟"],
  },
  {
    id: "stress",
    label: "Niveau de stress",
    labels: ["Très calme", "Calme", "Légèrement tendu", "Modéré", "Élevé", "Très élevé", "Extrême"],
    emojis: ["🧘", "😌", "😐", "😟", "😰", "🤯", "💥"],
  },
];

const injuryLevelLabels = ["Gêne", "Très légère", "Légère", "Modérée", "Gênante", "Importante", "Très forte"];
const injuryLevelEmojis = ["🩹", "😕", "😣", "😖", "😫", "🤕", "🚑"];

type AdaptationLevel = "legere" | "moyenne" | "grosse" | null;
type InjuryEvolution = "same" | "better" | "worse" | "gone" | null;

interface PreviousInjury {
  injury_level: number;
  injury_location: string | null;
}

export function DailyFatigueDialog({ open, onClose, includeInjuryQuestions = false, isFemale = false }: DailyFatigueDialogProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({
    fatigue: 4,
    courbatures: 4,
    sommeil: 4,
    stress: 4,
  });
  const [hasInjury, setHasInjury] = useState(false);
  const [injuryLevel, setInjuryLevel] = useState(4);
  const [injuryLocation, setInjuryLocation] = useState("");
  const [adaptationLevel, setAdaptationLevel] = useState<AdaptationLevel>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [existingDates, setExistingDates] = useState<string[]>([]);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const toLocalDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // État pour la blessure précédente
  const [previousInjury, setPreviousInjury] = useState<PreviousInjury | null>(null);
  const [injuryEvolution, setInjuryEvolution] = useState<InjuryEvolution>(null);
  const [isNewInjury, setIsNewInjury] = useState(false);

  // Charger le nom de l'utilisateur et l'état de la période d'adaptation
  useEffect(() => {
    if (open) {
      setAnswers({
        fatigue: 4,
        courbatures: 4,
        sommeil: 4,
        stress: 4,
      });
      setHasInjury(false);
      setInjuryLevel(4);
      setInjuryLocation("");
      setInjuryEvolution(null);
      setIsNewInjury(false);
      setSelectedDate(new Date());
      
      loadUserName();
      loadAdaptationStatus();
      loadExistingDates();
      if (includeInjuryQuestions) {
        loadPreviousInjury();
      }
    }
  }, [open, includeInjuryQuestions]);

  const loadExistingDates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Récupérer les 90 derniers jours d'entrées pour désactiver les dates déjà remplies
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      // Utiliser format local pour éviter les problèmes de timezone
      const year = ninetyDaysAgo.getFullYear();
      const month = String(ninetyDaysAgo.getMonth() + 1).padStart(2, '0');
      const day = String(ninetyDaysAgo.getDate()).padStart(2, '0');
      const ninetyDaysAgoStr = `${year}-${month}-${day}`;
      
      const { data } = await supabase
        .from("daily_fatigue_log")
        .select("date")
        .eq("user_id", user.id)
        .gte("date", ninetyDaysAgoStr);

      if (data) {
        setExistingDates(data.map(d => d.date));
        console.log("Dates existantes chargées:", data.map(d => d.date));
      }
    } catch (error) {
      console.error("Erreur chargement dates existantes:", error);
    }
  };

  const loadUserName = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("first_name")
        .eq("id", user.id)
        .maybeSingle();
      
      if (profile?.first_name) {
        setUserName(profile.first_name);
      }
    } catch (error) {
      console.error("Error loading user name:", error);
    }
  };

  const loadPreviousInjury = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Chercher la dernière entrée (qu'elle contienne ou non une douleur)
      // Objectif: si la dernière entrée indique "pas de douleur", on ne doit PAS relancer le suivi en rouge.
      const { data } = await supabase
        .from("daily_fatigue_log")
        .select("injury_level, injury_location, has_injury")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Si la dernière entrée indique une douleur active, on propose le suivi
      if (data?.has_injury === true && typeof data.injury_level === "number" && data.injury_level > 0) {
        setPreviousInjury({
          injury_level: data.injury_level,
          injury_location: data.injury_location,
        });
        // Pré-remplir avec les données précédentes
        setInjuryLevel(data.injury_level);
        setInjuryLocation(data.injury_location || "");
      } else {
        // Dernière entrée = pas de douleur (ou douleur terminée)
        setPreviousInjury(null);
      }
    } catch (error) {
      console.error("Erreur chargement blessure précédente:", error);
      setPreviousInjury(null);
    }
  };

  const loadAdaptationStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_profiles")
        .select("adaptation_period_level")
        .eq("id", user.id)
        .single();

      if (data) {
        setAdaptationLevel(data.adaptation_period_level as AdaptationLevel || null);
      }
    } catch (error) {
      console.error("Erreur chargement période d'adaptation:", error);
    }
  };

  const handleAdaptationLevelChange = async (level: AdaptationLevel) => {
    const newLevel = adaptationLevel === level ? null : level;
    setAdaptationLevel(newLevel);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_profiles")
        .update({ adaptation_period_level: newLevel })
        .eq("id", user.id);

      if (error) throw error;

      const levelLabels: Record<string, string> = {
        legere: "légère",
        moyenne: "moyenne",
        grosse: "grosse"
      };

      toast({
        title: newLevel ? "Période d'adaptation activée" : "Période d'adaptation désactivée",
        description: newLevel 
          ? `Réduction d'intensité ${levelLabels[newLevel]} signalée à ton coach.` 
          : "Ton coach ne verra plus l'indicateur.",
      });
    } catch (error) {
      console.error("Erreur mise à jour période d'adaptation:", error);
      setAdaptationLevel(adaptationLevel); // Revert on error
    }
  };

  const handleRemoveAdaptation = async () => {
    setAdaptationLevel(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_profiles")
        .update({ adaptation_period_level: null })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Période d'adaptation désactivée",
        description: "Ton coach ne verra plus l'indicateur.",
      });
    } catch (error) {
      console.error("Erreur suppression période d'adaptation:", error);
    }
  };

  const handleInjuryEvolutionChange = (evolution: InjuryEvolution) => {
    setInjuryEvolution(evolution);

    if (evolution === "gone") {
      // Douleur terminée = on prépare un enregistrement à 0/7 à la validation
      // (on garde previousInjury pour conserver la localisation lors du submit)
      setHasInjury(false);
      setInjuryLevel(0);
      setIsNewInjury(false);
      return;
    }

    if (evolution === "better" && previousInjury) {
      setHasInjury(true);
      // Diminuer le niveau de douleur de 1 (minimum 1)
      setInjuryLevel(Math.max(1, previousInjury.injury_level - 1));
      return;
    }

    if (evolution === "worse" && previousInjury) {
      setHasInjury(true);
      // Augmenter le niveau de douleur de 1 (maximum 7)
      setInjuryLevel(Math.min(7, previousInjury.injury_level + 1));
      return;
    }

    if (evolution === "same" && previousInjury) {
      setHasInjury(true);
      setInjuryLevel(previousInjury.injury_level);
    }
  };

  const handleSliderChange = (id: string, value: number[]) => {
    setAnswers({ ...answers, [id]: value[0] });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // IMPORTANT: ne pas utiliser toISOString() (UTC) sinon risque de décalage d'un jour
      const dateToSave = toLocalDateKey(selectedDate);

      // Déterminer si on a une blessure à enregistrer
      let finalHasInjury: boolean;
      let finalInjuryLevel: number | null = null;
      let finalInjuryLocation: string | null = null;

      if (previousInjury && !isNewInjury) {
        // Cas où une blessure précédente existe
        if (injuryEvolution === "gone" || injuryEvolution === null) {
          // IMPORTANT: si l'utilisateur ne signale PAS de douleur aujourd'hui, on clôture par défaut.
          // Cela évite de rester bloqué sur la douleur précédente en rouge.
          finalHasInjury = false;
          finalInjuryLevel = 0;
          finalInjuryLocation = previousInjury.injury_location;
        } else {
          // Réponse donnée (same, better, worse)
          finalHasInjury = true;
          finalInjuryLevel = injuryLevel;
          finalInjuryLocation = previousInjury.injury_location || injuryLocation || null;
        }
      } else if (isNewInjury || hasInjury) {
        // Nouvelle blessure signalée
        finalHasInjury = true;
        finalInjuryLevel = injuryLevel;
        finalInjuryLocation = injuryLocation || null;
      } else {
        // Aucune blessure
        finalHasInjury = false;
        finalInjuryLevel = null;
        finalInjuryLocation = null;
      }

      const insertData: any = {
        user_id: user.id,
        date: dateToSave,
        fatigue: answers.fatigue,
        courbatures: answers.courbatures,
        sommeil: 8 - answers.sommeil, // Inversé : 7/7 = très bonne nuit = 1 point
        stress: answers.stress,
      };

      if (includeInjuryQuestions) {
        insertData.has_injury = finalHasInjury;
        insertData.injury_level = finalInjuryLevel;
        insertData.injury_location = finalInjuryLocation;
      }

      const { error } = await supabase
        .from("daily_fatigue_log")
        .insert(insertData);

      if (error) throw error;

      const isToday = dateToSave === toLocalDateKey(new Date());
      toast({
        title: "✅ Enregistré !",
        description: isToday 
          ? "Ton suivi de fatigue du jour a été enregistré."
          : `Suivi de fatigue du ${format(selectedDate, "d MMMM", { locale: fr })} enregistré.`,
      });

      onClose();
    } catch (error: any) {
      console.error("Error saving fatigue log:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'enregistrer les données.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const getAdaptationLevelLabel = (level: AdaptationLevel): string => {
    const labels: Record<string, string> = {
      legere: "Légère",
      moyenne: "Moyenne",
      grosse: "Grosse"
    };
    return level ? labels[level] : "";
  };

  // Contenu du formulaire partagé entre Dialog et Drawer
  const formContent = (
    <div className="space-y-3 sm:space-y-5">
      {questions.map((question) => (
        <div key={question.id} className="space-y-1 sm:space-y-2">
          <Label className="text-xs sm:text-base font-medium block">{question.label}</Label>
          
          <QuickRatingInput
            value={answers[question.id]}
            onChange={(v) => handleSliderChange(question.id, [v])}
            min={1}
            max={7}
            labels={question.labels}
            emojis={question.emojis}
          />
        </div>
      ))}

      {includeInjuryQuestions && (
        <div className="pt-2 sm:pt-3 border-t space-y-2 sm:space-y-3">
          {/* Si blessure précédente existe - afficher les options d'évolution (sauf si "Terminée") */}
          {previousInjury && !isNewInjury && injuryEvolution !== "gone" ? (
            <>
              <div className="bg-destructive/10 rounded-lg p-3 space-y-2">
                <p className="text-xs sm:text-sm font-medium text-destructive">
                  Douleur précédente : {injuryLevelLabels[previousInjury.injury_level - 1]}
                  {previousInjury.injury_location && ` (${previousInjury.injury_location})`}
                </p>
                <p className="text-xs sm:text-sm font-medium">Comment évolue ta douleur ?</p>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleInjuryEvolutionChange("same")}
                    className={`py-2 px-3 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                      injuryEvolution === "same"
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                        : "bg-muted/50 text-muted-foreground border border-muted hover:bg-muted"
                    }`}
                  >
                    <Equal className="h-3 w-3" />
                    Pareil
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInjuryEvolutionChange("better")}
                    className={`py-2 px-3 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                      injuryEvolution === "better"
                        ? "bg-green-500/20 text-green-400 border border-green-500/50"
                        : "bg-muted/50 text-muted-foreground border border-muted hover:bg-muted"
                    }`}
                  >
                    <ArrowDown className="h-3 w-3" />
                    Mieux
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInjuryEvolutionChange("worse")}
                    className={`py-2 px-3 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                      injuryEvolution === "worse"
                        ? "bg-orange-500/20 text-orange-400 border border-orange-500/50"
                        : "bg-muted/50 text-muted-foreground border border-muted hover:bg-muted"
                    }`}
                  >
                    <ArrowUp className="h-3 w-3" />
                    Pire
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInjuryEvolutionChange("gone")}
                    className={`py-2 px-3 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1 bg-muted/50 text-muted-foreground border border-muted hover:bg-muted`}
                  >
                    <Ban className="h-3 w-3" />
                    Terminée
                  </button>
                </div>

                {/* Afficher le slider si une évolution est sélectionnée */}
                {injuryEvolution && (
                  <div className="space-y-1 sm:space-y-2 pt-2">
                    <Label className="text-xs sm:text-base font-medium">Niveau actuel de douleur</Label>
                    
                    <QuickRatingInput
                      value={injuryLevel}
                      onChange={setInjuryLevel}
                      min={1}
                      max={7}
                      labels={injuryLevelLabels}
                      emojis={injuryLevelEmojis}
                      variant="destructive"
                    />
                  </div>
                )}
              </div>

              {/* Bouton pour signaler une nouvelle blessure différente */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsNewInjury(true);
                  setHasInjury(true);
                  setInjuryLevel(4);
                  setInjuryLocation("");
                }}
                className="w-full text-xs"
              >
                Signaler une nouvelle douleur
              </Button>
            </>
          ) : (
            <>
              {/* Formulaire classique pour nouvelle blessure */}
              <div className="flex items-center justify-between">
                <Label htmlFor="has-injury" className="text-xs sm:text-base font-medium">
                  Blessure ou douleur ?
                </Label>
                <Switch
                  id="has-injury"
                  checked={hasInjury}
                  onCheckedChange={(checked) => {
                    setHasInjury(checked);
                    if (!checked && isNewInjury) {
                      setIsNewInjury(false);
                    }
                  }}
                />
              </div>

              {hasInjury && (
                <>
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-base font-medium">Niveau de douleur</Label>
                    
                    <QuickRatingInput
                      value={injuryLevel}
                      onChange={setInjuryLevel}
                      min={1}
                      max={7}
                      labels={injuryLevelLabels}
                      emojis={injuryLevelEmojis}
                      variant="destructive"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="injury-location" className="text-xs sm:text-base">
                      Localisation <span className="text-muted-foreground">(optionnel)</span>
                    </Label>
                    <Input
                      id="injury-location"
                      placeholder="Ex: Genou droit, épaule gauche..."
                      value={injuryLocation}
                      onChange={(e) => setInjuryLocation(e.target.value)}
                      className="text-xs sm:text-sm"
                    />
                  </div>
                </>
              )}

              {/* Bouton retour si on était sur nouvelle blessure */}
              {isNewInjury && previousInjury && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsNewInjury(false);
                    setHasInjury(false);
                    setInjuryLevel(previousInjury.injury_level);
                    setInjuryLocation(previousInjury.injury_location || "");
                  }}
                  className="w-full text-xs"
                >
                  Retour à la douleur précédente
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Période d'adaptation */}
      <div className="pt-2 sm:pt-3 border-t">
        <p className="text-xs sm:text-sm font-medium mb-2 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Période d'adaptation (réduction d'intensité)
        </p>
        
        {/* Si période d'adaptation déjà active - afficher le statut avec bouton supprimer */}
        {adaptationLevel ? (
          <div className="space-y-2">
            <div className={`p-3 rounded-lg flex items-center justify-between ${
              adaptationLevel === "legere"
                ? "bg-yellow-500/20 border border-yellow-500/50"
                : adaptationLevel === "moyenne"
                ? "bg-orange-500/20 border border-orange-500/50"
                : "bg-red-500/20 border border-red-500/50"
            }`}>
              <span className={`text-sm font-medium ${
                adaptationLevel === "legere"
                  ? "text-yellow-400"
                  : adaptationLevel === "moyenne"
                  ? "text-orange-400"
                  : "text-red-400"
              }`}>
                Période {getAdaptationLevelLabel(adaptationLevel)} active
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveAdaptation}
                className="h-7 px-2 text-xs hover:bg-destructive/20 hover:text-destructive"
              >
                <X className="h-3 w-3 mr-1" />
                Enlever
              </Button>
            </div>
            
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Tu peux changer le niveau si besoin :
            </p>
            
            <div className="flex gap-2">
              {[
                { level: "legere" as AdaptationLevel, label: "Légère", color: "yellow" },
                { level: "moyenne" as AdaptationLevel, label: "Moyenne", color: "orange" },
                { level: "grosse" as AdaptationLevel, label: "Grosse", color: "red" },
              ].map(({ level, label, color }) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleAdaptationLevelChange(level)}
                  className={`flex-1 py-1.5 px-2 rounded-md text-[10px] sm:text-xs font-medium transition-colors ${
                    adaptationLevel === level
                      ? color === "yellow"
                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                        : color === "orange"
                        ? "bg-orange-500/20 text-orange-400 border border-orange-500/50"
                        : "bg-red-500/20 text-red-400 border border-red-500/50"
                      : "bg-muted/50 text-muted-foreground border border-muted hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              {[
                { level: "legere" as AdaptationLevel, label: "Légère", color: "yellow" },
                { level: "moyenne" as AdaptationLevel, label: "Moyenne", color: "orange" },
                { level: "grosse" as AdaptationLevel, label: "Grosse", color: "red" },
              ].map(({ level, label, color }) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleAdaptationLevelChange(level)}
                  className={`flex-1 py-2 px-3 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    adaptationLevel === level
                      ? color === "yellow"
                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                        : color === "orange"
                        ? "bg-orange-500/20 text-orange-400 border border-orange-500/50"
                        : "bg-red-500/20 text-red-400 border border-red-500/50"
                      : "bg-muted/50 text-muted-foreground border border-muted hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground text-center mt-1">
              Ton coach verra cette indication pour adapter l'intensité
            </p>
          </>
        )}
      </div>
    </div>
  );

  // Footer avec boutons
  const footerButtons = (
    <div className="flex justify-between items-center pt-3 border-t">
      <Button
        variant="ghost"
        onClick={handleSkip}
        disabled={isSubmitting}
        size="sm"
        className="text-xs sm:text-sm h-9"
      >
        Passer
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting}
        size="sm"
        className="text-xs sm:text-sm h-9"
      >
        {isSubmitting ? "..." : "Valider"}
      </Button>
    </div>
  );

  // Version mobile avec Drawer
  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={(isOpen) => !isOpen && handleSkip()}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="pb-2">
              <div className="flex items-center gap-2 justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
                <DrawerTitle className="text-base">
                  {userName ? `Bonjour ${userName} 👋` : "Bonjour 👋"}
                </DrawerTitle>
              </div>
              <DrawerDescription className="text-xs text-center">
                Une journée de plus pour prendre soin de toi ✨
              </DrawerDescription>
            </DrawerHeader>
            
            <div className="px-4 pb-4 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Sélecteur de date */}
              <div className="pb-3 border-b mb-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Date :</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "justify-start text-left font-normal h-8",
                          selectedDate.toDateString() !== new Date().toDateString() && "text-primary border-primary"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(selectedDate, "d MMMM yyyy", { locale: fr })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        disabled={(date) => {
                          const dateStr = toLocalDateKey(date);
                          const today = new Date();
                          today.setHours(23, 59, 59, 999);
                          return date > today || existingDates.includes(dateStr);
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                        locale={fr}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {selectedDate.toDateString() !== new Date().toDateString() && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Tu remplis le questionnaire pour une date passée.
                  </p>
                )}
              </div>

              {formContent}
            </div>
            
            <div className="px-4 pb-6">
              {footerButtons}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Version desktop avec Dialog animé
  return (
    <>
      <Dialog open={open} onOpenChange={handleSkip}>
        <AnimatePresence>
          {open && (
            <>
              <DialogOverlay />
              <motion.div
                initial={{ 
                  scale: 0.1, 
                  opacity: 0,
                  x: "40vw",
                  y: "-40vh"
                }}
                animate={{ 
                  scale: 1, 
                  opacity: 1,
                  x: "-50%",
                  y: "-50%"
                }}
                exit={{ 
                  scale: 0.1, 
                  opacity: 0,
                  x: "40vw",
                  y: "-40vh"
                }}
                transition={{ 
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                  duration: 0.6
                }}
                className="fixed left-[50%] top-[50%] z-50 w-full max-w-[500px] max-h-[95vh] flex flex-col p-6 gap-0 border bg-background shadow-2xl rounded-xl"
              >
                {/* Close button */}
                <button
                  onClick={handleSkip}
                  className="absolute right-3 top-3 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Fermer</span>
                </button>

                {/* Header */}
                <div className="pb-3 space-y-1 pr-10">
                  <div className="flex items-center gap-2">
                    <motion.div
                      initial={{ rotate: -20, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ delay: 0.3, type: "spring" }}
                    >
                      <Sparkles className="h-5 w-5 text-primary" />
                    </motion.div>
                    <h2 className="text-xl font-semibold leading-none tracking-tight">
                      {userName ? `Bonjour ${userName} 👋` : "Bonjour 👋"}
                    </h2>
                  </div>
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-sm text-muted-foreground"
                  >
                    Une journée de plus pour prendre soin de toi ✨
                  </motion.p>
                </div>

                {/* Sélecteur de date */}
                <div className="pb-3 border-b">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground">Date :</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "justify-start text-left font-normal h-8",
                            selectedDate.toDateString() !== new Date().toDateString() && "text-primary border-primary"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(selectedDate, "d MMMM yyyy", { locale: fr })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => date && setSelectedDate(date)}
                          disabled={(date) => {
                            const dateStr = toLocalDateKey(date);
                            const today = new Date();
                            today.setHours(23, 59, 59, 999);
                            return date > today || existingDates.includes(dateStr);
                          }}
                          initialFocus
                          className="p-3 pointer-events-auto"
                          locale={fr}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {selectedDate.toDateString() !== new Date().toDateString() && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Tu remplis le questionnaire pour une date passée. Le rappel d'aujourd'hui restera actif.
                    </p>
                  )}
                </div>

                {/* Scrollable content */}
                <div className="flex-1 min-h-0 overflow-y-auto pr-1 py-3">
                  {formContent}
                </div>

                <FooterButtons />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </Dialog>
    </>
  );
}
