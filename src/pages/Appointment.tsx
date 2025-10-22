import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Phone, Video, Calendar } from "lucide-react";
import { Link } from "react-router-dom";

const Appointment = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <section className="pt-32 pb-20 container mx-auto px-4">
        <h1 className="text-5xl font-black text-center mb-12">Réserve Ton <span className="text-primary">Rendez-vous</span></h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            { icon: <Phone className="w-8 h-8" />, title: "Appel Découverte", duration: "20 min", desc: "Discussion gratuite" },
            { icon: <Video className="w-8 h-8" />, title: "Visio", duration: "20 min", desc: "Rendez-vous en ligne" },
            { icon: <Calendar className="w-8 h-8" />, title: "Première Séance", duration: "60 min", desc: "Teste mon coaching (60€)" }
          ].map((type, i) => (
            <Card key={i} className="p-8 text-center">
              <div className="w-16 h-16 bg-gradient-cta rounded-full flex items-center justify-center mx-auto mb-4 text-primary-foreground">{type.icon}</div>
              <h3 className="text-2xl font-bold mb-2">{type.title}</h3>
              <p className="text-primary font-semibold mb-4">{type.duration}</p>
              <p className="text-muted-foreground mb-6">{type.desc}</p>
              <Button asChild variant="hero" className="w-full"><Link to="/contact">Réserver</Link></Button>
            </Card>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Appointment;
