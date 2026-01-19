import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, startOfYear, endOfYear, differenceInDays, isWithinInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Mesocycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  description?: string;
  color: string;
}

interface ObjectiveMilestone {
  id: string;
  label: string;
  target_date: string;
  notes?: string;
  completed: boolean;
}

interface YearTimelineProps {
  mesocycles: Mesocycle[];
  milestones: ObjectiveMilestone[];
  mainObjectiveDate?: string;
  onMesocycleClick?: (mesocycle: Mesocycle) => void;
  onMilestoneClick?: (milestone: ObjectiveMilestone) => void;
}

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

export function YearTimeline({ 
  mesocycles, 
  milestones, 
  mainObjectiveDate,
  onMesocycleClick,
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

  // Filter mesocycles that overlap with selected year
  const visibleMesocycles = useMemo(() => {
    return mesocycles.filter(m => {
      const start = parseISO(m.start_date);
      const end = parseISO(m.end_date);
      return (
        isWithinInterval(yearStart, { start, end }) ||
        isWithinInterval(yearEnd, { start, end }) ||
        isWithinInterval(start, { start: yearStart, end: yearEnd }) ||
        isWithinInterval(end, { start: yearStart, end: yearEnd })
      );
    }).map(m => {
      // Clamp dates to year boundaries
      const start = parseISO(m.start_date);
      const end = parseISO(m.end_date);
      const clampedStart = start < yearStart ? format(yearStart, "yyyy-MM-dd") : m.start_date;
      const clampedEnd = end > yearEnd ? format(yearEnd, "yyyy-MM-dd") : m.end_date;
      return { ...m, clampedStart, clampedEnd };
    });
  }, [mesocycles, selectedYear, yearStart, yearEnd]);

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

  // Arrange mesocycles in rows to avoid overlaps
  const mesocycleRows = useMemo(() => {
    const rows: Array<typeof visibleMesocycles> = [];
    
    visibleMesocycles.forEach(mesocycle => {
      const startPos = getPositionPercent(mesocycle.clampedStart);
      const endPos = startPos + getWidthPercent(mesocycle.clampedStart, mesocycle.clampedEnd);
      
      // Find a row where this mesocycle doesn't overlap
      let placed = false;
      for (let i = 0; i < rows.length; i++) {
        const canPlace = rows[i].every(existing => {
          const existingStart = getPositionPercent(existing.clampedStart);
          const existingEnd = existingStart + getWidthPercent(existing.clampedStart, existing.clampedEnd);
          return endPos <= existingStart || startPos >= existingEnd;
        });
        
        if (canPlace) {
          rows[i].push(mesocycle);
          placed = true;
          break;
        }
      }
      
      if (!placed) {
        rows.push([mesocycle]);
      }
    });
    
    return rows;
  }, [visibleMesocycles]);

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
            <div className="relative" style={{ minHeight: `${Math.max(60, mesocycleRows.length * 36 + 40)}px` }}>
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

              {/* Mesocycles */}
              {mesocycleRows.map((row, rowIndex) => (
                <div 
                  key={rowIndex} 
                  className="absolute left-0 right-0"
                  style={{ top: `${rowIndex * 36 + 4}px`, height: "28px" }}
                >
                  {row.map((mesocycle) => {
                    const left = getPositionPercent(mesocycle.clampedStart);
                    const width = getWidthPercent(mesocycle.clampedStart, mesocycle.clampedEnd);
                    
                    return (
                      <Tooltip key={mesocycle.id}>
                        <TooltipTrigger asChild>
                          <button
                            className="absolute h-full rounded-md flex items-center justify-center text-white text-xs font-medium overflow-hidden px-2 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                            style={{ 
                              left: `${left}%`, 
                              width: `${width}%`,
                              backgroundColor: mesocycle.color,
                              minWidth: "20px"
                            }}
                            onClick={() => onMesocycleClick?.(mesocycle)}
                          >
                            <span className="truncate">{mesocycle.name}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-semibold">{mesocycle.name}</p>
                            <p className="text-sm">
                              {format(parseISO(mesocycle.start_date), "d MMM yyyy", { locale: fr })}
                              {" → "}
                              {format(parseISO(mesocycle.end_date), "d MMM yyyy", { locale: fr })}
                            </p>
                            {mesocycle.description && (
                              <p className="text-sm text-muted-foreground">{mesocycle.description}</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}

              {/* Milestones and main objective markers */}
              <div 
                className="absolute left-0 right-0 flex items-end"
                style={{ top: `${mesocycleRows.length * 36 + 8}px`, height: "24px" }}
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
