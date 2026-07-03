import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AthleteCard } from "@/components/AthleteCard";
import { computeProfile, type RawMeasures, type ProfileResult } from "@/lib/profileEngine";
import { collectAutoMeasures } from "@/lib/profileCollectors";
import { type Distance, type Ambition, RECOMMENDATIONS } from "@/lib/profileReferentials";
import { RotateCcw, Loader2 } from "lucide-react";

interface TestStep {
  type: "t12" | "t30" | "drift" | "fade";
  title: string;
  help: string;
  unit: string;
}

const TEST_STEPS: TestStep[] = [
  { type: "t12", title: "Test 12 minutes", help: "Effort : maximal, à fond dès le départ (allure la plus rapide tenable sur toute la durée, comme une course). Échauffement avant : 15-20 min footing progressif + gammes/accélérations. Durée du test : 12 min chrono, sans pause. Note la distance totale parcourue (mètres) à la fin des 12 min.", unit: "m" },
  { type: "t30", title: "Test 30 minutes", help: "Effort : quasi-maximal mais régulier, l'allure la plus rapide que l'athlète peut tenir sans à-coups pendant 30 min entières (proche de l'allure de seuil, pas un sprint). Échauffement avant : 15-20 min footing progressif + gammes/accélérations. Durée du test : 30 min chrono, sans pause, allure la plus constante possible. Note la distance totale parcourue (mètres) à la fin des 30 min.", unit: "m" },
  { type: "drift", title: "Dérive cardiaque", help: "Effort : facile, endurance fondamentale (allure de footing tranquille, on peut parler). Durée : 45 à 60 min en continu, à vitesse constante (même allure du début à la fin, pas d'accélération). Après la séance, relève sur Strava/Garmin la FC moyenne de la 1re moitié et celle de la 2e moitié, puis calcule : (FC moyenne 2e moitié − FC moyenne 1re moitié) ÷ FC moyenne 1re moitié × 100. Ex : 142 bpm puis 149 bpm → (149-142)/142×100 = 4,9 → entre 5.", unit: "%" },
  { type: "fade", title: "Perte d'allure (sortie longue)", help: "Effort : modéré, allure libre/naturelle à sensation constante (même ressenti d'effort du début à la fin, PAS une allure imposée au chrono). Durée : sortie longue habituelle de l'athlète (généralement 1h15 à 2h, selon son niveau/objectif). Après la séance, relève sur Strava/Garmin la vitesse moyenne de la 1re moitié et celle de la 2e moitié, puis calcule : (vitesse 1re moitié − vitesse 2e moitié) ÷ vitesse 1re moitié × 100. Ex : 11,5 km/h puis 10,9 km/h → (11,5-10,9)/11,5×100 = 5,2 → entre 5.", unit: "%" },
];

