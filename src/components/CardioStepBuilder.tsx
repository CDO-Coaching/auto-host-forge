import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Link2, Unlink, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { WALKING_SPEED_KMH, WALKING_PACE } from "@/lib/cardioCalculations";

export interface CardioStep {
  id: number;
  movement_type: "course" | "marche";
  effort_type: "duration" | "distance";
  duration?: number; // en secondes
  distance?: number; // en nombre (selon l'unité)
  distance_unit?: "m" | "km";
  vma_percentage?: number; // pourcentage de VMA (ex: 65)
  target_heart_rate?: string; // ex: "150" ou "Zone 3"
  block_id?: number; // ID du bloc auquel appartient cette étape
}

export interface CardioBlock {
  id: number;
  repetitions: number;
  steps: CardioStep[];
}

export interface CardioData {
  steps: CardioStep[];
  blocks: CardioBlock[];
}

interface CardioStepBuilderProps {
  steps: CardioStep[];
  blocks?: CardioBlock[];
  onChange: (data: CardioData) => void;
  athleteVma?: number | null;
  disabled?: boolean;
}

export function CardioStepBuilder({ steps, blocks: initialBlocks = [], onChange, athleteVma, disabled = false }: CardioStepBuilderProps) {
  const [blocks, setBlocks] = useState<CardioBlock[]>(initialBlocks);
  const [selectedSteps, setSelectedSteps] = useState<number[]>([]);
  const [draggedStepId, setDraggedStepId] = useState<number | null>(null);

  // Calcule l'allure en min/km à partir du pourcentage de VMA
  const calculatePace = (vmaPercentage: number | undefined): string => {
    if (!vmaPercentage || !athleteVma) return "-";
    
    const speed = athleteVma * (vmaPercentage / 100); // vitesse en km/h
    const paceInMinutes = 60 / speed; // allure en min/km
    const minutes = Math.floor(paceInMinutes);
    const seconds = Math.round((paceInMinutes - minutes) * 60);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  const handleAddStep = () => {
    const newStep: CardioStep = {
      id: steps.length > 0 ? Math.max(...steps.map(s => s.id)) + 1 : 1,
      movement_type: "course",
      effort_type: "duration",
      duration: 600, // 10 minutes par défaut
      vma_percentage: 70,
      target_heart_rate: "",
    };
    onChange({ steps: [...steps, newStep], blocks });
  };

  const handleDeleteStep = (stepId: number) => {
    onChange({ steps: steps.filter(s => s.id !== stepId), blocks });
  };

  const handleStepChange = (stepId: number, field: keyof CardioStep, value: any) => {
    const updatedSteps = steps.map(step => {
      if (step.id === stepId) {
        const updatedStep = { ...step, [field]: value };
        
        // Si on change le type d'effort, réinitialiser les champs appropriés
        if (field === "effort_type") {
          if (value === "duration") {
            updatedStep.duration = 600;
            delete updatedStep.distance;
            delete updatedStep.distance_unit;
          } else {
            updatedStep.distance = 1000;
            updatedStep.distance_unit = "m";
            delete updatedStep.duration;
          }
        }

        // Si on passe en marche, on retire le pourcentage VMA (allure fixe)
        if (field === "movement_type" && value === "marche") {
          delete updatedStep.vma_percentage;
        }
        
        return updatedStep;
      }
      return step;
    });
    onChange({ steps: updatedSteps, blocks });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const parseDuration = (value: string): number => {
    const parts = value.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0]) || 0;
      const secs = parseInt(parts[1]) || 0;
      return mins * 60 + secs;
    }
    return parseInt(value) * 60 || 0;
  };

  const toggleStepSelection = (stepId: number) => {
    setSelectedSteps(prev => 
      prev.includes(stepId) 
        ? prev.filter(id => id !== stepId)
        : [...prev, stepId]
    );
  };

  const createBlockFromSelected = () => {
    if (selectedSteps.length < 2) return;

    const newBlockId = blocks.length > 0 ? Math.max(...blocks.map(b => b.id)) + 1 : 1;
    const selectedStepsData = steps.filter(s => selectedSteps.includes(s.id));
    
    // Mettre à jour les étapes pour les lier au bloc
    const updatedSteps = steps.map(step => 
      selectedSteps.includes(step.id) 
        ? { ...step, block_id: newBlockId }
        : step
    );

    const newBlock: CardioBlock = {
      id: newBlockId,
      repetitions: 1,
      steps: selectedStepsData,
    };

    const newBlocks = [...blocks, newBlock];
    setBlocks(newBlocks);
    onChange({ steps: updatedSteps, blocks: newBlocks });
    setSelectedSteps([]);
  };

  const removeBlock = (blockId: number) => {
    // Retirer le block_id des étapes
    const updatedSteps = steps.map(step =>
      step.block_id === blockId 
        ? { ...step, block_id: undefined }
        : step
    );
    
    const newBlocks = blocks.filter(b => b.id !== blockId);
    setBlocks(newBlocks);
    onChange({ steps: updatedSteps, blocks: newBlocks });
  };

  const updateBlockRepetitions = (blockId: number, repetitions: number) => {
    const newBlocks = blocks.map(b => 
      b.id === blockId ? { ...b, repetitions } : b
    );
    setBlocks(newBlocks);
    onChange({ steps, blocks: newBlocks });
  };

  const getStepBlock = (stepId: number): CardioBlock | undefined => {
    const step = steps.find(s => s.id === stepId);
    if (!step?.block_id) return undefined;
    return blocks.find(b => b.id === step.block_id);
  };

  // Drag & Drop handlers pour les étapes
  const handleStepDragStart = (stepId: number) => {
    setDraggedStepId(stepId);
  };

  const handleStepDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleStepDrop = (e: React.DragEvent, targetStepId: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedStepId === null || draggedStepId === targetStepId) {
      setDraggedStepId(null);
      return;
    }

    const draggedIndex = steps.findIndex((s) => s.id === draggedStepId);
    const targetIndex = steps.findIndex((s) => s.id === targetStepId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedStepId(null);
      return;
    }

    const newSteps = [...steps];
    const [draggedStep] = newSteps.splice(draggedIndex, 1);
    newSteps.splice(targetIndex, 0, draggedStep);

    onChange({ steps: newSteps, blocks });
    setDraggedStepId(null);
    toast.success("Étape réorganisée");
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {selectedSteps.length >= 2 && !disabled && (
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-2 sm:p-3 bg-primary/10 rounded-lg border border-primary/20">
          <Badge variant="secondary" className="text-xs">{selectedSteps.length} étapes</Badge>
          <Button size="sm" onClick={createBlockFromSelected} className="text-xs sm:text-sm w-full sm:w-auto">
            <Link2 className="h-4 w-4 mr-1 sm:mr-2" />
            Créer bloc
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedSteps([])} className="text-xs sm:text-sm w-full sm:w-auto">
            Annuler
          </Button>
        </div>
      )}

      {steps.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          Aucune étape ajoutée. Clique sur "Ajouter une étape" pour commencer.
        </div>
      ) : (
        steps.map((step, index) => {
          const stepBlock = getStepBlock(step.id);
          const isFirstInBlock = stepBlock && stepBlock.steps[0]?.id === step.id;
          
          return (
            <div key={step.id}>
              {isFirstInBlock && stepBlock && (
                <div className="mb-2 p-3 bg-accent/50 rounded-t-lg border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-primary">Bloc répété</Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Répétitions:</span>
                      <Input
                        type="number"
                        min="1"
                        max="20"
                        value={stepBlock.repetitions}
                        onChange={(e) => updateBlockRepetitions(stepBlock.id, parseInt(e.target.value) || 1)}
                        className="w-16 h-8"
                        disabled={disabled}
                      />
                    </div>
                  </div>
                  {!disabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBlock(stepBlock.id)}
                    >
                      <Unlink className="h-4 w-4 mr-1" />
                      Délier le bloc
                    </Button>
                  )}
                </div>
              )}
              
              <Card 
                className={stepBlock ? "rounded-t-none" : ""}
                draggable={!disabled}
                onDragStart={() => handleStepDragStart(step.id)}
                onDragOver={handleStepDragOver}
                onDrop={(e) => handleStepDrop(e, step.id)}
              >
                <CardContent className="pt-6 space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      {!disabled && (
                        <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing" />
                      )}
                      {!disabled && !step.block_id && (
                        <input
                          type="checkbox"
                          checked={selectedSteps.includes(step.id)}
                          onChange={() => toggleStepSelection(step.id)}
                          className="h-4 w-4 rounded border-border"
                        />
                      )}
                      <h4 className="font-medium">
                        Étape {index + 1}
                        {stepBlock && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Dans bloc {stepBlock.id}
                          </Badge>
                        )}
                      </h4>
                    </div>
                    {!disabled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteStep(step.id)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Type de mouvement */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Type de mouvement</label>
                  <Select
                    value={step.movement_type}
                    onValueChange={(value) => handleStepChange(step.id, "movement_type", value)}
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="course">Course à pied</SelectItem>
                      <SelectItem value="marche">Marche</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Type d'effort */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Type d'effort</label>
                  <Select
                    value={step.effort_type}
                    onValueChange={(value) => handleStepChange(step.id, "effort_type", value)}
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="duration">Durée</SelectItem>
                      <SelectItem value="distance">Distance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Durée ou Distance */}
              {step.effort_type === "duration" ? (
                <div>
                  <label className="text-sm font-medium mb-2 block">Durée (mm:ss)</label>
                  <Input
                    type="text"
                    value={formatDuration(step.duration || 0)}
                    onChange={(e) => handleStepChange(step.id, "duration", parseDuration(e.target.value))}
                    placeholder="ex: 10:00"
                    disabled={disabled}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Distance</label>
                    <Input
                      type="number"
                      value={step.distance || ""}
                      onChange={(e) => handleStepChange(step.id, "distance", parseFloat(e.target.value) || 0)}
                      placeholder="ex: 1000"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Unité</label>
                    <Select
                      value={step.distance_unit || "m"}
                      onValueChange={(value) => handleStepChange(step.id, "distance_unit", value)}
                      disabled={disabled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="m">Mètres</SelectItem>
                        <SelectItem value="km">Kilomètres</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Objectif % VMA ou Allure de marche */}
                <div>
                  {step.movement_type === "marche" ? (
                    <>
                      <label className="text-sm font-medium mb-2 block">Allure de marche</label>
                      <div className="p-3 bg-muted rounded-md">
                        <span className="font-medium text-foreground">{WALKING_PACE}</span>
                        <span className="text-xs text-muted-foreground ml-2">(~{WALKING_SPEED_KMH} km/h)</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="text-sm font-medium mb-2 block">
                        Objectif (% VMA)
                        {athleteVma && (
                          <span className="text-xs text-muted-foreground ml-2">
                            VMA: {athleteVma} km/h
                          </span>
                        )}
                      </label>
                      <div className="space-y-2">
                        <Input
                          type="number"
                          min="30"
                          max="120"
                          value={step.vma_percentage || ""}
                          onChange={(e) => handleStepChange(step.id, "vma_percentage", parseFloat(e.target.value) || 0)}
                          placeholder="ex: 65"
                          disabled={disabled || !athleteVma}
                        />
                        {athleteVma ? (
                          <div className="text-sm text-muted-foreground">
                            Allure calculée: <span className="font-medium text-foreground">{calculatePace(step.vma_percentage)}</span>
                          </div>
                        ) : (
                          <div className="text-sm text-destructive">
                            VMA non renseignée dans les max
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Objectif de fréquence cardiaque */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Fréquence cardiaque</label>
                  <Input
                    type="text"
                    value={step.target_heart_rate || ""}
                    onChange={(e) => handleStepChange(step.id, "target_heart_rate", e.target.value)}
                    placeholder="ex: 150 bpm ou Zone 3"
                    disabled={disabled}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
            </div>
          );
        })
      )}

      {!disabled && (
        <Button
          onClick={handleAddStep}
          variant="outline"
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une étape
        </Button>
      )}
    </div>
  );
}
