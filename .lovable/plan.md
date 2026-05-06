# Audit de la partie Sportif — Propositions d'amélioration

J'ai parcouru les 22 pages de `/sportif/*` (Dashboard, Séances, ExerciceDetail, SupersetDetail, Fatigue, Maxes, Poids, Agenda, Méditation, Messagerie, Profil, Paiement, Factures, etc.). Voici une synthèse des améliorations possibles, classées par catégorie et priorité. **Aucun code ne sera modifié tant que tu n'as pas validé / sélectionné les chantiers à lancer.**

---

## 1. Esthétique & cohérence visuelle

**P1 — Unification du Dashboard**
- Le Dashboard sportif empile beaucoup de cards de tailles différentes (Progression, Bilan, Récup, Messages, Prochaine séance). Repenser en grille 2 colonnes plus régulière sur desktop, avec hiérarchie claire : *Hero "Prochaine séance"* en haut, puis stats secondaires.
- Ajouter une vraie **bannière de bienvenue** avec date du jour, météo de la forme (emoji fatigue), streak de jours consécutifs validés.

**P2 — Palette & élévation**
- Standardiser les couleurs des badges (Charge rouge / RPE jaune-vert / Tempo violet introduits récemment) sur **tout** le parcours sportif (actuellement uniquement ExerciceDetail/SupersetDetail).
- Remplacer les `border-primary/30 bg-gradient-to-br from-primary/5` répétés par un composant `<HighlightCard>` partagé.

**P3 — Animations & feedback**
- Confetti / micro-animation déjà présente sur fin de semaine → étendre à la validation d'un exercice individuel (petit pulse + son discret).
- Skeletons unifiés (actuellement `<p>Chargement...</p>` dans la moitié des pages).

---

## 2. Pratique / UX au quotidien

**P1 — Page "Séances" plus actionnable**
- Ajouter un **filtre rapide** (Cette semaine / Semaine prochaine / Historique) en chips sticky.
- Toujours mettre en avant la **séance du jour** avec un CTA "Démarrer maintenant".
- Permettre le **swipe** sur mobile pour marquer "skippée" ou "reporter".

**P1 — ExerciceDetail : navigation entre exos**
- Boutons **« Exo précédent / suivant »** persistants en bas (sticky), avec mini-progress (3/7).
- Raccourci "Tout valider RPE = X" quand toutes les séries ont le même ressenti.

**P2 — Saisie chiffres sur mobile**
- Forcer `inputMode="decimal"` partout (charge, poids, distance) pour un clavier numérique natif.
- Boutons +/- à côté du champ charge pour ajuster ±2,5 kg sans clavier.

**P2 — Timer de récupération**
- Déjà présent, mais ajouter **vibration** (Navigator.vibrate) à 3s de la fin et son court personnalisable.
- Bouton "skip recup" plus visible.

**P3 — Agenda**
- Vue mensuelle déjà OK, ajouter **vue semaine** type Google Calendar pour mieux voir les créneaux.
- Glisser-déposer pour reprogrammer une séance.

---

## 3. Fonctionnalités à ajouter

**P1 — Streak & gamification légère**
- Badge "X jours consécutifs", "X séances ce mois", déblocages d'icônes profil. Encourage l'assiduité sans verser dans le gadget.

**P1 — Historique exercice (clic sur le nom)**
- Depuis ExerciceDetail, un clic sur le nom de l'exo ouvre un dialog avec : courbe charge max, RPE moyen, nombre de fois fait, dernière perf. Le composant `ExerciseRPEHistoryChart` existe déjà → l'enrichir.

**P2 — Notes personnelles par séance**
- Champ texte "Mes ressentis" libre (séparé du commentaire visible coach), pour journaling personnel.

**P2 — Photos de progression**
- Sur la page Poids, autoriser une photo mensuelle (avant/après) avec storage privé.

**P2 — Export / partage**
- Bouton "Partager ma séance" → génère une carte image (PR du jour, charge, RPE) à poster sur Insta/WhatsApp.

**P3 — Mode hors-ligne minimal**
- Service worker existe déjà → cacher la séance du jour pour pouvoir la valider sans réseau (sync à la reconnexion).

**P3 — Notifications push**
- Rappel "Tu as une séance prévue à 18h", "N'oublie pas ta fatigue du jour", "Pèse-toi (rappel hebdo)".

---

## 4. Page Fatigue & Récupération

- Ajouter un **graphique radar** (sommeil / stress / courbatures / motivation / énergie) hebdo en plus du score global.
- Conseils auto-générés via Lovable AI ("Tu dors mal depuis 4j → réduis l'intensité demain").
- Permettre de **modifier rétroactivement** une journée (déjà partiellement possible — UI à clarifier).

---

## 5. Messagerie

- **Indicateur "Coach en train d'écrire…"** (Realtime Supabase).
- **Réactions emoji** rapides sur un message coach.
- Recherche dans l'historique.

---

## 6. Profil & onboarding

- **Onboarding guidé** la première connexion (3-4 écrans : objectifs, fréquence, matériel dispo).
- Photo de profil (manque ou peu visible).
- Synthèse "Mes infos clés" en haut : VMA, FC max/repos, 1RM principaux.

---

## 7. Performance technique

- Plusieurs pages > 600 lignes (`SeanceDetail` 1267, `ExerciceDetail` 1019). Découper en sous-composants pour faciliter maintenance et perf.
- Ajouter `react-query` (déjà installé) pour cacher les requêtes répétées (profile, week courante, fatigue) — actuellement chaque page refait `supabase.from(...)`.
- Lazy-load des dialogs lourds (Méditation, Questionnaire surentraînement).

---

## Question pour toi

Dis-moi **quels chantiers tu veux que je lance en priorité** (par ex : "P1 esthétique + streak + historique exercice"), et je passerai en mode build pour les implémenter un par un. Je peux aussi te proposer un plan d'exécution détaillé pour 2-3 items précis si tu préfères avancer pas à pas.
