import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { UserCheck, UserX, Clock } from "lucide-react";

const profileSchema = z.object({
  first_name: z.string().trim().min(1, "Le prénom est requis").max(100),
  last_name: z.string().trim().min(1, "Le nom est requis").max(100),
  date_of_birth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface Coach {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface CoachRelationship {
  id: string;
  coach_id: string;
  status: 'pending' | 'approved' | 'rejected';
  coach: Coach;
}

export default function Profil() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [currentRelationship, setCurrentRelationship] = useState<CoachRelationship | null>(null);
  const [loadingCoaches, setLoadingCoaches] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      date_of_birth: "",
      gender: undefined,
    },
  });

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("email, first_name, last_name, date_of_birth, gender")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setEmail(profile.email);
        form.reset({
          first_name: profile.first_name || "",
          last_name: profile.last_name || "",
          date_of_birth: profile.date_of_birth || "",
          gender: profile.gender || undefined,
        });
      }

      // Charger la relation coach actuelle
      const relationship = await loadCoachRelationship(session.user.id);
      
      // Si pas de relation existante, charger les coaches disponibles
      if (!relationship) {
        await loadAvailableCoaches();
      }
      
      setLoading(false);
    };

    loadProfile();
  }, [navigate, form]);

  const loadCoachRelationship = async (athleteId: string) => {
    const { data } = await supabase
      .from("coach_athlete_relationships")
      .select("id, coach_id, status")
      .eq("athlete_id", athleteId)
      .in("status", ["pending", "approved"])
      .maybeSingle();

    if (data) {
      // Charger les infos du coach séparément
      const { data: coachData } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, email")
        .eq("id", data.coach_id)
        .single();

      if (coachData) {
        setCurrentRelationship({
          ...data,
          coach: coachData
        } as any);
      }
    }
    
    return data;
  };

  const loadAvailableCoaches = async () => {
    setLoadingCoaches(true);
    const { data } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, email")
      .eq("role", "coach")
      .eq("approved", true)
      .order("first_name");

    if (data) {
      setCoaches(data);
    }
    setLoadingCoaches(false);
  };

  const handleRequestCoach = async (coachId: string) => {
    try {
      const { error } = await supabase
        .from("coach_athlete_relationships")
        .insert({
          athlete_id: userId,
          coach_id: coachId,
          status: "pending",
        });

      if (error) throw error;

      toast.success("Demande envoyée au coach avec succès !");
      await loadCoachRelationship(userId);
    } catch (error: any) {
      toast.error("Erreur lors de l'envoi de la demande");
      console.error(error);
    }
  };

  const handleCancelRequest = async () => {
    if (!currentRelationship) return;

    try {
      const { error } = await supabase
        .from("coach_athlete_relationships")
        .delete()
        .eq("id", currentRelationship.id);

      if (error) throw error;

      toast.success("Demande annulée");
      setCurrentRelationship(null);
    } catch (error: any) {
      toast.error("Erreur lors de l'annulation");
      console.error(error);
    }
  };

  const onSubmit = async (data: ProfileFormValues) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          date_of_birth: data.date_of_birth || null,
          gender: data.gender,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;

      toast.success("Profil mis à jour avec succès");
    } catch (error: any) {
      toast.error("Erreur lors de la mise à jour du profil");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erreur lors de la déconnexion");
    } else {
      toast.success("Déconnexion réussie");
      navigate("/");
    }
  };

  if (loading) {
    return <div className="text-center">Chargement...</div>;
  }

  const getStatusBadge = () => {
    if (!currentRelationship) return null;
    
    switch (currentRelationship.status) {
      case "pending":
        return <Badge variant="secondary" className="ml-2"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
      case "approved":
        return <Badge className="ml-2 bg-green-600"><UserCheck className="h-3 w-3 mr-1" />Approuvé</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="ml-2"><UserX className="h-3 w-3 mr-1" />Refusé</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Mon profil</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input value={email} disabled className="bg-muted" />
              </div>

              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Votre prénom" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Votre nom" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date_of_birth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de naissance</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        max={new Date().toISOString().split('T')[0]}
                        min="1900-01-01"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sexe</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Homme</SelectItem>
                        <SelectItem value="female">Femme</SelectItem>
                        <SelectItem value="other">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </Button>
                <Button 
                  type="button" 
                  onClick={handleLogout} 
                  variant="destructive" 
                  className="flex-1"
                >
                  Se déconnecter
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mon coach</CardTitle>
          <CardDescription>
            Choisis ton coach pour bénéficier d'un suivi personnalisé
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentRelationship ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">
                    {currentRelationship.coach.first_name} {currentRelationship.coach.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {currentRelationship.coach.email}
                  </p>
                  <div className="mt-2">
                    {getStatusBadge()}
                  </div>
                </div>
                {currentRelationship.status === "pending" && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleCancelRequest}
                  >
                    Annuler la demande
                  </Button>
                )}
              </div>
              {currentRelationship.status === "approved" && (
                <p className="text-sm text-muted-foreground">
                  🎉 Ton coach peut maintenant accéder à tes données et te suivre !
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {loadingCoaches ? (
                <p className="text-sm text-muted-foreground">Chargement des coachs...</p>
              ) : coaches.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Sélectionne un coach parmi la liste ci-dessous pour bénéficier d'un suivi personnalisé.
                  </p>
                  <div className="space-y-2">
                    {coaches.map((coach) => (
                      <div 
                        key={coach.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <p className="font-medium">
                            {coach.first_name} {coach.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {coach.email}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleRequestCoach(coach.id)}
                        >
                          Demander
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun coach disponible pour le moment.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
