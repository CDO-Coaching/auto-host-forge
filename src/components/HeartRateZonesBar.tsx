/**
 * HeartRateZonesBar
 * Affiche le temps passé dans chaque zone de FC (données Strava).
 */

interface HRZone {
  zone: number;
  min: number;
  max: number;
  time_seconds: number;
}

interface HeartRateZonesBarProps {
  zones: HRZone[];
  compact?: boolean; // true = version mini pour MobileProgView
}

const ZONE_COLORS = [
  { bg: "bg-blue-500",   text: "text-blue-400",   label: "Z1 · Récup" },
  { bg: "bg-green-500",  text: "text-green-400",  label: "Z2 · Endurance" },
  { bg: "bg-yellow-400", text: "text-yellow-400", label: "Z3 · Tempo" },
  { bg: "bg-orange-500", text: "text-orange-400", label: "Z4 · Seuil" },
  { bg: "bg-red-500",    text: "text-red-400",    label: "Z5 · Max" },
];

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}min${s}s` : `${m}min`;
}

export function HeartRateZonesBar({ zones, compact = false }: HeartRateZonesBarProps) {
  const totalSeconds = zones.reduce((sum, z) => sum + z.time_seconds, 0);
  if (totalSeconds === 0) return null;

  // Filtre les zones sans temps
  const activeZones = zones.filter((z) => z.time_seconds > 0);

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      {!compact && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Zones de fréquence cardiaque
        </p>
      )}

      {/* Barre empilée */}
      <div className="flex h-3 w-full rounded-full overflow-hidden gap-px">
        {zones.map((z, i) => {
          const pct = totalSeconds > 0 ? (z.time_seconds / totalSeconds) * 100 : 0;
          if (pct === 0) return null;
          const color = ZONE_COLORS[i] ?? ZONE_COLORS[4];
          return (
            <div
              key={i}
              className={`${color.bg} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${color.label} · ${formatTime(z.time_seconds)}`}
            />
          );
        })}
      </div>

      {/* Légende */}
      <div className={`flex flex-wrap ${compact ? "gap-x-2 gap-y-0.5" : "gap-x-3 gap-y-1"}`}>
        {activeZones.map((z, i) => {
          const idx = z.zone - 1;
          const color = ZONE_COLORS[idx] ?? ZONE_COLORS[4];
          const pct = Math.round((z.time_seconds / totalSeconds) * 100);
          return (
            <div key={i} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${color.bg} shrink-0`} />
              <span className={`${compact ? "text-[9px]" : "text-[10px]"} text-muted-foreground`}>
                <span className={`font-semibold ${color.text}`}>Z{z.zone}</span>
                {" "}{formatTime(z.time_seconds)}
                {!compact && <span className="opacity-60"> ({pct}%)</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
