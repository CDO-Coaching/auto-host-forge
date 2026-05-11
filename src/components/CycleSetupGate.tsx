import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addWeeks, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { differenceInDays, differenceInWeeks } from "date-fns";
import {
  Layers, Layers2, CalendarIcon, ChevronRight,
  CheckCircle2, ArrowRight, SkipForward, Plus,
} from "lucide-react";
import { PHASE_TYPES, getPhase } from "@/components/CoachObjectivesView";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CycleSetupGateProps {
  athleteId: string;
  athleteName: string;
  onComplete: () => void;
  onNavigateToObjectives?: () => void;
}

type Step = "macro" | "meso" | "done";

interface SavedMeso {
  name: string;
  phase_type: string;
  color: string;
  start_date: string; // yyyy-MM-dd
  end_date: string;   // yyyy-MM-dd
}

// Macrocycle : juste un conteneur nommé, pas de phase
interface MacroFormData {
  name: string;
  sport: string;
  start_date: Date;
  weeks: number;
  objective: string;
}

// Mésocycle : la vraie phase avec volume/intensité
interface MesoFormData {
  name: string;
  phase_type: string;
  start_date: Date;
  weeks: number;
  volume_target: number;
  intensity_target: number;
  objective: string;
}

const defaultMacroForm = (defaultWeeks = 24): MacroFormData => ({
  name: "", sport: "", start_date: new Date(), weeks: defaultWeeks, objective: "",
});

const defaultMesoForm = (defaultPhase = "accumulation", defaultWeeks = 4): MesoFormData => {
  const phase = getPhase(defaultPhase);
  return {
    name: "", phase_type: defaultPhase,
    start_date: new Date(), weeks: defaultWeeks,
    volume_target: phase.defaultVolume, intensity_target: phase.defaultIntensity,
    objective: "",
  };
};

// ─── Sous-composants ──────────────────────────────────────────────────────────

function PhaseSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {PHASE_TYPES.filter((p) => p.value !== "custom").map((pt) => (
        <button
          key={pt.value}
          type="button"
          onClick={() => onChange(pt.value)}
          className={cn(
            "rounded-xl border-2 p-2.5 text-left transition-all space-y-0.5",
            value === pt.value ? "scale-[1.02]" : "border-border/40 hover:border-border opacity-60 hover:opacity-100"
          )}
          style={value === pt.value ? { borderColor: pt.color, backgroundColor: `${pt.color}12` } : {}}
        >
          <div className="text-sm">{pt.emoji}</div>
          <div className="font-semibold text-xs leading-tight" style={value === pt.value ? { color: pt.color } : {}}>
            {pt.label}
          </div>
          <div className="text-[10px] text-muted-foreground leading-tight hidden sm:block">
            {pt.description}
          </div>
        </button>
      ))}
    </div>
  );
}

function DotsRow({
  label, value, color, onChange,
}: { label: string; value: number; color: string; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1)}
            className="h-3.5 w-3.5 rounded-full transition-all hover:scale-125 cursor-pointer"
            style={{ backgroundColor: i < value ? color : "#e5e7eb" }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{value}/5</span>
    </div>
  );
}

// ─── Formulaire Macrocycle (conteneur simple, pas de phase) ──────────────────

