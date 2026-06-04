import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Heart } from "lucide-react";

interface TrainingZonesCardProps {
  athleteId: string;
}

/**
 * Zones d'entraînement basées sur la Fréquence Cardiaque de Réserve (Karvonen).
 * FC cible = fc_repos + FCR × % zone   (FCR = fc_max - fc_repos)
 */
const ZONES = [
  {
    shortName: "Z1",
    name: "Récupération active",
    fcrMin: 50,
    fcrMax: 60,
    description: "Récup entre les séances, footing très facile",
    accent: "border-l-blue-400",
    label: "text-blue-400",
  },
  {
    shortName: "Z2",
    name: "Endurance fondamentale",
    fcrMin: 60,
    fcrMax: 70,
    description: "Longues sorties, base aérobie",
    accent: "border-l-emerald-400",
    label: "text-emerald-400",
  },
  {
    shortName: "Z3",
    name: "Allure marathon",
    fcrMin: 70,
    fcrMax: 80,
    description: "Tempo, allure marathon",
    accent: "border-l-yellow-400",
    label: "text-yellow-400",
  },
  {
    shortName: "Z4",
    name: "Seuil anaérobie",
    fcrMin: 80,
    fcrMax: 90,
    description: "Semi-marathon / 10 km, fractionné long",
    accent: "border-l-orange-400",
    label: "text-orange-400",
  },
  {
    shortName: "Z5",
    name: "VMA / VO₂max",
    fcrMin: 90,
    fcrMax: 100,
    description: "Intervalles courts, effort maximal",
    accent: "border-l-red-400",
    label: "text-red-400",
  },
];

const RACE_TARGETS = [
  { label: "5 km", distanceKm: 5, ratio: 0.95 },
  { label: "10 km", distanceKm: 10, ratio: 0.90 },
  { label: "Semi-marathon", distanceKm: 21.097, ratio: 0.85 },
  { label: "Marathon", distanceKm: 42.195, ratio: 0.80 },
];

function speedToPace(kmh: number): string {
  if (kmh <= 0) return "—";
  const t = 60 / kmh;
  const m = Math.floor(t);
  const s = Math.round((t - m) * 60);
  return `${m}'${s.toString().padStart(2, "0")}/km`;
}

function raceTime(km: number, kmh: number): string {
  const min = Math.round((km / kmh) * 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m} min`;
}

export function TrainingZonesCard({ athleteId }: TrainingZonesCardProps) {
  const [vma, setVma] = useState<number | null>(null);
  const [fcMax, setFcMax] = useState<number | null>(null);
  const [fcRepos, setFcRepos] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("user_profiles")
      .select("vma, fc_max, fc_repos")
      .eq("id", athleteId)
      .single()
      .then(({ data }) => {
        if (data?.vma) setVma(data.vma);
        if (data?.fc_max) setFcMax(data.fc_max);
        if (data?.fc_repos) setFcRepos(data.fc_repos);
      });
  }, [athleteId]);

  if (!vma) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Zones d'entraînement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            VMA non renseignée — complète les données physiologiques ci-dessus.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Zones d'entraînement
          <span className="text-xs font-normal text-muted-foreground">
            {vma.toFixed(1)} km/h
            {fcMax ? ` · FCmax ${fcMax} bpm` : ""}
            {fcRepos ? ` · FCR ${fcMax ? fcMax - fcRepos : "?"} bpm` : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Indication méthode Karvonen si FC repos disponible */}
        {fcMax && fcRepos && (
          <div className="text-[11px] text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2 border border-border/40">
            <span className="font-semibold text-foreground">Méthode Karvonen (FCR)</span>
            {" "}· FC cible = {fcRepos} + {fcMax - fcRepos} × % zone
          </div>
        )}
        {fcMax && !fcRepos && (
          <div className="text-[11px] text-amber-400 bg-amber-400/10 rounded-lg px-3 py-2 border border-amber-400/20">
            ⚠️ FC de repos non renseignée — zones FC non disponibles. Ajoute-la dans les données physiologiques.
          </div>
        )}

        <div className="space-y-2">
          {ZONES.map((z) => {
            // Karvonen : FC cible = fc_repos + FCR × % zone
            const fcr = (fcMax && fcRepos) ? fcMax - fcRepos : null;
            const fcLow  = fcr !== null && fcRepos ? Math.round(fcRepos + fcr * z.fcrMin / 100) : null;
            const fcHigh = fcr !== null && fcRepos ? Math.round(fcRepos + fcr * z.fcrMax / 100) : null;
            return (
              <div
                key={z.shortName}
                className={`rounded-lg border border-border/40 bg-secondary/40 border-l-4 ${z.accent} p-3`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-xs font-bold ${z.label}`}>{z.shortName}</span>
                      <span className="text-xs font-medium text-foreground">{z.name}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{z.description}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {z.fcrMin}–{z.fcrMax}% FCR (Karvonen)
                    </div>
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    {fcLow && fcHigh && (
                      <div className={`flex items-center gap-1 justify-end text-sm font-bold ${z.label}`}>
                        <Heart className="h-3.5 w-3.5" />
                        {fcLow} – {fcHigh} bpm
                      </div>
                    )}
                    {!fcLow && (
                      <div className="text-[11px] text-muted-foreground italic">FC repos manquante</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Allures cibles compétition
          </p>
          <div className="grid grid-cols-2 gap-2">
            {RACE_TARGETS.map((r) => {
              const spd = vma * r.ratio;
              return (
                <div key={r.label} className="bg-secondary/40 border border-border/40 rounded-lg p-2.5 text-center">
                  <div className="text-[11px] text-muted-foreground">{r.label}</div>
                  <div className="text-sm font-bold text-primary">{speedToPace(spd)}</div>
                  <div className="text-[11px] text-muted-foreground">≈ {raceTime(r.distanceKm, spd)}</div>
                </div>
              );
            })}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
