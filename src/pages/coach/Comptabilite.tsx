import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Trash2, Save, Copy, TrendingUp, TrendingDown, Search, AlertCircle, BarChart3, Eye, EyeOff } from "lucide-react";
import { format, startOfMonth, addMonths, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { getMondayOfWeek, getSundayOfWeek } from "@/lib/weekUtils";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  is_external: boolean;
}

interface AccountingEntry {
  id: string;
  client_id?: string;
  external_client_id?: string;
  client_name: string;
  sessions_planned: number;
  sessions_done: number;
  sessions_paid: number;
  payment_type: string;
  amount_cash: number;
  amount_transfer: number;
  notes?: string;
  weekly_difference?: number;
}

export default function Comptabilite() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [clients, setClients] = useState<Client[]>([]);
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddClientDialog, setShowAddClientDialog] = useState(false);
  const [newClientFirstName, setNewClientFirstName] = useState("");
  const [newClientLastName, setNewClientLastName] = useState("");
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [applyCashCoefficient, setApplyCashCoefficient] = useState(false);
  const [applyTransferCoefficient, setApplyTransferCoefficient] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [rent, setRent] = useState(0);
  const [showDebtorsDialog, setShowDebtorsDialog] = useState(false);
  const [showCopyConfirmDialog, setShowCopyConfirmDialog] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<AccountingEntry>>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hideClientNames, setHideClientNames] = useState(true);

  useEffect(() => {
    // Vérifier s'il y a des modifications non sauvegardées avant de changer de mois
    if (hasUnsavedChanges) {
      const confirmChange = window.confirm("Vous avez des modifications non sauvegardées. Voulez-vous vraiment changer de mois ?");
      if (!confirmChange) {
        return;
      }
      setPendingChanges({});
      setHasUnsavedChanges(false);
    }
    
    loadData();
    // Charger le loyer depuis localStorage (valeur globale persistante)
    const savedRent = localStorage.getItem("rent_global");
    if (savedRent) {
      setRent(parseFloat(savedRent));
    } else {
      setRent(0);
    }
    
    // Vérifier s'il y a un backup pour ce mois
    const backupKey = `backup_${format(currentMonth, "yyyy-MM")}`;
    const backup = localStorage.getItem(backupKey);
    setHasBackup(!!backup);
  }, [currentMonth]);

  const handleRentChange = (value: number) => {
    setRent(value);
    // Sauvegarder dans localStorage (valeur globale persistante)
    localStorage.setItem("rent_global", value.toString());
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Charger les clients internes (athlètes du coach)
      const { data: relationships, error: relError } = await supabase
        .from("coach_athlete_relationships")
        .select("athlete_id")
        .eq("coach_id", session.user.id)
        .eq("status", "approved");

      console.log("Relationships:", relationships, "Error:", relError);

      let internalClients: Client[] = [];
      if (relationships && relationships.length > 0) {
        const athleteIds = relationships.map(r => r.athlete_id);
        const { data: profiles, error: profilesError } = await supabase
          .from("user_profiles")
          .select("id, first_name, last_name")
          .in("id", athleteIds);

        console.log("Profiles:", profiles, "Error:", profilesError);

        if (profiles) {
          internalClients = profiles.map(p => ({
            id: p.id,
            first_name: p.first_name || "",
            last_name: p.last_name || "",
            is_external: false
          }));
        }
      }

      // Charger les clients externes actifs uniquement
      const { data: externalClients, error: extError } = await supabase
        .from("external_clients")
        .select("*")
        .eq("coach_id", session.user.id)
        .eq("is_active", true);

      console.log("External clients:", externalClients, "Error:", extError);

      // Combiner les clients
      const allClients: Client[] = [
        ...internalClients,
        ...(externalClients?.map(c => ({
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          is_external: true
        })) || [])
      ];

      console.log("All clients:", allClients);
      setClients(allClients);

      // Charger les entrées comptables du mois
      const monthStr = format(currentMonth, "yyyy-MM-01");
      let { data: entriesData } = await supabase
        .from("accounting_entries")
        .select(`
          *,
          user_profiles!accounting_entries_client_id_fkey (first_name, last_name),
          external_clients (first_name, last_name)
        `)
        .eq("coach_id", session.user.id)
        .eq("month", monthStr);

      // Créer automatiquement des entrées UNIQUEMENT s'il n'y en a aucune pour ce mois
      if (!entriesData || entriesData.length === 0) {
        if (allClients.length > 0) {
          const newEntries = allClients.map(client => ({
            coach_id: session.user.id,
            [client.is_external ? "external_client_id" : "client_id"]: client.id,
            month: monthStr,
            sessions_planned: 0,
            sessions_done: 0,
            sessions_paid: 0,
            payment_type: "espèces",
            amount_cash: 0,
            amount_transfer: 0
          }));

          await supabase.from("accounting_entries").insert(newEntries);

          // Recharger les entrées après l'insertion
          const { data: updatedEntriesData } = await supabase
            .from("accounting_entries")
            .select(`
              *,
              user_profiles!accounting_entries_client_id_fkey (first_name, last_name),
              external_clients (first_name, last_name)
            `)
            .eq("coach_id", session.user.id)
            .eq("month", monthStr);

          entriesData = updatedEntriesData;
        }
      }

      // Calculer les différences hebdomadaires pour chaque client
      const now = new Date();
      const currentWeekMonday = getMondayOfWeek(now);

      const formattedEntries: AccountingEntry[] = await Promise.all(
        (entriesData || []).map(async (entry) => {
          let weeklyDiff = 0;

          // Vérifier si c'est lundi (jour 1) ou si la baseline n'a jamais été mise à jour
          const isMonday = now.getDay() === 1;
          const needsBaselineUpdate = !entry.weekly_baseline_updated_at || 
            new Date(entry.weekly_baseline_updated_at) < currentWeekMonday ||
            isMonday;

          // Si c'est lundi ou si la baseline est obsolète, mettre à jour la baseline
          if (needsBaselineUpdate) {
            await supabase
              .from("accounting_entries")
              .update({
                weekly_baseline_sessions_done: entry.sessions_done,
                weekly_baseline_updated_at: now.toISOString()
              })
              .eq("id", entry.id);
            
            // La différence est 0 car on vient de réinitialiser
            weeklyDiff = 0;
          } else {
            // Calculer la différence par rapport à la baseline
            weeklyDiff = (entry.sessions_done || 0) - (entry.weekly_baseline_sessions_done || 0);
          }

          return {
            id: entry.id,
            client_id: entry.client_id,
            external_client_id: entry.external_client_id,
            client_name: entry.client_id
              ? `${entry.user_profiles?.first_name} ${entry.user_profiles?.last_name}`
              : `${entry.external_clients?.first_name} ${entry.external_clients?.last_name}`,
            sessions_planned: entry.sessions_planned || 0,
            sessions_done: entry.sessions_done || 0,
            sessions_paid: entry.sessions_paid || 0,
            payment_type: entry.payment_type || "",
            amount_cash: parseFloat(entry.amount_cash) || 0,
            amount_transfer: parseFloat(entry.amount_transfer) || 0,
            notes: entry.notes,
            weekly_difference: weeklyDiff
          };
        })
      );

      // Trier par ordre alphabétique du nom
      formattedEntries.sort((a, b) => a.client_name.localeCompare(b.client_name));

      setEntries(formattedEntries);
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const addExternalClient = async () => {
    if (!newClientFirstName.trim() || !newClientLastName.trim()) {
      toast.error("Veuillez remplir le nom et prénom");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("external_clients")
        .insert({
          coach_id: session.user.id,
          first_name: newClientFirstName.trim(),
          last_name: newClientLastName.trim()
        });

      if (error) throw error;

      toast.success("Client externe ajouté");
      setNewClientFirstName("");
      setNewClientLastName("");
      setShowAddClientDialog(false);
      loadData();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'ajout du client");
    }
  };

  const addEntry = async (clientId: string, isExternal: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const monthStr = format(currentMonth, "yyyy-MM-01");

      const { error } = await supabase
        .from("accounting_entries")
        .insert({
          coach_id: session.user.id,
          [isExternal ? "external_client_id" : "client_id"]: clientId,
          month: monthStr,
          sessions_planned: 0,
          sessions_done: 0,
          sessions_paid: 0,
          payment_type: "espèces",
          amount_cash: 0,
          amount_transfer: 0
        });

      if (error) throw error;

      toast.success("Entrée ajoutée");
      loadData();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'ajout de l'entrée");
    }
  };

  const updateEntry = (entryId: string, field: string, value: any) => {
    // Mise à jour locale uniquement
    setEntries(prev => prev.map(e => 
      e.id === entryId ? { ...e, [field]: value } : e
    ));

    // Stocker les modifications en attente
    setPendingChanges(prev => ({
      ...prev,
      [entryId]: {
        ...(prev[entryId] || {}),
        [field]: value
      }
    }));
    
    setHasUnsavedChanges(true);
  };

  const saveAllChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) {
      toast.info("Aucune modification à sauvegarder");
      return;
    }

    try {
      // Sauvegarder toutes les modifications en une fois
      const updates = Object.entries(pendingChanges).map(([entryId, changes]) => 
        supabase
          .from("accounting_entries")
          .update(changes)
          .eq("id", entryId)
      );

      await Promise.all(updates);

      toast.success(`${Object.keys(pendingChanges).length} modification(s) sauvegardée(s)`);
      setPendingChanges({});
      setHasUnsavedChanges(false);
      await loadData();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la sauvegarde");
      await loadData();
    }
  };

  const deleteEntry = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from("accounting_entries")
        .delete()
        .eq("id", entryId);

      if (error) throw error;

      toast.success("Entrée supprimée");
      loadData();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const copyFromPreviousMonth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const previousMonth = subMonths(currentMonth, 1);
      const previousMonthStr = format(previousMonth, "yyyy-MM-01");
      const currentMonthStr = format(currentMonth, "yyyy-MM-01");

      // Sauvegarder les données actuelles avant de copier
      const { data: currentEntries } = await supabase
        .from("accounting_entries")
        .select("*")
        .eq("coach_id", session.user.id)
        .eq("month", currentMonthStr);

      if (currentEntries && currentEntries.length > 0) {
        const backupKey = `backup_${format(currentMonth, "yyyy-MM")}`;
        localStorage.setItem(backupKey, JSON.stringify(currentEntries));
        setHasBackup(true);
      }

      // Récupérer les entrées du mois précédent
      const { data: previousEntries, error: fetchError } = await supabase
        .from("accounting_entries")
        .select("*")
        .eq("coach_id", session.user.id)
        .eq("month", previousMonthStr);

      if (fetchError) throw fetchError;

      if (!previousEntries || previousEntries.length === 0) {
        toast.error("Aucune donnée trouvée pour le mois précédent");
        return;
      }

      // Créer les nouvelles entrées pour le mois actuel
      const newEntries = previousEntries.map(entry => ({
        coach_id: session.user.id,
        client_id: entry.client_id,
        external_client_id: entry.external_client_id,
        month: currentMonthStr,
        sessions_planned: entry.sessions_planned,
        sessions_done: 0,
        sessions_paid: 0,
        payment_type: entry.payment_type,
        amount_cash: 0,
        amount_transfer: 0
      }));

      // Supprimer les entrées existantes du mois actuel pour éviter les doublons
      await supabase
        .from("accounting_entries")
        .delete()
        .eq("coach_id", session.user.id)
        .eq("month", currentMonthStr);

      // Insérer les nouvelles entrées
      const { error: insertError } = await supabase
        .from("accounting_entries")
        .insert(newEntries);

      if (insertError) throw insertError;

      toast.success("Données copiées depuis le mois précédent");
      setShowCopyConfirmDialog(false);
      setPendingChanges({});
      setHasUnsavedChanges(false);
      loadData();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la copie des données");
    }
  };

  const restoreBackup = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const backupKey = `backup_${format(currentMonth, "yyyy-MM")}`;
      const backupData = localStorage.getItem(backupKey);

      if (!backupData) {
        toast.error("Aucune sauvegarde trouvée");
        return;
      }

      const currentMonthStr = format(currentMonth, "yyyy-MM-01");
      const backupEntries = JSON.parse(backupData);

      // Supprimer les entrées actuelles
      await supabase
        .from("accounting_entries")
        .delete()
        .eq("coach_id", session.user.id)
        .eq("month", currentMonthStr);

      // Restaurer les entrées sauvegardées (sans les IDs pour éviter les conflits)
      const entriesToRestore = backupEntries.map((entry: any) => {
        const { id, created_at, updated_at, ...rest } = entry;
        return rest;
      });

      const { error } = await supabase
        .from("accounting_entries")
        .insert(entriesToRestore);

      if (error) throw error;

      // Supprimer le backup après restauration
      localStorage.removeItem(backupKey);
      setHasBackup(false);
      setPendingChanges({});
      setHasUnsavedChanges(false);

      toast.success("Données restaurées avec succès");
      loadData();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la restauration des données");
    }
  };

  const cashTotal = entries.reduce((sum, e) => sum + e.amount_cash, 0);
  const transferTotal = entries.reduce((sum, e) => sum + e.amount_transfer, 0);
  
  // Calculer le montant URSSAF (0.24 du total si les coefficients sont activés)
  const ursaffAmount = (applyCashCoefficient ? cashTotal * 0.24 : 0) + (applyTransferCoefficient ? transferTotal * 0.24 : 0);
  
  // Calculer l'estimation de salaire basée sur les séances prévues (après déduction URSAFF et loyer)
  const estimatedSalary = (entries.reduce((sum, e) => sum + e.sessions_planned, 0) * 60 * 0.76) - rent;
  
  const totals = {
    cash: applyCashCoefficient ? cashTotal * 0.76 : cashTotal,
    transfer: applyTransferCoefficient ? transferTotal * 0.76 : transferTotal,
    total: (applyCashCoefficient ? cashTotal * 0.76 : cashTotal) + (applyTransferCoefficient ? transferTotal * 0.76 : transferTotal) - rent,
    ursaff: ursaffAmount,
    estimatedSalary,
    sessionsPlanned: entries.reduce((sum, e) => sum + e.sessions_planned, 0),
    sessionsDone: entries.reduce((sum, e) => sum + e.sessions_done, 0),
    sessionsPaid: entries.reduce((sum, e) => sum + e.sessions_paid, 0)
  };

  // Calculer le nombre de clients débiteurs
  const debtorsCount = entries.filter(e => e.sessions_done > e.sessions_paid).length;
  const debtorsList = entries.filter(e => e.sessions_done > e.sessions_paid);

  // Filtrer et trier les entrées selon la recherche
  const filteredEntries = entries
    .filter(entry => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return entry.client_name.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (!searchQuery.trim()) return 0;
      const query = searchQuery.toLowerCase();
      const aMatches = a.client_name.toLowerCase().includes(query);
      const bMatches = b.client_name.toLowerCase().includes(query);
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return 0;
    });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && hasUnsavedChanges) {
      e.preventDefault();
      saveAllChanges();
    }
  };

  return (
    <div 
      className="container mx-auto p-2 md:p-4 space-y-4 md:space-y-6"
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Comptabilité</h1>
        
        <div className="flex items-center gap-2 md:gap-4">
          <Button
            variant="outline"
            size={isMobile ? "sm" : "default"}
            onClick={() => navigate("/coach/suivi-salaire")}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {isMobile ? "Salaire" : "Suivi du salaire"}
          </Button>
          
          <Button
            variant="outline"
            size={isMobile ? "sm" : "icon"}
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-sm md:text-lg font-medium min-w-[120px] md:min-w-[150px] text-center">
            {format(currentMonth, isMobile ? "MMM yyyy" : "MMMM yyyy", { locale: fr })}
          </span>
          
          <Button
            variant="outline"
            size={isMobile ? "sm" : "icon"}
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {hasBackup && (
            <Button
              variant="outline"
              size={isMobile ? "sm" : "default"}
              onClick={restoreBackup}
              className="text-orange-600 border-orange-600 hover:bg-orange-50 text-xs md:text-sm"
            >
              <Copy className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              {isMobile ? "Annuler copie" : "Annuler la dernière copie"}
            </Button>
          )}
          
          <Button
            variant="outline"
            size={isMobile ? "sm" : "default"}
            onClick={() => setShowCopyConfirmDialog(true)}
            className="text-xs md:text-sm"
          >
            <Copy className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
            {isMobile ? "Copier mois préc." : "Copier du mois précédent"}
          </Button>

          <Dialog open={showAddClientDialog} onOpenChange={setShowAddClientDialog}>
            <DialogTrigger asChild>
              <Button size={isMobile ? "sm" : "default"} className="text-xs md:text-sm">
                <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                {isMobile ? "Client ext." : "Ajouter un client externe"}
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un client externe</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Prénom</Label>
                <Input
                  value={newClientFirstName}
                  onChange={(e) => setNewClientFirstName(e.target.value)}
                  placeholder="Prénom"
                />
              </div>
              <div>
                <Label>Nom</Label>
                <Input
                  value={newClientLastName}
                  onChange={(e) => setNewClientLastName(e.target.value)}
                  placeholder="Nom"
                />
              </div>
              <Button onClick={addExternalClient} className="w-full">
                Ajouter
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Chargement...</div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Entrées du mois</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={isMobile ? "Rechercher..." : "Rechercher par nom ou prénom..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchQuery("")}
                    >
                      Effacer
                    </Button>
                  )}
                  {hasUnsavedChanges && (
                    <Button
                      onClick={saveAllChanges}
                      size={isMobile ? "sm" : "default"}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {isMobile ? "Valider" : "Valider les modifications"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDebtorsDialog(true)}
                    className="gap-2"
                  >
                    <AlertCircle className="h-4 w-4" />
                    Impayés
                    {debtorsCount > 0 && (
                      <Badge variant="destructive" className="ml-1">
                        {debtorsCount}
                      </Badge>
                    )}
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Clients à ajouter</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setHideClientNames(!hideClientNames)}
                      className="h-8"
                    >
                      {hideClientNames ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                      {hideClientNames ? "Afficher" : "Masquer"}
                    </Button>
                  </div>
                  
                  {!hideClientNames && (
                    <div className="flex gap-2 flex-wrap">
                      {clients.map(client => {
                        const hasEntry = entries.some(e => 
                          (client.is_external && e.external_client_id === client.id) ||
                          (!client.is_external && e.client_id === client.id)
                        );
                        
                        if (hasEntry) return null;
                        
                        return (
                          <Button
                            key={client.id}
                            variant="outline"
                            size="sm"
                            onClick={() => addEntry(client.id, client.is_external)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {client.first_name} {client.last_name}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Vue Desktop - Tableau */}
                {!isMobile && (
                  <div className="relative border rounded-md">
                    <div className="overflow-auto max-h-[600px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="sticky top-0 bg-background z-20 border-b shadow-sm">
                            <TableHead className="sticky left-0 top-0 bg-background z-30 border-r">Client</TableHead>
                            <TableHead className="text-center bg-background sticky top-0 z-20">Séances prévues</TableHead>
                          <TableHead className="text-center bg-background sticky top-0 z-20">Séances réalisées</TableHead>
                          <TableHead className="text-center bg-background sticky top-0 z-20">Séances payées</TableHead>
                          <TableHead className="bg-background sticky top-0 z-20">Type paiement</TableHead>
                          <TableHead className="text-right bg-background sticky top-0 z-20">Espèces (€)</TableHead>
                          <TableHead className="text-right bg-background sticky top-0 z-20">Virement (€)</TableHead>
                          <TableHead className="text-right bg-background sticky top-0 z-20">Total (€)</TableHead>
                          <TableHead className="bg-background sticky top-0 z-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEntries.map(entry => (
                          <TableRow key={entry.id}>
                            <TableCell className="font-medium sticky left-0 bg-background z-10 border-r">{entry.client_name}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                value={entry.sessions_planned}
                                onChange={(e) => updateEntry(entry.id, "sessions_planned", parseInt(e.target.value) || 0)}
                                className="w-20 text-center"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  value={entry.sessions_done}
                                  onChange={(e) => updateEntry(entry.id, "sessions_done", parseInt(e.target.value) || 0)}
                                  className="w-20 text-center"
                                />
                                {entry.weekly_difference !== undefined && (
                                  <Badge 
                                    variant={entry.weekly_difference > 0 ? "default" : entry.weekly_difference < 0 ? "secondary" : "outline"}
                                    className="flex items-center gap-1 text-xs whitespace-nowrap"
                                  >
                                    {entry.weekly_difference > 0 ? (
                                      <TrendingUp className="h-3 w-3" />
                                    ) : entry.weekly_difference < 0 ? (
                                      <TrendingDown className="h-3 w-3" />
                                    ) : null}
                                    {entry.weekly_difference >= 0 ? '+' : ''}{entry.weekly_difference}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                value={entry.sessions_paid}
                                onChange={(e) => updateEntry(entry.id, "sessions_paid", parseInt(e.target.value) || 0)}
                                className="w-20 text-center"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={entry.payment_type}
                                onValueChange={(value) => updateEntry(entry.id, "payment_type", value)}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="espèces">Espèces</SelectItem>
                                  <SelectItem value="virement">Virement</SelectItem>
                                  <SelectItem value="mixte">Mixte</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {(entry.payment_type === "espèces" || entry.payment_type === "mixte") ? (
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={entry.amount_cash}
                                  onChange={(e) => updateEntry(entry.id, "amount_cash", parseFloat(e.target.value) || 0)}
                                  className="w-24 text-right"
                                />
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {(entry.payment_type === "virement" || entry.payment_type === "mixte") ? (
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={entry.amount_transfer}
                                  onChange={(e) => updateEntry(entry.id, "amount_transfer", parseFloat(e.target.value) || 0)}
                                  className="w-24 text-right"
                                />
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {(entry.amount_cash + entry.amount_transfer).toFixed(2)} €
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteEntry(entry.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Vue Mobile - Cartes */}
                {isMobile && (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {filteredEntries.map(entry => (
                      <Card key={entry.id} className="border shadow-sm">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <h3 className="font-semibold text-base">{entry.client_name}</h3>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteEntry(entry.id)}
                              className="h-8 w-8 -mt-1 -mr-2"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Séances prévues</Label>
                              <Input
                                type="number"
                                min="0"
                                value={entry.sessions_planned}
                                onChange={(e) => updateEntry(entry.id, "sessions_planned", parseInt(e.target.value) || 0)}
                                className="h-9 text-center"
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Séances payées</Label>
                              <Input
                                type="number"
                                min="0"
                                value={entry.sessions_paid}
                                onChange={(e) => updateEntry(entry.id, "sessions_paid", parseInt(e.target.value) || 0)}
                                className="h-9 text-center"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Séances réalisées</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                value={entry.sessions_done}
                                onChange={(e) => updateEntry(entry.id, "sessions_done", parseInt(e.target.value) || 0)}
                                className="h-9 text-center flex-1"
                              />
                              {entry.weekly_difference !== undefined && (
                                <Badge 
                                  variant={entry.weekly_difference > 0 ? "default" : entry.weekly_difference < 0 ? "secondary" : "outline"}
                                  className="flex items-center gap-1 text-xs"
                                >
                                  {entry.weekly_difference > 0 ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : entry.weekly_difference < 0 ? (
                                    <TrendingDown className="h-3 w-3" />
                                  ) : null}
                                  {entry.weekly_difference >= 0 ? '+' : ''}{entry.weekly_difference}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Type de paiement</Label>
                            <Select
                              value={entry.payment_type}
                              onValueChange={(value) => updateEntry(entry.id, "payment_type", value)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="espèces">Espèces</SelectItem>
                                <SelectItem value="virement">Virement</SelectItem>
                                <SelectItem value="mixte">Mixte</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {(entry.payment_type === "espèces" || entry.payment_type === "mixte") && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Montant espèces (€)</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={entry.amount_cash}
                                onChange={(e) => updateEntry(entry.id, "amount_cash", parseFloat(e.target.value) || 0)}
                                className="h-9"
                              />
                            </div>
                          )}

                          {(entry.payment_type === "virement" || entry.payment_type === "mixte") && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Montant virement (€)</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={entry.amount_transfer}
                                onChange={(e) => updateEntry(entry.id, "amount_transfer", parseFloat(e.target.value) || 0)}
                                className="h-9"
                              />
                            </div>
                          )}

                          <div className="pt-2 border-t flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Total</span>
                            <span className="text-lg font-bold">
                              {(entry.amount_cash + entry.amount_transfer).toFixed(2)} €
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Récapitulatif du mois</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">Total espèces</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">×0.76</span>
                      <Switch
                        checked={applyCashCoefficient}
                        onCheckedChange={setApplyCashCoefficient}
                      />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{totals.cash.toFixed(2)} €</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">Total virements</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">×0.76</span>
                      <Switch
                        checked={applyTransferCoefficient}
                        onCheckedChange={setApplyTransferCoefficient}
                      />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{totals.transfer.toFixed(2)} €</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Total général</p>
                  <p className="text-2xl font-bold">{totals.total.toFixed(2)} €</p>
                </div>
                
                {totals.ursaff > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Paiement à l'URSSAF</p>
                    <p className="text-2xl font-bold text-orange-600">{totals.ursaff.toFixed(2)} €</p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="rent" className="text-sm text-muted-foreground">Loyer</Label>
                  <Input
                    id="rent"
                    type="number"
                    min="0"
                    step="0.01"
                    value={rent}
                    onChange={(e) => handleRentChange(parseFloat(e.target.value) || 0)}
                    className="text-2xl font-bold h-auto py-2"
                  />
                </div>
                
                <div className="space-y-2 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Estimation salaire (séances prévues × 60 × 0.76)</p>
                  <p className="text-2xl font-bold text-blue-600">{totals.estimatedSalary.toFixed(2)} €</p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Séances prévues</p>
                  <p className="text-2xl font-bold">{totals.sessionsPlanned}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Séances réalisées</p>
                  <p className="text-2xl font-bold">{totals.sessionsDone}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Séances payées</p>
                  <p className="text-2xl font-bold">{totals.sessionsPaid}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialog pour afficher les clients avec impayés */}
      <Dialog open={showDebtorsDialog} onOpenChange={setShowDebtorsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Clients avec impayés ({debtorsCount})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-2">
            {debtorsList.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun client avec des impayés
              </p>
            ) : (
              <div className="space-y-3">
                {debtorsList.map(debtor => (
                  <Card key={debtor.id} className="border-orange-200 dark:border-orange-900">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-orange-600" />
                            <h3 className="font-semibold text-lg">{debtor.client_name}</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Séances réalisées</p>
                              <p className="font-semibold">{debtor.sessions_done}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Séances payées</p>
                              <p className="font-semibold">{debtor.sessions_paid}</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Séances impayées</p>
                          <p className="text-2xl font-bold text-orange-600">
                            {debtor.sessions_done - debtor.sessions_paid}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            ≈ {((debtor.sessions_done - debtor.sessions_paid) * 60).toFixed(2)} €
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation pour copier du mois précédent */}
      <AlertDialog open={showCopyConfirmDialog} onOpenChange={setShowCopyConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copier du mois précédent ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va supprimer toutes les données actuelles du mois et les remplacer par les données du mois précédent.
              <br /><br />
              <strong>Une sauvegarde sera créée automatiquement</strong> et vous pourrez annuler cette action si besoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={copyFromPreviousMonth}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
