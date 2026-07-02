// Référentiels de la "carte coureur" — facilement ajustables.
export type Distance = "5k" | "10k" | "half" | "marathon";
export type Ambition = "finisher" | "progression" | "perf";
export type StatCode = "VMA" | "END" | "SEU" | "ECO" | "MUS" | "MEN" | "REG";

export const STAT_CODES: StatCode[] = ["VMA", "END", "SEU", "ECO", "MUS", "MEN", "REG"];
export const STAT_LABELS: Record<StatCode, string> = {
  VMA: "Vitesse (VMA)",
  END: "Endurance",
  SEU: "Seuil",
  ECO: "Économie",
  MUS: "Endurance musculaire",
  MEN: "Gestion mentale",
  REG: "Régularité",
};

const D: Distance[] = ["5k", "10k", "half", "marathon"];
const byDist = (v: [number, number, number, number]) =>
  ({ "5k": v[0], "10k": v[1], half: v[2], marathon: v[3] } as Record<Distance, number>);

// ── 5.1 Pondérations (perf & progression identiques) ──
const WEIGHTS_BASE: Record<StatCode, Record<Distance, number>> = {
  VMA: byDist([3, 2.5, 1.5, 1]),
  END: byDist([1.5, 2, 2.5, 3]),
  SEU: byDist([2, 2.5, 2.5, 2]),
  ECO: byDist([1, 1, 1.5, 2]),
  MUS: byDist([1, 1, 1.5, 2.5]),
  MEN: byDist([1, 1, 1, 1.5]),
  REG: byDist([1.5, 1.5, 2, 2.5]),
};

export function getWeights(distance: Distance, ambition: Ambition): Record<StatCode, number> {
  const w = {} as Record<StatCode, number>;
  for (const s of STAT_CODES) w[s] = WEIGHTS_BASE[s][distance];
  if (ambition === "finisher") {
    w.VMA = 0.5;         // VMA à 0,5 partout
    w.MUS = w.MUS * 2;   // MUS et REG doublés
    w.REG = w.REG * 2;
  }
  return w;
}

// ── 5.2 / 5.3 / 5.4 Cibles et planchers (cible / plancher) ──
type Ref = { cible: Record<Distance, number>; plancher: Record<Distance, number> };
const ref = (c: [number, number, number, number], p: [number, number, number, number]): Ref =>
  ({ cible: byDist(c), plancher: byDist(p) });

const REFERENTIALS: Record<Ambition, Record<StatCode, Ref>> = {
  perf: {
    VMA: ref([20, 20, 20, 20], [10, 10, 10, 10]),
    END: ref([-6, -6, -5.5, -5], [-12, -12, -11, -10]),
    SEU: ref([87, 87, 88, 88], [77, 77, 78, 78]),
    ECO: ref([3, 3, 2.5, 2], [10, 10, 9, 8]),
    MUS: ref([2, 2, 2, 1.5], [8, 8, 7, 6]),
    MEN: ref([0.5, 0.5, 0.5, 0.5], [3, 3, 3, 2.5]),
    REG: ref([95, 95, 95, 95], [60, 60, 60, 60]),
  },
  progression: {
    VMA: ref([20, 20, 20, 20], [10, 10, 10, 10]),
    END: ref([-7, -7, -6.5, -6], [-12, -12, -11, -10]),
    SEU: ref([84, 84, 85, 85], [77, 77, 78, 78]),
    ECO: ref([4, 4, 3.5, 3], [10, 10, 9, 8]),
    MUS: ref([3, 3, 3, 2.5], [8, 8, 7, 6]),
    MEN: ref([1, 1, 1, 1], [3, 3, 3, 2.5]),
    REG: ref([90, 90, 90, 90], [60, 60, 60, 60]),
  },
  finisher: {
    VMA: ref([20, 20, 20, 20], [10, 10, 10, 10]),
    END: ref([-8, -8, -7.5, -7], [-13, -13, -12, -11]),
    SEU: ref([80, 80, 81, 81], [72, 72, 73, 73]),
    ECO: ref([5, 5, 4.5, 4], [12, 12, 11, 10]),
    MUS: ref([4, 4, 4, 3.5], [10, 10, 9, 8]),
    MEN: ref([1.5, 1.5, 1.5, 1.5], [4, 4, 4, 3.5]),
    REG: ref([85, 85, 85, 85], [55, 55, 55, 55]),
  },
};

export function getRef(stat: StatCode, distance: Distance, ambition: Ambition): { cible: number; plancher: number } {
  const r = REFERENTIALS[ambition][stat];
  return { cible: r.cible[distance], plancher: r.plancher[distance] };
}

// ── 6. Recommandations par point faible ──
export const RECOMMENDATIONS: Record<StatCode, { short: string; detail: string }> = {
  VMA: { short: "Développer la vitesse aérobie", detail: "Intervalles courts (30/30, 200-400 m), 1-2 séances VMA/semaine en bloc de 6-8 sem." },
  END: { short: "Construire l'endurance de base", detail: "Augmenter le volume en EF (+10 %/sem max), sortie longue progressive." },
  SEU: { short: "Travailler le seuil", detail: "Séances tempo, intervalles longs (2×15 min, 3×10 min à 85-88 % VMA)." },
  ECO: { short: "Améliorer l'économie de course", detail: "Volume EF, travail de cadence (170-180 ppm), côtes courtes, renfo." },
  MUS: { short: "Renforcer l'endurance musculaire", detail: "Renfo spécifique (pliométrie, unilatéral), fin de sortie longue à allure cible, côtes longues." },
  MEN: { short: "Apprivoiser l'effort", detail: "Séances \"négative split\", visualisation, segmentation mentale des séances dures." },
  REG: { short: "Stabiliser la routine", detail: "Réduire le volume planifié pour viser 100 % de réalisation, plan minimal garanti." },
};

export const DISTANCE_LABEL: Record<Distance, string> = { "5k": "5 KM", "10k": "10 KM", half: "SEMI", marathon: "MARATHON" };
export const AMBITION_LABEL: Record<Ambition, string> = { finisher: "FINISHER", progression: "PROGRESSION", perf: "PERF" };
