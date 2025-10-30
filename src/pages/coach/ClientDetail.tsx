import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, User, Calendar, Mail, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AthleteProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  date_of_birth: string | null;
  gender: string | null;
  role: string;
}

export default function ClientDetail() {
  const { athleteId } = useParams();
  const navigate = useNavigate();
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
              <CardTitle>Programme d'entraînement</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Ici tu pourras créer et gérer le programme d'entraînement de {athlete.first_name}.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Fonctionnalité en cours de développement...
              </p>
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
