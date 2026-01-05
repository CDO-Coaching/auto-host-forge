import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, Check, X, User, ChevronRight, Search, Pause, Play, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { getWeekNumber, getWeekYear } from "@/lib/weekUtils";
import { PauseReminderDialog } from "@/components/PauseReminderDialog";

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
  display_order?: number;
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
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [selectedAthleteForPause, setSelectedAthleteForPause] = useState<AthleteRelationship | null>(null);
  const [manualOrder, setManualOrder] = useState<string[]>([]);

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
    const currentYear = getWeekYear(new Date());
    
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

  const handlePauseClick = (relationship: AthleteRelationship) => {
    if (relationship.status === "paused") {
      // Réactivation directe sans dialog
      handleReactivate(relationship.id);
    } else {
      // Mise en pause: afficher le dialog
      setSelectedAthleteForPause(relationship);
      setShowPauseDialog(true);
    }
  };

  const handleReactivate = async (relationshipId: string) => {
    try {
      const { error } = await supabase
        .from("coach_athlete_relationships")
        .update({ status: "approved", reminder_date: null })
        .eq("id", relationshipId);

      if (error) {
        console.error("Erreur SQL détaillée:", error);
        toast.error(`Erreur: ${error.message}`);
        return;
      }

      toast.success("Athlète réactivé");
      await loadRelationships();
    } catch (error: any) {
      console.error("Erreur lors de la réactivation:", error);
      toast.error(`Erreur: ${error.message || "Impossible de réactiver"}`);
    }
  };

  const handlePauseConfirm = async (reminderDate: Date | null) => {
    if (!selectedAthleteForPause) return;

    try {
      // Utiliser format pour éviter le décalage de fuseau horaire avec toISOString
      const formatDateForDB = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const updateData: { status: string; reminder_date: string | null } = {
        status: "paused",
        reminder_date: reminderDate ? formatDateForDB(reminderDate) : null,
      };

      const { error } = await supabase
        .from("coach_athlete_relationships")
        .update(updateData)
        .eq("id", selectedAthleteForPause.id);

      if (error) {
        console.error("Erreur SQL détaillée:", error);
        toast.error(`Erreur: ${error.message}`);
        return;
      }

      if (reminderDate) {
        toast.success(`Athlète mis en pause. Rappel programmé pour le ${reminderDate.toLocaleDateString("fr-FR")}`);
      } else {
        toast.success("Athlète mis en pause (sans rappel)");
      }

      setShowPauseDialog(false);
      setSelectedAthleteForPause(null);
      await loadRelationships();
    } catch (error: any) {
      console.error("Erreur lors de la mise en pause:", error);
      toast.error(`Erreur: ${error.message || "Impossible de mettre en pause"}`);
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

  // Fonction pour déplacer un athlète dans la liste
  const moveAthlete = (athleteId: string, direction: 'up' | 'down') => {
    // Séparer les non-validés et validés
    const nonValidated = approvedAthletes.filter(a => !a.hasCurrentWeekProgrammed);
    const validated = approvedAthletes.filter(a => a.hasCurrentWeekProgrammed);
    
    // Trouver l'index actuel dans les non-validés seulement
    const currentIndex = nonValidated.findIndex(a => a.athlete_id === athleteId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= nonValidated.length) return;
    
    // Réordonner
    const newNonValidated = [...nonValidated];
    const [movedItem] = newNonValidated.splice(currentIndex, 1);
    newNonValidated.splice(newIndex, 0, movedItem);
    
    // Mettre à jour l'ordre manuel
    setManualOrder(newNonValidated.map(a => a.athlete_id));
    
    // Reconstruire la liste complète
    setApprovedAthletes([...newNonValidated, ...validated]);
  };

  // Trier les athlètes approuvés : non validés en haut, validés en bas
  const sortedApprovedAthletes = [...approvedAthletes].sort((a, b) => {
    // D'abord séparer validés et non-validés
    if (a.hasCurrentWeekProgrammed !== b.hasCurrentWeekProgrammed) {
      return a.hasCurrentWeekProgrammed ? 1 : -1;
    }
    // Si ordre manuel existe pour les non-validés, l'utiliser
    if (!a.hasCurrentWeekProgrammed && manualOrder.length > 0) {
      const indexA = manualOrder.indexOf(a.athlete_id);
      const indexB = manualOrder.indexOf(b.athlete_id);
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
    }
    return 0;
  });

  const filteredPending = filterAthletes(pendingRequests);
  const filteredApproved = filterAthletes(sortedApprovedAthletes);
  const filteredPaused = filterAthletes(pausedAthletes);
  const filteredExternalClients = filterExternalClients(externalClients);
  
  // Calculer les index pour savoir si on peut monter/descendre
  const nonValidatedAthletes = filteredApproved.filter(a => !a.hasCurrentWeekProgrammed);

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
              <>
                <Badge className="ml-1 sm:ml-2 bg-green-600 text-xs">
                  {approvedAthletes.length}
                </Badge>
                {(() => {
                  const validatedCount = approvedAthletes.filter(a => a.hasCurrentWeekProgrammed).length;
                  const totalCount = approvedAthletes.length;
                  // N'afficher que si tous ne sont pas validés
                  if (validatedCount < totalCount) {
                    return (
                      <Badge variant="outline" className="ml-1 text-xs border-yellow-500 text-yellow-500">
                        {validatedCount}/{totalCount}
                      </Badge>
                    );
                  }
                  return null;
                })()}
              </>
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

        <TabsContent value="pending" className="space-y-3 sm:space-y-4">
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Demandes en attente de validation</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Ces athlètes aimeraient que tu sois leur coach, {firstName}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {filteredPending.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">
                  {searchQuery ? "Aucune demande ne correspond à ta recherche" : "Aucune demande en attente"}
                </p>
              ) : (
                <div className="space-y-2 sm:space-y-4">
                  {filteredPending.map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2.5 sm:p-4 border rounded-lg gap-2 sm:gap-4"
                    >
                      <div className="flex items-center gap-2.5 sm:gap-4 w-full sm:w-auto">
                        <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm sm:text-base truncate">
                            {request.athlete.first_name} {request.athlete.last_name}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {request.athlete.email}
                          </p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                            <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline mr-0.5 sm:mr-1" />
                            Demandé le {new Date(request.requested_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 sm:gap-2 w-full sm:w-auto">
                        <Button
                          size="sm"
                          onClick={() => handleResponse(request.id, "approved")}
                          className="flex-1 sm:flex-none h-8 text-xs"
                        >
                          <Check className="h-3.5 w-3.5 sm:mr-1" />
                          <span className="hidden sm:inline">Accepter</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleResponse(request.id, "rejected")}
                          className="h-8 text-xs"
                        >
                          <X className="h-3.5 w-3.5 sm:mr-1" />
                          <span className="hidden sm:inline">Refuser</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved" className="space-y-3 sm:space-y-4">
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Tes athlètes</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Liste des athlètes que tu accompagnes
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {filteredApproved.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">
                  {searchQuery ? "Aucun athlète ne correspond à ta recherche" : "Tu n'as pas encore d'athlètes approuvés"}
                </p>
              ) : (
                <div className="space-y-2 sm:space-y-4">
                  {filteredApproved.map((relationship) => (
                     <div
                      key={relationship.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-4 border rounded-lg hover:border-primary transition-colors gap-2 sm:gap-4 cursor-pointer"
                      onClick={() => navigate(`/coach/client/${relationship.athlete_id}`)}
                    >
                      <div className="flex items-center gap-2.5 sm:gap-4 flex-1">
                        <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-full bg-green-600/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 sm:h-6 sm:w-6 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm sm:text-base truncate">
                            {relationship.athlete.first_name} {relationship.athlete.last_name}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {relationship.athlete.email}
                          </p>
                          {relationship.athlete.date_of_birth && (
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                              Né(e) le {new Date(relationship.athlete.date_of_birth).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 justify-end">
                        {/* Boutons de réordonnancement pour les non-validés */}
                        {!relationship.hasCurrentWeekProgrammed && (
                          <div className="flex flex-col gap-0.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveAthlete(relationship.athlete_id, 'up');
                              }}
                              disabled={nonValidatedAthletes.findIndex(a => a.athlete_id === relationship.athlete_id) === 0}
                              className="h-5 w-5 p-0 hover:bg-primary/10"
                              title="Monter"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveAthlete(relationship.athlete_id, 'down');
                              }}
                              disabled={nonValidatedAthletes.findIndex(a => a.athlete_id === relationship.athlete_id) === nonValidatedAthletes.length - 1}
                              className="h-5 w-5 p-0 hover:bg-primary/10"
                              title="Descendre"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePauseClick(relationship);
                          }}
                          className="h-7 sm:h-8 text-xs px-2 sm:px-3"
                        >
                          <Pause className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Pause</span>
                        </Button>
                        {relationship.hasCurrentWeekProgrammed ? (
                          <Badge className="bg-green-600 text-[10px] sm:text-xs h-5 sm:h-auto px-1.5 sm:px-2">
                            <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                            <span className="hidden sm:inline">Validé</span>
                            <span className="sm:hidden">✓</span>
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] sm:text-xs h-5 sm:h-auto px-1.5 sm:px-2">
                            <X className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                            <span className="hidden sm:inline">Non validé</span>
                            <span className="sm:hidden">✗</span>
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paused" className="space-y-3 sm:space-y-4">
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Athlètes en pause</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Liste des athlètes dont le suivi est actuellement en pause
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {pausedAthletes.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">
                  {searchQuery ? "Aucun athlète en pause ne correspond à ta recherche" : "Aucun athlète en pause"}
                </p>
              ) : (
                <div className="space-y-2 sm:space-y-4">
                  {filteredPaused.map((relationship) => (
                    <div
                      key={relationship.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-4 border rounded-lg hover:border-primary transition-colors gap-2 sm:gap-4 cursor-pointer"
                      onClick={() => navigate(`/coach/client/${relationship.athlete_id}`)}
                    >
                      <div className="flex items-center gap-2.5 sm:gap-4 flex-1">
                        <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm sm:text-base truncate">
                            {relationship.athlete.first_name} {relationship.athlete.last_name}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {relationship.athlete.email}
                          </p>
                          {relationship.athlete.date_of_birth && (
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                              Né(e) le {new Date(relationship.athlete.date_of_birth).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 justify-end">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePauseClick(relationship);
                          }}
                          className="h-7 sm:h-8 text-xs px-2 sm:px-3"
                        >
                          <Play className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Réactiver</span>
                        </Button>
                        <Badge variant="outline" className="text-[10px] sm:text-xs h-5 sm:h-auto px-1.5 sm:px-2">
                          <Pause className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                          <span className="hidden sm:inline">En pause</span>
                          <span className="sm:hidden">Pause</span>
                        </Badge>
                        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="external" className="space-y-3 sm:space-y-4">
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <div>
                  <CardTitle className="text-base sm:text-lg">Clients externes</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Clients présentiels n'utilisant pas l'application
                  </CardDescription>
                </div>
                <Dialog open={showAddExternalDialog} onOpenChange={setShowAddExternalDialog}>
                  <DialogTrigger asChild>
                    <Button className="h-8 text-xs sm:h-9 sm:text-sm w-full sm:w-auto">
                      <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      Ajouter un client
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="mx-4 sm:mx-auto max-w-[95vw] sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-base sm:text-lg">Ajouter un client externe</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <Label htmlFor="firstName" className="text-xs sm:text-sm">Prénom *</Label>
                        <Input
                          id="firstName"
                          value={newExternalFirstName}
                          onChange={(e) => setNewExternalFirstName(e.target.value)}
                          placeholder="Prénom"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName" className="text-xs sm:text-sm">Nom *</Label>
                        <Input
                          id="lastName"
                          value={newExternalLastName}
                          onChange={(e) => setNewExternalLastName(e.target.value)}
                          placeholder="Nom"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email" className="text-xs sm:text-sm">Email (optionnel)</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newExternalEmail}
                          onChange={(e) => setNewExternalEmail(e.target.value)}
                          placeholder="email@exemple.com"
                          className="h-9 text-sm"
                        />
                      </div>
                      <Button onClick={handleAddExternalClient} className="w-full h-9 text-sm">
                        Ajouter
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {filteredExternalClients.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">
                  {searchQuery ? "Aucun client externe ne correspond à ta recherche" : "Aucun client externe"}
                </p>
              ) : (
                <div className="space-y-2 sm:space-y-4">
                  {filteredExternalClients.map((client) => (
                    <div
                      key={client.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-4 border rounded-lg hover:border-primary transition-colors gap-2 sm:gap-4"
                    >
                      <div className="flex items-center gap-2.5 sm:gap-4 flex-1">
                        <div className={`h-9 w-9 sm:h-12 sm:w-12 rounded-full ${client.is_active ? 'bg-blue-600/10' : 'bg-muted'} flex items-center justify-center flex-shrink-0`}>
                          <User className={`h-4 w-4 sm:h-6 sm:w-6 ${client.is_active ? 'text-blue-600' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm sm:text-base truncate">
                            {client.first_name} {client.last_name}
                          </p>
                          {client.email && (
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">
                              {client.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 justify-end">
                        <Button
                          size="sm"
                          variant={client.is_active ? "outline" : "default"}
                          onClick={() => handleToggleExternalClient(client.id, client.is_active)}
                          className="h-7 sm:h-8 text-xs px-2 sm:px-3"
                        >
                          {client.is_active ? (
                            <>
                              <Pause className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                              <span className="hidden sm:inline">Désactiver</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                              <span className="hidden sm:inline">Activer</span>
                            </>
                          )}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="mx-4 sm:mx-auto max-w-[95vw] sm:max-w-md">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-base sm:text-lg">Supprimer ce client ?</AlertDialogTitle>
                              <AlertDialogDescription className="text-xs sm:text-sm">
                                Cette action est irréversible. Le client "{client.first_name} {client.last_name}" sera définitivement supprimé.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-row gap-2 sm:gap-0">
                              <AlertDialogCancel className="flex-1 sm:flex-none h-9 text-sm">Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteExternalClient(client.id)}
                                className="flex-1 sm:flex-none h-9 text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Badge variant={client.is_active ? "default" : "outline"} className={`text-[10px] sm:text-xs h-5 sm:h-auto px-1.5 sm:px-2 ${client.is_active ? "bg-blue-600" : ""}`}>
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

      <PauseReminderDialog
        open={showPauseDialog}
        onOpenChange={setShowPauseDialog}
        athleteName={selectedAthleteForPause ? `${selectedAthleteForPause.athlete.first_name || ""} ${selectedAthleteForPause.athlete.last_name || ""}`.trim() : ""}
        onConfirm={handlePauseConfirm}
      />
    </div>
  );
}
