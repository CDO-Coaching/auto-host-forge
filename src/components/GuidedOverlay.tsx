import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, Play, Pause, ChevronRight } from "lucide-react";

export interface GuidedStep {
  id: string;
  type: "work" | "recup";
  stepLabel?: string;   // "Étape 3 / 9"
  serieLabel?: string;  // "Série 2 / 4"
  exName?: string;
  exColor?: string;
  exNumber?: number;
  // work
  isDuration?: boolean;
  seconds?: number;         // durée (work durée OU récup)
  targetReps?: string;
  targetCharge?: string;
  chargeNeedsInput?: boolean;
  isDistance?: boolean;
  perSide?: boolean;
  phaseLabel?: string;      // ex. "🔥 Côté 1"
  phaseColor?: string;
  // recup
  nextLabel?: string;
  rpeTargets?: { id: string; label: string; color?: string }[];
  // callbacks
  onDone?: (data: { reps?: string; charge?: string }) => void;
  onSkip?: () => void;
  onRpe?: (rpe: number, targetId?: string) => void;
}

const RPE_COLOR = (v: number) => (v <= 3 ? "#52b788" : v <= 6 ? "#e8c466" : v <= 8 ? "#f59e0b" : "#e56464");
const fmt = (s: number) => `${Math.floor(Math.max(0, s) / 60).toString().padStart(2, "0")}:${Math.floor(Math.max(0, s) % 60).toString().padStart(2, "0")}`;

