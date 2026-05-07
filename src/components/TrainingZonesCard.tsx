import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Activity, Heart } from "lucide-react";

interface TrainingZonesCardProps {
  athleteId: string;
}

interface PhysioData {
  vma: number | null;
  fc_max: number | null;
  fc_repos: number | null;
}

interface Zone {
  name: string;
  shortName: string;
  color: string;
  bgColor: string;
  borderColor: string;
  vmaMin: number;
  vmaMax: number | null;
  description: string;
}

const ZONES: Zone[] = [
  {
    name: "Zone 1 — Endurance fondamentale",
    shortName: "Z1",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    vmaMin: 60,
    vmaMax: 75,
    description: "Récupération active, longues sorties",
  },
  {
    name: "Zone 2 — Seuil aérobie",
    shortName: "Z2",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    vmaMin: 75,
    vmaMax: 88,
    description: "Développement aérobie, tempo",
  },
  {
    name: "Zone 3 — Seuil lactique",
    shortName: "Z3",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    vmaMin: 88,
    vmaMax: 100,
    description: "Allure compétition, fractionné",
  },
];

const RACE_TARGETS = [
  { label: "5 km", ratio: 0.95, color: "text-purple-700" },
  { label: "10 km", ratio: 0.90, color: "text-indigo-700" },
  { label: "Semi-marathon", ratio: 0.85, color: "text-blue-700" },
  { label: "Marathon", ratio: 0.80, color: "text-teal-700" },
];

function speedToPace(speedKmh: number): string {
  if (speedKmh <= 0) return "—";
  const paceMinPerKm = 60 / speedKmh;
  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - minutes) * 60);
  return `${minutes}'${seconds.toString().padStart(2, "0")}/km`;
}

function fcZone(fcMax: number | null, pct: number): string {
  if (!fcMax) return "—";
  return `${Math.round(fcMax * (pct / 100))} bpm`;
}

export function TrainingZonesCard({ athleteId }: TrainingZonesCardProps) {
  const [physio, setPhysio] = useState<PhysioData>({ vma: null, fc_max: null, fc_repos: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from("user_profiles")
          .select("vma, fc_max, fc_repos")
          .eq("id", athleteId)
          .single();
        if (data) setPhysio(data);
      } catch (e) {
        console.error("[TrainingZonesCard]", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [athleteId]);

  const { vma, fc_max } = physio;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">Chargement…</CardContent>
      </Card>
    );
  }

  if (!vma) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Zones d'entraînement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            VMA non renseignée. Complète les données physiologiques ci-dessus pour afficher les zones.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          Zones d'entraînement
          <span className="text-xs font-normal text-muted-foreground ml-1">
            (VMA {vma.toFixed(1)} km/h{fc_max ? ` · FCmax ${fc_max} bpm` : ""})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Training Zones */}
        <div className="space-y-2">
          {ZONES.map((zone) => {
            const speedMin = vma * (zone.vmaMin / 100);
            const speedMax = zone.vmaMax ? vma * (zone.vmaMax / 100) : null;
            const paceMin = speedMax ? speedToPace(speedMax) : "max";
            const paceMax = speedToPace(speedMin);
            const fcMin = fcZone(fc_max, zone.vmaMin);
            const fcMax2 = zone.vmaMax ? fcZone(fc_max, zone.vmaMax) : "max";

            return (
              <div
                key={zone.shortName}
                className={`rounded-lg border p-3 ${zone.bgColor} ${zone.borderColor}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-semibold ${zone.color}`}>
                      {zone.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{zone.description}</div>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <div className={`text-xs font-bold ${zone.color} flex items-center gap-1 justify-end`}>
                      <Activity className="h-3 w-3" />
                      {paceMin} – {paceMax}
                    </div>
                    {fc_max && (
                      <div className={`text-xs ${zone.color} flex items-center gap-1 justify-end opacity-80`}>
                        <Heart className="h-3 w-3" />
                        {fcMin} – {fcMax2}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      {zone.vmaMin}–{zone.vmaMax ?? "100"}% VMA
                      {fc_max && ` · ${zone.vmaMin}–${zone.vmaMax ?? "100"}% FCmax`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Race Pace Targets */}
        <div className="pt-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Allures cibles de compétition
          </div>
          <div className="grid grid-cols-2 gap-2">
            {RACE_TARGETS.map((r) => {
              const speed = vma * r.ratio;
              const pace = speedToPace(speed);
              const totalMin = Math.round((r.label === "5 km" ? 5 : r.label === "10 km" ? 10 : r.label === "Semi-marathon" ? 21.097 : 42.195) / speed * 60);
              const h = Math.floor(totalMin / 60);
              const m = totalMin % 60;
              const timeStr = h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
              return (
                <div key={r.label} className="bg-muted/40 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-muted-foreground">{r.label}</div>
                  <div className={`text-sm font-bold ${r.color}`}>{pace}</div>
                  <div className="text-[10px] text-muted-foreground">≈ {timeStr}</div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