export function AthleteProfileTab({ athleteId, athleteName, athleteVma }: { athleteId: string; athleteName: string; athleteVma: number | null }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tests, setTests] = useState<Record<string, number>>({});
  const [objective, setObjective] = useState<{ id: string; distance: Distance; ambition: Ambition } | null>(null);
  const [snapshot, setSnapshot] = useState<ProfileResult | null>(null);
  const [wizardMode, setWizardMode] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [fcMoy1, setFcMoy1] = useState("");
  const [fcMoy2, setFcMoy2] = useState("");
  const [objDistance, setObjDistance] = useState<Distance>("10k");
  const [objAmbition, setObjAmbition] = useState<Ambition>("progression");
  const [targetDate, setTargetDate] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: testRows }, { data: obj }, { data: snap }] = await Promise.all([
        supabase.from("profile_tests").select("test_type, value, test_date").eq("athlete_id", athleteId).order("test_date", { ascending: false }),
        supabase.from("athlete_objectives").select("id, distance, ambition").eq("athlete_id", athleteId).eq("is_active", true).limit(1).maybeSingle(),
        supabase.from("profile_snapshots").select("*").eq("athlete_id", athleteId).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const latestByType: Record<string, number> = {};
      for (const r of (testRows || []) as any[]) {
        if (latestByType[r.test_type] == null) latestByType[r.test_type] = Number(r.value);
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

  const missingSteps = TEST_STEPS.filter((s) => tests[s.type] == null);

  const startWizard = () => {
    setWizardMode(true);
    setStepIndex(0);
    setInputValue("");
    setFcMoy1("");
    setFcMoy2("");
    if (objective) { setObjDistance(objective.distance); setObjAmbition(objective.ambition); }
  };

  const saveCurrentTest = async () => {
    const step = missingSteps[stepIndex];
    if (!step) return;

    let val: number;
    if (step.type === "drift") {
      const f1 = parseFloat(fcMoy1);
      const f2 = parseFloat(fcMoy2);
      if (isNaN(f1) || isNaN(f2) || f1 <= 0) {
        toast.error("Entre les deux FC moyennes");
        return;
      }
      val = Math.round(((f2 - f1) / f1) * 100 * 100) / 100;
    } else {
      val = parseFloat(inputValue);
      if (isNaN(val)) {
        toast.error("Entre une valeur valide");
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase.from("profile_tests").insert({
      athlete_id: athleteId, test_type: step.type, value: val,
    } as any);
    setSaving(false);
    if (error) { toast.error(`Erreur : ${error.message}`); return; }
    setTests((t) => ({ ...t, [step.type]: val }));
    setInputValue("");
    setFcMoy1("");
    setFcMoy2("");
    setStepIndex((i) => i + 1);
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

      const auto = await collectAutoMeasures(athleteId);
      const measures: RawMeasures = {
        vma: athleteVma || undefined,
        paceT12: tests.t12 ? (tests.t12 / 1000) / (12 / 60) : undefined,
        paceT30: tests.t30 ? (tests.t30 / 1000) / (30 / 60) : undefined,
        cardiacDrift: tests.drift,
        paceFadeLongRun: tests.fade,
        rpeGap: auto.rpeGap,
        adherence: auto.adherence,
      };
      const result = computeProfile(measures, objDistance, objAmbition);

      const { error: snapErr } = await supabase.from("profile_snapshots").insert({
        athlete_id: athleteId, objective_id: (newObj as any).id,
        overall_score: result.overall, scores: result.scores, raw_measures: measures as any,
        strengths: result.strengths, weaknesses: result.weaknesses,
        recommendation: result.recommendation, data_quality: result.dataQuality,
      } as any);
      if (snapErr) throw snapErr;

      setObjective(newObj as any);
      setSnapshot(result);
      setWizardMode(false);
      toast.success("Carte coureur générée !");
    } catch (e: any) {
      toast.error(`Erreur : ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground py-10 text-center">Chargement…</p>;

  // ── Assistant : test manquant ──
  if (wizardMode && stepIndex < missingSteps.length) {
    const step = missingSteps[stepIndex];
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-base">
            Test {stepIndex + 1}/{missingSteps.length} — {step.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{step.help}</p>
          {step.type === "drift" ? (
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
                  Dérive calculée : {Math.round(((parseFloat(fcMoy2) - parseFloat(fcMoy1)) / parseFloat(fcMoy1)) * 100 * 100) / 100}%
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="test-value">Valeur ({step.unit})</Label>
              <Input id="test-value" type="number" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder={`Ex: ${step.type === "t12" ? "2800" : step.type === "t30" ? "6500" : "5"}`} />
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setWizardMode(false)} disabled={saving} className="flex-1">Annuler</Button>
            <Button onClick={saveCurrentTest} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Suivant"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Assistant : objectif ──
  if (wizardMode && stepIndex >= missingSteps.length) {
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
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader><CardTitle className="text-base">Carte coureur</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {missingSteps.length > 0
              ? `${missingSteps.length} test(s) à renseigner avant de générer la carte.`
              : "Tous les tests sont renseignés — il ne reste plus qu'à définir l'objectif."}
          </p>
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

      <div className="max-w-sm mx-auto">
        <Button variant="outline" size="sm" className="w-full" onClick={startWizard}>
          <RotateCcw className="h-3.5 w-3.5 mr-2" /> Mettre à jour l'objectif / les tests
        </Button>
      </div>
    </div>
  );
}
