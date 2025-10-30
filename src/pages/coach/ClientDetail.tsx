import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, User, Calendar, Mail, Plus, ChevronDown, ChevronRight, Trash2, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getWeek } from "date-fns";

interface AthleteProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  date_of_birth: string | null;
  gender: string | null;
  role: string;
}

interface Session {
  id: number;
  name: string;
  isExpanded: boolean;
}

export default function ClientDetail() {
  const { athleteId } = useParams();
  const navigate = useNavigate();
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  
  const currentWeekNumber = getWeek(new Date());

  useEffect(() => {
    loadAthleteData();
  }, [athleteId]);

  const loadAthleteData = async () => {
    if (!athleteId) return;

    setLoading(true);
    
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", athleteId)
      .single();

    if (error) {
      toast.error("Erreur lors du chargement des données");
      console.error(error);
      navigate("/coach/mes-clients");
    } else {
      setAthlete(data);
    }
    
    setLoading(false);
  };

  const handleCreateSession = () => {
    const nextSessionNumber = sessions.length + 1;
    const newSession: Session = {
      id: nextSessionNumber,
      name: `Séance ${nextSessionNumber}`,
      isExpanded: false,
    };
    
    setSessions([...sessions, newSession]);
    toast.success(`Séance ${nextSessionNumber} créée`);
  };

  const toggleSession = (sessionId: number) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
    } else {
      setExpandedSessionId(sessionId);
    }
  };

  const handleDeleteSession = (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedSessions = sessions
      .filter(s => s.id !== sessionId)
      .map((s, index) => ({
        ...s,
        id: index + 1,
        name: `Séance ${index + 1}`
      }));
    
    setSessions(updatedSessions);
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
    }
    toast.success("Séance supprimée");
  };

  const handleValidate = () => {
    setIsValidated(true);
    toast.success("Semaine d'entraînement validée ! Le sportif peut maintenant y accéder.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/coach/mes-clients")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour à mes clients
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Athlète introuvable</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/coach/mes-clients")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour à mes clients
        </Button>
      </div>

      <div className="flex items-center gap-6">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-10 w-10 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">
            {athlete.first_name} {athlete.last_name}
          </h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Mail className="h-4 w-4" />
              {athlete.email}
            </div>
            {athlete.date_of_birth && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Né(e) le {new Date(athlete.date_of_birth).toLocaleDateString()}
              </div>
            )}
            {athlete.gender && (
              <Badge variant="outline">
                {athlete.gender === "male" ? "Homme" : athlete.gender === "female" ? "Femme" : "Autre"}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="programmation" className="w-full">
        <TabsList>
          <TabsTrigger value="programmation">Programmation</TabsTrigger>
          <TabsTrigger value="suivi">Suivi</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="programmation" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Semaine d'entraînement n°{currentWeekNumber}</CardTitle>
                <Button onClick={handleCreateSession} disabled={isValidated}>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer une séance
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucune séance créée. Clique sur "Créer une séance" pour commencer.
                </p>
              ) : (
                <>
                  <div className="space-y-3">
                    {sessions.map((session) => (
                      <div key={session.id} className="border rounded-lg">
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => !isValidated && toggleSession(session.id)}
                        >
                          <div className="flex items-center gap-3">
                            {expandedSessionId === session.id ? (
                              <ChevronDown className="h-5 w-5 text-primary" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                            <span className="font-medium">{session.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {expandedSessionId === session.id ? "Ouvert" : "Fermé"}
                            </Badge>
                            {!isValidated && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleDeleteSession(session.id, e)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {expandedSessionId === session.id && (
                          <div className="border-t p-4 bg-muted/20">
                            <p className="text-sm text-muted-foreground">
                              Tableau des exercices pour {session.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Contenu à développer...
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {!isValidated && (
                    <div className="mt-6 flex justify-end">
                      <Button onClick={handleValidate} size="lg">
                        <Check className="h-4 w-4 mr-2" />
                        Valider la semaine
                      </Button>
                    </div>
                  )}
                  
                  {isValidated && (
                    <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                      <p className="text-sm font-medium text-primary">
                        ✓ Semaine validée - Le sportif peut maintenant voir ses séances
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suivi" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Suivi de progression</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Suivi des performances et de la progression de {athlete.first_name}.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Fonctionnalité en cours de développement...
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historique" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historique des séances</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Historique complet des séances réalisées par {athlete.first_name}.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Fonctionnalité en cours de développement...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
