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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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

const profileSchema = z.object({
  first_name: z.string().trim().min(1, "Le prénom est requis").max(100),
  last_name: z.string().trim().min(1, "Le nom est requis").max(100),
  date_of_birth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilCoach() {
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

  // Charger le profil
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

  // Sauvegarder les modifications
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

  // Déconnexion simple
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
      <h1 className="text-3xl font-bold">Mon profil coach</h1>

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

              {/* Date de naissance avec calendrier */}
              <FormField
                control={form.control}
                name="date_of_birth"
                render={({ field }) => {
                  const currentDate = field.value ? new Date(field.value) : undefined;
                  const [selectedYear, setSelectedYear] = useState<number | null>(
                    currentDate ? currentDate.getFullYear() : null
                  );
                  const [selectedMonth, setSelectedMonth] = useState<number | null>(
                    currentDate ? currentDate.getMonth() : null
                  );

                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date de naissance</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="w-full pl-3 text-left font-normal">
                              {field.value
                                ? format(new Date(field.value), "dd MMMM yyyy", { locale: fr })
                                : "Choisir une date"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3" align="start">
                          {/* Sélecteurs année + mois */}
                          <div className="flex justify-between items-center mb-2">
                            <Select
                              onValueChange={(val) => setSelectedYear(Number(val))}
                              value={selectedYear?.toString() ?? ""}
                            >
                              <SelectTrigger className="w-[110px]">
                                <SelectValue placeholder="Année" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[200px] overflow-y-auto">
                                {Array.from({ length: 120 }, (_, i) => {
                                  const year = new Date().getFullYear() - i;
                                  return (
                                    <SelectItem key={year} value={year.toString()}>
                                      {year}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>

                            <Select
                              onValueChange={(val) => setSelectedMonth(Number(val))}
                              value={selectedMonth?.toString() ?? ""}
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue placeholder="Mois" />
                              </SelectTrigger>
                              <SelectContent>
                                {[
                                  "janvier", "février", "mars", "avril", "mai", "juin",
                                  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
                                ].map((month, i) => (
                                  <SelectItem key={month} value={i.toString()}>
                                    {month}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Calendrier */}
                          <Calendar
                            mode="single"
                            selected={currentDate}
                            onSelect={(date) => field.onChange(date?.toISOString().split("T")[0])}
                            month={
                              selectedYear !== null && selectedMonth !== null
                                ? new Date(selectedYear, selectedMonth)
                                : currentDate
                            }
                            onMonthChange={(month) => {
                              setSelectedYear(month.getFullYear());
                              setSelectedMonth(month.getMonth());
                            }}
                            locale={fr}
                            fromYear={1900}
                            toYear={new Date().getFullYear()}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* Sexe */}
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

              {/* Actions */}
              <div className="flex flex-col gap-3 pt-4">
                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? "Enregistrement..." : "Enregistrer les modifications"}
                </Button>

                <div className="flex gap-3">
                  {/* Déconnexion simple */}
                  <Button type="button" onClick={handleLogout} variant="destructive" className="flex-1">
                    Se déconnecter
                  </Button>

                  {/* Déconnexion globale */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="outline" className="flex-1">
                        Déconnecter tous mes appareils
                      </Button>
                    </AlertDialogTrigger>

                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Déconnexion globale</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cela va te déconnecter de <strong>tous les appareils</strong> connectés à ton compte.  
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
    </div>
  );
}
