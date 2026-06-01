import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Timer, Video, Zap, Weight, Repeat, Clock, Check, ChevronDown, ChevronUp, ArrowLeft, Plus, Minus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  actual_reps?: string | null;
  actual_charge?: string | null;
  modification_type?: "failure" | "too_easy" | null;
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
  const [rpeActualReps, setRpeActualReps] = useState("");
  const [rpeActualCharge, setRpeActualCharge] = useState("");
  const [modificationType, setModificationType] = useState<"none" | "failure" | "too_easy">("none");
  const [computedAvgRpe, setComputedAvgRpe] = useState<string | undefined>(undefined);
  // "??" / range charge management: per exercise index
  const [isChargeRequired, setIsChargeRequired] = useState(false);
  const [chargeRangeOptions, setChargeRangeOptions] = useState<[string, string] | null>(null);
  const [suggestedChargeByExIdx, setSuggestedChargeByExIdx] = useState<Record<number, string>>({});
  // range reps management
  const [isRepsRequired, setIsRepsRequired] = useState(false);
  const [repsRangeOptions, setRepsRangeOptions] = useState<[string, string] | null>(null);

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

  // AMRAP detection
  const rawSeries = exercises[0]?.series ?? "1";
  const amrapMatch = String(rawSeries).match(/^amrap:(\d+)$/);
  const isAmrap = !!amrapMatch;
  const amrapSeconds = amrapMatch ? parseInt(amrapMatch[1]) : null;
  const amrapMinutes = amrapSeconds ? Math.floor(amrapSeconds / 60) : null;
  const amrapLabel = amrapSeconds
    ? (amrapMinutes && amrapMinutes >= 60
        ? `${Math.floor(amrapMinutes / 60)}h${amrapMinutes % 60 > 0 ? `${(amrapMinutes % 60).toString().padStart(2, "0")}min` : ""}`
        : `${amrapMinutes} min`)
    : null;

  // Total number of rounds (series count from first exercise; AMRAP uses a large cap)
  const AMRAP_CAP = 30;
  const totalRounds = exercises.length > 0
    ? (isAmrap ? AMRAP_CAP : (exercises[0].series ? parseInt(exercises[0].series) || 0 : 0))
    : 0;
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

    // Detect "??" or range (e.g. "25-30") charge → required input
    const serieCharge = (seriesData[roundIdx]?.charge || exercises[exIdx]?.charge || "").trim();
    const chargeRangeMatch = serieCharge.match(/^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)$/);
    const chargeIsUnknown = serieCharge === "??" || !!chargeRangeMatch;
    setIsChargeRequired(chargeIsUnknown);
    setChargeRangeOptions(chargeRangeMatch ? [chargeRangeMatch[1].replace(",", "."), chargeRangeMatch[2].replace(",", ".")] : null);

    // Detect range reps (e.g. "8-10") → required input
    const serieReps = (seriesData[roundIdx]?.reps || exercises[exIdx]?.reps || "").trim();
    const repsRangeMatch = serieReps.match(/^(\d+)\s*-\s*(\d+)$/);
    setIsRepsRequired(!!repsRangeMatch);
    setRepsRangeOptions(repsRangeMatch ? [repsRangeMatch[1], repsRangeMatch[2]] : null);

    // Pre-fill with suggestion from previous round (same exercise)
    setRpeActualCharge(chargeIsUnknown && suggestedChargeByExIdx[exIdx] ? suggestedChargeByExIdx[exIdx] : "");
    setRpeActualReps("");
    setModificationType("none");
    setRpeDialogOpen(true);
  };

  const handleRpeSubmit = () => {
    const rpeNumber = Number(rpeInputValue) || 7;
    if (rpeNumber < 1 || rpeNumber > 10) {
      toast({ title: "RPE invalide", description: "Le RPE doit être entre 1 et 10", variant: "destructive" });
      return;
    }
    if (rpeDialogSerieIndex === null) return;

    // Validate mandatory charge when coach set "??" or range
    if (isChargeRequired && !rpeActualCharge.trim()) {
      toast({ title: "Charge requise", description: "Indique la charge que tu as utilisée pour cette série", variant: "destructive" });
      return;
    }
    // Validate mandatory reps when coach set a range
    if (isRepsRequired && !rpeActualReps.trim()) {
      toast({ title: "Reps requises", description: "Indique le nombre de répétitions que tu as réalisées", variant: "destructive" });
      return;
    }

    const exIdx = rpeDialogSerieIndex % exercises.length;
    const roundIdx = Math.floor(rpeDialogSerieIndex / exercises.length);
    const hasModif = modificationType !== "none";
    const actualCharge = isChargeRequired && rpeActualCharge.trim()
      ? rpeActualCharge.trim()
      : (hasModif && rpeActualCharge.trim() ? rpeActualCharge.trim() : null);
    const actualReps = isRepsRequired && rpeActualReps.trim()
      ? rpeActualReps.trim()
      : (hasModif && rpeActualReps.trim() ? rpeActualReps.trim() : null);

    const newValidations = [...serieValidations];
    newValidations[rpeDialogSerieIndex] = {
      validated: true,
      rpe: rpeNumber,
      actual_reps: actualReps,
      actual_charge: actualCharge,
      modification_type: hasModif ? modificationType : null,
    };
    setSerieValidations(newValidations);

    // Propagate charge as suggestion for next round (same exercise)
    if (isChargeRequired && rpeActualCharge.trim()) {
      setSuggestedChargeByExIdx(prev => ({ ...prev, [exIdx]: rpeActualCharge.trim() }));
    }

    setRpeDialogOpen(false);
    setRpeDialogSerieIndex(null);
    setRpeInputValue("");
    setRpeActualReps("");
    setRpeActualCharge("");
    setModificationType("none");
    setIsChargeRequired(false);
    setChargeRangeOptions(null);
    setIsRepsRequired(false);
    setRepsRangeOptions(null);

    // Position already computed above (exIdx, roundIdx)

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
      const perSerieRpe: { rpe: number | null; actual_reps?: string | null; actual_charge?: string | null; modification_type?: string | null }[] = [];
      if (exIdx >= 0) {
        // For AMRAP: only save completed rounds (not the 30-round cap)
        const saveRounds = isAmrap
          ? (() => {
              let count = 0;
              for (let r = 0; r < AMRAP_CAP; r++) {
                const allDone = exercises.every((_, ei) => serieValidations[r * exercises.length + ei]?.validated === true);
                if (allDone) count = r + 1; else break;
              }
              return count;
            })()
          : totalRounds;
        for (let r = 0; r < saveRounds; r++) {
          const vIdx = r * exercises.length + exIdx;
          const sv = serieValidations[vIdx];
          perSerieRpe.push({
            rpe: sv?.rpe ?? null,
            actual_reps: sv?.actual_reps ?? null,
            actual_charge: sv?.actual_charge ?? null,
            modification_type: sv?.modification_type ?? null,
          });
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
                const prefix = isAmrap ? `Tour ${roundIdx + 1}` : `S${roundIdx + 1}`;
                return `${prefix} — ${exercises[exIdx]?.exercice || ""}`;
              })()}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Charge obligatoire si coach a mis "??" ou une fourchette */}
            {isChargeRequired && rpeDialogSerieIndex !== null && (() => {
              const exIdx = rpeDialogSerieIndex % exercises.length;
              const suggested = suggestedChargeByExIdx[exIdx];
              return (
                <div className="rounded-lg border border-orange-400/40 bg-orange-500/8 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Weight className="h-4 w-4 text-orange-600" />
                    <Label className="text-sm font-semibold text-orange-700">
                      Charge utilisée <span className="text-destructive">*</span>
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {chargeRangeOptions
                      ? `Le coach propose ${chargeRangeOptions[0]}-${chargeRangeOptions[1]} kg — quelle charge as-tu utilisée ?`
                      : "Le coach n'a pas fixé de charge — indique ce que tu as mis."}
                  </p>
                  {/* Boutons sélection rapide fourchette */}
                  {chargeRangeOptions && (
                    <div className="flex gap-2">
                      {chargeRangeOptions.map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setRpeActualCharge(val)}
                          className={`flex-1 h-10 rounded-lg border text-sm font-bold transition-colors ${
                            rpeActualCharge === val
                              ? "border-orange-400 bg-orange-400/20 text-orange-700"
                              : "border-border bg-secondary text-foreground active:bg-muted"
                          }`}
                        >
                          {val} kg
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setRpeActualCharge("")}
                        className={`px-3 h-10 rounded-lg border text-xs transition-colors ${
                          rpeActualCharge !== "" && !chargeRangeOptions.includes(rpeActualCharge)
                            ? "border-orange-400 bg-orange-400/20 text-orange-700"
                            : "border-border bg-secondary text-muted-foreground"
                        }`}
                      >
                        Autre
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 p-0 shrink-0"
                      onClick={() => {
                        const current = parseFloat(rpeActualCharge) || 0;
                        const step = current >= 40 ? 5 : 2.5;
                        setRpeActualCharge(String(Math.max(0, Math.round((current - step) * 4) / 4)));
                      }}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={rpeActualCharge}
                        onChange={(e) => setRpeActualCharge(e.target.value)}
                        placeholder={suggested || (chargeRangeOptions ? chargeRangeOptions[0] : "ex: 60")}
                        className="h-10 text-center text-base font-bold pr-8"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 p-0 shrink-0"
                      onClick={() => {
                        const current = parseFloat(rpeActualCharge) || 0;
                        const step = current >= 40 ? 5 : 2.5;
                        setRpeActualCharge(String(Math.round((current + step) * 4) / 4));
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {suggested && rpeActualCharge !== suggested && (
                    <button
                      type="button"
                      className="text-xs text-primary underline"
                      onClick={() => setRpeActualCharge(suggested)}
                    >
                      Reprendre {suggested} kg (série précédente)
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Reps obligatoires si coach a mis une fourchette */}
            {isRepsRequired && repsRangeOptions && (
              <div className="rounded-lg border border-blue-400/40 bg-blue-500/8 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold text-blue-700">
                    Reps réalisées <span className="text-destructive">*</span>
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Le coach propose {repsRangeOptions[0]}-{repsRangeOptions[1]} reps — combien en as-tu fait ?
                </p>
                <div className="flex gap-2">
                  {repsRangeOptions.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRpeActualReps(val)}
                      className={`flex-1 h-10 rounded-lg border text-sm font-bold transition-colors ${
                        rpeActualReps === val
                          ? "border-blue-400 bg-blue-400/20 text-blue-700"
                          : "border-border bg-secondary text-foreground active:bg-muted"
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setRpeActualReps("")}
                    className={`px-3 h-10 rounded-lg border text-xs transition-colors ${
                      rpeActualReps !== "" && !repsRangeOptions.includes(rpeActualReps)
                        ? "border-blue-400 bg-blue-400/20 text-blue-700"
                        : "border-border bg-secondary text-muted-foreground"
                    }`}
                  >
                    Autre
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-10 w-10 p-0 shrink-0"
                    onClick={() => { const cur = parseInt(rpeActualReps) || 0; if (cur > 0) setRpeActualReps(String(cur - 1)); }}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={rpeActualReps}
                    onChange={(e) => setRpeActualReps(e.target.value)}
                    placeholder={repsRangeOptions[0]}
                    className="h-10 text-center text-base font-bold"
                  />
                  <Button type="button" variant="outline" size="sm" className="h-10 w-10 p-0 shrink-0"
                    onClick={() => { const cur = parseInt(rpeActualReps) || 0; setRpeActualReps(String(cur + 1)); }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

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

            {/* Corrections optionnelles — accordéons */}
            {rpeDialogSerieIndex !== null && (() => {
              const roundIdx = Math.floor(rpeDialogSerieIndex / exercises.length);
              const exIdx = rpeDialogSerieIndex % exercises.length;
              const ex = exercises[exIdx];
              const seriesData = getSeriesDataForExercise(ex);
              const prescribedReps = seriesData[roundIdx]?.reps || ex?.reps;
              const prescribedCharge = seriesData[roundIdx]?.charge || ex?.charge;
              const prescribedRpe = seriesData[roundIdx]?.rpe || ex?.rpe;
              if (!prescribedReps && (!prescribedCharge || isChargeRequired)) return null;

              const modFields = (
                <div className="space-y-2 mt-2 pl-1">
                  {prescribedReps && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Reps réellement faites <span className="font-medium text-foreground">(prévu : {prescribedReps})</span></Label>
                      <Input type="number" inputMode="numeric" value={rpeActualReps} onChange={(e) => setRpeActualReps(e.target.value)} placeholder={prescribedReps} className="h-8 text-sm" />
                    </div>
                  )}
                  {prescribedCharge && !isChargeRequired && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Charge réellement utilisée <span className="font-medium text-foreground">(prévu : {prescribedCharge})</span></Label>
                      <Input value={rpeActualCharge} onChange={(e) => setRpeActualCharge(e.target.value)} placeholder={prescribedCharge} className="h-8 text-sm" />
                    </div>
                  )}
                </div>
              );

              return (
                <div className="border-t pt-3 space-y-2">
                  {/* Échec */}
                  <button
                    type="button"
                    onClick={() => {
                      setModificationType(prev => prev === "failure" ? "none" : "failure");
                      setRpeActualReps("");
                      setRpeActualCharge("");
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-sm transition-colors ${
                      modificationType === "failure"
                        ? "border-red-400/60 bg-red-500/10 text-red-700"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <span>😓</span>
                      <span>Pas réussi — j'ai fait moins</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${modificationType === "failure" ? "rotate-180" : ""}`} />
                  </button>
                  {modificationType === "failure" && modFields}

                  {/* Trop facile */}
                  <button
                    type="button"
                    onClick={() => {
                      setModificationType(prev => prev === "too_easy" ? "none" : "too_easy");
                      setRpeActualReps("");
                      setRpeActualCharge("");
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-sm transition-colors ${
                      modificationType === "too_easy"
                        ? "border-blue-400/60 bg-blue-500/10 text-blue-700"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <span>💪</span>
                      <span>Trop facile — j'ai ajusté</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${modificationType === "too_easy" ? "rotate-180" : ""}`} />
                  </button>
                  {modificationType === "too_easy" && (
                    <div className="space-y-2 mt-1">
                      <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-400/30 rounded-lg text-xs text-amber-700">
                        <span className="shrink-0 mt-0.5">⚠️</span>
                        <span>
                          Attention : reste dans ta zone RPE{prescribedRpe ? ` ${prescribedRpe}` : ""}. Augmenter la charge ou les reps doit être cohérent avec ton ressenti — ne force pas au-delà de tes capacités du moment.
                        </span>
                      </div>
                      {modFields}
                    </div>
                  )}
                </div>
              );
            })()}
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
          <h1 className="text-xl sm:text-2xl font-bold">{isAmrap ? "AMRAP" : "Superset"}</h1>
        </div>

        {/* ── AMRAP hero card ─────────────────────────────────────────── */}
        {isAmrap && (() => {
          let doneRounds = 0;
          for (let r = 0; r < AMRAP_CAP; r++) {
            const ok = exercises.every((_, ei) => serieValidations[r * exercises.length + ei]?.validated === true);
            if (ok) doneRounds = r + 1; else break;
          }
          return (
            <>
              {/* Gros encadré durée */}
              <div className="rounded-2xl border-2 border-primary bg-primary/10 p-5 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Timer className="h-5 w-5 text-primary" />
                  <span className="text-xs font-bold text-primary uppercase tracking-widest">AMRAP</span>
                </div>
                <p className="text-5xl font-black text-primary tracking-tight">{amrapLabel}</p>
                <p className="text-sm text-muted-foreground mt-1">Fais le circuit le plus de fois possible en {amrapLabel}</p>
                {doneRounds > 0 && (
                  <div className="mt-3 inline-flex items-center gap-1.5 bg-green-500/15 text-green-600 rounded-full px-3 py-1">
                    <Check className="h-3.5 w-3.5" />
                    <span className="text-sm font-bold">{doneRounds} tour{doneRounds > 1 ? "s" : ""} complété{doneRounds > 1 ? "s" : ""}</span>
                  </div>
                )}
              </div>

              {/* Circuit : exercices avec détails */}
              <Card className="border border-border/60">
                <CardContent className="p-3 sm:p-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Le circuit</p>
                  <div className="space-y-3">
                    {exercises.map((ex, idx) => {
                      const serieRef = allSeriesData[idx]?.[0] || {};
                      const reps = serieRef.reps || (ex as any).reps;
                      const charge = serieRef.charge || (ex as any).charge;
                      const rpe = serieRef.rpe || (ex as any).rpe;
                      const tempo = serieRef.tempo || (ex as any).tempo;
                      const recup = serieRef.recuperation || (ex as any).recuperation;
                      return (
                        <div key={ex.id} className="flex items-start gap-3">
                          <span className="h-6 w-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm uppercase">{ex.exercice}</span>
                              {videoUrls[ex.exercice] && (
                                <a href={videoUrls[ex.exercice]} target="_blank" rel="noopener noreferrer" className="text-base" onClick={(e) => e.stopPropagation()}>🎥</a>
                              )}
                            </div>
                            {/* Détails en pills */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {reps && (
                                <span className="text-[11px] bg-muted rounded px-1.5 py-0.5 font-medium">
                                  {reps}{(ex as any).is_duration ? "s" : (ex as any).is_distance ? "m" : " reps"}
                                </span>
                              )}
                              {charge && charge !== "??" && (
                                <span className="text-[11px] bg-muted rounded px-1.5 py-0.5 font-medium">{charge}{/^\d+(\.\d+)?$/.test(charge.trim()) ? " kg" : ""}</span>
                              )}
                              {charge === "??" && (
                                <span className="text-[11px] bg-orange-500/15 text-orange-600 rounded px-1.5 py-0.5 font-medium">charge libre</span>
                              )}
                              {rpe && <span className="text-[11px] bg-muted rounded px-1.5 py-0.5 font-medium">RPE {rpe}</span>}
                              {tempo && <span className="text-[11px] bg-muted rounded px-1.5 py-0.5 font-mono">{tempo}</span>}
                              {recup && idx < exercises.length - 1 && (
                                <span className="text-[11px] text-muted-foreground">· {recup} récup</span>
                              )}
                            </div>
                            {(ex as any).commentaire && (
                              <p className="text-[11px] text-muted-foreground italic mt-1">📝 {(ex as any).commentaire}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Tours complétés + collapse */}
              <div className="flex items-center justify-between px-1">
                <p className="text-sm font-semibold">Tours complétés — {doneRounds}</p>
                {completedCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setSeriesCollapsed(!seriesCollapsed)} className="h-7 px-2">
                    {seriesCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </>
          );
        })()}

        {/* ── Superset normal — Exercise names summary ─────────────────── */}
        {!isAmrap && (
          <Card className="border-2 border-primary/30">
            <CardContent className="p-3 sm:p-4">
              <div className="space-y-2">
                {exercises.map((ex, idx) => (
                  <div key={ex.id} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-primary">{idx + 1}</span>
                      <span className="font-medium uppercase">{ex.exercice}</span>
                      {videoUrls[ex.exercice] && (
                        <a href={videoUrls[ex.exercice]} target="_blank" rel="noopener noreferrer" className="text-xl" onClick={(e) => e.stopPropagation()}>
                          🎥
                        </a>
                      )}
                    </div>
                    {(ex as any).commentaire && (
                      <div className="ml-7 flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-2">
                        <span className="text-base">📝</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-primary mb-0.5">Notes du coach</p>
                          <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{(ex as any).commentaire}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Progression — {completedCount}/{totalValidationSlots}</p>
                {completedCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setSeriesCollapsed(!seriesCollapsed)} className="h-7 px-2">
                    {seriesCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Series rounds */}
        {!seriesCollapsed && (
          <div className="space-y-4">
            {Array.from({ length: totalRounds }, (_, roundIdx) => {
              const roundValidations = exercises.map((_, exIdx) => {
                const vIdx = getValidationIndex(roundIdx, exIdx);
                return serieValidations[vIdx];
              });
              const roundComplete = roundValidations.every(v => v?.validated);

              // For AMRAP: compute completed rounds so far and only show up to current + 1
              if (isAmrap) {
                let doneRounds = 0;
                for (let r = 0; r < AMRAP_CAP; r++) {
                  const ok = exercises.every((_, ei) => serieValidations[r * exercises.length + ei]?.validated === true);
                  if (ok) doneRounds = r + 1; else break;
                }
                if (roundIdx > doneRounds) return null; // hide future rounds
              }

              return (
                <Card key={roundIdx} className={`border-2 transition-all ${roundComplete ? "border-green-500/30 bg-green-500/5" : "border-primary/20"}`}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant={roundComplete ? "default" : "outline"} className={roundComplete ? "bg-green-600" : ""}>
                        {isAmrap ? `Tour ${roundIdx + 1}` : `Série ${roundIdx + 1}`}
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
                                  {serieData.reps && (() => {
                                    const sr = serieData.reps.trim();
                                    const isRepsRange = /^\d+\s*-\s*\d+$/.test(sr);
                                    if (isRepsRange) {
                                      return isValidated && validation?.actual_reps ? (
                                        <span className="font-medium">{validation.actual_reps} reps</span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-blue-600 font-semibold">
                                          {sr} reps
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="font-medium">
                                        {sr}{ex.is_duration ? "s" : (ex as any).is_distance ? "m" : " reps"}
                                        {ex.per_side && " /côté"}
                                      </span>
                                    );
                                  })()}
                                  {serieData.charge && (() => {
                                    const sc = serieData.charge.trim();
                                    const isUnknown = sc === "??";
                                    const isRange = /^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)$/.test(sc);
                                    const needsInput = isUnknown || isRange;
                                    if (needsInput) {
                                      return isValidated && validation?.actual_charge ? (
                                        <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-red-600 font-semibold">
                                          <span className="text-[10px] uppercase opacity-70">Charge</span>
                                          {validation.actual_charge} kg
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded bg-orange-500/15 px-1.5 py-0.5 text-orange-600 font-semibold">
                                          <span className="text-[10px] uppercase opacity-70">Charge</span>
                                          {isRange ? sc + " kg" : "À définir"}
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-red-600 font-semibold">
                                        <span className="text-[10px] uppercase opacity-70">Charge</span>
                                        {sc}{/^\d+(\.\d+)?$/.test(sc) ? " kg" : ""}
                                      </span>
                                    );
                                  })()}
                                  {serieData.rpe && !isValidated && (
                                    <span className="inline-flex items-center gap-1 rounded bg-yellow-500/10 px-1.5 py-0.5 text-yellow-700 font-medium">
                                      <span className="text-[10px] uppercase opacity-70">RPE prévu</span>{serieData.rpe}/10
                                    </span>
                                  )}
                                  {isValidated && validation.rpe !== null && (
                                    <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-1.5 py-0.5 text-green-700 font-semibold">
                                      <span className="text-[10px] uppercase opacity-70">RPE réalisé</span>{validation.rpe}/10
                                    </span>
                                  )}
                                  {serieData.tempo && (
                                    <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-1.5 py-0.5 text-purple-600 font-medium">
                                      <span className="text-[10px] uppercase opacity-70">Tempo</span>{serieData.tempo}
                                    </span>
                                  )}
                                  {serieData.commentaire && (
                                    <span className="basis-full text-muted-foreground italic whitespace-pre-wrap break-words">"{serieData.commentaire}"</span>
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
                                    <span>Récup fin de {isAmrap ? "tour" : "série"}: {lastRecup}</span>
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

        {/* Finish button — AMRAP mode: show when at least 1 round complete */}
        {isAmrap && (() => {
          let doneRounds = 0;
          for (let r = 0; r < AMRAP_CAP; r++) {
            const ok = exercises.every((_, ei) => serieValidations[r * exercises.length + ei]?.validated === true);
            if (ok) doneRounds = r + 1; else break;
          }
          if (doneRounds === 0) return null;
          return (
            <Button
              size="lg"
              className="w-full text-base sm:text-lg py-6 bg-primary hover:bg-primary/90"
              onClick={() => {
                const rpes = serieValidations.filter(s => s.validated && s.rpe !== null).map(s => s.rpe!);
                if (rpes.length > 0) setComputedAvgRpe(String(Math.round(rpes.reduce((a, b) => a + b, 0) / rpes.length)));
                setDialogOpen(true);
              }}
            >
              Terminer l'AMRAP — {doneRounds} tour{doneRounds > 1 ? "s" : ""} complété{doneRounds > 1 ? "s" : ""} ✓
            </Button>
          );
        })()}

        {/* Finish button — normal mode */}
        {!isAmrap && allValidated && (
          <Button
            size="lg"
            className="w-full text-base sm:text-lg py-6 bg-primary hover:bg-primary/90"
            onClick={() => setDialogOpen(true)}
          >
            Superset terminé 🎉
          </Button>
        )}

        {!isAmrap && !allValidated && (
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
