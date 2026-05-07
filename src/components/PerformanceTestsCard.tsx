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
  ReferenceLine,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, TrendingUp, Trash2, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";

type TestType = "cooper" | "5km" | "10km" | "vma_direct" | "autre";

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
  "5km": "Chrono 5 km",
  "10km": "Chrono 10 km",
  vma_direct: "VMA directe (piste)",
  autre: "Autre test",
};

const TEST_UNITS: Record<TestType, string> = {
  cooper: "Mètres parcourus",
  "5km": "Temps (min:ss)",
  "10km": "Temps (min:ss)",
  vma_direct: "VMA (km/h)",
  autre: "VMA estimée (km/h)",
};

const TEST_PLACEHOLDERS: Record<TestType, string> = {
  cooper: "Ex: 2800",
  "5km": "Ex: 23:15",
  "10km": "Ex: 48:30",
  vma_direct: "Ex: 15.5",
  autre: "Ex: 14.0",
};

/** Computes estimated VMA in km/h from raw test input */
function computeVma(testType: TestType, rawValue: number): number | null {
  switch (testType) {
    case "cooper":
      // Cooper 12min: VMA = distance / 200
      return Math.round((rawValue / 200) * 10) / 10;
    case "5km":
      // rawValue = time in seconds, speed = 5000/time_s m/s → km/h, VMA = speed / 0.95
      if (rawValue <= 0) return null;
      return Math.round((5000 / rawValue) * 3.6 / 0.95 * 10) / 10;
    case "10km":
      // rawValue = time in seconds, speed = 10000/time_s m/s → km/h, VMA = speed / 0.90
      if (rawValue <= 0) return null;
      return Math.round((10000 / rawValue) * 3.6 / 0.90 * 10) / 10;
    case "vma_direct":
    case "autre":
      return Math.round(rawValue * 10) / 10;
    default:
      return null;
  }
}

