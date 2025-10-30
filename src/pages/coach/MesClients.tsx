import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, Check, X, User } from "lucide-react";

interface Athlete {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  date_of_birth: string | null;
  gender: string | null;
}

interface AthleteRelationship {
  id: string;
  athlete_id: string;
  status: string;
  requested_at: string;
  athlete: Athlete;
}

export default function MesClients() {
  const { profile } = useUserProfile();
  const firstName = profile?.first_name || "Coach";
  const [pendingRequests, setPendingRequests] = useState<AthleteRelationship[]>([]);
  const [approvedAthletes, setApprovedAthletes] = useState<AthleteRelationship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      loadRelationships();
    }
  }, [profile]);

  const loadRelationships = async () => {
    if (!profile?.id) return;

    setLoading(true);

    // 1) Récupère les relations sans jointure pour éviter les blocages RLS
    const [{ data: pendingRels }, { data: approvedRels }] = await Promise.all([
      supabase
        .from("coach_athlete_relationships")
        .select("id, athlete_id, status, requested_at")
        .eq("coach_id", profile.id)
        .eq("status", "pending")
        .order("requested_at", { ascending: false }),
      supabase
        .from("coach_athlete_relationships")
        .select("id, athlete_id, status, requested_at")
        .eq("coach_id", profile.id)
        .eq("status", "approved")
        .order("requested_at", { ascending: false }),
    ]);

    // 2) Charge les profils des athlètes concernés en une seule requête
    const athleteIds = Array.from(
      new Set([...(pendingRels || []), ...(approvedRels || [])].map((r) => r.athlete_id))
    );

    let athletesMap = new Map<string, Athlete>();
    if (athleteIds.length > 0) {
      const { data: athletes } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, email, date_of_birth, gender")
        .in("id", athleteIds);

      if (athletes) {
        athletesMap = new Map(athletes.map((a) => [a.id, a as Athlete]));
      }
    }

    // 3) Recompose les objets avec le profil
    const pendingWithProfiles = (pendingRels || [])
      .map((r) => ({ ...r, athlete: athletesMap.get(r.athlete_id)! }))
      .filter((r) => !!r.athlete) as AthleteRelationship[];

    const approvedWithProfiles = (approvedRels || [])
      .map((r) => ({ ...r, athlete: athletesMap.get(r.athlete_id)! }))
      .filter((r) => !!r.athlete) as AthleteRelationship[];

    setPendingRequests(pendingWithProfiles);
    setApprovedAthletes(approvedWithProfiles);
    setLoading(false);
  };

  const handleResponse = async (relationshipId: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("coach_athlete_relationships")
        .update({
          status,
          responded_at: new Date().toISOString(),
        })
        .eq("id", relationshipId);

      if (error) throw error;

      toast.success(
        status === "approved" 
          ? "Demande acceptée ! Tu peux maintenant suivre cet athlète." 
          : "Demande refusée"
      );
      
      await loadRelationships();
    } catch (error: any) {
      toast.error("Erreur lors du traitement de la demande");
      console.error(error);
    }
  };

  if (loading) {
    return <div className="text-center">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Mes clients</h1>
      
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending">
            Demandes en attente
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">
            Mes athlètes
            {approvedAthletes.length > 0 && (
              <Badge className="ml-2 bg-green-600">
                {approvedAthletes.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demandes en attente de validation</CardTitle>
              <CardDescription>
                Ces athlètes aimeraient que tu sois leur coach, {firstName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucune demande en attente
                </p>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {request.athlete.first_name} {request.athlete.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {request.athlete.email}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3 inline mr-1" />
                            Demandé le {new Date(request.requested_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleResponse(request.id, "approved")}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Accepter
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleResponse(request.id, "rejected")}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Refuser
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tes athlètes</CardTitle>
              <CardDescription>
                Liste des athlètes que tu accompagnes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {approvedAthletes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Tu n'as pas encore d'athlètes approuvés
                </p>
              ) : (
                <div className="space-y-4">
                  {approvedAthletes.map((relationship) => (
                    <div
                      key={relationship.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-green-600/10 flex items-center justify-center">
                          <User className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {relationship.athlete.first_name} {relationship.athlete.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {relationship.athlete.email}
                          </p>
                          {relationship.athlete.date_of_birth && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Né(e) le {new Date(relationship.athlete.date_of_birth).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge className="bg-green-600">
                        <Check className="h-3 w-3 mr-1" />
                        Actif
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
