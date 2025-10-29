import { useEffect, useState } from "react";
import { useNavigate, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SportifSidebar } from "@/components/SportifSidebar";
import { useUserProfile } from "@/hooks/useUserProfile";
import Seances from "./sportif/Seances";
import Fatigue from "./sportif/Fatigue";
import Questions from "./sportif/Questions";
import Profil from "./sportif/Profil";

export default function DashboardSportif() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { profile } = useUserProfile();

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
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

      setLoading(false);
    };

    checkAccess();
  }, [navigate]);

  if (loading) {
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
              <Route path="/fatigue" element={<Fatigue />} />
              <Route path="/questions" element={<Questions />} />
              <Route path="/profil" element={<Profil />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
