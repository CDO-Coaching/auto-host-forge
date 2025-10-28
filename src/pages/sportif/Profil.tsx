import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Profil() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setEmail(profile.email);
        setUserId(session.user.id);
      }
      setLoading(false);
    };

    loadProfile();
  }, [navigate]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erreur lors de la déconnexion");
    } else {
      toast.success("Déconnexion réussie");
      navigate("/");
    }
  };

  if (loading) {
    return <div className="text-center">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Mon profil</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={email} disabled />
          </div>
          
          <div>
            <Label>ID Utilisateur</Label>
            <Input value={userId} disabled className="font-mono text-xs" />
          </div>

          <div className="pt-4">
            <Button onClick={handleLogout} variant="destructive" className="w-full">
              Se déconnecter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
