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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Eye, Check, ChevronDown, ChevronUp, FlaskConical, Pencil } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const THEMES = [
  { value: "endurance", label: "Endurance", color: "hsl(200, 70%, 50%)" },
  { value: "force", label: "Force", color: "hsl(0, 70%, 50%)" },
  { value: "hypertrophie", label: "Hypertrophie", color: "hsl(280, 70%, 50%)" },
  { value: "rehabilitation", label: "Réhabilitation", color: "hsl(150, 70%, 45%)" },
  { value: "mobilite", label: "Mobilité", color: "hsl(40, 80%, 50%)" },
  { value: "explosivite", label: "Explosivité", color: "hsl(25, 90%, 55%)" },
] as const;

interface Assignment {
  id: string;
  methodology_id: string;
  methodology_name: string;
  methodology_description: string | null;
  methodology_full_description: string | null;
  methodology_themes: string[];
  total_weeks: number;
  start_date: string;
  status: string;
  notes: string | null;
  weeks: WeekTracking[];
}

interface WeekTracking {
  id: string;
  week_number: number;
  completed: boolean;
  observed_rpe: number | null;
  coach_notes: string | null;
  completed_at: string | null;
}

interface MethodologyOption {
  id: string;
  name: string;
  description: string | null;
  duration_weeks_min: number | null;
  duration_weeks_max: number | null;
  themes: string[];
}

interface Props {
  athleteId: string;
  athleteName: string;
}

