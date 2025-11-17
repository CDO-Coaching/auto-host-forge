import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Edit2, Save, X } from "lucide-react";

interface VmaCardProps {
  athleteId: string;
  isCoachView?: boolean;
  onVmaUpdate?: (vma: number) => void;
}

export function VmaCard({ athleteId, isCoachView = false, onVmaUpdate }: VmaCardProps) {
  const [vma, setVma] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadVma();
  }, [athleteId]);

  const loadVma = async () => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("vma")
        .eq("id", athleteId)
        .single();

      if (error) throw error;
      
      if (data?.vma) {
        setVma(data.vma);
        setInputValue(data.vma.toString());
      }
    } catch (error) {
      console.error("Erreur lors du chargement de la VMA:", error);
    }
  };

  const handleSave = async () => {
    const vmaValue = parseFloat(inputValue);
    
    if (!inputValue || isNaN(vmaValue)) {
      toast.error("Valeur invalide");
      return;
    }

    if (vmaValue < 8 || vmaValue > 30) {
      toast.error("La VMA doit être entre 8 et 30 km/h");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ vma: vmaValue })
        .eq("id", athleteId);

      if (error) throw error;

      setVma(vmaValue);
      setIsEditing(false);
      toast.success("VMA mise à jour !");
      
      // Notifier le parent de la mise à jour
      if (onVmaUpdate) {
        onVmaUpdate(vmaValue);
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setInputValue(vma?.toString() || "");
    setIsEditing(false);
  };

  return (
    <Card className="bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg font-semibold">VMA</CardTitle>
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-8 w-8 p-0"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vma">VMA (km/h)</Label>
              <Input
                id="vma"
                type="number"
                step="0.1"
                min="8"
                max="30"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ex: 15.5"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Vitesse Maximale Aérobie (entre 8 et 30 km/h)
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={loading}
                size="sm"
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                Enregistrer
              </Button>
              <Button
                onClick={handleCancel}
                disabled={loading}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {vma ? (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-primary">
                  {vma.toFixed(1)}
                </span>
                <span className="text-muted-foreground">km/h</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isCoachView 
                  ? "Aucune VMA enregistrée pour cet athlète"
                  : "Aucune VMA enregistrée"
                }
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
