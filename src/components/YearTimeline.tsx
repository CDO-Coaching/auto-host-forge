import React, { useMemo, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, startOfYear, endOfYear, differenceInDays, isWithinInterval, parseISO, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Plus, Layers, Layers2, Layers3, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Macrocycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  description?: string;
  color: string;
}

interface Mesocycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  description?: string;
  color: string;
  macrocycle_id?: string;
}

interface Microcycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  description?: string;
  color: string;
  mesocycle_id?: string;
}

interface ObjectiveMilestone {
  id: string;
  label: string;
  target_date: string;
  notes?: string;
  completed: boolean;
}

type CycleType = "macro" | "meso" | "micro";

interface YearTimelineProps {
  macrocycles: Macrocycle[];
  mesocycles: Mesocycle[];
  microcycles: Microcycle[];
  milestones: ObjectiveMilestone[];
  mainObjectiveDate?: string;
  onMacrocycleClick?: (macrocycle: Macrocycle) => void;
  onMesocycleClick?: (mesocycle: Mesocycle) => void;
  onMicrocycleClick?: (microcycle: Microcycle) => void;
  onMilestoneClick?: (milestone: ObjectiveMilestone) => void;
  onCycleDatesChange?: (cycleType: CycleType, cycleId: string, newStartDate: string, newEndDate: string) => void;
  onAddCycle?: (cycleType: CycleType) => void;
  onAddMilestone?: () => void;
}

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

interface DragState {
  cycleId: string;
  cycleType: CycleType;
  mode: "move" | "resize-left" | "resize-right";
  initialMouseX: number;
  initialStartDate: string;
  initialEndDate: string;
  containerWidth: number;
}

