import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Link2, Unlink, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { WALKING_SPEED_KMH, WALKING_PACE } from "@/lib/cardioCalculations";

export type CardioSportType = "course" | "velo" | "natation";

export interface CardioStep {
  id: number;
  movement_type: "course" | "marche" | "velo" | "natation" | "repos";
  effort_type: "duration" | "distance";
  duration?: number; // en secondes
  distance?: number; // en nombre (selon l'unité)
  distance_unit?: "m" | "km";
  vma_percentage?: number; // pourcentage de VMA (ex: 65) - pour course
  ftp_percentage?: number; // pourcentage de FTP (ex: 75) - pour vélo
  rpe?: number; // RPE 1-10 - pour natation
  target_heart_rate?: string; // ex: "150" ou "Zone 3"
  block_id?: number; // ID du bloc auquel appartient cette étape
}

export interface CardioBlock {
  id: number;
  repetitions: number;
  steps: CardioStep[];
}

export interface CardioData {
  steps: CardioStep[];
  blocks: CardioBlock[];
}

interface CardioStepBuilderProps {
  steps: CardioStep[];
  blocks?: CardioBlock[];
  onChange: (data: CardioData) => void;
  athleteVma?: number | null;
  athleteFcMax?: number | null;
  athleteFcRepos?: number | null;
  athleteFtp?: number | null;
  disabled?: boolean;
  sportType?: CardioSportType;
}

// Zones de puissance (Coggan), en % de FTP
const POWER_ZONES = [
  { zone: 1, label: "Z1 – Récupération",     pMin: 0,   pMax: 55,  mid: 50  },
  { zone: 2, label: "Z2 – Endurance",        pMin: 56,  pMax: 75,  mid: 65  },
  { zone: 3, label: "Z3 – Tempo",            pMin: 76,  pMax: 90,  mid: 83  },
  { zone: 4, label: "Z4 – Seuil",            pMin: 91,  pMax: 105, mid: 98  },
  { zone: 5, label: "Z5 – VO2max",           pMin: 106, pMax: 120, mid: 113 },
  { zone: 6, label: "Z6 – Anaérobie",        pMin: 121, pMax: 150, mid: 135 },
  { zone: 7, label: "Z7 – Neuromusculaire",  pMin: 151, pMax: 200, mid: 170 },
];

function powerZoneForPct(pct: number) {
  return POWER_ZONES.find((z) => pct >= z.pMin && pct <= z.pMax) || null;
}

const FCR_ZONES = [
  { zone: 1, label: "Z1 – Récupération",           pMin: 50, pMax: 60,  color: "text-blue-400"   },
  { zone: 2, label: "Z2 – Endurance fondamentale",  pMin: 60, pMax: 70,  color: "text-green-400"  },
  { zone: 3, label: "Z3 – Résistance douce",        pMin: 70, pMax: 80,  color: "text-yellow-400" },
  { zone: 4, label: "Z4 – Résistance dure",         pMin: 80, pMax: 90,  color: "text-orange-400" },
  { zone: 5, label: "Z5 – Puissance",               pMin: 90, pMax: 100, color: "text-red-400"    },
];

function getFcrBpm(zone: number, fcMax: number, fcRepos: number) {
  const z = FCR_ZONES.find(z => z.zone === zone);
  if (!z) return null;
  const fcr = fcMax - fcRepos;
  return {
    low:  Math.round(fcRepos + fcr * z.pMin / 100),
    high: Math.round(fcRepos + fcr * z.pMax / 100),
  };
}

