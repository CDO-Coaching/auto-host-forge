import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Save,
  GripVertical,
  Dumbbell,
  Activity,
  Bike,
  Waves,
  Heart,
  Edit,
  Copy,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ExerciseCombobox } from "@/components/ExerciseCombobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CardioStepBuilder, CardioStep, CardioData, CardioBlock } from "@/components/CardioStepBuilder";
import { calculateCardioMetrics } from "@/lib/cardioCalculations";
import { useAuth } from "@/contexts/AuthContext";

interface SessionTemplate {
  id: string;
  name: string;
  session_type: "renfo" | "cardio" | "recup";
  cardio_sport?: "course" | "velo" | "natation" | null;
  description?: string;
  created_at: string;
}

interface TemplateExercise {
  id: string;
  exercice: string;
  series: string;
  reps: string;
  charge: string;
  recuperation: string;
  rpe: string;
  tempo: string;
  commentaire: string;
  ordre: number;
  is_duration?: boolean;
  per_side?: boolean;
  cardio_content?: string;
  cardio_sport?: string;
  cardio_pace?: string;
}

// Local exercise type for editing (before saving to DB)
interface LocalExercise {
  id: number;
  exercice: string;
  series: string;
  reps: string;
  charge: string;
  recuperation: string;
  rpe: string;
  tempo: string;
  commentaire: string;
  is_duration?: boolean;
  per_side?: boolean;
  is_unilateral?: boolean;
  cardio_content?: string;
  cardio_sport?: string;
  cardio_pace?: string;
}

