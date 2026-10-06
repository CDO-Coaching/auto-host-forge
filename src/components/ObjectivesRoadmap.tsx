/**
 * ObjectivesRoadmap — « Feuille de route » verticale et unifiée (vue coach).
 * Réunit sur une seule frise chronologique (aujourd'hui → objectif) :
 *   - les PHASES d'entraînement (mesocycles, dates fixes, passé/en cours/à venir),
 *   - les SOUS-OBJECTIFS (objective_milestones, datés, validables + commentaire),
 *   - l'OBJECTIF principal (athlete_objectives) comme nœud final.
 * Édition via petites fenêtres. Écrit dans les mêmes tables → Prog reste synchro.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, addWeeks, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Target, Flag, Layers, Plus, Pencil, Trash2, CalendarDays, Check, CheckCircle2, Loader2,
  ChevronDown, Trophy, AlertTriangle,
} from "lucide-react";

const SORA = { fontFamily: "'Sora', system-ui, sans-serif" } as const;
const PHASE_COLORS = ["#e8c466", "#5aa9e6", "#9c7bd6", "#5fbf82", "#e8974a", "#e56464"];

interface Phase { id: string; name: string; start_date: string; end_date: string | null; color: string | null; coach_note: string | null; }
interface Milestone { id: string; label: string; target_date: string | null; completed: boolean; completed_at: string | null; notes: string | null; approval_status: string | null; is_objective?: boolean | null; }
interface MainObj { id?: string; main_objective?: string | null; main_objective_deadline?: string | null; main_completed?: boolean; main_completed_at?: string | null; }

const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const D = (s: string) => new Date(/[T ]/.test(s) ? s : s + "T00:00:00");
const weeksBetween = (a: Date, b: Date) => Math.max(1, Math.round((differenceInCalendarDays(b, a) + 1) / 7));
const weeksUntil = (d: Date) => Math.ceil((d.getTime() - todayStart().getTime()) / (7 * 86400000));

export function ObjectivesRoadmap({ athleteId, athleteName, onObjectiveChange }: {
  athleteId: string;
  athleteName?: string;
  onObjectiveChange?: (has: boolean, name?: string | null, deadline?: string | null) => void;
}) {
  const [obj, setObj] = useState<MainObj>({});
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPalmares, setShowPalmares] = useState(false);

  // Dialogs
  const [phaseDlg, setPhaseDlg] = useState<null | { id?: string; name: string; start: Date; weeks: number | null }>(null);
  const [msDlg, setMsDlg] = useState<null | { id?: string; label: string; date: Date | null }>(null);
  const [objDlg, setObjDlg] = useState<null | { name: string; deadline: Date | null }>(null);
  const [validateDlg, setValidateDlg] = useState<null | { m: Milestone; comment: string }>(null);
  const [confirmDelete, setConfirmDelete] = useState<null | { kind: "phase" | "ms"; id: string; label: string }>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: objRows }, { data: ms }, { data: mes }] = await Promise.all([
      supabase.from("athlete_objectives").select("id, main_objective, main_objective_deadline, main_completed, main_completed_at").eq("athlete_id", athleteId).order("updated_at", { ascending: false }).limit(1),
      supabase.from("objective_milestones").select("id, label, target_date, completed, completed_at, notes, approval_status, is_objective").eq("athlete_id", athleteId),
      supabase.from("mesocycles").select("id, name, start_date, end_date, color, coach_note, macrocycle_id").eq("athlete_id", athleteId).is("macrocycle_id", null),
    ]);
    const o = objRows?.[0] || {};
    setObj(o);
    setMilestones((ms || []).filter((m: any) => m.approval_status !== "pending") as Milestone[]);
    setPhases(((mes || []) as any[]).filter((m) => m.start_date).map((m) => ({ id: m.id, name: m.name, start_date: m.start_date, end_date: m.end_date, color: m.color, coach_note: m.coach_note })));
    setLoading(false);
    onObjectiveChange?.(!!o.main_objective, o.main_objective || null, o.main_objective_deadline || null);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [athleteId]);

  // Ouverture auto de la fenêtre « nouvelle phase » depuis Prog (« Y réfléchir »)
  useEffect(() => {
    let flag = false;
    try { flag = sessionStorage.getItem("open_phase_builder") === "1"; } catch { /* ignore */ }
    if (flag) { try { sessionStorage.removeItem("open_phase_builder"); } catch { /* ignore */ } openNewPhase(); }
    /* eslint-disable-next-line */
  }, []);

  // ── Helpers d'état ─────────────────────────────────────────────────────────
  const today = todayStart();
  const dl = obj.main_objective_deadline ? D(obj.main_objective_deadline) : null;

  // Items de la frise (hors objectifs archivés) triés par date croissante
  const items = useMemo(() => {
    const phaseItems = phases.map((p) => ({ kind: "phase" as const, id: p.id, date: D(p.start_date), p }));
    const msItems = milestones
      .filter((m) => !m.is_objective)
      .map((m) => ({ kind: "ms" as const, id: m.id, date: m.target_date ? D(m.target_date) : (m.completed_at ? D(m.completed_at) : null), m }));
    return [...phaseItems, ...msItems].sort((a, b) => {
      if (!a.date) return 1; if (!b.date) return -1;
      return a.date.getTime() - b.date.getTime();
    });
  }, [phases, milestones]);

  const palmares = useMemo(
    () => milestones.filter((m) => m.completed).sort((a, b) => D(b.completed_at || b.target_date || "2100-01-01").getTime() - D(a.completed_at || a.target_date || "2100-01-01").getTime()),
    [milestones],
  );

  const phaseStatus = (p: Phase): "past" | "current" | "future" => {
    const s = D(p.start_date); const e = p.end_date ? D(p.end_date) : null;
    if (e && e < today) return "past";
    if (s <= today && (!e || e >= today)) return "current";
    return "future";
  };

  // ── CRUD phases ────────────────────────────────────────────────────────────
  const openNewPhase = () => {
    const ordered = [...phases].sort((a, b) => D(a.start_date).getTime() - D(b.start_date).getTime());
    const last = ordered[ordered.length - 1];
    const start = last?.end_date ? addDays(D(last.end_date), 1) : today;
    setPhaseDlg({ name: "", start, weeks: 4 });
  };
  const openEditPhase = (p: Phase) => setPhaseDlg({ id: p.id, name: p.name, start: D(p.start_date), weeks: p.end_date ? weeksBetween(D(p.start_date), D(p.end_date)) : null });

  const savePhase = async () => {
    if (!phaseDlg || !phaseDlg.name.trim()) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("no user");
      const start = phaseDlg.start;
      const end = phaseDlg.weeks ? addDays(addWeeks(start, phaseDlg.weeks), -1) : null;
      const payload: any = {
        name: phaseDlg.name.trim(),
        start_date: format(start, "yyyy-MM-dd"),
        end_date: end ? format(end, "yyyy-MM-dd") : null,
        updated_at: new Date().toISOString(),
      };
      if (phaseDlg.id) {
        const { error } = await supabase.from("mesocycles").update(payload).eq("id", phaseDlg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mesocycles").insert({
          ...payload, athlete_id: athleteId, coach_id: user.id, macrocycle_id: null,
          phase_type: "custom", color: PHASE_COLORS[phases.length % PHASE_COLORS.length],
          volume_target: 3, intensity_target: 3,
        });
        if (error) throw error;
      }
      setPhaseDlg(null); toast.success("Phase enregistrée"); load();
    } catch (e) { console.error(e); toast.error("Enregistrement impossible"); }
    finally { setBusy(false); }
  };

  // ── CRUD sous-objectifs ────────────────────────────────────────────────────
  const openNewMs = () => setMsDlg({ label: "", date: null });
  const openEditMs = (m: Milestone) => setMsDlg({ id: m.id, label: m.label, date: m.target_date ? D(m.target_date) : null });

  const saveMs = async () => {
    if (!msDlg || !msDlg.label.trim()) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = { label: msDlg.label.trim(), target_date: msDlg.date ? format(msDlg.date, "yyyy-MM-dd") : null, updated_at: new Date().toISOString() };
      if (msDlg.id) {
        const { error } = await supabase.from("objective_milestones").update(payload).eq("id", msDlg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("objective_milestones").insert({ ...payload, athlete_id: athleteId, coach_id: user?.id, completed: false, approval_status: "approved" });
        if (error) throw error;
      }
      setMsDlg(null); toast.success("Sous-objectif enregistré"); load();
    } catch (e) { console.error(e); toast.error("Enregistrement impossible"); }
    finally { setBusy(false); }
  };

  const confirmValidate = async () => {
    if (!validateDlg) return;
    setBusy(true);
    const now = new Date().toISOString();
    try {
      const payload: any = { completed: true, completed_at: now };
      if (validateDlg.comment.trim()) payload.notes = validateDlg.comment.trim();
      let { error } = await supabase.from("objective_milestones").update(payload).eq("id", validateDlg.m.id);
      if (error && validateDlg.comment.trim()) {
        const retry = await supabase.from("objective_milestones").update({ completed: true, completed_at: now }).eq("id", validateDlg.m.id);
        error = retry.error;
      }
      if (error) throw error;
      toast.success("Sous-objectif validé 🎉");
      setValidateDlg(null); load();
    } catch (e) { console.error(e); toast.error("Validation impossible"); }
    finally { setBusy(false); }
  };

  const unvalidateMs = async (m: Milestone) => {
    await supabase.from("objective_milestones").update({ completed: false, completed_at: null }).eq("id", m.id);
    load();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const table = confirmDelete.kind === "phase" ? "mesocycles" : "objective_milestones";
    await supabase.from(table).delete().eq("id", confirmDelete.id);
    setConfirmDelete(null); load();
  };

  // ── Objectif principal ─────────────────────────────────────────────────────
  const openEditObjective = () => setObjDlg({ name: obj.main_objective || "", deadline: obj.main_objective_deadline ? D(obj.main_objective_deadline) : null });
  const saveObjective = async () => {
    if (!objDlg) return;
    setBusy(true);
    try {
      const payload: any = { main_objective: objDlg.name.trim() || null, main_objective_deadline: objDlg.deadline ? format(objDlg.deadline, "yyyy-MM-dd") : null, updated_at: new Date().toISOString() };
      if (obj.id) await supabase.from("athlete_objectives").update(payload).eq("id", obj.id);
      else await supabase.from("athlete_objectives").insert({ ...payload, athlete_id: athleteId, main_completed: false });
      setObjDlg(null); toast.success("Objectif enregistré"); load();
    } catch (e) { console.error(e); toast.error("Enregistrement impossible"); }
    finally { setBusy(false); }
  };

  const validateMainObjective = async () => {
    if (!obj.main_objective) return;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("objective_milestones").insert({
        athlete_id: athleteId, coach_id: user?.id, label: obj.main_objective, is_objective: true,
        completed: true, completed_at: obj.main_completed ? (obj.main_completed_at || todayStr) : todayStr,
        target_date: obj.main_objective_deadline || todayStr, approval_status: "approved",
      });
      if (obj.id) await supabase.from("athlete_objectives").update({ main_objective: null, main_objective_deadline: null, main_completed: false, main_completed_at: null, updated_at: new Date().toISOString() }).eq("id", obj.id);
      toast.success("Objectif atteint 🏆 — rejoint le palmarès");
      load();
    } catch (e) { console.error(e); toast.error("Action impossible"); }
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>;

  const objWeeks = dl ? weeksUntil(dl) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* ── En-tête objectif ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] to-transparent p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/80">🎯 Objectif</p>
            {obj.main_objective ? (
              <h2 className="text-2xl font-black leading-tight mt-0.5" style={SORA}>{obj.main_objective}</h2>
            ) : (
              <h2 className="text-xl font-semibold text-muted-foreground italic mt-0.5">Aucun objectif défini</h2>
            )}
            {dl && (
              <p className="text-sm text-muted-foreground mt-1">
                Échéance : {format(dl, "d MMMM yyyy", { locale: fr })}
                {objWeeks != null && (
                  <span className={cn("ml-2 font-bold", objWeeks < 0 ? "text-red-400" : objWeeks <= 1 ? "text-orange-400" : "text-primary")}>
                    {objWeeks < 0 ? `dépassé de ${Math.abs(objWeeks)} sem.` : objWeeks === 0 ? "cette semaine" : `dans ${objWeeks} sem.`}
                  </span>
                )}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={openEditObjective}><Pencil className="h-4 w-4" /></Button>
        </div>
        {obj.main_objective && dl && (
          <Button onClick={validateMainObjective} className="mt-3 h-9 gap-1.5 bg-gradient-to-r from-amber-400 to-primary text-black font-bold">
            <Trophy className="h-4 w-4" /> Objectif atteint
          </Button>
        )}
      </div>

      {/* ── Actions ────────────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 gap-1.5" onClick={openNewPhase}><Layers className="h-4 w-4 text-primary" /> Ajouter une phase</Button>
        <Button variant="outline" className="flex-1 gap-1.5" onClick={openNewMs}><Flag className="h-4 w-4 text-primary" /> Ajouter un sous-objectif</Button>
      </div>

      {/* ── Frise verticale ────────────────────────────────────────────────── */}
      <div className="relative pl-6">
        <span className="absolute left-[9px] top-1 bottom-1 w-px bg-border" />
        {/* Aujourd'hui */}
        <div className="relative mb-3">
          <span className="absolute -left-[22px] top-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
          <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">Aujourd'hui · {format(today, "d MMM", { locale: fr })}</p>
        </div>

        {items.length === 0 && (
          <p className="text-sm text-muted-foreground py-3">Rien de programmé. Ajoute une phase ou un sous-objectif ci-dessus.</p>
        )}

        <div className="space-y-2.5">
          {items.map((it) => it.kind === "phase" ? (
            <PhaseRow key={it.id} p={it.p} status={phaseStatus(it.p)} onEdit={() => openEditPhase(it.p)} onDelete={() => setConfirmDelete({ kind: "phase", id: it.id, label: it.p.name })} />
          ) : (
            <MsRow key={it.id} m={it.m} onEdit={() => openEditMs(it.m)} onDelete={() => setConfirmDelete({ kind: "ms", id: it.id, label: it.m.label })}
              onValidate={() => setValidateDlg({ m: it.m, comment: "" })} onUnvalidate={() => unvalidateMs(it.m)} />
          ))}
        </div>

        {/* Nœud objectif final */}
        {obj.main_objective && (
          <div className="relative mt-3">
            <span className="absolute -left-[24px] top-0.5 h-4 w-4 rounded-full bg-primary ring-4 ring-primary/20 grid place-items-center text-[9px]">🎯</span>
            <p className="text-sm font-bold text-primary" style={SORA}>{obj.main_objective}</p>
            {dl && <p className="text-[11px] text-muted-foreground">{format(dl, "d MMMM yyyy", { locale: fr })}</p>}
          </div>
        )}
      </div>

      {/* ── Palmarès ───────────────────────────────────────────────────────── */}
      {palmares.length > 0 && (
        <div className="rounded-2xl border border-border/60 overflow-hidden">
          <button type="button" onClick={() => setShowPalmares((v) => !v)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold">
            <Trophy className="h-4 w-4 text-primary" /> Palmarès — objectifs validés ({palmares.length})
            <ChevronDown className={cn("h-4 w-4 ml-auto text-muted-foreground transition-transform", showPalmares && "rotate-180")} />
          </button>
          {showPalmares && (
            <div className="px-4 pb-4 space-y-2">
              {palmares.map((m) => (
                <div key={m.id} className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-3">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full grid place-items-center text-white shrink-0" style={{ background: m.is_objective ? "#e8c466" : "#10b981" }}>
                      {m.is_objective ? "🎯" : <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="font-semibold text-sm">{m.label}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{m.completed_at ? format(D(m.completed_at), "d MMM yyyy", { locale: fr }) : ""}</span>
                  </div>
                  {m.notes && <p className="text-[13px] italic text-foreground/80 border-l-2 border-primary/40 pl-2 mt-1.5">“{m.notes}”</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Dialogs ────────────────────────────────────────────────────────── */}
      <PhaseDialog state={phaseDlg} setState={setPhaseDlg} onSave={savePhase} busy={busy} />
      <MsDialog state={msDlg} setState={setMsDlg} onSave={saveMs} busy={busy} />
      <ObjectiveDialog state={objDlg} setState={setObjDlg} onSave={saveObjective} busy={busy} />

      {/* Validation festive d'un sous-objectif */}
      <Dialog open={!!validateDlg} onOpenChange={(o) => !o && setValidateDlg(null)}>
        <DialogContent className="max-w-sm">
          <div className="text-center">
            <div className="text-3xl">🏁</div>
            <DialogTitle className="text-xl font-black text-primary mt-1" style={SORA}>{validateDlg?.m.label}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">C'est validé ? Ajoute un mot si tu veux.</p>
          </div>
          <Textarea value={validateDlg?.comment || ""} onChange={(e) => setValidateDlg((s) => s && { ...s, comment: e.target.value })}
            placeholder="Chrono, ressenti, conditions… (optionnel)" className="min-h-[70px] resize-y text-sm mt-2" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidateDlg(null)}>Annuler</Button>
            <Button onClick={confirmValidate} disabled={busy} className="gap-1.5 bg-gradient-to-r from-amber-400 to-primary text-black font-bold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "🎉"} C'est validé !
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {confirmDelete?.label} » ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est définitive.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Lignes de frise ───────────────────────────────────────────────────────────
function PhaseRow({ p, status, onEdit, onDelete }: { p: Phase; status: "past" | "current" | "future"; onEdit: () => void; onDelete: () => void }) {
  const col = p.color || "#e8c466";
  const range = `${format(D(p.start_date), "d MMM", { locale: fr })}${p.end_date ? ` → ${format(D(p.end_date), "d MMM yyyy", { locale: fr })}` : " → en cours"}`;
  return (
    <div className="relative">
      <span className="absolute -left-[21px] top-3 h-3 w-3 rounded-full border-2 border-background" style={{ background: col }} />
      <div className={cn("rounded-xl border-l-4 border p-3", status === "current" ? "border-primary/40 bg-primary/[0.05]" : status === "past" ? "border-border/50 bg-muted/10 opacity-70" : "border-border/60 bg-card/40")} style={{ borderLeftColor: col }}>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase text-muted-foreground/60">Phase</span>
          {status === "current" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">EN COURS</span>}
          {status === "past" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">PASSÉ</span>}
          {status === "future" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground/70">À VENIR</span>}
          <span className="ml-auto flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          </span>
        </div>
        <p className={cn("font-semibold text-sm mt-0.5", status === "past" && "line-through text-muted-foreground")}>{p.name || "Phase"}</p>
        <p className="text-[11px] text-muted-foreground tabular-nums">{range}</p>
        {p.coach_note && <p className="text-xs text-muted-foreground italic mt-1">{p.coach_note}</p>}
      </div>
    </div>
  );
}

function MsRow({ m, onEdit, onDelete, onValidate, onUnvalidate }: { m: Milestone; onEdit: () => void; onDelete: () => void; onValidate: () => void; onUnvalidate: () => void }) {
  const d = m.target_date ? D(m.target_date) : null;
  const w = d && !m.completed ? weeksUntil(d) : null;
  const overdue = w != null && w < 0;
  return (
    <div className="relative">
      <span className={cn("absolute -left-[22px] top-3 h-3.5 w-3.5 rounded-full border-2 border-background", m.completed ? "bg-emerald-500" : overdue ? "bg-red-500" : "bg-primary")} />
      <div className={cn("rounded-xl border p-3", m.completed ? "border-emerald-500/30 bg-emerald-500/[0.05]" : overdue ? "border-red-500/30 bg-red-500/[0.05]" : "border-border/60 bg-card/40")}>
        <div className="flex items-center gap-2">
          <Flag className={cn("h-3.5 w-3.5", m.completed ? "text-emerald-500" : "text-primary")} />
          <span className="text-[9px] font-bold uppercase text-muted-foreground/60">Sous-objectif</span>
          {m.completed ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">VALIDÉ ✓</span>
            : overdue ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">À CONFIRMER</span>
            : w != null ? <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", w <= 1 ? "bg-orange-500/20 text-orange-400" : "bg-primary/10 text-primary")}>{w === 0 ? "CETTE SEM." : `DANS ${w} SEM.`}</span> : null}
          <span className="ml-auto flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          </span>
        </div>
        <p className={cn("font-semibold text-sm mt-0.5", m.completed && "text-emerald-600")}>{m.label}</p>
        {d && <p className="text-[11px] text-muted-foreground tabular-nums">{m.completed && m.completed_at ? `Validé le ${format(D(m.completed_at), "d MMM yyyy", { locale: fr })}` : format(d, "EEEE d MMMM yyyy", { locale: fr })}</p>}
        {m.notes && <p className="text-xs italic text-foreground/80 border-l-2 border-primary/40 pl-2 mt-1">“{m.notes}”</p>}
        <div className="mt-2">
          {m.completed ? (
            <button type="button" onClick={onUnvalidate} className="text-[11px] text-muted-foreground hover:text-foreground">Remettre à venir</button>
          ) : (
            <Button size="sm" className="h-8 gap-1.5" onClick={onValidate}><CheckCircle2 className="h-3.5 w-3.5" /> Valider</Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Petites fenêtres d'édition ─────────────────────────────────────────────────
function DatePicker({ value, onChange, placeholder }: { value: Date | null; onChange: (d: Date) => void; placeholder: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start h-10 font-normal">
          <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
          {value ? format(value, "d MMMM yyyy", { locale: fr }) : <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value || undefined} onSelect={(d) => d && onChange(d)} locale={fr} weekStartsOn={1} className="pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

function PhaseDialog({ state, setState, onSave, busy }: { state: any; setState: (s: any) => void; onSave: () => void; busy: boolean }) {
  if (!state) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && setState(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{state.id ? "Modifier la phase" : "Nouvelle phase"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Que faut-il travailler ?</label>
            <Input autoFocus value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} placeholder="Ex : Développement endurance · allure 10 km" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Début</label>
            <DatePicker value={state.start} onChange={(d) => setState({ ...state, start: d })} placeholder="Choisir une date" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground">Durée</label>
            {state.weeks ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setState({ ...state, weeks: Math.max(1, state.weeks - 1) })}>−</Button>
                <span className="w-16 text-center font-bold tabular-nums">{state.weeks} sem.</span>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setState({ ...state, weeks: state.weeks + 1 })}>+</Button>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setState({ ...state, weeks: null })}>Sans durée</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setState({ ...state, weeks: 4 })}>Définir une durée</Button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setState(null)}>Annuler</Button>
          <Button onClick={onSave} disabled={busy || !state.name.trim()} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MsDialog({ state, setState, onSave, busy }: { state: any; setState: (s: any) => void; onSave: () => void; busy: boolean }) {
  if (!state) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && setState(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{state.id ? "Modifier le sous-objectif" : "Nouveau sous-objectif"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sous-objectif</label>
            <Input autoFocus value={state.label} onChange={(e) => setState({ ...state, label: e.target.value })} placeholder="Ex : 14km trail · 10 km sous 52 min…" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Date cible</label>
            <DatePicker value={state.date} onChange={(d) => setState({ ...state, date: d })} placeholder="Choisir une date" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setState(null)}>Annuler</Button>
          <Button onClick={onSave} disabled={busy || !state.label.trim()} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ObjectiveDialog({ state, setState, onSave, busy }: { state: any; setState: (s: any) => void; onSave: () => void; busy: boolean }) {
  if (!state) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && setState(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Objectif principal</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Objectif</label>
            <Input autoFocus value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} placeholder="Ex : Finir le trek endurance" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Échéance</label>
            <DatePicker value={state.deadline} onChange={(d) => setState({ ...state, deadline: d })} placeholder="Choisir une date" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setState(null)}>Annuler</Button>
          <Button onClick={onSave} disabled={busy} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
