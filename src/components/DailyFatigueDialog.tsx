import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Activity, X, ArrowDown, ArrowUp, Equal, Ban } from "lucide-react";

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
  },
  {
    id: "courbatures",
    label: "Niveau de courbatures",
    labels: ["Aucune", "Très légères", "Légères", "Modérées", "Importantes", "Très importantes", "Sévères"],
  },
  {
    id: "sommeil",
    label: "Qualité du sommeil",
    labels: ["Catastrophique", "Très mauvais", "Mauvais", "Moyen", "Bon", "Très bon", "Excellent"],
  },
  {
    id: "stress",
    label: "Niveau de stress",
    labels: ["Très calme", "Calme", "Légèrement tendu", "Modéré", "Élevé", "Très élevé", "Extrême"],
  },
];

const injuryLevelLabels = ["Gêne", "Très légère", "Légère", "Modérée", "Gênante", "Importante", "Très forte"];

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
  const { toast } = useToast();

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
      
      loadUserName();
      loadAdaptationStatus();
      if (includeInjuryQuestions) {
        loadPreviousInjury();
      }
    }
  }, [open, includeInjuryQuestions]);

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

      const today = new Date().toISOString().split('T')[0];

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
        date: today,
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

      toast({
        title: "✅ Enregistré !",
        description: "Ton suivi de fatigue du jour a été enregistré.",
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

  return (
    <Dialog open={open} onOpenChange={handleSkip}>
      <DialogContent className="sm:max-w-[500px] max-h-[95vh] flex flex-col p-3 sm:p-6 gap-0 overflow-hidden">
        <DialogHeader className="pb-2 sm:pb-3 space-y-1 pr-10">
          <DialogTitle className="text-base sm:text-xl">
            {userName ? `Bonjour ${userName} 👋` : "Suivi quotidien"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {userName ? "Comment te sens-tu aujourd'hui ?" : "Évalue ton état du jour"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-5 flex-1 overflow-y-auto pr-1">
          {questions.map((question) => (
            <div key={question.id} className="space-y-1 sm:space-y-2">
              <Label className="text-xs sm:text-base font-medium block">{question.label}</Label>
              
              <Slider
                value={[answers[question.id]]}
                onValueChange={(value) => handleSliderChange(question.id, value)}
                min={1}
                max={7}
                step={1}
                className="w-full"
              />
              
              <div className="flex justify-between text-[9px] sm:text-xs text-muted-foreground px-0.5">
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
                <span>6</span>
                <span>7</span>
              </div>
              
              <div className="text-center">
                <span className="inline-block px-2 py-0.5 sm:px-4 sm:py-1.5 bg-primary/10 text-primary rounded text-[10px] sm:text-sm font-medium">
                  {question.labels[answers[question.id] - 1]}
                </span>
              </div>
            </div>
          ))}

          {includeInjuryQuestions && (
            <>
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
                          
                          <Slider
                            value={[injuryLevel]}
                            onValueChange={(value) => setInjuryLevel(value[0])}
                            min={1}
                            max={7}
                            step={1}
                            className="w-full"
                          />
                          
                          <div className="flex justify-between text-[9px] sm:text-xs text-muted-foreground px-0.5">
                            <span>1</span>
                            <span>2</span>
                            <span>3</span>
                            <span>4</span>
                            <span>5</span>
                            <span>6</span>
                            <span>7</span>
                          </div>
                          
                          <div className="text-center">
                            <span className="inline-block px-2 py-0.5 sm:px-4 sm:py-1.5 bg-destructive/10 text-destructive rounded text-[10px] sm:text-sm font-medium">
                              {injuryLevelLabels[injuryLevel - 1]}
                            </span>
                          </div>
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
                          
                          <Slider
                            value={[injuryLevel]}
                            onValueChange={(value) => setInjuryLevel(value[0])}
                            min={1}
                            max={7}
                            step={1}
                            className="w-full"
                          />
                          
                          <div className="flex justify-between text-[9px] sm:text-xs text-muted-foreground px-0.5">
                            <span>1</span>
                            <span>2</span>
                            <span>3</span>
                            <span>4</span>
                            <span>5</span>
                            <span>6</span>
                            <span>7</span>
                          </div>
                          
                          <div className="text-center">
                            <span className="inline-block px-2 py-0.5 sm:px-4 sm:py-1.5 bg-destructive/10 text-destructive rounded text-[10px] sm:text-sm font-medium">
                              {injuryLevelLabels[injuryLevel - 1]}
                            </span>
                          </div>
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
            </>
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

        <div className="flex justify-between items-center pt-2 sm:pt-3 border-t mt-2 flex-shrink-0">
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={isSubmitting}
            size="sm"
            className="text-xs sm:text-sm h-8 sm:h-9"
          >
            Passer
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            size="sm"
            className="text-xs sm:text-sm h-8 sm:h-9"
          >
            {isSubmitting ? "..." : "Valider"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
