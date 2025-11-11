import { useEffect, useState } from "react";
import { useNavigate, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SportifSidebar } from "@/components/SportifSidebar";
import { useUserProfile } from "@/hooks/useUserProfile";
import { ChatBubble } from "@/components/ChatBubble";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, XCircle, Clock, X } from "lucide-react";
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
import Questions from "./sportif/Questions";
import Profil from "./sportif/Profil";

export default function DashboardSportif() {
  const navigate = useNavigate();
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [coachName, setCoachName] = useState<string>("");
  const [showApprovedAlert, setShowApprovedAlert] = useState(() => {
    const saved = localStorage.getItem('hideApprovedAlert');
    return saved !== 'true';
  });
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

  useEffect(() => {
    const loadRequestStatus = async () => {
      if (!profile?.id) return;

      const { data: relationship } = await supabase
        .from("coach_athlete_relationships")
        .select("status, coach_id")
        .eq("athlete_id", profile.id)
        .order("requested_at", { ascending: false })
        .limit(1)
        .single();

      if (relationship) {
        setRequestStatus(relationship.status);
        
        // Charger le nom du coach
        const { data: coachProfile } = await supabase
          .from("user_profiles")
          .select("first_name, last_name")
          .eq("id", relationship.coach_id)
          .single();

        if (coachProfile) {
          setCoachName(`${coachProfile.first_name} ${coachProfile.last_name}`);
        }
      }
    };

    loadRequestStatus();
  }, [profile]);

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
            {requestStatus === "approved" && showApprovedAlert && (
              <Alert className="mb-6 border-green-600 bg-green-600/10 relative">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <AlertTitle className="text-lg font-semibold text-green-600">
                  Demande acceptée !
                </AlertTitle>
                <AlertDescription>
                  {coachName} a accepté ta demande de coaching. Vous pouvez maintenant travailler ensemble !
                </AlertDescription>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-green-600/20"
                  onClick={() => {
                    setShowApprovedAlert(false);
                    localStorage.setItem('hideApprovedAlert', 'true');
                  }}
                >
                  <X className="h-4 w-4 text-green-600" />
                </Button>
              </Alert>
            )}
            {requestStatus === "rejected" && (
              <Alert className="mb-6 border-red-600 bg-red-600/10">
                <XCircle className="h-5 w-5 text-red-600" />
                <AlertTitle className="text-lg font-semibold text-red-600">
                  Demande refusée
                </AlertTitle>
                <AlertDescription>
                  {coachName} a refusé ta demande de coaching. Tu peux faire une demande à un autre coach.
                </AlertDescription>
              </Alert>
            )}
            {requestStatus === "pending" && (
              <Alert className="mb-6 border-orange-500 bg-orange-500/10">
                <Clock className="h-5 w-5 text-orange-500" />
                <AlertTitle className="text-lg font-semibold text-orange-500">
                  Demande en attente
                </AlertTitle>
                <AlertDescription>
                  Ta demande de coaching auprès de {coachName} est en cours de traitement.
                </AlertDescription>
              </Alert>
            )}
            <Routes>
              <Route path="/" element={<Navigate to="/sportif/seances" replace />} />
              <Route path="/seances" element={<Seances />} />
              <Route path="/seance/:weekId/:sessionId" element={<SeanceDetail />} />
              <Route path="/superset/:sessionId/:supersetId" element={<SupersetDetail />} />
              <Route path="/exercice/:exerciceId" element={<ExerciceDetail />} />
              <Route path="/fatigue" element={<Fatigue />} />
              <Route path="/maxes" element={<Maxes />} />
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
