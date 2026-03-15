import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Shield, ExternalLink, Settings, ChevronDown, ChevronUp } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/* ---------------------- Validation du profil ---------------------- */
const profileSchema = z.object({
  first_name: z.string().trim().min(1, "Le prénom est requis").max(100),
  last_name: z.string().trim().min(1, "Le nom est requis").max(100),
  date_of_birth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

/* ---------------------- Sélecteur de coach ---------------------- */
function CoachSelector({ userId }: { userId: string }) {
  const [coaches, setCoaches] = useState<any[]>([]);
  const [selectedCoach, setSelectedCoach] = useState<string>("");
  const [currentCoach, setCurrentCoach] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      // 1️⃣ Charger tous les coachs
      const { data: coachList, error: coachError } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name")
        .eq("role", "coach");

      if (coachError) console.error(coachError);
      else setCoaches(coachList || []);

      // 2️⃣ Vérifier si le sportif a déjà un coach
      const { data: relation, error: relationError } = await supabase
        .from("coach_athlete_relationships")
        .select("*, user_profiles!coach_id(first_name, last_name)")
        .eq("athlete_id", userId)
        .maybeSingle();

      if (!relationError && relation) setCurrentCoach(relation);

      setLoading(false);
    };

    loadData();
  }, [userId]);

  const handleRequest = async () => {
    if (!selectedCoach) return;

    const { error } = await supabase.from("coach_athlete_relationships").insert([
      {
        athlete_id: userId,
        coach_id: selectedCoach,
        status: "pending",
        requested_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      toast.error("Erreur lors de l'envoi de la demande");
      console.error(error);
    } else {
      toast.success("Demande envoyée au coach !");
      setCurrentCoach({ coach_id: selectedCoach, status: "pending" });
    }
  };

  if (loading) return <p>Chargement...</p>;

  if (currentCoach) {
    return (
      <div className="space-y-2">
        {currentCoach.status === "approved" ? (
          <p>
            ✅ Coach actuel :{" "}
            <strong>
              {currentCoach.user_profiles?.first_name}{" "}
              {currentCoach.user_profiles?.last_name}
            </strong>
          </p>
        ) : (
          <p>⏳ Demande en attente d’approbation</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label>Sélectionner un coach</Label>
      <Select value={selectedCoach} onValueChange={setSelectedCoach}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choisissez votre coach" />
        </SelectTrigger>
        <SelectContent>
          {coaches.map((coach) => (
            <SelectItem key={coach.id} value={coach.id}>
              {coach.first_name} {coach.last_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        onClick={handleRequest}
        disabled={!selectedCoach}
        className="w-full mt-2"
      >
        Demander un suivi
      </Button>
    </div>
  );
}

/* ---------------------- Page Profil ---------------------- */
export default function Profil() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [healthDataConsent, setHealthDataConsent] = useState(false);
  const [healthDataConsentAt, setHealthDataConsentAt] = useState<string | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      date_of_birth: "",
      gender: undefined,
    },
  });

  /* Charger les infos du profil */
  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      navigate("/auth", { replace: true });
      return;
    }

    const loadProfile = async () => {
      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("email, first_name, last_name, date_of_birth, gender, health_data_consent, health_data_consent_at")
        .eq("id", activeSession.user.id)
        .single();

      if (profile) {
        setEmail(profile.email);
        setHealthDataConsent(profile.health_data_consent || false);
        setHealthDataConsentAt(profile.health_data_consent_at || null);
        form.reset({
          first_name: profile.first_name || "",
          last_name: profile.last_name || "",
          date_of_birth: profile.date_of_birth || "",
          gender: profile.gender || undefined,
        });
      }
      setLoading(false);
    };

    loadProfile();
  }, [navigate, form]);

  /* Sauvegarde du profil */
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
      
      // Vérifier l'état d'approbation après la sauvegarde
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("approved")
        .eq("id", userId)
        .single();

      // Si le profil n'est pas encore approuvé, rediriger vers la page d'attente
      if (profile && !profile.approved) {
        setTimeout(() => {
          navigate("/en-attente");
        }, 1500);
      }
    } catch (error: any) {
      toast.error("Erreur lors de la mise à jour du profil");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  /* Déconnexion */
  const handleLogout = async () => {
    sessionStorage.setItem('explicit_logout', 'true');
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erreur lors de la déconnexion");
    } else {
      toast.success("Déconnexion réussie");
      navigate("/");
    }
  };

  if (loading) return <div className="text-center">Chargement...</div>;

  return (
    <div className="space-y-6 pb-10">
      <h1 className="text-3xl font-bold">Mon profil</h1>

      {/* Message d'information si le profil n'est pas complet */}
      {(!form.watch("first_name") || !form.watch("last_name")) && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-sm text-center">
              📝 Complète ton profil pour accéder à tes séances et continuer l'inscription
            </p>
          </CardContent>
        </Card>
      )}

      {/* ----------- Informations personnelles ----------- */}
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
                        max={new Date().toISOString().split("T")[0]}
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
                        <SelectItem value="other">Non genré</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* --- Actions de profil --- */}