export default function SeancesProgrammees() {
  const { session: authSession } = useAuth();
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"renfo" | "course" | "velo" | "natation">("renfo");
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [templateExercises, setTemplateExercises] = useState<Record<string, TemplateExercise[]>>({});
  const [libraryExercises, setLibraryExercises] = useState<Array<{ id: string; name: string; unilateral?: boolean; category?: string }>>([]);
  
  // Create/Edit dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SessionTemplate | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [localExercises, setLocalExercises] = useState<LocalExercise[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<SessionTemplate | null>(null);

  const recuperationOptions = [
    { value: "30s", label: "30 secondes" },
    { value: "35s", label: "35 secondes" },
    { value: "40s", label: "40 secondes" },
    { value: "45s", label: "45 secondes" },
    { value: "50s", label: "50 secondes" },
    { value: "55s", label: "55 secondes" },
    { value: "1min", label: "1 minute" },
    { value: "1min30s", label: "1 min 30 sec" },
    { value: "2min", label: "2 minutes" },
    { value: "2min30s", label: "2 min 30 sec" },
    { value: "3min", label: "3 minutes" },
    { value: "3min30s", label: "3 min 30 sec" },
    { value: "4min", label: "4 minutes" },
    { value: "4min30s", label: "4 min 30 sec" },
    { value: "5min", label: "5 minutes" },
    { value: "emom", label: "EMOM" },
  ];

  useEffect(() => {
    loadTemplates();
    loadLibraryExercises();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("session_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur lors du chargement des templates:", error);
      toast.error("Erreur lors du chargement des séances programmées");
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  };

  const loadLibraryExercises = async () => {
    const { data, error } = await supabase
      .from("exercise_library")
      .select("id, name, unilateral, category")
      .order("name");

    if (!error && data) {
      setLibraryExercises(data);
    }
  };

  const loadTemplateExercises = async (templateId: string) => {
    const { data, error } = await supabase
      .from("session_template_exercises")
      .select("*")
      .eq("template_id", templateId)
      .order("ordre", { ascending: true });

    if (!error && data) {
      setTemplateExercises(prev => ({
        ...prev,
        [templateId]: data
      }));
    }
  };

  const handleExpandTemplate = (templateId: string) => {
    if (expandedTemplateId === templateId) {
      setExpandedTemplateId(null);
    } else {
      setExpandedTemplateId(templateId);
      if (!templateExercises[templateId]) {
        loadTemplateExercises(templateId);
      }
    }
  };

  const getSessionTypeForTab = (): { session_type: "renfo" | "cardio" | "recup"; cardio_sport?: string } => {
    switch (activeTab) {
      case "renfo":
        return { session_type: "renfo" };
      case "course":
        return { session_type: "cardio", cardio_sport: "course" };
      case "velo":
        return { session_type: "cardio", cardio_sport: "velo" };
      case "natation":
        return { session_type: "cardio", cardio_sport: "natation" };
      default:
        return { session_type: "renfo" };
    }
  };

  const filteredTemplates = templates.filter(t => {
    if (activeTab === "renfo") {
      return t.session_type === "renfo";
    }
    return t.session_type === "cardio" && t.cardio_sport === activeTab;
  });

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setNewTemplateName("");
    setNewTemplateDescription("");
    
    const typeConfig = getSessionTypeForTab();
    if (typeConfig.session_type === "cardio") {
      // Pour les séances cardio, ajouter un exercice cardio par défaut
      setLocalExercises([{
        id: 1,
        exercice: "Séance Cardio",
        series: "",
        reps: "",
        charge: "",
        recuperation: "",
        rpe: "",
        tempo: "",
        commentaire: "",
        cardio_sport: typeConfig.cardio_sport,
        cardio_content: "",
      }]);
    } else {
      setLocalExercises([]);
    }
    setShowCreateDialog(true);
  };

  const handleEditTemplate = async (template: SessionTemplate) => {
    setEditingTemplate(template);
    setNewTemplateName(template.name);
    setNewTemplateDescription(template.description || "");
    
    // Charger les exercices
    const { data } = await supabase
      .from("session_template_exercises")
      .select("*")
      .eq("template_id", template.id)
      .order("ordre", { ascending: true });

    if (data) {
      setLocalExercises(data.map((ex, idx) => ({
        id: idx + 1,
        exercice: ex.exercice,
        series: ex.series || "",
        reps: ex.reps || "",
        charge: ex.charge || "",
        recuperation: ex.recuperation || "",
        rpe: ex.rpe || "",
        tempo: ex.tempo || "",
        commentaire: ex.commentaire || "",
        is_duration: ex.is_duration || false,
        per_side: ex.per_side || false,
        cardio_content: ex.cardio_content ? JSON.stringify(ex.cardio_content) : "",
        cardio_sport: ex.cardio_sport || "",
        cardio_pace: ex.cardio_pace || "",
      })));
    }
    setShowCreateDialog(true);
  };

  const handleDuplicateTemplate = async (template: SessionTemplate) => {
    // Charger les exercices de la template source
    const { data: exercises } = await supabase
      .from("session_template_exercises")
      .select("*")
      .eq("template_id", template.id)
      .order("ordre", { ascending: true });

    // Créer une nouvelle template
    const { data: newTemplate, error: createError } = await supabase
      .from("session_templates")
      .insert({
        coach_id: authSession?.user?.id,
        name: `${template.name} (copie)`,
        session_type: template.session_type,
        cardio_sport: template.cardio_sport,
        description: template.description,
      })
      .select()
      .single();

    if (createError || !newTemplate) {
      toast.error("Erreur lors de la duplication");
      return;
    }

    // Copier les exercices
    if (exercises && exercises.length > 0) {
      const exercisesToInsert = exercises.map(ex => ({
        template_id: newTemplate.id,
        exercice: ex.exercice,
        series: ex.series,
        reps: ex.reps,
        charge: ex.charge,
        recuperation: ex.recuperation,
        rpe: ex.rpe,
        tempo: ex.tempo,
        commentaire: ex.commentaire,
        ordre: ex.ordre,
        is_duration: ex.is_duration,
        per_side: ex.per_side,
        cardio_content: ex.cardio_content,
        cardio_sport: ex.cardio_sport,
        cardio_pace: ex.cardio_pace,
      }));

      await supabase.from("session_template_exercises").insert(exercisesToInsert);
    }

    toast.success("Template dupliquée");
    loadTemplates();
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }

    setIsSaving(true);

    try {
      const typeConfig = getSessionTypeForTab();
      let cardioMetrics = {};

      // Calculer les métriques cardio si c'est une séance cardio
      if (typeConfig.session_type === "cardio" && localExercises.length > 0) {
        const cardioExercise = localExercises.find(ex => ex.cardio_content);
        if (cardioExercise?.cardio_content) {
          try {
            const cardioData = JSON.parse(cardioExercise.cardio_content);
            const metrics = calculateCardioMetrics(cardioData, null);
            cardioMetrics = {
              cardio_total_distance_km: metrics.totalDistanceKm,
              cardio_total_duration_minutes: metrics.totalDurationMinutes,
              cardio_average_intensity: metrics.averageIntensity,
            };
          } catch (e) {
            console.error("Error parsing cardio content:", e);
          }
        }
      }

      if (editingTemplate) {
        // Update existing template
        const { error: updateError } = await supabase
          .from("session_templates")
          .update({
            name: newTemplateName,
            description: newTemplateDescription,
            ...cardioMetrics,
          })
          .eq("id", editingTemplate.id);

        if (updateError) throw updateError;

        // Supprimer les anciens exercices et réinsérer
        await supabase
          .from("session_template_exercises")
          .delete()
          .eq("template_id", editingTemplate.id);

        if (localExercises.length > 0) {
          const exercisesToInsert = localExercises.map((ex, idx) => ({
            template_id: editingTemplate.id,
            exercice: ex.exercice,
            series: ex.series,
            reps: ex.reps,
            charge: ex.charge,
            recuperation: ex.recuperation,
            rpe: ex.rpe,
            tempo: ex.tempo,
            commentaire: ex.commentaire,
            ordre: idx,
            is_duration: ex.is_duration || false,
            per_side: ex.per_side || false,
            cardio_content: ex.cardio_content ? JSON.parse(ex.cardio_content) : null,
            cardio_sport: ex.cardio_sport || null,
            cardio_pace: ex.cardio_pace || null,
          }));

          await supabase.from("session_template_exercises").insert(exercisesToInsert);
        }

        toast.success("Template mise à jour");
      } else {
        // Create new template
        const { data: newTemplate, error: createError } = await supabase
          .from("session_templates")
          .insert({
            coach_id: authSession?.user?.id,
            name: newTemplateName,
            session_type: typeConfig.session_type,
            cardio_sport: typeConfig.cardio_sport || null,
            description: newTemplateDescription,
            ...cardioMetrics,
          })
          .select()
          .single();

        if (createError || !newTemplate) throw createError;

        // Insérer les exercices
        if (localExercises.length > 0) {
          const exercisesToInsert = localExercises.map((ex, idx) => ({
            template_id: newTemplate.id,
            exercice: ex.exercice,
            series: ex.series,
            reps: ex.reps,
            charge: ex.charge,
            recuperation: ex.recuperation,
            rpe: ex.rpe,
            tempo: ex.tempo,
            commentaire: ex.commentaire,
            ordre: idx,
            is_duration: ex.is_duration || false,
            per_side: ex.per_side || false,
            cardio_content: ex.cardio_content ? JSON.parse(ex.cardio_content) : null,
            cardio_sport: ex.cardio_sport || null,
            cardio_pace: ex.cardio_pace || null,
          }));

          await supabase.from("session_template_exercises").insert(exercisesToInsert);
        }

        toast.success("Template créée");
      }

      setShowCreateDialog(false);
      loadTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    const { error } = await supabase
      .from("session_templates")
      .delete()
      .eq("id", templateToDelete.id);

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Template supprimée");
      loadTemplates();
    }
    setShowDeleteDialog(false);
    setTemplateToDelete(null);
  };

  const addExercise = () => {
    const newId = localExercises.length > 0 ? Math.max(...localExercises.map(e => e.id)) + 1 : 1;
    setLocalExercises([...localExercises, {
      id: newId,
      exercice: "",
      series: "",
      reps: "",
      charge: "",
      recuperation: "",
      rpe: "",
      tempo: "",
      commentaire: "",
    }]);
  };

  const removeExercise = (id: number) => {
    setLocalExercises(localExercises.filter(ex => ex.id !== id));
  };

  const handleExerciseChange = (id: number, field: string, value: any) => {
    setLocalExercises(localExercises.map(ex => {
      if (ex.id === id) {
        // Si on change l'exercice, vérifier s'il est unilatéral
        if (field === "exercice") {
          const libraryExercise = libraryExercises.find(le => le.name === value);
          return { ...ex, [field]: value, is_unilateral: libraryExercise?.unilateral || false };
        }
        return { ...ex, [field]: value };
      }
      return ex;
    }));
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case "renfo": return <Dumbbell className="h-4 w-4" />;
      case "course": return <Activity className="h-4 w-4" />;
      case "velo": return <Bike className="h-4 w-4" />;
      case "natation": return <Waves className="h-4 w-4" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Séances programmées</h1>
          <p className="text-muted-foreground">
            Créez des templates de séances réutilisables pour vos athlètes
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="renfo" className="flex items-center gap-2">
            {getTabIcon("renfo")}
            <span className="hidden sm:inline">Renforcement</span>
            <span className="sm:hidden">Renfo</span>
          </TabsTrigger>
          <TabsTrigger value="course" className="flex items-center gap-2">
            {getTabIcon("course")}
            <span className="hidden sm:inline">Course</span>
            <span className="sm:hidden">Course</span>
          </TabsTrigger>
          <TabsTrigger value="velo" className="flex items-center gap-2">
            {getTabIcon("velo")}
            <span className="hidden sm:inline">Vélo</span>
            <span className="sm:hidden">Vélo</span>
          </TabsTrigger>
          <TabsTrigger value="natation" className="flex items-center gap-2">
            {getTabIcon("natation")}
            <span className="hidden sm:inline">Natation</span>
            <span className="sm:hidden">Nat.</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="flex justify-end mb-4">
            <Button onClick={handleCreateTemplate}>
              <Plus className="h-4 w-4 mr-2" />
              Créer une séance
            </Button>
          </div>

          {filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                {getTabIcon(activeTab)}
                <p className="text-muted-foreground mt-4">
                  Aucune séance programmée pour cette catégorie
                </p>
                <Button onClick={handleCreateTemplate} className="mt-4" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Créer ma première séance
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredTemplates.map((template) => (
                <Card key={template.id}>
                  <Collapsible
                    open={expandedTemplateId === template.id}
                    onOpenChange={() => handleExpandTemplate(template.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {expandedTemplateId === template.id ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                            <div>
                              <CardTitle className="text-lg">{template.name}</CardTitle>
                              {template.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {template.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateTemplate(template);
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditTemplate(template);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTemplateToDelete(template);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        {templateExercises[template.id] ? (
                          template.session_type === "cardio" ? (
                            <div className="space-y-4">
                                {templateExercises[template.id].map((ex) => (
                                <div key={ex.id} className="p-4 border rounded-lg">
                                  {ex.cardio_content && (() => {
                                    const cardioData = typeof ex.cardio_content === 'string' 
                                      ? JSON.parse(ex.cardio_content) 
                                      : ex.cardio_content;
                                    return (
                                      <CardioStepBuilder
                                        steps={cardioData.steps || []}
                                        blocks={cardioData.blocks || []}
                                        onChange={() => {}}
                                        sportType={ex.cardio_sport as any || "course"}
                                        athleteVma={null}
                                        disabled={true}
                                      />
                                    );
                                  })()}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Exercice</TableHead>
                                  <TableHead>Récup</TableHead>
                                  <TableHead>Reps</TableHead>
                                  <TableHead>Séries</TableHead>
                                  <TableHead>RPE</TableHead>
                                  <TableHead>Tempo</TableHead>
                                  <TableHead>Charge</TableHead>
                                  <TableHead>Commentaire</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {templateExercises[template.id].map((ex) => (
                                  <TableRow key={ex.id}>
                                    <TableCell className="font-medium">
                                      {ex.exercice}
                                      {ex.per_side && (
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          par côté
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>{ex.recuperation}</TableCell>
                                    <TableCell>
                                      {ex.reps}
                                      {ex.is_duration && <span className="text-xs text-muted-foreground ml-1">(sec)</span>}
                                    </TableCell>
                                    <TableCell>{ex.series}</TableCell>
                                    <TableCell>{ex.rpe}</TableCell>
                                    <TableCell>{ex.tempo}</TableCell>
                                    <TableCell>{ex.charge}</TableCell>
                                    <TableCell className="max-w-[200px] truncate">
                                      {ex.commentaire}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )
                        ) : (
                          <p className="text-muted-foreground text-center py-4">
                            Chargement des exercices...
                          </p>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Modifier la séance" : "Créer une nouvelle séance"}
            </DialogTitle>
            <DialogDescription>
              {activeTab === "renfo" 
                ? "Créez une séance de renforcement réutilisable"
                : `Créez une séance de ${activeTab} réutilisable`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid gap-4">
              <div>
                <label className="text-sm font-medium">Nom de la séance</label>
                <Input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Ex: Full Body Débutant, Fractionné 30/30..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description (optionnel)</label>
                <Textarea
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  placeholder="Description de la séance..."
                  rows={2}
                />
              </div>
            </div>

            {activeTab === "renfo" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Exercices</h4>
                  <Button onClick={addExercise} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un exercice
                  </Button>
                </div>

                {localExercises.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    Aucun exercice. Cliquez sur "Ajouter un exercice" pour commencer.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">Exercice</TableHead>
                          <TableHead>Récup</TableHead>
                          <TableHead>Reps</TableHead>
                          <TableHead>Séries</TableHead>
                          <TableHead>RPE</TableHead>
                          <TableHead>Tempo</TableHead>
                          <TableHead>Charge</TableHead>
                          <TableHead>Commentaire</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {localExercises.map((exercise) => (
                          <TableRow key={exercise.id}>
                            <TableCell>
                              <div className="space-y-2">
                                <ExerciseCombobox
                                  value={exercise.exercice}
                                  onChange={(value) => handleExerciseChange(exercise.id, "exercice", value)}
                                  exercises={libraryExercises}
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={exercise.recuperation}
                                onValueChange={(value) => handleExerciseChange(exercise.id, "recuperation", value)}
                              >
                                <SelectTrigger className="w-[100px]">
                                  <SelectValue placeholder="Récup" />
                                </SelectTrigger>
                                <SelectContent>
                                  {recuperationOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-2">
                                <Input
                                  value={exercise.reps}
                                  onChange={(e) => handleExerciseChange(exercise.id, "reps", e.target.value)}
                                  placeholder={exercise.is_duration ? "sec" : "reps"}
                                  className="w-[70px]"
                                />
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={exercise.is_duration || false}
                                    onCheckedChange={(checked) => handleExerciseChange(exercise.id, "is_duration", checked)}
                                  />
                                  <span className="text-xs">sec</span>
                                </div>
                                {exercise.is_unilateral && (
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={exercise.per_side || false}
                                      onCheckedChange={(checked) => handleExerciseChange(exercise.id, "per_side", checked)}
                                    />
                                    <span className="text-xs">côté</span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={exercise.series}
                                onChange={(e) => handleExerciseChange(exercise.id, "series", e.target.value)}
                                placeholder="3"
                                className="w-[60px]"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={exercise.rpe}
                                onChange={(e) => handleExerciseChange(exercise.id, "rpe", e.target.value)}
                                placeholder="7"
                                className="w-[60px]"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={exercise.tempo}
                                onChange={(e) => handleExerciseChange(exercise.id, "tempo", e.target.value)}
                                placeholder="3010"
                                className="w-[70px]"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={exercise.charge}
                                onChange={(e) => handleExerciseChange(exercise.id, "charge", e.target.value)}
                                placeholder="kg"
                                className="w-[70px]"
                              />
                            </TableCell>
                            <TableCell>
                              <Textarea
                                value={exercise.commentaire}
                                onChange={(e) => handleExerciseChange(exercise.id, "commentaire", e.target.value)}
                                placeholder="Notes..."
                                className="min-w-[120px]"
                                rows={1}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeExercise(exercise.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="font-medium">Structure de la séance</h4>
                {localExercises.length > 0 && localExercises[0] && (() => {
                  const cardioData = localExercises[0].cardio_content 
                    ? JSON.parse(localExercises[0].cardio_content) 
                    : { steps: [], blocks: [] };
                  return (
                    <CardioStepBuilder
                      steps={cardioData.steps || []}
                      blocks={cardioData.blocks || []}
                      onChange={(data) => {
                        setLocalExercises([{
                          ...localExercises[0],
                          cardio_content: JSON.stringify(data),
                        }]);
                      }}
                      sportType={activeTab as "course" | "velo" | "natation"}
                      athleteVma={null}
                    />
                  );
                })()}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isSaving}>
              {isSaving ? "Enregistrement..." : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {editingTemplate ? "Mettre à jour" : "Créer"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer cette séance ?</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. La séance "{templateToDelete?.name}" sera définitivement supprimée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteTemplate}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