export function CoachAthleteMethodologies({ athleteId, athleteName }: Props) {
  const { session } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [methodologyOptions, setMethodologyOptions] = useState<MethodologyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingAssignment, setViewingAssignment] = useState<Assignment | null>(null);
  const [selectedMethodology, setSelectedMethodology] = useState("");
  const [totalWeeks, setTotalWeeks] = useState("4");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [assignNotes, setAssignNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedAssignment, setExpandedAssignment] = useState<string | null>(null);

  const fetchData = async () => {
    if (!session?.user?.id) return;
    setLoading(true);

    // Fetch methodologies for dropdown
    const { data: methData } = await supabase
      .from("coaching_methodologies")
      .select("id, name, description, duration_weeks_min, duration_weeks_max")
      .eq("coach_id", session.user.id)
      .order("name");

    if (methData) {
      const ids = methData.map(m => m.id);
      let themesMap: Record<string, string[]> = {};
      if (ids.length > 0) {
        const { data: themesData } = await supabase.from("methodology_themes").select("*").in("methodology_id", ids);
        (themesData || []).forEach((t: any) => {
          if (!themesMap[t.methodology_id]) themesMap[t.methodology_id] = [];
          themesMap[t.methodology_id].push(t.theme);
        });
      }
      setMethodologyOptions(methData.map(m => ({ ...m, themes: themesMap[m.id] || [] })));
    }

    // Fetch assignments for this athlete
    const { data: assignData } = await supabase
      .from("athlete_methodology_assignments")
      .select("*")
      .eq("athlete_id", athleteId)
      .eq("coach_id", session.user.id)
      .order("created_at", { ascending: false });

    if (assignData && assignData.length > 0) {
      const assignIds = assignData.map(a => a.id);
      const methIds = assignData.map(a => a.methodology_id);

      // Fetch weeks
      const { data: weeksData } = await supabase
        .from("athlete_methodology_weeks")
        .select("*")
        .in("assignment_id", assignIds)
        .order("week_number");

      // Fetch methodology details
      const { data: methDetails } = await supabase
        .from("coaching_methodologies")
        .select("id, name, description, full_description")
        .in("id", methIds);

      // Fetch themes
      let themesMap: Record<string, string[]> = {};
      if (methIds.length > 0) {
        const { data: themesData } = await supabase.from("methodology_themes").select("*").in("methodology_id", methIds);
        (themesData || []).forEach((t: any) => {
          if (!themesMap[t.methodology_id]) themesMap[t.methodology_id] = [];
          themesMap[t.methodology_id].push(t.theme);
        });
      }

      const methMap = Object.fromEntries((methDetails || []).map(m => [m.id, m]));
      const weeksMap: Record<string, WeekTracking[]> = {};
      (weeksData || []).forEach((w: any) => {
        if (!weeksMap[w.assignment_id]) weeksMap[w.assignment_id] = [];
        weeksMap[w.assignment_id].push(w);
      });

      setAssignments(assignData.map(a => {
        const meth = methMap[a.methodology_id];
        return {
          id: a.id,
          methodology_id: a.methodology_id,
          methodology_name: meth?.name || "Inconnue",
          methodology_description: meth?.description || null,
          methodology_full_description: meth?.full_description || null,
          methodology_themes: themesMap[a.methodology_id] || [],
          total_weeks: a.total_weeks,
          start_date: a.start_date,
          status: a.status,
          notes: a.notes,
          weeks: weeksMap[a.id] || [],
        };
      }));
    } else {
      setAssignments([]);
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [session?.user?.id, athleteId]);

  const handleAssign = async () => {
    if (!selectedMethodology || !totalWeeks || !session?.user?.id) return;
    setSaving(true);

    try {
      const { data: assignment, error } = await supabase
        .from("athlete_methodology_assignments")
        .insert({
          coach_id: session.user.id,
          athlete_id: athleteId,
          methodology_id: selectedMethodology,
          total_weeks: parseInt(totalWeeks),
          start_date: startDate,
          notes: assignNotes.trim() || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Create week tracking rows
      const weekRows = Array.from({ length: parseInt(totalWeeks) }, (_, i) => ({
        assignment_id: assignment.id,
        week_number: i + 1,
      }));
      await supabase.from("athlete_methodology_weeks").insert(weekRows);

      toast.success("Méthodologie assignée");
      setAssignDialogOpen(false);
      setSelectedMethodology("");
      setTotalWeeks("4");
      setAssignNotes("");
      fetchData();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message || "inconnue"));
    } finally {
      setSaving(false);
    }
  };

  const toggleWeekCompleted = async (weekId: string, completed: boolean) => {
    const { error } = await supabase
      .from("athlete_methodology_weeks")
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq("id", weekId);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      fetchData();
    }
  };

  const updateWeekRpe = async (weekId: string, rpe: string) => {
    const { error } = await supabase
      .from("athlete_methodology_weeks")
      .update({ observed_rpe: rpe ? parseFloat(rpe) : null })
      .eq("id", weekId);
    if (!error) fetchData();
  };

  const updateWeekNotes = async (weekId: string, notes: string) => {
    const { error } = await supabase
      .from("athlete_methodology_weeks")
      .update({ coach_notes: notes.trim() || null })
      .eq("id", weekId);
    if (!error) fetchData();
  };

  const removeAssignment = async (id: string) => {
    if (!confirm("Supprimer cette assignation ?")) return;
    const { error } = await supabase.from("athlete_methodology_assignments").delete().eq("id", id);
    if (error) {
      toast.error("Erreur");
    } else {
      toast.success("Assignation supprimée");
      fetchData();
    }
  };

  const completeAssignment = async (id: string) => {
    const { error } = await supabase
      .from("athlete_methodology_assignments")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) { toast.success("Méthodologie terminée"); fetchData(); }
  };

  const getThemeInfo = (value: string) => THEMES.find((t) => t.value === value);

  const getCompletedWeeks = (weeks: WeekTracking[]) => weeks.filter(w => w.completed).length;

  if (loading) {
    return <p className="text-muted-foreground text-center py-8">Chargement...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FlaskConical className="h-4 w-4" />
          Méthodologies assignées
        </h3>
        <Button size="sm" variant="outline" onClick={() => setAssignDialogOpen(true)} disabled={methodologyOptions.length === 0}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Assigner
        </Button>
      </div>

      {methodologyOptions.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Crée d'abord des méthodologies dans la page dédiée.
        </p>
      )}

      {assignments.length === 0 && methodologyOptions.length > 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Aucune méthodologie assignée à ce sportif.
        </p>
      )}

      {assignments.map((a) => {
        const completedWeeks = getCompletedWeeks(a.weeks);
        const progress = a.total_weeks > 0 ? Math.round((completedWeeks / a.total_weeks) * 100) : 0;
        const isExpanded = expandedAssignment === a.id;

        return (
          <Card key={a.id} className={a.status === "completed" ? "opacity-60" : ""}>
            <Collapsible open={isExpanded} onOpenChange={() => setExpandedAssignment(isExpanded ? null : a.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CollapsibleTrigger className="flex items-start gap-2 text-left flex-1">
                    <div className="mt-0.5">
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-sm">{a.methodology_name}</CardTitle>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-xs text-muted-foreground">{completedWeeks}/{a.total_weeks} sem.</span>
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${progress}%`,
                              backgroundColor: a.status === "completed" ? "hsl(var(--primary))" : progress >= 100 ? "hsl(150, 70%, 45%)" : "hsl(200, 70%, 50%)",
                            }}
                          />
                        </div>
                        {a.status === "completed" && <Badge variant="outline" className="text-[10px] h-4">Terminé</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {a.methodology_themes.map(th => {
                          const info = getThemeInfo(th);
                          return info ? (
                            <span key={th} className="text-[9px] px-1 py-0 rounded-full font-medium" style={{ backgroundColor: `${info.color}20`, color: info.color }}>
                              {info.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <div className="flex gap-1">
                    {a.methodology_full_description && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setViewingAssignment(a); setViewDialogOpen(true); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {a.status !== "completed" && completedWeeks >= a.total_weeks && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => completeAssignment(a.id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeAssignment(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  {a.notes && <p className="text-xs text-muted-foreground mb-3 italic">{a.notes}</p>}
                  <div className="space-y-2">
                    {a.weeks.map((w) => (
                      <div key={w.id} className={`flex items-start gap-2 p-2 rounded-lg border ${w.completed ? "bg-muted/30 border-muted" : "border-border"}`}>
                        <Checkbox
                          checked={w.completed}
                          onCheckedChange={(checked) => toggleWeekCompleted(w.id, !!checked)}
                          className="mt-0.5"
                          disabled={a.status === "completed"}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">Sem. {w.week_number}</span>
                            {w.completed && w.completed_at && (
                              <span className="text-[10px] text-muted-foreground">
                                ✓ {format(new Date(w.completed_at), "dd/MM", { locale: fr })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              max="10"
                              step="0.5"
                              placeholder="RPE"
                              className="h-7 w-16 text-xs"
                              defaultValue={w.observed_rpe?.toString() || ""}
                              onBlur={(e) => updateWeekRpe(w.id, e.target.value)}
                              disabled={a.status === "completed"}
                            />
                            <Input
                              placeholder="Notes..."
                              className="h-7 text-xs flex-1"
                              defaultValue={w.coach_notes || ""}
                              onBlur={(e) => updateWeekNotes(w.id, e.target.value)}
                              disabled={a.status === "completed"}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {/* View full description dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          {viewingAssignment && (
            <>
              <DialogHeader>
                <DialogTitle>{viewingAssignment.methodology_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {viewingAssignment.methodology_description && (
                  <p className="text-sm text-muted-foreground">{viewingAssignment.methodology_description}</p>
                )}
                {viewingAssignment.methodology_full_description && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Description complète</Label>
                    <p className="text-sm whitespace-pre-wrap mt-1">{viewingAssignment.methodology_full_description}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assigner une méthodologie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Méthodologie *</Label>
              <Select value={selectedMethodology} onValueChange={(v) => {
                setSelectedMethodology(v);
                const meth = methodologyOptions.find(m => m.id === v);
                if (meth?.duration_weeks_min) setTotalWeeks(meth.duration_weeks_min.toString());
              }}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {methodologyOptions.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                      {m.duration_weeks_min ? ` (${m.duration_weeks_min}${m.duration_weeks_max && m.duration_weeks_max !== m.duration_weeks_min ? `–${m.duration_weeks_max}` : ""} sem.)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre de semaines *</Label>
                <Input type="number" min="1" max="52" value={totalWeeks} onChange={(e) => setTotalWeeks(e.target.value)} />
              </div>
              <div>
                <Label>Date de début</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} placeholder="Notes pour cette assignation..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleAssign} disabled={saving || !selectedMethodology}>
              {saving ? "Enregistrement..." : "Assigner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
