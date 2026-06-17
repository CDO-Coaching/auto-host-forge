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
              Selon les fonctionnalités que vous utilisez, l'application peut collecter les données suivantes :
            </p>

            <h3 className="text-xl font-medium mt-4 mb-2">Données d'identification :</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Prénom et nom</li>
              <li>Adresse email</li>
              <li>Date de naissance (pour calculer l'âge et adapter les entraînements)</li>
              <li>Genre (pour personnaliser les programmes)</li>
              <li>Coordonnées de facturation (adresse, téléphone) si vous utilisez le paiement en ligne</li>
            </ul>

            <h3 className="text-xl font-medium mt-4 mb-2">Données de santé (avec consentement explicite) :</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Niveau de fatigue, de stress, qualité de sommeil et courbatures (questionnaire de forme quotidien)</li>
              <li>Questionnaire de surentraînement : réponses et scores (fatigue physique, performance, psychologique, cognitif, sommeil/appétit, physiologique)</li>
              <li>VMA (Vitesse Maximale Aérobie), fréquence cardiaque maximale et au repos</li>
              <li>Informations sur les blessures éventuelles (nature et localisation)</li>
              <li>Poids corporel</li>
            </ul>

            <h3 className="text-xl font-medium mt-4 mb-2">Données d'entraînement :</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Séances réalisées, exercices, charges, répétitions et ressenti d'effort (RPE)</li>
              <li>Records personnels (maxes) et objectifs sportifs</li>
              <li>Données de course / cardio : distance, durée, allure, fréquence cardiaque moyenne</li>
              <li>Le cas échéant, données d'activités importées depuis Strava si vous connectez votre compte (valeurs moyennes uniquement)</li>
            </ul>

            <h3 className="text-xl font-medium mt-4 mb-2">Contenus de messagerie :</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Messages écrits échangés avec votre coach</li>
              <li>Vidéos et photos de technique sportive envoyées volontairement</li>
            </ul>

            <h3 className="text-xl font-medium mt-4 mb-2">Données de notification (si vous activez les rappels) :</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Abonnement push de votre appareil (identifiant technique et clés de chiffrement fournis par le navigateur)</li>
              <li>Vos préférences de rappels : types activés, jours, heure et fuseau horaire</li>
            </ul>

            <h3 className="text-xl font-medium mt-4 mb-2">Données de facturation (si paiement en ligne activé) :</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Historique des paiements, factures et montants, suivi des séances payées/réalisées</li>
              <li>Les données de carte bancaire sont traitées directement par notre prestataire de paiement (Stripe) et ne sont pas stockées par nous</li>
            </ul>

            <h3 className="text-xl font-medium mt-4 mb-2">Données techniques :</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Données de connexion et identifiants de session</li>
              <li>Type d'appareil / navigateur (notamment pour l'envoi des notifications)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Finalités du traitement</h2>
            <p className="text-muted-foreground mb-2">
              Vos données sont traitées pour les finalités suivantes :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Création et gestion de votre compte utilisateur</li>
              <li>Personnalisation de vos programmes d'entraînement</li>
              <li>Adaptation des séances selon votre état de forme (fatigue, stress, sommeil, surentraînement)</li>
              <li>Suivi de votre progression sportive</li>
              <li>Communication relative à votre coaching via la messagerie</li>
              <li>Envoi de rappels et notifications que vous avez activés (questionnaire, pesée, messages, etc.)</li>
              <li>Génération d'analyses et de retours assistés par intelligence artificielle pour aider le coach</li>
              <li>Gestion des paiements, de la facturation et des rendez-vous (le cas échéant)</li>
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
                <strong>Données d'identification et d'entraînement :</strong> exécution du contrat de coaching sportif.
              </li>
              <li>
                <strong>Données de santé (questionnaires, VMA, FC, blessures, poids) :</strong> consentement explicite
                (Article 9.2.a du RGPD), recueilli lors de la création de votre compte et révocable à tout moment.
              </li>
              <li>
                <strong>Vidéos et photos :</strong> consentement par l'action volontaire d'envoi via la messagerie.
              </li>
              <li>
                <strong>Notifications push :</strong> consentement, donné via l'autorisation du navigateur et l'activation
                des rappels dans l'application. Révocable à tout moment.
              </li>
              <li>
                <strong>Paiements et facturation :</strong> exécution du contrat et respect des obligations légales
                (comptables et fiscales).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Destinataires et sous-traitants</h2>
            <p className="text-muted-foreground mb-2">
              Vos données sont accessibles par votre coach et par les prestataires techniques strictement nécessaires
              au fonctionnement du service :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Corentin Dolley</strong> — coach sportif et responsable du traitement</li>
              <li><strong>Supabase</strong> — hébergement de la base de données, du stockage des fichiers et de l'authentification (serveurs en Union Européenne)</li>
              <li><strong>n8n</strong> — automatisation de l'envoi des notifications et de la synchronisation de l'agenda</li>
              <li><strong>Apple (APNs) et Google (FCM)</strong> — acheminement technique des notifications push ; ils reçoivent un identifiant d'appareil et un contenu chiffré</li>
              <li><strong>Stripe</strong> — traitement sécurisé des paiements en ligne</li>
              <li><strong>Resend</strong> — envoi d'emails transactionnels (ex. confirmation d'inscription)</li>
              <li><strong>Groq</strong> — génération d'analyses et de retours par intelligence artificielle (peut traiter des données d'entraînement et de santé)</li>
              <li><strong>Google Calendar</strong> — gestion des rendez-vous de coaching (côté coach)</li>
              <li><strong>Strava</strong> — import de vos activités, uniquement si vous connectez votre compte</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Vos données ne sont jamais vendues ni transmises à des tiers à des fins commerciales ou de prospection.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Transferts hors Union Européenne</h2>
            <p className="text-muted-foreground">
              L'hébergement principal (base de données, stockage) est situé dans l'Union Européenne. Certains
              sous-traitants (notamment Stripe, Resend et le service d'IA Groq) peuvent traiter des données aux
              États-Unis. Ces transferts sont encadrés par des garanties appropriées (clauses contractuelles types
              de la Commission européenne et/ou adhésion au Data Privacy Framework). Seules les données strictement
              nécessaires à chaque service leur sont transmises.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Durée de conservation</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Données de compte, de santé et d'entraînement :</strong> durée de la relation de coaching + 12 mois</li>
              <li><strong>Messages :</strong> durée de la relation de coaching + 12 mois</li>
              <li><strong>Vidéos et photos :</strong> 6 mois après leur envoi, sauf demande de conservation plus longue</li>
              <li><strong>Abonnements et préférences de notification :</strong> jusqu'à leur désactivation ou la suppression du compte</li>
              <li><strong>Factures :</strong> 10 ans, conformément aux obligations légales comptables</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              À l'issue de ces périodes, vos données sont supprimées ou anonymisées. Vous pouvez demander la suppression
              anticipée de vos vidéos, photos et de vos données de santé à tout moment.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Sécurité des données</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Chiffrement des données en transit (HTTPS/TLS) et au repos</li>
              <li>Chiffrement de bout en bout des notifications push (VAPID / aes128gcm)</li>
              <li>Authentification sécurisée par email et mot de passe</li>
              <li>Cloisonnement des accès par utilisateur (Row Level Security)</li>
              <li>Hébergement sécurisé dans l'Union Européenne</li>
              <li>Sauvegardes régulières et sécurisées</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Notifications push</h2>
            <p className="text-muted-foreground">
              Les notifications sont entièrement optionnelles. Elles ne sont envoyées qu'après votre autorisation
              explicite (permission du navigateur) et l'activation des rappels souhaités dans la page « Notifications ».
              Vous choisissez les types de rappels, les jours et l'heure, et pouvez tout désactiver à tout moment,
              ce qui supprime l'enregistrement de votre appareil.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Intelligence artificielle et décisions automatisées</h2>
            <p className="text-muted-foreground">
              Certaines fonctionnalités utilisent l'intelligence artificielle pour produire des analyses ou des
              propositions (débriefs, conseils, lecture des questionnaires). Ces résultats constituent une aide à
              la décision : ils sont toujours examinés et validés par votre coach humain. Aucune décision produisant
              des effets juridiques ou vous affectant de manière significative n'est prise de façon entièrement
              automatisée.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Vos droits</h2>
            <p className="text-muted-foreground mb-2">
              Conformément au RGPD, vous disposez des droits suivants :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Droit d'accès :</strong> obtenir une copie de vos données personnelles</li>
              <li><strong>Droit de rectification :</strong> corriger vos données inexactes ou incomplètes</li>
              <li><strong>Droit à l'effacement :</strong> demander la suppression de vos données</li>
              <li><strong>Droit à la limitation :</strong> limiter le traitement de vos données</li>
              <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré</li>
              <li><strong>Droit d'opposition :</strong> vous opposer au traitement de vos données</li>
              <li><strong>Droit de retrait du consentement :</strong> retirer votre consentement à tout moment (données de santé, notifications)</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Pour exercer ces droits, contactez : <a href="mailto:corentin@cdocoaching.com" className="text-primary hover:underline">corentin@cdocoaching.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Retrait du consentement</h2>
            <p className="text-muted-foreground">
              Vous pouvez retirer à tout moment votre consentement au traitement de vos données de santé (depuis votre
              profil) et désactiver les notifications (depuis la page « Notifications »). Le retrait du consentement
              n'affecte pas la licéité du traitement effectué avant ce retrait.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Réclamation</h2>
            <p className="text-muted-foreground">
              Si vous estimez que le traitement de vos données personnelles constitue une violation du RGPD,
              vous pouvez introduire une réclamation auprès de la CNIL :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mt-2 space-y-1">
              <li>Site web : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.cnil.fr</a></li>
              <li>Adresse : 3 Place de Fontenoy - TSA 80715 - 75334 Paris Cedex 07</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Mise à jour de la politique</h2>
            <p className="text-muted-foreground">
              Cette politique peut être mise à jour. En cas de modification substantielle, vous en serez informé.
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