<div className="flex flex-col gap-3 pt-4">
  <Button type="submit" disabled={saving} className="w-full">
    {saving ? "Enregistrement..." : "Enregistrer les modifications"}
  </Button>

  <div className="flex gap-3">
    {/* Déconnexion simple */}
    <Button
      type="button"
      onClick={handleLogout}
      variant="destructive"
      className="flex-1"
    >
      Se déconnecter
    </Button>

    {/* Déconnexion globale avec confirmation */}
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
        >
          Déconnecter tous mes appareils
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Déconnexion de tous les appareils</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action va te déconnecter de <strong>tous les appareils</strong> connectés à ton compte
            (téléphone, tablette, ordinateur, etc.).  
            Es-tu sûr de vouloir continuer ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              try {
                sessionStorage.setItem('explicit_logout', 'true');
                const { error } = await supabase.auth.signOut({ scope: "global" });
                if (error) throw error;
                toast.success("Tous tes appareils ont été déconnectés avec succès.");
              } catch (error) {
                console.error(error);
                toast.error("Erreur lors de la déconnexion globale.");
              }
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Confirmer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</div>

            </form>
          </Form>
        </CardContent>
      </Card>

      {/* ----------- Sélecteur de coach ----------- */}
      <Card>
        <CardHeader>
          <CardTitle>Mon coach</CardTitle>
        </CardHeader>
        <CardContent>
          <CoachSelector userId={userId} />
        </CardContent>
      </Card>

      {/* ----------- Paramètres avancés ----------- */}
      <Collapsible>
        <Card className="border-muted">
          <CardHeader className="pb-0">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                <CardTitle className="flex items-center gap-2 text-muted-foreground">
                  <Settings className="h-5 w-5" />
                  Paramètres avancés
                </CardTitle>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-4 space-y-4">
              {/* Section RGPD */}
              <div className="space-y-3 p-4 bg-secondary/30 rounded-lg border border-border/50">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium text-sm">Données de santé (RGPD)</p>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Vous avez consenti au traitement de vos données de santé (fatigue, stress, sommeil, 
                  courbatures, VMA, fréquence cardiaque) à des fins d'adaptation de vos entraînements.
                </p>

                {healthDataConsent ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Statut :</span>
                      <span className="text-green-500 font-medium">✓ Consentement actif</span>
                    </div>
                    {healthDataConsentAt && (
                      <p className="text-xs text-muted-foreground">
                        Consenti le {new Date(healthDataConsentAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    )}
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full text-xs text-muted-foreground">
                          Retirer mon consentement
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Retirer le consentement aux données de santé</AlertDialogTitle>
                          <AlertDialogDescription className="space-y-2">
                            <p>
                              En retirant votre consentement, votre coach ne pourra plus collecter ni traiter 
                              vos données de santé (fatigue, stress, sommeil, etc.) pour adapter vos entraînements.
                            </p>
                            <p>
                              <strong>Note :</strong> Le retrait du consentement n'affecte pas la licéité du 
                              traitement effectué avant ce retrait.
                            </p>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => {
                              const now = new Date().toISOString();
                              const { error } = await supabase
                                .from("user_profiles")
                                .update({
                                  health_data_consent: false,
                                  health_data_consent_at: now,
                                })
                                .eq("id", userId);
                              
                              if (error) {
                                toast.error("Erreur lors du retrait du consentement");
                                return;
                              }
                              
                              // Récupérer les infos du profil pour l'email
                              const { data: profile } = await supabase
                                .from("user_profiles")
                                .select("first_name, last_name, email")
                                .eq("id", userId)
                                .single();

                              // Notifier le coach par email
                              try {
                                await supabase.functions.invoke("notify-consent-withdrawal", {
                                  body: {
                                    userEmail: profile?.email || email,
                                    userName: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Utilisateur",
                                    withdrawalDate: now,
                                  },
                                });
                              } catch (err) {
                                console.error("Erreur notification email:", err);
                              }
                              
                              setHealthDataConsent(false);
                              setHealthDataConsentAt(now);
                              toast.success("Consentement retiré - votre coach a été notifié");
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Confirmer le retrait
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Statut :</span>
                      <span className="text-orange-500 font-medium">⚠ Consentement retiré</span>
                    </div>
                    {healthDataConsentAt && (
                      <p className="text-xs text-muted-foreground">
                        Retiré le {new Date(healthDataConsentAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    )}
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-xs"
                      onClick={async () => {
                        const now = new Date().toISOString();
                        const { error } = await supabase
                          .from("user_profiles")
                          .update({
                            health_data_consent: true,
                            health_data_consent_at: now,
                          })
                          .eq("id", userId);
                        
                        if (error) {
                          toast.error("Erreur lors de l'activation du consentement");
                        } else {
                          setHealthDataConsent(true);
                          setHealthDataConsentAt(now);
                          toast.success("Consentement accordé");
                        }
                      }}
                    >
                      Réactiver mon consentement
                    </Button>
                  </div>
                )}

                <Link 
                  to="/politique-rgpd" 
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Consulter la Politique RGPD complète
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
