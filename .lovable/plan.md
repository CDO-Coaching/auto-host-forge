

## Diagnostic : pourquoi les déconnexions sont plus fréquentes depuis le 20 février

### Causes identifiées

**1. Problème principal : `flowType: 'pkce'` sur un client Supabase auto-hébergé**

Le fichier `src/integrations/supabase/client.ts` utilise `flowType: 'pkce'`. Ce flow PKCE est conçu pour les redirections OAuth (Google, Apple, etc.) et la confirmation d'email. Mais pour les connexions classiques email/password, il introduit une complexité supplémentaire dans le refresh de token : chaque refresh nécessite un échange PKCE complet. Sur un Supabase auto-hébergé (`supabasekong.cdocoaching.com`), si le serveur GoTrue a des latences ou des timeouts, le refresh PKCE échoue silencieusement → l'utilisateur est déconnecté.

**Depuis ~20 février**, il est probable qu'une mise à jour du client Supabase JS (v2.76+) ou une modification de la config a rendu le refresh PKCE plus strict, ce qui explique les déconnexions soudaines.

**2. Race conditions dans le `onAuthStateChange`**

Quand un refresh token échoue (même transitoirement), Supabase émet un événement `SIGNED_OUT`. Le code actuel dans `AuthContext.tsx` tente un `refreshSession()` en réponse, mais :
- Si le refresh échoue aussi → l'état session n'est pas effacé MAIS les pages enfants (`DashboardSportif`, `DashboardCoach`) voient `session === null` transitoirement et redirigent vers `/auth`
- La redirection est **irréversible** : même si le refresh réussit 200ms plus tard, l'utilisateur est déjà sur `/auth`

**3. `visibilitychange` déclenche trop de refreshes**

Chaque retour au premier plan (changement d'onglet, déverrouillage du téléphone) déclenche un `refreshSession()`. Combiné avec le refresh proactif toutes les 10 minutes, cela crée des appels concurrents malgré le `refreshingRef` (qui n'est pas thread-safe dans un contexte async).

**4. `storageKey` personnalisé sans backup**

Le `storageKey: 'sb-cdo-auth-token'` est correct, mais l'ancienne logique de backup localStorage mentionnée dans les mémoires (`sb-session-backup`) a été supprimée, retirant un filet de sécurité.

### Plan de correction

**A. Retirer `flowType: 'pkce'` du client Supabase**

Le flow `implicit` (par défaut) est suffisant pour les connexions email/password et gère les refreshes de token de manière plus simple et fiable. Le PKCE n'est nécessaire que si l'app utilise OAuth (Google login, etc.), ce qui n'est pas le cas ici (seul email/password + confirmation email).

→ Supprimer `flowType: 'pkce'` de `client.ts`

**B. Protéger les redirections vers `/auth` avec un délai de grâce**

Dans `DashboardSportif.tsx` et `DashboardCoach.tsx`, ne pas rediriger vers `/auth` immédiatement quand `session === null`. Attendre que `loading` soit terminé ET qu'un 2e cycle de rendu confirme l'absence de session (évite les faux négatifs pendant un refresh).

**C. Rendre le `onAuthStateChange` plus résilient**

Dans `AuthContext.tsx` :
- Sur `SIGNED_OUT` non explicite : ne rien faire du tout (pas de `refreshSession` qui peut boucler). La session existante en mémoire reste valide jusqu'à expiration.
- Retirer le refresh dans `visibilitychange` (le `autoRefreshToken: true` de Supabase JS gère déjà ça nativement).
- Garder uniquement le refresh proactif toutes les 10 min comme filet de sécurité.

**D. Simplifier les pages Profil**

Les pages `sportif/Profil.tsx` et `coach/Profil.tsx` font leur propre `getSession()` + `refreshSession()` indépendamment du contexte Auth. Les aligner sur `useAuth()` comme les dashboards pour éviter les appels redondants.

### Fichiers à modifier

1. `src/integrations/supabase/client.ts` — retirer `flowType: 'pkce'`
2. `src/contexts/AuthContext.tsx` — simplifier le handler `SIGNED_OUT`, retirer le refresh `visibilitychange`
3. `src/pages/DashboardSportif.tsx` — ajouter un garde contre les redirections trop rapides
4. `src/pages/DashboardCoach.tsx` — idem
5. `src/pages/sportif/Profil.tsx` — utiliser `useAuth()` au lieu de `getSession()` direct
6. `src/pages/coach/Profil.tsx` — idem

