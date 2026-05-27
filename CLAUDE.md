# CDO Coaching App — Contexte Claude Code

Application de coaching sportif SaaS (Corentin Dolley / CDO Coaching).  
Deux rôles distincts : **Coach** et **Sportif**.

---

## Stack technique

- **Frontend** : React 18 + TypeScript + Vite
- **UI** : shadcn/ui (Radix UI) + Tailwind CSS
- **Backend** : Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Déploiement** : Docker → Coolify → self-hosted (push GitHub déclenche le build)
- **Paiements** : Stripe
- **Cardio tracking** : Strava API
- **Voix** : Groq (commandes vocales)

> **Pour déployer** : `git push origin main` → Coolify rebuild Docker automatiquement (3-5 min)

---

## Architecture des dossiers

```
src/
├── pages/
│   ├── coach/          # Vues coach (ClientDetail, Dashboard, MesClients…)
│   └── sportif/        # Vues sportif (SeanceDetail, ExerciceDetail, SupersetDetail…)
├── components/         # Composants partagés coach+sportif
│   ├── CoachRunningView.tsx      # Graphiques course (coach)
│   ├── CoachCyclingView.tsx      # Graphiques vélo (coach)
│   ├── CoachSwimmingView.tsx     # Graphiques natation (coach)
│   ├── DesktopProgView.tsx       # Vue programmation desktop (coach)
│   ├── MobileProgView.tsx        # Vue programmation mobile (coach)
│   └── StravaActivityMatcher.tsx # Liaison activité Strava ↔ séance
├── lib/
│   ├── cardioCalculations.ts     # calculateCardioMetrics(cardioData, vma)
│   ├── weekUtils.ts              # getWeekNumber(), getWeekYear()
│   ├── maxCalculations.ts        # calculate1RM(), parseWeight(), parseReps()
│   └── sessionPdfExport.ts
└── hooks/
    ├── useRecoveryTimer.ts
    └── useWakeLock.ts
```

---

## Tables Supabase principales

| Table | Description |
|-------|-------------|
| `user_profiles` | Profils coach et sportif (role: "coach"/"athlete", vma, fc_max, fc_repos) |
| `coach_athlete_relationships` | Lien coach ↔ sportif (status: "approved"/"paused") |
| `training_sessions` | Séances programmées par le coach (session_type, scheduled_date, completed_at) |
| `session_exercises` | Exercices d'une séance (charge, reps, series, serie_details JSON, serie_rpe_details JSON, cardio_content JSON, cardio_sport) |
| `custom_sessions` | Séances perso saisies par le sportif (cardio_type, duration_minutes, distance_km, completed_at) |
| `exercise_library` | Bibliothèque d'exercices |
| `exercise_maxes` | Records/maxes du sportif par exercice (weight_kg, max_type) |
| `daily_fatigue_log` | Journal fatigue quotidien (fatigue, stress, sommeil, injury_level, injury_location, has_injury) |
| `athlete_performance_tests` | Tests perf (VMA, FC max…) |
| `weight_tracking` | Suivi poids |
| `messages` | Messagerie coach ↔ sportif |
| `macrocycles` / `mesocycles` / `microcycles` | Périodisation |
| `coaching_methodologies` / `methodology_exercises` | Méthodologies coach |
| `accounting_entries` / `invoices` | Comptabilité |

### Champs importants `session_exercises`

- `charge` : charge prescrite par le coach (peut être `"??"` = à définir par le sportif, `"80%"` = % du max, `"60kg"`)
- `serie_details` : JSON array `[{reps, charge, rpe, tempo, commentaire, recuperation}]` — détail par série si le coach a personnalisé
- `serie_rpe_details` : JSON array `[{rpe, actual_reps, actual_charge, modification_type}]` — retours du sportif par série
- `cardio_content` : JSON structure pour séances cardio (steps + blocks) — **source de vérité pour les valeurs planifiées cardio**
- `cardio_total_distance_km` / `cardio_total_duration_minutes` : champs PLANIFIÉS (ne jamais les écraser avec des valeurs Strava)
- `actual_distance_km` / `actual_duration_minutes` : valeurs RÉELLES saisies par le sportif
- `sportif_rpe` / `sportif_comment` / `sportif_feedback_at` : feedback global du sportif
- `linked_strava_activity_id` : ID activité Strava liée

---

## Règles métier critiques

