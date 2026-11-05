import { formatDurationSec } from "@/lib/formatDuration";

/**
 * Unité d'un exercice : reps / durée / distance / calories.
 * Source unique de vérité pour l'affichage côté coach ET athlète.
 */
export type UnitMode = "reps" | "duration" | "distance" | "calories";

const truthy = (v: unknown) => v === true || v === "true";

export function unitModeOf(ex: { is_duration?: unknown; is_distance?: unknown; is_calories?: unknown } | null | undefined): UnitMode {
  if (!ex) return "reps";
  if (truthy(ex.is_duration)) return "duration";
  if (truthy(ex.is_distance)) return "distance";
  if (truthy(ex.is_calories)) return "calories";
  return "reps";
}

/** Libellé du champ (ex. en-tête de colonne). */
export function unitLabel(mode: UnitMode): string {
  return mode === "duration" ? "Durée" : mode === "distance" ? "Distance" : mode === "calories" ? "Calories" : "Reps";
}

/** Suffixe d'unité à accoler à une valeur ("" pour durée car déjà formatée). */
export function unitSuffix(mode: UnitMode): string {
  return mode === "distance" ? " m" : mode === "calories" ? " kcal" : mode === "reps" ? " reps" : "";
}

/** Badge court pour le toggle de l'éditeur. */
export function unitChip(mode: UnitMode): string {
  return mode === "duration" ? "⏱ durée" : mode === "distance" ? "📏 distance" : mode === "calories" ? "🔥 kcal" : "🔢 reps";
}

/** Placeholder du champ de saisie selon l'unité. */
export function unitPlaceholder(mode: UnitMode): string {
  return mode === "duration" ? "sec ou 10min" : mode === "distance" ? "m" : mode === "calories" ? "kcal" : "10";
}

/** Pas du stepper +/−. */
export function unitStep(mode: UnitMode): number {
  return mode === "duration" ? 5 : mode === "distance" ? 10 : mode === "calories" ? 10 : 1;
}

/** Formate une valeur pour l'affichage (durée via formatDurationSec, sinon valeur + suffixe). */
export function formatMeasure(value: string | number | null | undefined, mode: UnitMode): string {
  const v = value == null ? "" : String(value);
  if (v === "") return "";
  if (mode === "duration") return formatDurationSec(v);
  return `${v}${unitSuffix(mode)}`;
}
