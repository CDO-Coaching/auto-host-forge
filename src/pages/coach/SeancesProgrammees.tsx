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
  Folder,
  FolderOpen,
  FolderPlus,
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

interface TemplateFolder {
  id: string;
  name: string;
  category: string;
  ordre: number;
}

interface SessionTemplate {
  id: string;
  name: string;
  session_type: "renfo" | "cardio" | "recup";
  cardio_sport?: "course" | "velo" | "natation" | null;
  description?: string;
  created_at: string;
  folder_id?: string | null;
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
  const [folders, setFolders] = useState<TemplateFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"renfo" | "course" | "velo" | "natation">("renfo");
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [templateExercises, setTemplateExercises] = useState<Record<string, TemplateExercise[]>>({});
  const [libraryExercises, setLibraryExercises] = useState<Array<{ id: string; name: string; unilateral?: boolean; category?: string }>>([]);
  
  // Create/Edit dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SessionTemplate | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [localExercises, setLocalExercises] = useState<LocalExercise[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<SessionTemplate | null>(null);
  
  // Folder dialogs
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [editingFolder, setEditingFolder] = useState<TemplateFolder | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showDeleteFolderDialog, setShowDeleteFolderDialog] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<TemplateFolder | null>(null);

  const recuperationOptions = [
    { value: "0s", label: "Aucune" },
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
    loadFolders();
    loadLibraryExercises();
  }, []);

  const loadFolders = async () => {
    const { data, error } = await supabase
      .from("session_template_folders")
      .select("*")
      .order("ordre", { ascending: true });

    if (!error && data) {
      setFolders(data);
    }
  };

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

  const getCategoryForTab = (): string => {
    return activeTab;
  };

  const filteredTemplates = templates.filter(t => {
    if (activeTab === "renfo") {
      return t.session_type === "renfo";
    }
    return t.session_type === "cardio" && t.cardio_sport === activeTab;
  });

  const filteredFolders = folders.filter(f => f.category === activeTab);

  const toggleFolder = (folderId: string) => {
    setExpandedFolderIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const getTemplatesInFolder = (folderId: string) => {
    return filteredTemplates.filter(t => t.folder_id === folderId);
  };

  const getTemplatesWithoutFolder = () => {
    return filteredTemplates.filter(t => !t.folder_id);
  };

  // Folder management
  const handleCreateFolder = () => {
    setEditingFolder(null);
    setNewFolderName("");
    setShowFolderDialog(true);
  };

  const handleEditFolder = (folder: TemplateFolder) => {
    setEditingFolder(folder);
    setNewFolderName(folder.name);
    setShowFolderDialog(true);
  };

  const handleSaveFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Le nom du dossier est obligatoire");
      return;
    }

    if (editingFolder) {
      const { error } = await supabase
        .from("session_template_folders")
        .update({ name: newFolderName })
        .eq("id", editingFolder.id);

      if (error) {
        toast.error("Erreur lors de la modification");
      } else {
        toast.success("Dossier modifié");
        loadFolders();
      }
    } else {
      const { error } = await supabase
        .from("session_template_folders")
        .insert({
          coach_id: authSession?.user?.id,
          name: newFolderName,
          category: getCategoryForTab(),
          ordre: filteredFolders.length,
        });

      if (error) {
        toast.error("Erreur lors de la création");
      } else {
        toast.success("Dossier créé");
        loadFolders();
      }
    }
    setShowFolderDialog(false);
  };

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;

    // Les templates dans ce dossier seront mis à null (ON DELETE SET NULL)
    const { error } = await supabase
      .from("session_template_folders")
      .delete()
      .eq("id", folderToDelete.id);

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Dossier supprimé");
      loadFolders();
      loadTemplates(); // Pour mettre à jour les folder_id des templates
    }
    setShowDeleteFolderDialog(false);
    setFolderToDelete(null);
  };

  const handleCreateTemplate = (folderId?: string) => {
    setEditingTemplate(null);
    setNewTemplateName("");
    setNewTemplateDescription("");
    setSelectedFolderId(folderId || null);
    
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
            folder_id: selectedFolderId,
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
            folder_id: selectedFolderId,
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

  // Composant pour afficher un template
  const TemplateCard = ({ 
    template, 
    expandedTemplateId, 
    templateExercises, 
    onExpand, 
    onEdit, 
    onDuplicate, 
    onDelete 
  }: { 
    template: SessionTemplate;
    expandedTemplateId: string | null;
    templateExercises: Record<string, TemplateExercise[]>;
    onExpand: (id: string) => void;
    onEdit: (t: SessionTemplate) => void;
    onDuplicate: (t: SessionTemplate) => void;
    onDelete: (t: SessionTemplate) => void;
  }) => (
    <Card className="border-l-4 border-l-primary/30">
      <Collapsible
        open={expandedTemplateId === template.id}
        onOpenChange={() => onExpand(template.id)}
      >
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {expandedTemplateId === template.id ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <div>
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  {template.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {template.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(template);
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(template);
                  }}
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(template);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templateExercises[template.id].map((ex) => (
                      <TableRow key={ex.id}>
                        <TableCell className="font-medium uppercase">
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
  );

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
          <div className="flex justify-end gap-2 mb-4">
            <Button variant="outline" onClick={handleCreateFolder}>
              <FolderPlus className="h-4 w-4 mr-2" />
              Créer un dossier
            </Button>
            <Button onClick={() => handleCreateTemplate()}>
              <Plus className="h-4 w-4 mr-2" />
              Créer une séance
            </Button>
          </div>

          {filteredTemplates.length === 0 && filteredFolders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                {getTabIcon(activeTab)}
                <p className="text-muted-foreground mt-4">
                  Aucune séance programmée pour cette catégorie
                </p>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleCreateFolder} variant="outline">
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Créer un dossier
                  </Button>
                  <Button onClick={() => handleCreateTemplate()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer une séance
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Dossiers */}
              {filteredFolders.map((folder) => (
                <Card key={folder.id}>
                  <Collapsible
                    open={expandedFolderIds.has(folder.id)}
                    onOpenChange={() => toggleFolder(folder.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {expandedFolderIds.has(folder.id) ? (
                              <FolderOpen className="h-5 w-5 text-primary" />
                            ) : (
                              <Folder className="h-5 w-5 text-primary" />
                            )}
                            <CardTitle className="text-lg">{folder.name}</CardTitle>
                            <Badge variant="secondary" className="text-xs">
                              {getTemplatesInFolder(folder.id).length} séance{getTemplatesInFolder(folder.id).length > 1 ? 's' : ''}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateTemplate(folder.id);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Ajouter
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditFolder(folder);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFolderToDelete(folder);
                                setShowDeleteFolderDialog(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-3">
                        {getTemplatesInFolder(folder.id).length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Aucune séance dans ce dossier
                          </p>
                        ) : (
                          getTemplatesInFolder(folder.id).map((template) => (
                            <TemplateCard
                              key={template.id}
                              template={template}
                              expandedTemplateId={expandedTemplateId}
                              templateExercises={templateExercises}
                              onExpand={handleExpandTemplate}
                              onEdit={handleEditTemplate}
                              onDuplicate={handleDuplicateTemplate}
                              onDelete={(t) => {
                                setTemplateToDelete(t);
                                setShowDeleteDialog(true);
                              }}
                            />
                          ))
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))}

              {/* Templates sans dossier */}
              {getTemplatesWithoutFolder().length > 0 && (
                <>
                  {filteredFolders.length > 0 && (
                    <div className="text-sm text-muted-foreground font-medium pt-2">
                      Séances sans dossier
                    </div>
                  )}
                  {getTemplatesWithoutFolder().map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      expandedTemplateId={expandedTemplateId}
                      templateExercises={templateExercises}
                      onExpand={handleExpandTemplate}
                      onEdit={handleEditTemplate}
                      onDuplicate={handleDuplicateTemplate}
                      onDelete={(t) => {
                        setTemplateToDelete(t);
                        setShowDeleteDialog(true);
                      }}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-[95vw] w-full lg:max-w-6xl xl:max-w-7xl max-h-[90vh] overflow-y-auto">
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

      {/* Folder Create/Edit Dialog */}
      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFolder ? "Modifier le dossier" : "Créer un dossier"}
            </DialogTitle>
            <DialogDescription>
              Les dossiers vous permettent d'organiser vos séances programmées.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Nom du dossier</label>
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Ex: Débutant, Intermédiaire, Avancé..."
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFolderDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveFolder}>
              {editingFolder ? "Modifier" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Confirmation Dialog */}
      <Dialog open={showDeleteFolderDialog} onOpenChange={setShowDeleteFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce dossier ?</DialogTitle>
            <DialogDescription>
              Le dossier "{folderToDelete?.name}" sera supprimé. Les séances qu'il contient ne seront pas supprimées mais seront déplacées hors du dossier.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteFolderDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteFolder}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
