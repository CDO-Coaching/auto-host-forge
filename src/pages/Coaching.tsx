import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import coachBW from "@/assets/coach-bw.jpg";

const Coaching = () => {
  const offers = [
    { 
      name: "Coaching en Salle", 
      price: "À partir de 60€", 
      subtitle: "Conseil",
      features: [
        "Séance individuelle ou en duo",
        "Correction technique en temps réel",
        "Programme personnalisé selon tes objectifs",
        "Suivi de progression détaillé",
        "Conseils nutrition et récupération"
      ], 
      popular: false 
    },
    { 
      name: "Coaching à Distance", 
      price: "À partir de 80€/mois", 
      subtitle: "Suivi complet",
      features: [
        "Programme d'entraînement 100% sur mesure",
        "Vidéos explicatives de chaque exercice",
        "Suivi hebdomadaire par message",
        "Ajustements réguliers selon ta progression",
        "Retours vidéo personnalisés sur ta technique"
      ], 
      popular: true 
    },
    { 
      name: "Coaching en Entreprise", 
      price: "Sur devis", 
      subtitle: "Bien-être au travail",
      features: [
        "Séances collectives adaptées au groupe",
        "Programme de cohésion d'équipe",
        "Amélioration de la condition physique",
        "Prévention des troubles musculosquelettiques",
        "Planning flexible selon vos contraintes"
      ], 
      popular: false 
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <section className="pt-32 pb-20 container mx-auto px-4">
        <h1 className="text-5xl font-black text-center mb-6">Mes Offres de <span className="text-primary">Coaching</span></h1>
      </section>
      <section className="pb-20 container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {offers.map((offer, i) => (
            <Card key={i} className={`p-8 ${offer.popular ? 'border-primary shadow-glow' : ''} relative flex flex-col`}>
              {offer.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-cta text-primary-foreground px-4 py-1 rounded-full text-sm font-bold shadow-intense">
                    POPULAIRE
                  </span>
                </div>
              )}
              <h3 className="text-2xl font-bold mb-2">{offer.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{offer.subtitle}</p>
              <p className="text-3xl font-black text-primary mb-6">{offer.price}</p>
              <ul className="space-y-3 mb-8 flex-grow">
                {offer.features.map((f, j) => (
                  <li key={j} className="flex items-start"><Check className="w-5 h-5 text-primary mr-2 mt-0.5 flex-shrink-0" /><span className="text-sm">{f}</span></li>
                ))}
              </ul>
              <Button asChild variant={offer.popular ? "hero" : "default"} className="w-full mt-auto"><Link to="/appointment">Demander plus d'infos</Link></Button>
            </Card>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Coaching;
