import { useEffect } from "react";
import { useNavigate, Routes, Route, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SportifSidebar } from "@/components/SportifSidebar";
import { useUserProfile } from "@/hooks/useUserProfile";
import { ChatBubble } from "@/components/ChatBubble";
import { useAuth } from "@/contexts/AuthContext";
import { useDailyFatigueCheck } from "@/hooks/useDailyFatigueCheck";
import { DailyFatigueDialog } from "@/components/DailyFatigueDialog";
import { useWeeklyWeightReminder } from "@/hooks/useWeeklyWeightReminder";
import { WeightReminderDialog } from "@/components/WeightReminderDialog";
import Seances from "./sportif/Seances";
import SeanceDetail from "./sportif/SeanceDetail";
import RecupDetail from "./sportif/RecupDetail";
import SupersetDetail from "./sportif/SupersetDetail";
import ExerciceDetail from "./sportif/ExerciceDetail";
import Fatigue from "./sportif/Fatigue";
import Maxes from "./sportif/Maxes";
import Poids from "./sportif/Poids";
import Questions from "./sportif/Questions";
import Profil from "./sportif/Profil";
import MesSeances from "./sportif/MesSeances";
import Aide from "./sportif/Aide";
import Agenda from "./sportif/Agenda";
import Meditation from "./sportif/Meditation";
import Messagerie from "./sportif/Messagerie";
import Paiement from "./sportif/Paiement";
import PaiementSucces from "./sportif/PaiementSucces";
import MesFactures from "./sportif/MesFactures";
import SportifDashboard from "./sportif/Dashboard";
import ProgrammerSeances from "./sportif/ProgrammerSeances";

export default function DashboardSportif() {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useUserProfile();
  const { session, loading: authLoading } = useAuth();
  const { shouldShowDialog, isChecking, handleClose } = useDailyFatigueCheck();
  const { shouldShowReminder: shouldShowWeightReminder, isChecking: isCheckingWeight, handleDismiss: handleWeightDismiss } = useWeeklyWeightReminder();

  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      navigate("/auth", { replace: true });
      return;
    }

    if (profileLoading) return;

    if (!profile) {
      toast.warning("Vérification du profil en cours, merci de patienter.");
      return;
    }

    if (!profile.approved) {
      navigate("/en-attente");
      return;
    }

    if (profile.role === "coach") {
      navigate("/coach/dashboard");
    }
  }, [session, authLoading, profileLoading, profile, navigate]);


  if (authLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-foreground">Chargement...</p>
      </div>
    );
  }

  const firstName = profile?.first_name || "Sportif";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <SportifSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-40 h-14 border-b flex items-center px-3 sm:px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <SidebarTrigger />
              <h2 className="font-semibold text-sm sm:text-base truncate">Salut {firstName} 👋</h2>
            </div>
            <p className="hidden sm:block text-sm text-muted-foreground whitespace-nowrap ml-2">
              Prêt à donner le meilleur de toi-même aujourd'hui ?
            </p>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6 pb-20 sm:pb-6">
            <Routes>
              <Route path="/" element={<Navigate to="/sportif/dashboard" replace />} />
              <Route path="/dashboard" element={<SportifDashboard />} />
              <Route path="/seances" element={<Seances />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/mes-seances" element={<MesSeances />} />
              <Route path="/seance/:weekId/:sessionId" element={<SeanceDetail />} />
              <Route path="/recup/:weekId/:sessionId" element={<RecupDetail />} />
              <Route path="/superset/:sessionId/:supersetId" element={<SupersetDetail />} />
              <Route path="/exercice/:exerciceId" element={<ExerciceDetail />} />
              <Route path="/fatigue" element={<Fatigue />} />
              <Route path="/maxes" element={<Maxes />} />
              <Route path="/poids" element={<Poids />} />
              <Route path="/programmer" element={<ProgrammerSeances />} />
              <Route path="/meditation" element={<Meditation />} />
              <Route path="/messagerie" element={<Messagerie />} />
              <Route path="/paiement" element={<Paiement />} />
              <Route path="/paiement-succes" element={<PaiementSucces />} />
              <Route path="/factures" element={<MesFactures />} />
              <Route path="/questions" element={<Questions />} />
              <Route path="/profil" element={<Profil />} />
              <Route path="/aide" element={<Aide />} />
            </Routes>
          </main>
        </div>
        <ChatBubble />
      </div>
      <DailyFatigueDialog 
        open={shouldShowDialog && !isChecking} 
        onClose={handleClose}
        includeInjuryQuestions={true}
        isFemale={profile?.gender === 'female'}
      />
      <WeightReminderDialog 
        open={shouldShowWeightReminder && !isCheckingWeight && !shouldShowDialog}
        onDismiss={handleWeightDismiss}
      />
    </SidebarProvider>
  );
}
