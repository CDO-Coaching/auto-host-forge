import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { ChevronLeft, Target, Check, Trophy, Plus, Hourglass, CalendarDays, X } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Objective {
  id?: string;
  main_objective?: string | null;
  main_objective_deadline?: string | null;
  secondary_objective?: string | null;
  main_completed?: boolean;
  main_completed_at?: string | null;
}

interface Milestone {
  id: string;
  label: string;
  target_date?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  completed: boolean;
  created_by_role?: string | null;
  approval_status?: string | null;
}

// Date effective : validation si atteint, sinon date cible
const refDate = (m: Milestone) => (m.completed ? m.completed_at || m.target_date : m.target_date) || null;

export default function MesObjectifs() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [objective, setObjective] = useState<Objective>({});
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [coachName, setCoachName] = useState("ton coach");
  // Formulaire "proposer un sous-objectif"
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [proposing, setProposing] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    // Coach lié (pour le nom + coach_id des propositions)
    const { data: rel } = await supabase
      .from("coach_athlete_relationships")
      .select("coach_id")
      .eq("athlete_id", user.id)
      .eq("status", "approved")
      .maybeSingle();
    if (rel?.coach_id) {
      setCoachId(rel.coach_id);
      const { data: prof } = await supabase.from("user_profiles").select("first_name").eq("id", rel.coach_id).maybeSingle();
      if (prof?.first_name) setCoachName(prof.first_name);
    }

    const { data: objRows } = await supabase
      .from("athlete_objectives")
      .select("*")
      .eq("athlete_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (objRows && objRows.length > 0) setObjective(objRows[0]);

    const { data: msRows } = await supabase
      .from("objective_milestones")
      .select("*")
      .eq("athlete_id", user.id);
    setMilestones(msRows || []);
    setLoading(false);
  };

  const handlePropose = async () => {
    if (!newLabel.trim() || !userId) return;
    setProposing(true);
    const { error } = await supabase.from("objective_milestones").insert({
      athlete_id: userId,
      coach_id: coachId,
      label: newLabel.trim(),
      target_date: newDate ? format(newDate, "yyyy-MM-dd") : null,
      completed: false,
      created_by_role: "athlete",
      approval_status: "pending",
    });
    setProposing(false);
    if (error) { toast.error("Impossible d'envoyer (droits ?)"); return; }
    toast.success(`Proposition envoyée à ${coachName} ✓`);
    setNewLabel(""); setNewDate(null); setShowAdd(false);
    load();
  };

  const byRef = (a: Milestone, b: Milestone) => {
    const da = refDate(a), db = refDate(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return new Date(da).getTime() - new Date(db).getTime();
  };
  const isPending = (m: Milestone) => m.approval_status === "pending";
  const pending = milestones.filter(isPending).sort(byRef);
  const approved = milestones.filter((m) => !isPending(m));
  const activeSorted = approved.filter((m) => !m.completed).sort(byRef);
  const done = approved.filter((m) => m.completed).sort(byRef);
  const completedCount = done.length;
  const approvedTotal = approved.length;
  // Le "défi du moment" : premier jalon actif dans l'ordre chronologique
  const nextId = activeSorted[0]?.id;

  const toggleMilestone = async (m: Milestone) => {
    const next = !m.completed;
    const completedAt = next ? format(new Date(), "yyyy-MM-dd") : null;
    setMilestones((prev) => prev.map((x) => (x.id === m.id ? { ...x, completed: next, completed_at: completedAt } : x)));
    const { error } = await supabase.from("objective_milestones").update({ completed: next, completed_at: completedAt }).eq("id", m.id);
    if (error) {
      setMilestones((prev) => prev.map((x) => (x.id === m.id ? { ...x, completed: !next, completed_at: m.completed_at } : x)));
      toast.error("Impossible de mettre à jour (droits ?)");
    } else {
      toast.success(next ? "Bravo, étape franchie ! 💪" : "Étape remise à venir");
    }
  };

  const toggleMain = async () => {
    if (!objective.id) return;
    const next = !objective.main_completed;
    const completedAt = next ? format(new Date(), "yyyy-MM-dd") : null;
    setObjective((prev) => ({ ...prev, main_completed: next, main_completed_at: completedAt }));
    const { error } = await supabase.from("athlete_objectives").update({ main_completed: next, main_completed_at: completedAt }).eq("id", objective.id);
    if (error) {
      setObjective((prev) => ({ ...prev, main_completed: !next }));
      toast.error("Impossible de mettre à jour (droits ?)");
    } else {
      toast.success(next ? "Objectif atteint ! 🏆" : "Objectif remis en cours");
    }
  };

  const deadlineDays = objective.main_objective_deadline
    ? differenceInDays(new Date(objective.main_objective_deadline), new Date())
    : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="p-3 sm:p-4 max-w-2xl mx-auto space-y-4">
        {/* En-tête */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Mes objectifs</h1>
            <p className="text-xs text-muted-foreground">Ton parcours, étape par étape 🎯</p>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-10">Chargement…</p>
        ) : (
          <>
            {!objective.main_objective && (
              <Card>
                <CardContent className="py-6 text-center space-y-1">
                  <Target className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Ton coach n'a pas encore défini d'objectif principal.</p>
                  <p className="text-xs text-muted-foreground/70">Tu peux déjà proposer des étapes ci-dessous.</p>
                </CardContent>
              </Card>
            )}
            {/* Objectif principal */}
            {objective.main_objective && (
              <Card className={cn("overflow-hidden", objective.main_completed ? "border-emerald-500/50" : "border-primary/30")}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-primary font-semibold">Ton grand objectif</p>
                      <h2 className={cn("text-lg sm:text-xl font-bold leading-tight mt-0.5", objective.main_completed && "text-emerald-600")}>
                        {objective.main_objective}
                      </h2>
                      {objective.main_objective_deadline && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {objective.main_completed
                            ? `🏆 Atteint${objective.main_completed_at ? ` le ${format(new Date(objective.main_completed_at), "d MMM yyyy", { locale: fr })}` : ""}`
                            : deadlineDays !== null && deadlineDays >= 0
                              ? `Dans ${deadlineDays} jour${deadlineDays > 1 ? "s" : ""} · ${format(new Date(objective.main_objective_deadline), "d MMM yyyy", { locale: fr })}`
                              : format(new Date(objective.main_objective_deadline), "d MMM yyyy", { locale: fr })}
                        </p>
                      )}
                    </div>
                    <div className={cn("h-11 w-11 rounded-full grid place-items-center shrink-0", objective.main_completed ? "bg-emerald-500/15" : "bg-primary/15")}>
                      {objective.main_completed ? <Trophy className="h-6 w-6 text-emerald-500" /> : <Target className="h-6 w-6 text-primary" />}
                    </div>
                  </div>

                  {objective.secondary_objective && (
                    <p className="text-sm text-muted-foreground">Aussi : {objective.secondary_objective}</p>
                  )}

                  {/* Progression jalons */}
                  {approvedTotal > 0 && (
                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(completedCount / approvedTotal) * 100}%` }} />
                      </div>
                      <p className="text-[11px] text-muted-foreground">{completedCount} étape{completedCount > 1 ? "s" : ""} sur {approvedTotal}</p>
                    </div>
                  )}

                  {objective.id && (
                    <Button
                      onClick={toggleMain}
                      variant={objective.main_completed ? "outline" : "default"}
                      className="w-full gap-2"
                    >
                      <Check className="h-4 w-4" />
                      {objective.main_completed ? "Objectif atteint ✓ (annuler)" : "J'ai atteint mon objectif"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Timeline de validation */}
            {(approved.length > 0 || objective.main_objective) && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Ma progression</p>
                  <div className="overflow-x-auto pb-1">
                    <div className="relative min-w-[440px] pt-1 pb-10">
                      <div className="absolute left-0 right-0 top-[26px] h-0.5 bg-border" />
                      <div className="flex items-start justify-between gap-2">
                        {(() => {
                          type TItem = { key: string; label: string; date: string | null; completed: boolean; isMain: boolean; onClick?: () => void };
                          const items: TItem[] = [...approved].sort(byRef).map((m) => ({ key: m.id, label: m.label, date: refDate(m), completed: m.completed, isMain: false, onClick: () => toggleMilestone(m) }));
                          if (objective.main_objective && (objective.main_objective_deadline || objective.main_completed)) {
                            const md = objective.main_completed ? (objective.main_completed_at || objective.main_objective_deadline || null) : (objective.main_objective_deadline || null);
                            items.push({ key: "main", label: objective.main_objective, date: md, completed: !!objective.main_completed, isMain: true, onClick: objective.id ? toggleMain : undefined });
                          }
                          items.sort((a, b) => { if (!a.date && !b.date) return 0; if (!a.date) return 1; if (!b.date) return -1; return new Date(a.date).getTime() - new Date(b.date).getTime(); });
                          return items.map((it) => (
                            <button key={it.key} type="button" onClick={it.onClick} className="relative flex-1 min-w-[80px] flex flex-col items-center text-center">
                              <span className={cn(
                                "grid place-items-center rounded-full border-2 border-background z-10 text-[10px]",
                                it.isMain ? "h-7 w-7" : "h-4 w-4",
                                it.completed ? "bg-emerald-500 ring-4 ring-emerald-500/25" : it.isMain ? "bg-primary ring-4 ring-primary/25" : "bg-muted border-dashed border-muted-foreground/50",
                              )}>{it.isMain ? "🎯" : ""}</span>
                              <span className={cn("mt-2.5 leading-tight line-clamp-2", it.isMain ? "text-[12px] font-bold" : "text-[11px] font-medium", it.completed ? "text-emerald-600" : it.isMain ? "text-foreground" : "text-muted-foreground")}>
                                {it.label}{it.completed ? " ✓" : ""}
                              </span>
                              <span className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">{it.date ? format(new Date(it.date), "d MMM", { locale: fr }) : "—"}</span>
                            </button>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Mes étapes (actives) + proposer */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Mes étapes</h3>
                {!showAdd && (
                  <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setShowAdd(true)}>
                    <Plus className="h-4 w-4" /> Proposer
                  </Button>
                )}
              </div>

              {/* Formulaire de proposition */}
              {showAdd && (
                <Card className="mb-3 border-primary/30">
                  <CardContent className="p-3 space-y-2.5">
                    <p className="text-xs text-muted-foreground">Propose une étape — <b>{coachName}</b> devra la valider pour qu'elle apparaisse.</p>
                    <Input placeholder="Ex : Courir 10 km sans marcher" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} autoFocus />
                    <div className="flex flex-wrap items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="justify-start font-normal">
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {newDate ? format(newDate, "d MMM yyyy", { locale: fr }) : "Date (facultatif)"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={newDate ?? undefined} onSelect={(d) => setNewDate(d ?? null)} locale={fr} weekStartsOn={1} className="pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                      {newDate && <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setNewDate(null)}>Retirer</Button>}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="flex-1" onClick={handlePropose} disabled={proposing || !newLabel.trim()}>
                        {proposing ? "Envoi…" : "Envoyer au coach"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setNewLabel(""); setNewDate(null); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Propositions en attente */}
              {pending.length > 0 && (
                <div className="mb-3 space-y-2">
                  {pending.map((m) => (
                    <div key={m.id} className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
                      <Hourglass className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{m.label}</p>
                        {m.target_date && <p className="text-[11px] text-muted-foreground">Cible : {format(new Date(m.target_date), "d MMM yyyy", { locale: fr })}</p>}
                        <p className="text-[11px] text-amber-600 mt-0.5">⏳ En attente de validation par {coachName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Parcours actif */}
              {activeSorted.length === 0 && pending.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1 py-2">Aucune étape en cours.</p>
              ) : (
                <div className="space-y-0">
                  {activeSorted.map((m, idx) => {
                    const isNext = m.id === nextId;
                    const d = refDate(m);
                    return (
                      <div key={m.id} className="flex gap-3">
                        <div className="flex flex-col items-center w-6 shrink-0">
                          <span className={cn("h-4 w-4 rounded-full mt-1.5 shrink-0", isNext ? "bg-primary ring-4 ring-primary/20" : "bg-muted border-2 border-dashed border-muted-foreground/50")} />
                          {idx < activeSorted.length - 1 && <span className="flex-1 w-0.5 bg-border my-1" />}
                        </div>
                        <div className={cn("flex-1 mb-3 rounded-xl border p-3", isNext ? "border-primary/40 bg-primary/5" : "border-border/60")}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm">{m.label}</p>
                              {m.notes && <p className="text-xs text-muted-foreground mt-0.5">{m.notes}</p>}
                              <p className="text-[11px] text-muted-foreground mt-1">{d ? `Cible : ${format(new Date(d), "d MMM yyyy", { locale: fr })}` : "Sans date"}</p>
                            </div>
                            {isNext && <span className="text-[10px] font-bold uppercase tracking-wide text-primary shrink-0">À faire</span>}
                          </div>
                          <Button onClick={() => toggleMilestone(m)} size="sm" className="w-full mt-2.5 gap-1.5">
                            <Check className="h-4 w-4" /> Je l'ai atteint
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sous-objectifs validés */}
            {done.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-emerald-600 uppercase tracking-wide mb-2 px-1 flex items-center gap-1.5">
                  <Check className="h-4 w-4" /> Étapes validées ({done.length})
                </h3>
                <div className="space-y-2">
                  {done.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3">
                      <span className="h-7 w-7 rounded-full grid place-items-center bg-emerald-500 text-white shrink-0"><Check className="h-4 w-4" /></span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-emerald-600">{m.label}</p>
                        <p className="text-[11px] text-muted-foreground">Validé{m.completed_at ? ` le ${format(new Date(m.completed_at), "d MMM yyyy", { locale: fr })}` : ""}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 text-xs shrink-0" onClick={() => toggleMilestone(m)}>Annuler</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
