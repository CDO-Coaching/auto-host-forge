import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CustomSession {
  id: string;
  session_name: string;
  description: string | null;
  duration_minutes: number;
  completed_at: string;
}

export default function MesSeances() {
  const [customSessions, setCustomSessions] = useState<CustomSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomSessions();
  }, []);

  const loadCustomSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("custom_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false });

      if (error) throw error;

      setCustomSessions(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement des séances:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 px-3 sm:px-0">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Mes séances perso</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Historique de toutes tes séances supplémentaires
        </p>
      </div>

      {customSessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 sm:py-12 px-4">
            <Clock className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
            <p className="text-sm sm:text-base text-muted-foreground text-center">
              Aucune séance perso enregistrée pour le moment.
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground text-center mt-2">
              Retourne sur la page "Séances" pour ajouter une séance perso.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {customSessions.map((session) => (
            <Card key={session.id} className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2 sm:pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <CardTitle className="text-base sm:text-xl break-words">{session.session_name}</CardTitle>
                      <Badge variant="secondary" className="text-xs shrink-0">Perso</Badge>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-muted-foreground mt-2">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span>{session.duration_minutes} min</span>
                      </div>
                      <span className="text-xs sm:text-sm">
                        {format(new Date(session.completed_at), "EEEE d MMMM yyyy 'à' HH:mm", {
                          locale: fr,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              {session.description && (
                <CardContent className="pt-0">
                  <p className="text-xs sm:text-sm text-foreground/80 italic border-l-2 border-primary/30 pl-3">
                    {session.description}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
