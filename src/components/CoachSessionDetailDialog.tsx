import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Heart, Dumbbell, MessageSquare, Clock, Activity, User, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface SessionExercise {
  id: string;
  exercice: string;
  series: number | null;
  reps: string | null;
  charge: string | null;
  sportif_rpe: number | null;
  sportif_comment: string | null;
  commentaire: string | null;
  skipped: boolean | null;
  is_duration: boolean | null;
  super_set_group: string | null;
  exercise_order: number | null;
}

interface SessionDetail {
  id: string;
  name: string;
  session_type: string;
  completed_at: string;
  duration_minutes: number | null;
  session_rpe: number | null;
  session_comment: string | null;
  coach_liked: boolean | null;
  coach_feedback: string | null;
  exercises: SessionExercise[];
}

interface CoachSessionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  sessionType: string;
  athleteId: string;
  athleteName: string;
}

export function CoachSessionDetailDialog({
  open,
  onOpenChange,
  sessionId,
  sessionType,
  athleteId,
  athleteName,
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
          session_exercises (
            id,
            exercice,
            series,
            reps,
            charge,
            sportif_rpe,
            sportif_comment,
            commentaire,
            skipped,
            is_duration
          )
        `)
        .eq("id", sessionId)
        .single();

      if (error) throw error;

      setSession({
        ...data,
        exercises: data.session_exercises || [],
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
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {/* Session info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">{session.name}</h3>
                    <Badge className={getSessionTypeColor(session.session_type)}>
                      {getSessionTypeLabel(session.session_type)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {format(parseISO(session.completed_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                    </span>
                    {session.duration_minutes && (
                      <span>{session.duration_minutes} min</span>
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
                      {session.exercises.map((ex) => (
                        <div
                          key={ex.id}
                          className={`p-3 rounded-lg border ${
                            ex.skipped ? "bg-muted/30 opacity-60" : "bg-card"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className={`font-medium ${ex.skipped ? "line-through" : ""}`}>
                                {ex.exercice}
                              </p>
                              
                              {/* Prescription */}
                              <div className="text-sm text-muted-foreground mt-1">
                                {!ex.is_duration && (
                                  <>
                                    {ex.series && <span>{ex.series}x</span>}
                                    {ex.reps && <span>{ex.reps}</span>}
                                    {ex.charge && <span className="ml-1">@ {ex.charge}</span>}
                                  </>
                                )}
                                {ex.is_duration && (
                                  <span className="italic">Durée</span>
                                )}
                              </div>
                            </div>

                            {/* Exercise RPE */}
                            {ex.sportif_rpe && (
                              <Badge variant="outline" className={getRpeColor(ex.sportif_rpe)}>
                                RPE {ex.sportif_rpe}
                              </Badge>
                            )}
                          </div>

                          {/* Exercise feedback */}
                          {(ex.sportif_comment || ex.commentaire) && (
                            <div className="mt-2 text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                              {ex.sportif_comment || ex.commentaire}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

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
