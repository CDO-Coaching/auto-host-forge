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
import {
  Layers, Layers2, CalendarIcon, ChevronRight,
  CheckCircle2, ArrowRight, SkipForward,
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

  const saveMacro = async (): Promise<string | null> => {
    if (!macroForm.name.trim()) { toast.error("Donne un nom au macrocycle"); return null; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const endDate = addDays(addWeeks(macroForm.start_date, macroForm.weeks), -1);
    const { data, error } = await supabase.from("macrocycles").insert({
      athlete_id: athleteId, coach_id: user.id,
      name: macroForm.name,
      sport: macroForm.sport || null,
      color: "#6B7280", // couleur neutre — le macro n'a pas de phase
      start_date: format(macroForm.start_date, "yyyy-MM-dd"),
      end_date: format(endDate, "yyyy-MM-dd"),
      objective: macroForm.objective || null,
      updated_at: new Date().toISOString(),
    }).select("id").single();
    if (error) { console.error(error); return null; }
    return data?.id ?? null;
  };

  const saveMeso = async (macroId: string | null) => {
    if (!mesoForm.name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const phase = getPhase(mesoForm.phase_type);
    const endDate = addDays(addWeeks(mesoForm.start_date, mesoForm.weeks), -1);
    await supabase.from("mesocycles").insert({
      athlete_id: athleteId, coach_id: user.id,
      name: mesoForm.name, phase_type: mesoForm.phase_type,
      color: phase.color, macrocycle_id: macroId,
      start_date: format(mesoForm.start_date, "yyyy-MM-dd"),
      end_date: format(endDate, "yyyy-MM-dd"),
      volume_target: mesoForm.volume_target, intensity_target: mesoForm.intensity_target,
      objective: mesoForm.objective || null,
      updated_at: new Date().toISOString(),
    });
  };

  const handleNextStep = async () => {
    if (step === "macro") {
      if (!macroForm.name.trim()) { toast.error("Donne un nom au macrocycle pour continuer"); return; }
      setIsSaving(true);
      try {
        const id = await saveMacro();
        if (!id) { toast.error("Erreur lors de la création du macrocycle"); return; }
        setCreatedMacroId(id);
        // Pré-remplir le mésocycle avec les mêmes dates que le macro
        setMesoForm(defaultMesoForm("accumulation", Math.min(macroForm.weeks, 4)));
        setStep("meso");
      } catch { toast.error("Erreur lors de la création"); }
      finally { setIsSaving(false); }
    } else if (step === "meso") {
      setIsSaving(true);
      try {
        if (mesoForm.name.trim()) await saveMeso(createdMacroId);
        setStep("done");
        setTimeout(() => onComplete(), 800);
      } catch { toast.error("Erreur lors de la création du mésocycle"); }
      finally { setIsSaving(false); }
    }
  };

  const handleSkipMeso = async () => {
    setStep("done");
    setTimeout(() => onComplete(), 800);
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────

  const stepIndex = step === "macro" ? 0 : 1;
  // Le macro n'a pas de phase → on utilise la phase du méso pour la couleur des dots
  const phase = getPhase(mesoForm.phase_type);

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
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                {/* Fil d'étapes */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span className={cn("flex items-center gap-1", stepIndex === 0 ? "text-primary font-semibold" : "opacity-50")}>
                    <Layers className="h-3.5 w-3.5" /> Macrocycle
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 opacity-40" />
                  <span className={cn("flex items-center gap-1", stepIndex === 1 ? "text-primary font-semibold" : "opacity-50")}>
                    <Layers2 className="h-3.5 w-3.5" /> Mésocycle
                  </span>
                </div>
                <DialogTitle className="text-base font-semibold">
                  {step === "macro"
                    ? `Définis le macrocycle de ${athleteName}`
                    : `Définis le mésocycle de ${athleteName}`}
                </DialogTitle>
                <DialogDescription>
                  {step === "macro"
                    ? "Aucun cycle actif n'est planifié pour cette période. Crée un macrocycle avant de programmer les séances."
                    : "Ajoute un mésocycle pour affiner la programmation à l'intérieur du macrocycle."}
                </DialogDescription>
              </div>
              {/* Progress dots */}
              <div className="flex gap-2 shrink-0 pt-1">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="h-2 w-2 rounded-full transition-all duration-300"
                    style={{ backgroundColor: i <= stepIndex ? phase.color : "#e5e7eb" }}
                  />
                ))}
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Formulaire scrollable */}
        {step !== "done" && (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {step === "macro" ? (
              <MacroForm form={macroForm} onChange={setMacroForm} />
            ) : (
              <MesoForm form={mesoForm} onChange={setMesoForm} />
            )}
          </div>
        )}

        {/* Footer */}
        {step !== "done" && (
          <div className="px-6 py-4 border-t border-border/40 bg-card/50 flex items-center justify-between gap-3 flex-wrap shrink-0">
            <div className="flex items-center gap-3">
              {step === "meso" && (
                <button
                  type="button"
                  onClick={handleSkipMeso}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  Passer le mésocycle
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
              onClick={handleNextStep}
              disabled={isSaving || (step === "macro" && !macroForm.name.trim())}
              className="gap-2"
              style={{ backgroundColor: phase.color, borderColor: phase.color }}
            >
              {isSaving ? (
                "Enregistrement…"
              ) : step === "macro" ? (
                <><ArrowRight className="h-4 w-4" /> Créer et continuer</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Créer et programmer</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
