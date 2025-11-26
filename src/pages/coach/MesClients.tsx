import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, Check, X, User, ChevronRight, Search, Pause, Play, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
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

interface ExternalClient {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  is_active: boolean;
}

export default function MesClients() {
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const firstName = profile?.first_name || "Coach";
  const [pendingRequests, setPendingRequests] = useState<AthleteRelationship[]>([]);
  const [approvedAthletes, setApprovedAthletes] = useState<AthleteRelationship[]>([]);
  const [pausedAthletes, setPausedAthletes] = useState<AthleteRelationship[]>([]);
  const [externalClients, setExternalClients] = useState<ExternalClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddExternalDialog, setShowAddExternalDialog] = useState(false);
  const [newExternalFirstName, setNewExternalFirstName] = useState("");
  const [newExternalLastName, setNewExternalLastName] = useState("");
  const [newExternalEmail, setNewExternalEmail] = useState("");

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
      const { data: athletes, error: athletesError } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, email, date_of_birth, gender")
        .in("id", athleteIds);

      console.log("Profils chargés:", { 
        athleteIds: athleteIds.length, 
        athletesLoaded: athletes?.length,
        athletesError,
        pausedIds: (pausedRels || []).map(r => r.athlete_id)
      });

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

    const pausedWithProfiles = (pausedRels || []).map((r) => {
      const athlete = athletesMap.get(r.athlete_id) || {
        id: r.athlete_id,
        first_name: "Athlète",
        last_name: "",
        email: "",
        date_of_birth: null,
        gender: null,
      };

      return { ...r, athlete } as AthleteRelationship;
    });

    // 5) Charger les clients externes
    const { data: externalClientsData } = await supabase
      .from("external_clients")
      .select("id, first_name, last_name, email, is_active")
      .eq("coach_id", profile.id)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    setPendingRequests(pendingWithProfiles);
    setApprovedAthletes(approvedWithProfiles);
    setPausedAthletes(pausedWithProfiles);
    setExternalClients(externalClientsData || []);
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

  const handleToggleExternalClient = async (clientId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("external_clients")
        .update({ is_active: !currentStatus })
        .eq("id", clientId);

      if (error) throw error;

      toast.success(!currentStatus ? "Client activé" : "Client désactivé");
      await loadRelationships();
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la modification du statut");
    }
  };

  const handleAddExternalClient = async () => {
    if (!newExternalFirstName.trim() || !newExternalLastName.trim()) {
      toast.error("Le prénom et le nom sont obligatoires");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expirée");
        return;
      }

      const { error } = await supabase
        .from("external_clients")
        .insert({
          coach_id: session.user.id,
          first_name: newExternalFirstName.trim(),
          last_name: newExternalLastName.trim(),
          email: newExternalEmail.trim() || null,
          is_active: true
        });

      if (error) {
        console.error("Erreur détaillée:", error);
        throw error;
      }

      toast.success("Client externe ajouté");
      setNewExternalFirstName("");
      setNewExternalLastName("");
      setNewExternalEmail("");
      setShowAddExternalDialog(false);
      await loadRelationships();
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error(`Erreur: ${error.message || "Impossible d'ajouter le client"}`);
    }
  };

  const handleDeleteExternalClient = async (clientId: string) => {
    try {
      const { error } = await supabase
        .from("external_clients")
        .delete()
        .eq("id", clientId);

      if (error) throw error;

      toast.success("Client externe supprimé");
      await loadRelationships();
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression du client");
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

  // Filtrer les clients externes selon la recherche
  const filterExternalClients = (clients: ExternalClient[]) => {
    if (!searchQuery.trim()) return clients;
    
    const query = searchQuery.toLowerCase();
    return clients.filter((client) => {
      const firstName = client.first_name?.toLowerCase() || "";
      const lastName = client.last_name?.toLowerCase() || "";
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
  const filteredExternalClients = filterExternalClients(externalClients);

  console.log("MesClients state:", {
    pendingRequests: pendingRequests.length,
    approvedAthletes: approvedAthletes.length,
    pausedAthletes: pausedAthletes.length,
    filteredPaused: filteredPaused.length,
    searchQuery,
  });

  if (loading) {
    return <div className="text-center">Chargement...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-0">
      <h1 className="text-2xl sm:text-3xl font-bold">Mes clients</h1>
      
      <Tabs defaultValue="approved" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
          <TabsTrigger value="approved" className="text-xs sm:text-sm py-2 sm:py-2.5">
            <span className="hidden sm:inline">Mes athlètes</span>
            <span className="sm:hidden">Athlètes</span>
            {approvedAthletes.length > 0 && (
              <Badge className="ml-1 sm:ml-2 bg-green-600 text-xs">
                {approvedAthletes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-xs sm:text-sm py-2 sm:py-2.5">
            <span className="hidden sm:inline">Demandes en attente</span>
            <span className="sm:hidden">Demandes</span>
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="paused" className="text-xs sm:text-sm py-2 sm:py-2.5 col-span-2 sm:col-span-1">
            En pause
          </TabsTrigger>
          <TabsTrigger value="external" className="text-xs sm:text-sm py-2 sm:py-2.5 col-span-2 sm:col-span-1">
            <span className="hidden sm:inline">Clients externes</span>
            <span className="sm:hidden">Externes</span>
            {externalClients.length > 0 && (
              <Badge className="ml-1 sm:ml-2 bg-blue-600 text-xs">
                {externalClients.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="relative mt-3 sm:mt-4">
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
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border rounded-lg gap-3 sm:gap-4"
                    >
                      <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm sm:text-base">
                            {request.athlete.first_name} {request.athlete.last_name}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {request.athlete.email}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3 inline mr-1" />
                            Demandé le {new Date(request.requested_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                          size="sm"
                          onClick={() => handleResponse(request.id, "approved")}
                          className="flex-1 sm:flex-none"
                        >
                          <Check className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Accepter</span>
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
              {pausedAthletes.length === 0 ? (
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

        <TabsContent value="external" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Clients externes</CardTitle>
                  <CardDescription>
                    Clients présentiels n'utilisant pas l'application
                  </CardDescription>
                </div>
                <Dialog open={showAddExternalDialog} onOpenChange={setShowAddExternalDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter un client
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Ajouter un client externe</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="firstName">Prénom *</Label>
                        <Input
                          id="firstName"
                          value={newExternalFirstName}
                          onChange={(e) => setNewExternalFirstName(e.target.value)}
                          placeholder="Prénom"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Nom *</Label>
                        <Input
                          id="lastName"
                          value={newExternalLastName}
                          onChange={(e) => setNewExternalLastName(e.target.value)}
                          placeholder="Nom"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email (optionnel)</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newExternalEmail}
                          onChange={(e) => setNewExternalEmail(e.target.value)}
                          placeholder="email@exemple.com"
                        />
                      </div>
                      <Button onClick={handleAddExternalClient} className="w-full">
                        Ajouter
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {filteredExternalClients.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchQuery ? "Aucun client externe ne correspond à ta recherche" : "Aucun client externe"}
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredExternalClients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`h-12 w-12 rounded-full ${client.is_active ? 'bg-blue-600/10' : 'bg-muted'} flex items-center justify-center`}>
                          <User className={`h-6 w-6 ${client.is_active ? 'text-blue-600' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <p className="font-medium">
                            {client.first_name} {client.last_name}
                          </p>
                          {client.email && (
                            <p className="text-sm text-muted-foreground">
                              {client.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={client.is_active ? "outline" : "default"}
                          onClick={() => handleToggleExternalClient(client.id, client.is_active)}
                        >
                          {client.is_active ? (
                            <>
                              <Pause className="h-4 w-4 mr-1" />
                              Désactiver
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-1" />
                              Activer
                            </>
                          )}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. Le client "{client.first_name} {client.last_name}" sera définitivement supprimé.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteExternalClient(client.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Badge variant={client.is_active ? "default" : "outline"} className={client.is_active ? "bg-blue-600" : ""}>
                          {client.is_active ? "Actif" : "Inactif"}
                        </Badge>
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
