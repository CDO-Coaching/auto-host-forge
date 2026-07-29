import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarClock, Loader2, ArrowLeft } from "lucide-react";
import { formatWeekRangeFromNumber } from "@/lib/weekUtils";

interface WeekRef { week: number; year: number }
interface PendingRequest {
  id: string;
  target_weeks: WeekRef[];
  message: string | null;
}
interface WeekAnswer { renfo: string; course: string; natation: string; velo: string; comment: string }

const SPORTS: { key: keyof Omit<WeekAnswer, "comment">; label: string; icon: string }[] = [
  { key: "renfo", label: "Renforcement", icon: "🏋️" },
  { key: "course", label: "Course à pied", icon: "🏃" },
  { key: "natation", label: "Natation", icon: "🏊" },
  { key: "velo", label: "Vélo", icon: "🚴" },
];

const blankAnswer = (): WeekAnswer => ({ renfo: "0", course: "0", natation: "0", velo: "0", comment: "" });

/**
 * Gate athlète : si le coach a envoyé une demande de disponibilités visible et
 * non remplie, affiche un assistant bloquant — une étape par semaine demandée.
 */
export function AvailabilityGate() {
  const [request, setRequest] = useState<PendingRequest | null>(null);
  const [answers, setAnswers] = useState<WeekAnswer[]>([]);
  const [step, setStep] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));
  const [saving, setSaving] = useState(false);

  // Passe à la semaine suivante en pré-remplissant (1re visite) avec les valeurs
  // de la semaine courante, pour ne pas tout ressaisir.
  const goToStep = (target: number) => {
    if (target > step && !visited.has(target)) {
      setAnswers((prev) => prev.map((a, i) => (i === target ? { ...prev[step] } : a)));
      setVisited((prev) => new Set(prev).add(target));
    }
    setStep(target);
  };

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rels } = await supabase
        .from("coach_athlete_relationships")
        .select("coach_id")
        .eq("athlete_id", user.id)
        .eq("status", "approved");
      const coachIds = (rels || []).map((r: any) => r.coach_id);
      if (coachIds.length === 0) return;

      const today = new Date().toISOString().slice(0, 10);
      const { data: reqs } = await supabase
        .from("availability_requests")
        .select("id, target_weeks, message, created_at, visible_from")
        .in("coach_id", coachIds)
        .lte("visible_from", today)
        .order("created_at", { ascending: false })
        .limit(1);
      const req = reqs?.[0] as any;
      if (!req) return;

      const { data: resp } = await supabase
        .from("availability_responses")
        .select("id")
        .eq("request_id", req.id)
        .eq("athlete_id", user.id)
        .maybeSingle();
      if (resp) return;

      const weeks: WeekRef[] = Array.isArray(req.target_weeks) ? req.target_weeks : [];
      setRequest({ id: req.id, target_weeks: weeks, message: req.message });
      setAnswers(weeks.map(() => blankAnswer()));
      setStep(0);
      setVisited(new Set([0]));
    };
    check();
  }, []);

  const patch = (p: Partial<WeekAnswer>) =>
    setAnswers((prev) => prev.map((a, i) => (i === step ? { ...a, ...p } : a)));

  const submit = async () => {
    if (!request) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");
      const weeksData = request.target_weeks.map((w, i) => ({
        week: w.week,
        year: w.year,
        renfo: parseInt(answers[i].renfo) || 0,
        course: parseInt(answers[i].course) || 0,
        natation: parseInt(answers[i].natation) || 0,
        velo: parseInt(answers[i].velo) || 0,
        comment: answers[i].comment.trim() || null,
      }));
      // Totaux (compat colonnes historiques)
      const tot = (k: "renfo" | "course" | "natation" | "velo") => weeksData.reduce((s, w) => s + (w as any)[k], 0);
      const { error } = await supabase.from("availability_responses").insert({
        request_id: request.id,
        athlete_id: user.id,
        weeks_data: weeksData as any,
        renfo_count: tot("renfo"),
        course_count: tot("course"),
        natation_count: tot("natation"),
        velo_count: tot("velo"),
        comment: weeksData.map((w) => w.comment).filter(Boolean).join(" · ") || null,
      } as any);
      if (error) throw error;
      toast.success("Merci ! Tes disponibilités ont été envoyées à ton coach.");
      setRequest(null);
    } catch (e: any) {
      toast.error(`Erreur : ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  if (!request || request.target_weeks.length === 0) return null;

  const current = request.target_weeks[step];
  const answer = answers[step] || blankAnswer();
  const isLast = step >= request.target_weeks.length - 1;

  return (
    <Dialog open onOpenChange={() => { /* non fermable */ }}>
      <DialogContent
        className="max-w-md max-h-[90vh] overflow-y-auto [&>button.absolute]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" /> Tes disponibilités
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {step === 0 && request.message && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm whitespace-pre-wrap">
              {request.message}
            </div>
          )}

          {/* Semaine courante */}
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-center">
            <p className="text-xs text-muted-foreground">Semaine {step + 1} / {request.target_weeks.length}</p>
            <p className="text-base font-bold text-primary">S{current.week} — {current.year}</p>
            <p className="text-xs text-muted-foreground">{formatWeekRangeFromNumber(current.week, current.year)}</p>
          </div>

          <p className="text-sm text-muted-foreground">De combien de séances as-tu besoin cette semaine ?</p>

          <div className="grid grid-cols-2 gap-3">
            {SPORTS.map((s) => (
              <div key={s.key} className="space-y-1">
                <Label className="text-xs">{s.icon} {s.label}</Label>
                <div className="flex items-center gap-2">
                  <button type="button" className="h-9 w-9 rounded-lg border bg-secondary text-lg font-bold active:bg-muted"
                    onClick={() => patch({ [s.key]: String(Math.max(0, (parseInt(answer[s.key]) || 0) - 1)) } as any)}>−</button>
                  <Input type="number" min="0" value={answer[s.key]} onChange={(e) => patch({ [s.key]: e.target.value } as any)} className="h-9 text-center" />
                  <button type="button" className="h-9 w-9 rounded-lg border bg-secondary text-lg font-bold active:bg-muted"
                    onClick={() => patch({ [s.key]: String((parseInt(answer[s.key]) || 0) + 1) } as any)}>+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label htmlFor="comment" className="text-xs">Commentaire pour cette semaine</Label>
            <Textarea id="comment" value={answer.comment} onChange={(e) => patch({ comment: e.target.value })} rows={2}
              placeholder="Ex : j'ai besoin de 2 séances maison et une salle" />
          </div>

          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => goToStep(step - 1)} disabled={saving} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-1" /> Précédente
              </Button>
            )}
            <Button onClick={() => (isLast ? submit() : goToStep(step + 1))} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {isLast ? "Valider mes disponibilités" : "Semaine suivante"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
