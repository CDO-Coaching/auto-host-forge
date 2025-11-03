import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);

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
    const loadProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

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
    } catch (error: any) {
      toast.error("Erreur lors de la mise à jour du profil");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  /* Déconnexion */
  const handleLogout = async () => {
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
                        <SelectItem value="other">Autre</SelectItem>
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
    </div>
  );
}
