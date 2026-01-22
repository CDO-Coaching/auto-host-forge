import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, startOfYear, endOfYear, differenceInDays, isWithinInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
}

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

export function YearTimeline({ 
  macrocycles,
  mesocycles, 
  microcycles,
  milestones, 
  mainObjectiveDate,
  onMacrocycleClick,
  onMesocycleClick,
  onMicrocycleClick,
  onMilestoneClick 
}: YearTimelineProps) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const yearStart = useMemo(() => startOfYear(new Date(selectedYear, 0, 1)), [selectedYear]);
  const yearEnd = useMemo(() => endOfYear(new Date(selectedYear, 0, 1)), [selectedYear]);
  const totalDays = useMemo(() => differenceInDays(yearEnd, yearStart) + 1, [yearStart, yearEnd]);

  // Calculate position as percentage for a given date
  const getPositionPercent = (dateString: string): number => {
    const date = parseISO(dateString);
    const dayOfYear = differenceInDays(date, yearStart);
    return Math.max(0, Math.min(100, (dayOfYear / totalDays) * 100));
  };

  // Calculate width as percentage for a date range
  const getWidthPercent = (startDate: string, endDate: string): number => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const durationDays = differenceInDays(end, start) + 1;
    return Math.max(1, (durationDays / totalDays) * 100);
  };

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

  // Calculate heights for each section
  const macroHeight = macrocycleRows.length * 32 + (macrocycleRows.length > 0 ? 8 : 0);
  const mesoHeight = mesocycleRows.length * 32 + (mesocycleRows.length > 0 ? 8 : 0);
  const microHeight = microcycleRows.length * 32 + (microcycleRows.length > 0 ? 8 : 0);
  const markersHeight = 32;
  
  const totalHeight = macroHeight + mesoHeight + microHeight + markersHeight;

  const renderCycleRow = <T extends { id: string; name: string; start_date: string; end_date: string; description?: string; color: string; clampedStart: string; clampedEnd: string }>(
    rows: T[][],
    offsetY: number,
    rowHeight: number,
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
          const left = getPositionPercent(cycle.clampedStart);
          const width = getWidthPercent(cycle.clampedStart, cycle.clampedEnd);
          
          return (
            <Tooltip key={cycle.id}>
              <TooltipTrigger asChild>
                <button
                  className="absolute h-full rounded-md flex items-center justify-center text-white text-xs font-medium overflow-hidden px-2 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                  style={{ 
                    left: `${left}%`, 
                    width: `${width}%`,
                    backgroundColor: cycle.color,
                    minWidth: "20px",
                    opacity
                  }}
                  onClick={() => onClick?.(cycle)}
                >
                  <span className="truncate">{cycle.name}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-semibold">{cycle.name}</p>
                  <p className="text-sm">
                    {format(parseISO(cycle.start_date), "d MMM yyyy", { locale: fr })}
                    {" → "}
                    {format(parseISO(cycle.end_date), "d MMM yyyy", { locale: fr })}
                  </p>
                  {cycle.description && (
                    <p className="text-sm text-muted-foreground">{cycle.description}</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    ));
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Planning Annuel
          </div>
          <div className="flex items-center gap-2">
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
            <div className="relative" style={{ minHeight: `${Math.max(100, totalHeight)}px` }}>
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

              {/* Section labels */}
              {macrocycleRows.length > 0 && (
                <div 
                  className="absolute left-0 text-[10px] text-muted-foreground font-medium uppercase tracking-wider"
                  style={{ top: "2px" }}
                >
                  Macro
                </div>
              )}
              {mesocycleRows.length > 0 && (
                <div 
                  className="absolute left-0 text-[10px] text-muted-foreground font-medium uppercase tracking-wider"
                  style={{ top: `${macroHeight + 2}px` }}
                >
                  Méso
                </div>
              )}
              {microcycleRows.length > 0 && (
                <div 
                  className="absolute left-0 text-[10px] text-muted-foreground font-medium uppercase tracking-wider"
                  style={{ top: `${macroHeight + mesoHeight + 2}px` }}
                >
                  Micro
                </div>
              )}

              {/* Macrocycles (top level) */}
              {renderCycleRow(macrocycleRows, 0, 32, onMacrocycleClick, 1)}

              {/* Separator after macrocycles */}
              {macrocycleRows.length > 0 && mesocycleRows.length > 0 && (
                <div 
                  className="absolute left-0 right-0 border-t border-dashed border-border/50"
                  style={{ top: `${macroHeight - 4}px` }}
                />
              )}

              {/* Mesocycles (middle level) */}
              {renderCycleRow(mesocycleRows, macroHeight, 32, onMesocycleClick, 0.9)}

              {/* Separator after mesocycles */}
              {mesocycleRows.length > 0 && microcycleRows.length > 0 && (
                <div 
                  className="absolute left-0 right-0 border-t border-dashed border-border/50"
                  style={{ top: `${macroHeight + mesoHeight - 4}px` }}
                />
              )}

              {/* Microcycles (bottom level) */}
              {renderCycleRow(microcycleRows, macroHeight + mesoHeight, 32, onMicrocycleClick, 0.8)}

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
      </CardContent>
    </Card>
  );
}
