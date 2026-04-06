import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Pencil, Trash2, Search, Eye, X, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";

const RECUPERATION_OPTIONS = [
  { value: "0s", label: "Aucune" },
  { value: "30s", label: "30 sec" },
  { value: "35s", label: "35 sec" },
  { value: "40s", label: "40 sec" },
  { value: "45s", label: "45 sec" },
  { value: "50s", label: "50 sec" },
  { value: "55s", label: "55 sec" },
  { value: "1min", label: "1 min" },
  { value: "1min30s", label: "1'30" },
  { value: "2min", label: "2 min" },
  { value: "2min30s", label: "2'30" },
  { value: "3min", label: "3 min" },
  { value: "3min30s", label: "3'30" },
  { value: "4min", label: "4 min" },
  { value: "4min30s", label: "4'30" },
  { value: "5min", label: "5 min" },
  { value: "emom", label: "EMOM" },
];

const THEMES = [
  { value: "endurance", label: "Endurance", color: "hsl(200, 70%, 50%)" },
  { value: "force", label: "Force", color: "hsl(0, 70%, 50%)" },
  { value: "hypertrophie", label: "Hypertrophie", color: "hsl(280, 70%, 50%)" },
  { value: "rehabilitation", label: "Réhabilitation", color: "hsl(150, 70%, 45%)" },
  { value: "mobilite", label: "Mobilité", color: "hsl(40, 80%, 50%)" },
  { value: "explosivite", label: "Explosivité", color: "hsl(25, 90%, 55%)" },
] as const;

type ThemeValue = typeof THEMES[number]["value"];

interface Exercise {
  id: string;
  name: string;
  category: string | null;
  muscle_principal: string | null;
  muscles_second?: string[] | null;
}

interface SerieDetail {
  reps: string;
  rpe: string;
  charge: string;
  tempo: string;
  commentaire: string;
  recuperation: string;
}

interface SessionExerciseConfig {
  exerciseId: string;
  recuperation: string;
  reps: string;
  series: string;
  rpe: string;
  charge: string;
  tempo: string;
  commentaire: string;
  serieDetails: SerieDetail[];
}

interface Methodology {
  id: string;
  name: string;
  description: string | null;
  themes: ThemeValue[];
  duration_weeks_min: number | null;
  duration_weeks_max: number | null;
  rpe_target_min: number | null;
  rpe_target_max: number | null;
  progression_summary: string | null;
  full_description: string | null;
  num_cycles: number | null;
  weeks_per_cycle: number | null;
  sessions_options: number[];
  exercises: Exercise[];
  session_exercise_configs: Record<string, SessionExerciseConfig[]>;
}

