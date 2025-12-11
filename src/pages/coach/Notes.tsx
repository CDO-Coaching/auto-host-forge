import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, StickyNote, Calendar, User, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface Athlete {
  id: string;
  first_name: string;
  last_name: string;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
}

export default function Notes() {
  const { profile } = useUserProfile();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  // Charger les athlètes actifs
  useEffect(() => {
    const loadAthletes = async () => {
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

      if (!relationships || relationships.length === 0) {
        setAthletes([]);
        return;
      }

      // Récupérer les profils des athlètes
      const athleteIds = relationships.map(r => r.athlete_id);
      const { data: profiles, error: profileError } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name")
        .in("id", athleteIds);

      if (profileError) {
        toast.error("Erreur lors du chargement des profils");
        return;
      }

      const athletesList = (profiles || [])
        .sort((a: Athlete, b: Athlete) => 
          `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
        );

      setAthletes(athletesList);
    };

    loadAthletes();
  }, [profile?.id]);

  // Charger les notes quand un athlète est sélectionné
  useEffect(() => {
    const loadNotes = async () => {
      if (!profile?.id || !selectedAthleteId) {
        setNotes([]);
        return;
      }

      setLoadingNotes(true);
      const { data, error } = await supabase
        .from("coach_notes")
        .select("id, content, created_at")
        .eq("coach_id", profile.id)
        .eq("athlete_id", selectedAthleteId)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Erreur lors du chargement des notes");
      } else {
        setNotes(data || []);
      }
      setLoadingNotes(false);
    };

    loadNotes();
  }, [profile?.id, selectedAthleteId]);

  const handleAddNote = async () => {
    if (!profile?.id || !selectedAthleteId || !newNote.trim()) {
      toast.error("Veuillez sélectionner un athlète et écrire une note");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("coach_notes")
      .insert({
        coach_id: profile.id,
        athlete_id: selectedAthleteId,
        content: newNote.trim()
      })
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

  const selectedAthlete = athletes.find(a => a.id === selectedAthleteId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <StickyNote className="h-6 w-6" />
          Notes
        </h1>
        <p className="text-muted-foreground mt-1">
          Gérez vos notes personnelles sur vos athlètes
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
              <label className="text-sm font-medium">Sélectionner un athlète</label>
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    className="w-full justify-between"
                  >
                    {selectedAthleteId
                      ? athletes.find((a) => a.id === selectedAthleteId)
                        ? `${athletes.find((a) => a.id === selectedAthleteId)?.last_name} ${athletes.find((a) => a.id === selectedAthleteId)?.first_name}`
                        : "Choisir un athlète..."
                      : "Choisir un athlète..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher un athlète..." />
                    <CommandList>
                      <CommandEmpty>Aucun athlète trouvé.</CommandEmpty>
                      <CommandGroup>
                        {athletes.map((athlete) => (
                          <CommandItem
                            key={athlete.id}
                            value={`${athlete.last_name} ${athlete.first_name}`}
                            onSelect={() => {
                              setSelectedAthleteId(athlete.id);
                              setComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedAthleteId === athlete.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {athlete.last_name} {athlete.first_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {selectedAthleteId && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Note du {format(new Date(), "dd MMMM yyyy", { locale: fr })}
                  </label>
                  <Textarea
                    placeholder="Écrire une note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={4}
                    className="resize-none"
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
              {selectedAthlete && (
                <span className="text-muted-foreground font-normal text-sm ml-2">
                  - {selectedAthlete.first_name} {selectedAthlete.last_name}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedAthleteId ? (
              <p className="text-muted-foreground text-center py-8">
                Sélectionnez un athlète pour voir ses notes
              </p>
            ) : loadingNotes ? (
              <p className="text-muted-foreground text-center py-8">
                Chargement...
              </p>
            ) : notes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Aucune note pour cet athlète
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
