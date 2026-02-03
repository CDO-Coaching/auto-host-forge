import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const CGV = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-8">Conditions Générales de Vente</h1>
        
        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Objet</h2>
            <p className="text-muted-foreground">
              Les présentes Conditions Générales de Vente (CGV) régissent les relations contractuelles 
              entre CDO Coaching, représenté par Corentin Dolley, coach sportif indépendant, 
              et toute personne physique souhaitant bénéficier des services de coaching sportif proposés 
              via l'application CDO Coaching.
            </p>
            <p className="text-muted-foreground mt-2">
              Toute souscription à un abonnement implique l'acceptation sans réserve des présentes CGV.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Services proposés</h2>
            <p className="text-muted-foreground mb-2">
              CDO Coaching propose des services de coaching sportif personnalisé incluant :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Programmes d'entraînement personnalisés</li>
              <li>Suivi de progression et adaptation des séances</li>
              <li>Messagerie avec le coach pour retours techniques</li>
              <li>Accès à l'application de suivi d'entraînement</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Tarifs et modalités de paiement</h2>
            <p className="text-muted-foreground mb-2">
              Les tarifs sont indiqués en euros TTC (TVA non applicable, article 293 B du CGI).
            </p>
            <p className="text-muted-foreground">
              Le paiement s'effectue par carte bancaire via la plateforme sécurisée Stripe. 
              Pour les abonnements mensuels, le prélèvement est automatique à chaque date anniversaire 
              de la souscription.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Droit de rétractation</h2>
            <p className="text-muted-foreground">
              Conformément aux articles L.221-18 et suivants du Code de la consommation, vous disposez 
              d'un délai de <strong>14 jours</strong> à compter de la souscription pour exercer votre droit 
              de rétractation, sans avoir à justifier de motifs ni à payer de pénalités.
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>Exception :</strong> Si vous avez expressément demandé l'exécution du service avant 
              la fin du délai de rétractation et reconnu perdre votre droit de rétractation une fois le 
              service pleinement exécuté, le droit de rétractation ne pourra plus être exercé.
            </p>
            <p className="text-muted-foreground mt-2">
              Pour exercer ce droit, envoyez un email à{" "}
              <a href="mailto:corentin@cdocoaching.com" className="text-primary hover:underline">
                corentin@cdocoaching.com
              </a>{" "}
              avec votre demande de rétractation. Le remboursement sera effectué dans un délai de 14 jours 
              suivant la réception de votre demande.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Durée et résiliation</h2>
            <h3 className="text-xl font-medium mt-4 mb-2">Abonnement mensuel :</h3>
            <p className="text-muted-foreground">
              L'abonnement est conclu pour une durée d'un mois, renouvelable par tacite reconduction. 
              Vous pouvez résilier à tout moment depuis votre espace personnel. La résiliation prend effet 
              à la fin de la période en cours : vous conservez l'accès au service jusqu'à cette date et 
              ne serez plus prélevé le mois suivant.
            </p>
            
            <h3 className="text-xl font-medium mt-4 mb-2">Paiement unique :</h3>
            <p className="text-muted-foreground">
              Le paiement unique donne accès au service pour la durée indiquée lors de l'achat 
              (généralement 1 mois). Aucun renouvellement automatique n'est effectué.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Obligations du client</h2>
            <p className="text-muted-foreground mb-2">
              Le client s'engage à :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Fournir des informations exactes lors de l'inscription</li>
              <li>Consulter un médecin en cas de doute sur son aptitude à pratiquer une activité sportive</li>
              <li>Utiliser les programmes d'entraînement de manière responsable</li>
              <li>Ne pas partager son compte avec des tiers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Responsabilité</h2>
            <p className="text-muted-foreground">
              CDO Coaching propose des programmes d'entraînement adaptés, mais ne peut être tenu 
              responsable des blessures ou problèmes de santé survenant pendant ou après les entraînements. 
              Les programmes ne se substituent pas à un avis médical.
            </p>
            <p className="text-muted-foreground mt-2">
              CDO Coaching ne peut être tenu responsable des interruptions de service dues à des 
              problèmes techniques indépendants de sa volonté.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Données personnelles</h2>
            <p className="text-muted-foreground">
              Le traitement de vos données personnelles est détaillé dans notre{" "}
              <Link to="/politique-rgpd" className="text-primary hover:underline">
                Politique de Protection des Données Personnelles
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Médiation</h2>
            <p className="text-muted-foreground">
              En cas de litige, vous pouvez recourir gratuitement au service de médiation de la consommation. 
              Le médiateur peut être saisi après avoir tenté de résoudre le litige directement avec CDO Coaching.
            </p>
            <p className="text-muted-foreground mt-2">
              Plateforme de règlement en ligne des litiges de l'UE :{" "}
              <a 
                href="https://ec.europa.eu/consumers/odr" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                https://ec.europa.eu/consumers/odr
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Droit applicable</h2>
            <p className="text-muted-foreground">
              Les présentes CGV sont soumises au droit français. En cas de litige, les tribunaux français 
              seront seuls compétents.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Contact</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Email :</strong>{" "}
                <a href="mailto:corentin@cdocoaching.com" className="text-primary hover:underline">
                  corentin@cdocoaching.com
                </a>
              </li>
              <li><strong>Adresse :</strong> Caen, France</li>
              <li><strong>SIRET :</strong> [À compléter]</li>
            </ul>
          </section>

          <p className="text-muted-foreground mt-8">
            <strong>Dernière mise à jour :</strong>{" "}
            {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CGV;
