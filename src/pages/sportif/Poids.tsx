import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Scale, Trash2, Bell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useWeeklyWeightReminder, type WeightReminderConfig } from "@/hooks/useWeeklyWeightReminder";

interface WeightEntry {
  id: string;
  weight_kg: number;
  recorded_at: string;
  notes: string | null;
}

const DAYS_OF_WEEK = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
];

export default function Poids() {
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reminderConfig, setReminderConfig] = useState<WeightReminderConfig>({
    enabled: false,
    dayOfWeek: 1,
    frequency: 1,
  });
  const { saveConfig, loadConfig } = useWeeklyWeightReminder();

  useEffect(() => {
    loadWeightEntries();
    loadReminderPreference();
  }, []);

  const loadReminderPreference = async () => {
    const config = await loadConfig();
    setReminderConfig(config);
  };

  const handleReminderToggle = async (checked: boolean) => {
    const newConfig = { ...reminderConfig, enabled: checked };
    await saveConfig(newConfig);
    setReminderConfig(newConfig);
    if (checked) {
      toast.success("Rappels activés");
    } else {
      toast.info("Rappels désactivés");
    }
  };

  const handleDayChange = async (value: string) => {
    const newConfig = { ...reminderConfig, dayOfWeek: parseInt(value) };
    await saveConfig(newConfig);
    setReminderConfig(newConfig);
  };

  const handleFrequencyChange = async (value: string) => {
    const newConfig = { ...reminderConfig, frequency: parseInt(value) as 1 | 2 };
    await saveConfig(newConfig);
    setReminderConfig(newConfig);
  };

  const loadWeightEntries = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("weight_tracking")
        .select("*")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false });

      if (error) throw error;

      setWeightEntries(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement des poids:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const weightValue = parseFloat(weight);
    if (isNaN(weightValue) || weightValue <= 0 || weightValue >= 500) {
      toast.error("Veuillez entrer un poids valide (entre 0 et 500 kg)");
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non connecté");

      const { error } = await supabase.from("weight_tracking").insert({
        user_id: user.id,
        weight_kg: weightValue,
        recorded_at: new Date().toISOString(),
        notes: notes.trim() || null,
      });

      if (error) throw error;

      toast.success("Poids enregistré avec succès");
      setWeight("");
      setNotes("");
      setDialogOpen(false);
      loadWeightEntries();
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      toast.error("Erreur lors de l'enregistrement du poids");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette entrée ?")) return;

    try {
      const { error } = await supabase.from("weight_tracking").delete().eq("id", id);

      if (error) throw error;

      toast.success("Entrée supprimée");
      loadWeightEntries();
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  // Préparer les données pour le graphique (ordre chronologique)
  const chartData = [...weightEntries].reverse().map((entry) => ({
    date: format(new Date(entry.recorded_at), "dd/MM", { locale: fr }),
    poids: entry.weight_kg,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  const latestWeight = weightEntries[0];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Scale className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Suivi du poids</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un poids
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enregistrer mon poids</DialogTitle>
              <DialogDescription>La date est automatiquement celle d'aujourd'hui</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Poids (kg) *</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  min="0"
                  max="500"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="75.5"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optionnel)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Commentaires ou observations..."
                  rows={3}
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {latestWeight && (
        <Card>
          <CardHeader>
            <CardTitle>Dernier poids enregistré</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-primary">{latestWeight.weight_kg}</span>
              <span className="text-xl text-muted-foreground">kg</span>
              <span className="text-sm text-muted-foreground ml-4">
                le {format(new Date(latestWeight.recorded_at), "dd MMMM yyyy", { locale: fr })}
              </span>
            </div>
            {latestWeight.notes && <p className="mt-2 text-sm text-muted-foreground">{latestWeight.notes}</p>}
          </CardContent>
        </Card>
      )}

      {weightEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Évolution du poids</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--foreground))" }} />
                <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fill: "hsl(var(--foreground))" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="poids"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
        </CardHeader>
        <CardContent>
          {weightEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucune donnée pour le moment. Commence par enregistrer ton poids !
            </p>
          ) : (
            <div className="space-y-2">
              {weightEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-semibold">{entry.weight_kg} kg</span>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(entry.recorded_at), "dd MMMM yyyy", { locale: fr })}
                      </span>
                    </div>
                    {entry.notes && <p className="text-sm text-muted-foreground mt-1">{entry.notes}</p>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration du rappel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Rappel de pesée
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reminder-toggle" className="text-base font-medium cursor-pointer">
                Activer le rappel
              </Label>
              <p className="text-sm text-muted-foreground">
                Affiche un rappel sur la page d'accueil le jour choisi
              </p>
            </div>
            <Switch 
              id="reminder-toggle" 
              checked={reminderConfig.enabled} 
              onCheckedChange={handleReminderToggle} 
            />
          </div>

          {reminderConfig.enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
              <div className="space-y-2">
                <Label>Jour du rappel</Label>
                <Select 
                  value={reminderConfig.dayOfWeek.toString()} 
                  onValueChange={handleDayChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={day.value.toString()}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fréquence</Label>
                <Select 
                  value={reminderConfig.frequency.toString()} 
                  onValueChange={handleFrequencyChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Chaque semaine</SelectItem>
                    <SelectItem value="2">Toutes les 2 semaines</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
