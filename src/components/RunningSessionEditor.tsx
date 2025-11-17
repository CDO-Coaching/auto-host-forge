import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import {
  RunningStep,
  calculatePace,
  calculateSpeed,
  calculateTotalStepDuration,
  calculateRunningSessionDuration,
  formatPace,
  formatSpeed,
  formatDuration,
  formatDistance,
} from "@/lib/vmaCalculations";

interface RunningSessionEditorProps {
  vma: number;
  onStepsChange?: (steps: RunningStep[]) => void;
}

export default function RunningSessionEditor({
  vma,
  onStepsChange,
}: RunningSessionEditorProps) {
  const [steps, setSteps] = useState<RunningStep[]>([]);

  useEffect(() => {
    onStepsChange?.(steps);
  }, [steps, onStepsChange]);

  const addStep = () => {
    const newStep: RunningStep = {
      id: crypto.randomUUID(),
      type: "interval",
      vma_percentage: 80,
      stop_rule_type: "duration",
      stop_rule_value: 5,
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter((s) => s.id !== id));
  };

  const updateStep = (id: string, updates: Partial<RunningStep>) => {
    setSteps(
      steps.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const totalDuration = calculateRunningSessionDuration(steps, vma);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Séance de course</h3>
          <p className="text-sm text-muted-foreground">
            VMA: {vma} km/h • Durée totale: {formatDuration(totalDuration)}
          </p>
        </div>
        <Button onClick={addStep} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une étape
        </Button>
      </div>

      {steps.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          Aucune étape définie. Clique sur "Ajouter une étape" pour commencer.
        </Card>
      )}

      <div className="space-y-3">
        {steps.map((step, index) => (
          <Card key={step.id} className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">
                  Étape {index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStep(step.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Type d'étape */}
                <div className="space-y-2">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={step.type}
                    onValueChange={(value) =>
                      updateStep(step.id, {
                        type: value as RunningStep["type"],
                      })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warmup">Échauffement</SelectItem>
                      <SelectItem value="interval">Intervalle</SelectItem>
                      <SelectItem value="recovery">Récupération</SelectItem>
                      <SelectItem value="cooldown">Retour au calme</SelectItem>
                      <SelectItem value="repeat">Répétition</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Pourcentage VMA */}
                <div className="space-y-2">
                  <Label className="text-xs">% VMA</Label>
                  <Input
                    type="number"
                    min="40"
                    max="150"
                    step="5"
                    value={step.vma_percentage}
                    onChange={(e) =>
                      updateStep(step.id, {
                        vma_percentage: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9"
                  />
                </div>

                {/* Type de règle d'arrêt */}
                <div className="space-y-2">
                  <Label className="text-xs">Arrêt par</Label>
                  <Select
                    value={step.stop_rule_type}
                    onValueChange={(value) =>
                      updateStep(step.id, {
                        stop_rule_type: value as "duration" | "distance",
                      })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="duration">Durée</SelectItem>
                      <SelectItem value="distance">Distance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Valeur de la règle */}
                <div className="space-y-2">
                  <Label className="text-xs">
                    {step.stop_rule_type === "duration"
                      ? "Durée (min)"
                      : "Distance (m)"}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step={step.stop_rule_type === "duration" ? "0.5" : "50"}
                    value={step.stop_rule_value}
                    onChange={(e) =>
                      updateStep(step.id, {
                        stop_rule_value: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9"
                  />
                </div>
              </div>

              {/* Répétitions (si type = repeat) */}
              {step.type === "repeat" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
                  <div className="space-y-2">
                    <Label className="text-xs">Répétitions</Label>
                    <Input
                      type="number"
                      min="1"
                      value={step.repetitions || 1}
                      onChange={(e) =>
                        updateStep(step.id, {
                          repetitions: parseInt(e.target.value) || 1,
                        })
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Récup (sec)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="15"
                      value={step.recovery_duration || 0}
                      onChange={(e) =>
                        updateStep(step.id, {
                          recovery_duration: parseInt(e.target.value) || 0,
                        })
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">ou Récup (m)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="50"
                      value={step.recovery_distance || 0}
                      onChange={(e) =>
                        updateStep(step.id, {
                          recovery_distance: parseInt(e.target.value) || 0,
                        })
                      }
                      className="h-9"
                    />
                  </div>
                </div>
              )}

              {/* Affichage des calculs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t bg-muted/30 rounded p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Allure</p>
                  <p className="font-semibold text-sm">
                    {formatPace(calculatePace(vma, step.vma_percentage))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vitesse</p>
                  <p className="font-semibold text-sm">
                    {formatSpeed(calculateSpeed(vma, step.vma_percentage))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {step.stop_rule_type === "distance" ? "Distance" : "Durée"}
                  </p>
                  <p className="font-semibold text-sm">
                    {step.stop_rule_type === "distance"
                      ? formatDistance(step.stop_rule_value)
                      : formatDuration(step.stop_rule_value * 60)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Durée étape</p>
                  <p className="font-semibold text-sm">
                    {formatDuration(calculateTotalStepDuration(step, vma))}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