function MacroForm({ form, onChange }: { form: MacroFormData; onChange: (f: MacroFormData) => void }) {
  const endDate = addDays(addWeeks(form.start_date, form.weeks), -1);
  const setWeeks = (w: number) => onChange({ ...form, weeks: Math.max(1, Math.min(104, w)) });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Nom du macrocycle *</Label>
        <Input
          placeholder="Ex : Saison 2026, Préparation Marathon, Hiver Musculation…"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">Le macrocycle est le conteneur global. Les phases (mésocycles) s'y imbriquent dedans.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Discipline (optionnel)</Label>
        <Input
          placeholder="Ex : Musculation, Course à pied, Natation…"
          value={form.sport}
          onChange={(e) => onChange({ ...form, sport: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Date de début</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal text-sm h-9">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(form.start_date, "d MMM yyyy", { locale: fr })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single" selected={form.start_date}
                onSelect={(d) => d && onChange({ ...form, start_date: d })}
                locale={fr} weekStartsOn={1} className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Durée (semaines)</Label>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setWeeks(form.weeks - 1)} disabled={form.weeks <= 1}>−</Button>
            <Input
              type="number" min={1} max={104} value={form.weeks}
              onChange={(e) => setWeeks(parseInt(e.target.value) || 1)}
              className="w-14 text-center h-9"
            />
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setWeeks(form.weeks + 1)}>+</Button>
          </div>
          <p className="text-xs text-muted-foreground">→ {format(endDate, "d MMM yyyy", { locale: fr })}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Objectif global (optionnel)</Label>
        <Textarea
          placeholder="Ex : Atteindre 100kg au squat, courir un marathon en moins de 4h…"
          value={form.objective}
          onChange={(e) => onChange({ ...form, objective: e.target.value })}
          rows={2}
          className="resize-none text-sm"
        />
      </div>
    </div>
  );
}

// ─── Formulaire Mésocycle (phase avec volume/intensité) ───────────────────────

