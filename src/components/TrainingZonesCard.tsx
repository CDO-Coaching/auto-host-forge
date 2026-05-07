import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Activity, Heart } from "lucide-react";

interface TrainingZonesCardProps {
  athleteId: string;
}

const ZONES = [
  {
    shortName: "Z1",
    name: "Endurance fondamentale",
    vmaMin: 60,
    vmaMax: 75,
    description: "Récupération active, longues sorties",
    accent: "border-l-blue-400",
    label: "text-blue-400",
  },
  {
    shortName: "Z2",
    name: "Seuil aérobie",
    vmaMin: 75,
    vmaMax: 88,
    description: "Développement aérobie, tempo",
    accent: "border-l-emerald-400",
    label: "text-emerald-400",
  },
  {
    shortName: "Z3",
    name: "Seuil lactique",
    vmaMin: 88,
    vmaMax: 100,
    description: "Allure compétition, fractionné",
    accent: "border-l-orange-400",
    label: "text-orange-400",
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

  useEffect(() => {
    supabase
      .from("user_profiles")
      .select("vma, fc_max")
      .eq("id", athleteId)
      .single()
      .then(({ data }) => {
        if (data?.vma) setVma(data.vma);
        if (data?.fc_max) setFcMax(data.fc_max);
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
            {vma.toFixed(1)} km/h{fcMax ? ` · FCmax ${fcMax} bpm` : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        <div className="space-y-2">
          {ZONES.map((z) => {
            const fast = vma * (z.vmaMax / 100);
            const slow = vma * (z.vmaMin / 100);
            const fcLow = fcMax ? Math.round(fcMax * z.vmaMin / 100) : null;
            const fcHigh = fcMax ? Math.round(fcMax * z.vmaMax / 100) : null;
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
                      {z.vmaMin}–{z.vmaMax}% VMA{fcMax ? ` · ${z.vmaMin}–${z.vmaMax}% FCmax` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    <div className={`flex items-center gap-1 justify-end text-sm font-bold ${z.label}`}>
                      <Activity className="h-3.5 w-3.5" />
                      {speedToPace(fast)} – {speedToPace(slow)}
                    </div>
                    {fcLow && fcHigh && (
                      <div className={`flex items-center gap-1 justify-end text-xs ${z.label} opacity-75`}>
                        <Heart className="h-3 w-3" />
                        {fcLow} – {fcHigh} bpm
                      </div>
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