export default function Methodologies() {
  const { session } = useAuth();
  const [methodologies, setMethodologies] = useState<Methodology[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingMethodology, setViewingMethodology] = useState<Methodology | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedThemes, setSelectedThemes] = useState<ThemeValue[]>([]);
  const [durationMin, setDurationMin] = useState("");
  const [durationMax, setDurationMax] = useState("");
  const [rpeMin, setRpeMin] = useState("");
  const [rpeMax, setRpeMax] = useState("");
  const [progressionSummary, setProgressionSummary] = useState("");
  const [fullDescription, setFullDescription] = useState("");
  const [numCycles, setNumCycles] = useState("");
  const [weeksPerCycle, setWeeksPerCycle] = useState("");
  const [sessionsOptions, setSessionsOptions] = useState<number[]>([]);
  const [sessionsInput, setSessionsInput] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseMuscleFilter, setExerciseMuscleFilter] = useState<string>("all");
  // Map: "cycleIndex-sessionIndex" → exercise configs (applies to all weeks of that cycle)
  const [sessionExerciseMap, setSessionExerciseMap] = useState<Record<string, SessionExerciseConfig[]>>({});
  const [search, setSearch] = useState("");
  const [filterTheme, setFilterTheme] = useState<ThemeValue | null>(null);
  const [expandedMethodoSeries, setExpandedMethodoSeries] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const fetchExercises = async () => {
    const { data, error } = await supabase
      .from("exercise_library")
      .select("id, name, category, muscle_principal, muscles_second")
      .order("name");

    if (error) {
      toast.error("Erreur lors du chargement des exercices");
      setAllExercises([]);
      return;
    }

    setAllExercises(data || []);
  };

  const fetchMethodologies = async () => {
    if (!session?.user?.id) return;
    setLoading(true);

    const { data: methData, error: methError } = await supabase
      .from("coaching_methodologies")
      .select("*")
      .eq("coach_id", session.user.id)
      .order("name");

    if (methError) {
      toast.error("Erreur lors du chargement des méthodologies");
      setLoading(false);
      return;
    }

    const ids = (methData || []).map((m: any) => m.id);
    let themesMap: Record<string, ThemeValue[]> = {};
    let exercisesMap: Record<string, string[]> = {};

    if (ids.length > 0) {
      const [{ data: themesData }, { data: methExData }] = await Promise.all([
        supabase.from("methodology_themes").select("*").in("methodology_id", ids),
        supabase.from("methodology_exercises").select("*").in("methodology_id", ids),
      ]);

      (themesData || []).forEach((t: any) => {
        if (!themesMap[t.methodology_id]) themesMap[t.methodology_id] = [];
        themesMap[t.methodology_id].push(t.theme);
      });

      (methExData || []).forEach((e: any) => {
        if (!exercisesMap[e.methodology_id]) exercisesMap[e.methodology_id] = [];
        exercisesMap[e.methodology_id].push(e.exercise_id);
      });
    }

    // Fetch exercise details for all referenced exercise ids
    const allExIds = [...new Set(Object.values(exercisesMap).flat())];
    let exerciseDetailsMap: Record<string, Exercise> = {};
    if (allExIds.length > 0) {
      const { data: exData } = await supabase
        .from("exercise_library")
        .select("id, name, category, muscle_principal, muscles_second")
        .in("id", allExIds);
      (exData || []).forEach((e: any) => {
        exerciseDetailsMap[e.id] = e;
      });
    }

    setMethodologies(
      (methData || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        themes: themesMap[m.id] || [],
        duration_weeks_min: m.duration_weeks_min,
        duration_weeks_max: m.duration_weeks_max,
        rpe_target_min: m.rpe_target_min,
        rpe_target_max: m.rpe_target_max,
        progression_summary: m.progression_summary,
        full_description: m.full_description,
        num_cycles: m.num_cycles,
        weeks_per_cycle: m.weeks_per_cycle,
        sessions_options: m.sessions_options || [],
        exercises: (exercisesMap[m.id] || []).map((eid: string) => exerciseDetailsMap[eid]).filter(Boolean),
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchMethodologies();
    fetchExercises();
  }, [session?.user?.id]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setSelectedThemes([]);
    setDurationMin("");
    setDurationMax("");
    setRpeMin("");
    setRpeMax("");
    setProgressionSummary("");
    setFullDescription("");
    setNumCycles("");
    setWeeksPerCycle("");
    setSessionsOptions([]);
    setSessionsInput("");
    setSelectedExercises([]);
    setExerciseSearch("");
    setExerciseMuscleFilter("all");
    setSessionExerciseMap({});
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (m: Methodology) => {
    setEditingId(m.id);
    setName(m.name);
    setDescription(m.description || "");
    setSelectedThemes([...m.themes]);
    setDurationMin(m.duration_weeks_min?.toString() || "");
    setDurationMax(m.duration_weeks_max?.toString() || "");
    setRpeMin(m.rpe_target_min?.toString() || "");
    setRpeMax(m.rpe_target_max?.toString() || "");
    setProgressionSummary(m.progression_summary || "");
    setFullDescription(m.full_description || "");
    setNumCycles(m.num_cycles?.toString() || "");
    setWeeksPerCycle(m.weeks_per_cycle?.toString() || "");
    setSessionsOptions(m.sessions_options || []);
    setSessionsInput("");
    setSelectedExercises(m.exercises || []);
    setExerciseSearch("");
    setExerciseMuscleFilter("all");
    setDialogOpen(true);
  };

  const openView = (m: Methodology) => {
    setViewingMethodology(m);
    setViewDialogOpen(true);
  };

  const addSessionOption = () => {
    const val = parseInt(sessionsInput);
    if (!val || val < 1) return;
    if (sessionsOptions.includes(val)) { setSessionsInput(""); return; }
    setSessionsOptions([...sessionsOptions, val].sort((a, b) => a - b));
    setSessionsInput("");
  };

  const removeSessionOption = (v: number) => {
    setSessionsOptions(sessionsOptions.filter((s) => s !== v));
  };

  const addExercise = (ex: Exercise) => {
    if (selectedExercises.some((e) => e.id === ex.id)) return;
    setSelectedExercises([...selectedExercises, ex]);
    setExerciseSearch("");
  };

  const removeExercise = (id: string) => {
    setSelectedExercises(selectedExercises.filter((e) => e.id !== id));
    setSessionExerciseMap(prev => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].filter(c => c.exerciseId !== id);
        if (next[key].length === 0) delete next[key];
      }
      return next;
    });
  };

  const addExerciseToSession = (cycleIndex: number, weekIndex: number, sessionIndex: number, exerciseId: string) => {
    // Add the exercise to ALL weeks in this cycle+session so exercises are shared across weeks
    const totalWeeks = Math.min(Number(weeksPerCycle), 20) || 1;
    setSessionExerciseMap(prev => {
      const next = { ...prev };
      for (let wi = 0; wi < totalWeeks; wi++) {
        const key = `${cycleIndex}-${wi}-${sessionIndex}`;
        const existing = next[key] || [];
        if (existing.some(c => c.exerciseId === exerciseId)) continue;
        const newConfig: SessionExerciseConfig = { exerciseId, recuperation: "", reps: "", series: "", rpe: "", charge: "", tempo: "", commentaire: "", serieDetails: [] };
        next[key] = [...existing, newConfig];
      }
      return next;
    });
  };

  const removeExerciseFromSession = (cycleIndex: number, weekIndex: number, sessionIndex: number, exerciseId: string) => {
    // Remove the exercise from ALL weeks in this cycle+session
    const totalWeeks = Math.min(Number(weeksPerCycle), 20) || 1;
    setSessionExerciseMap(prev => {
      const next = { ...prev };
      for (let wi = 0; wi < totalWeeks; wi++) {
        const key = `${cycleIndex}-${wi}-${sessionIndex}`;
        const filtered = (next[key] || []).filter(c => c.exerciseId !== exerciseId);
        if (filtered.length === 0) delete next[key];
        else next[key] = filtered;
      }
      return next;
    });
  };

  const updateSessionExerciseConfig = (cycleIndex: number, weekIndex: number, sessionIndex: number, exerciseId: string, field: keyof SessionExerciseConfig, value: string) => {
    const key = `${cycleIndex}-${weekIndex}-${sessionIndex}`;
    setSessionExerciseMap(prev => {
      const configs = (prev[key] || []).map(c => {
        if (c.exerciseId !== exerciseId) return c;
        const updated = { ...c, [field]: value };
        // When series count changes, regenerate serieDetails
        if (field === "series") {
          const count = parseInt(value) || 0;
          const oldDetails = c.serieDetails || [];
          const newDetails: SerieDetail[] = Array.from({ length: count }, (_, i) => ({
            reps: oldDetails[i]?.reps || c.reps || "",
            rpe: oldDetails[i]?.rpe || c.rpe || "",
            charge: oldDetails[i]?.charge || c.charge || "",
            tempo: oldDetails[i]?.tempo || c.tempo || "",
            commentaire: oldDetails[i]?.commentaire || c.commentaire || "",
            recuperation: oldDetails[i]?.recuperation || c.recuperation || "",
          }));
          updated.serieDetails = newDetails;
        }
        return updated;
      });
      return { ...prev, [key]: configs };
    });
  };

  const updateSerieDetail = (cycleIndex: number, weekIndex: number, sessionIndex: number, exerciseId: string, serieIdx: number, field: keyof SerieDetail, value: string) => {
    const key = `${cycleIndex}-${weekIndex}-${sessionIndex}`;
    setSessionExerciseMap(prev => {
      const configs = (prev[key] || []).map(c => {
        if (c.exerciseId !== exerciseId) return c;
        const details = [...c.serieDetails];
        details[serieIdx] = { ...details[serieIdx], [field]: value };
        return { ...c, serieDetails: details };
      });
      return { ...prev, [key]: configs };
    });
  };

  const toggleMethodoSeriesExpanded = (key: string) => {
    setExpandedMethodoSeries(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getSessionExerciseConfigs = (cycleIndex: number, weekIndex: number, sessionIndex: number): (SessionExerciseConfig & { exercise: Exercise })[] => {
    const key = `${cycleIndex}-${weekIndex}-${sessionIndex}`;
    const configs = sessionExerciseMap[key] || [];
    return configs.map(c => {
      const exercise = selectedExercises.find(e => e.id === c.exerciseId);
      return exercise ? { ...c, exercise } : null;
    }).filter(Boolean) as (SessionExerciseConfig & { exercise: Exercise })[];
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Le nom est requis"); return; }
    if (selectedThemes.length === 0) { toast.error("Sélectionne au moins un thème"); return; }
    if (!session?.user?.id) return;
    setSaving(true);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        duration_weeks_min: durationMin ? parseInt(durationMin) : null,
        duration_weeks_max: durationMax ? parseInt(durationMax) : null,
        rpe_target_min: rpeMin ? parseFloat(rpeMin) : null,
        rpe_target_max: rpeMax ? parseFloat(rpeMax) : null,
        progression_summary: progressionSummary.trim() || null,
        full_description: fullDescription.trim() || null,
        num_cycles: numCycles ? parseInt(numCycles) : null,
        weeks_per_cycle: weeksPerCycle ? parseInt(weeksPerCycle) : null,
        sessions_options: sessionsOptions,
        updated_at: new Date().toISOString(),
      };

      let methId = editingId;

      if (editingId) {
        const { error } = await supabase.from("coaching_methodologies").update(payload).eq("id", editingId);
        if (error) throw error;
        await Promise.all([
          supabase.from("methodology_themes").delete().eq("methodology_id", editingId),
          supabase.from("methodology_exercises").delete().eq("methodology_id", editingId),
        ]);
      } else {
        const { data, error } = await supabase
          .from("coaching_methodologies")
          .insert({ ...payload, coach_id: session.user.id })
          .select("id")
          .single();
        if (error) throw error;
        methId = data.id;
      }

      const themeRows = selectedThemes.map((theme) => ({ methodology_id: methId!, theme }));
      const exerciseRows = selectedExercises.map((ex) => ({ methodology_id: methId!, exercise_id: ex.id }));

      const { error: themeError } = await supabase.from("methodology_themes").insert(themeRows);
      if (themeError) throw themeError;

      if (exerciseRows.length > 0) {
        const { error: exError } = await supabase.from("methodology_exercises").insert(exerciseRows);
        if (exError) throw exError;
      }

      toast.success(editingId ? "Méthodologie modifiée" : "Méthodologie ajoutée");
      setDialogOpen(false);
      fetchMethodologies();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message || "inconnue"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette méthodologie ?")) return;
    const { error } = await supabase.from("coaching_methodologies").delete().eq("id", id);
    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Méthodologie supprimée");
      fetchMethodologies();
    }
  };

  const toggleTheme = (theme: ThemeValue) => {
    setSelectedThemes((prev) =>
      prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme]
    );
  };

  const getThemeInfo = (value: string) => THEMES.find((t) => t.value === value);

  const filtered = methodologies.filter((m) => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
    const matchTheme = !filterTheme || m.themes.includes(filterTheme);
    return matchSearch && matchTheme;
  });

  const groupedByTheme = THEMES.map((theme) => ({
    ...theme,
    items: filtered.filter((m) => m.themes.includes(theme.value)),
  })).filter((g) => g.items.length > 0);

  const exerciseMuscles = Array.from(
    new Set(allExercises.map((ex) => ex.muscle_principal).filter(Boolean))
  ).sort() as string[];

  const filteredExerciseResults = allExercises
    .filter((ex) => {
      const matchesSearch =
        !exerciseSearch ||
        ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
        ex.muscle_principal?.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
        ex.category?.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
        ex.muscles_second?.some((muscle) => muscle.toLowerCase().includes(exerciseSearch.toLowerCase()));

      const matchesMuscle = exerciseMuscleFilter === "all" || ex.muscle_principal === exerciseMuscleFilter;
      const notSelected = !selectedExercises.some((s) => s.id === ex.id);

      return matchesSearch && matchesMuscle && notSelected;
    })
    .slice(0, 30);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Méthodologies</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </div>

      {/* Search & filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher une méthodologie..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={filterTheme === null ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setFilterTheme(null)}>Tous</Badge>
          {THEMES.map((t) => (
            <Badge
              key={t.value}
              variant={filterTheme === t.value ? "default" : "outline"}
              className="cursor-pointer text-xs"
              style={filterTheme === t.value ? { backgroundColor: t.color, borderColor: t.color } : { borderColor: t.color, color: t.color }}
              onClick={() => setFilterTheme(filterTheme === t.value ? null : t.value)}
            >
              {t.label}
            </Badge>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-12">Chargement...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          {methodologies.length === 0 ? "Aucune méthodologie pour l'instant. Clique sur Ajouter !" : "Aucun résultat pour ce filtre."}
        </p>
      ) : (
        <div className="space-y-6">
          {groupedByTheme.map((group) => (
            <div key={group.value}>
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: group.color }}>
                {group.label} ({group.items.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((m) => (
                  <Card key={`${group.value}-${m.id}`} className="group">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{m.name}</CardTitle>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openView(m)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(m.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {m.description && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{m.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {m.num_cycles && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                            {m.num_cycles} cycle{m.num_cycles > 1 ? "s" : ""}
                          </span>
                        )}
                        {m.weeks_per_cycle && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                            {m.weeks_per_cycle} sem./cycle
                          </span>
                        )}
                        {m.sessions_options.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                            {m.sessions_options.join("/")} séances
                          </span>
                        )}
                        {m.rpe_target_min && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                            RPE {m.rpe_target_min}{m.rpe_target_max ? `–${m.rpe_target_max}` : ""}
                          </span>
                        )}
                      </div>
                      {m.exercises.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mb-2 line-clamp-1">
                          🏋️ {m.exercises.map(e => e.name).join(", ")}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {m.themes.map((th) => {
                          const info = getThemeInfo(th);
                          return info ? (
                            <span key={th} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${info.color}20`, color: info.color }}>
                              {info.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          {viewingMethodology && (
            <>
              <DialogHeader>
                <DialogTitle>{viewingMethodology.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {viewingMethodology.description && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <p className="text-sm">{viewingMethodology.description}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {viewingMethodology.themes.map((th) => {
                    const info = getThemeInfo(th);
                    return info ? (
                      <Badge key={th} style={{ backgroundColor: `${info.color}20`, color: info.color, borderColor: info.color }} variant="outline" className="text-xs">
                        {info.label}
                      </Badge>
                    ) : null;
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {viewingMethodology.num_cycles && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Cycles</p>
                      <p className="text-sm font-medium">{viewingMethodology.num_cycles}</p>
                    </div>
                  )}
                  {viewingMethodology.weeks_per_cycle && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Semaines / cycle</p>
                      <p className="text-sm font-medium">{viewingMethodology.weeks_per_cycle}</p>
                    </div>
                  )}
                  {viewingMethodology.sessions_options.length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Séances possibles</p>
                      <p className="text-sm font-medium">{viewingMethodology.sessions_options.join(", ")}</p>
                    </div>
                  )}
                  {viewingMethodology.duration_weeks_min && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Durée totale</p>
                      <p className="text-sm font-medium">
                        {viewingMethodology.duration_weeks_min}{viewingMethodology.duration_weeks_max && viewingMethodology.duration_weeks_max !== viewingMethodology.duration_weeks_min ? `–${viewingMethodology.duration_weeks_max}` : ""} semaines
                      </p>
                    </div>
                  )}
                  {viewingMethodology.rpe_target_min && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">RPE cible</p>
                      <p className="text-sm font-medium">
                        {viewingMethodology.rpe_target_min}{viewingMethodology.rpe_target_max ? `–${viewingMethodology.rpe_target_max}` : ""}
                      </p>
                    </div>
                  )}
                </div>
                {viewingMethodology.exercises.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Exercices associés</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {viewingMethodology.exercises.map((ex) => (
                        <Badge key={ex.id} variant="secondary" className="text-xs">
                          {ex.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {viewingMethodology.progression_summary && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Progression</Label>
                    <p className="text-sm whitespace-pre-wrap">{viewingMethodology.progression_summary}</p>
                  </div>
                )}
                {viewingMethodology.full_description && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Description complète</Label>
                    <p className="text-sm whitespace-pre-wrap">{viewingMethodology.full_description}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} modal={true}>
        <DialogContent className="!left-0 !top-0 !translate-x-0 !translate-y-0 h-screen w-screen max-w-none rounded-none border-none p-0 sm:rounded-none [&>button]:hidden">
          <div className="flex h-full min-h-0 flex-col">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-3 sm:px-6">
              <h2 className="text-lg font-semibold">{editingId ? "Modifier la méthodologie" : "Nouvelle méthodologie"}</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Quitter</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Enregistrement..." : editingId ? "Modifier" : "Enregistrer"}
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 pb-12 sm:px-6 lg:px-8">
              <div className="w-full space-y-5">
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                  <div className="xl:col-span-5">
                    <Label>Nom *</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Méthode 3/7 ondulatoire" />
                  </div>
                  <div className="xl:col-span-7">
                    <Label>Description courte</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Résumé en une ou deux phrases..." rows={3} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                  <div className="xl:col-span-6">
                    <Label>Thèmes *</Label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {THEMES.map((t) => (
                        <label
                          key={t.value}
                          className="flex items-center gap-2 rounded-lg border p-2 transition-colors cursor-pointer"
                          style={selectedThemes.includes(t.value) ? { borderColor: t.color, backgroundColor: `${t.color}10` } : {}}
                        >
                          <Checkbox checked={selectedThemes.includes(t.value)} onCheckedChange={() => toggleTheme(t.value)} />
                          <span className="text-sm" style={selectedThemes.includes(t.value) ? { color: t.color, fontWeight: 500 } : {}}>
                            {t.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 xl:col-span-6">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Nombre de cycles</Label>
                        <Input type="number" min="1" value={numCycles} onChange={(e) => setNumCycles(e.target.value)} placeholder="Ex: 4" />
                      </div>
                      <div>
                        <Label>Semaines par cycle</Label>
                        <Input type="number" min="1" value={weeksPerCycle} onChange={(e) => setWeeksPerCycle(e.target.value)} placeholder="Ex: 5" />
                      </div>
                    </div>

                    <div>
                      <Label>Nombre de séances possibles</Label>
                      <p className="mb-1 text-xs text-muted-foreground">Ajoute les différentes options (ex: 3, 4 ou 5 séances/semaine)</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={sessionsInput}
                          onChange={(e) => setSessionsInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSessionOption(); } }}
                          placeholder="Ex: 3"
                          className="w-24"
                        />
                        <Button type="button" variant="outline" size="sm" onClick={addSessionOption}>Ajouter</Button>
                      </div>
                      {sessionsOptions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {sessionsOptions.map((s) => (
                            <Badge key={s} variant="secondary" className="gap-1 text-xs">
                              {s} séances
                              <X className="h-3 w-3 cursor-pointer" onClick={() => removeSessionOption(s)} />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>


                <div>
                  <Label>Exercices associés</Label>
                  <p className="mb-2 text-xs text-muted-foreground">Recherche et ajoute les exercices de ta bibliothèque</p>
                  <div className="space-y-3 rounded-lg border border-border bg-card p-3">
                    <Input
                      value={exerciseSearch}
                      onChange={(e) => setExerciseSearch(e.target.value)}
                      placeholder="Rechercher un exercice..."
                      type="search"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (filteredExerciseResults.length > 0) {
                            addExercise(filteredExerciseResults[0]);
                          }
                        }
                      }}
                    />

                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant={exerciseMuscleFilter === "all" ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => setExerciseMuscleFilter("all")}
                      >
                        Tous
                      </Badge>
                      {exerciseMuscles.map((muscle) => (
                        <Badge
                          key={muscle}
                          variant={exerciseMuscleFilter === muscle ? "default" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => setExerciseMuscleFilter(muscle)}
                        >
                          {muscle}
                        </Badge>
                      ))}
                    </div>

                    {(exerciseSearch.trim() || exerciseMuscleFilter !== "all") && (
                      <div className="max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border bg-background">
                        {filteredExerciseResults.length > 0 ? (
                          filteredExerciseResults.map((ex) => (
                            <button
                              key={ex.id}
                              type="button"
                              className="w-full px-3 py-2 text-left transition-colors hover:bg-accent/50"
                              onClick={() => addExercise(ex)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground">{ex.name}</p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {ex.muscle_principal && (
                                      <Badge variant="outline" className="text-[10px]">
                                        {ex.muscle_principal}
                                      </Badge>
                                    )}
                                    {ex.category && (
                                      <Badge variant="secondary" className="text-[10px] capitalize">
                                        {ex.category}
                                      </Badge>
                                    )}
                                    {ex.muscles_second?.slice(0, 2).map((muscle) => (
                                      <Badge key={muscle} variant="secondary" className="text-[10px]">
                                        {muscle}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                <span className="shrink-0 text-xs text-muted-foreground">Ajouter</span>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                            Aucun exercice trouvé.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedExercises.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedExercises.map((ex) => (
                        <Badge key={ex.id} variant="secondary" className="gap-1 text-xs">
                          {ex.name}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => removeExercise(ex.id)} />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Structure preview tree */}
                {Number(numCycles) > 0 && Number(weeksPerCycle) > 0 && (
                  <div>
                    <Label>Aperçu de la structure</Label>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Basé sur {numCycles} cycle(s), {weeksPerCycle} semaine(s)/cycle, {sessionsOptions.length > 0 ? sessionsOptions.join(" ou ") + " séance(s)/semaine" : "séances non définies"}
                      {selectedExercises.length > 0 && " — clique sur une séance pour y ajouter des exercices"}
                    </p>
                    <div className="space-y-1 rounded-lg border border-border bg-card p-3">
                      {Array.from({ length: Math.min(Number(numCycles), 12) }, (_, ci) => (
                        <Collapsible key={ci}>
                          <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-foreground hover:bg-accent/50 transition-colors group">
                            <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                            Cycle {ci + 1}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="ml-4 border-l border-border pl-2">
                            {Array.from({ length: Math.min(Number(weeksPerCycle), 20) }, (_, wi) => (
                              <Collapsible key={wi}>
                                <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent/50 transition-colors group">
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                                  Semaine {wi + 1}
                                </CollapsibleTrigger>
                                <CollapsibleContent className="ml-4 border-l border-border/50 pl-2">
                                  {sessionsOptions.length > 0 ? (
                                    Array.from({ length: Math.max(...sessionsOptions) }, (_, si) => {
                                      const sessionConfigs = getSessionExerciseConfigs(ci, wi, si);
                                      const availableToAdd = selectedExercises.filter(e => !sessionConfigs.some(c => c.exerciseId === e.id));
                                      return (
                                        <Collapsible key={si}>
                                          <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-0.5 text-xs text-muted-foreground/70 hover:bg-accent/30 transition-colors group">
                                            <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                                            <div className="h-1.5 w-1.5 rounded-full bg-primary/50" />
                                            Séance {si + 1}
                                            {sessionConfigs.length > 0 && (
                                              <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">{sessionConfigs.length} exo{sessionConfigs.length > 1 ? "s" : ""}</Badge>
                                            )}
                                          </CollapsibleTrigger>
                                          <CollapsibleContent className="ml-6 py-1 space-y-1.5">
                                            {sessionConfigs.length > 0 && (
                                              <div className="overflow-x-auto rounded border border-border/50">
                                                <Table className="text-xs">
                                                  <TableHeader>
                                                    <TableRow className="h-7">
                                                      <TableHead className="min-w-[120px] text-[10px]">Exercice</TableHead>
                                                      <TableHead className="min-w-[60px] text-[10px]">Récup</TableHead>
                                                      <TableHead className="min-w-[50px] text-[10px]">Reps</TableHead>
                                                      <TableHead className="min-w-[40px] text-[10px]">RPE</TableHead>
                                                      <TableHead className="min-w-[60px] text-[10px]">% Max</TableHead>
                                                      <TableHead className="min-w-[50px] text-[10px]">Tempo</TableHead>
                                                      <TableHead className="min-w-[80px] text-[10px]">Comm.</TableHead>
                                                      <TableHead className="min-w-[50px] text-[10px]">Séries</TableHead>
                                                      <TableHead className="w-[30px]"></TableHead>
                                                    </TableRow>
                                                  </TableHeader>
                                                  <TableBody>
                                                    {sessionConfigs.map(cfg => {
                                                      const seriesCount = parseInt(cfg.series) || 0;
                                                      const seriesKey = `${ci}-${wi}-${si}-${cfg.exerciseId}`;
                                                      const isSeriesExpanded = expandedMethodoSeries[seriesKey];
                                                      return (
                                                        <React.Fragment key={cfg.exerciseId}>
                                                          <TableRow className="h-8">
                                                            <TableCell className="text-xs font-medium py-1">{cfg.exercise.name}</TableCell>
                                                            <TableCell className="py-1">
                                                              <Select value={cfg.recuperation} onValueChange={(v) => updateSessionExerciseConfig(ci, wi, si, cfg.exerciseId, "recuperation", v)}>
                                                                <SelectTrigger className="h-6 text-[11px] px-1 min-w-[60px]">
                                                                  <SelectValue placeholder="Récup" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                  {RECUPERATION_OPTIONS.map(opt => (
                                                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                                                                  ))}
                                                                </SelectContent>
                                                              </Select>
                                                            </TableCell>
                                                            <TableCell className="py-1">
                                                              <input type="text" value={cfg.reps} onChange={(e) => updateSessionExerciseConfig(ci, wi, si, cfg.exerciseId, "reps", e.target.value)} placeholder="8" className="w-full rounded border border-border bg-background px-1 py-0.5 text-[11px] text-foreground" />
                                                            </TableCell>
                                                            <TableCell className="py-1">
                                                              <input type="text" value={cfg.rpe} onChange={(e) => updateSessionExerciseConfig(ci, wi, si, cfg.exerciseId, "rpe", e.target.value)} placeholder="8" className="w-full rounded border border-border bg-background px-1 py-0.5 text-[11px] text-foreground" />
                                                            </TableCell>
                                                            <TableCell className="py-1">
                                                              <input type="text" value={cfg.charge} onChange={(e) => updateSessionExerciseConfig(ci, wi, si, cfg.exerciseId, "charge", e.target.value)} placeholder="75%" className="w-full rounded border border-border bg-background px-1 py-0.5 text-[11px] text-foreground" />
                                                            </TableCell>
                                                            <TableCell className="py-1">
                                                              <input type="text" value={cfg.tempo} onChange={(e) => updateSessionExerciseConfig(ci, wi, si, cfg.exerciseId, "tempo", e.target.value)} placeholder="3010" className="w-full rounded border border-border bg-background px-1 py-0.5 text-[11px] text-foreground" />
                                                            </TableCell>
                                                            <TableCell className="py-1">
                                                              <input type="text" value={cfg.commentaire} onChange={(e) => updateSessionExerciseConfig(ci, wi, si, cfg.exerciseId, "commentaire", e.target.value)} placeholder="" className="w-full rounded border border-border bg-background px-1 py-0.5 text-[11px] text-foreground" />
                                                            </TableCell>
                                                            <TableCell className="py-1">
                                                              <input type="text" value={cfg.series} onChange={(e) => updateSessionExerciseConfig(ci, wi, si, cfg.exerciseId, "series", e.target.value)} placeholder="4" className="w-full rounded border border-border bg-background px-1 py-0.5 text-[11px] text-foreground" />
                                                            </TableCell>
                                                            <TableCell className="py-1">
                                                              <button type="button" onClick={() => removeExerciseFromSession(ci, wi, si, cfg.exerciseId)} className="text-muted-foreground hover:text-destructive transition-colors">
                                                                <X className="h-3 w-3" />
                                                              </button>
                                                            </TableCell>
                                                          </TableRow>
                                                          {seriesCount > 1 && (
                                                            <TableRow className="h-6 border-0">
                                                              <TableCell colSpan={9} className="py-0 px-1">
                                                                <button
                                                                  type="button"
                                                                  onClick={() => toggleMethodoSeriesExpanded(seriesKey)}
                                                                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                                                                >
                                                                  {isSeriesExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                                  {isSeriesExpanded ? "Masquer" : "Afficher"} les détails des {seriesCount} séries
                                                                </button>
                                                              </TableCell>
                                                            </TableRow>
                                                          )}
                                                          {seriesCount > 1 && isSeriesExpanded && cfg.serieDetails.map((sd, sdIdx) => (
                                                            <TableRow key={sdIdx} className="h-7 bg-muted/20 border-0">
                                                              <TableCell className="py-0.5 pl-4 text-[10px] text-muted-foreground">S{sdIdx + 1}</TableCell>
                                                              <TableCell className="py-0.5">
                                                                <Select value={sd.recuperation} onValueChange={(v) => updateSerieDetail(ci, wi, si, cfg.exerciseId, sdIdx, "recuperation", v)}>
                                                                  <SelectTrigger className="h-5 text-[10px] px-1 min-w-[55px]">
                                                                    <SelectValue placeholder="Récup" />
                                                                  </SelectTrigger>
                                                                  <SelectContent>
                                                                    {RECUPERATION_OPTIONS.map(opt => (
                                                                      <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                                                                    ))}
                                                                  </SelectContent>
                                                                </Select>
                                                              </TableCell>
                                                              <TableCell className="py-0.5">
                                                                <input type="text" value={sd.reps} onChange={(e) => updateSerieDetail(ci, wi, si, cfg.exerciseId, sdIdx, "reps", e.target.value)} placeholder={cfg.reps || "8"} className="w-full rounded border border-border bg-background px-1 py-0 text-[10px] text-foreground h-5" />
                                                              </TableCell>
                                                              <TableCell className="py-0.5">
                                                                <input type="text" value={sd.rpe} onChange={(e) => updateSerieDetail(ci, wi, si, cfg.exerciseId, sdIdx, "rpe", e.target.value)} placeholder={cfg.rpe || "8"} className="w-full rounded border border-border bg-background px-1 py-0 text-[10px] text-foreground h-5" />
                                                              </TableCell>
                                                              <TableCell className="py-0.5">
                                                                <input type="text" value={sd.charge} onChange={(e) => updateSerieDetail(ci, wi, si, cfg.exerciseId, sdIdx, "charge", e.target.value)} placeholder={cfg.charge || "75%"} className="w-full rounded border border-border bg-background px-1 py-0 text-[10px] text-foreground h-5" />
                                                              </TableCell>
                                                              <TableCell className="py-0.5">
                                                                <input type="text" value={sd.tempo} onChange={(e) => updateSerieDetail(ci, wi, si, cfg.exerciseId, sdIdx, "tempo", e.target.value)} placeholder={cfg.tempo || "3010"} className="w-full rounded border border-border bg-background px-1 py-0 text-[10px] text-foreground h-5" />
                                                              </TableCell>
                                                              <TableCell className="py-0.5">
                                                                <input type="text" value={sd.commentaire} onChange={(e) => updateSerieDetail(ci, wi, si, cfg.exerciseId, sdIdx, "commentaire", e.target.value)} placeholder="" className="w-full rounded border border-border bg-background px-1 py-0 text-[10px] text-foreground h-5" />
                                                              </TableCell>
                                                              <TableCell className="py-0.5"></TableCell>
                                                              <TableCell className="py-0.5"></TableCell>
                                                            </TableRow>
                                                          ))}
                                                        </React.Fragment>
                                                      );
                                                    })}
                                                  </TableBody>
                                                </Table>
                                              </div>
                                            )}
                                            {availableToAdd.length > 0 && (
                                              <div className="pt-0.5">
                                                <select
                                                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                                                  value=""
                                                  onChange={(e) => {
                                                    if (e.target.value) addExerciseToSession(ci, wi, si, e.target.value);
                                                  }}
                                                >
                                                  <option value="">+ Ajouter un exercice...</option>
                                                  {availableToAdd.map(ex => (
                                                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                                                  ))}
                                                </select>
                                              </div>
                                            )}
                                            {selectedExercises.length === 0 && (
                                              <p className="text-[10px] text-muted-foreground/50 italic px-2">Ajoute d'abord des exercices associés ci-dessus</p>
                                            )}
                                          </CollapsibleContent>
                                        </Collapsible>
                                      );
                                    })
                                  ) : (
                                    <div className="px-2 py-0.5 text-xs text-muted-foreground/50 italic">Aucune séance définie</div>
                                  )}
                                </CollapsibleContent>
                              </Collapsible>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  <div>
                    <Label>Résumé de progression</Label>
                    <Textarea value={progressionSummary} onChange={(e) => setProgressionSummary(e.target.value)} placeholder="Ex: Semaine 1 RPE 7-8, Semaine 2 RPE 7.5-8.5..." rows={6} />
                  </div>
                  <div>
                    <Label>Description complète</Label>
                    <Textarea value={fullDescription} onChange={(e) => setFullDescription(e.target.value)} placeholder="Structure détaillée, séries, repos, intensité, adaptations, contraintes..." rows={6} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}