// Composant interne pour l'input de durée avec état local
function DurationInput({ 
  value, 
  onChange, 
  disabled, 
  placeholder = "ex: 10:00" 
}: { 
  value: number | undefined; 
  onChange: (value: number | undefined) => void; 
  disabled?: boolean;
  placeholder?: string;
}) {
  const formatDurationValue = (seconds: number | undefined) => {
    if (seconds === undefined || seconds === 0) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const [localValue, setLocalValue] = useState(formatDurationValue(value));

  useEffect(() => {
    setLocalValue(formatDurationValue(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setLocalValue(inputValue);
  };

  const handleBlur = () => {
    if (!localValue || localValue.trim() === "") {
      onChange(undefined);
      return;
    }
    const parts = localValue.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0]) || 0;
      const secs = parseInt(parts[1]) || 0;
      onChange(mins * 60 + secs);
    } else {
      const parsed = parseInt(localValue);
      if (!isNaN(parsed)) {
        onChange(parsed * 60);
      }
    }
  };

  return (
    <Input
      type="text"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}

export function CardioStepBuilder({
  steps,
  blocks: initialBlocks = [],
  onChange,
  athleteVma,
  athleteFcMax,
  athleteFcRepos,
  athleteFtp,
  disabled = false,
  sportType = "course"
}: CardioStepBuilderProps) {
  const [blocks, setBlocks] = useState<CardioBlock[]>(initialBlocks);
  const [selectedSteps, setSelectedSteps] = useState<number[]>([]);

  // Sync internal blocks state when the prop changes (e.g. after week copy or DB load)
  useEffect(() => {
    setBlocks(initialBlocks);
  }, [JSON.stringify(initialBlocks)]);
  const [draggedStepId, setDraggedStepId] = useState<number | null>(null);

  // Calcule l'allure en min/km à partir du pourcentage de VMA
  const calculatePace = (vmaPercentage: number | undefined): string => {
    if (!vmaPercentage || !athleteVma) return "-";
    
    const speed = athleteVma * (vmaPercentage / 100); // vitesse en km/h
    const paceInMinutes = 60 / speed; // allure en min/km
    const minutes = Math.floor(paceInMinutes);
    const seconds = Math.round((paceInMinutes - minutes) * 60);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  const getDefaultMovementType = (): CardioStep["movement_type"] => {
    if (sportType === "velo") return "velo";
    if (sportType === "natation") return "natation";
    return "course";
  };

  const handleAddStep = () => {
    const defaultMovement = getDefaultMovementType();
    const newStep: CardioStep = {
      id: steps.length > 0 ? Math.max(...steps.map(s => s.id)) + 1 : 1,
      movement_type: defaultMovement,
      effort_type: "duration",
      duration: 600, // 10 minutes par défaut
      ...(sportType === "course" ? { vma_percentage: 65 } : sportType === "velo" ? { ftp_percentage: 65 } : { rpe: 5 }),
      target_heart_rate: "",
    };
    onChange({ steps: [...steps, newStep], blocks });
  };

  const handleDeleteStep = (stepId: number) => {
    onChange({ steps: steps.filter(s => s.id !== stepId), blocks });
  };

  const handleStepChange = (stepId: number, field: keyof CardioStep, value: any) => {
    const updatedSteps = steps.map(step => {
      if (step.id === stepId) {
        const updatedStep = { ...step, [field]: value };
        
        // Si on change le type d'effort, réinitialiser les champs appropriés
        if (field === "effort_type") {
          if (value === "duration") {
            updatedStep.duration = 600;
            delete updatedStep.distance;
            delete updatedStep.distance_unit;
          } else {
            updatedStep.distance = sportType === "natation" ? 100 : 1000;
            updatedStep.distance_unit = "m";
            delete updatedStep.duration;
          }
        }

        // Si on passe en marche/repos (récup), on retire toute intensité
        if (field === "movement_type" && (value === "marche" || value === "repos")) {
          delete updatedStep.vma_percentage;
          delete updatedStep.ftp_percentage;
          delete updatedStep.rpe;
        }
        
        return updatedStep;
      }
      return step;
    });
    onChange({ steps: updatedSteps, blocks });
  };

  const formatDuration = (seconds: number | undefined) => {
    if (seconds === undefined || seconds === 0) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const parseDuration = (value: string): number | undefined => {
    if (!value || value.trim() === "") return undefined;
    const parts = value.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0]) || 0;
      const secs = parseInt(parts[1]) || 0;
      return mins * 60 + secs;
    }
    // Si c'est juste un nombre, le traiter comme des minutes
    const parsed = parseInt(value);
    return isNaN(parsed) ? undefined : parsed * 60;
  };

  const toggleStepSelection = (stepId: number) => {
    setSelectedSteps(prev => 
      prev.includes(stepId) 
        ? prev.filter(id => id !== stepId)
        : [...prev, stepId]
    );
  };

  const createBlockFromSelected = () => {
    if (selectedSteps.length < 2) return;

    const newBlockId = blocks.length > 0 ? Math.max(...blocks.map(b => b.id)) + 1 : 1;
    const selectedStepsData = steps.filter(s => selectedSteps.includes(s.id));
    
    // Mettre à jour les étapes pour les lier au bloc
    const updatedSteps = steps.map(step => 
      selectedSteps.includes(step.id) 
        ? { ...step, block_id: newBlockId }
        : step
    );

    const newBlock: CardioBlock = {
      id: newBlockId,
      repetitions: 1,
      steps: selectedStepsData,
    };

    const newBlocks = [...blocks, newBlock];
    setBlocks(newBlocks);
    onChange({ steps: updatedSteps, blocks: newBlocks });
    setSelectedSteps([]);
  };

  const removeBlock = (blockId: number) => {
    // Retirer le block_id des étapes
    const updatedSteps = steps.map(step =>
      step.block_id === blockId 
        ? { ...step, block_id: undefined }
        : step
    );
    
    const newBlocks = blocks.filter(b => b.id !== blockId);
    setBlocks(newBlocks);
    onChange({ steps: updatedSteps, blocks: newBlocks });
  };

  const [blockRepInputs, setBlockRepInputs] = useState<Record<number, string>>({});

  const updateBlockRepetitions = (blockId: number, repetitions: number) => {
    const newBlocks = blocks.map(b => 
      b.id === blockId ? { ...b, repetitions } : b
    );
    setBlocks(newBlocks);
    onChange({ steps, blocks: newBlocks });
  };

  const getStepBlock = (stepId: number): CardioBlock | undefined => {
    const step = steps.find(s => s.id === stepId);
    if (!step?.block_id) return undefined;
    return blocks.find(b => b.id === step.block_id);
  };

  // Drag & Drop handlers pour les étapes
  const handleStepDragStart = (stepId: number) => {
    setDraggedStepId(stepId);
  };

  const handleStepDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleStepDrop = (e: React.DragEvent, targetStepId: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedStepId === null || draggedStepId === targetStepId) {
      setDraggedStepId(null);
      return;
    }

    const draggedIndex = steps.findIndex((s) => s.id === draggedStepId);
    const targetIndex = steps.findIndex((s) => s.id === targetStepId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedStepId(null);
      return;
    }

    const newSteps = [...steps];
    const [draggedStep] = newSteps.splice(draggedIndex, 1);
    newSteps.splice(targetIndex, 0, draggedStep);

    onChange({ steps: newSteps, blocks });
    setDraggedStepId(null);
    toast.success("Étape réorganisée");
  };

  const getSportLabel = () => {
    if (sportType === "velo") return "Vélo";
    if (sportType === "natation") return "Natation";
    return "Course";
  };

  const getMovementOptions = () => {
    if (sportType === "course") {
      return [
        { value: "course", label: "Course à pied" },
        { value: "marche", label: "Marche" },
      ];
    }
    if (sportType === "velo") {
      return [
        { value: "velo", label: "Vélo" },
        { value: "repos", label: "Repos / Récup" },
      ];
    }
    if (sportType === "natation") {
      return [
        { value: "natation", label: "Natation" },
        { value: "repos", label: "Repos / Récup" },
      ];
    }
    return [];
  };

  const getDistanceUnit = () => {
    if (sportType === "natation") return "m"; // La natation utilise principalement les mètres
    return "km";
  };

  // Helper: render the fields of a single step in a compact horizontal layout
  const renderStepFields = (step: CardioStep, index: number, inBlock: boolean) => {
    const isRunning = sportType === "course";
    const borderClass = inBlock
      ? "border-l-2 border-amber-500/60"
      : "border-l-2 border-border";

    return (
      <div
        key={step.id}
        className={`flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end px-3 sm:px-4 py-3 ${inBlock ? "bg-amber-500/5" : ""} ${borderClass} relative`}
        draggable={!disabled}
        onDragStart={() => handleStepDragStart(step.id)}
        onDragOver={handleStepDragOver}
        onDrop={(e) => handleStepDrop(e, step.id)}
      >
        {/* Grip + checkbox + step badge */}
        <div className="flex items-center gap-1.5 shrink-0 self-center">
          {!disabled && (
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
          )}
          {!disabled && !step.block_id && (
            <input
              type="checkbox"
              checked={selectedSteps.includes(step.id)}
              onChange={() => toggleStepSelection(step.id)}
              className="h-3.5 w-3.5 rounded border-border"
            />
          )}
          <span className={`inline-flex items-center justify-center rounded-full h-6 w-6 text-xs font-semibold shrink-0 ${inBlock ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground"}`}>
            {index + 1}
          </span>
        </div>

        {/* Mouvement (affiché dès qu'il y a un choix, ex. course/marche, vélo/repos…) */}
        {getMovementOptions().length > 1 && (
          <div className="flex flex-col gap-1 min-w-[110px]">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Mouvement</label>
            <Select
              value={step.movement_type}
              onValueChange={(value) => handleStepChange(step.id, "movement_type", value)}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getMovementOptions().map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Type d'effort */}
        <div className="flex flex-col gap-1 min-w-[90px]">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Effort</label>
          <Select
            value={step.effort_type}
            onValueChange={(value) => handleStepChange(step.id, "effort_type", value)}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="duration">Durée</SelectItem>
              <SelectItem value="distance">Distance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Durée ou Distance + Unité */}
        {step.effort_type === "duration" ? (
          <div className="flex flex-col gap-1 min-w-[90px]">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Durée (mm:ss)</label>
            <DurationInput
              value={step.duration}
              onChange={(value) => handleStepChange(step.id, "duration", value)}
              placeholder="10:00"
              disabled={disabled}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1 min-w-[80px]">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Distance</label>
              <Input
                type="number"
                value={step.distance || ""}
                onChange={(e) => handleStepChange(step.id, "distance", parseFloat(e.target.value) || 0)}
                placeholder={sportType === "natation" ? "100" : "1000"}
                disabled={disabled}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[80px]">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Unité</label>
              <Select
                value={step.distance_unit || "m"}
                onValueChange={(value) => handleStepChange(step.id, "distance_unit", value)}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="m">Mètres</SelectItem>
                  {sportType !== "natation" && <SelectItem value="km">Kilomètres</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Intensité : récup / %VMA / %FTP / RPE */}
        {(step.movement_type === "marche" || step.movement_type === "repos") ? (
          <div className="flex flex-col gap-1 min-w-[110px]">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Récup</label>
            <div className="h-8 flex items-center px-2 bg-muted rounded-md text-xs font-medium text-foreground whitespace-nowrap">
              {isRunning && step.movement_type === "marche"
                ? <>{WALKING_PACE} <span className="text-muted-foreground ml-1">(~{WALKING_SPEED_KMH})</span></>
                : "Récupération"}
            </div>
          </div>
        ) : isRunning ? (
            <div className="flex flex-col gap-1 min-w-[90px]">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                % VMA{athleteVma ? <span className="ml-1 normal-case">({athleteVma} km/h)</span> : null}
              </label>
              <Input
                type="number"
                min="30"
                max="120"
                value={step.vma_percentage || ""}
                onChange={(e) => handleStepChange(step.id, "vma_percentage", parseFloat(e.target.value) || 0)}
                placeholder="65"
                disabled={disabled}
                className="h-8 text-xs"
              />
              <span className="text-[10px] text-muted-foreground leading-tight">
                {athleteVma
                  ? <span className="font-medium text-foreground">{calculatePace(step.vma_percentage)}</span>
                  : <span className="text-amber-600">VMA non renseignée</span>
                }
              </span>
            </div>
        ) : sportType === "velo" ? (
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              % FTP{athleteFtp ? <span className="ml-1 normal-case">({athleteFtp} W)</span> : null}
            </label>
            <div className="flex gap-1">
              <Input
                type="number"
                min="30"
                max="200"
                value={step.ftp_percentage || ""}
                onChange={(e) => handleStepChange(step.id, "ftp_percentage", parseFloat(e.target.value) || 0)}
                placeholder="75"
                disabled={disabled}
                className="h-8 text-xs w-16"
              />
              <Select
                value={powerZoneForPct(step.ftp_percentage || 0) ? `Z${powerZoneForPct(step.ftp_percentage || 0)!.zone}` : "none"}
                onValueChange={(v) => {
                  if (v === "none") return;
                  const z = POWER_ZONES.find((zz) => `Z${zz.zone}` === v);
                  if (z) handleStepChange(step.id, "ftp_percentage", z.mid);
                }}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Zone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">Zone…</SelectItem>
                  {POWER_ZONES.map((z) => (
                    <SelectItem key={z.zone} value={`Z${z.zone}`} className="text-xs">{z.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-[10px] leading-tight">
              {athleteFtp && step.ftp_percentage ? (
                <span className="font-medium text-foreground">
                  {Math.round(athleteFtp * step.ftp_percentage / 100)} W
                  {powerZoneForPct(step.ftp_percentage) ? ` · Z${powerZoneForPct(step.ftp_percentage)!.zone}` : ""}
                </span>
              ) : (
                <span className="text-amber-600">FTP non renseignée</span>
              )}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1 min-w-[80px]">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">RPE (1-10)</label>
            <Input
              type="number"
              min="1"
              max="10"
              value={step.rpe || ""}
              onChange={(e) => handleStepChange(step.id, "rpe", parseInt(e.target.value) || 0)}
              placeholder="5"
              disabled={disabled}
              className="h-8 text-xs"
            />
            <span className="text-[10px] text-muted-foreground leading-tight">
              {step.rpe
                ? step.rpe <= 3 ? "Facile"
                  : step.rpe <= 5 ? "Modéré"
                  : step.rpe <= 7 ? "Difficile"
                  : "Très difficile"
                : "—"}
            </span>
          </div>
        )}

        {/* FC cible — sélecteur de zone FCR */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Zone FC cible <span className="normal-case">(opt.)</span></label>
          <Select
            value={step.target_heart_rate || "none"}
            onValueChange={(v) => handleStepChange(step.id, "target_heart_rate", v === "none" ? "" : v)}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Aucune" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">Aucune</SelectItem>
              {FCR_ZONES.map((z) => {
                const bpm = athleteFcMax && athleteFcRepos
                  ? getFcrBpm(z.zone, athleteFcMax, athleteFcRepos)
                  : null;
                const label = bpm
                  ? `Z${z.zone} – ${bpm.low}–${bpm.high} bpm`
                  : `Z${z.zone} – ${z.pMin}-${z.pMax}% FCR`;
                return (
                  <SelectItem key={z.zone} value={`Z${z.zone}`} className="text-xs">
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {/* BPM sous le select si zone choisie */}
          {step.target_heart_rate && step.target_heart_rate !== "" && athleteFcMax && athleteFcRepos && (() => {
            const zNum = parseInt(step.target_heart_rate.replace("Z", ""));
            const bpm = getFcrBpm(zNum, athleteFcMax, athleteFcRepos);
            const zDef = FCR_ZONES.find(z => z.zone === zNum);
            if (!bpm || !zDef) return null;
            return <p className={`text-[10px] font-medium ${zDef.color}`}>{bpm.low}–{bpm.high} bpm</p>;
          })()}
        </div>

        {/* Delete button */}
        {!disabled && (
          <div className="absolute top-2 right-2 sm:static sm:flex sm:items-end sm:ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteStep(step.id)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Group steps: collect runs of consecutive steps belonging to the same block
  // Returns an array of items: { type: "free", step, index } | { type: "block", block, steps: [{step, index}] }
  const buildRenderItems = () => {
    const items: Array<
      | { type: "free"; step: CardioStep; index: number }
      | { type: "block"; block: CardioBlock; entries: { step: CardioStep; index: number }[] }
    > = [];

    const seenBlocks = new Set<number>();

    steps.forEach((step, index) => {
      const block = step.block_id ? blocks.find(b => b.id === step.block_id) : undefined;
      if (block) {
        if (!seenBlocks.has(block.id)) {
          seenBlocks.add(block.id);
          // Collect all steps that belong to this block, in order
          const blockEntries = steps
            .map((s, i) => ({ step: s, index: i }))
            .filter(({ step: s }) => s.block_id === block.id);
          items.push({ type: "block", block, entries: blockEntries });
        }
        // steps inside block are rendered by the block item — skip re-adding
      } else {
        items.push({ type: "free", step, index });
      }
    });

    return items;
  };

  const renderItems = buildRenderItems();

  return (
    <div className="space-y-3">
      {/* Banner: create block from selection */}
      {selectedSteps.length >= 2 && !disabled && (
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-3 bg-primary/10 rounded-lg border border-primary/20">
          <Badge variant="secondary" className="text-xs">{selectedSteps.length} étapes sélectionnées</Badge>
          <Button size="sm" onClick={createBlockFromSelected} className="text-xs sm:text-sm w-full sm:w-auto">
            <Link2 className="h-4 w-4 mr-2" />
            Créer bloc
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedSteps([])} className="text-xs sm:text-sm w-full sm:w-auto">
            Annuler
          </Button>
        </div>
      )}

      {steps.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          Aucune étape ajoutée. Clique sur "Ajouter une étape" pour commencer.
        </div>
      ) : (
        <div className="space-y-2">
          {renderItems.map((item) => {
            if (item.type === "free") {
              return (
                <div
                  key={item.step.id}
                  className="rounded-lg border border-border overflow-hidden bg-card"
                >
                  {renderStepFields(item.step, item.index, false)}
                </div>
              );
            }

            // Block item
            const { block, entries } = item;
            return (
              <div
                key={`block-${block.id}`}
                className="rounded-lg overflow-hidden border border-amber-500/40 dark:border-amber-500/30"
              >
                {/* Block header */}
                <div className="bg-amber-500/20 text-amber-300 px-4 py-2 flex flex-wrap items-center gap-3 border-b border-amber-500/30">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Bloc</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs opacity-80">×</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={blockRepInputs[block.id] !== undefined ? blockRepInputs[block.id] : String(block.repetitions)}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setBlockRepInputs(prev => ({ ...prev, [block.id]: val }));
                      }}
                      onBlur={() => {
                        const val = parseInt(blockRepInputs[block.id] || '');
                        const reps = isNaN(val) || val < 1 ? 1 : Math.min(val, 20);
                        updateBlockRepetitions(block.id, reps);
                        setBlockRepInputs(prev => { const n = { ...prev }; delete n[block.id]; return n; });
                      }}
                      className="w-12 h-7 text-sm bg-amber-500/10 border-amber-500/30 text-amber-200 placeholder:text-amber-300/60 focus-visible:ring-amber-500/50"
                      disabled={disabled}
                    />
                    <span className="text-xs opacity-80">répétitions</span>
                  </div>
                  {!disabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBlock(block.id)}
                      className="ml-auto h-7 px-2 text-amber-300 hover:text-amber-200 hover:bg-amber-500/20 text-xs"
                    >
                      <Unlink className="h-3.5 w-3.5 mr-1" />
                      Délier
                    </Button>
                  )}
                </div>

                {/* Steps inside block */}
                <div className="divide-y divide-amber-500/10 bg-card">
                  {entries.map(({ step, index }) =>
                    renderStepFields(step, index, true)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!disabled && (
        <Button onClick={handleAddStep} variant="outline" className="w-full text-xs sm:text-sm">
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          Ajouter une étape
        </Button>
      )}
    </div>
  );
}
