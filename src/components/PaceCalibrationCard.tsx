/**
 * PaceCalibrationCard — outil coach (affichage seul, aucune écriture en base).
 *
 * Part de la VMA saisie manuellement dans le profil. Génère une SÉANCE TEST
 * sous-maximale à allures imposées (paliers à % VMA). Le coach saisit la FC
 * moyenne des 3 dernières minutes de chaque palier. À partir de la relation
 * individuelle allure ↔ %FCR (Karvonen), l'outil :
 *  - propose une VMA "calibrée" (vitesse extrapolée à FCmax),
 *  - affiche une table d'allures par zone FCR (Z1-Z5),
 *  - diagnostique l'écart à l'allure EF actuelle.
 *
 * Nécessite VMA + FC max + FC repos. N'écrit jamais la VMA.
 */

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Gauge, Check, Send } from "lucide-react";
import { getWeekNumber } from "@/lib/weekUtils";
import { sendCardioTestSession } from "@/lib/coachSessions";

interface Props {
  athleteId: string;
  /** true = rendu sans le cadre Card (pour affichage dans un dialog) */
  embedded?: boolean;
  /** appelé après application réussie de la VMA calibrée au profil */
  onApplied?: (vma: number) => void;
  /** semaine cible pour la séance test (sinon semaine calendaire courante) */
  targetWeek?: { week: number; year: number };
  /** appelé après envoi de la séance test (pour rafraîchir la prog) */
  onTestSessionSent?: () => void;
}

// Séance test : paliers sous-maximaux (tenables même si la VMA est surévaluée)
const TEST_SEGMENTS = [
  { minutes: 8, pct: 60 },
  { minutes: 8, pct: 70 },
  { minutes: 6, pct: 78 },
];

const FCR_ZONES = [
  { zone: 1, label: "Z1 · Récup",     lo: 50, hi: 60,  dot: "bg-blue-500",   text: "text-blue-400" },
  { zone: 2, label: "Z2 · Endurance", lo: 60, hi: 70,  dot: "bg-green-500",  text: "text-green-400" },
  { zone: 3, label: "Z3 · Tempo",     lo: 70, hi: 80,  dot: "bg-yellow-400", text: "text-yellow-400" },
  { zone: 4, label: "Z4 · Seuil",     lo: 80, hi: 90,  dot: "bg-orange-500", text: "text-orange-400" },
  { zone: 5, label: "Z5 · VMA",       lo: 90, hi: 100, dot: "bg-red-500",    text: "text-red-400" },
];

