/**
 * Garmin TCX export — format Activity (laps par étape)
 * Importable via connect.garmin.com → Importer les données
 *
 * Chaque étape cardio devient un Lap distinct avec :
 * - durée réelle
 * - distance estimée (via VMA si dispo)
 * - FC cible moyenne (centre de la zone FCR)
 * - nom de l'étape dans Notes
 */

import type { CardioData, CardioStep, CardioBlock } from "@/components/CardioStepBuilder";

export interface GarminExportOptions {
  sessionName: string;
  sport: "course" | "velo" | "natation";
  athleteVma?: number | null;
  athleteFcMax?: number | null;
  athleteFcRepos?: number | null;
}

// ── Zones FCR Karvonen ───────────────────────────────────────────────────────

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
    mid:  Math.round(fcRepos + fcr * (z.pMin + z.pMax) / 200),
  };
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sportToTCX(sport: string): string {
  switch (sport) {
    case "velo":     return "Biking";
    case "natation": return "Swimming";
    default:         return "Running";
  }
}

// ── Calcul durée d'une étape (secondes) ─────────────────────────────────────

function stepSeconds(step: CardioStep, vma?: number | null): number {
  if (step.effort_type === "duration" && step.duration) return step.duration;
  if (step.effort_type === "distance" && step.distance && vma) {
    const meters = step.distance_unit === "km" ? step.distance * 1000 : step.distance;
    const speedMs = (vma / 3.6) * (step.vma_percentage ? step.vma_percentage / 100 : 1);
    return Math.round(meters / speedMs);
  }
  return 300; // défaut 5min
}

// Calcul distance d'une étape (mètres)
function stepMeters(step: CardioStep, vma?: number | null): number {
  if (step.effort_type === "distance" && step.distance) {
    return step.distance_unit === "km" ? step.distance * 1000 : step.distance;
  }
  if (step.effort_type === "duration" && step.duration && vma && step.vma_percentage) {
    const speedMs = (vma / 3.6) * step.vma_percentage / 100;
    return Math.round(speedMs * step.duration);
  }
  return 0;
}

// ── Génération d'un Lap ──────────────────────────────────────────────────────

function lapXml(
  step: CardioStep,
  startTime: Date,
  opts: GarminExportOptions,
  label: string,
): { xml: string; durationSeconds: number } {
  const secs     = stepSeconds(step, opts.athleteVma);
  const meters   = stepMeters(step, opts.athleteVma);
  const intensity = step.movement_type === "marche" ? "Resting" : "Active";
  const iso       = startTime.toISOString();

  // FC cible
  let hrXml = "";
  if (step.target_heart_rate && opts.athleteFcMax && opts.athleteFcRepos) {
    const zNum = parseInt(step.target_heart_rate.replace("Z", ""));
    const bpm  = getFcrBpm(zNum, opts.athleteFcMax, opts.athleteFcRepos);
    if (bpm) {
      hrXml = `
      <AverageHeartRateBpm><Value>${bpm.mid}</Value></AverageHeartRateBpm>
      <MaximumHeartRateBpm><Value>${bpm.high}</Value></MaximumHeartRateBpm>`;
    }
  }

  // Vitesse (m/s) si VMA connue
  let speedXml = "";
  if (opts.athleteVma && step.vma_percentage && step.movement_type !== "marche") {
    const ms = (opts.athleteVma / 3.6) * step.vma_percentage / 100;
    speedXml = `
      <MaximumSpeed>${ms.toFixed(2)}</MaximumSpeed>`;
  }

  // Trackpoint minimal (start + end) pour que Garmin accepte le lap
  const endTime = new Date(startTime.getTime() + secs * 1000).toISOString();
  const trackXml = `
      <Track>
        <Trackpoint>
          <Time>${iso}</Time>${hrXml ? `
          <HeartRateBpm><Value>${hrXml.includes("Average") ? hrXml.match(/<Value>(\d+)<\/Value>/)?.[1] ?? 0 : 0}</Value></HeartRateBpm>` : ""}
        </Trackpoint>
        <Trackpoint>
          <Time>${endTime}</Time>
        </Trackpoint>
      </Track>`;

  const xml = `
    <Lap StartTime="${iso}">
      <TotalTimeSeconds>${secs}</TotalTimeSeconds>
      <DistanceMeters>${meters}</DistanceMeters>${speedXml}${hrXml}
      <Intensity>${intensity}</Intensity>
      <TriggerMethod>Manual</TriggerMethod>
      <Notes>${escapeXml(label)}</Notes>${trackXml}
    </Lap>`;

  return { xml, durationSeconds: secs };
}

// ── Aplatir les étapes (blocs → répétitions) ────────────────────────────────

function flattenSteps(data: CardioData): Array<{ step: CardioStep; label: string }> {
  const { steps, blocks } = data;
  const result: Array<{ step: CardioStep; label: string }> = [];
  const seenBlocks = new Set<number>();

  for (const step of steps) {
    if (step.block_id) {
      if (seenBlocks.has(step.block_id)) continue;
      seenBlocks.add(step.block_id);
      const block = blocks.find(b => b.id === step.block_id);
      if (!block) continue;
      const blockSteps = steps.filter(s => s.block_id === step.block_id);
      for (let rep = 1; rep <= block.repetitions; rep++) {
        for (const bs of blockSteps) {
          const name = bs.movement_type === "marche" ? "Marche"
                     : bs.movement_type === "velo"   ? "Vélo"
                     : bs.movement_type === "natation" ? "Natation"
                     : "Course";
          const zone = bs.target_heart_rate ? ` ${bs.target_heart_rate}` : "";
          result.push({ step: bs, label: `[${rep}/${block.repetitions}] ${name}${zone}` });
        }
      }
    } else {
      const name = step.movement_type === "marche" ? "Marche"
                 : step.movement_type === "velo"   ? "Vélo"
                 : step.movement_type === "natation" ? "Natation"
                 : "Course";
      const zone = step.target_heart_rate ? ` ${step.target_heart_rate}` : "";
      result.push({ step, label: `${name}${zone}` });
    }
  }
  return result;
}

// ── Export principal ─────────────────────────────────────────────────────────

export function exportToTCX(data: CardioData, opts: GarminExportOptions): string {
  const flatSteps = flattenSteps(data);
  if (!flatSteps.length) return "";

  // Date de départ = demain à 09:00
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(9, 0, 0, 0);

  let cursor = new Date(startDate);
  const laps: string[] = [];

  for (const { step, label } of flatSteps) {
    const { xml, durationSeconds } = lapXml(step, cursor, opts, label);
    laps.push(xml);
    cursor = new Date(cursor.getTime() + durationSeconds * 1000);
  }

  const id = startDate.toISOString();

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2
    http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="${sportToTCX(opts.sport)}">
      <Id>${id}</Id>
      <Notes>${escapeXml(opts.sessionName)}</Notes>
      ${laps.join("\n      ")}
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
}

export function downloadTCX(data: CardioData, opts: GarminExportOptions): void {
  const xml  = exportToTCX(data, opts);
  const blob = new Blob([xml], { type: "application/octet-stream" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${opts.sessionName.replace(/\s+/g, "_")}.tcx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
