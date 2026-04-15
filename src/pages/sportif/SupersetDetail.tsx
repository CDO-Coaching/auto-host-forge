import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Timer, Video, Zap, Weight, Repeat, Clock, Check, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { ExerciseFeedbackDialog } from "@/components/ExerciseFeedbackDialog";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import { TimerOverlay } from "@/components/TimerOverlay";
import { TempoExplanationDialog } from "@/components/TempoExplanationDialog";
import { RPEExplanationDialog } from "@/components/RPEExplanationDialog";
import { UniversalTimer } from "@/components/UniversalTimer";
import { FloatingSessionTimer } from "@/components/FloatingSessionTimer";
import { calculate1RM, parseWeight, parseReps, shouldRecordMax } from "@/lib/maxCalculations";
import { useRecoveryTimer } from "@/hooks/useRecoveryTimer";
import { useWakeLock } from "@/hooks/useWakeLock";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SerieDetail {
  reps?: string;
  charge?: string;
  rpe?: string;
  tempo?: string;
  commentaire?: string;
  recuperation?: string;
}

interface SerieValidation {
  validated: boolean;
  rpe: number | null;
}

export default function SupersetDetail() {
  useWakeLock(true);
  const { sessionId, supersetId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [exercises, setExercises] = useState<any[]>([]); // All exercises in superset (not deduplicated)
  const [loading, setLoading] = useState(true);
  const [weekId, setWeekId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [showRecoveryOverlay, setShowRecoveryOverlay] = useState(false);
  const [seriesCollapsed, setSeriesCollapsed] = useState(false);
  const [showChainOverlay, setShowChainOverlay] = useState(false);
  const [chainExerciseName, setChainExerciseName] = useState("");
  const [showRoundCelebration, setShowRoundCelebration] = useState(false);
  const [completedRoundNumber, setCompletedRoundNumber] = useState(0);
  const [pendingRoundRecovery, setPendingRoundRecovery] = useState<string | null>(null);

  // Per-series validation: indexed by global series index (round * numExercises + exerciseIdx)
  const [serieValidations, setSerieValidations] = useState<SerieValidation[]>([]);
  const [rpeDialogOpen, setRpeDialogOpen] = useState(false);
  const [rpeDialogSerieIndex, setRpeDialogSerieIndex] = useState<number | null>(null);
  const [rpeInputValue, setRpeInputValue] = useState("");
  const [computedAvgRpe, setComputedAvgRpe] = useState<string | undefined>(undefined);

  const {
    timers,
    isRunning: timersRunning,
    startTimer,
    pauseTimer,
    resetTimer,
    formatTime: formatTimerTime,
  } = useRecoveryTimer();

  const recoveryTimerId = `superset-recovery-${supersetId}`;
  const recoveryTime = timers[recoveryTimerId] || 0;
  const isRecoveryRunning = timersRunning[recoveryTimerId] || false;

  useEffect(() => {
    loadSupersetDetail();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadSupersetDetail();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [supersetId]);

  const loadSupersetDetail = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("session_exercises")
      .select("*")
      .eq("super_set_group", supersetId)
      .order("exercise_order");

    if (error) {
      console.error("Erreur lors du chargement du superset:", error);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setLoading(false);
      return;
    }

    // Deduplicate by exercise name for display (keep unique exercises)
    const uniqueExercises = data.reduce((acc: any[], current: any) => {
      if (!acc.find((ex) => ex.exercice === current.exercice)) {
        acc.push(current);
      }
      return acc;
    }, []);

    setExercises(uniqueExercises);

    // Load video URLs
    const exerciseNames = uniqueExercises.map((ex: any) => ex.exercice).filter(Boolean);
    if (exerciseNames.length > 0) {
      const { data: libraryData } = await supabase
        .from("exercise_library")
        .select("name, video_url")
        .in("name", exerciseNames);

      if (libraryData) {
        const videoMap: Record<string, string> = {};
        libraryData.forEach((row: any) => {
          if (row.video_url) videoMap[row.name] = row.video_url;
        });
        setVideoUrls(videoMap);
      }
    }

    // Get weekId
    const { data: sessionRow } = await supabase
      .from("training_sessions")
      .select("week_id")
      .eq("id", data[0].session_id)
      .maybeSingle();
    if (sessionRow?.week_id) setWeekId(sessionRow.week_id);

    setLoading(false);
  };

  // Build the series data for each exercise
  const getSeriesDataForExercise = (exercise: any): SerieDetail[] => {
    let details: SerieDetail[] = [];
    if (exercise.serie_details) {
      try {
        details = typeof exercise.serie_details === 'string'
          ? JSON.parse(exercise.serie_details)
          : exercise.serie_details;
      } catch (e) { details = []; }
    }

    const totalSets = exercise.series ? parseInt(exercise.series) : 0;
    if (totalSets === 0) return [];

    const series: SerieDetail[] = [];
    for (let i = 0; i < totalSets; i++) {
      const detail = details[i] || {};
      series.push({
        reps: detail.reps || exercise.reps || "",
        charge: detail.charge || exercise.charge || "",
        rpe: detail.rpe || exercise.rpe || "",
        tempo: detail.tempo || exercise.tempo || "",
        commentaire: detail.commentaire || "",
        recuperation: detail.recuperation || "",
      });
    }
    return series;
  };

  // Total number of rounds (series count from first exercise)
  const totalRounds = exercises.length > 0 ? (exercises[0].series ? parseInt(exercises[0].series) : 0) : 0;
  const totalValidationSlots = totalRounds * exercises.length;

  // Initialize validations
  useEffect(() => {
    if (exercises.length > 0 && totalRounds > 0) {
      const savedValidations = localStorage.getItem(`superset-series-validations-${supersetId}`);
      if (savedValidations) {
        try {
          const parsed = JSON.parse(savedValidations);
          if (Array.isArray(parsed) && parsed.length === totalValidationSlots) {
            setSerieValidations(parsed);
            return;
          }
        } catch (e) {}
      }
      setSerieValidations(Array.from({ length: totalValidationSlots }, () => ({ validated: false, rpe: null })));
    }
  }, [exercises.length, totalRounds]);

  // Save validations
  useEffect(() => {
    if (supersetId && serieValidations.length > 0) {
      localStorage.setItem(`superset-series-validations-${supersetId}`, JSON.stringify(serieValidations));
    }
  }, [serieValidations, supersetId]);

  const getValidationIndex = (roundIdx: number, exIdx: number) => roundIdx * exercises.length + exIdx;

  const completedCount = serieValidations.filter(s => s.validated).length;
  const allValidated = serieValidations.length > 0 && serieValidations.every(s => s.validated);

  const handleValidateSerie = (roundIdx: number, exIdx: number) => {
    const idx = getValidationIndex(roundIdx, exIdx);
    setRpeDialogSerieIndex(idx);
    
    // Get coach RPE for this specific series
    const seriesData = getSeriesDataForExercise(exercises[exIdx]);
    const coachRpe = seriesData[roundIdx]?.rpe;
    const defaultVal = coachRpe ? String(Math.min(10, Math.max(1, parseInt(coachRpe)))) : "7";
    setRpeInputValue(defaultVal);
    setRpeDialogOpen(true);
  };

  const handleRpeSubmit = () => {
    const rpeNumber = Number(rpeInputValue) || 7;
    if (rpeNumber < 1 || rpeNumber > 10) {
      toast({ title: "RPE invalide", description: "Le RPE doit être entre 1 et 10", variant: "destructive" });
      return;
    }
    if (rpeDialogSerieIndex === null) return;

    const newValidations = [...serieValidations];
    newValidations[rpeDialogSerieIndex] = { validated: true, rpe: rpeNumber };
    setSerieValidations(newValidations);

    setRpeDialogOpen(false);
    setRpeDialogSerieIndex(null);
    setRpeInputValue("");

    // Figure out position
    const roundIdx = Math.floor(rpeDialogSerieIndex / exercises.length);
    const exIdx = rpeDialogSerieIndex % exercises.length;

    // Check if all validated → feedback dialog
    const allNowValidated = newValidations.every(s => s.validated);
    if (allNowValidated && newValidations.length > 0) {
      const avgRpe = Math.round(newValidations.reduce((sum, s) => sum + (s.rpe || 0), 0) / newValidations.length);
      setComputedAvgRpe(avgRpe.toString());
      setDialogOpen(true);
      return;
    }

    // Check if this round is complete (for recovery between rounds, no celebration)
    const roundComplete = exercises.every((_, eIdx) => {
      const vIdx = getValidationIndex(roundIdx, eIdx);
      return newValidations[vIdx]?.validated;
    });

    if (roundComplete) {
      // Round finished but not all sets → just start recovery if available
      const lastExIdx = exercises.length - 1;
      const lastExSeriesData = getSeriesDataForExercise(exercises[lastExIdx]);
      const roundRecup = lastExSeriesData[roundIdx]?.recuperation || exercises[lastExIdx]?.recuperation;
      
      if (roundRecup) {
        startTimer(recoveryTimerId, roundRecup);
        setShowRecoveryOverlay(true);
      }
      return;
    }

    // Not round complete: there's a next exercise in this round
    const nextExIdx = exIdx + 1;
    if (nextExIdx < exercises.length) {
      const seriesData = getSeriesDataForExercise(exercises[exIdx]);
      const recup = seriesData[roundIdx]?.recuperation || exercises[exIdx]?.recuperation;

      if (recup) {
        // Show recovery timer
        startTimer(recoveryTimerId, recup);
        setShowRecoveryOverlay(true);
      } else {
        // No recovery → show "Enchaîné" for 1.5s
        setChainExerciseName(exercises[nextExIdx]?.exercice || "");
        setShowChainOverlay(true);
        setTimeout(() => setShowChainOverlay(false), 1500);
      }
    }
  };

  const handleValidateFeedback = async (rpe: string, comment: string) => {
    const rpeValue = rpe ? parseInt(rpe) : null;

    // Compute average from per-serie RPEs
    const serieRpes = serieValidations.filter(s => s.rpe !== null).map(s => s.rpe!);
    const finalRpe = serieRpes.length > 0
      ? Math.round(serieRpes.reduce((a, b) => a + b, 0) / serieRpes.length)
      : rpeValue;

    // Update all exercises in the superset
    const { data: allExerciseRows } = await supabase
      .from("session_exercises")
      .select("*")
      .eq("super_set_group", supersetId);

    if (!allExerciseRows) return;

    for (let i = 0; i < allExerciseRows.length; i++) {
      const exercise = allExerciseRows[i];
      // Build per-serie RPE for this exercise (rounds where this exercise was validated)
      const exIdx = exercises.findIndex(e => e.id === exercise.id);
      const perSerieRpe: { rpe: number | null }[] = [];
      if (exIdx >= 0) {
        for (let r = 0; r < totalRounds; r++) {
          const vIdx = r * exercises.length + exIdx;
          perSerieRpe.push({ rpe: serieValidations[vIdx]?.rpe ?? null });
        }
      }

      const { error } = await supabase
        .from("session_exercises")
        .update({
          sportif_comment: comment.trim() || null,
          sportif_rpe: finalRpe,
          sportif_feedback_at: new Date().toISOString(),
          serie_rpe_details: perSerieRpe.length > 0 ? perSerieRpe : null,
        } as any)
        .eq("id", exercise.id);

      if (error) {
        console.error("Erreur lors de la sauvegarde:", error);
        toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" });
        throw error;
      }

      if (finalRpe && shouldRecordMax(exercise.charge, exercise.reps, finalRpe)) {
        await recordTheoreticalMax(exercise, finalRpe);
      }
    }

    toast({ title: "Superset validé !", description: "Tous les exercices ont été enregistrés" });

    // Cleanup
    localStorage.removeItem(`superset-series-validations-${supersetId}`);
    localStorage.removeItem(`superset-progress-${supersetId}`);

    setDialogOpen(false);
    setShowCelebration(true);
  };

  const recordTheoreticalMax = async (exercise: any, rpeValue: number) => {
    try {
      const weight = parseWeight(exercise.charge);
      const repsValue = parseReps(exercise.reps);
      if (!weight || !repsValue) return;

      const theoretical1RM = calculate1RM(weight, repsValue, rpeValue, exercise.tempo);

      const { data: libraryData } = await supabase
        .from("exercise_library")
        .select("id")
        .eq("name", exercise.exercice)
        .maybeSingle();

      if (!libraryData?.id) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: latestMax } = await supabase
        .from("exercise_maxes")
        .select("weight_kg")
        .eq("athlete_id", user.id)
        .eq("exercise_id", libraryData.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestMax || theoretical1RM > latestMax.weight_kg) {
        const { error: insertError } = await supabase.from("exercise_maxes").insert({
          athlete_id: user.id,
          exercise_id: libraryData.id,
          max_type: "max_theorique",
          weight_kg: theoretical1RM,
          recorded_at: new Date().toISOString(),
          notes: `Calculé depuis: ${exercise.charge} x ${exercise.reps} reps @ RPE ${rpeValue}`,
        });

        if (!insertError) {
          toast({ title: "Max théorique enregistré", description: `${theoretical1RM} kg sur ${exercise.exercice}` });
        }
      }
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du max théorique:", error);
    }
  };

  const handleCelebrationComplete = () => {
    setShowCelebration(false);
    toast({ title: "Superset terminé !", description: "Tous les rounds ont été validés" });
    setTimeout(() => {
      if (weekId && sessionId) {
        navigate(`/sportif/seance/${weekId}/${sessionId}`);
      } else if (sessionId) {
        navigate(`/sportif/seance/${sessionId}`);
      } else {
        navigate("/sportif/seances");
      }
    }, 300);
  };

  const handleBack = () => {
    if (weekId && sessionId) {
      navigate(`/sportif/seance/${weekId}/${sessionId}`);
    } else {
      navigate("/sportif/seances");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground text-sm">Chargement...</p>
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className="min-h-screen p-3 sm:p-4">
        <p className="text-center text-muted-foreground text-sm mt-8">Superset introuvable</p>
      </div>
    );
  }

  // Build all series data per exercise
  const allSeriesData = exercises.map(ex => getSeriesDataForExercise(ex));

  return (
    <div className="min-h-screen bg-background pb-20">
      {sessionId && <FloatingSessionTimer sessionId={sessionId} />}
      <UniversalTimer />

      <CelebrationOverlay
        show={showCelebration}
        message="Superset terminé !"
        onComplete={handleCelebrationComplete}
        type="exercise"
      />

      <TimerOverlay
        show={showRecoveryOverlay}
        onClose={() => setShowRecoveryOverlay(false)}
        timeRemaining={recoveryTime}
        isRunning={isRecoveryRunning}
        onStart={() => {
          startTimer(recoveryTimerId, "1min30s");
        }}
        onPause={() => pauseTimer(recoveryTimerId)}
        onReset={() => resetTimer(recoveryTimerId)}
        title="Récupération"
      />

      {/* Chain overlay - no recovery */}
      {showChainOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setShowChainOverlay(false)}>
          <div className="bg-gradient-to-br from-primary to-primary/80 p-6 sm:p-8 rounded-3xl shadow-2xl text-center min-w-[260px] max-w-[90vw] animate-scale-in">
            <Zap className="h-12 w-12 text-primary-foreground mx-auto mb-3" />
            <h2 className="text-xl sm:text-2xl font-black text-primary-foreground mb-2">
              Enchaîné directement !
            </h2>
            <p className="text-lg font-semibold text-primary-foreground/90">
              {chainExerciseName}
            </p>
          </div>
        </div>
      )}

      {/* Round celebration removed - celebration only on final validation */}

      <ExerciseFeedbackDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onValidate={handleValidateFeedback}
        onCancel={() => setDialogOpen(false)}
        exerciseName="Superset"
        exerciseType="renfo"
        isRpeRequired={!allValidated}
        defaultRpe={computedAvgRpe}
      />

      {/* RPE Dialog for serie validation */}
      <Dialog open={rpeDialogOpen} onOpenChange={setRpeDialogOpen}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle>
              {rpeDialogSerieIndex !== null && (() => {
                const roundIdx = Math.floor(rpeDialogSerieIndex / exercises.length);
                const exIdx = rpeDialogSerieIndex % exercises.length;
                return `S${roundIdx + 1} - ${exercises[exIdx]?.exercice || ""}`;
              })()}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label>RPE ressenti (1-10) <span className="text-destructive">*</span></Label>
                <RPEExplanationDialog />
              </div>
              <div className="flex flex-col items-center gap-3">
                <span className={`text-4xl font-bold ${
                  Number(rpeInputValue) <= 3 ? "text-green-500" :
                  Number(rpeInputValue) <= 6 ? "text-yellow-500" :
                  Number(rpeInputValue) <= 8 ? "text-orange-500" :
                  "text-red-500"
                }`}>
                  {rpeInputValue || "7"}
                </span>
                <Slider
                  min={1}
                  max={10}
                  step={1}
                  value={[Number(rpeInputValue) || 7]}
                  onValueChange={(val) => setRpeInputValue(String(val[0]))}
                  className="w-full"
                />
                <div className="flex justify-between w-full text-xs text-muted-foreground">
                  <span>Facile</span>
                  <span>Maximum</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRpeDialogOpen(false)} className="w-full sm:w-auto">
              Annuler
            </Button>
            <Button onClick={handleRpeSubmit} className="w-full sm:w-auto">
              Valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2 sm:mb-4">
          <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 w-8 sm:h-10 sm:w-10 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Superset</h1>
          <Badge variant="secondary" className="ml-auto text-xs">
            {exercises.map(ex => ex.exercice).join(" + ")}
          </Badge>
        </div>

        {/* Exercise names summary */}
        <Card className="border-2 border-primary/30">
          <CardContent className="p-3 sm:p-4">
            <div className="space-y-2">
              {exercises.map((ex, idx) => (
                <div key={ex.id} className="flex items-center gap-2">
                  <span className="text-lg font-bold text-primary">{idx + 1}</span>
                  <span className="font-medium uppercase">{ex.exercice}</span>
                  {videoUrls[ex.exercice] && (
                    <a href={videoUrls[ex.exercice]} target="_blank" rel="noopener noreferrer" className="text-xl" onClick={(e) => e.stopPropagation()}>
                      🎥
                    </a>
                  )}
                </div>
              ))}
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                Progression — {completedCount}/{totalValidationSlots}
              </p>
              {completedCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSeriesCollapsed(!seriesCollapsed)} className="h-7 px-2">
                  {seriesCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Series rounds */}
        {!seriesCollapsed && (
          <div className="space-y-4">
            {Array.from({ length: totalRounds }, (_, roundIdx) => {
              const roundValidations = exercises.map((_, exIdx) => {
                const vIdx = getValidationIndex(roundIdx, exIdx);
                return serieValidations[vIdx];
              });
              const roundComplete = roundValidations.every(v => v?.validated);

              return (
                <Card key={roundIdx} className={`border-2 transition-all ${roundComplete ? "border-green-500/30 bg-green-500/5" : "border-primary/20"}`}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant={roundComplete ? "default" : "outline"} className={roundComplete ? "bg-green-600" : ""}>
                        Série {roundIdx + 1}
                      </Badge>
                      {roundComplete && <Check className="h-4 w-4 text-green-600" />}
                    </div>

                    <div className="space-y-2">
                      {exercises.map((ex, exIdx) => {
                        const vIdx = getValidationIndex(roundIdx, exIdx);
                        const validation = serieValidations[vIdx];
                        const isValidated = validation?.validated;
                        const serieData = allSeriesData[exIdx]?.[roundIdx] || {};

                        return (
                          <div key={`${roundIdx}-${exIdx}`}>
                            {/* Exercise row */}
                            <div className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border transition-all ${
                              isValidated
                                ? "bg-green-500/10 border-green-500/30"
                                : "bg-muted/30 border-border"
                            }`}>
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium text-sm uppercase ${isValidated ? "text-green-700 dark:text-green-400" : ""}`}>
                                  {ex.exercice}
                                </p>
                                <div className="flex items-center gap-2 flex-wrap text-xs mt-1">
                                  {serieData.reps && (
                                    <span className="font-medium">
                                      {serieData.reps}{ex.is_duration ? "s" : " reps"}
                                      {ex.per_side && " /côté"}
                                    </span>
                                  )}
                                  {serieData.charge && (
                                    <span className="font-medium text-red-500">{serieData.charge}</span>
                                  )}
                                  {serieData.rpe && !isValidated && (
                                    <span className="text-yellow-600">RPE {serieData.rpe}</span>
                                  )}
                                  {isValidated && validation.rpe !== null && (
                                    <span className="text-green-600 font-medium">RPE {validation.rpe}</span>
                                  )}
                                  {serieData.tempo && (
                                    <span className="text-purple-500">T:{serieData.tempo}</span>
                                  )}
                                  {serieData.commentaire && (
                                    <span className="text-muted-foreground italic truncate">"{serieData.commentaire}"</span>
                                  )}
                                </div>
                              </div>

                              {isValidated ? (
                                <Check className="h-5 w-5 text-green-600 shrink-0" />
                              ) : (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleValidateSerie(roundIdx, exIdx)}
                                  className="h-8 px-3 shrink-0"
                                >
                                  <Check className="h-3.5 w-3.5 mr-1" />
                                  OK
                                </Button>
                              )}
                            </div>

                            {/* Recovery info under each exercise */}
                            {exIdx < exercises.length - 1 ? (
                              <div className="flex items-center gap-2 py-1 px-3 text-xs text-muted-foreground">
                                {(serieData.recuperation || ex.recuperation) ? (
                                  <>
                                    <Clock className="h-3 w-3" />
                                    <span>Récup: {serieData.recuperation || ex.recuperation}</span>
                                  </>
                                ) : (
                                  <>
                                    <Zap className="h-3 w-3 text-primary" />
                                    <span className="text-primary font-medium">Enchaîné avec {exercises[exIdx + 1]?.exercice}</span>
                                  </>
                                )}
                              </div>
                            ) : (
                              /* Last exercise of the round: show round recovery */
                              (() => {
                                const lastRecup = serieData.recuperation || ex.recuperation;
                                return lastRecup ? (
                                  <div className="flex items-center gap-2 py-1 px-3 text-xs text-muted-foreground/70">
                                    <Timer className="h-3 w-3" />
                                    <span>Récup fin de série: {lastRecup}</span>
                                  </div>
                                ) : null;
                              })()
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {seriesCollapsed && (
          <div className="text-sm text-muted-foreground text-center py-2">
            {completedCount} exercice{completedCount > 1 ? "s" : ""} validé{completedCount > 1 ? "s" : ""} sur {totalValidationSlots}
          </div>
        )}

        {/* Finish button */}
        {allValidated && (
          <Button
            size="lg"
            className="w-full text-base sm:text-lg py-6 bg-primary hover:bg-primary/90"
            onClick={() => setDialogOpen(true)}
          >
            Superset terminé 🎉
          </Button>
        )}

        {!allValidated && (
          <Button
            size="lg"
            variant="outline"
            className="w-full text-base sm:text-lg py-6"
            onClick={() => {
              const avgRpe = serieValidations.filter(s => s.rpe !== null).map(s => s.rpe!);
              if (avgRpe.length > 0) {
                setComputedAvgRpe(String(Math.round(avgRpe.reduce((a, b) => a + b, 0) / avgRpe.length)));
              }
              setDialogOpen(true);
            }}
          >
            Terminer le superset
          </Button>
        )}
      </div>
    </div>
  );
}
