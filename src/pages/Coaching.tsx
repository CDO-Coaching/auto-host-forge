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
      price: "dès 60€",
      subtitle: "L'accompagnement en présentiel",
      features: [
        "Séance individuelle entièrement dédiée",
        "Pédagogie adaptée pour une maîtrise parfaite de chaque mouvement",
        "Conseils experts nutrition & récupération",
      ],
      popular: false
    },
    {
      name: "Coaching à Distance",
      price: "dès 80€/mois",
      subtitle: "Un suivi complet, où que tu sois",
      features: [
        "Programmation 100% sur mesure, ajustée chaque semaine",
        "Échanges réguliers pour un suivi vraiment personnalisé",
        "Analyses vidéo et bibliothèque d'exercices",
      ],
      popular: false
    },
    {
      name: "Suivi Personnalisé",
      price: "sur mesure",
      subtitle: "L'excellence : salle + distance",
      features: [
        "Le meilleur du présentiel et du distanciel réunis",
        "Encadrement rapproché et disponibilité privilégiée",
        "Programme réajusté chaque semaine, avec toi",
      ],
      popular: true
    },
    {
      name: "Coaching en Entreprise",
      price: "sur devis",
      subtitle: "Le bien-être de vos équipes",
      features: [
        "Séances collectives sur mesure",
        "Cohésion d'équipe et bien-être durable",
        "Organisation flexible autour de vos contraintes",
      ],
      popular: false
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <section className="pt-24 pb-6 md:pt-28 md:pb-8 container mx-auto px-4">
        <h1 className="text-3xl md:text-5xl font-black text-center mb-2">Mes offres de <span className="text-primary">coaching</span></h1>
        <p className="text-center text-sm md:text-lg text-muted-foreground max-w-2xl mx-auto">
          Choisis la formule qui te correspond. On affine ensemble lors de l'appel gratuit.
        </p>
      </section>
      <section className="pb-12 container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 max-w-4xl mx-auto">
          {offers.map((offer, i) => (
            <Card
              key={i}
              className={`relative flex flex-col rounded-2xl p-6 sm:p-7 transition-all ${
                offer.popular
                  ? "border-primary/60 bg-gradient-to-b from-primary/[0.06] to-transparent shadow-glow"
                  : "border-border/70 hover:border-primary/40"
              }`}
            >
              {offer.popular && (
                <span className="absolute top-5 right-5 text-[10px] font-semibold tracking-widest text-primary/90 uppercase">
                  Recommandé
                </span>
              )}

              <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">{offer.subtitle}</p>
              <h3 className="text-2xl font-bold leading-tight">{offer.name}</h3>
              <p className="mt-1 mb-5 text-primary font-semibold">{offer.price}</p>

              <div className="h-px w-10 bg-primary/40 mb-5" />

              <ul className="space-y-3 mb-7 flex-grow">
                {offer.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" strokeWidth={2.5} />
                    <span className="text-sm text-foreground/90 leading-snug">{f}</span>
                  </li>
                ))}
              </ul>

              <Button asChild variant={offer.popular ? "hero" : "outline"} className="w-full mt-auto">
                <Link to="/contact">Demander plus d'infos</Link>
              </Button>
            </Card>
          ))}
        </div>
        <div className="text-center mt-10">
          <p className="text-muted-foreground mb-4">Pas sûr de la formule ? On en parle sans engagement.</p>
          <Button asChild variant="hero" size="lg"><Link to="/contact">Réserver mon appel gratuit</Link></Button>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Coaching;
