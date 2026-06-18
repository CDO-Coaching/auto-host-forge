import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceNoteAI } from "@/components/VoiceNoteAI";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, StickyNote, Calendar, User, Check, ChevronsUpDown, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  isExternal?: boolean;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
}

export default function Notes() {
  const { profile } = useUserProfile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [isExternalClient, setIsExternalClient] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  // Charger les athlètes actifs et clients externes
  useEffect(() => {
    const loadClients = async () => {
      if (!profile?.id) return;

      // Récupérer les relationships approuvées et non en pause
      const { data: relationships, error: relError } = await supabase
        .from("coach_athlete_relationships")
        .select("athlete_id")
        .eq("coach_id", profile.id)
        .eq("status", "approved")
        .neq("status", "paused");

      if (relError) {
        toast.error("Erreur lors du chargement des athlètes");
        return;
      }

      // Récupérer les profils des athlètes
      let athletesList: Client[] = [];
      if (relationships && relationships.length > 0) {
        const athleteIds = relationships.map(r => r.athlete_id);
        const { data: profiles, error: profileError } = await supabase
          .from("user_profiles")
          .select("id, first_name, last_name, email")
          .in("id", athleteIds);

        if (profileError) {
          toast.error("Erreur lors du chargement des profils");
          return;
        }

        athletesList = (profiles || []).map(p => ({
          ...p,
          isExternal: false
        }));
      }

      // Récupérer les clients externes
      const { data: externalClients, error: extError } = await supabase
        .from("external_clients")
        .select("id, first_name, last_name, email")
        .eq("coach_id", profile.id);

      if (extError) {
        console.error("Erreur clients externes:", extError);
      }

      const externalList: Client[] = (externalClients || []).map(c => ({
        ...c,
        isExternal: true
      }));

      // Combiner et trier
      const allClients = [...athletesList, ...externalList].sort((a, b) => 
        `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
      );

      setClients(allClients);

      // Auto-select client if email is in URL params
      const emailParam = searchParams.get('email');
      if (emailParam) {
        const matchingClient = allClients.find(
          c => c.email?.toLowerCase() === emailParam.toLowerCase()
        );
        if (matchingClient) {
          setSelectedClientId(matchingClient.id);
          setIsExternalClient(matchingClient.isExternal || false);
          setSearchParams({});
        }
      }
    };

    loadClients();
  }, [profile?.id]);

  // Charger les notes quand un client est sélectionné
  useEffect(() => {
    const loadNotes = async () => {
      if (!profile?.id || !selectedClientId) {
        setNotes([]);
        return;
      }

      setLoadingNotes(true);
      
      let query = supabase
        .from("coach_notes")
        .select("id, content, created_at")
        .eq("coach_id", profile.id)
        .order("created_at", { ascending: false });

      if (isExternalClient) {
        query = query.eq("external_client_id", selectedClientId);
      } else {
        query = query.eq("athlete_id", selectedClientId);
      }

      const { data, error } = await query;

      if (error) {
        toast.error("Erreur lors du chargement des notes");
      } else {
        setNotes(data || []);
      }
      setLoadingNotes(false);
    };

    loadNotes();
  }, [profile?.id, selectedClientId, isExternalClient]);

  const handleAddNote = async () => {
    if (!profile?.id || !selectedClientId || !newNote.trim()) {
      toast.error("Veuillez sélectionner un client et écrire une note");
      return;
    }

    setLoading(true);
    
    const insertData: Record<string, unknown> = {
      coach_id: profile.id,
      content: newNote.trim()
    };

    if (isExternalClient) {
      insertData.external_client_id = selectedClientId;
    } else {
      insertData.athlete_id = selectedClientId;
    }

    const { data, error } = await supabase
      .from("coach_notes")
      .insert(insertData)
      .select("id, content, created_at")
      .single();

    if (error) {
      toast.error("Erreur lors de l'ajout de la note");
    } else {
      setNotes([data, ...notes]);
      setNewNote("");
      toast.success("Note ajoutée");
    }
    setLoading(false);
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClientId(client.id);
    setIsExternalClient(client.isExternal || false);
    setComboboxOpen(false);
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <StickyNote className="h-6 w-6" />
          Notes
        </h1>
        <p className="text-muted-foreground mt-1">
          Gérez vos notes personnelles sur vos clients
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sélection client et ajout de note */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Nouvelle note
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sélectionner un client</label>
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    className="w-full justify-between"
                  >
                    {selectedClientId && selectedClient ? (
                      <span className="flex items-center gap-2">
                        {selectedClient.last_name} {selectedClient.first_name}
                        {selectedClient.isExternal && (
                          <Badge variant="outline" className="text-xs">Externe</Badge>
                        )}
                      </span>
                    ) : (
                      "Choisir un client..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher un client..." />
                    <CommandList>
                      <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                      <CommandGroup heading="Athlètes">
                        {clients.filter(c => !c.isExternal).map((client) => (
                          <CommandItem
                            key={client.id}
                            value={`${client.last_name} ${client.first_name}`}
                            onSelect={() => handleSelectClient(client)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedClientId === client.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {client.last_name} {client.first_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      <CommandGroup heading="Clients externes">
                        {clients.filter(c => c.isExternal).map((client) => (
                          <CommandItem
                            key={client.id}
                            value={`${client.last_name} ${client.first_name} externe`}
                            onSelect={() => handleSelectClient(client)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedClientId === client.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <UserCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                            {client.last_name} {client.first_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {selectedClientId && (
              <>
                <VoiceNoteAI onResult={(text) => setNewNote(text)} />
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Note du {format(new Date(), "dd MMMM yyyy", { locale: fr })}
                  </label>
                  <Textarea
                    placeholder="Écrire une note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={12}
                    className="resize-y min-h-[45vh] sm:min-h-[220px] text-base leading-relaxed"
                  />
                </div>
                <Button 
                  onClick={handleAddNote} 
                  disabled={loading || !newNote.trim()}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter la note
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Historique des notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Historique des notes
              {selectedClient && (
                <span className="text-muted-foreground font-normal text-sm ml-2 flex items-center gap-1">
                  - {selectedClient.first_name} {selectedClient.last_name}
                  {selectedClient.isExternal && (
                    <Badge variant="outline" className="text-xs">Externe</Badge>
                  )}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedClientId ? (
              <p className="text-muted-foreground text-center py-8">
                Sélectionnez un client pour voir ses notes
              </p>
            ) : loadingNotes ? (
              <p className="text-muted-foreground text-center py-8">
                Chargement...
              </p>
            ) : notes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Aucune note pour ce client
              </p>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div 
                      key={note.id} 
                      className="p-4 rounded-lg border bg-muted/30"
                    >
                      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(note.created_at), "EEEE dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
