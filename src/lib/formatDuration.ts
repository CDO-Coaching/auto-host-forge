/** Formate une durée stockée en secondes pour l'affichage : "45s", "10 min", "1 min 30". */
export function formatDurationSec(raw: string | number | null | undefined): string {
  const n = parseFloat(String(raw ?? ""));
  if (isNaN(n)) return String(raw ?? "");
  if (n < 60) return `${n}s`;
  const min = Math.floor(n / 60);
  const sec = Math.round(n % 60);
  return sec === 0 ? `${min} min` : `${min} min ${sec.toString().padStart(2, "0")}`;
}

/** Parse une saisie coach de durée ("600", "10min", "10 min 30", "1:30") en secondes. Renvoie la saisie inchangée si non reconnue. */
export function parseDurationInput(v: string): string {
  const s = v.trim().toLowerCase();
  if (!s) return v;
  let m = s.match(/^(\d+)\s*(?:min|mn|m)(?:\s*(\d{1,2})\s*s?)?$/);
  if (m) return String(parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0));
  m = s.match(/^(\d+):([0-5]?\d)$/);
  if (m) return String(parseInt(m[1], 10) * 60 + parseInt(m[2], 10));
  return v;
}
