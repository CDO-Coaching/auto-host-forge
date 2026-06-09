import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Minus, Play, Pause, RotateCcw, Video, Zap, Weight, Repeat, Clock, Timer, ArrowLeft, MessageSquare, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ExerciseFeedbackDialog } from "@/components/ExerciseFeedbackDialog";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import { TimerOverlay } from "@/components/TimerOverlay";
import { TempoExplanationDialog } from "@/components/TempoExplanationDialog";
import { RPEExplanationDialog } from "@/components/RPEExplanationDialog";
import { calculate1RM, parseWeight, parseReps, shouldRecordMax } from "@/lib/maxCalculations";
import { UniversalTimer, UniversalTimerRef } from "@/components/UniversalTimer";
import { FloatingSessionTimer } from "@/components/FloatingSessionTimer";
import { useWakeLock } from "@/hooks/useWakeLock";
import { SendVideoDialog } from "@/components/SendVideoDialog";
import { ExerciseRPEHistoryChart } from "@/components/ExerciseRPEHistoryChart";
import { BarChart3 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SerieValidation {
  validated: boolean;
  rpe: number | null;
  actual_reps?: string | null;
  actual_charge?: string | null;
  modification_type?: "failure" | "too_easy" | null;
}

export default function ExerciceDetail() {
  // Keep screen on during workout
  useWakeLock(true);
  const { exerciceId } = useParams();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completedSets, setCompletedSets] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerStartTimestamp, setTimerStartTimestamp] = useState<number | null>(null);
  const [targetDuration, setTargetDuration] = useState(0);
  const [timerInterval, setTimerInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [weekId, setWeekId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [computedAvgRpe, setComputedAvgRpe] = useState<string | undefined>(undefined);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showTimerOverlay, setShowTimerOverlay] = useState(false);
  const [coachName, setCoachName] = useState<string>("ton coach");
  const [coachId, setCoachId] = useState<string | null>(null);
  const { toast } = useToast();
  const timerRef = useRef<UniversalTimerRef>(null);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [athleteMaxes, setAthleteMaxes] = useState<Record<string, number>>({});

  // Serie-level validation
  const [serieValidations, setSerieValidations] = useState<SerieValidation[]>([]);
  const [rpeDialogOpen, setRpeDialogOpen] = useState(false);
  const [rpeDialogSerieIndex, setRpeDialogSerieIndex] = useState<number | null>(null);
  const [rpeInputValue, setRpeInputValue] = useState("");
  const [rpeActualReps, setRpeActualReps] = useState("");
  const [rpeActualCharge, setRpeActualCharge] = useState("");
  const [modificationType, setModificationType] = useState<"none" | "failure" | "too_easy">("none");
  // "??" / range charge management
  const [isChargeRequired, setIsChargeRequired] = useState(false);
  const [chargeRangeOptions, setChargeRangeOptions] = useState<[string, string] | null>(null);
  const [suggestedCharge, setSuggestedCharge] = useState<string | null>(null);
  // range reps management
  const [isRepsRequired, setIsRepsRequired] = useState(false);
  const [repsRangeOptions, setRepsRangeOptions] = useState<[string, string] | null>(null);
  const [seriesCollapsed, setSeriesCollapsed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Vérifier si la récupération est en mode EMOM
  const isEmomRecovery = exercise?.recuperation?.toLowerCase() === 'emom';
  
  // Vérifier si l'exercice est en mode durée (Tabata)
  const isDurationMode = exercise?.is_duration === true;

  const loadAthleteMaxes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("exercise_maxes")
      .select("exercise_id, weight_kg, exercise_library(name)")
      .eq("athlete_id", user.id)
      .order("recorded_at", { ascending: false });
    if (data) {
      const maxMap: Record<string, number> = {};
      data.forEach((m: any) => {
        const name = m.exercise_library?.name;
        if (name && !maxMap[name]) maxMap[name] = m.weight_kg;
      });
      setAthleteMaxes(maxMap);
    }
  };

  const getPercentSuggestion = (charge: string, exerciseName: string): string | null => {
    if (!charge) return null;
    let pct: number | null = null;
    const matchPercent = charge.match(/(\d+\.?\d*)\s*%/);
    if (matchPercent) {
      pct = parseFloat(matchPercent[1]);
    } else {
      const trimmed = charge.trim();
      if (/^\d+\.?\d*$/.test(trimmed)) {
        const val = parseFloat(trimmed);
        if (val > 0 && val <= 100) pct = val;
      }
    }
    if (pct === null || isNaN(pct) || pct <= 0) return null;
    const max1RM = athleteMaxes[exerciseName];
    if (!max1RM) return null;
    const suggested = Math.round((max1RM * pct / 100) * 2) / 2;
    return `≈${suggested}kg`;
  };

  const handleLaunchEmom = () => {
    const totalSets = exercise?.series ? parseInt(exercise.series) : 1;
    timerRef.current?.openWithSettings({
      type: 'emom',
      emomInterval: 60,
      rounds: totalSets,
    });
  };

  const handleLaunchTabata = () => {
    const totalSets = exercise?.series ? parseInt(exercise.series) : 1;
    const workTime = exercise?.reps ? parseInt(exercise.reps) : 20;
    const restTime = exercise?.recuperation ? parseRecuperationTime(exercise.recuperation) : 10;
    
    timerRef.current?.openWithSettings({
      type: 'tabata',
      workTime: workTime,
      restTime: restTime,
      rounds: totalSets,
    });
  };

  // Build series data from exercise
  const getSeriesData = () => {
    if (!exercise) return [];
    
    let details: any[] = [];
    if (exercise.serie_details) {
      try {
        details = typeof exercise.serie_details === 'string' 
          ? JSON.parse(exercise.serie_details) 
          : exercise.serie_details;
      } catch (e) { details = []; }
    }
    
    const totalSets = exercise.series ? parseInt(exercise.series) : 0;
    if (totalSets === 0) return [];
    
    const series = [];
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

  // Initialize serie validations when exercise loads
  useEffect(() => {
    if (exercise) {
      const totalSets = exercise.series ? parseInt(exercise.series) : 0;
      // Restore from localStorage if available
      const savedValidations = localStorage.getItem(`serie-validations-${exerciceId}`);
      if (savedValidations) {
        try {
          const parsed = JSON.parse(savedValidations);
          if (Array.isArray(parsed) && parsed.length === totalSets) {
            setSerieValidations(parsed);
            setCompletedSets(parsed.filter((s: SerieValidation) => s.validated).length);
            return;
          }
        } catch (e) {}
      }
      setSerieValidations(Array.from({ length: totalSets }, () => ({ validated: false, rpe: null })));
    }
  }, [exercise?.id]);

  // Save serie validations to localStorage
  useEffect(() => {
    if (exerciceId && serieValidations.length > 0) {
      localStorage.setItem(`serie-validations-${exerciceId}`, JSON.stringify(serieValidations));
    }
  }, [serieValidations, exerciceId]);

  useEffect(() => {
    loadExerciseDetail();
    loadCoachInfo();
    loadAthleteMaxes();

    // Restaurer les données sauvegardées
    const savedData = localStorage.getItem(`exercise-progress-${exerciceId}`);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.completedSets !== undefined) setCompletedSets(parsed.completedSets);

        // Restaurer le timer avec recalcul basé sur timestamp
        if (parsed.isTimerRunning && parsed.timerStartTimestamp && parsed.targetDuration) {
          const now = Date.now();
          const elapsedSeconds = Math.floor((now - parsed.timerStartTimestamp) / 1000);
          const remaining = Math.max(0, parsed.targetDuration - elapsedSeconds);

          if (remaining > 0) {
            setTimeRemaining(remaining);
            setTimerStartTimestamp(parsed.timerStartTimestamp);
            setTargetDuration(parsed.targetDuration);
            setIsTimerRunning(true);

            const interval = setInterval(() => {
              const currentElapsed = Math.floor((Date.now() - parsed.timerStartTimestamp) / 1000);
              const currentRemaining = Math.max(0, parsed.targetDuration - currentElapsed);
              setTimeRemaining(currentRemaining);
              if (currentRemaining === 0) {
                clearInterval(interval);
                setIsTimerRunning(false);
                setTimerStartTimestamp(null);
              }
            }, 100);
            setTimerInterval(interval);
          }
        } else if (parsed.timeRemaining !== undefined) {
          setTimeRemaining(parsed.timeRemaining);
        }
      } catch (error) {
        console.error("Erreur lors de la restauration:", error);
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadExerciseDetail();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerInterval) clearInterval(timerInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [exerciceId]);

  const loadCoachInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: relationship } = await supabase
      .from("coach_athlete_relationships")
      .select("coach_id")
      .eq("athlete_id", user.id)
      .eq("status", "approved")
      .single();

    if (relationship?.coach_id) {
      setCoachId(relationship.coach_id);
      
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("first_name, last_name")
        .eq("id", relationship.coach_id)
        .single();

      if (profile) {
        setCoachName(profile.first_name || "ton coach");
      }
    }
  };

  // Sauvegarder automatiquement la progression
  useEffect(() => {
    if (exerciceId) {
      const dataToSave = {
        completedSets,
        timeRemaining,
        isTimerRunning,
        timerStartTimestamp,
        targetDuration,
      };
      localStorage.setItem(`exercise-progress-${exerciceId}`, JSON.stringify(dataToSave));
    }
  }, [completedSets, timeRemaining, isTimerRunning, timerStartTimestamp, targetDuration, exerciceId]);

  useEffect(() => {
    if (timeRemaining <= 0 && isTimerRunning) {
      setIsTimerRunning(false);
      setTimerStartTimestamp(null);
      if (timerInterval) clearInterval(timerInterval);
    }
  }, [timeRemaining, isTimerRunning]);

  const loadExerciseDetail = async () => {
    setLoading(true);

    const { data, error } = await supabase.from("session_exercises").select("*").eq("id", exerciceId).single();

    if (error) {
      console.error("Erreur lors du chargement de l'exercice:", error);
    } else {
      setExercise(data);
      setSessionId(data.session_id);
      if (data.session_id) {
        const { data: sessionRow } = await supabase
          .from("training_sessions")
          .select("week_id")
          .eq("id", data.session_id)
          .maybeSingle();
        if (sessionRow?.week_id) setWeekId(sessionRow.week_id);
      }
      if (data.recuperation && timeRemaining === 0) {
        setTimeRemaining(parseRecuperationTime(data.recuperation));
        setTargetDuration(parseRecuperationTime(data.recuperation));
      }

      if (data.exercice) {
        const { data: libraryData } = await supabase
          .from("exercise_library")
          .select("video_url")
          .eq("name", data.exercice)
          .maybeSingle();

        if (libraryData?.video_url) {
          setVideoUrl(libraryData.video_url);
        }
      }
    }

    setLoading(false);
  };

  const parseRecuperationTime = (recup: string): number => {
    const minMatch = recup.match(/(\d+)min/);
    const secMatch = recup.match(/(\d+)s/);
    const minutes = minMatch ? parseInt(minMatch[1]) : 0;
    const seconds = secMatch ? parseInt(secMatch[1]) : 0;
    return minutes * 60 + seconds;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Start recovery timer helper
  const startRecoveryTimer = (serieRecupOverride?: string) => {
    const recup = serieRecupOverride || exercise?.recuperation;
    if (!recup) return;
    const isEmom = recup.toLowerCase() === 'emom';
    if (isEmom || recup === "0s") return;

    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }

    const recuperationTime = parseRecuperationTime(recup);
    const now = Date.now();

    setTimeRemaining(recuperationTime);
    setTargetDuration(recuperationTime);
    setTimerStartTimestamp(now);
    setIsTimerRunning(true);

    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - now) / 1000);
      const remaining = Math.max(0, recuperationTime - elapsedSeconds);
      setTimeRemaining(remaining);
      if (remaining === 0) {
        setIsTimerRunning(false);
        setTimerStartTimestamp(null);
        clearInterval(interval);
      }
    }, 100);
    setTimerInterval(interval);

    setShowTimerOverlay(true);
  };

  // Handle clicking validate on a serie
  const handleValidateSerie = (serieIndex: number) => {
    setRpeDialogSerieIndex(serieIndex);
    // Pre-fill with coach's RPE for this serie, or default to 7
    const coachRpe = seriesData[serieIndex]?.rpe;
    const defaultVal = coachRpe ? String(Math.min(10, Math.max(1, parseInt(coachRpe)))) : "7";
    setRpeInputValue(defaultVal);

    // Detect "??" or range (e.g. "25-30") charge → required input
    const serieCharge = (seriesData[serieIndex]?.charge || exercise?.charge || "").trim();
    const chargeRangeMatch = serieCharge.match(/^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)$/);
    const chargeIsUnknown = serieCharge === "??" || !!chargeRangeMatch;
    setIsChargeRequired(chargeIsUnknown);
    setChargeRangeOptions(chargeRangeMatch ? [chargeRangeMatch[1].replace(",", "."), chargeRangeMatch[2].replace(",", ".")] : null);

    // Detect range reps (e.g. "8-10") → required input
    const serieReps = (seriesData[serieIndex]?.reps || exercise?.reps || "").trim();
    const repsRangeMatch = serieReps.match(/^(\d+)\s*-\s*(\d+)$/);
    setIsRepsRequired(!!repsRangeMatch);
    setRepsRangeOptions(repsRangeMatch ? [repsRangeMatch[1], repsRangeMatch[2]] : null);

    // Pre-fill charge with suggestion from previous serie (if any)
    setRpeActualCharge(chargeIsUnknown && suggestedCharge ? suggestedCharge : "");
    setRpeActualReps("");
    setModificationType("none");
    setRpeDialogOpen(true);
  };

  // Handle RPE submission for a serie
  const handleRpeSubmit = () => {
    const rpeNumber = Number(rpeInputValue) || 5;
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

    const hasModif = modificationType !== "none";
    // actual_charge: always saved when required, otherwise only on modification
    const actualCharge = isChargeRequired && rpeActualCharge.trim()
      ? rpeActualCharge.trim()
      : (hasModif && rpeActualCharge.trim() ? rpeActualCharge.trim() : null);
    // actual_reps: always saved when required, otherwise only on modification
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
    setCompletedSets(newValidations.filter(s => s.validated).length);

    // Propagate charge as suggestion for next series
    if (isChargeRequired && rpeActualCharge.trim()) {
      setSuggestedCharge(rpeActualCharge.trim());
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

    // Check if this was the last serie
    const allNowValidated = newValidations.every(s => s.validated);
    if (allNowValidated && newValidations.length > 0) {
      // Compute average RPE and auto-open feedback dialog
      const avgRpe = Math.round(newValidations.reduce((sum, s) => sum + (s.rpe || 0), 0) / newValidations.length);
      setComputedAvgRpe(avgRpe.toString());
      setDialogOpen(true);
    } else {
      // Start recovery timer with per-series recuperation if available
      const serieData = seriesData[rpeDialogSerieIndex];
      const serieRecup = serieData?.recuperation || undefined;
      startRecoveryTimer(serieRecup);
    }
  };

  const startTimer = () => {
    if (!isTimerRunning && timeRemaining > 0) {
      const now = Date.now();
      setTimerStartTimestamp(now);
      setTargetDuration(timeRemaining);
      setIsTimerRunning(true);

      const interval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - now) / 1000);
        const remaining = Math.max(0, timeRemaining - elapsedSeconds);
        setTimeRemaining(remaining);
        if (remaining === 0) {
          setIsTimerRunning(false);
          setTimerStartTimestamp(null);
          clearInterval(interval);
        }
      }, 100);
      setTimerInterval(interval);
    }
  };

  const pauseTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    if (timerStartTimestamp && targetDuration) {
      const elapsedSeconds = Math.floor((Date.now() - timerStartTimestamp) / 1000);
      const remaining = Math.max(0, targetDuration - elapsedSeconds);
      setTimeRemaining(remaining);
    }
    setIsTimerRunning(false);
    setTimerStartTimestamp(null);
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimerStartTimestamp(null);
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    if (exercise?.recuperation) {
      const recupTime = parseRecuperationTime(exercise.recuperation);
      setTimeRemaining(recupTime);
      setTargetDuration(recupTime);
    }
  };

  const handleValidateFeedback = async (rpe: string, comment: string) => {
    const rpeValue = rpe ? parseInt(rpe) : null;

    // If we have per-serie RPEs, compute the average
    const serieRpes = serieValidations.filter(s => s.rpe !== null).map(s => s.rpe!);
    const finalRpe = serieRpes.length > 0 
      ? Math.round(serieRpes.reduce((a, b) => a + b, 0) / serieRpes.length)
      : rpeValue;

    // Build per-serie details for persistence (rpe + actual reps/charge if reported)
    const serieRpeDetails = serieValidations.map(s => ({
      rpe: s.rpe,
      actual_reps: s.actual_reps ?? null,
      actual_charge: s.actual_charge ?? null,
      modification_type: s.modification_type ?? null,
    }));

    const { error } = await supabase
      .from("session_exercises")
      .update({
        sportif_comment: comment.trim() || null,
        sportif_rpe: finalRpe,
        sportif_feedback_at: new Date().toISOString(),
        serie_rpe_details: serieRpeDetails,
      } as any)
      .eq("id", exerciceId);

    if (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder vos données",
        variant: "destructive",
      });
      throw error;
    }

    // Calculer et enregistrer le max théorique si les conditions sont remplies
    if (exercise && finalRpe && shouldRecordMax(exercise.charge, exercise.reps, finalRpe)) {
      await recordTheoreticalMax(exercise, finalRpe);
    }

    // Nettoyer les données sauvegardées
    localStorage.removeItem(`exercise-progress-${exerciceId}`);
    localStorage.removeItem(`serie-validations-${exerciceId}`);

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
        .select("weight_kg, max_type, recorded_at")
        .eq("athlete_id", user.id)
        .eq("exercise_id", libraryData.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const isNewRecord = !latestMax || theoretical1RM > latestMax.weight_kg;
      
      const { error: insertError } = await supabase.from("exercise_maxes").insert({
        athlete_id: user.id,
        exercise_id: libraryData.id,
        max_type: "max_theorique",
        weight_kg: theoretical1RM,
        recorded_at: new Date().toISOString(),
        notes: `Calculé depuis: ${exercise.charge} x ${exercise.reps} reps @ RPE ${rpeValue}`,
      });

      if (insertError) {
        toast({ title: "Max non enregistré", description: "Autorisation refusée.", variant: "destructive" });
      } else {
        toast({
          title: isNewRecord ? "Nouveau record !" : "Max enregistré",
          description: `${theoretical1RM} kg sur ${exercise.exercice}${!isNewRecord ? ` (précédent: ${latestMax.weight_kg} kg)` : ""}`,
        });
      }
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du max théorique:", error);
    }
  };

  const handleCelebrationComplete = () => {
    setShowCelebration(false);
    toast({ title: "Enregistré !", description: "Ton retour a été sauvegardé" });
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

  const handleCancelFeedback = () => {
    setDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  const handleBack = () => {
    if (weekId && sessionId) {
      navigate(`/sportif/seance/${weekId}/${sessionId}`);
    } else {
      navigate("/sportif/seances");
    }
  };

  if (!exercise) {
    return (
      <div className="min-h-screen p-4">
        <p className="text-center text-muted-foreground mt-8">Exercice introuvable</p>
      </div>
    );
  }

  const seriesData = getSeriesData();
  const allSeriesValidated = serieValidations.length > 0 && serieValidations.every(s => s.validated);

  return (
    <div className="min-h-screen bg-background">
      {sessionId && <FloatingSessionTimer sessionId={sessionId} />}
      <UniversalTimer ref={timerRef} />
      <CelebrationOverlay
        show={showCelebration}
        message={exercise?.exercice || ""}
        onComplete={handleCelebrationComplete}
        type="exercise"
      />

      {/* Timer Overlay */}
      <TimerOverlay
        show={showTimerOverlay}
        onClose={() => setShowTimerOverlay(false)}
        timeRemaining={timeRemaining}
        isRunning={isTimerRunning}
        onStart={startTimer}
        onPause={pauseTimer}
        onReset={resetTimer}
        title="Récupération"
      />

      <ExerciseFeedbackDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onValidate={handleValidateFeedback}
        onCancel={handleCancelFeedback}
        exerciseName={exercise?.exercice}
        exerciseType="renfo"
        isRpeRequired={!allSeriesValidated}
        defaultRpe={computedAvgRpe}
      />

      <SendVideoDialog
        open={showVideoDialog}
        onOpenChange={setShowVideoDialog}
        coachId={coachId}
        coachName={coachName}
        exerciseName={exercise?.exercice}
      />

      {/* RPE Dialog for serie validation — compact redesign */}
      <Dialog open={rpeDialogOpen} onOpenChange={setRpeDialogOpen}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader className="pb-1">
            <DialogTitle className="text-base">
              Série {rpeDialogSerieIndex !== null ? rpeDialogSerieIndex + 1 : ""} terminée
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">

            {/* ── Charge requise (fourchette ou ??) ── */}
            {isChargeRequired && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">⚖️ Charge *</span>
                  {chargeRangeOptions && (
                    <span className="text-[11px] text-muted-foreground">({chargeRangeOptions[0]}–{chargeRangeOptions[1]} kg)</span>
                  )}
                </div>
                {chargeRangeOptions && (
                  <div className="flex gap-1.5">
                    {chargeRangeOptions.map((val) => (
                      <button key={val} type="button" onClick={() => setRpeActualCharge(val)}
                        className={`flex-1 h-9 rounded-lg border text-sm font-bold transition-colors ${rpeActualCharge === val ? "border-orange-400 bg-orange-400/20 text-orange-700" : "border-border bg-secondary"}`}>
                        {val} kg
                      </button>
                    ))}
                    <button type="button" onClick={() => setRpeActualCharge(chargeRangeOptions.includes(rpeActualCharge) ? "" : rpeActualCharge)}
                      className={`px-2.5 h-9 rounded-lg border text-xs transition-colors ${rpeActualCharge !== "" && !chargeRangeOptions.includes(rpeActualCharge) ? "border-orange-400 bg-orange-400/20 text-orange-700" : "border-border bg-secondary text-muted-foreground"}`}>
                      Autre
                    </button>
                  </div>
                )}
                {(!chargeRangeOptions || !chargeRangeOptions.includes(rpeActualCharge)) && (
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => { const c = parseFloat(rpeActualCharge)||0; const s = c>=40?5:2.5; setRpeActualCharge(String(Math.max(0,Math.round((c-s)*4)/4))); }}
                      className="h-9 w-9 rounded-lg border bg-secondary text-lg font-bold shrink-0">−</button>
                    <div className="relative flex-1">
                      <Input type="number" inputMode="decimal" value={rpeActualCharge}
                        onChange={(e) => setRpeActualCharge(e.target.value)}
                        placeholder={suggestedCharge || chargeRangeOptions?.[0] || "ex: 60"}
                        className="h-9 text-center font-bold pr-6 text-sm" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
                    </div>
                    <button type="button" onClick={() => { const c = parseFloat(rpeActualCharge)||0; const s = c>=40?5:2.5; setRpeActualCharge(String(Math.round((c+s)*4)/4)); }}
                      className="h-9 w-9 rounded-lg border bg-secondary text-lg font-bold shrink-0">+</button>
                  </div>
                )}
                {suggestedCharge && rpeActualCharge !== suggestedCharge && (
                  <button type="button" onClick={() => setRpeActualCharge(suggestedCharge!)} className="text-[11px] text-primary underline">
                    ← {suggestedCharge} kg (série préc.)
                  </button>
                )}
              </div>
            )}

            {/* ── Reps requises (fourchette) ── */}
            {isRepsRequired && repsRangeOptions && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Reps * ({repsRangeOptions[0]}–{repsRangeOptions[1]})</span>
                <div className="flex gap-1.5">
                  {repsRangeOptions.map((val) => (
                    <button key={val} type="button" onClick={() => setRpeActualReps(val)}
                      className={`flex-1 h-9 rounded-lg border text-sm font-bold transition-colors ${rpeActualReps === val ? "border-blue-400 bg-blue-400/20 text-blue-700" : "border-border bg-secondary"}`}>
                      {val}
                    </button>
                  ))}
                  <button type="button" onClick={() => setRpeActualReps(repsRangeOptions.includes(rpeActualReps) ? "" : rpeActualReps)}
                    className={`px-2.5 h-9 rounded-lg border text-xs transition-colors ${rpeActualReps !== "" && !repsRangeOptions.includes(rpeActualReps) ? "border-blue-400 bg-blue-400/20 text-blue-700" : "border-border bg-secondary text-muted-foreground"}`}>
                    Autre
                  </button>
                </div>
                {(!repsRangeOptions.includes(rpeActualReps)) && (
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => { const c=parseInt(rpeActualReps)||0; if(c>0) setRpeActualReps(String(c-1)); }}
                      className="h-9 w-9 rounded-lg border bg-secondary text-lg font-bold shrink-0">−</button>
                    <Input type="number" inputMode="numeric" value={rpeActualReps}
                      onChange={(e) => setRpeActualReps(e.target.value)}
                      placeholder={repsRangeOptions[0]} className="h-9 text-center font-bold text-sm" />
                    <button type="button" onClick={() => setRpeActualReps(String((parseInt(rpeActualReps)||0)+1))}
                      className="h-9 w-9 rounded-lg border bg-secondary text-lg font-bold shrink-0">+</button>
                  </div>
                )}
              </div>
            )}

            {/* ── RPE — grand chiffre + boutons 1-10, pas de slider ── */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide">RPE *</span>
                <RPEExplanationDialog />
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-3xl font-black w-9 text-center tabular-nums shrink-0 ${
                  Number(rpeInputValue) <= 3 ? "text-green-500" :
                  Number(rpeInputValue) <= 6 ? "text-yellow-500" :
                  Number(rpeInputValue) <= 8 ? "text-orange-500" : "text-red-500"
                }`}>{rpeInputValue || "–"}</span>
                <div className="flex flex-1 gap-1">
                  {[1,2,3,4,5,6,7,8,9,10].map((v) => (
                    <button key={v} type="button" onClick={() => setRpeInputValue(String(v))}
                      className={`flex-1 h-9 rounded text-xs font-bold border transition-colors ${
                        Number(rpeInputValue) === v
                          ? (v<=3?"border-green-400 bg-green-400/20 text-green-700":v<=6?"border-yellow-400 bg-yellow-400/20 text-yellow-700":v<=8?"border-orange-400 bg-orange-400/20 text-orange-700":"border-red-400 bg-red-400/20 text-red-700")
                          : "border-border bg-secondary"
                      }`}>{v}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Modifications optionnelles — 2 chips compacts ── */}
            {(() => {
              const currentSerie = rpeDialogSerieIndex !== null ? seriesData[rpeDialogSerieIndex] : null;
              const prescribedReps = currentSerie?.reps || exercise?.reps;
              const prescribedCharge = currentSerie?.charge || exercise?.charge;
              if ((!prescribedReps || isRepsRequired) && (!prescribedCharge || isChargeRequired)) return null;
              return (
                <div className="border-t pt-2 space-y-2">
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={() => { setModificationType(p => p==="failure"?"none":"failure"); setRpeActualReps(""); setRpeActualCharge(""); }}
                      className={`flex-1 h-8 rounded-lg border text-xs font-medium transition-colors ${modificationType==="failure"?"border-red-400 bg-red-500/10 text-red-700":"border-border text-muted-foreground"}`}>
                      😓 Fait moins
                    </button>
                    <button type="button"
                      onClick={() => { setModificationType(p => p==="too_easy"?"none":"too_easy"); setRpeActualReps(""); setRpeActualCharge(""); }}
                      className={`flex-1 h-8 rounded-lg border text-xs font-medium transition-colors ${modificationType==="too_easy"?"border-blue-400 bg-blue-500/10 text-blue-700":"border-border text-muted-foreground"}`}>
                      💪 Ajusté
                    </button>
                  </div>
                  {modificationType !== "none" && (
                    <div className="space-y-1.5">
                      {prescribedReps && !isRepsRequired && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground shrink-0">Reps (prévu: {prescribedReps})</span>
                          <Input type="number" inputMode="numeric" value={rpeActualReps}
                            onChange={(e) => setRpeActualReps(e.target.value)}
                            placeholder={prescribedReps} className="h-7 text-sm flex-1 min-w-0" />
                        </div>
                      )}
                      {prescribedCharge && !isChargeRequired && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground shrink-0">Charge (prévu: {prescribedCharge})</span>
                          <Input type="number" inputMode="decimal" value={rpeActualCharge} onChange={(e) => setRpeActualCharge(e.target.value)}
                            placeholder={prescribedCharge} className="h-7 text-sm flex-1 min-w-0" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          <DialogFooter className="mt-3">
            <Button onClick={handleRpeSubmit} className="w-full">
              Valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* En-tête exercice */}
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="flex-1 text-left group"
            title="Voir l'historique de cet exercice"
          >
            <h1 className="text-xl sm:text-2xl font-bold uppercase inline-flex items-center gap-2 group-hover:text-primary transition-colors">
              <span>{exercise.exercice}</span>
              <BarChart3 className="h-4 w-4 opacity-50 group-hover:opacity-100" />
            </h1>
          </button>
          <ExerciseRPEHistoryChart
            exerciseName={exercise.exercice}
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            hideTrigger
          />
          {videoUrl && (
            <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-2xl sm:text-3xl">
              🎥
            </a>
          )}
        </div>

        {/* EMOM / Tabata buttons */}
        {exercise.recuperation && isEmomRecovery && (
          <Card className="border-2 border-primary/30 bg-primary/5">
            <CardContent className="p-3 sm:p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Timer className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  <Label className="text-sm sm:text-base font-semibold">Mode EMOM</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  {exercise.series} tour{parseInt(exercise.series) > 1 ? 's' : ''} × 1 minute
                </p>
                <Button onClick={handleLaunchEmom} className="w-full h-11">
                  <Timer className="h-4 w-4 mr-2" />
                  Lancer l'EMOM
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {exercise.recuperation && !isEmomRecovery && isDurationMode && (
          <Card className="border-2 border-green-500/30 bg-green-500/5">
            <CardContent className="p-3 sm:p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Timer className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                  <Label className="text-sm sm:text-base font-semibold">Mode Tabata</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  {exercise.series} tour{parseInt(exercise.series) > 1 ? 's' : ''} × {exercise.reps}s travail / {exercise.recuperation} repos
                </p>
                <Button onClick={handleLaunchTabata} className="w-full h-11 bg-green-600 hover:bg-green-700">
                  <Timer className="h-4 w-4 mr-2" />
                  Lancer le Tabata
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Récupération "0s" = enchaîné */}
        {exercise.recuperation === "0s" && (
          <Card className="border-2 border-amber-500/30 bg-amber-500/10">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <Label className="text-sm sm:text-base font-semibold text-amber-600">Exercice enchaîné</Label>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Pas de récupération — passez directement à la série suivante
              </p>
            </CardContent>
          </Card>
        )}

        {/* Séries — tableau interactif avec bouton valider */}
        {seriesData.length > 0 && (
          <Card className="border-2 border-primary/30">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Repeat className="h-5 w-5 text-primary" />
                  <p className="text-sm sm:text-base font-semibold">
                    Séries — {completedSets}/{seriesData.length}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <TempoExplanationDialog />
                  <RPEExplanationDialog />
                </div>
              </div>
              {/* Légende des codes couleurs */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" />Charge (kg)</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />RPE prévu</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-600" />RPE réalisé</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-purple-500" />Tempo</span>
              </div>
              <div className="flex items-center justify-end mb-2">
                {completedSets > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSeriesCollapsed(!seriesCollapsed)}
                    className="h-7 px-2"
                  >
                    {seriesCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </Button>
                )}
              </div>

              {!seriesCollapsed && (
                <div className="space-y-2">
                  {seriesData.map((serie, idx) => {
                    const validation = serieValidations[idx];
                    const isValidated = validation?.validated;
                    
                    return (
                      <div 
                        key={idx}
                        className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border transition-all ${
                          isValidated 
                            ? "bg-green-500/10 border-green-500/30" 
                            : "bg-muted/30 border-border"
                        }`}
                      >
                        <div className="flex-1 flex items-center gap-2 flex-wrap text-sm min-w-0">
                          {(serie.recuperation || exercise.recuperation) && (
                            <span className="text-muted-foreground text-xs">{serie.recuperation || exercise.recuperation}</span>
                          )}
                          {serie.reps && (() => {
                            const sr = serie.reps.trim();
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
                                {sr}{exercise.is_duration ? "s" : (exercise as any).is_distance ? "m" : " reps"}
                                {exercise.per_side && " /côté"}
                              </span>
                            );
                          })()}
                          {serie.charge && (() => {
                            const sc = serie.charge.trim();
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
                          {serie.rpe && !isValidated && (
                            <span className="inline-flex items-center gap-1 rounded bg-yellow-500/10 px-1.5 py-0.5 text-yellow-700 text-xs font-medium">
                              <span className="text-[10px] uppercase opacity-70">RPE prévu</span>{serie.rpe}/10
                            </span>
                          )}
                          {isValidated && validation.rpe !== null && (
                            <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-1.5 py-0.5 text-green-700 text-xs font-semibold">
                              <span className="text-[10px] uppercase opacity-70">RPE réalisé</span>{validation.rpe}/10
                            </span>
                          )}
                          {isValidated && validation.actual_reps && !(/^\d+\s*-\s*\d+$/.test((serie.reps ?? "").trim())) && (
                            <span className="inline-flex items-center gap-1 rounded bg-orange-500/15 px-1.5 py-0.5 text-orange-700 text-xs font-semibold">
                              <span className="text-[10px] uppercase opacity-70">Réalisé</span>{validation.actual_reps} reps
                            </span>
                          )}
                          {isValidated && validation.actual_charge && (() => {
                            const sc = serie.charge?.trim() ?? "";
                            const needsInput = sc === "??" || /^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)$/.test(sc);
                            return !needsInput;
                          })() && (
                            <span className="inline-flex items-center gap-1 rounded bg-orange-500/15 px-1.5 py-0.5 text-orange-700 text-xs font-semibold">
                              <span className="text-[10px] uppercase opacity-70">Charge</span>{validation.actual_charge}
                            </span>
                          )}
                          {serie.tempo && (
                            <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-1.5 py-0.5 text-purple-600 text-xs font-medium">
                              <span className="text-[10px] uppercase opacity-70">Tempo</span>{serie.tempo}
                            </span>
                          )}
                          {serie.commentaire && (
                            <span className="basis-full text-muted-foreground italic text-xs whitespace-pre-wrap break-words">"{serie.commentaire}"</span>
                          )}
                          <Badge 
                            variant={isValidated ? "default" : "outline"} 
                            className={`text-xs font-bold shrink-0 ${isValidated ? "bg-green-600" : ""}`}
                          >
                            S{idx + 1}
                          </Badge>
                        </div>

                        {isValidated ? (
                          <Check className="h-5 w-5 text-green-600 shrink-0" />
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleValidateSerie(idx)}
                            className="h-8 px-3 shrink-0"
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            OK
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {seriesCollapsed && (
                <div className="text-sm text-muted-foreground text-center py-2">
                  {completedSets} série{completedSets > 1 ? "s" : ""} validée{completedSets > 1 ? "s" : ""} sur {seriesData.length}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Chrono récupération (visible quand timer tourne ou a tourné) */}
        {exercise.recuperation && exercise.recuperation !== "0s" && !isEmomRecovery && !isDurationMode && (
          <Card className="border-2 border-muted-foreground/20 bg-muted/50">
            <CardContent className="p-3 sm:p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    <Label className="text-sm sm:text-base font-semibold">Récupération</Label>
                  </div>
                  <div className={`text-2xl sm:text-3xl font-bold font-mono ${timeRemaining === 0 ? "text-green-500" : "text-foreground"}`}>
                    {formatTime(timeRemaining)}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isTimerRunning ? (
                    <Button size="sm" onClick={startTimer} disabled={timeRemaining === 0} className="flex-1 h-9">
                      <Play className="h-4 w-4 mr-1" />
                      Start
                    </Button>
                  ) : (
                    <Button size="sm" onClick={pauseTimer} variant="secondary" className="flex-1 h-9">
                      <Pause className="h-4 w-4 mr-1" />
                      Pause
                    </Button>
                  )}
                  <Button size="sm" onClick={resetTimer} variant="outline" className="h-9 w-9 p-0">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tempo card */}
        {exercise.tempo && !seriesData.some((s: any) => s.tempo) && (
          <Card className="border border-purple-500/30 bg-purple-500/5">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-1 sm:gap-2 mb-1">
                <div className="flex items-center gap-1 sm:gap-2">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                  <span className="text-xs sm:text-sm font-semibold text-purple-600 uppercase">Tempo</span>
                </div>
                <TempoExplanationDialog />
              </div>
              <p className="text-2xl sm:text-3xl font-bold">{exercise.tempo}</p>
            </CardContent>
          </Card>
        )}

        {/* Notes du coach */}
        {exercise.commentaire && (
          <Card className="border-2 border-primary/20">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start gap-2">
                <span className="text-lg sm:text-xl">📝</span>
                <div className="flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-primary mb-1">Notes du coach</p>
                  <p className="text-sm leading-relaxed">{exercise.commentaire}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Demande de vidéo du coach */}
        {exercise.request_video && (
          <Card className="border-2 border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-500/20 rounded-full">
                  <Video className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-700 mb-1">
                    📹 {coachName.charAt(0).toUpperCase() + coachName.slice(1)} souhaite voir ta technique
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Pense à enregistrer une vidéo de cet exercice pour que ton coach puisse t'aider à progresser.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVideoDialog(true)}
                    className="border-blue-500/50 text-blue-700 hover:bg-blue-500/10"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Envoyer une vidéo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bouton exercice terminé */}
        <Button onClick={() => setDialogOpen(true)} size="lg" className="w-full">
          Exercice terminé
        </Button>

        {/* Rappel discret pour la vidéo */}
        {exercise.request_video && dialogOpen && (
          <div className="fixed bottom-24 left-4 right-4 z-40 animate-in slide-in-from-bottom-4">
            <Card className="bg-blue-50 border-blue-200 shadow-lg">
              <CardContent className="p-3 flex items-center gap-2">
                <Video className="h-4 w-4 text-blue-600 shrink-0" />
                <p className="text-xs text-blue-700">
                  N'oublie pas d'envoyer ta vidéo à {coachName} ! 🎥
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}