const fmtPace = (secPerKm: number): string => {
  if (!isFinite(secPerKm) || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};
// pace (s/km) depuis vitesse (km/h)
const paceFromSpeed = (kmh: number) => kmh > 0 ? 3600 / kmh : 0;

export function PaceCalibrationCard({ athleteId, embedded = false, onApplied, targetWeek, onTestSessionSent }: Props) {
  const [vma, setVma] = useState<number | null>(null);
  const [fcMax, setFcMax] = useState<number | null>(null);
  const [fcRepos, setFcRepos] = useState<number | null>(null);
  const [hrInputs, setHrInputs] = useState<string[]>(TEST_SEGMENTS.map(() => ""));
  const [applying, setApplying] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("vma, fc_max, fc_repos")
        .eq("id", athleteId)
        .single();
      if (data) {
        setVma((data as any).vma ?? null);
        setFcMax((data as any).fc_max ?? null);
        setFcRepos((data as any).fc_repos ?? null);
      }
    })();
  }, [athleteId]);

  const hasFcr = !!(fcMax && fcRepos && fcMax > fcRepos);
  const fcr = hasFcr ? fcMax! - fcRepos! : 0;
  const bpmOf = (pct: number) => Math.round(fcRepos! + fcr * pct / 100);

  // Paliers : vitesse imposée (depuis VMA) + FC saisie → point (x=%FCR, y=vitesse)
  const points = useMemo(() => {
    if (!vma || !hasFcr) return [] as { x: number; y: number }[];
    const pts: { x: number; y: number }[] = [];
    TEST_SEGMENTS.forEach((seg, i) => {
      const hr = parseFloat(hrInputs[i]);
      if (isNaN(hr)) return;
      const speed = vma * seg.pct / 100;       // vitesse imposée (km/h)
      const pct = (hr - fcRepos!) / fcr;        // %FCR mesuré (0-1)
      if (pct <= 0 || speed <= 0) return;
      pts.push({ x: pct, y: speed });
    });
    return pts;
  }, [vma, hasFcr, fcRepos, fcr, hrInputs]);

  // Régression vitesse = a + b·%FCR (droite par l'origine si 1 seul point)
  const model = useMemo(() => {
    const n = points.length;
    if (n === 0) return null;
    if (n === 1) return { a: 0, b: points[0].y / points[0].x };
    const sx = points.reduce((s, p) => s + p.x, 0);
    const sy = points.reduce((s, p) => s + p.y, 0);
    const sxx = points.reduce((s, p) => s + p.x * p.x, 0);
    const sxy = points.reduce((s, p) => s + p.x * p.y, 0);
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-9) return { a: 0, b: sy / sx };
    const b = (n * sxy - sx * sy) / denom;
    const a = (sy - b * sx) / n;
    return { a, b };
  }, [points]);

  const predictSpeed = (pct: number) => model ? model.a + model.b * pct : null;
  const calibratedVma = model ? predictSpeed(1.0) : null;

  const efDiagnostic = useMemo(() => {
    if (!model || !vma || model.b === 0) return null;
    const efSpeed = vma * 0.65;
    const pct = (efSpeed - model.a) / model.b;
    if (!isFinite(pct)) return null;
    const pctClamped = Math.max(0, Math.min(1.2, pct));
    const zone = FCR_ZONES.find(z => pctClamped * 100 < z.hi) ?? FCR_ZONES[4];
    return { efPaceSec: paceFromSpeed(efSpeed), pct: pctClamped, zone };
  }, [model, vma]);

  const setHr = (i: number, v: string) =>
    setHrInputs(prev => prev.map((h, idx) => idx === i ? v : h));

  // Construit le contenu cardio : paliers de travail + marche 3 min entre chaque
  const buildCardioContent = () => {
    let id = 1;
    const steps: any[] = [];
    TEST_SEGMENTS.forEach((seg, i) => {
      steps.push({ id: id++, movement_type: "course", effort_type: "duration", duration: seg.minutes * 60, vma_percentage: seg.pct, target_heart_rate: "" });
      if (i < TEST_SEGMENTS.length - 1) {
        steps.push({ id: id++, movement_type: "marche", effort_type: "duration", duration: 180 });
      }
    });
    return { steps, blocks: [] };
  };

  // Envoie la séance test de calibration dans la semaine affichée (ajout, sans toucher au reste)
  const sendTestSession = async () => {
    if (!vma) return;
    setSending(true);
    try {
      const week = await sendCardioTestSession({
        athleteId, targetWeek, vma,
        name: "Test calibration VMA",
        exerciceLabel: "Séance test calibration",
        cardioContent: buildCardioContent(),
        commentaire: "Test de calibration VMA — tiens chaque palier à allure constante. Mets un LAP à chaque changement de palier, et note la FC moyenne des 3 dernières minutes de chaque palier.",
      });
      toast.success(`Séance test envoyée au sportif (semaine S${week}) !`);
      onTestSessionSent?.();
    } catch (e) {
      console.error("Envoi séance test:", e);
      toast.error("Erreur lors de l'envoi de la séance test");
    } finally {
      setSending(false);
    }
  };

  const handleApply = async () => {
    if (!calibratedVma) return;
    const rounded = Math.round(calibratedVma * 10) / 10;
    if (rounded < 8 || rounded > 30) {
      toast.error("VMA calibrée hors plage (8-30 km/h) — vérifie les FC saisies.");
      return;
    }
    setApplying(true);
    try {
      const { error } = await supabase.rpc("update_athlete_physio", {
        p_athlete_id: athleteId,
        p_vma: rounded,
      } as any);
      if (error) throw error;
      // Historiser la VMA issue du calibrage (best-effort)
      try {
        await supabase.rpc("log_vma_history", {
          p_athlete_id: athleteId, p_vma: rounded, p_source: "calibration",
        } as any);
      } catch { /* migration vma_history non appliquée */ }
      setVma(rounded);
      toast.success(`VMA mise à jour : ${rounded} km/h`);
      onApplied?.(rounded);
    } catch (e) {
      console.error("Erreur application VMA calibrée:", e);
      toast.error("Erreur lors de la mise à jour de la VMA");
    } finally {
      setApplying(false);
    }
  };

  const body = (
    <div className="space-y-4">
      {!vma ? (
        <p className="text-sm text-muted-foreground italic">
          Renseigne d'abord la <strong>VMA</strong> de l'athlète dans « Données Physiologiques ».
          C'est le point de départ du test de calibration.
        </p>
      ) : !hasFcr ? (
        <p className="text-sm text-muted-foreground italic">
          Renseigne aussi la <strong>FC max</strong> et la <strong>FC repos</strong> pour calibrer sur la FCR.
        </p>
      ) : (
        <>
          {/* Protocole */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
            <div className="text-xs font-semibold text-primary">🧪 Séance test à faire réaliser (VMA de départ : {vma.toFixed(1)} km/h)</div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Terrain plat, après 10-15 min d'échauffement. Chaque palier à <strong>allure constante</strong>,
              2-3 min de récup entre. Saisis la <strong>FC moyenne des 3 dernières minutes</strong> de chaque palier.
            </p>
          </div>

          {/* Paliers de la séance test */}
          <div className="space-y-2">
            {TEST_SEGMENTS.map((seg, i) => {
              const speed = vma * seg.pct / 100;
              const pace = fmtPace(paceFromSpeed(speed));
              return (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">Palier {i + 1} · {seg.minutes} min</div>
                    <div className="text-[11px] text-muted-foreground">
                      {seg.pct}% VMA · <span className="text-foreground font-medium">{pace}/km</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <label className="text-[10px] uppercase text-muted-foreground">FC moy (bpm)</label>
                    <Input
                      value={hrInputs[i]}
                      onChange={(e) => setHr(i, e.target.value)}
                      placeholder="ex: 152"
                      type="number"
                      inputMode="numeric"
                      className="h-8 w-24 text-center text-sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Envoyer la séance test au sportif */}
          {(() => {
            const wk = targetWeek?.week ?? getWeekNumber(new Date());
            return (
              <>
                <Button onClick={sendTestSession} disabled={sending} variant="outline" className="w-full gap-2">
                  <Send className="h-4 w-4" />
                  {sending ? "Envoi…" : `Envoyer la séance test dans S${wk}`}
                </Button>
                <p className="text-[10px] text-muted-foreground italic -mt-1">
                  Ajoute la séance (3 paliers + marche 3 min) dans la <strong>semaine affichée dans l'onglet Prog (S{wk})</strong>.
                  Pour viser une autre semaine, change-la d'abord dans Prog. Après réalisation, saisis la FC moyenne de chaque palier.
                </p>
              </>
            );
          })()}

          {points.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Saisis la FC d'au moins un palier pour lancer la calibration.</p>
          ) : (
            <>
              {/* VMA actuelle vs calibrée */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border px-3 py-2">
                  <div className="text-[10px] uppercase text-muted-foreground">VMA saisie</div>
                  <div className="text-xl font-bold">{vma.toFixed(1)}<span className="text-xs text-muted-foreground"> km/h</span></div>
                </div>
                <div className={`rounded-lg border px-3 py-2 ${calibratedVma && Math.abs(calibratedVma - vma) >= 0.3 ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5"}`}>
                  <div className="text-[10px] uppercase text-muted-foreground">VMA calibrée (estimée)</div>
                  <div className="text-xl font-bold text-primary">{calibratedVma ? calibratedVma.toFixed(1) : "—"}<span className="text-xs text-muted-foreground"> km/h</span></div>
                </div>
              </div>

              {efDiagnostic && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  À l'allure EF théorique actuelle (<strong>{fmtPace(efDiagnostic.efPaceSec)}/km</strong>, 65% de {vma.toFixed(1)} km/h),
                  l'athlète serait à ~<strong className={efDiagnostic.zone.text}>{Math.round(efDiagnostic.pct * 100)}% FCR ({efDiagnostic.zone.label})</strong>.
                  {efDiagnostic.pct > 0.72 && " → VMA surestimée : l'EF tombe trop haut en FC."}
                  {efDiagnostic.pct < 0.58 && " → VMA sous-estimée : l'EF tombe trop bas en FC."}
                </p>
              )}

              {/* Table d'allures par zone FCR */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-muted-foreground">Allures cibles par zone FC (FCR)</div>
                {FCR_ZONES.map((z) => {
                  const sLo = predictSpeed(z.lo / 100);
                  const sHi = predictSpeed(z.hi / 100);
                  const paceLo = sLo && sLo > 0 ? paceFromSpeed(sLo) : null;
                  const paceHi = sHi && sHi > 0 ? paceFromSpeed(sHi) : null;
                  return (
                    <div key={z.zone} className="flex items-center justify-between rounded-md border border-border/60 px-2.5 py-1.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${z.dot}`} />
                        <span className={`font-semibold ${z.text}`}>{z.label}</span>
                        <span className="text-muted-foreground">{bpmOf(z.lo)}–{bpmOf(z.hi)} bpm</span>
                      </div>
                      <span className="font-medium tabular-nums">
                        {paceHi && paceLo ? `${fmtPace(paceHi)} – ${fmtPace(paceLo)} /km` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Appliquer la VMA calibrée au profil */}
              {calibratedVma && (
                <Button onClick={handleApply} disabled={applying} className="w-full gap-2">
                  <Check className="h-4 w-4" />
                  {applying ? "Application…" : `Appliquer cette VMA (${(Math.round(calibratedVma * 10) / 10).toFixed(1)} km/h)`}
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground italic">
                « Appliquer » remplace la VMA du profil par la VMA calibrée (toutes les allures en % VMA seront recalculées).
                Plus tu remplis de paliers (intensités variées), plus la calibration est fiable.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <Card className="bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          Calibration allure ↔ FC
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
