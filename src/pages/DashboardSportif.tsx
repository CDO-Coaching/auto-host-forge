import { useEffect, useState } from "react";
import { useNavigate, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SportifSidebar } from "@/components/SportifSidebar";
import { useUserProfile } from "@/hooks/useUserProfile";
import { ChatBubble } from "@/components/ChatBubble";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDailyFatigueCheck } from "@/hooks/useDailyFatigueCheck";
import { DailyFatigueDialog } from "@/components/DailyFatigueDialog";
import Seances from "./sportif/Seances";
import SeanceDetail from "./sportif/SeanceDetail";
import SupersetDetail from "./sportif/SupersetDetail";
import ExerciceDetail from "./sportif/ExerciceDetail";
import Fatigue from "./sportif/Fatigue";
import Maxes from "./sportif/Maxes";
import Poids from "./sportif/Poids";
import Questions from "./sportif/Questions";
import Profil from "./sportif/Profil";
import MesSeances from "./sportif/MesSeances";

export default function DashboardSportif() {
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const { session, loading: authLoading } = useAuth();
  const { shouldShowDialog, isChecking, handleClose } = useDailyFatigueCheck();

  // Charger la préférence de suivi des blessures
  const [injuryTrackingEnabled, setInjuryTrackingEnabled] = useState(false);
  
  useEffect(() => {
    const loadInjuryPref = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const pref = localStorage.getItem(`injury_tracking_${user.id}`);
        setInjuryTrackingEnabled(pref === 'true');
      }
    };
    loadInjuryPref();
  }, []);

  // Recharger la préférence quand le dialog doit s'ouvrir
  useEffect(() => {
    if (shouldShowDialog && !isChecking) {
      const loadInjuryPref = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const pref = localStorage.getItem(`injury_tracking_${user.id}`);
          setInjuryTrackingEnabled(pref === 'true');
        }
      };
      loadInjuryPref();
    }
  }, [shouldShowDialog, isChecking]);

  useEffect(() => {
    // Attendre que l'authentification soit chargée
    if (authLoading) return;

    const checkAccess = async () => {
      if (!session) {
        navigate("/auth");
        return;
      }

      // Vérifier que l'utilisateur est bien un sportif approuvé
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

      if (profileData.role === "coach") {
        navigate("/coach/programmation");
        return;
      }
    };

    checkAccess();
  }, [session, authLoading, navigate]);


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
          <header className="h-14 border-b flex items-center px-4 bg-background justify-between">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h2 className="font-semibold">Salut {firstName} 👋</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Prêt à donner le meilleur de toi-même aujourd'hui ?
            </p>
          </header>
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/sportif/seances" replace />} />
              <Route path="/seances" element={<Seances />} />
              <Route path="/mes-seances" element={<MesSeances />} />
              <Route path="/seance/:weekId/:sessionId" element={<SeanceDetail />} />
              <Route path="/superset/:sessionId/:supersetId" element={<SupersetDetail />} />
              <Route path="/exercice/:exerciceId" element={<ExerciceDetail />} />
              <Route path="/fatigue" element={<Fatigue />} />
              <Route path="/maxes" element={<Maxes />} />
              <Route path="/poids" element={<Poids />} />
              <Route path="/questions" element={<Questions />} />
              <Route path="/profil" element={<Profil />} />
            </Routes>
          </main>
        </div>
        <ChatBubble />
      </div>
      <DailyFatigueDialog 
        open={shouldShowDialog && !isChecking} 
        onClose={handleClose}
        includeInjuryQuestions={injuryTrackingEnabled}
      />
    </SidebarProvider>
  );
}
