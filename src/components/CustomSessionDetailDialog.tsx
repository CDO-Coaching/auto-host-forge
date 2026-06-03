/**
 * CustomSessionDetailDialog
 * Vue détail d'une séance personnelle (course, vélo, natation, perso).
 * Affiche les données enregistrées et propose un bouton pour éditer.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, MapPin, Clock, Heart, Gauge, Flame, Footprints, Bike, Waves, Activity, Zap, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { HeartRateZonesBar } from "@/components/HeartRateZonesBar";

interface CustomSession {
  id: string;
  session_name: string;
  description?: string | null;
  duration_minutes?: number | null;
  completed_at?: string | null;
  scheduled_date?: string | null;
  cardio_type?: string | null;
  distance_km?: number | null;
  avg_pace?: string | null;
  avg_heart_rate?: number | null;
  session_rpe?: number | null;
  [key: string]: any;
}

interface CustomSessionDetailDialogProps {
  session: CustomSession | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
}

function SportIcon({ type }: { type?: string | null }) {
  switch (type) {
    case "course": return <Footprints className="h-4 w-4" />;
    case "velo":   return <Bike className="h-4 w-4" />;
    case "natation": return <Waves className="h-4 w-4" />;
    default: return <Activity className="h-4 w-4" />;
  }
}

function SportLabel({ type }: { type?: string | null }) {
  switch (type) {
    case "course": return "Course à pied";
    case "velo":   return "Vélo";
    case "natation": return "Natation";
    default: return "Séance libre";
  }
}

function SportColor({ type }: { type?: string | null }) {
  switch (type) {
    case "course": return "bg-orange-500/20 text-orange-400 border-orange-500/40";
    case "velo":   return "bg-blue-500/20 text-blue-400 border-blue-500/40";
    case "natation": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/40";
    default: return "bg-purple-500/20 text-purple-400 border-purple-500/40";
  }
}

function rpeLabel(rpe: number): string {
  if (rpe <= 3) return "Facile 🟢";
  if (rpe <= 5) return "Modéré 🟡";
  if (rpe <= 7) return "Soutenu 🟠";
  if (rpe <= 9) return "Difficile 🔴";
  return "Maximum 🔴";
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}

export function CustomSessionDetailDialog({ session, open, onClose, onEdit }: CustomSessionDetailDialogProps) {
  if (!session) return null;

  const dateStr = session.completed_at ?? session.scheduled_date;
  const isCompleted = !!session.completed_at;

  const colorClass = SportColor({ type: session.cardio_type });

  const stats = [
    session.duration_minutes && {
      icon: <Clock className="h-4 w-4 text-muted-foreground" />,
      label: "Durée",
      value: formatDuration(session.duration_minutes),
    },
    session.distance_km && {
      icon: <MapPin className="h-4 w-4 text-muted-foreground" />,
      label: session.cardio_type === "natation" ? "Distance" : "Distance",
      value: session.cardio_type === "natation"
        ? `${(session.distance_km * 1000).toFixed(0)} m`
        : `${Number(session.distance_km).toFixed(2)} km`,
    },
    session.avg_pace && {
      icon: <Gauge className="h-4 w-4 text-muted-foreground" />,
      label: session.cardio_type === "velo" ? "Vitesse moy." : "Allure moy.",
      value: session.cardio_type === "velo"
        ? `${session.avg_pace} km/h`
        : `${session.avg_pace}/km`,
    },
    session.avg_heart_rate && {
      icon: <Heart className="h-4 w-4 text-muted-foreground" />,
      label: "FC moyenne",
      value: `${session.avg_heart_rate} bpm`,
    },
    session.max_heart_rate && {
      icon: <Heart className="h-4 w-4 text-muted-foreground" />,
      label: "FC max",
      value: `${session.max_heart_rate} bpm`,
    },
    session.cadence && {
      icon: <Activity className="h-4 w-4 text-muted-foreground" />,
      label: "Cadence",
      value: `${session.cadence} spm`,
    },
    session.calories && {
      icon: <Flame className="h-4 w-4 text-muted-foreground" />,
      label: "Calories",
      value: `${session.calories} kcal`,
    },
    session.elevation_gain && session.elevation_gain > 0 && {
      icon: <TrendingUp className="h-4 w-4 text-muted-foreground" />,
      label: "Dénivelé",
      value: `${session.elevation_gain} m`,
    },
    session.session_rpe && {
      icon: <Zap className="h-4 w-4 text-muted-foreground" />,
      label: "RPE ressenti",
      value: (
        <span>
          <span className="font-bold text-foreground">{session.session_rpe}/10</span>
          <span className="text-muted-foreground text-xs ml-2">{rpeLabel(session.session_rpe)}</span>
        </span>
      ),
    },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; value: React.ReactNode }[];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[460px] mx-4">
        <DialogHeader>
          <DialogTitle className="text-left">{session.session_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header sport + date */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`flex items-center gap-1.5 border text-xs px-2.5 py-0.5 ${colorClass}`}>
              <SportIcon type={session.cardio_type} />
              <SportLabel type={session.cardio_type} />
            </Badge>
            {dateStr && (
              <span className="text-xs text-muted-foreground">
                {format(new Date(dateStr), "EEEE d MMMM yyyy", { locale: fr })}
              </span>
            )}
            {isCompleted ? (
              <Badge variant="outline" className="text-[10px] border-green-500 text-green-500 bg-green-500/10">
                Validée ✓
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] border-orange-500 text-orange-500 bg-orange-500/10">
                Planifiée
              </Badge>
            )}
          </div>

          {/* Données enregistrées */}
          {stats.length > 0 ? (
            <div className="rounded-xl bg-muted/40 border border-border divide-y divide-border overflow-hidden">
              {stats.map((stat, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {stat.icon}
                    {stat.label}
                  </div>
                  <div className="text-sm font-semibold">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          ) : isCompleted ? (
            <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 text-sm text-muted-foreground text-center">
              Aucune donnée enregistrée
            </div>
          ) : null}

          {/* Zones de fréquence cardiaque */}
          {session.heart_rate_zones && Array.isArray(session.heart_rate_zones) && session.heart_rate_zones.length > 0 && (
            <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Zones de fréquence cardiaque</p>
              <HeartRateZonesBar zones={session.heart_rate_zones} />
            </div>
          )}

          {/* Description */}
          {session.description && (
            <div className="rounded-xl bg-muted/40 border border-border px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Notes</p>
              <p className="text-sm text-foreground/80 italic">{session.description}</p>
            </div>
          )}

          {/* Boutons */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Fermer
            </Button>
            <Button className="flex-1 gap-2" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Modifier
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
