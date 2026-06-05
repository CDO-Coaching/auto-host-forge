import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Edit2, Save, X, Activity, Heart, HeartPulse } from "lucide-react";

interface VmaCardProps {
  athleteId: string;
  isCoachView?: boolean;
  onVmaUpdate?: (vma: number) => void;
}

export function VmaCard({ athleteId, isCoachView = false, onVmaUpdate }: VmaCardProps) {
  const [vma, setVma] = useState<number | null>(null);
  const [fcMax, setFcMax] = useState<number | null>(null);
  const [fcRepos, setFcRepos] = useState<number | null>(null);
  const [fcMaxUpdatedAt, setFcMaxUpdatedAt] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [vmaInputValue, setVmaInputValue] = useState("");
  const [fcMaxInputValue, setFcMaxInputValue] = useState("");
  const [fcReposInputValue, setFcReposInputValue] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [athleteId]);

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("vma, fc_max, fc_repos, fc_max_updated_at")
        .eq("id", athleteId)
        .single();

      if (error) throw error;
      
      if (data?.vma) {
        setVma(data.vma);
        setVmaInputValue(data.vma.toString());
      }
      if (data?.fc_max) {
        setFcMax(data.fc_max);
        setFcMaxInputValue(data.fc_max.toString());
      }
      if (data?.fc_repos) {
        setFcRepos(data.fc_repos);
        setFcReposInputValue(data.fc_repos.toString());
      }
      if ((data as any)?.fc_max_updated_at) {
        setFcMaxUpdatedAt((data as any).fc_max_updated_at);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
    }
  };

  const handleSave = async () => {
    const vmaValue = vmaInputValue ? parseFloat(vmaInputValue) : null;
    const fcMaxValue = fcMaxInputValue ? parseInt(fcMaxInputValue) : null;
    const fcReposValue = fcReposInputValue ? parseInt(fcReposInputValue) : null;

    if (vmaInputValue && (isNaN(vmaValue!) || vmaValue! < 8 || vmaValue! > 30)) {
      toast.error("La VMA doit être entre 8 et 30 km/h");
      return;
    }

    if (fcMaxInputValue && (isNaN(fcMaxValue!) || fcMaxValue! < 100 || fcMaxValue! > 250)) {
      toast.error("La FC Max doit être entre 100 et 250 bpm");
      return;
    }

    if (fcReposInputValue && (isNaN(fcReposValue!) || fcReposValue! < 30 || fcReposValue! > 120)) {
      toast.error("La FC de repos doit être entre 30 et 120 bpm");
      return;
    }

    if (fcReposValue && fcMaxValue && fcReposValue >= fcMaxValue) {
      toast.error("La FC de repos doit être inférieure à la FC Max");
      return;
    }

    setLoading(true);
    try {
      let error: any = null;

      if (isCoachView) {
        // Coach view: update via RPC (SECURITY DEFINER, sans fc_max_updated_at pour éviter pb colonne)
        const result = await supabase.rpc("update_athlete_physio", {
          p_athlete_id: athleteId,
          p_vma: vmaValue,
          p_fc_max: fcMaxValue,
          p_fc_repos: fcReposValue,
        } as any);
        error = result.error;
      } else {
        // Athlete view: mise à jour directe (auth.uid() = athleteId)
        const result = await supabase
          .from("user_profiles")
          .update({ vma: vmaValue, fc_max: fcMaxValue, fc_repos: fcReposValue })
          .eq("id", athleteId);
        error = result.error;
      }

      if (error) throw error;

      // Succès : mettre à jour l'état local
      setVma(vmaValue);
      setFcMax(fcMaxValue);
      setFcRepos(fcReposValue);
      if (fcMaxValue !== null) {
        const now = new Date().toISOString();
        setFcMaxUpdatedAt(now);
      }
      setIsEditing(false);

      toast.success("Données mises à jour !");
      if (onVmaUpdate && vmaValue) {
        onVmaUpdate(vmaValue);
      }
    } catch (err) {
      console.error("Erreur VmaCard save:", err);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setVmaInputValue(vma?.toString() || "");
    setFcMaxInputValue(fcMax?.toString() || "");
    setFcReposInputValue(fcRepos?.toString() || "");
    setIsEditing(false);
  };

  return (
    <Card className="bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg font-semibold">Données Physiologiques</CardTitle>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vma" className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  VMA (km/h)
                </Label>
                <Input
                  id="vma"
                  type="number"
                  step="0.1"
                  min="8"
                  max="30"
                  value={vmaInputValue}
                  onChange={(e) => setVmaInputValue(e.target.value)}
                  placeholder="Ex: 15.5"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Entre 8 et 30 km/h
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fcmax" className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  FC Max (bpm)
                </Label>
                <Input
                  id="fcmax"
                  type="number"
                  min="100"
                  max="250"
                  value={fcMaxInputValue}
                  onChange={(e) => setFcMaxInputValue(e.target.value)}
                  placeholder="Ex: 185"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Entre 100 et 250 bpm
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fcrepos" className="flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-blue-500" />
                  FC Repos (bpm)
                </Label>
                <Input
                  id="fcrepos"
                  type="number"
                  min="30"
                  max="120"
                  value={fcReposInputValue}
                  onChange={(e) => setFcReposInputValue(e.target.value)}
                  placeholder="Ex: 55"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Entre 30 et 120 bpm
                </p>
              </div>
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
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="h-4 w-4 text-primary" />
                VMA
              </div>
              {vma ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-primary">
                    {vma.toFixed(1)}
                  </span>
                  <span className="text-sm text-muted-foreground">km/h</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Non renseignée
                </p>
              )}
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Heart className="h-4 w-4 text-red-500" />
                FC Max
              </div>
              {fcMax ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-red-500">{fcMax}</span>
                    <span className="text-sm text-muted-foreground">bpm</span>
                  </div>
                  {fcMaxUpdatedAt ? (() => {
                    const date = new Date(fcMaxUpdatedAt);
                    const nextTest = new Date(date);
                    nextTest.setMonth(nextTest.getMonth() + 3);
                    const daysUntil = Math.ceil((nextTest.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    const isOverdue = daysUntil <= 0;
                    const isSoon = daysUntil > 0 && daysUntil <= 14;
                    return (
                      <div className="space-y-0.5">
                        <p className="text-[11px] text-muted-foreground">
                          Saisi le {date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                        <p className={`text-[11px] font-medium ${isOverdue ? "text-red-400" : isSoon ? "text-orange-400" : "text-muted-foreground"}`}>
                          {isOverdue ? `⚠️ Retest conseillé (il y a ${Math.abs(daysUntil)}j)` : isSoon ? `⏳ Retest dans ${daysUntil}j` : `Retest dans ${daysUntil}j`}
                        </p>
                      </div>
                    );
                  })() : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">Non renseignée</p>
              )}
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <HeartPulse className="h-4 w-4 text-blue-500" />
                FC Repos
              </div>
              {fcRepos ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-blue-500">
                    {fcRepos}
                  </span>
                  <span className="text-sm text-muted-foreground">bpm</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Non renseignée
                </p>
              )}
            </div>

            {/* FCR = FC max - FC repos (Karvonen) */}
            {fcMax && fcRepos && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Heart className="h-4 w-4 text-primary" />
                  FC Réserve (FCR)
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-primary">{fcMax - fcRepos}</span>
                  <span className="text-sm text-muted-foreground">bpm</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{fcMax} − {fcRepos} · base Karvonen</p>

                {/* 5 zones FCR avec bornes BPM */}
                <div className="grid grid-cols-1 gap-1 pt-1">
                  {[
                    { z: 1, label: "Récupération",          pMin: 50, pMax: 60,  color: "text-blue-400",   dot: "bg-blue-500"   },
                    { z: 2, label: "Endurance fondamentale", pMin: 60, pMax: 70,  color: "text-green-400",  dot: "bg-green-500"  },
                    { z: 3, label: "Résistance douce",       pMin: 70, pMax: 80,  color: "text-yellow-400", dot: "bg-yellow-400" },
                    { z: 4, label: "Résistance dure",        pMin: 80, pMax: 90,  color: "text-orange-400", dot: "bg-orange-500" },
                    { z: 5, label: "Puissance",              pMin: 90, pMax: 100, color: "text-red-400",    dot: "bg-red-500"    },
                  ].map(({ z, label, pMin, pMax, color, dot }) => {
                    const low  = Math.round(fcRepos + (fcMax - fcRepos) * pMin / 100);
                    const high = Math.round(fcRepos + (fcMax - fcRepos) * pMax / 100);
                    return (
                      <div key={z} className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                        <span className={`text-[11px] font-semibold w-4 ${color}`}>Z{z}</span>
                        <span className="text-[11px] text-muted-foreground flex-1">{label}</span>
                        <span className={`text-[11px] font-medium tabular-nums ${color}`}>{low} – {high} bpm</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
