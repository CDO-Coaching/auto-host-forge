import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const profileSchema = z.object({
  first_name: z.string().trim().min(1, "Le prénom est requis").max(100),
  last_name: z.string().trim().min(1, "Le nom est requis").max(100),
  date_of_birth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  address: z.string().trim().max(500).optional(),
  siret: z.string().trim().max(20).optional(),
  phone: z.string().trim().max(20).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Profil() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
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
      address: "",
      siret: "",
      phone: "",
    },
  });

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
        .select("email, first_name, last_name, date_of_birth, gender, address, siret, phone")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setEmail(profile.email);
        form.reset({
          first_name: profile.first_name || "",
          last_name: profile.last_name || "",
          date_of_birth: profile.date_of_birth || "",
          gender: profile.gender || undefined,
          address: profile.address || "",
          siret: profile.siret || "",
          phone: profile.phone || "",
        });
      }
      setLoading(false);
    };

    loadProfile();
  }, [navigate, form]);

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
          address: data.address || null,
          siret: data.siret || null,
          phone: data.phone || null,
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
    sessionStorage.setItem('explicit_logout', 'true');
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erreur lors de la déconnexion");
    } else {
      toast.success("Déconnexion réussie");
      navigate("/");
    }
  };

  if (loading) {
    return <div className="text-center py-6 sm:py-8 text-sm">Chargement...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-0">
      <h1 className="text-2xl sm:text-3xl font-bold">Mon profil</h1>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
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
                render={({ field }) => {
                  // 👇 On commence ici par définir la date actuelle
                  const currentDate = field.value ? new Date(field.value) : undefined;

                  // 👇 Puis on initialise les états en fonction de currentDate
                  const [selectedYear, setSelectedYear] = useState<number | null>(
                    currentDate ? currentDate.getFullYear() : null,
                  );
                  const [selectedMonth, setSelectedMonth] = useState<number | null>(
                    currentDate ? currentDate.getMonth() : null,
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
                          <div className="flex justify-between items-center mb-2">
                            {/* Sélecteur d’année */}
                            <Select
                              onValueChange={(val) => setSelectedYear(Number(val))}
                              value={selectedYear?.toString() ?? currentDate?.getFullYear().toString()}
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

                            {/* Sélecteur de mois */}
                            <Select
                              onValueChange={(val) => setSelectedMonth(Number(val))}
                              value={
                                selectedMonth !== null
                                  ? selectedMonth.toString()
                                  : currentDate
                                    ? currentDate.getMonth().toString()
                                    : undefined
                              }
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue placeholder="Mois" />
                              </SelectTrigger>
                              <SelectContent>
                                {[
                                  "janvier",
                                  "février",
                                  "mars",
                                  "avril",
                                  "mai",
                                  "juin",
                                  "juillet",
                                  "août",
                                  "septembre",
                                  "octobre",
                                  "novembre",
                                  "décembre",
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

              {/* Section Facturation */}
              <div className="pt-4 border-t">
                <h3 className="text-base font-semibold mb-4">Informations de facturation</h3>
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse professionnelle</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="123 rue Example, 75001 Paris" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="siret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>N° SIRET</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="123 456 789 00012" maxLength={20} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="06 12 34 56 78" type="tel" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </Button>
                <Button type="button" onClick={handleLogout} variant="destructive" className="flex-1">
                  Se déconnecter
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
