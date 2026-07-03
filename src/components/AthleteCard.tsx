import { STAT_CODES, STAT_LABELS, DISTANCE_LABEL, AMBITION_LABEL, type Distance, type Ambition, type StatCode } from "@/lib/profileReferentials";
import type { Quality } from "@/lib/profileEngine";

export interface AthleteCardProps {
  athleteName: string;
  overall: number;
  distance: Distance;
  ambition: Ambition;
  scores: Partial<Record<StatCode, number>>;
  strengths: StatCode[];
  weaknesses: StatCode[];
  recommendation: string;
  dataQuality: Partial<Record<StatCode, Quality>>;
}

function profileLabel(scores: Partial<Record<StatCode, number>>): string {
  const vma = scores.VMA, end = scores.END, seu = scores.SEU;
  if (vma == null && end == null) return "Profil";
  const vals = [vma, end, seu].filter((v): v is number => v != null);
  if (vals.length < 2) return "Profil";
  const max = Math.max(...vals), min = Math.min(...vals);
  if (max - min < 8) return "Profil équilibré";
  if (vma === max) return "Profil vitesse";
  if (end === max) return "Profil diesel";
  return "Profil équilibré";
}

export function AthleteCard({ athleteName, overall, distance, ambition, scores, strengths, weaknesses, recommendation, dataQuality }: AthleteCardProps) {
  return (
    <div
      className="rounded-2xl p-5 sm:p-6 mx-auto max-w-sm"
      style={{ background: "#16161a", border: "1px solid #c9a227" }}
    >
      <div className="text-center mb-3">
        <div className="text-4xl font-bold" style={{ color: "#e6c65c" }}>{overall}</div>
        <div className="text-[11px] tracking-widest font-semibold" style={{ color: "#c9a227" }}>
          {DISTANCE_LABEL[distance]} · {AMBITION_LABEL[ambition]}
        </div>
      </div>

      <div className="text-center mb-4">
        <p className="text-sm font-semibold" style={{ color: "#f2f2f0" }}>{athleteName}</p>
        <p className="text-xs" style={{ color: "#c9a227" }}>{profileLabel(scores)}</p>
      </div>

      <div className="h-px my-3" style={{ background: "#c9a227", opacity: 0.4 }} />

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {STAT_CODES.map((s) => {
          const q = dataQuality[s];
          const score = scores[s];
          const isStrong = strengths.includes(s);
          const isWeak = weaknesses.includes(s);
          const color = q !== "ok" ? "#6b6b66" : isStrong ? "#4ade80" : isWeak ? "#F09595" : "#f2f2f0";
          return (
            <div key={s} className="flex items-center justify-between text-sm">
              <span style={{ color: "#9a9a94" }}>{s}</span>
              <span className="font-semibold flex items-center gap-1" style={{ color }}>
                {q !== "ok" ? "à tester" : (
                  <>
                    {score}
                    {isStrong && "↑"}
                    {isWeak && "↓"}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="h-px my-3" style={{ background: "#c9a227", opacity: 0.4 }} />

      <div>
        <p className="text-[10px] font-semibold tracking-widest mb-1" style={{ color: "#c9a227" }}>
          PRIORITÉ ENTRAÎNEMENT
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "#d4d4d0" }}>{recommendation}</p>
      </div>
    </div>
  );
}
