import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    const checkUserApproval = async () => {
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }

      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("approved, role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Erreur vérification accès dashboard:", error);
        setLoading(false);
        return;
      }

      if (!profile) {
        console.warn("Profil dashboard temporairement introuvable, conservation de session.");
        setLoading(false);
        return;
      }

      if (!profile.approved) {
        navigate("/en-attente", { replace: true });
        return;
      }

      if (profile.role === "coach") {
        navigate("/coach/dashboard", { replace: true });
      } else {
        navigate("/sportif/dashboard", { replace: true });
      }
    };

    void checkUserApproval().finally(() => setLoading(false));
  }, [authLoading, navigate, session]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-foreground">Chargement...</p>
      </div>
    );
  }

  return null;
}

