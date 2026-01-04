import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const MentionsLegales = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-8">Mentions Légales</h1>
        
        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Éditeur du site</h2>
            <p className="text-muted-foreground">
              Le site et l'application CDO Coaching sont édités par :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mt-2 space-y-1">
              <li><strong>Nom :</strong> Corentin Dolley</li>
              <li><strong>Statut :</strong> Entrepreneur individuel</li>
              <li><strong>Activité :</strong> Coach sportif</li>
              <li><strong>Adresse :</strong> Caen, France</li>
              <li><strong>Email :</strong> corentin@cdocoaching.com</li>
              <li><strong>SIRET :</strong> [À compléter]</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Directeur de la publication</h2>
            <p className="text-muted-foreground">
              Le directeur de la publication est Corentin Dolley.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Hébergement</h2>
            <p className="text-muted-foreground mb-2">
              L'application est hébergée par :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Base de données :</strong> Supabase Inc. - 970 Toa Payoh North, #07-04, Singapore 318992</li>
              <li><strong>Application web :</strong> Lovable / Netlify - Serveurs situés dans l'Union Européenne</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Propriété intellectuelle</h2>
            <p className="text-muted-foreground">
              L'ensemble des contenus présents sur le site et l'application (textes, images, logos, vidéos, etc.) 
              sont la propriété exclusive de CDO Coaching ou de leurs auteurs respectifs. 
              Toute reproduction, représentation ou utilisation non autorisée est interdite.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Données personnelles</h2>
            <p className="text-muted-foreground">
              Pour toute information concernant la collecte et le traitement de vos données personnelles, 
              veuillez consulter notre{" "}
              <Link to="/politique-rgpd" className="text-primary hover:underline">
                Politique de Protection des Données Personnelles
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Cookies</h2>
            <p className="text-muted-foreground">
              L'application utilise uniquement des cookies techniques essentiels au fonctionnement du service 
              (authentification, session utilisateur). Aucun cookie publicitaire ou de tracking n'est utilisé.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Limitation de responsabilité</h2>
            <p className="text-muted-foreground">
              CDO Coaching met tout en œuvre pour assurer l'exactitude des informations diffusées sur l'application. 
              Toutefois, CDO Coaching ne peut être tenu responsable des éventuelles erreurs, omissions ou résultats 
              découlant de l'utilisation de ces informations.
            </p>
            <p className="text-muted-foreground mt-4">
              Les programmes d'entraînement proposés ne se substituent pas à un avis médical. 
              En cas de doute sur votre état de santé, consultez un médecin avant de commencer tout programme sportif.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Droit applicable</h2>
            <p className="text-muted-foreground">
              Les présentes mentions légales sont régies par le droit français. 
              En cas de litige, les tribunaux français seront seuls compétents.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Contact</h2>
            <p className="text-muted-foreground">
              Pour toute question relative à ces mentions légales, vous pouvez nous contacter à :{" "}
              <a href="mailto:corentin@cdocoaching.com" className="text-primary hover:underline">
                corentin@cdocoaching.com
              </a>
            </p>
          </section>

          <p className="text-muted-foreground mt-8">
            <strong>Dernière mise à jour :</strong> {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MentionsLegales;
