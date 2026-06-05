/**
 * Garmin TCX export — génère un fichier d'entraînement structuré
 * compatible Garmin Connect (import manuel → sync montre).
 *
 * Format : Training Center XML v2 (TCX)
 * Sport supporté : Running, Biking, Swimming
 */

import type { CardioData, CardioStep, CardioBlock } from "@/components/CardioStepBuilder";

export interface GarminExportOptions {
  sessionName: string;
  sport: "course" | "velo" | "natation";
  athleteVma?: number | null;
  athleteFcMax?: number | null;
  athleteFcRepos?: number | null;
}

// ── Zones FCR Karvonen ──────────────────────────────────────────────────────

const FCR_ZONES = [
  { zone: 1, pMin: 50, pMax: 60 },
  { zone: 2, pMin: 60, pMax: 70 },
  { zone: 3, pMin: 70, pMax: 80 },
  { zone: 4, pMin: 80, pMax: 90 },
  { zone: 5, pMin: 90, pMax: 100 },
];

function getFcrBpm(zoneNum: number, fcMax: number, fcRepos: number) {
  const z = FCR_ZONES.find(z => z.zone === zoneNum);
  if (!z) return null;
  const fcr = fcMax - fcRepos;
  return {
    low:  Math.round(fcRepos + fcr * z.pMin / 100),
    high: Math.round(fcRepos + fcr * z.pMax / 100),
  };
}

// ── Helpers XML ─────────────────────────────────────────────────────────────

function sportToTCX(sport: string): string {
  switch (sport) {
    case "velo":     return "Biking";
    case "natation": return "Swimming";
    default:         return "Running";
  }
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Génération des cibles ────────────────────────────────────────────────────

function stepTarget(step: CardioStep, opts: GarminExportOptions): string {
  // Priorité 1 : zone FC cible (Z1–Z5) avec BPM calculés en Karvonen
  if (step.target_heart_rate && opts.athleteFcMax && opts.athleteFcRepos) {
    const zNum = parseInt(step.target_heart_rate.replace("Z", ""));
    const bpm = getFcrBpm(zNum, opts.athleteFcMax, opts.athleteFcRepos);
    if (bpm) {
      return `<Target xsi:type="HeartRate_t">
          <HeartRateZone xsi:type="CustomHeartRateZone_t">
            <Low xsi:type="HeartRateInBeatsPerMinute_t"><Value>${bpm.low}</Value></Low>
            <High xsi:type="HeartRateInBeatsPerMinute_t"><Value>${bpm.high}</Value></High>
          </HeartRateZone>
        </Target>`;
    }
  }

  // Priorité 2 : % VMA → plage de vitesse (±5%)
  if (step.vma_percentage && opts.athleteVma) {
    const vmaMs   = opts.athleteVma / 3.6;
    const targetMs = vmaMs * step.vma_percentage / 100;
    return `<Target xsi:type="Speed_t">
          <SpeedZone xsi:type="CustomSpeedZone_t">
            <LowInMetersPerSecond>${(targetMs * 0.95).toFixed(2)}</LowInMetersPerSecond>
            <HighInMetersPerSecond>${(targetMs * 1.05).toFixed(2)}</HighInMetersPerSecond>
          </SpeedZone>
        </Target>`;
  }

  return `<Target xsi:type="None_t"/>`;
}

// ── Durée / distance ─────────────────────────────────────────────────────────

function stepDuration(step: CardioStep): string {
  if (step.effort_type === "duration" && step.duration) {
    return `<Duration xsi:type="Time_t"><Seconds>${step.duration}</Seconds></Duration>`;
  }
  if (step.effort_type === "distance" && step.distance) {
    const meters = (step.distance_unit === "km")
      ? step.distance * 1000
      : step.distance;
    return `<Duration xsi:type="Distance_t"><Meters>${Math.round(meters)}</Meters></Duration>`;
  }
  return `<Duration xsi:type="UserInitiated_t"/>`;
}

// ── Étape simple ─────────────────────────────────────────────────────────────

let _id = 1;

function stepXml(step: CardioStep, opts: GarminExportOptions, tag = "Step"): string {
  const id        = _id++;
  const intensity = step.movement_type === "marche" ? "Resting" : "Active";
  const name      = step.movement_type === "marche"   ? "Marche"
                  : step.movement_type === "velo"    ? "Vélo"
                  : step.movement_type === "natation" ? "Natation"
                  : "Course";
  return `<${tag} xsi:type="Step_t">
        <StepId>${id}</StepId>
        <Name>${escapeXml(name)}</Name>
        ${stepDuration(step)}
        <Intensity>${intensity}</Intensity>
        ${stepTarget(step, opts)}
      </${tag}>`;
}

// ── Bloc répété ──────────────────────────────────────────────────────────────

function blockXml(block: CardioBlock, steps: CardioStep[], opts: GarminExportOptions): string {
  const id       = _id++;
  const children = steps
    .filter(s => s.block_id === block.id)
    .map(s => stepXml(s, opts, "Child"))
    .join("\n      ");
  return `<Step xsi:type="Repeat_t">
        <StepId>${id}</StepId>
        <Repetitions>${block.repetitions}</Repetitions>
        ${children}
      </Step>`;
}

// ── Export principal ─────────────────────────────────────────────────────────

export function exportToTCX(data: CardioData, opts: GarminExportOptions): string {
  _id = 1;
  const { steps, blocks } = data;
  const seenBlocks = new Set<number>();
  const stepsXml: string[] = [];

  for (const step of steps) {
    if (step.block_id) {
      if (seenBlocks.has(step.block_id)) continue;
      const block = blocks.find(b => b.id === step.block_id);
      if (block) { stepsXml.push(blockXml(block, steps, opts)); seenBlocks.add(step.block_id); }
    } else {
      stepsXml.push(stepXml(step, opts));
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2
    http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Workouts>
    <Workout Sport="${sportToTCX(opts.sport)}">
      <Name>${escapeXml(opts.sessionName)}</Name>
      ${stepsXml.join("\n      ")}
    </Workout>
  </Workouts>
</TrainingCenterDatabase>`;
}

export function downloadTCX(data: CardioData, opts: GarminExportOptions): void {
  const xml      = exportToTCX(data, opts);
  const blob     = new Blob([xml], { type: "application/octet-stream" });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement("a");
  a.href         = url;
  a.download     = `${opts.sessionName.replace(/\s+/g, "_")}.tcx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