export function YearTimeline({ 
  macrocycles,
  mesocycles, 
  microcycles,
  milestones, 
  mainObjectiveDate,
  onMacrocycleClick,
  onMesocycleClick,
  onMicrocycleClick,
  onMilestoneClick,
  onCycleDatesChange,
  onAddCycle,
  onAddMilestone
}: YearTimelineProps) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [previewDates, setPreviewDates] = useState<{ startDate: string; endDate: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const yearStart = useMemo(() => startOfYear(new Date(selectedYear, 0, 1)), [selectedYear]);
  const yearEnd = useMemo(() => endOfYear(new Date(selectedYear, 0, 1)), [selectedYear]);
  const totalDays = useMemo(() => differenceInDays(yearEnd, yearStart) + 1, [yearStart, yearEnd]);

  // Calculate position as percentage for a given date
  const getPositionPercent = useCallback((dateString: string): number => {
    const date = parseISO(dateString);
    const dayOfYear = differenceInDays(date, yearStart);
    return Math.max(0, Math.min(100, (dayOfYear / totalDays) * 100));
  }, [yearStart, totalDays]);

  // Calculate width as percentage for a date range
  const getWidthPercent = useCallback((startDate: string, endDate: string): number => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const durationDays = differenceInDays(end, start) + 1;
    return Math.max(1, (durationDays / totalDays) * 100);
  }, [totalDays]);

  // Convert pixel offset to days
  const pixelsToDays = useCallback((pixels: number, containerWidth: number): number => {
    return Math.round((pixels / containerWidth) * totalDays);
  }, [totalDays]);

  // Handle drag start
  const handleDragStart = useCallback((
    e: React.MouseEvent,
    cycleId: string,
    cycleType: CycleType,
    startDate: string,
    endDate: string,
    mode: "move" | "resize-left" | "resize-right"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    
    setDragState({
      cycleId,
      cycleType,
      mode,
      initialMouseX: e.clientX,
      initialStartDate: startDate,
      initialEndDate: endDate,
      containerWidth: containerRect.width
    });
    
    setPreviewDates({ startDate, endDate });
  }, []);

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState) return;
    
    const deltaX = e.clientX - dragState.initialMouseX;
    const deltaDays = pixelsToDays(deltaX, dragState.containerWidth);
    
    const initialStart = parseISO(dragState.initialStartDate);
    const initialEnd = parseISO(dragState.initialEndDate);
    
    let newStart: Date;
    let newEnd: Date;
    
    if (dragState.mode === "move") {
      newStart = addDays(initialStart, deltaDays);
      newEnd = addDays(initialEnd, deltaDays);
    } else if (dragState.mode === "resize-left") {
      newStart = addDays(initialStart, deltaDays);
      newEnd = initialEnd;
      // Ensure minimum 1 day duration
      if (newStart >= newEnd) {
        newStart = addDays(newEnd, -1);
      }
    } else {
      // resize-right
      newStart = initialStart;
      newEnd = addDays(initialEnd, deltaDays);
      // Ensure minimum 1 day duration
      if (newEnd <= newStart) {
        newEnd = addDays(newStart, 1);
      }
    }
    
    setPreviewDates({
      startDate: format(newStart, "yyyy-MM-dd"),
      endDate: format(newEnd, "yyyy-MM-dd")
    });
  }, [dragState, pixelsToDays]);

  // Handle drag end
  const handleMouseUp = useCallback(() => {
    if (dragState && previewDates && onCycleDatesChange) {
      // Only save if dates actually changed
      if (previewDates.startDate !== dragState.initialStartDate || 
          previewDates.endDate !== dragState.initialEndDate) {
        onCycleDatesChange(
          dragState.cycleType,
          dragState.cycleId,
          previewDates.startDate,
          previewDates.endDate
        );
      }
    }
    setDragState(null);
    setPreviewDates(null);
  }, [dragState, previewDates, onCycleDatesChange]);

  // Add/remove global mouse event listeners
  React.useEffect(() => {
    if (dragState) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = dragState.mode === "move" ? "grabbing" : "ew-resize";
      document.body.style.userSelect = "none";
      
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  // Generic filter for cycles that overlap with selected year
  const filterCyclesForYear = <T extends { start_date: string; end_date: string }>(cycles: T[]) => {
    return cycles.filter(c => {
      const start = parseISO(c.start_date);
      const end = parseISO(c.end_date);
      return (
        isWithinInterval(yearStart, { start, end }) ||
        isWithinInterval(yearEnd, { start, end }) ||
        isWithinInterval(start, { start: yearStart, end: yearEnd }) ||
        isWithinInterval(end, { start: yearStart, end: yearEnd })
      );
    }).map(c => {
      const start = parseISO(c.start_date);
      const end = parseISO(c.end_date);
      const clampedStart = start < yearStart ? format(yearStart, "yyyy-MM-dd") : c.start_date;
      const clampedEnd = end > yearEnd ? format(yearEnd, "yyyy-MM-dd") : c.end_date;
      return { ...c, clampedStart, clampedEnd };
    });
  };

  const visibleMacrocycles = useMemo(() => filterCyclesForYear(macrocycles), [macrocycles, selectedYear, yearStart, yearEnd]);
  const visibleMesocycles = useMemo(() => filterCyclesForYear(mesocycles), [mesocycles, selectedYear, yearStart, yearEnd]);
  const visibleMicrocycles = useMemo(() => filterCyclesForYear(microcycles), [microcycles, selectedYear, yearStart, yearEnd]);

  // Filter milestones for selected year
  const visibleMilestones = useMemo(() => {
    return milestones.filter(m => {
      const date = parseISO(m.target_date);
      return isWithinInterval(date, { start: yearStart, end: yearEnd });
    });
  }, [milestones, selectedYear, yearStart, yearEnd]);

  // Check if main objective is in this year
  const showMainObjective = useMemo(() => {
    if (!mainObjectiveDate) return false;
    const date = parseISO(mainObjectiveDate);
    return isWithinInterval(date, { start: yearStart, end: yearEnd });
  }, [mainObjectiveDate, selectedYear, yearStart, yearEnd]);

  // Today marker
  const today = new Date();
  const showTodayMarker = today.getFullYear() === selectedYear;
  const todayPosition = showTodayMarker ? getPositionPercent(format(today, "yyyy-MM-dd")) : 0;

  // Arrange cycles in rows to avoid overlaps
  const arrangeCyclesInRows = <T extends { clampedStart: string; clampedEnd: string }>(cycles: T[]) => {
    const rows: Array<T[]> = [];
    
    cycles.forEach(cycle => {
      const startPos = getPositionPercent(cycle.clampedStart);
      const endPos = startPos + getWidthPercent(cycle.clampedStart, cycle.clampedEnd);
      
      let placed = false;
      for (let i = 0; i < rows.length; i++) {
        const canPlace = rows[i].every(existing => {
          const existingStart = getPositionPercent(existing.clampedStart);
          const existingEnd = existingStart + getWidthPercent(existing.clampedStart, existing.clampedEnd);
          return endPos <= existingStart || startPos >= existingEnd;
        });
        
        if (canPlace) {
          rows[i].push(cycle);
          placed = true;
          break;
        }
      }
      
      if (!placed) {
        rows.push([cycle]);
      }
    });
    
    return rows;
  };

  const macrocycleRows = useMemo(() => arrangeCyclesInRows(visibleMacrocycles), [visibleMacrocycles]);
  const mesocycleRows = useMemo(() => arrangeCyclesInRows(visibleMesocycles), [visibleMesocycles]);
  const microcycleRows = useMemo(() => arrangeCyclesInRows(visibleMicrocycles), [visibleMicrocycles]);

  // Fixed row height for each cycle level
  const ROW_HEIGHT = 36;
  const SECTION_PADDING = 8;
  const MIN_SECTION_HEIGHT = ROW_HEIGHT + SECTION_PADDING; // Minimum height even when empty
  
  // Calculate heights for each section - always have at least minimum height
  const macroHeight = Math.max(MIN_SECTION_HEIGHT, macrocycleRows.length * ROW_HEIGHT + SECTION_PADDING);
  const mesoHeight = Math.max(MIN_SECTION_HEIGHT, mesocycleRows.length * ROW_HEIGHT + SECTION_PADDING);
  const microHeight = Math.max(MIN_SECTION_HEIGHT, microcycleRows.length * ROW_HEIGHT + SECTION_PADDING);
  const markersHeight = 32;
  
  const totalHeight = macroHeight + mesoHeight + microHeight + markersHeight;

  const renderCycleRow = <T extends { id: string; name: string; start_date: string; end_date: string; description?: string; color: string; clampedStart: string; clampedEnd: string }>(
    rows: T[][],
    offsetY: number,
    rowHeight: number,
    cycleType: CycleType,
    onClick?: (cycle: T) => void,
    opacity: number = 1
  ) => {
    return rows.map((row, rowIndex) => (
      <div 
        key={rowIndex} 
        className="absolute left-0 right-0"
        style={{ top: `${offsetY + rowIndex * rowHeight}px`, height: `${rowHeight - 4}px` }}
      >
        {row.map((cycle) => {
          const isDragging = dragState?.cycleId === cycle.id;
          const displayStartDate = isDragging && previewDates ? previewDates.startDate : cycle.start_date;
          const displayEndDate = isDragging && previewDates ? previewDates.endDate : cycle.end_date;
          
          // For display, clamp to year boundaries
          const clampedDisplayStart = parseISO(displayStartDate) < yearStart 
            ? format(yearStart, "yyyy-MM-dd") 
            : displayStartDate;
          const clampedDisplayEnd = parseISO(displayEndDate) > yearEnd 
            ? format(yearEnd, "yyyy-MM-dd") 
            : displayEndDate;
          
          const left = getPositionPercent(clampedDisplayStart);
          const width = getWidthPercent(clampedDisplayStart, clampedDisplayEnd);
          
          return (
            <Tooltip key={cycle.id}>
              <TooltipTrigger asChild>
                <div
                  className={`absolute h-full rounded-md flex items-center text-white text-xs font-medium overflow-hidden shadow-sm group ${
                    isDragging ? "z-50 ring-2 ring-white/50" : "hover:ring-2 hover:ring-white/30"
                  }`}
                  style={{ 
                    left: `${left}%`, 
                    width: `${width}%`,
                    backgroundColor: cycle.color,
                    minWidth: "40px",
                    opacity: isDragging ? 1 : opacity,
                    cursor: isDragging ? (dragState?.mode === "move" ? "grabbing" : "ew-resize") : "pointer"
                  }}
                >
                  {/* Left resize handle */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 transition-colors flex items-center justify-center"
                    onMouseDown={(e) => handleDragStart(e, cycle.id, cycleType, cycle.start_date, cycle.end_date, "resize-left")}
                  >
                    <div className="w-0.5 h-3 bg-white/50 rounded-full opacity-0 group-hover:opacity-100" />
                  </div>
                  
                  {/* Main drag area */}
                  <div 
                    className="flex-1 flex items-center justify-center px-3 cursor-grab active:cursor-grabbing"
                    onMouseDown={(e) => handleDragStart(e, cycle.id, cycleType, cycle.start_date, cycle.end_date, "move")}
                    onClick={(e) => {
                      if (!dragState) {
                        e.stopPropagation();
                        onClick?.(cycle);
                      }
                    }}
                  >
                    <span className="truncate">{cycle.name}</span>
                  </div>
                  
                  {/* Right resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 transition-colors flex items-center justify-center"
                    onMouseDown={(e) => handleDragStart(e, cycle.id, cycleType, cycle.start_date, cycle.end_date, "resize-right")}
                  >
                    <div className="w-0.5 h-3 bg-white/50 rounded-full opacity-0 group-hover:opacity-100" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-semibold">{cycle.name}</p>
                  <p className="text-sm">
                    {format(parseISO(isDragging && previewDates ? previewDates.startDate : cycle.start_date), "d MMM yyyy", { locale: fr })}
                    {" → "}
                    {format(parseISO(isDragging && previewDates ? previewDates.endDate : cycle.end_date), "d MMM yyyy", { locale: fr })}
                  </p>
                  {cycle.description && (
                    <p className="text-sm text-muted-foreground">{cycle.description}</p>
                  )}
                  {!isDragging && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Glisser pour déplacer • Étirer les côtés pour redimensionner
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    ));
  };

  // Date preview overlay during drag
  const renderDragPreview = () => {
    if (!dragState || !previewDates) return null;
    
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-lg shadow-lg px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="font-medium">
            {format(parseISO(previewDates.startDate), "d MMM yyyy", { locale: fr })}
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="font-medium">
            {format(parseISO(previewDates.endDate), "d MMM yyyy", { locale: fr })}
          </span>
          <span className="text-muted-foreground ml-2">
            ({differenceInDays(parseISO(previewDates.endDate), parseISO(previewDates.startDate)) + 1} jours)
          </span>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Planning Annuel
          </div>
          <div className="flex items-center gap-3">
            {/* Add cycle/milestone dropdown */}
            {(onAddCycle || onAddMilestone) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onAddCycle && (
                    <>
                      <DropdownMenuItem onClick={() => onAddCycle("macro")} className="gap-2">
                        <Layers className="h-4 w-4 text-violet-500" />
                        Macrocycle
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAddCycle("meso")} className="gap-2">
                        <Layers2 className="h-4 w-4 text-blue-500" />
                        Mésocycle
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAddCycle("micro")} className="gap-2">
                        <Layers3 className="h-4 w-4 text-cyan-500" />
                        Microcycle
                      </DropdownMenuItem>
                    </>
                  )}
                  {onAddMilestone && (
                    <DropdownMenuItem onClick={onAddMilestone} className="gap-2">
                      <CalendarDays className="h-4 w-4 text-amber-500" />
                      Date d'objectif
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* Year navigation */}
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setSelectedYear(y => y - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-bold text-lg min-w-[4rem] text-center">{selectedYear}</span>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setSelectedYear(y => y + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="relative">
            {/* Month labels */}
            <div className="flex border-b border-border mb-2">
              {MONTHS.map((month, index) => (
                <div 
                  key={month} 
                  className="flex-1 text-center text-xs text-muted-foreground py-1 border-r border-border last:border-r-0"
                >
                  {month}
                </div>
              ))}
            </div>

            {/* Timeline container */}
            <div 
              ref={containerRef}
              className="relative" 
              style={{ minHeight: `${Math.max(100, totalHeight)}px` }}
            >
              {/* Month grid lines */}
              <div className="absolute inset-0 flex pointer-events-none">
                {MONTHS.map((_, index) => (
                  <div 
                    key={index} 
                    className="flex-1 border-r border-border/30 last:border-r-0"
                  />
                ))}
              </div>

              {/* Today marker */}
              {showTodayMarker && (
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-destructive z-20"
                  style={{ left: `${todayPosition}%` }}
                >
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground text-[10px] px-1 rounded">
                    Auj.
                  </div>
                </div>
              )}

              {/* Section labels - Always visible */}
              <div 
                className="absolute left-0 text-[10px] text-muted-foreground font-medium uppercase tracking-wider bg-card/80 px-1 rounded z-10"
                style={{ top: "4px" }}
              >
                Macro
              </div>
              <div 
                className="absolute left-0 text-[10px] text-muted-foreground font-medium uppercase tracking-wider bg-card/80 px-1 rounded z-10"
                style={{ top: `${macroHeight + 4}px` }}
              >
                Méso
              </div>
              <div 
                className="absolute left-0 text-[10px] text-muted-foreground font-medium uppercase tracking-wider bg-card/80 px-1 rounded z-10"
                style={{ top: `${macroHeight + mesoHeight + 4}px` }}
              >
                Micro
              </div>

              {/* Horizontal separator lines - Always visible */}
              <div 
                className="absolute left-0 right-0 border-t-2 border-dashed border-border/60"
                style={{ top: `${macroHeight}px` }}
              />
              <div 
                className="absolute left-0 right-0 border-t-2 border-dashed border-border/60"
                style={{ top: `${macroHeight + mesoHeight}px` }}
              />

              {/* Macrocycles (top level) */}
              {renderCycleRow(macrocycleRows, 0, ROW_HEIGHT, "macro", onMacrocycleClick, 1)}

              {/* Mesocycles (middle level) */}
              {renderCycleRow(mesocycleRows, macroHeight, ROW_HEIGHT, "meso", onMesocycleClick, 0.9)}

              {/* Microcycles (bottom level) */}
              {renderCycleRow(microcycleRows, macroHeight + mesoHeight, ROW_HEIGHT, "micro", onMicrocycleClick, 0.8)}

              {/* Milestones and main objective markers */}
              <div 
                className="absolute left-0 right-0 flex items-end"
                style={{ top: `${macroHeight + mesoHeight + microHeight + 8}px`, height: "24px" }}
              >
                {/* Milestones */}
                {visibleMilestones.map((milestone) => {
                  const position = getPositionPercent(milestone.target_date);
                  
                  return (
                    <Tooltip key={milestone.id}>
                      <TooltipTrigger asChild>
                        <button
                          className={`absolute w-3 h-3 rounded-full border-2 border-background shadow-md hover:scale-125 transition-transform cursor-pointer ${
                            milestone.completed 
                              ? "bg-green-500" 
                              : "bg-amber-500"
                          }`}
                          style={{ 
                            left: `${position}%`,
                            transform: "translateX(-50%)"
                          }}
                          onClick={() => onMilestoneClick?.(milestone)}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <div className="space-y-1">
                          <p className="font-semibold flex items-center gap-2">
                            {milestone.label}
                            {milestone.completed && (
                              <Badge variant="default" className="text-xs">Atteint</Badge>
                            )}
                          </p>
                          <p className="text-sm">
                            {format(parseISO(milestone.target_date), "d MMMM yyyy", { locale: fr })}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                {/* Main objective */}
                {showMainObjective && mainObjectiveDate && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute w-4 h-4 bg-primary rounded-full border-2 border-background shadow-lg flex items-center justify-center"
                        style={{ 
                          left: `${getPositionPercent(mainObjectiveDate)}%`,
                          transform: "translateX(-50%)"
                        }}
                      >
                        <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <div className="space-y-1">
                        <p className="font-semibold">🎯 Objectif Principal</p>
                        <p className="text-sm">
                          {format(parseISO(mainObjectiveDate), "d MMMM yyyy", { locale: fr })}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
                <span>Aujourd'hui</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded bg-violet-500" />
                <span>Macrocycle</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded bg-blue-500 opacity-90" />
                <span>Mésocycle</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded bg-cyan-500 opacity-80" />
                <span>Microcycle</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Date d'objectif</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span>Objectif atteint</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-primary flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full" />
                </div>
                <span>Objectif principal</span>
              </div>
            </div>
          </div>
        </TooltipProvider>
        
        {/* Drag preview overlay */}
        {renderDragPreview()}
      </CardContent>
    </Card>
  );
}
