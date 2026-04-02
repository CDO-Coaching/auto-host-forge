import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Search, Eye, ChevronDown, ChevronUp } from "lucide-react";

const THEMES = [
  { value: "endurance", label: "Endurance", color: "hsl(200, 70%, 50%)" },
  { value: "force", label: "Force", color: "hsl(0, 70%, 50%)" },
  { value: "hypertrophie", label: "Hypertrophie", color: "hsl(280, 70%, 50%)" },
  { value: "rehabilitation", label: "Réhabilitation", color: "hsl(150, 70%, 45%)" },
  { value: "mobilite", label: "Mobilité", color: "hsl(40, 80%, 50%)" },
  { value: "explosivite", label: "Explosivité", color: "hsl(25, 90%, 55%)" },
] as const;

type ThemeValue = typeof THEMES[number]["value"];

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
  const [search, setSearch] = useState("");
  const [filterTheme, setFilterTheme] = useState<ThemeValue | null>(null);
  const [saving, setSaving] = useState(false);

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

    if (ids.length > 0) {
      const { data: themesData } = await supabase
        .from("methodology_themes")
        .select("*")
        .in("methodology_id", ids);

      (themesData || []).forEach((t: any) => {
        if (!themesMap[t.methodology_id]) themesMap[t.methodology_id] = [];
        themesMap[t.methodology_id].push(t.theme);
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
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchMethodologies();
  }, [session?.user?.id]);

  const openCreate = () => {
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
    setDialogOpen(true);
  };

  const openView = (m: Methodology) => {
    setViewingMethodology(m);
    setViewDialogOpen(true);
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
        updated_at: new Date().toISOString(),
      };

      let methId = editingId;

      if (editingId) {
        const { error } = await supabase.from("coaching_methodologies").update(payload).eq("id", editingId);
        if (error) throw error;
        await supabase.from("methodology_themes").delete().eq("methodology_id", editingId);
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
      const { error: themeError } = await supabase.from("methodology_themes").insert(themeRows);
      if (themeError) throw themeError;

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
                        {m.duration_weeks_min && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                            {m.duration_weeks_min}{m.duration_weeks_max && m.duration_weeks_max !== m.duration_weeks_min ? `–${m.duration_weeks_max}` : ""} sem.
                          </span>
                        )}
                        {m.rpe_target_min && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                            RPE {m.rpe_target_min}{m.rpe_target_max ? `–${m.rpe_target_max}` : ""}
                          </span>
                        )}
                      </div>
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
                  {viewingMethodology.duration_weeks_min && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Durée</p>
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier la méthodologie" : "Nouvelle méthodologie"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Méthode 3/7 ondulatoire" />
            </div>
            <div>
              <Label>Description courte</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Résumé en une ou deux phrases..." rows={2} />
            </div>
            <div>
              <Label>Thèmes *</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {THEMES.map((t) => (
                  <label
                    key={t.value}
                    className="flex items-center gap-2 cursor-pointer rounded-lg border p-2 transition-colors"
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Durée min (semaines)</Label>
                <Input type="number" min="1" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} placeholder="3" />
              </div>
              <div>
                <Label>Durée max (semaines)</Label>
                <Input type="number" min="1" value={durationMax} onChange={(e) => setDurationMax(e.target.value)} placeholder="5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>RPE cible min</Label>
                <Input type="number" min="1" max="10" step="0.5" value={rpeMin} onChange={(e) => setRpeMin(e.target.value)} placeholder="7" />
              </div>
              <div>
                <Label>RPE cible max</Label>
                <Input type="number" min="1" max="10" step="0.5" value={rpeMax} onChange={(e) => setRpeMax(e.target.value)} placeholder="9.5" />
              </div>
            </div>
            <div>
              <Label>Résumé de progression</Label>
              <Textarea value={progressionSummary} onChange={(e) => setProgressionSummary(e.target.value)} placeholder="Ex: Semaine 1 RPE 7-8, Semaine 2 RPE 7.5-8.5..." rows={3} />
            </div>
            <div>
              <Label>Description complète</Label>
              <Textarea value={fullDescription} onChange={(e) => setFullDescription(e.target.value)} placeholder="Structure détaillée, séries, repos, intensité, adaptations, contraintes..." rows={8} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement..." : editingId ? "Modifier" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
