import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, TrendingUp, Trash2, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";

type TestType = "cooper" | "vaussenat" | "5km" | "10km" | "vma_direct" | "autre";

interface PerformanceTest {
  id: string;
  test_type: TestType;
  test_date: string;
  raw_value: number | null;
  vma_estimated: number | null;
  notes: string | null;
}

interface PerformanceTestsCardProps {
  athleteId: string;
  onVmaUpdated?: (vma: number) => void;
}

const TEST_LABELS: Record<TestType, string> = {
  cooper: "Cooper (12 min)",
  vaussenat: "Test Vaussenat (paliers)",
  "5km": "Chrono 5 km",
  "10km": "Chrono 10 km",
  vma_direct: "VMA directe (piste)",
  autre: "Autre test",
};

// Types proposés à la saisie : uniquement de VRAIS tests de VMA.
// Les chronos 5/10 km sont des tests de performance (suivis dans l'onglet Course),
// pas des tests de VMA fiables → non proposés ici. Les anciens enregistrements
// restent affichés grâce à TEST_LABELS.
const SELECTABLE_TYPES: TestType[] = ["cooper", "vaussenat", "vma_direct", "autre"];

const TEST_UNITS: Record<TestType, string> = {
  cooper: "Mètres parcourus",
  vaussenat: "Vitesse du dernier palier (km/h)",
  "5km": "Temps (mm:ss)",
  "10km": "Temps (mm:ss)",
  vma_direct: "VMA (km/h)",
  autre: "VMA estimée (km/h)",
};

const TEST_PLACEHOLDERS: Record<TestType, string> = {
  cooper: "Ex: 2800",
  vaussenat: "Ex: 15.5",
  "5km": "Ex: 23:15",
  "10km": "Ex: 48:30",
  vma_direct: "Ex: 15.5",
  autre: "Ex: 14.0",
};

function computeVma(type: TestType, raw: number): number | null {
  if (raw <= 0) return null;
  switch (type) {
    // Cooper 12 min : la vitesse moyenne (dist/200) est tenue à ~95 % de la VMA
    // sur 12 min → on corrige pour estimer la VMA réelle.
    case "cooper": return Math.round((raw / 200) / 0.95 * 10) / 10;
    // Test Vaussenat : test progressif sur piste, la vitesse du dernier palier complété = VMA
    case "vaussenat": return Math.round(raw * 10) / 10;
    case "5km":    return Math.round((5000 / raw) * 3.6 / 0.95 * 10) / 10;
    case "10km":   return Math.round((10000 / raw) * 3.6 / 0.90 * 10) / 10;
    case "vma_direct":
    case "autre":  return Math.round(raw * 10) / 10;
    default:       return null;
  }
}

