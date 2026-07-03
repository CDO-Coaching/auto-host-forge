import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { AthleteCard } from "@/components/AthleteCard";
import { computeProfile, type RawMeasures, type ProfileResult } from "@/lib/profileEngine";
import { collectAutoMeasures } from "@/lib/profileCollectors";
import { type Distance, type Ambition, RECOMMENDATIONS } from "@/lib/profileReferentials";
import { RotateCcw, Loader2 } from "lucide-react";

type TestType = "t12" | "t30" | "drift" | "fade";
interface TestEntry { value: number; date: string }

const TEST_LABELS: Record<TestType, string> = {
  t12: "Test 12 minutes",
  t30: "Test 30 minutes",
  drift: "Dérive cardiaque",
  fade: "Perte d'allure",
};

/** Une étape de l'assistant — un test par sortie. */
type WizardStep = { kind: TestType };

const STEP_TITLES: Record<TestType, string> = {
  t12: "Test 12 minutes",
  t30: "Test 30 minutes",
  drift: "Dérive cardiaque (sortie à allure fixe)",
  fade: "Perte d'allure (sortie longue à sensation)",
};

export type ExperienceLevel = "debutant" | "novice" | "amateur" | "experimente" | "semipro" | "pro";

export const LEVEL_LABELS: Record<ExperienceLevel, string> = {
  debutant: "Débutant",
  novice: "Novice",
  amateur: "Amateur",
  experimente: "Expérimenté",
  semipro: "Semi-pro",
  pro: "Pro",
};

/** Paramètres de protocole par niveau : échauffement, durées des sorties test, conseils. */
const LEVEL_PARAMS: Record<ExperienceLevel, { warmup: string; driftDuration: string; longDuration: string; t12Advice: string; t30Advice: string }> = {
  debutant: {
    warmup: "10 min de marche rapide puis footing très léger",
    driftDuration: "40 à 45 min",
    longDuration: "40 à 50 min",
    t12Advice: "Pars prudemment : mieux vaut accélérer sur la fin que d'exploser à mi-test. De courtes portions de marche sont tolérées si nécessaire, l'important est de donner le maximum sur l'ensemble des 12 min.",
    t30Advice: "Si tenir 30 min à allure soutenue est encore trop dur, repousse ce test de quelques semaines : la carte se génère aussi sans lui.",
  },
  novice: {
    warmup: "10-15 min de footing léger",
    driftDuration: "45 à 50 min",
    longDuration: "50 min à 1h",
    t12Advice: "Pars légèrement en retenue sur les 3 premières minutes, puis stabilise à l'allure la plus rapide tenable. Termine vidé mais sans marcher.",
    t30Advice: "Vise une allure « confortablement dure » et constante : c'est la régularité qui compte, pas l'exploit sur les 5 premières minutes.",
  },
  amateur: {
    warmup: "15 min de footing progressif + quelques accélérations",
    driftDuration: "50 min à 1h",
    longDuration: "1h à 1h15",
    t12Advice: "Effort maximal réparti : les 2 premières minutes légèrement en dessous, puis à fond jusqu'au bout.",
    t30Advice: "Allure proche du seuil, la plus constante possible du début à la fin. Un négative split léger (2e moitié un peu plus rapide) est le signe d'un test réussi.",
  },
  experimente: {
    warmup: "15-20 min de footing progressif + gammes + 3-4 accélérations",
    driftDuration: "1h",
    longDuration: "1h15 à 1h30",
    t12Advice: "Test à fond, géré comme une course : cadence haute, relâchement, dernière minute au sprint long.",
    t30Advice: "Allure seuil précise et régulière (écart max ±5 s/km entre les km). Idéalement sur piste ou parcours plat mesuré.",
  },
  semipro: {
    warmup: "20 min de footing progressif + gammes complètes + lignes à allure de test",
    driftDuration: "1h à 1h15",
    longDuration: "1h30 à 1h45",
    t12Advice: "Protocole strict : conditions calmes, parcours plat ou piste, départ à l'allure cible calculée depuis la VMA estimée, finish maximal.",
    t30Advice: "Test de référence à traiter comme une compétition : parcours étalonné, allure au 100 m près, ravitaillement liquide si chaleur.",
  },
  pro: {
    warmup: "20-25 min de footing progressif + gammes complètes + lignes à allure de test",
    driftDuration: "1h15 à 1h30",
    longDuration: "1h45 à 2h",
    t12Advice: "Conditions standardisées (piste, même horaire, même matériel qu'aux tests précédents) pour une comparabilité maximale entre les blocs.",
    t30Advice: "Conditions standardisées et reproductibles ; croiser avec la puissance/FC pour vérifier la fraîcheur le jour du test.",
  },
};

