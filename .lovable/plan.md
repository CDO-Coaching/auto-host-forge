
Objectif: remplacer l’expérience actuelle du questionnaire de fatigue par un système beaucoup plus rapide sur tactile, où l’utilisateur peut mettre une note en un seul geste ou en un seul tap.

Constat dans le code
- Le formulaire utilise aujourd’hui uniquement `Slider` dans :
  - `src/components/DailyFatigueDialog.tsx`
  - `src/components/EditFatigueDialog.tsx`
- Le composant partagé est `src/components/ui/slider.tsx`.
- Donc le bon levier est surtout UX/UI sur ces deux dialogs, sans toucher à la logique de sauvegarde.

Options proposées

1. Option A — Barre de notes cliquables 1 à 7
- Remplacer chaque slider par 7 boutons/tuiles alignés.
- Un seul tap sur “6” met directement 6.
- Très simple, très fiable sur mobile.
- Avantage :
  - ultra rapide
  - zéro problème de drag tactile
  - très clair visuellement
- Inconvénient :
  - un peu plus “gros” visuellement qu’un slider

2. Option B — Système hybride recommandé
- Garder une barre slider pour glisser si on veut.
- Ajouter juste en dessous 7 pastilles/boutons cliquables 1→7.
- Donc :
  - soit l’utilisateur glisse
  - soit il tape directement la note
- Avantage :
  - couvre tous les usages
  - très rapide sur téléphone
  - ne casse pas l’habitude actuelle
- Inconvénient :
  - interface un peu plus riche

3. Option C — Segmented control avec libellés
- Transformer chaque question en 7 segments sélectionnables, style sélecteur horizontal.
- Un tap sélectionne immédiatement la valeur.
- On peut mettre un rendu compact et responsive.
- Avantage :
  - très propre
  - idéal pour “un clic = une note”
- Inconvénient :
  - plus serré sur petit écran si on affiche trop de texte

4. Option D — Carte de notation plein écran mobile
- Sur mobile, au lieu d’un slider, afficher des grandes cartes 1→7 très touch-friendly.
- Sur desktop, garder slider ou hybride.
- Avantage :
  - meilleure ergonomie tactile
  - énorme zone de clic
- Inconvénient :
  - double comportement mobile/desktop à maintenir

Recommandation
Je recommande l’Option B — Hybride.
Pourquoi :
- tu veux “mettre la note rapidement en un seul clic, avec slide ou non”
- cette option répond exactement à ça
- elle évite de dépendre uniquement du drag tactile
- elle reste bonne aussi sur ordinateur

Plan d’implémentation
1. Créer un petit composant réutilisable de notation 1→7
- composant commun, par ex. logique visuelle réutilisable dans les deux dialogs
- props :
  - valeur actuelle
  - callback `onChange`
  - min/max
  - labels
  - mode mobile/desktop si besoin

2. Mettre en place le mode hybride
- Conserver le `Slider`
- Ajouter une rangée de boutons/pastilles 1→7 cliquables juste dessous
- Le clic sur une pastille met directement la note
- Le slider reste synchronisé avec la valeur

3. Optimiser pour tactile
- Boutons plus grands sur mobile
- wrap propre si écran étroit
- état visuel très clair pour la valeur active
- éviter toute zone trop petite

4. Appliquer partout
- `src/components/DailyFatigueDialog.tsx`
- `src/components/EditFatigueDialog.tsx`
- y compris pour “niveau de douleur” dans les sections blessure

5. Vérifier la cohérence responsive
- mobile étroit
- téléphone standard
- desktop
- vérifier que les lignes ne débordent pas et restent faciles à toucher

Détails techniques
- Réutiliser `Button` existant ou créer un mini composant local de “rating chip”.
- Garder le `Slider` générique intact si possible, et enrichir seulement l’UI métier des dialogs.
- Si on veut aller plus loin ensuite, on pourra factoriser ça en composant du type `QuickRatingInput`.

Résultat attendu
- Sur téléphone : un tap direct sur 1, 2, 3, 4, 5, 6 ou 7 suffit
- Si l’utilisateur préfère, il peut toujours glisser
- Sur ordinateur : drag continu toujours possible
- Expérience beaucoup plus rapide et sans frustration

Si on implémente, je partirai sur :
- Option B par défaut
- avec boutons/pastilles compacts sur desktop
- et légèrement plus gros sur mobile
