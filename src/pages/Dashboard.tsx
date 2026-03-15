import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      navigate("/auth", { replace: true });
      return;
    }

    const checkUserApproval = async () => {
      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("approved, role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        toast.error("Vérification du profil en cours, merci de patienter.");
        return;
      }

      if (!profile?.approved) {
        navigate("/en-attente", { replace: true });
        return;
      }

      navigate(profile.role === "coach" ? "/coach/dashboard" : "/sportif/dashboard", {
        replace: true,
      });
    };

    checkUserApproval();
  }, [session, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-foreground">Chargement...</p>
      </div>
    );
  }

  return null;
}
