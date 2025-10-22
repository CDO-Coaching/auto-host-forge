import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import heroImage from "@/assets/coach-action-training.jpg";
import { Dumbbell, Target, Users, Zap } from "lucide-react";

const Index = () => {
  const services = [
    {
      icon: <Dumbbell className="w-8 h-8" />,
      title: "Coaching en Salle",
      description: "Entraînements personnalisés en présentiel pour maximiser tes performances.",
    },
    {
      icon: <Target className="w-8 h-8" />,
      title: "Préparation Physique",
      description: "Programmes sur mesure pour atteindre tes objectifs sportifs et de santé.",
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Coaching en Ligne",
      description: "Suivi à distance avec programmation et conseils personnalisés.",
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Suivi Personnalisé",
      description: "Accompagnement régulier et ajustement de ton programme selon ta progression.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>

        <div className="relative z-10 container mx-auto px-4 text-center animate-fade-in">
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            Deviens Plus <span className="text-primary">Fort</span>,<br />
            Plus <span className="text-primary">Endurant</span>,<br />
            Plus <span className="text-primary">Confiant</span>
          </h1>
          <p className="text-xl md:text-2xl text-foreground/90 mb-8 max-w-2xl mx-auto">
            Coaching sportif professionnel pour transformer ton corps et ton mental
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/appointment">
              <Button variant="hero" size="lg" className="shadow-intense">
                Réserve ton Appel Gratuit
              </Button>
            </Link>
            <Link to="/coaching">
              <Button variant="outline" size="lg" className="backdrop-blur-sm bg-background/20 border-foreground/30 text-foreground hover:bg-foreground/10">
                Découvrir les Offres
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Mes <span className="text-primary">Services</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Un accompagnement complet adapté à tes besoins et objectifs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, index) => (
              <Card
                key={index}
                className="p-6 bg-background border-border hover:border-primary transition-all duration-300 hover:shadow-glow hover:-translate-y-2 animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="text-primary mb-4">{service.icon}</div>
                <h3 className="text-xl font-bold mb-2">{service.title}</h3>
                <p className="text-muted-foreground">{service.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <Card className="p-12 bg-gradient-hero border-border shadow-intense text-center max-w-4xl mx-auto animate-scale-in">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Prêt à Transformer<br />
              <span className="text-primary">Ta Vie</span> ?
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Réserve ton appel découverte gratuit de 20 minutes et
              découvrons ensemble comment atteindre tes objectifs.
            </p>
            <Link to="/appointment">
              <Button variant="hero" size="lg" className="shadow-intense">
                Réserver Mon Appel Gratuit
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
