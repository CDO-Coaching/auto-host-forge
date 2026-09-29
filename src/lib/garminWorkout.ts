/**
 * Génère un WORKOUT structuré Garmin au format TCX (à importer dans Garmin Connect →
 * l'athlète le lance sur sa montre qui le guide et bipe hors de la zone cardio).
 *
 * Différent de garminExport.ts (qui produit une ACTIVITY = séance déjà réalisée).
 * Ici on décrit des ÉTAPES avec cible = plage de fréquence cardiaque (bpm).
 */
import type { CardioData, CardioStep } from "@/components/CardioStepBuilder";

const FCR_ZONES = [
  { zone: 1, pMin: 50, pMax: 60 },
  { zone: 2, pMin: 60, pMax: 70 },
  { zone: 3, pMin: 70, pMax: 80 },
  { zone: 4, pMin: 80, pMax: 90 },
  { zone: 5, pMin: 90, pMax: 100 },
];

export interface WorkoutExportOptions {
  sport: string;        // 'course' | 'velo' | 'natation' | …
  sessionName: string;
  athleteVma?: number | null;
  fcMax?: number | null;
  fcRepos?: number | null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function sportToTCX(sport: string): "Running" | "Biking" | "Other" {
  if (sport === "course") return "Running";
  if (sport === "velo") return "Biking";
  return "Other";
}

/** Bornes bpm d'une cible FC : plage "136-150", zone "Z2"/"Zone 2" → Karvonen, ou valeur "150" → ±5. */
function hrBounds(target: string | undefined, fcMax?: number | null, fcRepos?: number | null): { low: number; high: number } | null {
  if (!target) return null;
  const t = String(target).trim();
  // Plage explicite "136-150" (bpm)
  const range = t.match(/(\d{2,3})\s*[-–]\s*(\d{2,3})/);
  if (range) {
    const a = parseInt(range[1], 10), b = parseInt(range[2], 10);
    if (a > 60 && b <= 230 && a < b) return { low: a, high: b };
  }
  // Zone Karvonen "Z2" / "Zone 2"
  const zMatch = t.match(/z(?:one)?\s*(\d)/i);
  if (zMatch && fcMax && fcRepos && fcMax > fcRepos) {
    const z = FCR_ZONES.find((x) => x.zone === parseInt(zMatch[1], 10));
    if (z) {
      const low = Math.round(fcRepos + (fcMax - fcRepos) * z.pMin / 100);
      const high = Math.round(fcRepos + (fcMax - fcRepos) * z.pMax / 100);
      return { low, high };
    }
  }
  // Valeur unique "150"
  const num = parseInt(t.replace(/[^\d]/g, ""), 10);
  if (!isNaN(num) && num > 60 && num < 230) return { low: num - 5, high: num + 5 };
  return null;
}

/** Cible d'allure → bornes de vitesse (m/s) avec ±4 % de marge. Course uniquement. */
function speedBounds(step: CardioStep, vma?: number | null): { low: number; high: number } | null {
  if (step.movement_type !== "course") return null;
  if (!step.vma_percentage || !vma || vma <= 0) return null;
  const kmh = vma * (step.vma_percentage / 100);
  const mps = (kmh * 1000) / 3600;
  if (mps <= 0) return null;
  return { low: +(mps * 0.96).toFixed(2), high: +(mps * 1.04).toFixed(2) };
}

function stepSeconds(step: CardioStep): number {
  return step.effort_type === "duration" ? (step.duration || 0) : 0;
}
function stepMeters(step: CardioStep): number {
  if (step.effort_type !== "distance") return 0;
  const d = step.distance || 0;
  return step.distance_unit === "km" ? d * 1000 : d;
}

function stepName(step: CardioStep): string {
  const mvt: Record<string, string> = { course: "Course", marche: "Marche", velo: "Vélo", natation: "Nat.", repos: "Repos" };
  return (mvt[step.movement_type] || "Effort").slice(0, 15);
}

function durationXml(step: CardioStep): string {
  const secs = stepSeconds(step);
  const meters = stepMeters(step);
  if (meters > 0) return `<Duration xsi:type="Distance_t"><Meters>${Math.round(meters)}</Meters></Duration>`;
  if (secs > 0) return `<Duration xsi:type="Time_t"><Seconds>${Math.round(secs)}</Seconds></Duration>`;
  // Sans durée définie → bouton "lap" sur la montre
  return `<Duration xsi:type="UserDefined_t"><Button>Lap</Button></Duration>`;
}

function targetXml(step: CardioStep, opts: WorkoutExportOptions): string {
  // 1) Cible FC prescrite (plage bpm ou zone)
  const hr = hrBounds(step.target_heart_rate, opts.fcMax, opts.fcRepos);
  if (hr) {
    return `<Target xsi:type="HeartRate_t"><HeartRateZone xsi:type="CustomHeartRateZone_t"><Low xsi:type="HeartRateInBeatsPerMinute_t"><Value>${hr.low}</Value></Low><High xsi:type="HeartRateInBeatsPerMinute_t"><Value>${hr.high}</Value></High></HeartRateZone></Target>`;
  }
  // 2) Sinon cible d'allure (vitesse)
  const sp = speedBounds(step, opts.athleteVma);
  if (sp) {
    return `<Target xsi:type="Speed_t"><SpeedZone xsi:type="CustomSpeedZone_t"><LowInMetersPerSecond>${sp.low}</LowInMetersPerSecond><HighInMetersPerSecond>${sp.high}</HighInMetersPerSecond></SpeedZone></Target>`;
  }
  // 3) Sinon pas de cible (chrono/distance simple)
  return `<Target xsi:type="None_t"/>`;
}

function intensity(step: CardioStep): "Active" | "Resting" {
  return step.movement_type === "repos" ? "Resting" : "Active";
}

let stepIdCounter = 1;
function singleStepXml(step: CardioStep, opts: WorkoutExportOptions): string {
  const id = stepIdCounter++;
  return `      <Step xsi:type="Step_t">
        <StepId>${id}</StepId>
        <Name>${esc(stepName(step))}</Name>
        ${durationXml(step)}
        <Intensity>${intensity(step)}</Intensity>
        ${targetXml(step, opts)}
      </Step>`;
}

export function generateWorkoutTcx(data: CardioData, opts: WorkoutExportOptions): string {
  stepIdCounter = 1;
  const steps = data.steps || [];
  const blocks = data.blocks || [];
  const rendered = new Set<number>();
  const parts: string[] = [];

  for (const step of steps) {
    if (step.block_id != null) {
      if (rendered.has(step.block_id)) continue;
      rendered.add(step.block_id);
      const block = blocks.find((b) => b.id === step.block_id);
      if (!block) continue;
      const blockSteps = steps.filter((s) => s.block_id === block.id);
      const repeatId = stepIdCounter++;
      const children = blockSteps.map((bs) => singleStepXml(bs, opts).replace(/<Step /g, '<Child ').replace(/<\/Step>/g, "</Child>")).join("\n");
      parts.push(`      <Step xsi:type="Repeat_t">
        <StepId>${repeatId}</StepId>
        <Repetitions>${block.repetitions}</Repetitions>
${children}
      </Step>`);
    } else {
      parts.push(singleStepXml(step, opts));
    }
  }

  // Garmin limite le nom du workout ; on tronque.
  const name = esc((opts.sessionName || "Séance").slice(0, 15));

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Workouts>
    <Workout Sport="${sportToTCX(opts.sport)}">
      <Name>${name}</Name>
${parts.join("\n")}
    </Workout>
  </Workouts>
</TrainingCenterDatabase>`;
}

export function downloadWorkoutTcx(data: CardioData, opts: WorkoutExportOptions): void {
  const xml = generateWorkoutTcx(data, opts);
  const blob = new Blob([xml], { type: "application/vnd.garmin.tcx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = (opts.sessionName || "seance").replace(/[^a-z0-9]+/gi, "_").toLowerCase().slice(0, 30);
  a.href = url;
  a.download = `garmin_${safe}.tcx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