export function GuidedOverlay({ steps, onClose }: { steps: GuidedStep[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [reps, setReps] = useState("");
  const [charge, setCharge] = useState("");
  const [rpeAck, setRpeAck] = useState<Record<string, number>>({});
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const step = steps[idx];
  const total = steps.length;

  const stopTick = () => { if (tick.current) { clearInterval(tick.current); tick.current = null; } };

  const goNext = () => {
    stopTick();
    if (idx >= total - 1) { onClose(); return; }
    setIdx((i) => i + 1);
  };

  // (Re)initialise à chaque étape
  useEffect(() => {
    stopTick();
    if (!step) return;
    setReps(step.targetReps ?? "");
    setCharge(step.targetCharge ?? "");
    const isTimed = (step.type === "recup") || (step.type === "work" && step.isDuration);
    if (isTimed && step.seconds && step.seconds > 0) {
      setRemaining(step.seconds);
      setRunning(true);
    } else {
      setRemaining(0);
      setRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Décompte
  useEffect(() => {
    stopTick();
    if (!running) return;
    tick.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          stopTick();
          // fin du chrono : work durée => valider et avancer ; récup => avancer
          if (step?.type === "work") step?.onDone?.({ reps, charge });
          setTimeout(goNext, 400);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return stopTick;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, idx]);

  useEffect(() => () => stopTick(), []);

  if (!step) return null;

  const doneWork = () => { step.onDone?.({ reps, charge }); goNext(); };
  const skipWork = () => { step.onSkip?.(); goNext(); };
  const pickRpe = (v: number, targetId?: string) => {
    step.onRpe?.(v, targetId);
    setRpeAck((p) => ({ ...p, [targetId ?? "_"]: v }));
  };

  const rpeRows = step.rpeTargets && step.rpeTargets.length > 0 ? step.rpeTargets : [{ id: "_", label: "", color: undefined as string | undefined }];
  const sora = { fontFamily: "'Sora', system-ui, sans-serif" } as const;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-[#0c0c0c] text-white flex flex-col"
      style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))", paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <div className="px-4 flex flex-col gap-4 flex-1 overflow-y-auto max-w-lg mx-auto w-full">
        {/* Barre du haut */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[13px] font-bold uppercase tracking-wide text-[#e8c466]">Séance guidée</span>
          <button onClick={onClose} aria-label="Quitter le mode guidé" className="p-1 text-muted-foreground">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Progression */}
        <div>
          <div className="flex items-center justify-between mb-1.5 text-[12px] text-muted-foreground">
            <span>{step.stepLabel ?? `Étape ${idx + 1} / ${total}`}</span>
            {step.serieLabel && <span>{step.serieLabel}</span>}
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#e8c466] rounded-full transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
          </div>
        </div>

        {step.type === "work" ? (
          <div className="flex-1 flex flex-col justify-center gap-5">
            <div className="text-center">
              {step.exName && (
                <div className="inline-flex items-center gap-2 text-[13px] font-bold px-3 py-1.5 rounded-full" style={{ color: step.exColor || "#e8c466", background: `${step.exColor || "#e8c466"}26` }}>
                  {step.exNumber != null && (
                    <span className="h-[18px] w-[18px] rounded-full flex items-center justify-center text-[11px] font-extrabold" style={{ background: step.exColor || "#e8c466", color: "#1a1a1a" }}>{step.exNumber}</span>
                  )}
                  <span className="uppercase">{step.exName}</span>
                </div>
              )}

              {step.isDuration ? (
                <div className="mt-5 bg-[#141414] rounded-3xl p-7" style={{ border: `2px solid ${(step.phaseColor || "#52b788")}55` }}>
                  <div className="font-extrabold tabular-nums leading-none text-[72px]" style={sora}>{fmt(remaining)}</div>
                  {step.phaseLabel && <div className="text-2xl font-extrabold mt-3" style={{ color: step.phaseColor || "#52b788" }}>{step.phaseLabel}</div>}
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden mt-4">
                    <div className="h-full rounded-full" style={{ width: `${step.seconds ? ((step.seconds - remaining) / step.seconds) * 100 : 0}%`, background: step.phaseColor || "#52b788" }} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-[13px] text-muted-foreground mt-4 uppercase tracking-wide">À réaliser</div>
                  <div className="text-[64px] font-extrabold leading-none mt-1" style={sora}>
                    {step.targetReps || "—"}
                    <span className="text-2xl text-muted-foreground font-bold"> {step.isDistance ? "m" : "reps"}{step.perSide ? " /côté" : ""}</span>
                  </div>
                </>
              )}
            </div>

            {!step.isDuration && (
              <div className="grid grid-cols-2 gap-3">
                <label className="bg-[#141414] border border-white/10 rounded-2xl p-3">
                  <div className="text-[11px] text-muted-foreground uppercase">Charge réalisée</div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <input value={charge} onChange={(e) => setCharge(e.target.value)} inputMode="decimal"
                      className={`w-20 bg-transparent border-0 border-b-2 outline-none text-2xl font-extrabold ${step.chargeNeedsInput && !charge ? "border-[#f59e0b] text-[#f59e0b]" : "border-[#e8c466]"}`} style={sora}
                      placeholder={step.chargeNeedsInput ? "?" : ""} />
                    <span className="text-sm text-muted-foreground font-bold">kg</span>
                  </div>
                </label>
                <label className="bg-[#141414] border border-white/10 rounded-2xl p-3">
                  <div className="text-[11px] text-muted-foreground uppercase">{step.isDistance ? "Distance (m)" : "Reps réalisées"}</div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <input value={reps} onChange={(e) => setReps(e.target.value)} inputMode="numeric"
                      className="w-16 bg-transparent border-0 border-b-2 border-[#5aa9e6] outline-none text-2xl font-extrabold" style={sora} />
                  </div>
                </label>
              </div>
            )}
          </div>
        ) : (
          /* ── RÉCUP ── */
          <div className="flex-1 flex flex-col gap-3">
            <div className="bg-[#141414] rounded-2xl p-5 text-center" style={{ border: "2px solid #5aa9e655" }}>
              <div className="font-extrabold tabular-nums leading-none text-[56px]" style={sora}>{fmt(remaining)}</div>
              <div className="text-xl font-extrabold text-[#5aa9e6] mt-2">😮‍💨 Récupère</div>
              {step.nextLabel && <div className="text-[13px] text-muted-foreground mt-1">Ensuite : {step.nextLabel}</div>}
            </div>

            {step.onRpe && (
              <div className="bg-[#141414] border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] font-semibold">RPE ressenti</span>
                  <span className="text-[12px] text-muted-foreground">facultatif</span>
                </div>
                {rpeRows.map((row) => {
                  const acked = rpeAck[row.id];
                  return (
                    <div key={row.id} className="space-y-1.5">
                      {row.label && (
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          {row.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />}
                          <span className="truncate">{row.label}</span>
                          {acked != null && <span className="text-xs text-green-500 font-medium">✓ RPE {acked}</span>}
                        </div>
                      )}
                      <div className="grid grid-cols-5 gap-2">
                        {[1,2,3,4,5,6,7,8,9,10].map((v) => {
                          const c = RPE_COLOR(v);
                          const picked = acked === v;
                          return (
                            <button key={v} onClick={() => pickRpe(v, row.id)}
                              className="h-10 rounded-lg text-base font-bold active:scale-95 transition-transform"
                              style={{ border: `${picked ? 2 : 1}px solid ${picked ? c : c + "66"}`, background: `${c}${picked ? "33" : "1f"}`, color: c, ...sora }}>
                              {v}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex-1" />
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pb-1">
          {step.type === "work" && step.isDuration ? (
            <div className="flex gap-3">
              <button onClick={() => setRunning((r) => !r)} className="flex-1 h-14 rounded-2xl border border-white/15 bg-[#161616] font-bold flex items-center justify-center gap-2" style={sora}>
                {running ? <><Pause className="h-5 w-5" /> Pause</> : <><Play className="h-5 w-5" /> Reprendre</>}
              </button>
              <button onClick={doneWork} className="flex-1 h-14 rounded-2xl border border-white/15 bg-[#161616] text-[#e8c466] font-bold flex items-center justify-center gap-2" style={sora}>
                Passer <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          ) : step.type === "work" ? (
            <button onClick={doneWork} className="w-full h-16 rounded-2xl border-0 bg-[#52b788] text-[#06281c] text-xl font-extrabold flex items-center justify-center gap-2.5" style={sora}>
              <Check className="h-6 w-6" strokeWidth={2.6} /> C'est fait
            </button>
          ) : (
            <button onClick={goNext} className="w-full h-14 rounded-2xl border-0 bg-[#e8c466] text-[#1a1a1a] text-lg font-extrabold flex items-center justify-center gap-2" style={sora}>
              Continuer <ChevronRight className="h-5 w-5" strokeWidth={2.4} />
            </button>
          )}

          {step.type === "work" && step.onSkip && (
            <button onClick={skipWork} className="w-full h-12 rounded-xl text-[15px] font-bold flex items-center justify-center gap-2"
              style={{ border: "1px solid #e5646455", background: "rgba(229,100,100,0.08)", color: "#e56464", ...sora }}>
              <X className="h-[18px] w-[18px]" /> Pas fait — prévenir le coach
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