/** Formate une vitesse km/h en allure "m:ss /km". */
function paceFromKmh(kmh: number): string {
  const secPerKm = Math.round(3600 / kmh);
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, "0")}`;
}

function stepHelp(kind: TestType, level: ExperienceLevel, vma: number | null): string {
  const p = LEVEL_PARAMS[level];
  switch (kind) {
    case "t12":
      return `Effort : maximal — l'allure la plus rapide tenable sur toute la durée, comme une course. Échauffement : ${p.warmup}. Durée : 12 min chrono, sans pause. ${p.t12Advice} Note la distance totale parcourue (mètres) à la fin des 12 min.`;
    case "t30":
      return `Effort : quasi-maximal mais régulier, l'allure la plus rapide tenable sans à-coups pendant 30 min entières (proche du seuil, pas un sprint). Échauffement : ${p.warmup}. Durée : 30 min chrono, sans pause. ${p.t30Advice} Note la distance totale parcourue (mètres) à la fin des 30 min.`;
    case "drift": {
      const cible = vma
        ? `Allure cible : ${paceFromKmh(vma * 0.65)} à ${paceFromKmh(vma * 0.60)} /km (60-65 % de sa VMA de ${vma} km/h)`
        : "Allure cible : endurance fondamentale, 60-65 % de la VMA (l'athlète doit pouvoir tenir une conversation)";
      return `Sortie à ALLURE FIXE : les 10 premières minutes, l'athlète se cale à une allure très à l'aise (conversation possible), puis il verrouille cette allure sur la montre et la tient jusqu'au bout — c'est la FC qui doit bouger, pas l'allure. ${cible}. Durée : ${p.driftDuration} en continu, parcours plat. Après la séance, relève sur Strava/Garmin la FC moyenne de la 1re et de la 2e moitié : la dérive est calculée automatiquement.`;
    }
    case "fade": {
      const repere = vma
        ? ` Repère de départ : environ ${paceFromKmh(vma * 0.70)} à ${paceFromKmh(vma * 0.65)} /km (65-70 % de sa VMA de ${vma} km/h), puis il laisse faire les sensations.`
        : " Repère de départ : environ 65-70 % de la VMA, puis il laisse faire les sensations.";
      return `Sortie longue à SENSATION : allure libre et naturelle, l'athlète garde le même ressenti d'effort du début à la fin, sans regarder sa montre ni forcer pour tenir un chrono. S'il ralentit, c'est justement ce qu'on veut mesurer.${repere} Durée : ${p.longDuration} en continu, parcours plat de préférence. Après la séance, relève sur Strava/Garmin l'allure moyenne (min:sec/km) de la 1re et de la 2e moitié : la perte d'allure est calculée automatiquement.`;
    }
  }
}

/** Parse une allure "mm:ss" (ou "m:ss") en secondes par km. Renvoie null si invalide. */
function parseAllure(v: string): number | null {
  const m = v.trim().match(/^(\d+):([0-5]?\d)$/);
  if (!m) return null;
  const min = parseInt(m[1], 10);
  const sec = parseInt(m[2], 10);
  const total = min * 60 + sec;
  return total > 0 ? total : null;
}

function pctFrom(a: number, b: number): number {
  return Math.round(((b - a) / a) * 100 * 100) / 100;
}

