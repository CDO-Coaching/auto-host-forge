/**
 * MentalPrepTab — Module « Prépa mentale » (vue coach, 100 % coach).
 *
 * Un bilan = un point dans le temps (le plus ancien = bilan initial).
 * Colonne gauche : timeline des bilans + « Nouveau bilan ».
 * Colonne droite : mode Évolution (graphe des 3 courbes + deltas + axes) ou
 * mode Bilan (formulaire autosave : 4 questions ouvertes, 3 notes /10, axe prioritaire).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { QuickRatingInput } from "@/components/QuickRatingInput";
import {
  Brain, Plus, Trash2, LineChart as LineChartIcon, FileText,
  Check, Loader2, TrendingUp, TrendingDown, Minus, Target,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const SORA = { fontFamily: "'Sora', system-ui, sans-serif" } as const;

interface MentalAssessment {
  id: string;
  athlete_id: string;
  assessment_date: string;
  q_quete: string | null;
  q_charge_lourde: string | null;
  q_echec: string | null;
  q_concentration: string | null;
  q_influence: string | null;
  score_confiance: number | null;
  score_gestion_peur: number | null;
  score_regularite: number | null;
  axe_prioritaire: string | null;
  plan_action: string | null;
  created_at: string;
  updated_at: string;
}

const QUESTIONS: { key: keyof MentalAssessment; label: string; hint: string }[] = [
  { key: "q_quete", label: "Ce qu'il vient vraiment chercher", hint: "au fond, au-delà du physique" },
  { key: "q_charge_lourde", label: "Face à une charge lourde / un exo qui fait peur", hint: "ce qui se passe dans sa tête" },
  { key: "q_echec", label: "Son discours interne quand il rate / régresse", hint: "les mots qu'il se dit" },
  { key: "q_concentration", label: "Sa concentration à l'entraînement", hint: "présent vs tête ailleurs" },
  { key: "q_influence", label: "Comment le sport influence son moral / son énergie en ce moment", hint: "ce qu'il en retire au quotidien" },
];

const SCORES: { key: keyof MentalAssessment; label: string; color: string }[] = [
  { key: "score_confiance", label: "Confiance à l'entraînement", color: "#FFCF2E" },
  { key: "score_gestion_peur", label: "Gestion de la peur / du stress", color: "#38bdf8" },
  { key: "score_regularite", label: "Régularité sans se décourager", color: "#22c55e" },
];

const scorePastille = (v: number | null) => {
  if (v == null) return "#3f3f46";
  if (v <= 3) return "#ef4444";
  if (v <= 5) return "#f97316";
  if (v <= 7) return "#eab308";
  return "#22c55e";
};

export function MentalPrepTab({ athleteId, athleteName }: { athleteId: string; athleteName: string }) {
  const [assessments, setAssessments] = useState<MentalAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"evolution" | "bilan">("evolution");
  const [draft, setDraft] = useState<MentalAssessment | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [athleteId]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("mental_assessments")
      .select("*")
      .eq("athlete_id", athleteId)
      .order("assessment_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) { console.error(error); toast.error("Erreur de chargement des bilans"); }
    setAssessments((data as MentalAssessment[]) || []);
    setLoading(false);
  };

  // Bilans triés du plus ancien au plus récent (pour le graphe / les deltas)
  const chrono = useMemo(
    () => [...assessments].sort((a, b) => a.assessment_date.localeCompare(b.assessment_date)),
    [assessments],
  );

  const openBilan = (a: MentalAssessment) => {
    setSelectedId(a.id);
    setDraft({ ...a });
    setMode("bilan");
    setSaveState("idle");
  };

  const createBilan = async () => {
    const isFirst = assessments.length === 0;
    const { data, error } = await supabase
      .from("mental_assessments")
      .insert({ athlete_id: athleteId })
      .select("*")
      .single();
    if (error || !data) { console.error(error); toast.error("Impossible de créer le bilan"); return; }
    const row = data as MentalAssessment;
    setAssessments((prev) => [row, ...prev]);
    openBilan(row);
    toast.success(isFirst ? "Bilan initial créé" : "Nouveau bilan créé");
  };

  const deleteBilan = async (id: string) => {
    const { error } = await supabase.from("mental_assessments").delete().eq("id", id);
    if (error) { console.error(error); toast.error("Suppression impossible"); return; }
    setAssessments((prev) => prev.filter((a) => a.id !== id));
    if (selectedId === id) { setSelectedId(null); setDraft(null); setMode("evolution"); }
    toast.success("Bilan supprimé");
  };

  // Autosave (debounce) — modifiable à tout moment
  const patch = (field: keyof MentalAssessment, value: any) => {
    if (!draft) return;
    const next = { ...draft, [field]: value };
    setDraft(next);
    setAssessments((prev) => prev.map((a) => (a.id === next.id ? next : a)));
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(next), 700);
  };

  const persist = async (row: MentalAssessment) => {
    const { error } = await supabase
      .from("mental_assessments")
      .update({
        assessment_date: row.assessment_date,
        q_quete: row.q_quete, q_charge_lourde: row.q_charge_lourde,
        q_echec: row.q_echec, q_concentration: row.q_concentration, q_influence: row.q_influence,
        score_confiance: row.score_confiance, score_gestion_peur: row.score_gestion_peur,
        score_regularite: row.score_regularite, axe_prioritaire: row.axe_prioritaire,
        plan_action: row.plan_action,
      })
      .eq("id", row.id);
    if (error) { console.error(error); setSaveState("idle"); toast.error("Enregistrement échoué"); return; }
    setSaveState("saved");
    setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1800);
  };

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const chartData = chrono.map((a) => ({
    date: format(parseISO(a.assessment_date), "d MMM", { locale: fr }),
    Confiance: a.score_confiance, "Gestion peur": a.score_gestion_peur, Régularité: a.score_regularite,
  }));

  // ── Rendu ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Colonne gauche — timeline */}
      <div className="lg:w-[320px] lg:shrink-0 space-y-3">
        <Button onClick={createBilan} className="w-full h-10 gap-2">
          <Plus className="h-4 w-4" /> Nouveau bilan
        </Button>

        <button
          type="button"
          onClick={() => { setMode("evolution"); setSelectedId(null); }}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
            mode === "evolution" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40"
          }`}
        >
          <LineChartIcon className="h-4 w-4" /> Vue d'ensemble & évolution
        </button>

        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Chargement…</p>
          ) : assessments.length === 0 ? (
            <div className="text-center py-8 px-3 rounded-xl border border-dashed border-border/60">
              <Brain className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Aucun bilan pour l'instant.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Crée le bilan initial pour démarrer le suivi mental.</p>
            </div>
          ) : (
            assessments.map((a, i) => {
              const isInitial = i === assessments.length - 1; // le plus ancien
              const active = selectedId === a.id && mode === "bilan";
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openBilan(a)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                    active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold" style={SORA}>
                      {format(parseISO(a.assessment_date), "d MMM yyyy", { locale: fr })}
                    </span>
                    {isInitial && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">Initial</span>
                    )}
                  </div>
                  {a.axe_prioritaire ? (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{a.axe_prioritaire}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground/50 italic mt-0.5">Axe non renseigné</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {[a.score_confiance, a.score_gestion_peur, a.score_regularite].map((s, k) => (
                      <span key={k} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: scorePastille(s) }} />
                        <span className="text-[11px] tabular-nums text-muted-foreground">{s ?? "–"}</span>
                      </span>
                    ))}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Colonne droite */}
      <div className="flex-1 min-w-0">
        {mode === "evolution" ? (
          <EvolutionView chrono={chrono} chartData={chartData} athleteName={athleteName} onOpen={openBilan} />
        ) : draft ? (
          <BilanForm
            draft={draft}
            saveState={saveState}
            onPatch={patch}
            onDelete={() => deleteBilan(draft.id)}
          />
        ) : null}
      </div>
    </div>
  );
}

// ── Vue Évolution ────────────────────────────────────────────────────────────
function EvolutionView({
  chrono, chartData, athleteName, onOpen,
}: {
  chrono: MentalAssessment[];
  chartData: any[];
  athleteName: string;
  onOpen: (a: MentalAssessment) => void;
}) {
  if (chrono.length === 0) {
    return (
      <Card><CardContent className="py-16 text-center">
        <Brain className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Crée un premier bilan pour {athleteName} pour suivre sa progression mentale.</p>
      </CardContent></Card>
    );
  }
  const first = chrono[0];
  const last = chrono[chrono.length - 1];

  return (
    <div className="space-y-4">
      {/* Deltas depuis le bilan initial */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {SCORES.map((s) => {
          const start = first[s.key] as number | null;
          const end = last[s.key] as number | null;
          const delta = start != null && end != null ? end - start : null;
          const Icon = delta == null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
          const col = delta == null || delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-green-500" : "text-red-400";
          return (
            <div key={s.key} className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} /> {s.label}
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold" style={SORA}>{end ?? "–"}</span>
                <span className="text-xs text-muted-foreground">/10</span>
                {chrono.length > 1 && (
                  <span className={`ml-auto flex items-center gap-0.5 text-xs font-medium ${col}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {delta != null ? `${delta > 0 ? "+" : ""}${delta}` : "–"}
                  </span>
                )}
              </div>
              {chrono.length > 1 && <p className="text-[10px] text-muted-foreground/60 mt-0.5">depuis le bilan initial</p>}
            </div>
          );
        })}
      </div>

      {/* Graphe des 3 courbes */}
      <Card>
        <CardContent className="pt-5 pb-3">
          <p className="text-sm font-semibold mb-3" style={SORA}>Évolution des 3 notes /10</p>
          {chrono.length < 2 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Le graphe apparaîtra dès le 2ᵉ bilan (il faut au moins deux points pour tracer une courbe).
            </p>
          ) : (
            <div className="h-64 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Confiance" stroke={SCORES[0].color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="Gestion peur" stroke={SCORES[1].color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="Régularité" stroke={SCORES[2].color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Axes prioritaires dans le temps */}
      <Card>
        <CardContent className="pt-5 pb-3">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={SORA}>
            <Target className="h-4 w-4 text-primary" /> Axes prioritaires dans le temps
          </p>
          <div className="divide-y divide-border/50">
            {[...chrono].reverse().map((a) => (
              <button key={a.id} type="button" onClick={() => onOpen(a)}
                className="w-full flex items-start gap-3 py-2.5 text-left hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors">
                <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-20 pt-0.5">
                  {format(parseISO(a.assessment_date), "d MMM yy", { locale: fr })}
                </span>
                <span className="text-sm flex-1 min-w-0">
                  {a.axe_prioritaire || <span className="text-muted-foreground/50 italic">—</span>}
                  {a.plan_action && a.plan_action.trim() && (
                    <span className="block mt-1 space-y-0.5">
                      {a.plan_action.split("\n").filter((l) => l.trim()).map((l, k) => (
                        <span key={k} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <span className="text-primary/80 font-medium tabular-nums shrink-0">{k + 1}.</span>
                          <span className="min-w-0">{l}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Formulaire d'un bilan ────────────────────────────────────────────────────
function BilanForm({
  draft, saveState, onPatch, onDelete,
}: {
  draft: MentalAssessment;
  saveState: "idle" | "saving" | "saved";
  onPatch: (field: keyof MentalAssessment, value: any) => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardContent className="pt-5 space-y-5">
        {/* En-tête : date + état de sauvegarde + suppression */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <Input
              type="date"
              value={draft.assessment_date}
              onChange={(e) => onPatch("assessment_date", e.target.value)}
              className="h-9 w-[170px]"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 min-w-[92px] justify-end">
              {saveState === "saving" ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enregistrement…</>)
                : saveState === "saved" ? (<><Check className="h-3.5 w-3.5 text-green-500" /> Enregistré</>)
                : <span className="text-muted-foreground/50">Modifiable à tout moment</span>}
            </span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce bilan ?</AlertDialogTitle>
                  <AlertDialogDescription>Cette action est définitive.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* 4 questions ouvertes */}
        <div className="space-y-4">
          {QUESTIONS.map((q, i) => (
            <div key={q.key} className="space-y-1.5">
              <label className="text-sm font-medium flex items-baseline gap-2" style={SORA}>
                <span className="text-primary tabular-nums">{i + 1}.</span>
                {q.label}
                <span className="text-xs font-normal text-muted-foreground/60">· {q.hint}</span>
              </label>
              <Textarea
                value={(draft[q.key] as string) || ""}
                onChange={(e) => onPatch(q.key, e.target.value)}
                placeholder="Les mots du client…"
                className="min-h-[70px] resize-y text-sm"
              />
            </div>
          ))}
        </div>

        {/* 3 notes /10 */}
        <div className="space-y-4 pt-1">
          {SCORES.map((s) => (
            <div key={s.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2" style={SORA}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} /> {s.label}
                </label>
                <span className="text-sm font-bold tabular-nums" style={{ color: scorePastille(draft[s.key] as number | null) }}>
                  {(draft[s.key] as number | null) ?? "–"}<span className="text-xs text-muted-foreground font-normal">/10</span>
                </span>
              </div>
              <QuickRatingInput
                value={(draft[s.key] as number) || 0}
                onChange={(v) => onPatch(s.key, v)}
                min={1}
                max={10}
                colorScale="badToGood"
                compact
              />
            </div>
          ))}
        </div>

        {/* Axe prioritaire */}
        <div className="space-y-1.5 pt-1">
          <label className="text-sm font-medium flex items-center gap-2" style={SORA}>
            <Target className="h-4 w-4 text-primary" /> Axe prioritaire
          </label>
          <Input
            value={draft.axe_prioritaire || ""}
            onChange={(e) => onPatch("axe_prioritaire", e.target.value)}
            placeholder="Le déséquilibre à travailler en priorité…"
            className="h-10"
          />
        </div>

        {/* Plan d'action / leviers — 3 lignes séparées */}
        <div className="space-y-1.5 pt-1">
          <label className="text-sm font-medium flex items-center gap-2" style={SORA}>
            <Target className="h-4 w-4 text-primary" /> Plan d'action / leviers
          </label>
          {(() => {
            const lines = (draft.plan_action || "").split("\n");
            const setLine = (i: number, val: string) => {
              const arr = [lines[0] || "", lines[1] || "", lines[2] || ""];
              arr[i] = val;
              // on retire les lignes vides en fin pour ne pas stocker de blancs inutiles
              while (arr.length && arr[arr.length - 1].trim() === "") arr.pop();
              onPatch("plan_action", arr.join("\n"));
            };
            return (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-primary tabular-nums w-4 shrink-0">{i + 1}.</span>
                    <Input
                      value={lines[i] || ""}
                      onChange={(e) => setLine(i, e.target.value)}
                      placeholder={i === 0 ? "Les 2-3 leviers concrets à mettre en place…" : "Levier…"}
                      className="h-9 text-sm"
                    />
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </CardContent>
    </Card>
  );
}
