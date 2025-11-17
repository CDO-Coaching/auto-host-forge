import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export interface CardioStep {
  id: number;
  movement_type: "course" | "marche";
  effort_type: "duration" | "distance";
  duration?: number; // en secondes
  distance?: number; // en nombre (selon l'unité)
  distance_unit?: "m" | "km";
  target_pace?: string; // ex: "5:30"
  target_heart_rate?: string; // ex: "150" ou "Zone 3"
}

interface CardioStepBuilderProps {
  steps: CardioStep[];
  onChange: (steps: CardioStep[]) => void;
  disabled?: boolean;
}

export function CardioStepBuilder({ steps, onChange, disabled = false }: CardioStepBuilderProps) {
  const handleAddStep = () => {
    const newStep: CardioStep = {
      id: steps.length > 0 ? Math.max(...steps.map(s => s.id)) + 1 : 1,
      movement_type: "course",
      effort_type: "duration",
      duration: 600, // 10 minutes par défaut
      target_pace: "",
      target_heart_rate: "",
    };
    onChange([...steps, newStep]);
  };

  const handleDeleteStep = (stepId: number) => {
    onChange(steps.filter(s => s.id !== stepId));
  };

  const handleStepChange = (stepId: number, field: keyof CardioStep, value: any) => {
    onChange(
      steps.map(step => {
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
          
          return updatedStep;
        }
        return step;
      })
    );
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

  return (
    <div className="space-y-4">
      {steps.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          Aucune étape ajoutée. Clique sur "Ajouter une étape" pour commencer.
        </div>
      ) : (
        steps.map((step, index) => (
          <Card key={step.id}>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium">Étape {index + 1}</h4>
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
                {/* Objectif d'allure */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Objectif d'allure</label>
                  <Input
                    type="text"
                    value={step.target_pace || ""}
                    onChange={(e) => handleStepChange(step.id, "target_pace", e.target.value)}
                    placeholder="ex: 5:30/km"
                    disabled={disabled}
                  />
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
        ))
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