export function AthleteProfileTab({ athleteId, athleteName, athleteVma }: { athleteId: string; athleteName: string; athleteVma: number | null }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tests, setTests] = useState<Partial<Record<TestType, TestEntry>>>({});
  const [objective, setObjective] = useState<{ id: string; distance: Distance; ambition: Ambition } | null>(null);
  const [snapshot, setSnapshot] = useState<ProfileResult | null>(null);
  const [wizardMode, setWizardMode] = useState(false);
  const [wizardSteps, setWizardSteps] = useState<WizardStep[]>([]);
  const [isRedo, setIsRedo] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [fcMoy1, setFcMoy1] = useState("");
  const [fcMoy2, setFcMoy2] = useState("");
  const [allure1, setAllure1] = useState("");
  const [allure2, setAllure2] = useState("");
  const [level, setLevel] = useState<ExperienceLevel>("amateur");
  const [objDistance, setObjDistance] = useState<Distance>("10k");
  const [objAmbition, setObjAmbition] = useState<Ambition>("progression");
  const [targetDate, setTargetDate] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: testRows }, { data: obj }, { data: snap }, { data: prof }] = await Promise.all([
        supabase.from("profile_tests").select("test_type, value, test_date").eq("athlete_id", athleteId).order("test_date", { ascending: false }),
        supabase.from("athlete_objectives").select("id, distance, ambition").eq("athlete_id", athleteId).eq("is_active", true).limit(1).maybeSingle(),
        supabase.from("profile_snapshots").select("*").eq("athlete_id", athleteId).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("user_profiles").select("experience_level").eq("id", athleteId).maybeSingle(),
      ]);
      if ((prof as any)?.experience_level) setLevel((prof as any).experience_level as ExperienceLevel);

      const latestByType: Partial<Record<TestType, TestEntry>> = {};
      for (const r of (testRows || []) as any[]) {
        if (latestByType[r.test_type as TestType] == null) {
          latestByType[r.test_type as TestType] = { value: Number(r.value), date: r.test_date };
        }
      }
      setTests(latestByType);
      setObjective((obj as any) || null);

      if (snap) {
        setSnapshot({
          overall: (snap as any).overall_score,
          scores: (snap as any).scores,
          measures: {},
          strengths: (snap as any).strengths || [],
          weaknesses: (snap as any).weaknesses || [],
          recommendation: (snap as any).recommendation,
          dataQuality: (snap as any).data_quality || {},
        });
      } else {
        setSnapshot(null);
      }
    } catch (e: any) {
      toast.error(`Erreur chargement profil : ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [athleteId]);

  const buildMissingSteps = (t: Partial<Record<TestType, TestEntry>>): WizardStep[] => {
    const steps: WizardStep[] = [];
    if (t.t12 == null) steps.push({ kind: "t12" });
    if (t.t30 == null) steps.push({ kind: "t30" });
    if (t.drift == null) steps.push({ kind: "drift" });
    if (t.fade == null) steps.push({ kind: "fade" });
    return steps;
  };

  const changeLevel = async (l: ExperienceLevel) => {
    const prev = level;
    setLevel(l);
    const { error } = await supabase.rpc("set_athlete_experience_level" as any, {
      p_athlete_id: athleteId, p_level: l,
    } as any);
    if (error) {
      setLevel(prev);
      toast.error(`Erreur : ${error.message}`);
    }
  };

  const resetInputs = () => {
    setInputValue("");
    setFcMoy1("");
    setFcMoy2("");
    setAllure1("");
    setAllure2("");
  };

  const startWizard = () => {
    setWizardSteps(buildMissingSteps(tests));
    setIsRedo(false);
    setWizardMode(true);
    setStepIndex(0);
    resetInputs();
    if (objective) { setObjDistance(objective.distance); setObjAmbition(objective.ambition); }
  };

  /** Refaire un test précis depuis la carte : une seule étape, puis recalcul auto. */
  const startRedo = (type: TestType) => {
    setWizardSteps([{ kind: type }]);
    setIsRedo(true);
    setWizardMode(true);
    setStepIndex(0);
    resetInputs();
  };

  /** Calcule le profil et enregistre un snapshot avec l'objectif donné. */
  const computeAndSnapshot = async (
    objId: string, distance: Distance, ambition: Ambition,
    t: Partial<Record<TestType, TestEntry>>,
  ) => {
    const auto = await collectAutoMeasures(athleteId);
    // VMA absente du profil → estimée depuis le test 12 min (distance/200, demi-Cooper)
    const vmaEstimee = t.t12 ? Math.round((t.t12.value / 200) * 10) / 10 : undefined;
    const measures: RawMeasures = {
      vma: athleteVma || vmaEstimee,
      paceT12: t.t12 ? (t.t12.value / 1000) / (12 / 60) : undefined,
      paceT30: t.t30 ? (t.t30.value / 1000) / (30 / 60) : undefined,
      cardiacDrift: t.drift?.value,
      paceFadeLongRun: t.fade?.value,
      rpeGap: auto.rpeGap,
      adherence: auto.adherence,
    };
    const result = computeProfile(measures, distance, ambition);

    const { error: snapErr } = await supabase.from("profile_snapshots").insert({
      athlete_id: athleteId, objective_id: objId,
      overall_score: result.overall, scores: result.scores, raw_measures: measures as any,
      strengths: result.strengths, weaknesses: result.weaknesses,
      recommendation: result.recommendation, data_quality: result.dataQuality,
    } as any);
    if (snapErr) throw snapErr;
    setSnapshot(result);
  };

  const saveCurrentStep = async () => {
    const step = wizardSteps[stepIndex];
    if (!step) return;

    const today = format(new Date(), "yyyy-MM-dd");
    const rows: { test_type: TestType; value: number }[] = [];

    if (step.kind === "t12" || step.kind === "t30") {
      const val = parseFloat(inputValue);
      if (isNaN(val) || val <= 0) {
        toast.error("Entre une valeur valide");
        return;
      }
      rows.push({ test_type: step.kind, value: val });
    } else if (step.kind === "drift") {
      const f1 = parseFloat(fcMoy1);
      const f2 = parseFloat(fcMoy2);
      if (isNaN(f1) || isNaN(f2) || f1 <= 0) {
        toast.error("Entre les deux FC moyennes");
        return;
      }
      rows.push({ test_type: "drift", value: pctFrom(f1, f2) });
    } else {
      const s1 = parseAllure(allure1);
      const s2 = parseAllure(allure2);
      if (s1 == null || s2 == null) {
        toast.error("Entre les deux allures au format mm:ss");
        return;
      }
      rows.push({ test_type: "fade", value: pctFrom(s1, s2) });
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("profile_tests").insert(
        rows.map((r) => ({ athlete_id: athleteId, test_type: r.test_type, value: r.value })) as any
      );
      if (error) throw error;

      const updated = { ...tests };
      for (const r of rows) updated[r.test_type] = { value: r.value, date: today };
      setTests(updated);
      resetInputs();

      const isLast = stepIndex + 1 >= wizardSteps.length;
      if (isLast && isRedo && objective) {
        // Refaire un test : recalcul immédiat avec l'objectif en cours
        await computeAndSnapshot(objective.id, objective.distance, objective.ambition, updated);
        setWizardMode(false);
        toast.success("Test mis à jour, carte recalculée !");
      } else {
        setStepIndex((i) => i + 1);
      }
    } catch (e: any) {
      toast.error(`Erreur : ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const finalizeObjectiveAndCompute = async () => {
    setSaving(true);
    try {
      // désactive l'ancien objectif, en crée un nouveau
      await supabase.from("athlete_objectives").update({ is_active: false }).eq("athlete_id", athleteId).eq("is_active", true);
      const { data: newObj, error: objErr } = await supabase.from("athlete_objectives").insert({
        athlete_id: athleteId, distance: objDistance, ambition: objAmbition,
        target_race_date: targetDate || null, is_active: true,
      } as any).select("id, distance, ambition").single();
      if (objErr) throw objErr;

      await computeAndSnapshot((newObj as any).id, objDistance, objAmbition, tests);
      setObjective(newObj as any);
      setWizardMode(false);
      toast.success("Carte coureur générée !");
    } catch (e: any) {
      toast.error(`Erreur : ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground py-10 text-center">Chargement…</p>;

  const levelSelect = (
    <div className="space-y-1">
      <Label>Niveau de l'athlète</Label>
      <Select value={level} onValueChange={(v) => changeLevel(v as ExperienceLevel)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(LEVEL_LABELS) as ExperienceLevel[]).map((l) => (
            <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // ── Assistant : étape de test ──
  if (wizardMode && stepIndex < wizardSteps.length) {
    const step = wizardSteps[stepIndex];
    const t12EstimeDepuisVma = step.kind === "t12" && athleteVma ? Math.round(athleteVma * 200) : null;
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-base">
            Test {stepIndex + 1}/{wizardSteps.length} — {STEP_TITLES[step.kind]}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {levelSelect}
          <p className="text-sm text-muted-foreground">{stepHelp(step.kind, level, athleteVma)}</p>

          {step.kind === "drift" ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="fc-moy-1">FC moyenne — 1re moitié (bpm)</Label>
                <Input id="fc-moy-1" type="number" value={fcMoy1} onChange={(e) => setFcMoy1(e.target.value)} placeholder="Ex: 142" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fc-moy-2">FC moyenne — 2e moitié (bpm)</Label>
                <Input id="fc-moy-2" type="number" value={fcMoy2} onChange={(e) => setFcMoy2(e.target.value)} placeholder="Ex: 149" />
              </div>
              {!isNaN(parseFloat(fcMoy1)) && !isNaN(parseFloat(fcMoy2)) && parseFloat(fcMoy1) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Dérive cardiaque calculée : {pctFrom(parseFloat(fcMoy1), parseFloat(fcMoy2))}%
                </p>
              )}
            </div>
          ) : step.kind === "fade" ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="allure-1">Allure — 1re moitié (min:sec / km)</Label>
                <Input id="allure-1" value={allure1} onChange={(e) => setAllure1(e.target.value)} placeholder="Ex: 5:13" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="allure-2">Allure — 2e moitié (min:sec / km)</Label>
                <Input id="allure-2" value={allure2} onChange={(e) => setAllure2(e.target.value)} placeholder="Ex: 5:30" />
              </div>
              {parseAllure(allure1) != null && parseAllure(allure2) != null && (
                <p className="text-xs text-muted-foreground">
                  Perte d'allure calculée : {pctFrom(parseAllure(allure1)!, parseAllure(allure2)!)}%
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="test-value">Distance (m)</Label>
                <Input id="test-value" type="number" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder={`Ex: ${step.kind === "t12" ? "2800" : "6500"}`} />
              </div>
              {t12EstimeDepuisVma != null && (
                <Button type="button" variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => setInputValue(String(t12EstimeDepuisVma))}>
                  Estimer depuis la VMA du profil ({athleteVma} km/h ≈ {t12EstimeDepuisVma} m)
                </Button>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setWizardMode(false)} disabled={saving} className="flex-1">Annuler</Button>
            <Button onClick={saveCurrentStep} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (isRedo && stepIndex + 1 >= wizardSteps.length ? "Valider et recalculer" : "Suivant")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Assistant : objectif ──
  if (wizardMode && stepIndex >= wizardSteps.length) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-base">Objectif de l'athlète</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Distance</Label>
            <Select value={objDistance} onValueChange={(v) => setObjDistance(v as Distance)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="5k">5 km</SelectItem>
                <SelectItem value="10k">10 km</SelectItem>
                <SelectItem value="half">Semi</SelectItem>
                <SelectItem value="marathon">Marathon</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Ambition</Label>
            <Select value={objAmbition} onValueChange={(v) => setObjAmbition(v as Ambition)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="finisher">🎯 Finisher</SelectItem>
                <SelectItem value="progression">📈 Progression</SelectItem>
                <SelectItem value="perf">🏁 Perf (chrono cible)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="target-date">Date de course cible (optionnel)</Label>
            <Input id="target-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setWizardMode(false)} disabled={saving} className="flex-1">Annuler</Button>
            <Button onClick={finalizeObjectiveAndCompute} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Générer la carte"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Aucune carte encore : proposer de commencer ──
  if (!snapshot) {
    const missing = buildMissingSteps(tests);
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader><CardTitle className="text-base">Carte coureur</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {missing.length > 0
              ? `${missing.length} test(s) à renseigner avant de générer la carte.`
              : "Tous les tests sont renseignés — il ne reste plus qu'à définir l'objectif."}
          </p>
          {levelSelect}
          <p className="text-xs text-muted-foreground">Les consignes des tests s'adaptent au niveau choisi.</p>
          <Button onClick={startWizard} className="w-full">Commencer</Button>
        </CardContent>
      </Card>
    );
  }

  // ── Carte affichée ──
  return (
    <div className="space-y-4">
      <AthleteCard
        athleteName={athleteName}
        overall={snapshot.overall}
        distance={objective?.distance || "10k"}
        ambition={objective?.ambition || "progression"}
        scores={snapshot.scores}
        strengths={snapshot.strengths}
        weaknesses={snapshot.weaknesses}
        recommendation={snapshot.recommendation}
        dataQuality={snapshot.dataQuality}
      />

      <Card className="max-w-sm mx-auto">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Priorité d'entraînement — détail</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {snapshot.weaknesses.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun point faible marqué — profil équilibré.</p>
          ) : (
            snapshot.weaknesses.map((s) => (
              <div key={s} className="text-xs">
                <p className="font-medium text-foreground">{RECOMMENDATIONS[s].short}</p>
                <p className="text-muted-foreground">{RECOMMENDATIONS[s].detail}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="max-w-sm mx-auto">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Tests</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {levelSelect}
          {(Object.keys(TEST_LABELS) as TestType[]).map((type) => {
            const entry = tests[type];
            return (
              <div key={type} className="flex items-center justify-between text-xs">
                <div>
                  <p className="font-medium text-foreground">{TEST_LABELS[type]}</p>
                  <p className="text-muted-foreground">
                    {entry
                      ? `${entry.value}${type === "t12" || type === "t30" ? " m" : " %"} · ${format(new Date(entry.date), "dd/MM/yyyy")}`
                      : "Pas encore fait"}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => startRedo(type)}>
                  {entry ? "Refaire" : "Faire"}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="max-w-sm mx-auto">
        <Button variant="outline" size="sm" className="w-full" onClick={startWizard}>
          <RotateCcw className="h-3.5 w-3.5 mr-2" /> Mettre à jour l'objectif
        </Button>
      </div>
    </div>
  );
}
