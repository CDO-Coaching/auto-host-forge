import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import coachImage from "@/assets/coach-portrait-smile.jpg";
import coachFocused from "@/assets/coach-focused.jpg";

const About = () => {
  const values = [
    {
      icon: "🏹",
      title: "Progression",
      description: "Chaque séance est pensée pour t'aider à avancer, corriger, apprendre et progresser durablement, sans brûler les étapes.",
    },
    {
      icon: "💬",
      title: "Écoute",
      description: "Comprendre ton parcours, tes limites et tes motivations pour créer un accompagnement vraiment sur mesure.",
    },
    {
      icon: "🏆",
      title: "Rigueur",
      description: "Parce que la technique, la constance et le travail bien fait sont essentiels, que ce soit en musculation ou en haltérophilie.",
    },
    {
      icon: "⚡",
      title: "Autonomie",
      description: "Te donner les clés pour comprendre ton corps, gérer ton entraînement et devenir pleinement acteur de ta progression.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-24 pb-12 container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <h1 className="text-5xl md:text-6xl font-black mb-6">
              À Propos de<br />
              <span className="text-primary">Corentin</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              Depuis plus de dix ans, j'accompagne des personnes de tous âges et de tous niveaux dans leur progression sportive.
              Mon parcours m'a amené à explorer différentes approches du coaching : d'abord le développement musculaire, puis la perte de poids, avant de me spécialiser en réathlétisation, correction posturale, développement de la force et haltérophilie.
            </p>
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              Formé dans ces différents domaines, j'ai appris à construire des suivis réellement personnalisés, adaptés au profil, aux objectifs et au rythme de chacun.
              Passionné de sport depuis l'enfance, je vois la musculation comme un outil d'équilibre, une base solide qui permet d'améliorer n'importe quelle discipline.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Ma philosophie est simple : le mental guide le corps.
              Mon rôle est d'aider chaque personne à trouver son propre levier de motivation, à progresser à son rythme, et à se sentir plus fort, physiquement comme mentalement.
              Chaque programme que je conçois est pensé sur mesure, dans le détail, pour un accompagnement à la fois exigeant et bienveillant.
            </p>
          </div>

          <div className="animate-scale-in">
            <div className="grid grid-cols-1 gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-cta opacity-20 blur-3xl rounded-full" />
                <img
                  src={coachImage}
                  alt="Coach CDO souriant et confiant"
                  className="relative rounded-2xl shadow-intense w-full h-auto object-cover"
                />
              </div>
              <div className="relative">
                <img
                  src={coachFocused}
                  alt="Coach en pleine séance d'entraînement"
                  className="rounded-2xl shadow-subtle w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Mes <span className="text-primary">Valeurs</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Les principes qui guident ma pratique du coaching sportif
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <Card
                key={index}
                className="p-6 bg-background border-border hover:border-primary transition-all duration-300 hover:shadow-glow hover:-translate-y-2 animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="text-5xl mb-4">{value.icon}</div>
                <h3 className="text-xl font-bold mb-2">{value.title}</h3>
                <p className="text-muted-foreground">{value.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
