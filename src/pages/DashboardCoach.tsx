import { useEffect, useState } from "react";
import { useNavigate, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CoachSidebar } from "@/components/CoachSidebar";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachDailyPaymentReminder } from "@/hooks/useCoachDailyPaymentReminder";
import { CoachPaymentReminderDialog } from "@/components/CoachPaymentReminderDialog";
import { useCoachPauseReminders } from "@/hooks/useCoachPauseReminders";
import { CoachPauseReminderAlert } from "@/components/CoachPauseReminderAlert";
import MesClients from "./coach/MesClients";
import BibliothequeExercices from "./coach/BibliothequeExercices";
import ClientDetail from "./coach/ClientDetail";
import Profil from "./coach/Profil";
import Messagerie from "./coach/Messagerie";
import Questions from "./coach/Questions";
import Comptabilite from "./coach/Comptabilite";
import SuiviSalaire from "./coach/SuiviSalaire";
import Notes from "./coach/Notes";
import Agenda from "./coach/Agenda";

export default function DashboardCoach() {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const { profile } = useUserProfile();
  const { session, loading: authLoading } = useAuth();
  const { shouldShowReminder, isChecking, handleDismiss } = useCoachDailyPaymentReminder();
  const { reminders: pauseReminders, dismissReminder: dismissPauseReminder } = useCoachPauseReminders(profile?.id);

  useEffect(() => {
    // Attendre que l'authentification soit chargée
    if (authLoading) return;

    const checkAccess = async () => {
      if (!session) {
        navigate("/auth");
        return;
      }

      // Vérifier que l'utilisateur est bien un coach approuvé
      const { data: profileData, error } = await supabase
        .from("user_profiles")
        .select("approved, role")
        .eq("id", session.user.id)
        .single();

      if (error || !profileData) {
        toast.error("Erreur lors du chargement du profil");
        navigate("/auth");
        return;
      }

      if (!profileData.approved) {
        navigate("/en-attente");
        return;
      }

      if (profileData.role !== "coach") {
        navigate("/sportif/seances");
        return;
      }
    };

    checkAccess();
  }, [session, authLoading, navigate]);

  useEffect(() => {
    const loadPendingRequests = async () => {
      if (!profile?.id) return;

      const { data, error } = await supabase
        .from("coach_athlete_relationships")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", profile.id)
        .eq("status", "pending");

      if (!error && data !== null) {
        setPendingCount(data.length || 0);
      }
    };

    loadPendingRequests();
  }, [profile]);

  if (authLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-foreground">Chargement...</p>
      </div>
    );
  }

  const firstName = profile?.first_name || "Coach";

  return (
    <>
      <CoachPaymentReminderDialog
        open={shouldShowReminder && !isChecking}
        onDismiss={handleDismiss}
      />
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
        <CoachSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b flex items-center px-4 bg-background justify-between">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h2 className="font-semibold">Salut {firstName} 👋</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Prêt à accompagner tes athlètes aujourd'hui ?
            </p>
          </header>
          <main className="flex-1 p-6">
            {pauseReminders.length > 0 && (
              <div className="mb-6">
                <CoachPauseReminderAlert
                  reminders={pauseReminders}
                  onDismiss={dismissPauseReminder}
                />
              </div>
            )}
            {pendingCount > 0 && (
              <Alert className="mb-6 border-primary bg-primary/10">
                <Bell className="h-5 w-5 text-primary" />
                <AlertTitle className="text-lg font-semibold">
                  Tu as {pendingCount} nouvelle{pendingCount > 1 ? "s" : ""} demande{pendingCount > 1 ? "s" : ""} !
                </AlertTitle>
                <AlertDescription className="mt-2 flex items-center justify-between">
                  <span>
                    Des athlètes aimeraient que tu sois leur coach
                  </span>
                  <Button onClick={() => navigate("/coach/mes-clients")} size="sm">
                    Voir les demandes
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <Routes>
              <Route path="/" element={<Navigate to="/coach/mes-clients" replace />} />
              <Route path="/mes-clients" element={<MesClients />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/client/:athleteId" element={<ClientDetail />} />
              <Route path="/messagerie" element={<Messagerie />} />
              <Route path="/questions" element={<Questions />} />
              <Route path="/bibliotheque-exercices" element={<BibliothequeExercices />} />
              <Route path="/comptabilite" element={<Comptabilite />} />
              <Route path="/suivi-salaire" element={<SuiviSalaire />} />
              <Route path="/profil" element={<Profil />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
    </>
  );
}
