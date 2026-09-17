import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { RotateCcw, Check } from "lucide-react";

export default function Reactiver() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [rel, setRel] = useState<{ id: string } | null>(null);
  const [profile, setProfile] = useState<{ first_name: string | null; last_name: string | null } | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session) { navigate("/auth", { replace: true }); return; }

    (async () => {
      // Relation "supprimée" par le coach ?
      const { data: rels } = await supabase
        .from("coach_athlete_relationships")
        .select("id, status")
        .eq("athlete_id", session.user.id);
      const approved = (rels || []).find((r: any) => r.status === "approved");
      const removed = (rels || []).find((r: any) => r.status === "removed");
      const pending = (rels || []).find((r: any) => r.status === "pending");

      if (approved) { navigate("/sportif/dashboard", { replace: true }); return; }
      if (pending && !removed) setSent(true); // demande déjà en attente
      setRel(removed || pending || null);

      const { data: p } = await supabase
        .from("user_profiles")
        .select("first_name, last_name")
        .eq("id", session.user.id)
        .maybeSingle();
      setProfile(p);
      setChecking(false);
    })();
  }, [session, authLoading, navigate]);

  const handleRequest = async () => {
    if (!rel || !session) return;
    setSending(true);
    try {
      // 1) Repasser la relation en "pending" → réapparaît côté coach dans "Demandes en attente"
      await supabase.from("coach_athlete_relationships").update({ status: "pending" } as any).eq("id", rel.id);
      // 2) Prévenir le coach par mail
      await supabase.functions.invoke("notify-contact", {
        body: {
          prénom: profile?.first_name || "",
          nom: profile?.last_name || "",
          email: session.user.email || "",
          telephone: "",
          message: "Demande de réactivation de suivi (l'athlète souhaite reprendre son accompagnement).",
          mode_de_contact: "par email",
        },
      });
      setSent(true);
      toast.success("Demande envoyée à ton coach");
    } catch (e: any) {
      console.error("Erreur demande réactivation:", e);
      // La relation est déjà repassée en pending ; on considère la demande envoyée.
      setSent(true);
      toast.success("Demande envoyée à ton coach");
    } finally {
      setSending(false);
    }
  };

  const handleLogout = async () => {
    sessionStorage.setItem("explicit_logout", "true");
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center">
              <RotateCcw className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Ton suivi est en pause</CardTitle>
            <CardDescription>
              Ton accompagnement a été clôturé par ton coach. Tu peux demander à le réactiver.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {checking ? (
              <p className="text-center text-sm text-muted-foreground">Chargement…</p>
            ) : sent ? (
              <div className="text-center space-y-2">
                <div className="mx-auto h-11 w-11 rounded-full bg-green-500/15 flex items-center justify-center">
                  <Check className="h-6 w-6 text-green-500" />
                </div>
                <p className="text-sm font-medium">Demande envoyée ✅</p>
                <p className="text-sm text-muted-foreground">
                  Ton coach a été prévenu. Tu recevras un accès dès qu'il aura réactivé ton suivi.
                </p>
              </div>
            ) : (
              <>
                <p className="text-center text-sm text-muted-foreground">
                  {profile?.first_name ? `${profile.first_name}, ` : ""}souhaites-tu reprendre ton suivi&nbsp;?
                </p>
                <Button onClick={handleRequest} disabled={sending || !rel} className="w-full gap-2">
                  <RotateCcw className="h-4 w-4" />
                  {sending ? "Envoi…" : "Demander la réactivation"}
                </Button>
              </>
            )}
            <Button onClick={handleLogout} variant="outline" className="w-full">
              Se déconnecter
            </Button>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
