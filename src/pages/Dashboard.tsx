import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserApproval = async () => {
      let { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        const { data } = await supabase.auth.refreshSession().catch(() => ({ data: { session: null } }));
        session = data.session;
      }

      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('approved, role')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        toast.error("Vérification du profil en cours, merci de patienter.");
        return;
      }

      if (!profile?.approved) {
        navigate("/en-attente");
        return;
      }

      if (profile.role === 'coach') {
        navigate("/coach/dashboard", { replace: true });
      } else {
        navigate("/sportif/dashboard", { replace: true });
      }

      setLoading(false);
    };

    checkUserApproval();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-foreground">Chargement...</p>
      </div>
    );
  }

  return null;
}
