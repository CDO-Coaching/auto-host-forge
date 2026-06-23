import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Edit2, Save, X, Activity, Heart, HeartPulse, Gauge, LineChart as LineChartIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaceCalibrationCard } from "@/components/PaceCalibrationCard";
import { VmaHistoryChart } from "@/components/VmaHistoryChart";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { sendCardioTestSession } from "@/lib/coachSessions";
import { FlaskConical, Zap } from "lucide-react";

interface VmaCardProps {
  athleteId: string;
  isCoachView?: boolean;
  onVmaUpdate?: (vma: number) => void;
  /** semaine affichée par le coach (cible de la séance test de calibration) */
  calibrationTargetWeek?: { week: number; year: number };
  /** rafraîchir la prog après envoi de la séance test */
  onTestSessionSent?: () => void;
}

export function VmaCard({ athleteId, isCoachView = false, onVmaUpdate, calibrationTargetWeek, onTestSessionSent }: VmaCardProps) {
  const [vma, setVma] = useState<number | null>(null);
  const [fcMax, setFcMax] = useState<number | null>(null);
  const [fcRepos, setFcRepos] = useState<number | null>(null);
  const [fcMaxUpdatedAt, setFcMaxUpdatedAt] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [vmaInputValue, setVmaInputValue] = useState("");
  const [fcMaxInputValue, setFcMaxInputValue] = useState("");
  const [fcReposInputValue, setFcReposInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sendingVmaTest, setSendingVmaTest] = useState(false);
  const [ftp, setFtp] = useState<number | null>(null);
  const [ftpInputValue, setFtpInputValue] = useState("");
  const [sendingFtpTest, setSendingFtpTest] = useState(false);

  const sendFtpTest = async () => {
    setSendingFtpTest(true);
    try {
      const week = await sendCardioTestSession({
        athleteId,
        targetWeek: calibrationTargetWeek,
        vma: null,
        sport: "velo",
        name: "Test FTP — 20 min",
        exerciceLabel: "Test FTP (20 min) — vélo",
        cardioContent: {
          steps: [
            { id: 1, movement_type: "velo", effort_type: "duration", duration: 900, target_heart_rate: "Z2" },  // 15 min échauffement
            { id: 2, movement_type: "velo", effort_type: "duration", duration: 300, rpe: 8 },                    // 5 min activation
            { id: 3, movement_type: "velo", effort_type: "duration", duration: 1200, rpe: 10 },                  // 20 min TEST à fond
            { id: 4, movement_type: "velo", effort_type: "duration", duration: 600, target_heart_rate: "Z1" },  // 10 min retour au calme
          ],
          blocks: [],
        },
        commentaire: "Test FTP (vélo). 1) 15 min échauffement progressif · 2) 5 min activation (montées d'intensité) · 3) TEST : 20 min À FOND, puissance la plus élevée tenable et régulière → note la PUISSANCE MOYENNE des 20 min · 4) 10 min retour au calme. FTP = 95 % de la puissance moyenne des 20 min (ex : 250 W moy → FTP 238 W).",
      });
      toast.success(`Test FTP envoyé au sportif (semaine S${week}) !`);
      onTestSessionSent?.();
    } catch (e: any) {
      console.error("Envoi test FTP:", e);
      toast.error(`Erreur envoi test FTP : ${e?.message || e}`);
    } finally {
      setSendingFtpTest(false);
    }
  };

  const sendVmaTest = async (kind: "demi-cooper" | "vaussenat") => {
    setSendingVmaTest(true);
    try {
      const config = kind === "demi-cooper"
        ? {
            name: "Test VMA — Demi-Cooper (6 min)",
            exerciceLabel: "Demi-Cooper (6 min)",
            cardioContent: {
              steps: [
                { id: 1, movement_type: "course", effort_type: "duration", duration: 900, target_heart_rate: "Z2", vma_percentage: 65 }, // 15 min EF (échauffement)
                { id: 2, movement_type: "marche", effort_type: "duration", duration: 120 },                                              // 2 min marche
                { id: 3, movement_type: "course", effort_type: "duration", duration: 360, target_heart_rate: "Z5", rpe: 10 },            // 6 min TEST (à fond, Z5)
                { id: 4, movement_type: "marche", effort_type: "duration", duration: 180 },                                              // 3 min marche
                { id: 5, movement_type: "course", effort_type: "duration", duration: 600, target_heart_rate: "Z2", vma_percentage: 65 }, // 10 min EF (retour au calme)
              ],
              blocks: [],
            },
            commentaire: "Test VMA — Demi-Cooper. 1) 15 min en Z2 (échauffement) · 2) 2 min marche · 3) TEST : 6 min à fond (Z5), allure régulière la plus rapide tenable, à plat → note la DISTANCE de ces 6 min · 4) 3 min marche · 5) 10 min en Z2 (retour au calme). VMA = distance des 6 min (m) ÷ 100 (ex : 1600 m → 16 km/h).",
          }
        : (() => {
            // Paliers 8 → 25 km/h : 3 min de course + 1 min de marche entre chaque.
            // vma_percentage = vitesse/VMA×100 → l'étape affiche l'allure exacte du palier.
            const refVma = vma && vma > 0 ? vma : 16; // VMA de référence (sinon 16) pour convertir en allure
            const steps: any[] = [];
            let id = 1;
            for (let v = 8; v <= 25; v++) {
              steps.push({
                id: id++, movement_type: "course", effort_type: "duration", duration: 180,
                vma_percentage: Math.round((v / refVma) * 1000) / 10,
              });
              if (v < 25) steps.push({ id: id++, movement_type: "marche", effort_type: "duration", duration: 60 });
            }
            const pace = (v: number) => { const s = 60 / v; const m = Math.floor(s); const sec = Math.round((s - m) * 60); return `${m}:${String(sec).padStart(2, "0")}`; };
            return {
              name: "Test VMA — Vaussenat (tapis)",
              exerciceLabel: "Vaussenat (tapis) — test progressif",
              cardioContent: { steps, blocks: [] },
              commentaire: `Test VMA — Vaussenat sur tapis (inclinaison 1%). Échauffement 10-15 min. Paliers de 3 min de 8 à 25 km/h (+1 km/h), 1 min de marche entre chaque, jusqu'à épuisement. Allures repères : 8 km/h=${pace(8)} · 12=${pace(12)} · 16=${pace(16)} · 20=${pace(20)} · 25=${pace(25)}/km. VMA = vitesse du dernier palier de 3 min complété intégralement.`,
            };
          })();
      const week = await sendCardioTestSession({
        athleteId, targetWeek: calibrationTargetWeek, vma: null, ...config,
      });
      toast.success(`Test VMA envoyé au sportif (semaine S${week}) !`);
      onTestSessionSent?.();
    } catch (e: any) {
      console.error("Envoi test VMA:", e);
      toast.error(`Erreur envoi test VMA : ${e?.message || e}`);
    } finally {
      setSendingVmaTest(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [athleteId]);

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("vma, fc_max, fc_repos, fc_max_updated_at, ftp")
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
      if ((data as any)?.ftp) {
        setFtp((data as any).ftp);
        setFtpInputValue((data as any).ftp.toString());
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
    }
  };

  const handleSave = async () => {
    const vmaValue = vmaInputValue ? parseFloat(vmaInputValue) : null;
    const fcMaxValue = fcMaxInputValue ? parseInt(fcMaxInputValue) : null;
    const fcReposValue = fcReposInputValue ? parseInt(fcReposInputValue) : null;
    const ftpValue = ftpInputValue ? parseInt(ftpInputValue) : null;

    if (ftpInputValue && (isNaN(ftpValue!) || ftpValue! < 50 || ftpValue! > 600)) {
      toast.error("La FTP doit être entre 50 et 600 W");
      return;
    }

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
          p_ftp: ftpValue,
        } as any);
        error = result.error;
      } else {
        // Athlete view: mise à jour directe (auth.uid() = athleteId)
        const result = await supabase
          .from("user_profiles")
          .update({ vma: vmaValue, fc_max: fcMaxValue, fc_repos: fcReposValue, ftp: ftpValue })
          .eq("id", athleteId);
        error = result.error;
      }

      if (error) throw error;

      // Historiser la VMA saisie manuellement (best-effort)
      if (vmaValue && vmaValue !== vma) {
        try {
          await supabase.rpc("log_vma_history", {
            p_athlete_id: athleteId, p_vma: vmaValue, p_source: "manual",
          } as any);
        } catch { /* migration vma_history non appliquée */ }
      }

      // Succès : mettre à jour l'état local
      setVma(vmaValue);
      setFcMax(fcMaxValue);
      setFcRepos(fcReposValue);
      setFtp(ftpValue);
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
    setFtpInputValue(ftp?.toString() || "");
    setIsEditing(false);
  };

  return (
    <Card className="bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg font-semibold">Données Physiologiques</CardTitle>
        {!isEditing && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(true)}
              className="h-8 gap-1.5"
              title="Évolution de la VMA"
            >
              <LineChartIcon className="h-3.5 w-3.5" />
            </Button>
            {isCoachView && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={sendingVmaTest}>
                    <FlaskConical className="h-3.5 w-3.5" />
                    Test VMA
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => sendVmaTest("demi-cooper")}>
                    Demi-Cooper (6 min)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => sendVmaTest("vaussenat")}>
                    Vaussenat (tapis)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {isCoachView && (
              <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={sendingFtpTest} onClick={sendFtpTest}>
                <FlaskConical className="h-3.5 w-3.5" />
                Test FTP
              </Button>
            )}
            {isCoachView && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCalibration(true)}
                className="h-8 gap-1.5"
              >
                <Gauge className="h-3.5 w-3.5" />
                Calibrer les allures
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-8 w-8 p-0"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

              <div className="space-y-2">
                <Label htmlFor="ftp" className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  FTP (W)
                </Label>
                <Input
                  id="ftp"
                  type="number"
                  min="50"
                  max="600"
                  value={ftpInputValue}
                  onChange={(e) => setFtpInputValue(e.target.value)}
                  placeholder="Ex: 240"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">Puissance seuil (vélo)</p>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="h-4 w-4 text-amber-500" />
                FTP
              </div>
              {ftp ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-amber-500">{ftp}</span>
                  <span className="text-sm text-muted-foreground">W</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Non renseignée</p>
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

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Évolution de la VMA</DialogTitle>
          </DialogHeader>
          <VmaHistoryChart athleteId={athleteId} />
        </DialogContent>
      </Dialog>

      {isCoachView && (
        <Dialog open={showCalibration} onOpenChange={setShowCalibration}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Calibration des allures (FCR)</DialogTitle>
            </DialogHeader>
            <PaceCalibrationCard
              athleteId={athleteId}
              embedded
              targetWeek={calibrationTargetWeek}
              onTestSessionSent={onTestSessionSent}
              onApplied={(newVma) => {
                setShowCalibration(false);
                loadData();
                onVmaUpdate?.(newVma);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
