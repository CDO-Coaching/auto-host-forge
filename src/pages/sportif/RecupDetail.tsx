import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Play, Pause, ChevronLeft, ChevronRight, X, RotateCcw, Dumbbell, Clock, CheckCircle2, Youtube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import { SessionCompletionDialog } from "@/components/SessionCompletionDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useWakeLock } from "@/hooks/useWakeLock";
import { cn } from "@/lib/utils";

const SIDE_SWITCH_SECONDS = 10;
const SERIES_REST_SECONDS = 15;

/** Parse un champ durée ("90", "90s", "1min30", "1:30", "10min") en secondes. */
function parseSeconds(raw: string | null | undefined): number {
  if (!raw) return 0;
  const s = String(raw).trim().toLowerCase();
  const colon = s.match(/^(\d+):(\d{1,2})$/);
  if (colon) return parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10);
  let total = 0;
  const min = s.match(/(\d+)\s*min/);
  if (min) total += parseInt(min[1], 10) * 60;
  const sec = s.match(/(\d+)\s*s(ec)?\b/);
  if (sec) total += parseInt(sec[1], 10);
  const minRemainder = s.match(/min\s*(\d+)/);
  if (min && minRemainder) total += parseInt(minRemainder[1], 10);
  if (total === 0) {
    const n = parseInt(s, 10);
    if (!isNaN(n)) total = n;
  }
  return total;
}

