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
import { useCoachBirthdayReminder } from "@/hooks/useCoachBirthdayReminder";
import { CoachBirthdayAlert } from "@/components/CoachBirthdayAlert";
import { useCoachPaymentNotifications } from "@/hooks/useCoachPaymentNotifications";
import { CoachAthletePaymentAlert } from "@/components/CoachAthletePaymentAlert";
import { useCoachCancellationNotifications } from "@/hooks/useCoachCancellationNotifications";
import { CoachCancellationAlert } from "@/components/CoachCancellationAlert";
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
import SeancesProgrammees from "./coach/SeancesProgrammees";
import CoachDashboard from "./coach/Dashboard";

export default function DashboardCoach() {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const { profile, loading: profileLoading } = useUserProfile();
  const { session, loading: authLoading } = useAuth();
  const { shouldShowReminder, isChecking, handleDismiss } = useCoachDailyPaymentReminder();
  const { reminders: pauseReminders, dismissReminder: dismissPauseReminder } = useCoachPauseReminders(profile?.id);
  const { pendingReminder, acknowledgeReminder } = useCoachNoteReminder();
  const { birthdayAthletes, dismissBirthday } = useCoachBirthdayReminder(profile?.id);
  const { pendingNotifications: paymentNotifications, dismissNotification: dismissPaymentNotification, dismissAll: dismissAllPayments } = useCoachPaymentNotifications(profile?.id);
  const { pendingCancellations, dismissCancellation } = useCoachCancellationNotifications(profile?.id);

  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!session) {
      navigate("/auth", { replace: true });
      return;
    }

    if (!profile) {
      toast.warning("Vérification du profil en cours, merci de patienter.");
      return;
    }

    if (!profile.approved) {
      navigate("/en-attente");
      return;
    }

    if (profile.role !== "coach") {
      navigate("/sportif/dashboard");
    }
  }, [session, authLoading, profileLoading, profile, navigate]);

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

  if (authLoading || profileLoading || !session) {
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
      <CoachNoteReminderDialog
        open={!!pendingReminder}
        clientEmail={pendingReminder?.clientEmail || ''}
        eventTitle={pendingReminder?.eventTitle || ''}
        onAcknowledge={acknowledgeReminder}
      />
      {/* Notifications flottantes empilées */}
      {(() => {
        let stackIndex = 0;
        return (
          <>
            {pauseReminders.length > 0 && (
              <CoachPauseReminderAlert
                reminders={pauseReminders}
                onDismiss={dismissPauseReminder}
                stackOffset={stackIndex++}
              />
            )}
            {paymentNotifications.length > 0 && (
              <CoachAthletePaymentAlert
                notifications={paymentNotifications}
                onDismiss={dismissPaymentNotification}
                onDismissAll={dismissAllPayments}
                stackOffset={pauseReminders.length > 0 ? stackIndex++ : stackIndex++}
              />
            )}
            {pendingCancellations.length > 0 && (
              <CoachCancellationAlert
                notifications={pendingCancellations}
                onDismiss={dismissCancellation}
                stackOffset={
                  (pauseReminders.length > 0 ? 1 : 0) +
                  (paymentNotifications.length > 0 ? 1 : 0)
                }
              />
            )}
          </>
        );
      })()}
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
        <CoachSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-40 h-14 border-b flex items-center px-3 sm:px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <SidebarTrigger />
              <h2 className="font-semibold text-sm sm:text-base truncate">Salut {firstName} 👋</h2>
            </div>
            <p className="hidden sm:block text-sm text-muted-foreground whitespace-nowrap ml-2">
              Prêt à accompagner tes athlètes aujourd'hui ?
            </p>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6 pb-20 sm:pb-6">
            {birthdayAthletes.length > 0 && (
              <div className="mb-6">
                <CoachBirthdayAlert
                  athletes={birthdayAthletes}
                  onDismiss={dismissBirthday}
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
              <Route path="/" element={<Navigate to="/coach/dashboard" replace />} />
              <Route path="/dashboard" element={<CoachDashboard />} />
              <Route path="/mes-clients" element={<MesClients />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/seances-programmees" element={<SeancesProgrammees />} />
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
