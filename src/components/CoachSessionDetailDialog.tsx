import { useState, useEffect } from "react";
import { HeartRateZonesBar } from "@/components/HeartRateZonesBar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Heart, Dumbbell, MessageSquare, Clock, Activity, User, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface CardioStep {
  id: number;
  movement_type: "course" | "marche" | "velo" | "natation";
  effort_type: "duration" | "distance";
  duration?: number; // secondes
  distance?: number;
  distance_unit?: "m" | "km";
  vma_percentage?: number;
  rpe?: number;
  target_heart_rate?: string;
  block_id?: number;
}

interface CardioBlock {
  id: number;
  repetitions: number;
  steps: CardioStep[];
}

interface SessionExercise {
  id: string;
  exercice: string;
  series: number | null;
  reps: string | null;
  charge: string | null;
  rpe: string | null;
  tempo: string | null;
  recuperation: string | null;
  sportif_rpe: number | null;
  sportif_comment: string | null;
  commentaire: string | null;
  skipped: boolean | null;
  is_duration: boolean | null;
  super_set_group: string | null;
  exercise_order: number | null;
  cardio_sport: string | null;
  cardio_content: string | null;
  actual_duration_minutes: number | null;
  actual_distance_km: number | null;
  actual_pace_min_per_km: string | null;
  actual_avg_heart_rate: number | null;
  actual_max_heart_rate: number | null;
  actual_cadence: number | null;
  actual_elevation_gain: number | null;
  actual_calories: number | null;
  actual_heart_rate_zones: { zone: number; min: number; max: number; time_seconds: number }[] | null;
}

interface SessionDetail {
  id: string;
  name: string;
  session_type: string;
  completed_at: string | null;
  duration_minutes: number | null;
  session_rpe: number | null;
  session_comment: string | null;
  coach_liked: boolean | null;
  coach_feedback: string | null;
  linked_strava_activity_id: number | null;
  exercises: SessionExercise[];
}

interface CoachSessionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  sessionType: string;
  athleteId: string;
  athleteName: string;
  fcMax?: number | null;
  fcRepos?: number | null;
}

