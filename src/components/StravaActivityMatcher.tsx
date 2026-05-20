/**
 * StravaActivityMatcher
 * Affiche les activités Strava récentes non encore liées à une séance CDO.
 * L'athlète choisit quelle séance cardio correspond → les données sont auto-remplies.
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Link2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
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

// ─── Mappings Strava → CDO ────────────────────────────────────────────────────

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

// ─── SVG logo Strava ──────────────────────────────────────────────────────────

function StravaLogo({ className = "w-5 h-5 fill-white" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function StravaActivityMatcher({ athleteId, currentWeekSessions, onLinked }: Props) {
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<StravaActivity | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [rpe, setRpe] = useState("");
  const [comment, setComment] = useState("");
  const [linking, setLinking] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (athleteId) loadRecentActivities();
  }, [athleteId]);

  // ── Charge les activités Strava des 48 dernières heures non encore liées ──
  const loadRecentActivities = async () => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: activitiesData } = await supabase
      .from("strava_activities")
      .select("*")
      .eq("athlete_id", athleteId)
      .gte("start_date", since)
      .in("sport_type", Object.keys(STRAVA_TO_CDO_SPORT))
      .order("start_date", { ascending: false });

    if (!activitiesData?.length) return;

    // Exclure les activités déjà liées à une séance
    const { data: linkedSessions } = await (supabase
      .from("training_sessions")
      .select("linked_strava_activity_id")
      .eq("sportif_id", athleteId)
      .not("linked_strava_activity_id", "is", null) as any);

    const linkedIds = new Set(
      (linkedSessions || []).map((s: any) => s.linked_strava_activity_id)
    );

    const unlinked = activitiesData.filter(
      (a: any) => !linkedIds.has(a.strava_activity_id)
    );

    setActivities(unlinked as StravaActivity[]);
  };

  // ── Ouvre le dialog de liaison ────────────────────────────────────────────
  const openLinkDialog = (activity: StravaActivity) => {
    setSelectedActivity(activity);
    setSelectedSession(null);
    setRpe("");
    setComment("");
    setDialogOpen(true);
  };

  // ── Valide la liaison ─────────────────────────────────────────────────────
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

      // Trouve les exercices cardio à mettre à jour
      const cardioExercises = selectedSession.session_exercises.filter(
        (ex: any) => ex.cardio_sport
      );

      // Essaie de ne mettre à jour que les exos du bon sport, sinon tous
      const matching = cardioExercises.filter((ex: any) => ex.cardio_sport === cdoSport);
      const toUpdate = matching.length > 0 ? matching : cardioExercises;

      // Met à jour chaque exercice cardio avec les données Strava
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

      // Marque la séance comme complétée et liée à l'activité Strava
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
        `✅ "${selectedSession.athlete_custom_name || selectedSession.name}" liée à Strava — données importées !`
      );

      setDialogOpen(false);
      // Recharge les activités depuis Supabase pour être sûr que le bandeau disparaît
      await loadRecentActivities();
      onLinked();
    } catch (err) {
      console.error("Erreur liaison Strava:", err);
      toast.error("Erreur lors de la liaison");
    } finally {
      setLinking(false);
    }
  };

  // Séances cardio non complétées de la semaine
  const cardioSessions = currentWeekSessions.filter(
    (s) =>
      s.session_exercises.some((ex: any) => ex.cardio_sport) &&
      !s.session_exercises.every(
        (ex: any) => ex.sportif_rpe !== null && ex.sportif_rpe !== undefined
      )
  );

  if (activities.length === 0) return null;

  return (
    <>
      {/* ── Bandeau activités Strava ── */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-[#FC4C02] flex items-center gap-1.5">
          <StravaLogo className="w-3.5 h-3.5 fill-[#FC4C02]" />
          Activité Strava récente — à lier à une séance
        </p>

        {activities.map((activity) => {
          const cdoSport = STRAVA_TO_CDO_SPORT[activity.sport_type];
          const label = SPORT_LABEL[cdoSport] || activity.sport_type;

          return (
            <Card
              key={activity.strava_activity_id}
              className="border-[#FC4C02]/40 bg-[#FC4C02]/5"
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#FC4C02] flex items-center justify-center shrink-0">
                      <StravaLogo />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{activity.name}</span>
                        <Badge
                          variant="secondary"
                          className="text-xs bg-[#FC4C02]/10 text-[#FC4C02] border-[#FC4C02]/20 shrink-0"
                        >
                          {label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span className="font-medium text-foreground/70">
                          📅 {format(new Date(activity.start_date), "EEE d MMM", { locale: fr })}
                        </span>
                        {activity.distance_meters > 0 && (
                          <span>📍 {(activity.distance_meters / 1000).toFixed(2)} km</span>
                        )}
                        <span>⏱ {formatDuration(activity.moving_time_seconds)}</span>
                        {activity.average_heartrate && (
                          <span>❤️ {Math.round(activity.average_heartrate)} bpm</span>
                        )}
                        {activity.distance_meters > 0 && activity.moving_time_seconds > 0 && (
                          <span>🏃 {formatPace(activity.distance_meters, activity.moving_time_seconds)}/km</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="bg-[#FC4C02] hover:bg-[#e04400] text-white text-xs shrink-0"
                    onClick={() => openLinkDialog(activity)}
                  >
                    <Link2 className="h-3 w-3 mr-1" />
                    Lier
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Dialog de liaison ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[#FC4C02] flex items-center justify-center">
                <StravaLogo className="w-4 h-4 fill-white" />
              </div>
              Lier l'activité Strava
            </DialogTitle>
          </DialogHeader>

          {selectedActivity && (
            <div className="space-y-5 py-2">
              {/* Résumé de l'activité */}
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
                  {selectedActivity.distance_meters > 0 &&
                    selectedActivity.moving_time_seconds > 0 && (
                      <span>
                        🏃{" "}
                        {formatPace(
                          selectedActivity.distance_meters,
                          selectedActivity.moving_time_seconds
                        )}
                        /km
                      </span>
                    )}
                </div>
                <p className="text-xs text-[#FC4C02] font-medium mt-1">
                  ✓ Distance, durée, allure et FC seront importées automatiquement
                </p>
              </div>

              {/* Sélecteur de séance */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Quelle séance correspond à cette activité ?
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

              {/* RPE + commentaire (seulement après avoir choisi une séance) */}
              {selectedSession && (
                <div className="space-y-3 border-t pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="strava-rpe" className="text-sm font-medium">
                      Comment tu as ressenti l'effort ? (RPE 1-10){" "}
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
                      className="w-full"
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
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={linking}>
              Annuler
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
