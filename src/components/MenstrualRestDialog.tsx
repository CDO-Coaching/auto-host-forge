import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Heart, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MenstrualRestPeriod {
  id: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_at: string;
}

export function MenstrualRestDialog() {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [periods, setPeriods] = useState<MenstrualRestPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadPeriods();
  }, []);

  const loadPeriods = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("menstrual_rest_periods")
        .select("*")
        .eq("athlete_id", user.id)
        .order("start_date", { ascending: false });

      if (error) throw error;
      setPeriods(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement des périodes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Dates requises",
        description: "Veuillez sélectionner une date de début et de fin.",
        variant: "destructive",
      });
      return;
    }

    if (endDate < startDate) {
      toast({
        title: "Dates invalides",
        description: "La date de fin doit être après la date de début.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      const { error } = await supabase
        .from("menstrual_rest_periods")
        .insert({
          athlete_id: user.id,
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
          notes: notes.trim() || null,
        });

      if (error) throw error;

      toast({
        title: "Période enregistrée",
        description: "Ton coach sera informé de cette période de repos.",
      });

      // Réinitialiser le formulaire
      setStartDate(undefined);
      setEndDate(undefined);
      setNotes("");
      setOpen(false);
      
      // Recharger les périodes
      await loadPeriods();
    } catch (error) {
      console.error("Erreur:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (periodId: string) => {
    try {
      const { error } = await supabase
        .from("menstrual_rest_periods")
        .delete()
        .eq("id", periodId);

      if (error) throw error;

      toast({
        title: "Période supprimée",
      });

      await loadPeriods();
    } catch (error) {
      console.error("Erreur:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la période.",
        variant: "destructive",
      });
    }
  };

  const isCurrentOrFuture = (endDate: string) => {
    return new Date(endDate) >= new Date(new Date().toISOString().split('T')[0]);
  };

  const activePeriods = periods.filter(p => isCurrentOrFuture(p.end_date));
  const pastPeriods = periods.filter(p => !isCurrentOrFuture(p.end_date));

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Heart className="h-5 w-5 text-pink-500" />
          Période de repos menstruel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs sm:text-sm text-muted-foreground">
          Signale à ton coach les périodes où tu souhaites réduire l'intensité de tes séances.
        </p>

        {activePeriods.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Périodes actives ou à venir :</p>
            {activePeriods.map((period) => (
              <div
                key={period.id}
                className="flex items-center justify-between p-2 bg-pink-50 dark:bg-pink-950/30 rounded-lg border border-pink-200 dark:border-pink-800"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {format(new Date(period.start_date), "dd/MM", { locale: fr })} → {format(new Date(period.end_date), "dd/MM", { locale: fr })}
                  </p>
                  {period.notes && (
                    <p className="text-xs text-muted-foreground truncate">{period.notes}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(period.id)}
                  className="shrink-0 h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Signaler une période
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Signaler une période de repos</DialogTitle>
              <DialogDescription>
                Ton coach sera informé et pourra adapter l'intensité de tes séances.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Date de début</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP", { locale: fr }) : "Sélectionner une date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Date de fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP", { locale: fr }) : "Sélectionner une date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={(date) => startDate ? date < startDate : false}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Notes (optionnel)</Label>
                <Textarea
                  placeholder="Informations supplémentaires pour ton coach..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {pastPeriods.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Historique ({pastPeriods.length})
            </summary>
            <div className="mt-2 space-y-1">
              {pastPeriods.slice(0, 5).map((period) => (
                <div key={period.id} className="flex justify-between items-center text-muted-foreground p-1">
                  <span>
                    {format(new Date(period.start_date), "dd/MM", { locale: fr })} → {format(new Date(period.end_date), "dd/MM", { locale: fr })}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
