import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import coachPortrait from "@/assets/coach-portrait-smile.jpg";
import { Phone, ClipboardList, TrendingUp, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { QuickContactForm } from "@/components/QuickContactForm";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      if (loading) return;
      
      if (user) {
        // Récupérer le profil de l'utilisateur
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role, approved, first_name, last_name')
          .eq('id', user.id)
          .single();

        if (profile) {
          // Si le profil n'est pas approuvé, rediriger vers la page d'attente
          if (!profile.approved) {
            navigate("/en-attente");
            return;
          }

          // Si le profil n'est pas complet, rediriger vers la page de profil
          if (!profile.first_name || !profile.last_name) {
            if (profile.role === 'coach') {
              navigate("/coach/profil");
            } else {
              navigate("/sportif/profil");
            }
            return;
          }

          // Restaurer la dernière page visitée si elle existe
          const lastRoute = localStorage.getItem('last_route');
          if (lastRoute && (lastRoute.startsWith('/coach') || lastRoute.startsWith('/sportif'))) {
            navigate(lastRoute);
          } else if (profile.role === 'coach') {
            navigate("/coach/programmation");
          } else {
            navigate("/sportif/dashboard");
          }
        }
      }
    };

    checkUserAndRedirect();
  }, [user, loading, navigate]);

  const steps = [
    {
      icon: <Phone className="w-8 h-8" />,
      title: "1. Appel gratuit",
      description: "20 minutes pour parler de tes objectifs et voir si on avance ensemble. Sans engagement.",
    },
    {
      icon: <ClipboardList className="w-8 h-8" />,
      title: "2. Programme sur mesure",
      description: "Je construis un plan d'entraînement adapté à ton niveau, ton emploi du temps et tes objectifs.",
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "3. Suivi & progression",
      description: "Un accompagnement régulier, des ajustements et des retours pour progresser durablement.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section — photo à gauche, contact rapide à droite */}
      <section className="relative overflow-hidden bg-background pt-28 pb-16 md:pt-36 md:pb-20">
        {/* halo doré discret */}
        <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative z-10 container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-6 md:gap-12 md:items-start">
            {/* 1. Accroche (mobile: 1er / desktop: haut-gauche) */}
            <div className="animate-fade-in">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 leading-tight">
                Atteins tes objectifs avec un{" "}
                <span className="text-primary">coach qui te suit vraiment</span>
              </h1>
              <p className="text-base md:text-lg text-muted-foreground max-w-lg">
                Programme sur mesure et accompagnement régulier, en salle ou à distance.
                Écris-moi, je te réponds vite.
              </p>
            </div>

            {/* 2. Formulaire (mobile: juste sous l'accroche / desktop: colonne droite) */}
            <div className="animate-scale-in md:row-span-2">
              <QuickContactForm />
              <div className="mt-3 text-center">
                <Link to="/coaching" className="text-sm text-muted-foreground hover:text-primary underline underline-offset-4">
                  Ou découvre d'abord mes offres
                </Link>
              </div>
            </div>

            {/* 3. Photo (mobile: en dernier / desktop: sous l'accroche) */}
            <div className="animate-fade-in">
              <div className="relative max-w-sm mx-auto md:mx-0">
                <div className="absolute inset-0 bg-gradient-cta opacity-20 blur-2xl rounded-full" />
                <img
                  src={coachPortrait}
                  alt="Corentin, coach CDO"
                  className="relative rounded-2xl shadow-intense w-full h-auto max-h-[45vh] md:max-h-none object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pour qui / spécialités */}
      <section className="py-16 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Pour qui, pour quoi ?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Quel que soit ton niveau, on part de là où tu en es.</p>
          </div>
          <div className="max-w-3xl mx-auto grid sm:grid-cols-2 gap-3">
            {[
              "Débutants qui veulent (re)commencer sans se blesser",
              "Sportifs qui veulent gagner en force et en performance",
              "Retour de blessure & réathlétisation",
              "Prépa physique, musculation, haltérophilie",
              "Suivi en salle ou 100 % à distance",
              "Objectifs perte de poids, santé, énergie",
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl border border-border bg-background p-3">
                <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span className="text-sm">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14 animate-fade-in">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Comment ça <span className="text-primary">marche</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Trois étapes simples pour te lancer
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {steps.map((step, index) => (
              <Card
                key={index}
                className="p-6 bg-background border-border animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="text-primary mb-4">{step.icon}</div>
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <Card className="p-10 md:p-12 bg-gradient-hero border-border shadow-intense text-center max-w-3xl mx-auto animate-scale-in">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              On en parle ?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Un appel découverte gratuit de 20 minutes, sans engagement, pour voir comment atteindre tes objectifs.
            </p>
            <Link to="/contact">
              <Button variant="hero" size="lg" className="shadow-intense">
                Réserver mon appel gratuit
              </Button>
            </Link>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
