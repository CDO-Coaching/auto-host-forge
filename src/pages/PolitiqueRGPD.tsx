import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const PolitiqueRGPD = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-8">Politique de Protection des Données Personnelles (RGPD)</h1>
        
        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Responsable du traitement</h2>
            <p className="text-muted-foreground">
              Le responsable du traitement des données personnelles est :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mt-2 space-y-1">
              <li><strong>Nom :</strong> Corentin Dolley</li>
              <li><strong>Activité :</strong> Coach sportif indépendant - CDO Coaching</li>
              <li><strong>Email :</strong> corentin@cdocoaching.com</li>
              <li><strong>Adresse :</strong> Caen, France</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Données collectées</h2>
            <p className="text-muted-foreground mb-4">
              L'application collecte les données suivantes :
            </p>
            
            <h3 className="text-xl font-medium mt-4 mb-2">Données d'identification :</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Prénom et nom</li>
              <li>Adresse email</li>
              <li>Date de naissance (pour calculer l'âge et adapter les entraînements)</li>
              <li>Genre (pour personnaliser les programmes)</li>
            </ul>

            <h3 className="text-xl font-medium mt-4 mb-2">Données de santé (avec consentement explicite) :</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Niveau de fatigue quotidien</li>
              <li>Niveau de stress</li>
              <li>Qualité de sommeil</li>
              <li>Niveau de courbatures</li>
              <li>VMA (Vitesse Maximale Aérobie)</li>
              <li>Fréquence cardiaque maximale</li>
              <li>Fréquence cardiaque au repos</li>
              <li>Informations sur les blessures éventuelles</li>
              <li>Poids corporel</li>
            </ul>

            <h3 className="text-xl font-medium mt-4 mb-2">Données d'entraînement :</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Séances réalisées et performances</li>
              <li>Exercices et charges utilisées</li>
              <li>Records personnels (maxes)</li>
              <li>Objectifs sportifs</li>
            </ul>

            <h3 className="text-xl font-medium mt-4 mb-2">Contenus multimédias (avec consentement implicite lors de l'envoi) :</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Vidéos de technique sportive envoyées volontairement au coach</li>
              <li>Photos d'exercices ou de posture</li>
              <li>Messages vocaux ou écrits accompagnant ces contenus</li>
            </ul>
            <p className="text-muted-foreground mt-2 text-sm italic">
              Ces contenus sont envoyés à votre initiative via la messagerie intégrée et sont utilisés 
              exclusivement pour vous fournir des retours personnalisés sur votre technique.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Finalités du traitement</h2>
            <p className="text-muted-foreground mb-2">
              Vos données sont traitées pour les finalités suivantes :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Création et gestion de votre compte utilisateur</li>
              <li>Personnalisation de vos programmes d'entraînement</li>
              <li>Adaptation des séances en fonction de votre état de forme (fatigue, stress, sommeil)</li>
              <li>Suivi de votre progression sportive</li>
              <li>Communication relative à votre coaching (pas de prospection commerciale)</li>
            </ul>
            <p className="text-muted-foreground mt-4 font-medium">
              ⚠️ Les données de santé ne sont PAS utilisées à des fins médicales ou de diagnostic. 
              Elles servent uniquement à adapter les entraînements sportifs.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Base légale du traitement</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                <strong>Données d'identification :</strong> Exécution du contrat de coaching sportif
              </li>
              <li>
                <strong>Données de santé :</strong> Consentement explicite (Article 9.2.a du RGPD). 
                Ce consentement est recueilli lors de la création de votre compte et peut être retiré à tout moment.
              </li>
              <li>
                <strong>Vidéos et photos :</strong> Consentement implicite par l'action volontaire d'envoi. 
                L'envoi d'une vidéo ou photo constitue un acte délibéré valant consentement à son traitement 
                dans le cadre du coaching sportif.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Destinataires des données</h2>
            <p className="text-muted-foreground mb-2">
              Vos données sont accessibles uniquement par :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Corentin Dolley</strong> - Coach sportif et responsable du traitement</li>
              <li><strong>Supabase</strong> - Hébergeur de la base de données (serveurs situés dans l'Union Européenne)</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Vos données ne sont jamais vendues, partagées ou transmises à des tiers à des fins commerciales.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Durée de conservation</h2>
            <p className="text-muted-foreground mb-2">
              Vos données sont conservées pendant :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Données de compte et d'entraînement :</strong> Durée de la relation de coaching + 12 mois</li>
              <li><strong>Vidéos et photos :</strong> 6 mois après leur envoi, sauf demande de conservation plus longue de votre part</li>
              <li><strong>Messages :</strong> Durée de la relation de coaching + 12 mois</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              À l'issue de ces périodes, vos données sont supprimées ou anonymisées. Vous pouvez demander 
              la suppression anticipée de vos vidéos et photos à tout moment.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Sécurité des données</h2>
            <p className="text-muted-foreground mb-2">
              Les mesures de sécurité mises en place incluent :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Chiffrement des données en transit (HTTPS/TLS)</li>
              <li>Chiffrement des données au repos</li>
              <li>Authentification sécurisée par email et mot de passe</li>
              <li>Accès restreint aux données (uniquement le coach)</li>
              <li>Hébergement sécurisé dans l'Union Européenne</li>
              <li>Sauvegardes régulières et sécurisées</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Vos droits</h2>
            <p className="text-muted-foreground mb-2">
              Conformément au RGPD, vous disposez des droits suivants :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Droit d'accès :</strong> Obtenir une copie de vos données personnelles</li>
              <li><strong>Droit de rectification :</strong> Corriger vos données inexactes ou incomplètes</li>
              <li><strong>Droit à l'effacement :</strong> Demander la suppression de vos données</li>
              <li><strong>Droit à la limitation :</strong> Limiter le traitement de vos données</li>
              <li><strong>Droit à la portabilité :</strong> Recevoir vos données dans un format structuré</li>
              <li><strong>Droit d'opposition :</strong> Vous opposer au traitement de vos données</li>
              <li><strong>Droit de retrait du consentement :</strong> Retirer votre consentement à tout moment pour les données de santé</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Pour exercer ces droits, contactez : <a href="mailto:corentin@cdocoaching.com" className="text-primary hover:underline">corentin@cdocoaching.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Retrait du consentement</h2>
            <p className="text-muted-foreground">
              Si vous avez consenti au traitement de vos données de santé, vous pouvez retirer ce consentement à tout moment 
              depuis votre profil dans l'application. Le retrait du consentement n'affecte pas la licéité du traitement 
              effectué avant ce retrait.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Réclamation</h2>
            <p className="text-muted-foreground">
              Si vous estimez que le traitement de vos données personnelles constitue une violation du RGPD, 
              vous pouvez introduire une réclamation auprès de la CNIL (Commission Nationale de l'Informatique et des Libertés) :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mt-2 space-y-1">
              <li>Site web : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.cnil.fr</a></li>
              <li>Adresse : 3 Place de Fontenoy - TSA 80715 - 75334 Paris Cedex 07</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Mise à jour de la politique</h2>
            <p className="text-muted-foreground">
              Cette politique peut être mise à jour. La date de dernière modification est indiquée ci-dessous. 
              En cas de modification substantielle, vous en serez informé.
            </p>
            <p className="text-muted-foreground mt-4">
              <strong>Dernière mise à jour :</strong> {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PolitiqueRGPD;