/** Parses a "mm:ss" or "mm'ss" or plain seconds string into total seconds */
function parseTimeInput(s: string): number | null {
  const trimmed = s.trim();
  // mm:ss or mm'ss
  const mmss = trimmed.match(/^(\d+)[:'′](\d{1,2})$/);
  if (mmss) {
    const m = parseInt(mmss[1], 10);
    const sec = parseInt(mmss[2], 10);
    if (sec < 60) return m * 60 + sec;
  }
  // plain number (seconds or minutes)
  const plain = parseFloat(trimmed.replace(",", "."));
  if (!isNaN(plain) && plain > 0) {
    // if > 300 assume seconds already, else assume minutes
    return plain > 300 ? plain : Math.round(plain * 60);
  }
  return null;
}

export function PerformanceTestsCard({ athleteId, onVmaUpdated }: PerformanceTestsCardProps) {
  const { session } = useAuth();
  const [tests, setTests] = useState<PerformanceTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [testType, setTestType] = useState<TestType>("cooper");
  const [testDate, setTestDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rawInput, setRawInput] = useState("");
  const [notes, setNotes] = useState("");
  const [previewVma, setPreviewVma] = useState<number | null>(null);
  const [updateVmaAfterSave, setUpdateVmaAfterSave] = useState(true);

  useEffect(() => {
    loadTests();
  }, [athleteId]);

  const loadTests = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.from("athlete_performance_tests") as any)
        .select("id, test_type, test_date, raw_value, vma_estimated, notes")
        .eq("athlete_id", athleteId)
        .order("test_date", { ascending: true });
      if (error) throw error;
      setTests(data || []);
    } catch (e: any) {
      console.error("[PerformanceTestsCard]", e);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setRawInput(value);
    if (!value.trim()) { setPreviewVma(null); return; }
    let raw: number | null = null;
    if (testType === "5km" || testType === "10km") {
      raw = parseTimeInput(value);
    } else {
      raw = parseFloat(value.replace(",", "."));
      if (isNaN(raw)) raw = null;
    }
    if (raw !== null) {
      setPreviewVma(computeVma(testType, raw));
    } else {
      setPreviewVma(null);
    }
  };

  const handleTypeChange = (v: TestType) => {
    setTestType(v);
    setRawInput("");
    setPreviewVma(null);
  };

  const handleSave = async () => {
    if (!session?.user?.id) return;
    const trimmed = rawInput.trim();
    if (!trimmed) { toast.error("Entre une valeur pour le test"); return; }

    let rawValue: number | null = null;
    if (testType === "5km" || testType === "10km") {
      rawValue = parseTimeInput(trimmed);
      if (!rawValue) { toast.error("Format de temps invalide. Utilise mm:ss (ex: 23:15)"); return; }
    } else {
      rawValue = parseFloat(trimmed.replace(",", "."));
      if (isNaN(rawValue) || rawValue <= 0) { toast.error("Valeur invalide"); return; }
    }

    const vmaEstimated = computeVma(testType, rawValue);
    if (!vmaEstimated) { toast.error("Impossible de calculer la VMA"); return; }

    setSaving(true);
    try {
      const { error } = await (supabase.from("athlete_performance_tests") as any).insert({
        athlete_id: athleteId,
        coach_id: session.user.id,
        test_type: testType,
        test_date: testDate,
        raw_value: rawValue,
        vma_estimated: vmaEstimated,
        notes: notes.trim() || null,
      });
      if (error) throw error;

      if (updateVmaAfterSave) {
        const { error: updateError } = await supabase
          .from("user_profiles")
          .update({ vma: vmaEstimated })
          .eq("id", athleteId);
        if (updateError) console.error("VMA update error:", updateError);
        else onVmaUpdated?.(vmaEstimated);
      }

      toast.success(`Test enregistré — VMA estimée : ${vmaEstimated} km/h`);
      setShowDialog(false);
      setRawInput("");
      setNotes("");
      setPreviewVma(null);
      await loadTests();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase.from("athlete_performance_tests") as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Test supprimé");
      await loadTests();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la suppression");
    }
  };

  const chartData = tests.map((t) => ({
    date: format(parseISO(t.test_date), "dd/MM/yy"),
    vma: t.vma_estimated,
    label: `${TEST_LABELS[t.test_type]} — ${format(parseISO(t.test_date), "dd MMM yyyy", { locale: fr })}`,
  }));

  const latestVma = tests.length > 0 ? tests[tests.length - 1].vma_estimated : null;
  const firstVma = tests.length > 1 ? tests[0].vma_estimated : null;
  const progression = latestVma && firstVma ? Math.round((latestVma - firstVma) * 10) / 10 : null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Tests de performance & progression VMA
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
              Aucun test enregistré. Ajoute le premier test pour suivre la progression de la VMA.
            </p>
          ) : (
            <div className="space-y-4">
              {/* KPI */}
              <div className="flex gap-4">
                {latestVma && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{latestVma.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">VMA actuelle (km/h)</div>
                  </div>
                )}
                {progression !== null && (
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${progression >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {progression >= 0 ? "+" : ""}{progression.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">Progression (km/h)</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{tests.length}</div>
                  <div className="text-xs text-muted-foreground">Tests réalisés</div>
                </div>
              </div>

              {/* Chart */}
              {tests.length >= 2 && (
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={chartData} margin={{ left: -10, right: 10, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => `${v}`}
                    />
                    <Tooltip
                      formatter={(v: any) => [`${v} km/h`, "VMA"]}
                      labelFormatter={(l) => `Date: ${l}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="vma"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "hsl(var(--primary))" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}

              {/* Tests list */}
              <div className="space-y-1.5">
                {[...tests].reverse().map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between text-sm gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{TEST_LABELS[t.test_type]}</span>
                      <span className="text-muted-foreground ml-2">
                        {format(parseISO(t.test_date), "dd MMM yyyy", { locale: fr })}
                      </span>
                      {t.notes && (
                        <span className="text-xs text-muted-foreground ml-2 italic truncate block">
                          {t.notes}
                        </span>
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

      {/* Add test dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un test de performance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type de test</Label>
              <Select value={testType} onValueChange={(v) => handleTypeChange(v as TestType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TEST_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
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
                <p className="text-sm text-primary font-medium">
                  → VMA estimée : <strong>{previewVma.toFixed(1)} km/h</strong>
                </p>
              )}
              {testType === "cooper" && (
                <p className="text-xs text-muted-foreground">Distance parcourue en 12 minutes (en mètres)</p>
              )}
              {(testType === "5km" || testType === "10km") && (
                <p className="text-xs text-muted-foreground">Format mm:ss (ex: 23:15) ou minutes:secondes</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Conditions, météo, remarques…"
                rows={2}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={updateVmaAfterSave}
                onChange={(e) => setUpdateVmaAfterSave(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm">Mettre à jour la VMA du profil avec ce résultat</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || !rawInput.trim()}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