### Cardio — Planifié vs Réel
- **Jaune** = valeurs planifiées coach → calculées depuis `cardio_content` JSON via `calculateCardioMetrics(cardioData, vma)`
- **Vert** = valeurs réelles sportif → Strava en priorité, sinon saisie manuelle (`actual_distance_km`, `actual_duration_minutes`), sinon séances perso (`custom_sessions`)
- ⚠️ Ne jamais utiliser `cardio_total_distance_km` comme valeur réelle (c'est planifié)
- ⚠️ `StravaActivityMatcher` ne doit PAS écraser `cardio_total_distance_km` / `cardio_total_duration_minutes`

### VMA dans les fonctions async
- Toujours utiliser la variable locale : `const vma = profileData?.vma || null`
- Ne jamais lire `athleteVma` (state React) dans une fonction async — stale closure

### Charge "??"
- Quand coach met `??` = le sportif doit saisir la charge lors de la validation de chaque série
- `actual_charge` est alors obligatoire et sauvegardé dans `serie_rpe_details`
- La charge saisie est proposée pour la série suivante du même exercice

### Supersets
- Exercices supersets : `super_set_group` non null dans `session_exercises`
- Côté sportif : page `SupersetDetail.tsx` (pas `ExerciceDetail.tsx`)
- Index global dans le superset : `roundIdx * exercises.length + exerciseIdx`

### Blessures (badge header)
- `daily_fatigue_log` : `has_injury=true` + `injury_level > 0` = blessure active
- `has_injury=false` ou `injury_level=0` = "Terminée"
- La requête `loadHeaderInjury` doit inclure toutes les entrées (sans filtre `has_injury=true`) pour détecter si la plus récente est "Terminée"

---

## Parcours sportif (pages clés)

1. **Séances** → `src/pages/sportif/Seances.tsx`  
2. **Détail séance** → `src/pages/sportif/SeanceDetail.tsx`  
3. **Exercice solo** → `src/pages/sportif/ExerciceDetail.tsx`  
   - Validation série par série avec dialog RPE
   - `serieValidations` state local + localStorage
   - Sauvegarde finale dans `session_exercises.serie_rpe_details`
4. **Superset** → `src/pages/sportif/SupersetDetail.tsx`  
   - Index global = `roundIdx * exercises.length + exIdx`
   - `suggestedChargeByExIdx` : charge suggérée par exercice

---

## Parcours coach (pages clés)

1. **Dashboard** → `src/pages/coach/Dashboard.tsx`
2. **Fiche client** → `src/pages/coach/ClientDetail.tsx` (fichier très long ~5000 lignes)
   - Onglets : Résumé, Prog, Efforts, Max, Fatigue, Poids, Objectifs, Méthodo, Paiements
   - `loadHeaderInjury()` : badge blessure dans le header
   - `loadHeaderMonotony()` : badge monotonie
3. **Programmation desktop** → `src/components/DesktopProgView.tsx`
   - Affiche les séries individuelles si `serie_details.length > 1` OU si le sportif a répondu (`serie_rpe_details`)
   - Charge `??` affichée comme `⚖️ X kg` (pas `≠ X (prévu ??)`)
4. **Graphiques cardio** : `CoachRunningView`, `CoachCyclingView`, `CoachSwimmingView`

---

## Patterns de code fréquents

### Requête Supabase standard
```ts
const { data, error } = await supabase
  .from("training_sessions")
  .select("*, session_exercises(*)")
  .eq("user_id", athleteId)
  .order("scheduled_date", { ascending: false });
```

### Calcul semaine ISO
```ts
import { getWeekNumber, getWeekYear } from "@/lib/weekUtils";
const weekKey = `${isoYear}-W${weekNumber.toString().padStart(2, "0")}`;
```

### calculateCardioMetrics
```ts
import { calculateCardioMetrics } from "@/lib/cardioCalculations";
import { CardioData } from "@/components/CardioStepBuilder";
const cardioData = JSON.parse(ex.cardio_content) as CardioData;
const { totalDistanceKm, totalDurationMinutes } = calculateCardioMetrics(cardioData, vma);
```

### getSerieDetailsArray (dans DesktopProgView)
Fonction locale qui parse `serie_details` JSON et retourne un tableau de séries.

---

## Fichiers les plus modifiés / à connaître

| Fichier | Pourquoi |
|---------|----------|
| `src/pages/coach/ClientDetail.tsx` | Fiche client complète (~5000 lignes) — très souvent modifié |
| `src/components/DesktopProgView.tsx` | Vue prog coach desktop — logique série, feedback |
| `src/pages/sportif/ExerciceDetail.tsx` | Validation exercice sportif — séries, RPE, charge ?? |
| `src/pages/sportif/SupersetDetail.tsx` | Idem pour supersets |
| `src/components/CoachRunningView.tsx` | Graphique course — données planifié/réel |
| `src/components/CoachCyclingView.tsx` | Graphique vélo |
| `src/components/CoachSwimmingView.tsx` | Graphique natation |
| `src/components/StravaActivityMatcher.tsx` | Liaison Strava — ne pas écraser les champs planifiés |

---

## Gotchas connus

- `TypeScript local` passe mais `esbuild` (build prod) peut bloquer sur déclarations dupliquées de variables dans le même scope
- Les `serie_details` en JSON peuvent être stockés comme string ou object → toujours parser avec try/catch
- `daily_fatigue_log` peut avoir plusieurs entrées par jour (une par type de fatigue)
- Le build Docker prend 3-5 minutes → attendre avant de tester sur mobile
- Supabase RLS peut bloquer certaines requêtes côté sportif si les politiques ne sont pas en place
