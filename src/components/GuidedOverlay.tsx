import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, Play, Pause, ChevronRight, MessageSquarePlus, Pencil, Video } from "lucide-react";

export interface GuidedStep {
  id: string;
  type: "work" | "recup";
  stepLabel?: string;
  serieLabel?: string;
  exName?: string;
  exColor?: string;
  exNumber?: number;
  // work
  isDuration?: boolean;
  seconds?: number;
  targetReps?: string;
  targetCharge?: string;
  chargeNeedsInput?: boolean;
  isDistance?: boolean;
  perSide?: boolean;
  refCharge?: string;  // charge demandée (consigne) pour affichage
  refRpe?: string;     // RPE demandé
  refTempo?: string;   // tempo demandé
  videoUrl?: string;   // lien vidéo de démonstration si dispo
  phaseLabel?: string;
  phaseColor?: string;
  autoStart?: boolean;   // l'effort démarre seul (enchaînement) au lieu d'attendre « Je suis prêt »
  prepSeconds?: number;  // décompte de préparation avant l'effort (10s au 1er tour)
  // recup
  nextLabel?: string;
  nextPreview?: string;
  rpeTargets?: { id: string; label: string; color?: string }[];
  // callbacks
  onDone?: (data: { reps?: string; charge?: string }) => void;
  onSkip?: () => void;
  onRpe?: (rpe: number, targetId?: string) => void;
  onComment?: (text: string) => void;
}

interface DoneRecap { reps?: string; charge?: string; isDistance?: boolean; isDuration?: boolean; }
type Mode = "idle" | "prep" | "run" | "paused" | "stopped";

const RPE_COLOR = (v: number) => (v <= 3 ? "#52b788" : v <= 6 ? "#e8c466" : v <= 8 ? "#f59e0b" : "#e56464");
const fmt = (s: number) => `${Math.floor(Math.max(0, s) / 60).toString().padStart(2, "0")}:${Math.floor(Math.max(0, s) % 60).toString().padStart(2, "0")}`;
const sora = { fontFamily: "'Sora', system-ui, sans-serif" } as const;

