/**
 * StravaActivityMatcher
 * Bouton "Lier séance Strava" → affiche les 4 dernières activités Strava
 * non encore liées + permet de les associer à une séance CDO.
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Link2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StravaActivity {
  id: string;
  strava_activity_id: number;
  name: string;
  sport_type: string;
  start_date: string;
  distance_meters: number;
  moving_time_seconds: number;
  average_heartrate: number | null;
  average_speed_ms: number | null;
  linkedSessionName?: string; // nom de la séance liée si déjà associée
}

interface Session {
  id: string;
  name: string;
  session_type: string;
  athlete_custom_name: string | null;
  session_exercises: any[];
}

interface Props {
  athleteId: string;
  currentWeekSessions: Session[];
  onLinked: () => void;
}

// ─── Mappings ─────────────────────────────────────────────────────────────────

const STRAVA_TO_CDO_SPORT: Record<string, string> = {
  Run: "course",
  TrailRun: "course",
  VirtualRun: "course",
  Walk: "course",
  Hike: "course",
  Ride: "velo",
  VirtualRide: "velo",
  EBikeRide: "velo",
  Swim: "natation",
};

const SPORT_LABEL: Record<string, string> = {
  course: "Course",
  velo: "Vélo",
  natation: "Natation",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPace(distanceMeters: number, movingTimeSeconds: number): string {
  if (!distanceMeters || !movingTimeSeconds) return "";
  const secPerKm = (movingTimeSeconds / distanceMeters) * 1000;
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  return `${m} min`;
}

function StravaLogo({ className = "w-4 h-4 fill-white" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function StravaActivityMatcher({ athleteId, currentWeekSessions, onLinked }: Props) {
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<StravaActivity | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [rpe, setRpe] = useState("");
  const [comment, setComment] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [hasStrava, setHasStrava] = useState(false);

  useEffect(() => {
    if (athleteId) checkStravaConnection();
  }, [athleteId]);

  // Vérifie si l'athlète a Strava connecté
  const checkStravaConnection = async () => {
    const { data } = await supabase
      .from("strava_tokens")
      .select("athlete_id")
      .eq("athlete_id", athleteId)
      .single();
    setHasStrava(!!data);
  };

  // Charge les 4 dernières activités Strava avec leur statut de liaison
  const loadActivities = async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: activitiesData } = await supabase
      .from("strava_activities")
      .select("*")
      .eq("athlete_id", athleteId)
      .gte("start_date", since)
      .in("sport_type", Object.keys(STRAVA_TO_CDO_SPORT))
      .order("start_date", { ascending: false })
      .limit(4);

    if (!activitiesData?.length) {
      setActivities([]);
      return;
    }

    // Récupère les séances déjà liées avec leur nom
    const { data: linkedSessions } = await (supabase
      .from("training_sessions")
      .select("linked_strava_activity_id, name, athlete_custom_name")
      .eq("sportif_id", athleteId)
      .not("linked_strava_activity_id", "is", null) as any);

    const linkedMap = new Map(
      (linkedSessions || []).map((s: any) => [
        s.linked_strava_activity_id,
        s.athlete_custom_name || s.name,
      ])
    );

    const enriched = (activitiesData as StravaActivity[]).map((a) => ({
      ...a,
      linkedSessionName: linkedMap.get(a.strava_activity_id) as string | undefined,
    }));

    setActivities(enriched);
  };

  const openList = async () => {
    await loadActivities();
    setListOpen(true);
  };

  const openLinkDialog = (activity: StravaActivity) => {
    setSelectedActivity(activity);
    setSelectedSession(null);
    setRpe("");
    setComment("");
    setLinkDialogOpen(true);
  };

  // ── Crée une séance perso à partir de l'activité Strava ──────────────────
  const handleCreateCustomSession = async () => {
    if (!selectedActivity) return;
    setLinking(true);
    try {
      const cdoSport = STRAVA_TO_CDO_SPORT[selectedActivity.sport_type];
      const distanceKm = parseFloat((selectedActivity.distance_meters / 1000).toFixed(2));
      const durationMin = Math.round(selectedActivity.moving_time_seconds / 60);
      const pace = formatPace(selectedActivity.distance_meters, selectedActivity.moving_time_seconds);
      const dateStr = selectedActivity.start_date.split("T")[0];

      await (supabase.from("custom_sessions") as any).insert({
        user_id: athleteId,
        session_name: selectedActivity.name,
        cardio_type: cdoSport || null,
        duration_minutes: durationMin,
        completed_at: selectedActivity.start_date,
        scheduled_date: dateStr,
        distance_km: distanceKm || null,
        avg_pace: pace || null,
        avg_heart_rate: selectedActivity.average_heartrate
          ? Math.round(selectedActivity.average_heartrate)
          : null,
        description: comment.trim() || null,
      });

      toast.success(`✅ "${selectedActivity.name}" ajoutée en séance perso !`);
      setLinkDialogOpen(false);
      setListOpen(false);
      await loadActivities();
      onLinked();
    } catch (err) {
      console.error("Erreur création séance perso:", err);
      toast.error("Erreur lors de la création");
    } finally {
      setLinking(false);
    }
  };

  const handleLink = async () => {
    if (!selectedActivity || !selectedSession) return;

    const rpeNum = parseInt(rpe);
    if (isNaN(rpeNum) || rpeNum < 1 || rpeNum > 10) {
      toast.error("Le RPE doit être entre 1 et 10");
      return;
    }

    setLinking(true);
    try {
      const distanceKm = parseFloat((selectedActivity.distance_meters / 1000).toFixed(2));
      const durationMin = Math.round(selectedActivity.moving_time_seconds / 60);
      const pace = formatPace(selectedActivity.distance_meters, selectedActivity.moving_time_seconds);
      const cdoSport = STRAVA_TO_CDO_SPORT[selectedActivity.sport_type];

      const cardioExercises = selectedSession.session_exercises.filter(
        (ex: any) => ex.cardio_sport
      );
      const matching = cardioExercises.filter((ex: any) => ex.cardio_sport === cdoSport);
      const toUpdate = matching.length > 0 ? matching : cardioExercises;

      for (const ex of toUpdate) {
        await supabase
          .from("session_exercises")
          .update({
            actual_distance_km: distanceKm,
            actual_duration_minutes: durationMin,
            actual_pace_min_per_km: pace || null,
            actual_avg_heart_rate: selectedActivity.average_heartrate
              ? Math.round(selectedActivity.average_heartrate)
              : null,
            sportif_rpe: rpeNum,
            sportif_comment: comment.trim() || null,
            sportif_feedback_at: new Date().toISOString(),
          })
          .eq("id", ex.id);
      }

      await (supabase
        .from("training_sessions")
        .update({
          linked_strava_activity_id: selectedActivity.strava_activity_id,
          completed_at: new Date().toISOString(),
          session_rpe: rpeNum,
          duration_minutes: durationMin,
          cardio_total_distance_km: distanceKm,
          cardio_total_duration_minutes: durationMin,
        })
        .eq("id", selectedSession.id) as any);

      toast.success(
        `✅ "${selectedSession.athlete_custom_name || selectedSession.name}" liée — données Strava importées !`
      );

      setLinkDialogOpen(false);
      setListOpen(false);
      await loadActivities();
      onLinked();
    } catch (err) {
      console.error("Erreur liaison Strava:", err);
      toast.error("Erreur lors de la liaison");
    } finally {
      setLinking(false);
    }
  };

  // Séances cardio non complétées
  const cardioSessions = currentWeekSessions.filter(
    (s) =>
      s.session_exercises.some((ex: any) => ex.cardio_sport) &&
      !s.session_exercises.every(
        (ex: any) => ex.sportif_rpe !== null && ex.sportif_rpe !== undefined
      )
  );

  if (!hasStrava) return null;

  return (
    <>
      {/* ── Bouton compact ── */}
      <Button
        variant="outline"
        size="sm"
        onClick={openList}
        className="border-[#FC4C02]/40 text-[#FC4C02] hover:bg-[#FC4C02]/10 hover:border-[#FC4C02] text-xs gap-1.5 h-8"
      >
        <div className="w-3.5 h-3.5 rounded bg-[#FC4C02] flex items-center justify-center">
          <StravaLogo className="w-2.5 h-2.5 fill-white" />
        </div>
        Lier séance Strava
      </Button>

      {/* ── Dialog liste des activités ── */}
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[#FC4C02] flex items-center justify-center">
                <StravaLogo />
              </div>
              Activités Strava récentes
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucune activité récente à lier.
              </p>
            ) : (
              activities.map((activity) => {
                const cdoSport = STRAVA_TO_CDO_SPORT[activity.sport_type];
                const label = SPORT_LABEL[cdoSport] || activity.sport_type;
                const isLinked = !!activity.linkedSessionName;

                return (
                  <button
                    key={activity.strava_activity_id}
                    onClick={() => !isLinked && openLinkDialog(activity)}
                    disabled={isLinked}
                    className={`w-full text-left rounded-lg border p-3 transition-colors group ${
                      isLinked
                        ? "border-green-500/30 bg-green-500/5 cursor-default opacity-80"
                        : "border-border hover:border-[#FC4C02]/50 hover:bg-[#FC4C02]/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{activity.name}</span>
                          <Badge
                            variant="secondary"
                            className="text-xs bg-[#FC4C02]/10 text-[#FC4C02] border-[#FC4C02]/20 shrink-0"
                          >
                            {label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                          <span className="font-medium">
                            📅 {format(new Date(activity.start_date), "EEE d MMM", { locale: fr })}
                          </span>
                          {activity.distance_meters > 0 && (
                            <span>📍 {(activity.distance_meters / 1000).toFixed(2)} km</span>
                          )}
                          <span>⏱ {formatDuration(activity.moving_time_seconds)}</span>
                          {activity.average_heartrate && (
                            <span>❤️ {Math.round(activity.average_heartrate)} bpm</span>
                          )}
                        </div>
                        {isLinked && (
                          <p className="text-xs text-green-600 font-medium mt-1.5">
                            ✓ Lié à "{activity.linkedSessionName}"
                          </p>
                        )}
                      </div>
                      {!isLinked && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-[#FC4C02] shrink-0 transition-colors" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog de liaison ── */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[#FC4C02] flex items-center justify-center">
                <StravaLogo />
              </div>
              Lier à une séance
            </DialogTitle>
          </DialogHeader>

          {selectedActivity && (
            <div className="space-y-5 py-2">
              {/* Résumé activité */}
              <div className="rounded-lg bg-[#FC4C02]/10 border border-[#FC4C02]/20 p-3 space-y-1.5">
                <p className="font-medium text-sm">{selectedActivity.name}</p>
                <p className="text-xs text-muted-foreground font-medium">
                  📅 {format(new Date(selectedActivity.start_date), "EEEE d MMMM", { locale: fr })}
                </p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {selectedActivity.distance_meters > 0 && (
                    <span>📍 {(selectedActivity.distance_meters / 1000).toFixed(2)} km</span>
                  )}
                  <span>⏱ {formatDuration(selectedActivity.moving_time_seconds)}</span>
                  {selectedActivity.average_heartrate && (
                    <span>❤️ {Math.round(selectedActivity.average_heartrate)} bpm</span>
                  )}
                  {selectedActivity.distance_meters > 0 && selectedActivity.moving_time_seconds > 0 && (
                    <span>🏃 {formatPace(selectedActivity.distance_meters, selectedActivity.moving_time_seconds)}/km</span>
                  )}
                </div>
                <p className="text-xs text-[#FC4C02] font-medium pt-0.5">
                  ✓ Distance, durée, allure et FC importées automatiquement
                </p>
              </div>

              {/* Sélecteur de séance */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Quelle séance correspond ?
                </Label>
                {cardioSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Aucune séance cardio disponible cette semaine.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {cardioSessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => setSelectedSession(session)}
                        className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                          selectedSession?.id === session.id
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        {session.athlete_custom_name || session.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Créer séance perso */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex-1 border-t" />
                <span>ou</span>
                <div className="flex-1 border-t" />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                disabled={linking}
                onClick={handleCreateCustomSession}
              >
                <Link2 className="h-3 w-3 mr-1.5" />
                Créer une séance perso à partir de cette activité
              </Button>

              {/* RPE */}
              {selectedSession && (
                <div className="space-y-3 border-t pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="strava-rpe" className="text-sm font-medium">
                      Ressenti de l'effort (RPE 1-10){" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="strava-rpe"
                      type="number"
                      min="1"
                      max="10"
                      value={rpe}
                      onChange={(e) => setRpe(e.target.value)}
                      placeholder="Ex: 7"
                    />
                    <p className="text-xs text-muted-foreground">
                      1 = très facile · 10 = effort maximal
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="strava-comment" className="text-sm">
                      Commentaire (optionnel)
                    </Label>
                    <Input
                      id="strava-comment"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Comment s'est passée la séance ?"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setLinkDialogOpen(false)}
              disabled={linking}
            >
              Retour
            </Button>
            <Button
              onClick={handleLink}
              disabled={!selectedSession || !rpe || linking}
              className="bg-[#FC4C02] hover:bg-[#e04400] text-white"
            >
              {linking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Valider & importer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