/** Extrait l'id YouTube d'une URL (shorts, watch, youtu.be, embed). */
function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:shorts\/|watch\?v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTotal(seconds: number): string {
  if (seconds <= 0) return "—";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h${rem.toString().padStart(2, "0")}` : `${h}h`;
}

type Segment = { label: string; seconds: number; announceAfter: string | null; switchSeconds: number };

type Step = {
  id: string;
  name: string;
  consignes: string;
  coachNote: string;
  videoId: string | null;
  equipment: string[];
  unilateral: boolean;
  series: number;
  isTimed: boolean;
  seconds: number; // par côté/série si minuté
  repsLabel: string; // si non minuté
  segments: Segment[];
};

// ── Sons & voix ──────────────────────────────────────────────────────────────
function useChime() {
  const ctxRef = useRef<AudioContext | null>(null);
  const ensure = () => {
    if (!ctxRef.current) {
      try {
        const AC = (window.AudioContext || (window as any).webkitAudioContext);
        ctxRef.current = new AC();
      } catch { /* pas d'audio */ }
    }
    return ctxRef.current;
  };
  const beep = useCallback(() => {
    const ctx = ensure();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      [0, 0.18, 0.36].forEach((t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.0001, now + t);
        gain.gain.exponentialRampToValueAtTime(0.35, now + t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + 0.18);
      });
    } catch { /* ignore */ }
  }, []);
  return { beep, warmup: ensure };
}

function speak(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    u.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

export default function RecupDetail() {
  useWakeLock(true);
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { beep, warmup } = useChime();

  const [session, setSession] = useState<any>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);

  const [phase, setPhase] = useState<"intro" | "playing">("intro");
  const [stepIdx, setStepIdx] = useState(0);
  const [segIdx, setSegIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [switching, setSwitching] = useState(false); // phase transition (côté / série)
  const [switchRemaining, setSwitchRemaining] = useState(0);
  const [switchLabel, setSwitchLabel] = useState("Change de côté");

  const [videoOpen, setVideoOpen] = useState(false);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [feedback, setFeedback] = useState("");

  // ── Chargement ─────────────────────────────────────────────────────────────
  useEffect(() => { loadSession(); }, [sessionId]);

  const loadSession = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("training_sessions")
      .select(`*, session_exercises (*)`)
      .eq("id", sessionId)
      .maybeSingle();
    if (error || !data) { setLoading(false); return; }
    setSession(data);

    const raw: any[] = (data.session_exercises || []).slice().sort(
      (a, b) => (a.exercise_order ?? 0) - (b.exercise_order ?? 0),
    );

    // Enrichissement depuis la bibliothèque (vidéo, consignes, matériel, unilatéral)
    const ids = Array.from(new Set(raw.map((e) => e.exercise_library_id).filter(Boolean)));
    const names = Array.from(new Set(raw.map((e) => (e.exercice || "").trim().toLowerCase()).filter(Boolean)));
    const libById = new Map<string, any>();
    const libByName = new Map<string, any>();
    if (ids.length || names.length) {
      const { data: lib } = await supabase
        .from("exercise_library")
        .select("id, name, video_url, description, equipment, unilateral");
      (lib || []).forEach((l: any) => {
        libById.set(l.id, l);
        libByName.set((l.name || "").trim().toLowerCase(), l);
      });
    }

    const built: Step[] = raw
      .filter((e) => (e.exercice || "").trim().length > 0)
      .map((e) => {
        const lib = (e.exercise_library_id && libById.get(e.exercise_library_id))
          || libByName.get((e.exercice || "").trim().toLowerCase())
          || {};
        const unilateral = !!(e.per_side || lib.unilateral);
        const series = Math.max(1, parseInt(e.series, 10) || 1);
        const isTimed = !!e.is_duration;
        const seconds = isTimed ? parseSeconds(e.reps) : 0;
        const equipment = String(lib.equipment || "")
          .split(",").map((x: string) => x.trim()).filter(Boolean);
        const consignes = String(lib.description || "").trim();
        const coachNote = String(e.commentaire || "").trim();

        const segments: Segment[] = [];
        if (isTimed && seconds > 0) {
          for (let s = 1; s <= series; s++) {
            if (unilateral) {
              segments.push({ label: "Côté 1", seconds, announceAfter: "Change de côté", switchSeconds: SIDE_SWITCH_SECONDS });
              segments.push({ label: "Côté 2", seconds, announceAfter: s < series ? "Série suivante" : null, switchSeconds: SERIES_REST_SECONDS });
            } else {
              segments.push({ label: series > 1 ? `Série ${s}` : "", seconds, announceAfter: s < series ? "Série suivante" : null, switchSeconds: SERIES_REST_SECONDS });
            }
          }
        }

        const repsLabel = !isTimed
          ? `${series > 1 ? `${series} × ` : ""}${e.reps || "?"} reps${unilateral ? " / côté" : ""}`
          : "";

        return {
          id: e.id,
          name: e.exercice,
          consignes,
          coachNote,
          videoId: youtubeId(lib.video_url),
          equipment,
          unilateral,
          series,
          isTimed,
          seconds,
          repsLabel,
          segments,
        };
      });

    setSteps(built);
    setLoading(false);
  };

  // ── Timer général de séance ──────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStart == null) return;
    const i = setInterval(() => setElapsed(Math.floor((Date.now() - sessionStart) / 1000)), 1000);
    return () => clearInterval(i);
  }, [sessionStart]);

  // ── Minuteur d'étape ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running || switching) return;
    if (remaining <= 0) return;
    const i = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(i); onSegmentEnd(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(i);
  }, [running, switching, remaining, segIdx, stepIdx]);

  // ── Transition 10s (changement de côté / série) ──────────────────────────────
  useEffect(() => {
    if (!switching) return;
    if (switchRemaining <= 0) { finishSwitch(); return; }
    const i = setInterval(() => {
      setSwitchRemaining((r) => {
        if (r <= 1) { clearInterval(i); finishSwitch(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(i);
  }, [switching, switchRemaining]);

  const curStep = steps[stepIdx];

  const onSegmentEnd = () => {
    const step = steps[stepIdx];
    if (!step) return;
    const seg = step.segments[segIdx];
    beep();
    if (seg && seg.announceAfter) {
      speak(`${seg.announceAfter}. ${seg.switchSeconds} secondes.`);
      setSwitchLabel(seg.announceAfter);
      setSwitching(true);
      setSwitchRemaining(seg.switchSeconds);
    } else {
      // dernier segment de l'étape
      setRunning(false);
      speak("Terminé.");
    }
  };

  const finishSwitch = () => {
    setSwitching(false);
    const step = steps[stepIdx];
    if (!step) return;
    const next = segIdx + 1;
    setSegIdx(next);
    setRemaining(step.segments[next]?.seconds ?? 0);
    setRunning(true);
  };

  const loadStep = (idx: number) => {
    const step = steps[idx];
    setStepIdx(idx);
    setSegIdx(0);
    setSwitching(false);
    setRunning(false);
    setRemaining(step?.segments[0]?.seconds ?? 0);
    setVideoOpen(false);
  };

  const begin = () => {
    warmup();
    setSessionStart(Date.now());
    setPhase("playing");
    loadStep(0);
  };

  const toggleRun = () => {
    warmup();
    if (curStep?.isTimed && remaining <= 0 && !switching) {
      // relancer le segment courant
      setRemaining(curStep.segments[segIdx]?.seconds ?? 0);
      setRunning(true);
      return;
    }
    setRunning((r) => !r);
  };

  const goStep = (idx: number) => {
    if (idx < 0) { setPhase("intro"); return; }
    if (idx >= steps.length) { setCompletionOpen(true); return; }
    loadStep(idx);
  };

  // ── Validation / fin ─────────────────────────────────────────────────────────
  const handleCompletion = async (data: { date: Date; rpe: number; comment: string; durationMinutes: number }) => {
    const { error } = await supabase
      .from("training_sessions")
      .update({
        duration_minutes: data.durationMinutes,
        completed_at: data.date.toISOString(),
        session_rpe: data.rpe || null,
        session_comment: data.comment || null,
      })
      .eq("id", sessionId);
    if (error) { toast({ title: "Erreur", description: "Enregistrement impossible", variant: "destructive" }); return; }
    if (feedback.trim()) {
      await supabase.from("session_exercises").update({ sportif_comment: feedback }).eq("session_id", sessionId);
    }
    setCompletionOpen(false);
    setShowCelebration(true);
  };

  const handleInvalidate = async () => {
    await supabase.from("training_sessions").update({ duration_minutes: null, completed_at: null }).eq("id", sessionId);
    toast({ title: "Séance invalidée", description: "Tu pourras la refaire." });
    loadSession();
  };

  // ── Agrégats intro ───────────────────────────────────────────────────────────
  const materiel = useMemo(() => {
    const set = new Map<string, string>();
    steps.forEach((s) => s.equipment.forEach((e) => set.set(e.toLowerCase(), e)));
    return Array.from(set.values());
  }, [steps]);

  const totalSeconds = useMemo(() => {
    return steps.reduce((acc, s) => {
      if (s.isTimed) return acc + s.segments.reduce((a, seg) => a + seg.seconds + (seg.announceAfter ? seg.switchSeconds : 0), 0);
      return acc + s.series * 45; // estimation pour les exos en reps
    }, 0);
  }, [steps]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground">Chargement…</p></div>;
  }
  if (!session) {
    return (
      <div className="min-h-screen p-4">
        <Button variant="ghost" onClick={() => navigate("/sportif/seances")}><ArrowLeft className="h-4 w-4 mr-2" />Retour</Button>
        <p className="text-center text-muted-foreground mt-8">Séance introuvable</p>
      </div>
    );
  }

  const isCompleted = session.completed_at !== null;

  // ── Écran : séance déjà terminée (récap) ─────────────────────────────────────
  if (isCompleted && phase === "intro") {
    return (
      <div className="min-h-screen bg-background pb-20">
        <CelebrationOverlay show={showCelebration} message={session?.name || ""} onComplete={() => { setShowCelebration(false); navigate("/sportif/seances"); }} type="session" />
        <div className="sticky top-0 z-10 bg-background border-b p-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/sportif/seances")}><ArrowLeft className="h-4 w-4 mr-2" />Retour</Button>
        </div>
        <div className="p-4 space-y-4 max-w-xl mx-auto">
          <div className="flex items-center gap-2 text-green-600"><CheckCircle2 className="h-5 w-5" /><span className="font-semibold">Séance terminée</span></div>
          <h1 className="text-2xl font-bold">{session.name}</h1>
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={s.id} className="rounded-xl border border-border/50 p-3">
                <p className="font-medium">{i + 1}. {s.name}</p>
                <p className="text-sm text-muted-foreground">{s.isTimed ? `${s.series > 1 ? `${s.series} × ` : ""}${formatClock(s.seconds)}${s.unilateral ? " / côté" : ""}` : s.repsLabel}</p>
              </div>
            ))}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full"><RotateCcw className="h-4 w-4 mr-2" />Invalider cette séance</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Invalider la séance ?</AlertDialogTitle>
                <AlertDialogDescription>Cette action va réinitialiser la séance. Tu pourras la refaire.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleInvalidate}>Confirmer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  // ── Écran d'intro ────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-10 bg-background border-b p-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/sportif/seances")}><ArrowLeft className="h-4 w-4 mr-2" />Retour</Button>
        </div>
        <div className="p-4 space-y-5 max-w-xl mx-auto">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl bg-green-500/15 flex items-center justify-center text-2xl shrink-0">🧘</div>
            <div>
              <h1 className="text-2xl font-bold leading-tight">{session.name}</h1>
              <p className="text-muted-foreground text-sm mt-1 flex items-center gap-3">
                <span>{steps.length} étape{steps.length > 1 ? "s" : ""}</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatTotal(totalSeconds)}</span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-secondary/30 p-4">
            <p className="text-sm font-semibold flex items-center gap-2 mb-2"><Dumbbell className="h-4 w-4" />Matériel</p>
            {materiel.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun (poids du corps)</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {materiel.map((m) => (
                  <span key={m} className="text-xs rounded-full border border-border/60 bg-background px-2.5 py-1">{m}</span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border/40 px-3 py-2.5">
                <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}</span>
                <span className="flex-1 text-sm font-medium truncate">{s.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {s.isTimed ? `${s.series > 1 ? `${s.series}× ` : ""}${formatClock(s.seconds)}${s.unilateral ? "/côté" : ""}` : s.repsLabel}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
          <Button onClick={begin} className="w-full max-w-xl mx-auto flex" size="lg" disabled={steps.length === 0}>
            <Play className="h-5 w-5 mr-2" />Commencer la séance
          </Button>
        </div>
      </div>
    );
  }

  // ── Lecteur plein écran ──────────────────────────────────────────────────────
  const seg = curStep?.segments[segIdx];
  const showTimer = !!curStep?.isTimed && !!seg;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <CelebrationOverlay show={showCelebration} message={session?.name || ""} onComplete={() => { setShowCelebration(false); navigate("/sportif/seances"); }} type="session" />

      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 bg-secondary" onClick={() => setPhase("intro")}><X className="h-4 w-4" /></Button>
        <span className="text-sm font-medium truncate flex-1">{session.name}</span>
        <span className="text-xs text-muted-foreground">{formatClock(elapsed)}</span>
      </div>

      {/* Progression en pointillés */}
      <div className="flex gap-1 px-3 pb-2">
        {steps.map((_, i) => (
          <div key={i} className={cn("h-1 flex-1 rounded-full", i < stepIdx ? "bg-primary" : i === stepIdx ? "bg-primary/60" : "bg-border/50")} />
        ))}
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto px-6 flex flex-col items-center justify-center text-center">
        <h2 className="text-3xl font-serif font-bold mb-2">{curStep?.name}</h2>

        {curStep?.unilateral && (
          <p className="text-sm font-medium text-primary mb-3 flex items-center gap-1.5">
            <RotateCcw className="h-4 w-4" />À faire des deux côtés
          </p>
        )}

        {curStep?.consignes && (
          <p className="text-base leading-relaxed text-foreground/90 max-w-lg mb-2 whitespace-pre-line">{curStep.consignes}</p>
        )}
        {curStep?.coachNote && (
          <p className="text-sm text-muted-foreground max-w-lg mb-4 italic">📝 {curStep.coachNote}</p>
        )}

        {/* badges série / côté */}
        <div className="flex items-center gap-2 mb-5">
          {curStep && curStep.series > 1 && showTimer && (
            <span className="text-xs rounded-full bg-secondary px-3 py-1">
              {curStep.unilateral ? `Série ${Math.floor(segIdx / 2) + 1}/${curStep.series}` : `Série ${segIdx + 1}/${curStep.series}`}
            </span>
          )}
          {curStep?.unilateral && showTimer && !switching && (
            <span className="text-xs rounded-full bg-primary/15 text-primary border border-primary/30 px-3 py-1 font-medium">{seg?.label} / 2</span>
          )}
        </div>

        {switching ? (
          <div className="flex flex-col items-center">
            <p className="text-lg text-primary font-semibold mb-1">{switchLabel}</p>
            <p className="text-6xl font-serif font-bold tabular-nums">{switchRemaining}</p>
          </div>
        ) : showTimer ? (
          <>
            <p className="text-7xl font-serif font-bold tabular-nums mb-6">{formatClock(remaining > 0 ? remaining : seg!.seconds)}</p>
            <button onClick={toggleRun} className="h-20 w-20 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform">
              {running ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8 ml-1" />}
            </button>
            {remaining <= 0 && !running && (
              <p className="text-sm text-muted-foreground mt-4">Segment terminé — passe au suivant ▸</p>
            )}
          </>
        ) : (
          <>
            <p className="text-5xl font-serif font-bold mb-2">{curStep?.repsLabel}</p>
            <p className="text-sm text-muted-foreground">À ton rythme, puis passe au suivant.</p>
          </>
        )}

        {curStep?.videoId && (
          <button onClick={() => setVideoOpen(true)} className="mt-6 inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <Youtube className="h-4 w-4" />Voir la démonstration
          </button>
        )}
      </div>

      {/* Navigation — centrée pour ne pas passer sous la bulle d'assistant (coin bas-droit) */}
      <div className="flex items-center justify-center gap-8 px-4 pt-4 pb-20">
        <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 bg-secondary" onClick={() => goStep(stepIdx - 1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums min-w-[70px] text-center">{stepIdx + 1} sur {steps.length}</span>
        <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 bg-secondary" onClick={() => goStep(stepIdx + 1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Vidéo */}
      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="p-0 overflow-hidden max-w-md">
          {curStep?.videoId && (
            <div className="aspect-[9/16] w-full">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${curStep.videoId}`}
                title={curStep.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Validation de fin */}
      <SessionCompletionDialog
        open={completionOpen}
        onOpenChange={setCompletionOpen}
        onValidate={handleCompletion}
        onCancel={() => setCompletionOpen(false)}
        sessionName={session?.name}
        sessionType="recup"
        initialDurationSeconds={elapsed}
      />
    </div>
  );
}