function MesoForm({ form, onChange }: { form: MesoFormData; onChange: (f: MesoFormData) => void }) {
  const phase = getPhase(form.phase_type);
  const endDate = addDays(addWeeks(form.start_date, form.weeks), -1);
  const setWeeks = (w: number) => onChange({ ...form, weeks: Math.max(1, Math.min(52, w)) });
  const setPhase = (p: string) => {
    const ph = getPhase(p);
    onChange({ ...form, phase_type: p, volume_target: ph.defaultVolume, intensity_target: ph.defaultIntensity });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Type de phase</Label>
        <PhaseSelector value={form.phase_type} onChange={setPhase} />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Nom du mésocycle *</Label>
        <Input
          placeholder="Ex : Bloc Force, Accumulation S1, Préparation Générale…"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Date de début</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal text-sm h-9">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(form.start_date, "d MMM yyyy", { locale: fr })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single" selected={form.start_date}
                onSelect={(d) => d && onChange({ ...form, start_date: d })}
                locale={fr} weekStartsOn={1} className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Durée (semaines)</Label>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setWeeks(form.weeks - 1)} disabled={form.weeks <= 1}>−</Button>
            <Input
              type="number" min={1} max={52} value={form.weeks}
              onChange={(e) => setWeeks(parseInt(e.target.value) || 1)}
              className="w-14 text-center h-9"
            />
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setWeeks(form.weeks + 1)} disabled={form.weeks >= 52}>+</Button>
          </div>
          <p className="text-xs text-muted-foreground">→ {format(endDate, "d MMM yyyy", { locale: fr })}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-secondary/20 p-4 space-y-3">
        <Label className="text-sm font-semibold">Cibles de charge</Label>
        <DotsRow label="Volume" value={form.volume_target} color={phase.color} onChange={(v) => onChange({ ...form, volume_target: v })} />
        <DotsRow label="Intensité" value={form.intensity_target} color={phase.color} onChange={(v) => onChange({ ...form, intensity_target: v })} />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Objectif de la phase (optionnel)</Label>
        <Textarea
          placeholder="Ex : Construire une base de force, augmenter le volume de travail…"
          value={form.objective}
          onChange={(e) => onChange({ ...form, objective: e.target.value })}
          rows={2}
          className="resize-none text-sm"
        />
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function CycleSetupGate({
  athleteId, athleteName, onComplete, onNavigateToObjectives,
}: CycleSetupGateProps) {
  const [step, setStep] = useState<Step>("macro");
  const [macroForm, setMacroForm] = useState<MacroFormData>(defaultMacroForm(24));
  const [mesoForm, setMesoForm] = useState<MesoFormData>(defaultMesoForm("accumulation", 4));
  const [isSaving, setIsSaving] = useState(false);
  const [createdMacroId, setCreatedMacroId] = useState<string | null>(null);
  const [macroEndDate, setMacroEndDate] = useState<Date | null>(null);
  const [savedMesos, setSavedMesos] = useState<SavedMeso[]>([]);
  const [nextMesoStart, setNextMesoStart] = useState<Date>(new Date());
  const [mesoIndex, setMesoIndex] = useState(0); // 0 = premier (obligatoire)

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getRemainingWeeks = (from: Date, macroEnd: Date) => {
    const days = differenceInDays(macroEnd, from);
    return Math.max(0, Math.floor(days / 7));
  };

  const getRemainingDays = (from: Date, macroEnd: Date) =>
    Math.max(0, differenceInDays(macroEnd, from));

  // ── Sauvegarde macro ────────────────────────────────────────────────────────

  const saveMacro = async (): Promise<{ id: string; endDate: Date } | null> => {
    if (!macroForm.name.trim()) { toast.error("Donne un nom au macrocycle"); return null; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const endDate = addDays(addWeeks(macroForm.start_date, macroForm.weeks), -1);
    const { data, error } = await supabase.from("macrocycles").insert({
      athlete_id: athleteId, coach_id: user.id,
      name: macroForm.name,
      sport: macroForm.sport || null,
      color: "#6B7280",
      start_date: format(macroForm.start_date, "yyyy-MM-dd"),
      end_date: format(endDate, "yyyy-MM-dd"),
      objective: macroForm.objective || null,
      updated_at: new Date().toISOString(),
    }).select("id").single();
    if (error) { console.error(error); return null; }
    return { id: data?.id, endDate };
  };

  // ── Sauvegarde méso ─────────────────────────────────────────────────────────

  const saveMeso = async (macroId: string): Promise<SavedMeso | null> => {
    if (!mesoForm.name.trim()) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const phase = getPhase(mesoForm.phase_type);
    const endDate = addDays(addWeeks(mesoForm.start_date, mesoForm.weeks), -1);
    const { error } = await supabase.from("mesocycles").insert({
      athlete_id: athleteId, coach_id: user.id,
      name: mesoForm.name, phase_type: mesoForm.phase_type,
      color: phase.color, macrocycle_id: macroId,
      start_date: format(mesoForm.start_date, "yyyy-MM-dd"),
      end_date: format(endDate, "yyyy-MM-dd"),
      volume_target: mesoForm.volume_target, intensity_target: mesoForm.intensity_target,
      objective: mesoForm.objective || null,
      updated_at: new Date().toISOString(),
    });
    if (error) { console.error(error); return null; }
    return {
      name: mesoForm.name, phase_type: mesoForm.phase_type,
      color: phase.color,
      start_date: format(mesoForm.start_date, "yyyy-MM-dd"),
      end_date: format(endDate, "yyyy-MM-dd"),
    };
  };

  // ── Fin du wizard ───────────────────────────────────────────────────────────

  const finish = () => {
    setStep("done");
    setTimeout(() => onComplete(), 900);
  };

  // ── Étape macro → méso 1 ───────────────────────────────────────────────────

  const handleMacroNext = async () => {
    if (!macroForm.name.trim()) { toast.error("Donne un nom au macrocycle pour continuer"); return; }
    setIsSaving(true);
    try {
      const result = await saveMacro();
      if (!result) { toast.error("Erreur lors de la création du macrocycle"); return; }
      setCreatedMacroId(result.id);
      setMacroEndDate(result.endDate);
      // Pré-remplir le 1er méso : commence au début du macro, durée max 4 sem
      const remWeeks = getRemainingWeeks(macroForm.start_date, result.endDate);
      setNextMesoStart(macroForm.start_date);
      setMesoForm(defaultMesoForm("accumulation", Math.min(remWeeks, 4)));
      setMesoIndex(0);
      setStep("meso");
    } catch { toast.error("Erreur lors de la création"); }
    finally { setIsSaving(false); }
  };

  // ── Enregistrer méso et proposer le suivant ────────────────────────────────

  const handleMesoSave = async () => {
    if (!mesoForm.name.trim()) { toast.error("Donne un nom au mésocycle"); return; }
    if (!createdMacroId || !macroEndDate) return;
    setIsSaving(true);
    try {
      const saved = await saveMeso(createdMacroId);
      if (!saved) { toast.error("Erreur lors de la création du mésocycle"); return; }
      const newSaved = [...savedMesos, saved];
      setSavedMesos(newSaved);

      // Calculer la date de début du prochain méso
      const nextStart = addDays(new Date(saved.end_date), 1);
      const remDays = getRemainingDays(nextStart, macroEndDate);
      const remWeeks = Math.floor(remDays / 7);

      if (remWeeks < 1) {
        // Plus de place dans le macro → on termine
        finish();
      } else {
        // Proposer un nouveau méso
        setNextMesoStart(nextStart);
        setMesoIndex(mesoIndex + 1);
        setMesoForm(defaultMesoForm("accumulation", Math.min(remWeeks, 4)));
      }
    } catch { toast.error("Erreur lors de la création du mésocycle"); }
    finally { setIsSaving(false); }
  };

  // ── Passer ce méso (et tous les suivants) ──────────────────────────────────

  const handleSkipRest = () => finish();

  // ── Rendu ──────────────────────────────────────────────────────────────────

  const phase = getPhase(mesoForm.phase_type);

  // Barre de progression du macro (jours remplis / total)
  const macroTotalDays = macroEndDate
    ? differenceInDays(macroEndDate, macroForm.start_date) + 1
    : 1;

  const filledDays = savedMesos.reduce((acc, m) => {
    return acc + differenceInDays(new Date(m.end_date), new Date(m.start_date)) + 1;
  }, 0);

  const currentMesoPreviewDays = step === "meso"
    ? differenceInDays(addDays(addWeeks(mesoForm.start_date, mesoForm.weeks), -1), mesoForm.start_date) + 1
    : 0;

  const remainingWeeksLabel = macroEndDate
    ? getRemainingWeeks(nextMesoStart, macroEndDate)
    : 0;

  return (
    <Dialog open modal>
      <DialogContent
        className="max-w-2xl w-[95vw] max-h-[90dvh] flex flex-col p-0 gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader className="px-6 py-5 border-b border-border/40 shrink-0">
          {step === "done" ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 animate-in fade-in duration-300">
              <CheckCircle2 className="h-14 w-14 text-emerald-500" />
              <DialogTitle className="text-emerald-600 text-center">
                Cycles créés — programmation débloquée !
              </DialogTitle>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Fil d'étapes */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn("flex items-center gap-1", step === "macro" ? "text-primary font-semibold" : "opacity-50")}>
                  <Layers className="h-3.5 w-3.5" /> Macrocycle
                </span>
                <ChevronRight className="h-3.5 w-3.5 opacity-40" />
                <span className={cn("flex items-center gap-1", step === "meso" ? "text-primary font-semibold" : "opacity-50")}>
                  <Layers2 className="h-3.5 w-3.5" />
                  {mesoIndex === 0 ? "1ère phase" : `Phase ${mesoIndex + 1}`}
                </span>
              </div>

              <div>
                <DialogTitle className="text-base font-semibold">
                  {step === "macro"
                    ? `Définis le macrocycle de ${athleteName}`
                    : mesoIndex === 0
                      ? `1ère phase — obligatoire`
                      : `Phase ${mesoIndex + 1} (optionnelle)`}
                </DialogTitle>
                <DialogDescription className="mt-0.5">
                  {step === "macro"
                    ? "Aucun cycle actif n'est planifié. Crée un macrocycle (la grande période) avant de programmer."
                    : mesoIndex === 0
                      ? "Définis la première phase de travail à l'intérieur du macrocycle."
                      : `Il reste ${remainingWeeksLabel} semaine${remainingWeeksLabel > 1 ? "s" : ""} dans le macrocycle. Ajoute une phase ou termine.`}
                </DialogDescription>
              </div>

              {/* Barre de progression du macro */}
              {step === "meso" && macroEndDate && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{format(macroForm.start_date, "d MMM yyyy", { locale: fr })}</span>
                    <span>{format(macroEndDate, "d MMM yyyy", { locale: fr })}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                    {/* Mésocycles déjà enregistrés */}
                    {savedMesos.map((m, i) => {
                      const mDays = differenceInDays(new Date(m.end_date), new Date(m.start_date)) + 1;
                      const pct = (mDays / macroTotalDays) * 100;
                      return (
                        <div
                          key={i}
                          className="h-full shrink-0"
                          style={{ width: `${pct}%`, backgroundColor: m.color }}
                          title={m.name}
                        />
                      );
                    })}
                    {/* Preview du méso en cours */}
                    {currentMesoPreviewDays > 0 && (
                      <div
                        className="h-full shrink-0 opacity-50"
                        style={{
                          width: `${Math.min((currentMesoPreviewDays / macroTotalDays) * 100, 100 - (filledDays / macroTotalDays) * 100)}%`,
                          backgroundColor: phase.color,
                        }}
                      />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground text-right">
                    {savedMesos.length} phase{savedMesos.length > 1 ? "s" : ""} planifiée{savedMesos.length > 1 ? "s" : ""}
                    {" · "}
                    {remainingWeeksLabel} sem. restantes
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Formulaire scrollable */}
        {step !== "done" && (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {step === "macro" ? (
              <MacroForm form={macroForm} onChange={setMacroForm} />
            ) : (
              <MesoForm form={mesoForm} onChange={(f) => {
                // Clamp la durée pour ne pas dépasser la fin du macro
                if (macroEndDate) {
                  const maxWeeks = getRemainingWeeks(f.start_date, macroEndDate);
                  if (f.weeks > maxWeeks && maxWeeks > 0) f = { ...f, weeks: maxWeeks };
                }
                setMesoForm(f);
              }} />
            )}
          </div>
        )}

        {/* Footer */}
        {step !== "done" && (
          <div className="px-6 py-4 border-t border-border/40 bg-card/50 flex items-center justify-between gap-3 flex-wrap shrink-0">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Passer (seulement à partir du 2e méso) */}
              {step === "meso" && mesoIndex > 0 && (
                <button
                  type="button"
                  onClick={handleSkipRest}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  Terminer sans ajouter
                </button>
              )}
              {onNavigateToObjectives && (
                <button
                  type="button"
                  onClick={onNavigateToObjectives}
                  className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  Gérer dans Objectifs →
                </button>
              )}
            </div>

            <Button
              onClick={step === "macro" ? handleMacroNext : handleMesoSave}
              disabled={isSaving || (step === "macro" && !macroForm.name.trim()) || (step === "meso" && !mesoForm.name.trim())}
              className="gap-2"
              style={step === "meso" ? { backgroundColor: phase.color, borderColor: phase.color } : {}}
            >
              {isSaving ? "Enregistrement…" : step === "macro" ? (
                <><ArrowRight className="h-4 w-4" /> Créer et définir les phases</>
              ) : macroEndDate && getRemainingWeeks(addDays(addWeeks(mesoForm.start_date, mesoForm.weeks), 0), macroEndDate) < 1 ? (
                <><CheckCircle2 className="h-4 w-4" /> Créer et programmer</>
              ) : (
                <><Plus className="h-4 w-4" /> Ajouter cette phase</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
