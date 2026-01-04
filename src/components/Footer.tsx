import { Link } from "react-router-dom";
import { Instagram, Youtube, Mail } from "lucide-react";
import cdoLogo from "@/assets/cdo-logo.png";

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo & Description */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <img src={cdoLogo} alt="CDO Coaching Logo" className="h-10 w-10 object-contain" />
              <span className="text-lg font-bold">CDO <span className="text-primary">Coaching</span></span>
            </div>
            <p className="text-sm text-muted-foreground">
              Coaching sportif professionnel pour développer ta force, ton endurance et ta confiance.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Navigation</h3>
            <nav className="flex flex-col space-y-2">
              <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Accueil
              </Link>
              <Link to="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                À propos
              </Link>
              <Link to="/coaching" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Coaching
              </Link>
              <Link to="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Contact
              </Link>
            </nav>
          </div>

          {/* Legal Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informations légales</h3>
            <nav className="flex flex-col space-y-2">
              <Link to="/mentions-legales" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Mentions légales
              </Link>
              <Link to="/politique-rgpd" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Politique RGPD
              </Link>
            </nav>
          </div>

          {/* Social & Contact */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Suivez-moi</h3>
            <div className="flex space-x-4">
              <a
                href="https://instagram.com/cdo_coaching"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-secondary hover:bg-primary hover:text-primary-foreground transition-all"
              >
                <Instagram size={20} />
              </a>
              <a
                href="https://youtube.com/@cdocoaching"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-secondary hover:bg-primary hover:text-primary-foreground transition-all"
              >
                <Youtube size={20} />
              </a>
              <a
                href="mailto:contact@cdocoaching.com"
                className="p-2 rounded-full bg-secondary hover:bg-primary hover:text-primary-foreground transition-all"
              >
                <Mail size={20} />
              </a>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>📍 Caen</p>
              <p>📧 contact@cdocoaching.com</p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} CDO Coaching. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
