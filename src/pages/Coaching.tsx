import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import coachBW from "@/assets/coach-bw.jpg";

const Coaching = () => {
  const offers = [
    { name: "Coaching en Salle", price: "À partir de 60€", features: ["Séance individuel ou duo", "Correction technique"], popular: false },
    { name: "Coaching à Distance", price: "À partir de 80€/mois", features: ["Programme sur mesure", "Suivi hebdomadaire"], popular: true },
    { name: "Coaching en Entreprise", price: "Sur devis", features: ["Séances collectives", "Programme de cohésion"], popular: false },
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
            <Card key={i} className={`p-8 ${offer.popular ? 'border-primary' : ''}`}>
              <h3 className="text-2xl font-bold mb-4">{offer.name}</h3>
              <p className="text-3xl font-black text-primary mb-6">{offer.price}</p>
              <ul className="space-y-3 mb-8">
                {offer.features.map((f, j) => (
                  <li key={j} className="flex items-start"><Check className="w-5 h-5 text-primary mr-2" />{f}</li>
                ))}
              </ul>
              <Button asChild variant="hero" className="w-full"><Link to="/appointment">En savoir plus</Link></Button>
            </Card>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Coaching;
