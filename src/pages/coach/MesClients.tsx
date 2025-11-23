import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, Check, X, User, ChevronRight, Search, Pause, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getWeekNumber } from "@/lib/weekUtils";

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
  hasCurrentWeekProgrammed?: boolean;
}

export default function MesClients() {
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const firstName = profile?.first_name || "Coach";
  const [pendingRequests, setPendingRequests] = useState<AthleteRelationship[]>([]);
  const [approvedAthletes, setApprovedAthletes] = useState<AthleteRelationship[]>([]);
  const [pausedAthletes, setPausedAthletes] = useState<AthleteRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (profile?.id) {
      loadRelationships();
    }
  }, [profile]);

  const loadRelationships = async () => {
    if (!profile?.id) return;

    setLoading(true);

    // 1) Récupère les relations sans jointure pour éviter les blocages RLS
    const [{ data: pendingRels, error: pendingError }, { data: approvedRels, error: approvedError }, { data: pausedRels, error: pausedError }] = await Promise.all([
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
      supabase
        .from("coach_athlete_relationships")
        .select("id, athlete_id, status, requested_at")
        .eq("coach_id", profile.id)
        .eq("status", "paused")
        .order("requested_at", { ascending: false }),
    ]);

    console.log("Relations chargées:", { pendingRels, approvedRels, pausedRels, pendingError, approvedError, pausedError });

    // 2) Charge les profils des athlètes concernés en une seule requête
    const athleteIds = Array.from(
      new Set([...(pendingRels || []), ...(approvedRels || []), ...(pausedRels || [])].map((r) => r.athlete_id))
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

    // 3) Vérifier si la semaine en cours est programmée pour chaque athlète
    const currentWeek = getWeekNumber(new Date());
    const currentYear = new Date().getFullYear();
    
    const athleteWeeksMap = new Map<string, boolean>();
    if ((approvedRels || []).length > 0) {
      const approvedAthleteIds = (approvedRels || []).map((r) => r.athlete_id);
      
      const { data: weeks } = await supabase
        .from("training_weeks")
        .select("athlete_id")
        .in("athlete_id", approvedAthleteIds)
        .eq("week_number", currentWeek)
        .eq("year", currentYear)
        .eq("validated", true);

      if (weeks) {
        weeks.forEach((week) => {
          athleteWeeksMap.set(week.athlete_id, true);
        });
      }
    }

    // 4) Recompose les objets avec le profil
    const pendingWithProfiles = (pendingRels || [])
      .map((r) => ({ ...r, athlete: athletesMap.get(r.athlete_id)! }))
      .filter((r) => !!r.athlete) as AthleteRelationship[];

    const approvedWithProfiles = (approvedRels || [])
      .map((r) => ({ 
        ...r, 
        athlete: athletesMap.get(r.athlete_id)!,
        hasCurrentWeekProgrammed: athleteWeeksMap.get(r.athlete_id) || false
      }))
      .filter((r) => !!r.athlete) as AthleteRelationship[];

    const pausedWithProfiles = (pausedRels || [])
      .map((r) => ({ ...r, athlete: athletesMap.get(r.athlete_id)! }))
      .filter((r) => !!r.athlete) as AthleteRelationship[];

    setPendingRequests(pendingWithProfiles);
    setApprovedAthletes(approvedWithProfiles);
    setPausedAthletes(pausedWithProfiles);
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

  const handlePauseToggle = async (relationshipId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "paused" ? "approved" : "paused";
      
      console.log("Tentative de changement de statut:", { relationshipId, currentStatus, newStatus });
      
      const { data, error } = await supabase
        .from("coach_athlete_relationships")
        .update({ status: newStatus })
        .eq("id", relationshipId)
        .select();

      console.log("Résultat de l'update:", { data, error });

      if (error) {
        console.error("Erreur SQL détaillée:", error);
        toast.error(`Erreur: ${error.message}. As-tu exécuté la migration SQL ?`);
        return;
      }

      toast.success(
        newStatus === "paused" 
          ? "Athlète mis en pause" 
          : "Athlète réactivé"
      );
      
      await loadRelationships();
    } catch (error: any) {
      console.error("Erreur lors de la modification du statut:", error);
      toast.error(`Erreur: ${error.message || "Impossible de modifier le statut"}`);
    }
  };

  // Filtrer les athlètes selon la recherche
  const filterAthletes = (athletes: AthleteRelationship[]) => {
    if (!searchQuery.trim()) return athletes;
    
    const query = searchQuery.toLowerCase();
    return athletes.filter((rel) => {
      const firstName = rel.athlete.first_name?.toLowerCase() || "";
      const lastName = rel.athlete.last_name?.toLowerCase() || "";
      return firstName.includes(query) || lastName.includes(query);
    });
  };

  // Trier les athlètes approuvés : non validés en haut, validés en bas
  const sortedApprovedAthletes = [...approvedAthletes].sort((a, b) => {
    if (a.hasCurrentWeekProgrammed === b.hasCurrentWeekProgrammed) return 0;
    return a.hasCurrentWeekProgrammed ? 1 : -1; // false (non validé) avant true (validé)
  });

  const filteredPending = filterAthletes(pendingRequests);
  const filteredApproved = filterAthletes(sortedApprovedAthletes);
  const filteredPaused = filterAthletes(pausedAthletes);

  if (loading) {
    return <div className="text-center">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Mes clients</h1>
      
      <Tabs defaultValue="approved" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="approved">
            Mes athlètes
            {approvedAthletes.length > 0 && (
              <Badge className="ml-2 bg-green-600">
                {approvedAthletes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending">
            Demandes en attente
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="paused">
            En pause
            {pausedAthletes.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {pausedAthletes.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Rechercher par prénom ou nom..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demandes en attente de validation</CardTitle>
              <CardDescription>
                Ces athlètes aimeraient que tu sois leur coach, {firstName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredPending.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchQuery ? "Aucune demande ne correspond à ta recherche" : "Aucune demande en attente"}
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredPending.map((request) => (
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
              {filteredApproved.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchQuery ? "Aucun athlète ne correspond à ta recherche" : "Tu n'as pas encore d'athlètes approuvés"}
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredApproved.map((relationship) => (
                     <div
                      key={relationship.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
                    >
                      <div 
                        className="flex items-center gap-4 flex-1 cursor-pointer"
                        onClick={() => navigate(`/coach/client/${relationship.athlete_id}`)}
                      >
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
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePauseToggle(relationship.id, relationship.status);
                          }}
                        >
                          <Pause className="h-4 w-4 mr-1" />
                          Pause
                        </Button>
                        {relationship.hasCurrentWeekProgrammed ? (
                          <Badge className="bg-green-600">
                            <Check className="h-3 w-3 mr-1" />
                            Validé
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <X className="h-3 w-3 mr-1" />
                            Non validé
                          </Badge>
                        )}
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paused" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Athlètes en pause</CardTitle>
              <CardDescription>
                Liste des athlètes dont le suivi est actuellement en pause
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredPaused.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchQuery ? "Aucun athlète en pause ne correspond à ta recherche" : "Aucun athlète en pause"}
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredPaused.map((relationship) => (
                    <div
                      key={relationship.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
                    >
                      <div 
                        className="flex items-center gap-4 flex-1 cursor-pointer"
                        onClick={() => navigate(`/coach/client/${relationship.athlete_id}`)}
                      >
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-6 w-6 text-muted-foreground" />
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
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePauseToggle(relationship.id, relationship.status);
                          }}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Réactiver
                        </Button>
                        <Badge variant="outline">
                          <Pause className="h-3 w-3 mr-1" />
                          En pause
                        </Badge>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
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