export function CoachSessionDetailDialog({
  open,
  onOpenChange,
  sessionId,
  sessionType,
  athleteId,
  athleteName,
  fcMax = null,
  fcRepos = null,
}: CoachSessionDetailDialogProps) {
  const { session: authSession } = useAuth();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (open && sessionId && sessionType !== "custom") {
      loadSessionDetail();
    }
  }, [open, sessionId, sessionType]);

  useEffect(() => {
    if (session) {
      setIsLiked(session.coach_liked || false);
      setFeedback(session.coach_feedback || "");
      setHasChanges(false);
    }
  }, [session]);

  const loadSessionDetail = async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("training_sessions")
        .select(`
          id,
          name,
          session_type,
          completed_at,
          duration_minutes,
          session_rpe,
          session_comment,
          coach_liked,
          coach_feedback,
          linked_strava_activity_id,
          session_exercises (
            id,
            exercice,
            series,
            reps,
            charge,
            rpe,
            tempo,
            recuperation,
            sportif_rpe,
            sportif_comment,
            commentaire,
            skipped,
            is_duration,
            super_set_group,
            exercise_order,
            cardio_sport,
            cardio_content,
            actual_duration_minutes,
            actual_distance_km,
            actual_pace_min_per_km,
            actual_avg_heart_rate,
            actual_max_heart_rate,
            actual_cadence,
            actual_elevation_gain,
            actual_calories,
            actual_heart_rate_zones
          )
        `)
        .eq("id", sessionId)
        .single();

      if (error) throw error;

      setSession({
        ...data,
        linked_strava_activity_id: (data as any).linked_strava_activity_id ?? null,
        exercises: (data.session_exercises || []) as SessionExercise[],
      });
    } catch (error) {
      console.error("Error loading session:", error);
      toast.error("Erreur lors du chargement de la séance");
    } finally {
      setLoading(false);
    }
  };

  const handleLikeToggle = () => {
    setIsLiked(!isLiked);
    setHasChanges(true);
  };

  const handleFeedbackChange = (value: string) => {
    setFeedback(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!session || !authSession?.user?.id) return;

    setSaving(true);
    try {
      // Update training_sessions
      const { error: updateError } = await supabase
        .from("training_sessions")
        .update({
          coach_liked: isLiked,
          coach_feedback: feedback.trim() || null,
          coach_feedback_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      if (updateError) throw updateError;

      // Send message to athlete if there's any feedback (like or comment)
      if (isLiked || feedback.trim()) {
        const { data: coachProfile } = await supabase
          .from("user_profiles")
          .select("first_name")
          .eq("id", authSession.user.id)
          .single();

        const coachFirstName = coachProfile?.first_name || "Ton coach";
        
        let messageContent = "";
        
        if (isLiked && feedback.trim()) {
          messageContent = `💪 ${coachFirstName} a aimé ta séance "${session.name}" !\n\n💬 Son message : "${feedback.trim()}"`;
        } else if (isLiked) {
          messageContent = `💪 ${coachFirstName} a aimé ta séance "${session.name}" ! Continue comme ça ! 🎉`;
        } else if (feedback.trim()) {
          messageContent = `💬 ${coachFirstName} a commenté ta séance "${session.name}" :\n\n"${feedback.trim()}"`;
        }

        if (messageContent) {
          const { error: msgError } = await supabase
            .from("messages")
            .insert({
              sender_id: authSession.user.id,
              receiver_id: athleteId,
              content: messageContent,
            });

          if (msgError) {
            console.error("Error sending message:", msgError);
            // Don't throw - the main save was successful
          }
        }
      }

      toast.success(isLiked ? "Séance likée ! L'athlète a été notifié 🎉" : "Feedback envoyé !");
      setHasChanges(false);
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving feedback:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const getSessionTypeLabel = (type: string) => {
    switch (type) {
      case "muscu": return "Musculation";
      case "cardio": return "Cardio";
      case "recup": return "Récupération";
      case "custom": return "Séance perso";
      default: return type;
    }
  };

  const getSessionTypeColor = (type: string) => {
    switch (type) {
      case "muscu": return "bg-blue-500/20 text-blue-600 border-blue-500/30";
      case "cardio": return "bg-orange-500/20 text-orange-600 border-orange-500/30";
      case "recup": return "bg-green-500/20 text-green-600 border-green-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getRpeColor = (rpe: number) => {
    if (rpe <= 5) return "text-green-600";
    if (rpe <= 7) return "text-yellow-600";
    return "text-red-600";
  };

  const formatSeconds = (sec: number): string => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
    if (s > 0) return `${m}:${s.toString().padStart(2, "0")}`;
    return `${m} min`;
  };

  const movementLabel: Record<string, string> = {
    course: "🏃 Course", marche: "🚶 Marche", velo: "🚴 Vélo", natation: "🏊 Natation",
  };

  const renderCardioStep = (step: CardioStep, key: string | number) => (
    <div key={key} className="flex items-center justify-between rounded px-2.5 py-1.5 bg-muted/30 border border-border/30 text-xs">
      <span className="font-medium text-foreground/90">
        {movementLabel[step.movement_type] ?? step.movement_type}
      </span>
      <div className="flex items-center gap-2 text-muted-foreground">
        {step.effort_type === "duration" && step.duration != null && (
          <span className="font-medium text-foreground">{formatSeconds(step.duration)}</span>
        )}
        {step.effort_type === "distance" && step.distance != null && (
          <span className="font-medium text-foreground">{step.distance} {step.distance_unit ?? "m"}</span>
        )}
        {step.vma_percentage != null && step.vma_percentage > 0 && (
          <span className="text-primary/80">{step.vma_percentage}% VMA</span>
        )}
        {step.rpe != null && step.rpe > 0 && (
          <span className="text-orange-400">RPE {step.rpe}</span>
        )}
        {step.target_heart_rate && (() => {
          const zNum = parseInt(step.target_heart_rate.replace("Z", ""));
          const FCR_Z = [{z:1,pMin:50,pMax:60},{z:2,pMin:60,pMax:70},{z:3,pMin:70,pMax:80},{z:4,pMin:80,pMax:90},{z:5,pMin:90,pMax:100}];
          const zd = FCR_Z.find(z => z.z === zNum);
          const bpmStr = zd && fcMax && fcRepos
            ? ` · ${Math.round(fcRepos + (fcMax - fcRepos) * zd.pMin / 100)}–${Math.round(fcRepos + (fcMax - fcRepos) * zd.pMax / 100)} bpm`
            : "";
          return <span className="text-rose-400">❤️ {step.target_heart_rate}{bpmStr}</span>;
        })()}
      </div>
    </div>
  );

  const renderCardioSteps = (ex: SessionExercise) => {
    if (!ex.cardio_content) return null;
    let parsed: { steps?: CardioStep[]; blocks?: CardioBlock[] } = {};
    try { parsed = JSON.parse(ex.cardio_content); } catch { return null; }

    const allSteps: CardioStep[] = Array.isArray(parsed) ? parsed : (parsed.steps ?? []);
    const blocks: CardioBlock[] = parsed.blocks ?? [];

    if (allSteps.length === 0 && blocks.length === 0) return null;

    // Construire la liste d'affichage en respectant l'ordre des steps
    const seenBlockIds = new Set<number>();
    const blockMap: Record<number, CardioBlock> = {};
    blocks.forEach(b => { blockMap[b.id] = b; });

    // Regrouper les steps par block_id pour le rendu dans l'ordre
    const blockStepMap: Record<number, CardioStep[]> = {};
    allSteps.filter(s => s.block_id).forEach(s => {
      if (!blockStepMap[s.block_id!]) blockStepMap[s.block_id!] = [];
      blockStepMap[s.block_id!].push(s);
    });

    const displayItems: React.ReactNode[] = [];
    allSteps.forEach((step) => {
      if (!step.block_id) {
        // Step standalone
        displayItems.push(renderCardioStep(step, step.id));
      } else if (!seenBlockIds.has(step.block_id)) {
        // Premier step d'un bloc → rendre tout le bloc
        seenBlockIds.add(step.block_id);
        const block = blockMap[step.block_id];
        if (block) {
          displayItems.push(
            <div key={`block-${block.id}`} className="rounded border border-amber-500/40 bg-amber-500/8 overflow-hidden">
              <div className="px-2.5 py-1 bg-amber-500/20 flex items-center gap-1.5 border-b border-amber-500/30">
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide">
                  {block.repetitions}× répétitions
                </span>
              </div>
              <div className="p-1 space-y-1">
                {(blockStepMap[block.id] ?? block.steps ?? []).map((s) =>
                  renderCardioStep(s, `${block.id}-${s.id}`)
                )}
              </div>
            </div>
          );
        }
      }
      // Si déjà vu ce block_id → on skip (déjà rendu)
    });

    return <div className="mt-2 space-y-1.5">{displayItems}</div>;
  };

  const renderExerciseContent = (ex: SessionExercise) => {
    const hasActualData = ex.actual_duration_minutes != null || ex.actual_distance_km != null || ex.actual_pace_min_per_km != null || ex.actual_avg_heart_rate != null;
    const isCardio = !!ex.cardio_sport || !!ex.cardio_content;

    return (
      <>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className={`font-medium ${ex.skipped ? "line-through" : ""}`}>
              {ex.exercice}
            </p>
            {/* Renfo : séries / reps / charge / tempo / récup */}
            {!isCardio && (
              <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-2">
                {!ex.is_duration && ex.series && <span>{ex.series} séries</span>}
                {!ex.is_duration && ex.reps && <span>× {ex.reps}{(ex as any).is_distance ? "m" : " reps"}</span>}
                {ex.charge && <span>@ {ex.charge}</span>}
                {ex.rpe && <span>RPE cible {ex.rpe}</span>}
                {ex.tempo && <span>Tempo {ex.tempo}</span>}
                {ex.recuperation && <span>Récup {ex.recuperation}</span>}
                {ex.is_duration && <span className="italic">Durée libre</span>}
                {(ex as any).is_distance && <span className="italic">Distance</span>}
              </div>
            )}
          </div>
          {ex.sportif_rpe && (
            <Badge variant="outline" className={getRpeColor(ex.sportif_rpe)}>
              RPE {ex.sportif_rpe}
            </Badge>
          )}
        </div>

        {/* Plan cardio prévu */}
        {isCardio && renderCardioSteps(ex)}

        {/* Données réelles (Strava ou saisie manuelle) */}
        {hasActualData && (
          <div className="mt-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 p-2.5">
            <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h4.172L10.463 0l-7 13.828h4.169" /></svg>
              Réalisé
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {ex.actual_duration_minutes != null && (
                <div className="flex justify-between"><span className="text-muted-foreground">Durée</span><span className="font-medium">{ex.actual_duration_minutes} min</span></div>
              )}
              {ex.actual_distance_km != null && (
                <div className="flex justify-between"><span className="text-muted-foreground">Distance</span><span className="font-medium">{ex.actual_distance_km} km</span></div>
              )}
              {ex.actual_pace_min_per_km != null && (
                <div className="flex justify-between"><span className="text-muted-foreground">Allure</span><span className="font-medium">{ex.actual_pace_min_per_km} /km</span></div>
              )}
              {ex.actual_avg_heart_rate != null && (
                <div className="flex justify-between"><span className="text-muted-foreground">FC moy.</span><span className="font-medium">{ex.actual_avg_heart_rate} bpm</span></div>
              )}
              {ex.actual_max_heart_rate != null && (
                <div className="flex justify-between"><span className="text-muted-foreground">FC max</span><span className="font-medium">{ex.actual_max_heart_rate} bpm</span></div>
              )}
              {ex.actual_cadence != null && (
                <div className="flex justify-between"><span className="text-muted-foreground">Cadence</span><span className="font-medium">{Math.round(ex.actual_cadence)} spm</span></div>
              )}
              {ex.actual_elevation_gain != null && ex.actual_elevation_gain > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Dénivelé</span><span className="font-medium">+{Math.round(ex.actual_elevation_gain)} m</span></div>
              )}
              {ex.actual_calories != null && (
                <div className="flex justify-between"><span className="text-muted-foreground">Calories</span><span className="font-medium">{ex.actual_calories} kcal</span></div>
              )}
            </div>
            {ex.actual_heart_rate_zones && ex.actual_heart_rate_zones.length > 0 && (
              <div className="mt-2 pt-2 border-t border-emerald-500/20">
                <HeartRateZonesBar zones={ex.actual_heart_rate_zones} fcMax={fcMax} fcRepos={fcRepos} />
              </div>
            )}
          </div>
        )}

        {(ex.sportif_comment || ex.commentaire) && (
          <div className="mt-2 text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-2">
            {ex.sportif_comment || ex.commentaire}
          </div>
        )}
      </>
    );
  };

  if (sessionType === "custom") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {athleteName}
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8 text-muted-foreground">
            <p>Les séances personnelles ne peuvent pas être consultées en détail.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <span>{athleteName}</span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : session ? (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto pr-4">
              <div className="space-y-4">
                {/* Session info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">{session.name}</h3>
                    <Badge className={getSessionTypeColor(session.session_type)}>
                      {getSessionTypeLabel(session.session_type)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {session.completed_at
                        ? format(parseISO(session.completed_at), "d MMM yyyy 'à' HH:mm", { locale: fr })
                        : "Non terminée"}
                    </span>
                    {session.duration_minutes && (
                      <span>{session.duration_minutes} min</span>
                    )}
                    {session.linked_strava_activity_id && (
                      <span className="flex items-center gap-1 text-[#FC4C02] text-xs font-medium">
                        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h4.172L10.463 0l-7 13.828h4.169" /></svg>
                        Strava
                      </span>
                    )}
                  </div>

                  {/* Session RPE & Comment */}
                  {(session.session_rpe || session.session_comment) && (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      {session.session_rpe && (
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          <span className="text-sm">RPE global:</span>
                          <span className={`font-bold ${getRpeColor(session.session_rpe)}`}>
                            {session.session_rpe}/10
                          </span>
                        </div>
                      )}
                      {session.session_comment && (
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 mt-0.5" />
                          <p className="text-sm italic">{session.session_comment}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Exercises */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Dumbbell className="h-4 w-4" />
                    Exercices ({session.exercises.length})
                  </h4>

                  {session.exercises.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Aucun exercice</p>
                  ) : (
                    <div className="space-y-2">
                      {(() => {
                        const processedGroups = new Set<string>();
                        const items: React.ReactNode[] = [];
                        
                        session.exercises
                          .sort((a, b) => (a.exercise_order || 0) - (b.exercise_order || 0))
                          .forEach((ex) => {
                          if (ex.super_set_group) {
                            if (processedGroups.has(ex.super_set_group)) return;
                            processedGroups.add(ex.super_set_group);
                            
                            const groupExercises = session.exercises
                              .filter((e) => e.super_set_group === ex.super_set_group)
                              .sort((a, b) => (a.exercise_order || 0) - (b.exercise_order || 0));
                            
                            items.push(
                              <div key={`superset-${ex.super_set_group}`} className="border-l-2 border-primary rounded-lg overflow-hidden">
                                <div className="bg-primary/10 px-3 py-1.5 flex items-center gap-2">
                                  <Badge className="bg-primary text-primary-foreground text-xs">Superset</Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {groupExercises.length} exercices · {groupExercises[0]?.series || "?"} séries
                                  </span>
                                </div>
                                <div className="space-y-1 p-1">
                                  {groupExercises.map((gex) => (
                                    <div
                                      key={gex.id}
                                      className={`p-3 rounded-lg ${
                                        gex.skipped ? "bg-muted/30 opacity-60" : "bg-card"
                                      }`}
                                    >
                                      {renderExerciseContent(gex)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          } else {
                            items.push(
                              <div
                                key={ex.id}
                                className={`p-3 rounded-lg border ${
                                  ex.skipped ? "bg-muted/30 opacity-60" : "bg-card"
                                }`}
                              >
                                {renderExerciseContent(ex)}
                              </div>
                            );
                          }
                        });
                        
                        return items;
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Coach feedback section */}
            <Separator className="my-2" />
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Ton feedback</span>
                <Button
                  variant={isLiked ? "default" : "outline"}
                  size="sm"
                  onClick={handleLikeToggle}
                  className={isLiked ? "bg-red-500 hover:bg-red-600" : ""}
                >
                  <Heart className={`h-4 w-4 mr-1 ${isLiked ? "fill-current" : ""}`} />
                  {isLiked ? "J'aime !" : "J'aime"}
                </Button>
              </div>

              <Textarea
                placeholder="Écris un message pour ton athlète... (optionnel)"
                value={feedback}
                onChange={(e) => handleFeedbackChange(e.target.value)}
                rows={2}
                className="resize-none"
              />

              <Button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="w-full"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {saving ? "Envoi..." : "Envoyer le feedback"}
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Impossible de charger la séance
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
