/**
 * HeartRateZonesBar
 * Affiche le temps passé dans chaque zone de FC (données Strava).
 *
 * Si fcMax ET fcRepos sont fournis, les zones Strava sont redistribuées
 * dans les 5 zones FCR Karvonen par chevauchement de bornes BPM :
 *   FC cible = fcRepos + (fcMax - fcRepos) × % zone
 *
 * Zones FCR :
 *   Z1 50-60% · Z2 60-70% · Z3 70-80% · Z4 80-90% · Z5 90-100%
 * Noms :
 *   Z1 Récupération · Z2 Endurance Fondamentale · Z3 Résistance Douce
 *   Z4 Résistance Dure · Z5 Puissance
 */

interface HRZone {
  zone: number;
  min: number;
  max: number;
  time_seconds: number;
}

interface HeartRateZonesBarProps {
  zones: HRZone[];
  compact?: boolean;
  fcMax?: number | null;
  fcRepos?: number | null;
}

const FCR_ZONES = [
  { zone: 1, fcrMin: 50, fcrMax: 60,  bg: "bg-blue-500",   text: "text-blue-400",   label: "Z1 · Récup",      fullLabel: "Z1 · Récupération" },
  { zone: 2, fcrMin: 60, fcrMax: 70,  bg: "bg-green-500",  text: "text-green-400",  label: "Z2 · Endurance",  fullLabel: "Z2 · Endurance fondamentale" },
  { zone: 3, fcrMin: 70, fcrMax: 80,  bg: "bg-yellow-400", text: "text-yellow-400", label: "Z3 · Résist. douce", fullLabel: "Z3 · Résistance douce" },
  { zone: 4, fcrMin: 80, fcrMax: 90,  bg: "bg-orange-500", text: "text-orange-400", label: "Z4 · Résist. dure",  fullLabel: "Z4 · Résistance dure" },
  { zone: 5, fcrMin: 90, fcrMax: 100, bg: "bg-red-500",    text: "text-red-400",    label: "Z5 · Puissance",  fullLabel: "Z5 · Puissance" },
];

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}min${s}s` : `${m}min`;
}

/**
 * Redistribue les zones Strava (bornes BPM) dans les zones FCR Karvonen.
 * Hypothèse : distribution uniforme du temps dans chaque zone Strava.
 */
function redistributeToFCR(
  rawZones: HRZone[],
  fcRepos: number,
  fcMax: number,
): { zone: number; time_seconds: number }[] {
  const fcr = fcMax - fcRepos;

  // Bornes BPM des zones FCR
  const fcrBounds = FCR_ZONES.map((z) => ({
    zone: z.zone,
    low:  fcRepos + fcr * z.fcrMin / 100,
    high: fcRepos + fcr * z.fcrMax / 100,
  }));

  const totals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const raw of rawZones) {
    if (!raw.time_seconds || raw.time_seconds <= 0) continue;
    const rawLow  = raw.min ?? 0;
    const rawHigh = raw.max ?? 999;
    const rawSpan = rawHigh - rawLow;

    if (rawSpan <= 0) {
      // Pas de bornes BPM → zone brute directe
      const z = Math.min(Math.max(raw.zone, 1), 5);
      totals[z] += raw.time_seconds;
      continue;
    }

    for (const fcz of fcrBounds) {
      const overlapLow  = Math.max(rawLow, fcz.low);
      const overlapHigh = Math.min(rawHigh, fcz.high);
      if (overlapHigh <= overlapLow) continue;
      totals[fcz.zone] += raw.time_seconds * (overlapHigh - overlapLow) / rawSpan;
    }
  }

  return FCR_ZONES.map((z) => ({ zone: z.zone, time_seconds: Math.round(totals[z.zone]) }));
}

export function HeartRateZonesBar({
  zones,
  compact = false,
  fcMax,
  fcRepos,
}: HeartRateZonesBarProps) {
  if (!zones || zones.length === 0) return null;

  const hasFCR = !!(fcMax && fcRepos);

  // Zones à afficher : redistribuées FCR ou brutes Strava
  const displayZones = hasFCR
    ? redistributeToFCR(zones, fcRepos!, fcMax!)
    : zones.map((z) => ({ zone: z.zone, time_seconds: z.time_seconds }));

  const totalSeconds = displayZones.reduce((s, z) => s + z.time_seconds, 0);
  if (totalSeconds === 0) return null;

  const activeZones = displayZones.filter((z) => z.time_seconds > 0);

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      {!compact && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Zones de fréquence cardiaque
          </p>
          {hasFCR && (
            <span className="text-[9px] text-emerald-400 font-medium">FCR Karvonen</span>
          )}
        </div>
      )}

      {/* Barre empilée */}
      <div className="flex h-3 w-full rounded-full overflow-hidden gap-px">
        {displayZones.map((z) => {
          const pct = (z.time_seconds / totalSeconds) * 100;
          if (pct < 0.5) return null;
          const def = FCR_ZONES[z.zone - 1] ?? FCR_ZONES[4];
          return (
            <div
              key={z.zone}
              className={`${def.bg} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${def.fullLabel} · ${formatTime(z.time_seconds)}`}
            />
          );
        })}
      </div>

      {/* Légende */}
      <div className={`flex flex-wrap ${compact ? "gap-x-2 gap-y-0.5" : "gap-x-3 gap-y-1"}`}>
        {activeZones.map((z, i) => {
          const def = FCR_ZONES[z.zone - 1] ?? FCR_ZONES[4];
          const pct = Math.round((z.time_seconds / totalSeconds) * 100);
          return (
            <div key={i} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${def.bg} shrink-0`} />
              <span className={`${compact ? "text-[9px]" : "text-[10px]"} text-muted-foreground`}>
                <span className={`font-semibold ${def.text}`}>
                  {compact ? `Z${z.zone}` : def.label}
                </span>
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