function parseTimeInput(s: string): number | null {
  const t = s.trim();
  const mmss = t.match(/^(\d+)[:'′](\d{1,2})$/);
  if (mmss) {
    const m = parseInt(mmss[1], 10);
    const sec = parseInt(mmss[2], 10);
    if (sec < 60) return m * 60 + sec;
  }
  const n = parseFloat(t.replace(",", "."));
  if (!isNaN(n) && n > 0) return n > 300 ? n : Math.round(n * 60);
  return null;
}

export function PerformanceTestsCard({ athleteId, onVmaUpdated }: PerformanceTestsCardProps) {
  const { session } = useAuth();
  const [tests, setTests] = useState<PerformanceTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testType, setTestType] = useState<TestType>("cooper");
  const [testDate, setTestDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rawInput, setRawInput] = useState("");
  const [notes, setNotes] = useState("");
  const [previewVma, setPreviewVma] = useState<number | null>(null);
  const [updateVma, setUpdateVma] = useState(true);

  useEffect(() => { loadTests(); }, [athleteId]);

  const loadTests = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.from("athlete_performance_tests") as any)
        .select("id, test_type, test_date, raw_value, vma_estimated, notes")
        .eq("athlete_id", athleteId)
        .order("test_date", { ascending: true });
      if (error) throw error;
      setTests(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (val: string) => {
    setRawInput(val);
    if (!val.trim()) { setPreviewVma(null); return; }
    const raw = (testType === "5km" || testType === "10km")
      ? parseTimeInput(val)
      : parseFloat(val.replace(",", ".")) || null;
    setPreviewVma(raw ? computeVma(testType, raw) : null);
  };

  const handleTypeChange = (v: TestType) => {
    setTestType(v);
    setRawInput("");
    setPreviewVma(null);
    // Les chronos 5/10 km sont des tests de PERFORMANCE, pas de VMA : leur VMA
    // estimée dépend de l'endurance et sous-estime souvent la VMA réelle.
    // On ne propose donc pas d'écraser la VMA du profil par défaut pour ces tests.
    setUpdateVma(v !== "5km" && v !== "10km");
  };

  const handleSave = async () => {
    if (!session?.user?.id || !rawInput.trim()) return;
    const raw = (testType === "5km" || testType === "10km")
      ? parseTimeInput(rawInput.trim())
      : parseFloat(rawInput.trim().replace(",", ".")) || null;
    if (!raw) { toast.error("Format invalide"); return; }
    const vmaEst = computeVma(testType, raw);
    if (!vmaEst) { toast.error("Impossible de calculer la VMA"); return; }
    setSaving(true);
    try {
      const { error } = await (supabase.from("athlete_performance_tests") as any).insert({
        athlete_id: athleteId,
        coach_id: session.user.id,
        test_type: testType,
        test_date: testDate,
        raw_value: raw,
        vma_estimated: vmaEst,
        notes: notes.trim() || null,
      });
      if (error) throw error;
      if (updateVma) {
        await supabase.from("user_profiles").update({ vma: vmaEst }).eq("id", athleteId);
        onVmaUpdated?.(vmaEst);
      }
      toast.success(`Test enregistré — VMA estimée : ${vmaEst} km/h`);
      setShowDialog(false);
      setRawInput(""); setNotes(""); setPreviewVma(null);
      await loadTests();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await (supabase.from("athlete_performance_tests") as any).delete().eq("id", id);
    await loadTests();
  };

  const chartData = tests.map((t) => ({
    date: format(parseISO(t.test_date), "dd/MM/yy"),
    vma: t.vma_estimated,
  }));

  const latest = tests.length > 0 ? tests[tests.length - 1].vma_estimated : null;
  const first  = tests.length > 1 ? tests[0].vma_estimated : null;
  const prog   = latest && first ? Math.round((latest - first) * 10) / 10 : null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Tests de performance &amp; progression VMA
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={loadTests}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" className="h-8" onClick={() => setShowDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Ajouter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : tests.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Aucun test enregistré. Ajoute le premier test pour suivre la progression.
            </p>
          ) : (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="flex gap-6">
                {latest && (
                  <div>
                    <div className="text-2xl font-bold text-primary">{latest.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">VMA actuelle (km/h)</div>
                  </div>
                )}
                {prog !== null && (
                  <div>
                    <div className={`text-2xl font-bold ${prog >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {prog >= 0 ? "+" : ""}{prog.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">Progression (km/h)</div>
                  </div>
                )}
                <div>
                  <div className="text-2xl font-bold text-foreground">{tests.length}</div>
                  <div className="text-xs text-muted-foreground">Tests réalisés</div>
                </div>
              </div>

              {/* Chart */}
              {tests.length >= 2 && (
                <ResponsiveContainer width="100%" height={130}>
                  <LineChart data={chartData} margin={{ left: -10, right: 10, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      itemStyle={{ color: "hsl(var(--primary))" }}
                      formatter={(v: any) => [`${v} km/h`, "VMA"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="vma"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}

              {/* List */}
              <div className="space-y-1">
                {[...tests].reverse().map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-secondary/50 transition-colors text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground">{TEST_LABELS[t.test_type]}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {format(parseISO(t.test_date), "dd MMM yyyy", { locale: fr })}
                      </span>
                      {t.notes && (
                        <span className="block text-xs text-muted-foreground italic truncate">{t.notes}</span>
                      )}
                    </div>
                    <div className="font-bold text-primary shrink-0">
                      {t.vma_estimated ? `${t.vma_estimated.toFixed(1)} km/h` : "—"}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un test de performance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type de test</Label>
              <Select value={testType} onValueChange={(v) => handleTypeChange(v as TestType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SELECTABLE_TYPES.map((k) => (
                    <SelectItem key={k} value={k}>{TEST_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date du test</Label>
              <Input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{TEST_UNITS[testType]}</Label>
              <Input
                value={rawInput}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={TEST_PLACEHOLDERS[testType]}
              />
              {previewVma && (
                <p className="text-sm font-medium text-primary">
                  → VMA estimée : <strong>{previewVma.toFixed(1)} km/h</strong>
                </p>
              )}
              {(testType === "5km" || testType === "10km") && (
                <p className="text-xs text-muted-foreground">Format mm:ss (ex: 23:15)</p>
              )}
              {testType === "cooper" && (
                <p className="text-xs text-muted-foreground">Distance parcourue en 12 minutes (mètres)</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optionnel)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Conditions, météo…" rows={2} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={updateVma}
                onChange={(e) => setUpdateVma(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm text-foreground">Mettre à jour la VMA du profil</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !rawInput.trim()}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
