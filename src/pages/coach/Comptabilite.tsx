import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Trash2, Save, Copy } from "lucide-react";
import { format, startOfMonth, addMonths, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";

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
}

export default function Comptabilite() {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [clients, setClients] = useState<Client[]>([]);
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddClientDialog, setShowAddClientDialog] = useState(false);
  const [newClientFirstName, setNewClientFirstName] = useState("");
  const [newClientLastName, setNewClientLastName] = useState("");
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [applyCashCoefficient, setApplyCashCoefficient] = useState(false);
  const [applyTransferCoefficient, setApplyTransferCoefficient] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentMonth]);

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

      // Charger les clients externes
      const { data: externalClients, error: extError } = await supabase
        .from("external_clients")
        .select("*")
        .eq("coach_id", session.user.id);

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

      const formattedEntries: AccountingEntry[] = entriesData?.map(entry => ({
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
        notes: entry.notes
      })) || [];

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

  const updateEntry = async (entryId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from("accounting_entries")
        .update({ [field]: value })
        .eq("id", entryId);

      if (error) throw error;

      setEntries(prev => prev.map(e => 
        e.id === entryId ? { ...e, [field]: value } : e
      ));
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
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
      loadData();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la copie des données");
    }
  };

  const cashTotal = entries.reduce((sum, e) => sum + e.amount_cash, 0);
  const transferTotal = entries.reduce((sum, e) => sum + e.amount_transfer, 0);
  
  const totals = {
    cash: applyCashCoefficient ? cashTotal * 0.76 : cashTotal,
    transfer: applyTransferCoefficient ? transferTotal * 0.76 : transferTotal,
    total: (applyCashCoefficient ? cashTotal * 0.76 : cashTotal) + (applyTransferCoefficient ? transferTotal * 0.76 : transferTotal),
    sessionsPlanned: entries.reduce((sum, e) => sum + e.sessions_planned, 0),
    sessionsDone: entries.reduce((sum, e) => sum + e.sessions_done, 0),
    sessionsPaid: entries.reduce((sum, e) => sum + e.sessions_paid, 0)
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold">Comptabilité</h1>
        
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-lg font-medium min-w-[150px] text-center">
            {format(currentMonth, "MMMM yyyy", { locale: fr })}
          </span>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={copyFromPreviousMonth}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copier du mois précédent
          </Button>

          <Dialog open={showAddClientDialog} onOpenChange={setShowAddClientDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un client externe
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
                      {entries.map(entry => (
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
                            <Input
                              type="number"
                              min="0"
                              value={entry.sessions_done}
                              onChange={(e) => updateEntry(entry.id, "sessions_done", parseInt(e.target.value) || 0)}
                              className="w-20 text-center"
                            />
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
    </div>
  );
}