export function GuidedOverlay({ steps, onClose, onFinish }: { steps: GuidedStep[]; onClose: () => void; onFinish?: () => void }) {
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [mode, setMode] = useState<Mode>("idle");
  const [reps, setReps] = useState("");
  const [charge, setCharge] = useState("");
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [rpeAck, setRpeAck] = useState<Record<string, number>>({});
  const [lastDone, setLastDone] = useState<DoneRecap | null>(null);
  const [err, setErr] = useState("");
  // Report de la dernière valeur saisie par exercice → préremplit les séries suivantes
  const carryRef = useRef<Record<string, { charge: string; reps: string }>>({});

  const step = steps[idx];
  const total = steps.length;
  const isWorkDur = step?.type === "work" && step?.isDuration === true;
  const isRecup = step?.type === "recup";

  const goNext = () => {
    if (idx >= total - 1) { onFinish?.(); onClose(); return; }
    setIdx((i) => i + 1);
  };

  // Initialisation à chaque étape
  useEffect(() => {
    if (!step) return;
    // Préremplit avec le report (dernière saisie de cet exercice) si présent, sinon le prévu
    const carry = carryRef.current[step.exName || "_"];
    setReps(carry?.reps ?? step.targetReps ?? "");
    setCharge(carry?.charge ?? step.targetCharge ?? "");
    setComment(""); setShowComment(false); setShowEdit(false); setErr("");
    setRpeAck({});
    if (isRecup) {
      if (step.seconds && step.seconds > 0) { setRemaining(step.seconds); setMode("run"); }
      else { setRemaining(0); setMode("stopped"); }
    } else if (isWorkDur) {
      if (step.autoStart) {
        if (step.prepSeconds && step.prepSeconds > 0) { setRemaining(step.prepSeconds); setMode("prep"); }
        else { setRemaining(step.seconds || 0); setMode("run"); }
      } else { setRemaining(step.seconds || 0); setMode("idle"); }
    } else {
      setMode("stopped");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Décompte (prep → run → stop). Ne passe jamais à l'étape suivante tout seul.
  useEffect(() => {
    if (mode !== "prep" && mode !== "run") return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (mode === "prep") { setMode("run"); return step?.seconds || 0; }
          setMode("stopped"); return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, idx]);

  if (!step) return null;

  const beginEffort = () => {
    if (step.prepSeconds && step.prepSeconds > 0) { setRemaining(step.prepSeconds); setMode("prep"); }
    else { setRemaining(step.seconds || 0); setMode("run"); }
  };

  const doneWork = () => {
    if (step.chargeNeedsInput && !charge.trim()) { setErr("Indique la charge utilisée avant de continuer"); return; }
    // N'enregistrer la valeur réalisée QUE si elle diffère du prévu (sinon le coach croit à une modif)
    const repsChanged = reps.trim() !== (step.targetReps ?? "").trim();
    const chargeChanged = charge.trim() !== (step.targetCharge ?? "").trim();
    step.onDone?.({
      reps: repsChanged ? (reps.trim() || undefined) : undefined,
      charge: chargeChanged ? (charge.trim() || undefined) : undefined,
    });
    // Report vers les séries suivantes du même exercice (garde la dernière saisie)
    const key = step.exName || "_";
    const prev = carryRef.current[key] || { charge: "", reps: "" };
    carryRef.current[key] = { charge: charge.trim() || prev.charge, reps: reps.trim() || prev.reps };
    setLastDone({ reps: reps.trim(), charge: charge.trim(), isDistance: step.isDistance, isDuration: step.isDuration });
    goNext();
  };
  const skipWork = () => { step.onSkip?.(); goNext(); };
  const pickRpe = (v: number, targetId?: string) => { setErr(""); step.onRpe?.(v, targetId); setRpeAck((p) => ({ ...p, [targetId ?? "_"]: v })); };

  const rpeRows = step.rpeTargets && step.rpeTargets.length > 0 ? step.rpeTargets : [{ id: "_", label: "", color: undefined as string | undefined }];
  const rpeComplete = !step.onRpe || rpeRows.every((r) => rpeAck[r.id] != null);
  const continueRecup = () => {
    if (!rpeComplete) { setErr("Renseigne ton RPE avant de passer à la suite"); return; }
    if (step.onComment && comment.trim()) step.onComment(comment.trim());
    goNext();
  };

  const phaseColor = step.phaseColor || "#52b788";
  const bigPhase = mode === "prep" ? "👊 Prépare-toi" : mode === "idle" ? "Prêt ?" : mode === "stopped" ? "✅ Terminé" : (step.phaseLabel || "🔥 Vas-y");
  const hasCarry = !!carryRef.current[step.exName || "_"];
  const repsCarried = hasCarry && (reps || "").trim() !== (step.targetReps ?? "").trim() && !!reps.trim();
  const chargeCarried = hasCarry && (charge || "").trim() !== (step.targetCharge ?? "").trim() && !!charge.trim();

  const ChargeInput = (
    <label className="bg-[#141414] border border-white/10 rounded-2xl p-3 block">
      <div className="text-[11px] text-muted-foreground uppercase">Charge réalisée{step.chargeNeedsInput ? " (obligatoire)" : ""}</div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <input value={charge} onChange={(e) => { setCharge(e.target.value); setErr(""); }} inputMode="decimal"
          className={`w-24 bg-transparent border-0 border-b-2 outline-none text-2xl font-extrabold ${step.chargeNeedsInput && !charge ? "border-[#f59e0b] text-[#f59e0b]" : "border-[#e8c466]"}`} style={sora}
          placeholder={step.chargeNeedsInput ? "?" : ""} />
        <span className="text-sm text-muted-foreground font-bold">kg</span>
      </div>
    </label>
  );
  const RepsInput = (
    <label className="bg-[#141414] border border-white/10 rounded-2xl p-3 block">
      <div className="text-[11px] text-muted-foreground uppercase">{step.isDuration ? "Durée réalisée (s)" : step.isDistance ? "Distance (m)" : "Reps réalisées"}</div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <input value={reps} onChange={(e) => setReps(e.target.value)} inputMode="numeric"
          className="w-20 bg-transparent border-0 border-b-2 border-[#5aa9e6] outline-none text-2xl font-extrabold" style={sora} />
      </div>
    </label>
  );

  const CommentField = !showComment ? (
    <button onClick={() => setShowComment(true)} className="w-full h-11 rounded-xl border border-white/15 bg-[#161616] text-[13px] font-semibold text-muted-foreground flex items-center justify-center gap-2" style={sora}>
      <MessageSquarePlus className="h-[18px] w-[18px]" /> Laisser un commentaire
    </button>
  ) : (
    <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} autoFocus placeholder="Ton ressenti sur cette série…"
      className="w-full rounded-xl border border-white/15 bg-[#161616] p-3 text-[14px] outline-none resize-none" style={sora} />
  );

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-[#0c0c0c] text-white flex flex-col"
      style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))", paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
      <div className="px-4 flex flex-col gap-4 flex-1 overflow-y-auto max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between pt-1">
          <span className="text-[13px] font-bold uppercase tracking-wide text-[#e8c466]">Séance guidée</span>
          <button onClick={onClose} aria-label="Quitter le mode guidé" className="p-1 text-muted-foreground"><X className="h-6 w-6" /></button>
        </div>

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
                <div className="flex flex-col items-center gap-2">
                  {step.exNumber != null && (
                    <span className="h-6 w-6 rounded-full flex items-center justify-center text-[12px] font-extrabold" style={{ background: step.exColor || "#e8c466", color: "#1a1a1a" }}>{step.exNumber}</span>
                  )}
                  <h2 className="text-2xl sm:text-3xl font-extrabold uppercase leading-tight tracking-tight" style={{ color: step.exColor || "#e8c466", ...sora }}>{step.exName}</h2>
                </div>
              )}
              {/* Consigne demandée par le coach — RPE en priorité */}
              {step.refRpe && (() => {
                const v = parseInt(step.refRpe) || 0;
                const c = RPE_COLOR(v);
                const word = v <= 3 ? "Facile" : v <= 5 ? "Modéré" : v <= 6 ? "Soutenu" : v <= 8 ? "Difficile" : "Maximal";
                return (
                  <div className="mt-3 inline-flex flex-col items-center rounded-2xl px-5 py-2" style={{ background: `${c}1f`, border: `1px solid ${c}55` }}>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">Effort à viser</span>
                    <span className="text-xl font-extrabold leading-tight" style={{ color: c, ...sora }}>RPE {v} · {word}</span>
                  </div>
                );
              })()}
              {(step.refCharge || step.refTempo) && (
                <div className="flex items-center justify-center gap-1.5 flex-wrap mt-2">
                  {step.refCharge && <span className="text-[12px] font-semibold px-2 py-0.5 rounded-md bg-white/10">Charge {step.refCharge}</span>}
                  {step.refTempo && <span className="text-[12px] font-semibold px-2 py-0.5 rounded-md bg-[#9c7bd6]/20 text-[#b79ae6] font-mono">Tempo {step.refTempo}</span>}
                </div>
              )}
              {step.videoUrl && (
                <a href={step.videoUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full text-[13px] font-bold"
                  style={{ border: "1px solid #e8c46655", background: "rgba(232,196,102,0.1)", color: "#e8c466", ...sora }}>
                  <Video className="h-4 w-4" /> Revoir la démo
                </a>
              )}
              {step.isDuration ? (
                <div className="mt-5 bg-[#141414] rounded-3xl p-7" style={{ border: `2px solid ${(mode === "prep" ? "#f59e0b" : phaseColor)}55` }}>
                  <div className="font-extrabold tabular-nums leading-none text-[72px]" style={sora}>{fmt(remaining)}</div>
                  <div className="text-2xl font-extrabold mt-3" style={{ color: mode === "prep" ? "#f59e0b" : phaseColor }}>{bigPhase}</div>
                  {(mode === "run" || mode === "paused") && (
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden mt-4">
                      <div className="h-full rounded-full" style={{ width: `${step.seconds ? ((step.seconds - remaining) / step.seconds) * 100 : 0}%`, background: phaseColor }} />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-[13px] text-muted-foreground mt-4 uppercase tracking-wide">À réaliser</div>
                  <div className="text-[64px] font-extrabold leading-none mt-1" style={sora}>
                    {reps || step.targetReps || "—"}<span className="text-2xl text-muted-foreground font-bold"> {step.isDistance ? "m" : "reps"}{step.perSide ? " /côté" : ""}</span>
                  </div>
                  {repsCarried && <div className="text-[12px] text-[#f59e0b] font-semibold mt-1">↻ Ajusté d'après ta série précédente (prévu {step.targetReps})</div>}
                </>
              )}
            </div>

            {/* Champs : visibles si charge obligatoire, report en cours, ou « Fait, mais modifié » */}
            {(step.chargeNeedsInput || showEdit || repsCarried || chargeCarried) && (
              <div className="grid grid-cols-2 gap-3">
                {(step.chargeNeedsInput || chargeCarried || showEdit || !!(step.targetCharge && step.targetCharge.trim())) && ChargeInput}
                {(showEdit || repsCarried || !step.isDuration) && RepsInput}
              </div>
            )}
            {chargeCarried && <p className="text-[12px] text-[#f59e0b] font-semibold text-center">↻ Charge ajustée d'après ta série précédente (prévu {step.targetCharge} kg)</p>}

            {err && <p className="text-[13px] text-[#e56464] font-medium text-center">{err}</p>}
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-3">
            <div className="bg-[#141414] rounded-2xl p-5 text-center" style={{ border: "2px solid #5aa9e655" }}>
              <div className="font-extrabold tabular-nums leading-none text-[56px]" style={sora}>{fmt(remaining)}</div>
              <div className="text-xl font-extrabold text-[#5aa9e6] mt-2">{mode === "stopped" ? "✅ Prêt" : "😮‍💨 Récupère"}</div>
              {step.nextLabel && <div className="text-[13px] text-muted-foreground mt-1">Ensuite : {step.nextLabel}</div>}
              {step.nextPreview && (
                <div className="text-[12px] font-semibold mt-1" style={{ color: /identique/i.test(step.nextPreview) ? "#52b788" : "#f59e0b" }}>{step.nextPreview}</div>
              )}
            </div>

            {lastDone && (lastDone.reps || lastDone.charge) && (
              <div className="rounded-2xl border border-green-500/30 bg-green-500/[0.05] p-3">
                <div className="flex items-center gap-2 text-[13px] font-bold text-green-500"><Check className="h-4 w-4" /> Série validée</div>
                <div className="text-[14px] mt-1">
                  {lastDone.reps && <span className="font-bold">{lastDone.reps}{lastDone.isDuration ? " s" : lastDone.isDistance ? " m" : " reps"}</span>}
                  {lastDone.charge && <span className="text-muted-foreground"> · {lastDone.charge}{/^\d+(\.\d+)?$/.test(lastDone.charge) ? " kg" : ""}</span>}
                </div>
              </div>
            )}

            {step.onRpe && (
              <div className="bg-[#141414] border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] font-semibold">RPE ressenti</span>
                  <span className="text-[12px] text-[#f59e0b] font-medium">obligatoire</span>
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
                          const c = RPE_COLOR(v); const picked = acked === v;
                          return (
                            <button key={v} onClick={() => pickRpe(v, row.id)} className="h-10 rounded-lg text-base font-bold active:scale-95 transition-transform"
                              style={{ border: `${picked ? 2 : 1}px solid ${picked ? c : c + "66"}`, background: `${c}${picked ? "33" : "1f"}`, color: c, ...sora }}>{v}</button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {step.onComment && CommentField}
            {err && <p className="text-[13px] text-[#e56464] font-medium text-center">{err}</p>}
            <div className="flex-1" />
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pb-1">
          {step.type === "work" ? (
            <>
              {isWorkDur && mode === "idle" ? (
                <button onClick={beginEffort} className="w-full h-16 rounded-2xl border-0 bg-[#52b788] text-[#06281c] text-xl font-extrabold flex items-center justify-center gap-2.5" style={sora}>
                  <Play className="h-6 w-6" strokeWidth={2.6} /> Je suis prêt
                </button>
              ) : (
                <>
                  <div className="flex gap-3">
                    {isWorkDur && (mode === "run" || mode === "paused") && (
                      <button onClick={() => setMode((m) => (m === "run" ? "paused" : "run"))} className="flex-1 h-16 rounded-2xl border border-white/15 bg-[#161616] font-bold flex items-center justify-center gap-2" style={sora}>
                        {mode === "run" ? <><Pause className="h-5 w-5" /> Pause</> : <><Play className="h-5 w-5" /> Reprendre</>}
                      </button>
                    )}
                    <button onClick={doneWork} className="flex-1 h-16 rounded-2xl border-0 bg-[#52b788] text-[#06281c] text-xl font-extrabold flex items-center justify-center gap-2.5" style={sora}>
                      <Check className="h-6 w-6" strokeWidth={2.6} /> C'est fait
                    </button>
                  </div>
                  {!showEdit && (
                    <button onClick={() => setShowEdit(true)} className="w-full h-12 rounded-xl border border-white/15 bg-[#161616] text-[14px] font-bold flex items-center justify-center gap-2" style={sora}>
                      <Pencil className="h-[17px] w-[17px]" /> Fait, mais modifié
                    </button>
                  )}
                </>
              )}
              {step.onSkip && (
                <button onClick={skipWork} className="w-full h-12 rounded-xl text-[15px] font-bold flex items-center justify-center gap-2"
                  style={{ border: "1px solid #e5646455", background: "rgba(229,100,100,0.08)", color: "#e56464", ...sora }}>
                  <X className="h-[18px] w-[18px]" /> Pas fait — prévenir le coach
                </button>
              )}
            </>
          ) : (
            <button onClick={continueRecup} className="w-full h-16 rounded-2xl border-0 text-lg font-extrabold flex items-center justify-center gap-2"
              style={{ background: rpeComplete ? "#e8c466" : "#3a3a2a", color: rpeComplete ? "#1a1a1a" : "#8a8a7a", ...sora }}>
              Continuer <ChevronRight className="h-5 w-5" strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
