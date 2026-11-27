/**
 * Convertit un temps de récup / durée saisi par le coach en SECONDES.
 *
 * Source unique de vérité pour TOUS les minuteurs de l'app (mode guidé, récup
 * classique, superset/tabata, écran récup) : ne jamais réécrire un parseur local,
 * sinon on retombe sur le bug « 1 min 30 → 60 s ».
 *
 * Formats gérés :
 *   "90", "90s", "90 s", "90sec", "30 secondes"
 *   "1min", "1 min", "2min"
 *   "1min30", "1 min 30", "1min30s"
 *   "1'30", "1’30", "1'30\"", "1:30"
 *   "emom", "0", "0s", "" → 0
 */
export function parseRecupSeconds(raw: string | null | undefined): number {
  if (raw == null) return 0;
  const t = String(raw).trim().toLowerCase();
  if (t === "" || t === "emom" || t === "0" || t === "0s") return 0;

  // Format horloge « mm:ss » / « mm'ss » / « mm’ss" »
  const clock = t.match(/^(\d+)\s*[:'’]\s*(\d{1,2})\s*["”]?$/);
  if (clock) return parseInt(clock[1], 10) * 60 + parseInt(clock[2], 10);

  let total = 0;
  let matched = false;
  const min = t.match(/(\d+)\s*min/);
  if (min) { total += parseInt(min[1], 10) * 60; matched = true; }
  const sec = t.match(/(\d+)\s*s(?:ec|econdes?)?\b/);
  if (sec) { total += parseInt(sec[1], 10); matched = true; }
  // « 1min30 » : minutes trouvées, nombre restant sans unité = secondes
  if (min && !sec) {
    const after = t.slice((min.index || 0) + min[0].length).match(/(\d+)/);
    if (after) { total += parseInt(after[1], 10); matched = true; }
  }
  if (!matched) { const n = parseInt(t, 10); if (!isNaN(n)) total = n; }
  return total;
}
