# 📚 CDO Coaching - Documentation Technique Complète

## Table des matières

1. [Introduction et Vue d'ensemble](#1-introduction-et-vue-densemble)
2. [Architecture Technique](#2-architecture-technique)
3. [Structure des Fichiers](#3-structure-des-fichiers)
4. [Système d'Authentification](#4-système-dauthentification)
5. [Interface Sportif (Athlète)](#5-interface-sportif-athlète)
6. [Interface Coach](#6-interface-coach)
7. [Base de Données (Supabase)](#7-base-de-données-supabase)
8. [Hooks Personnalisés](#8-hooks-personnalisés)
9. [Composants UI](#9-composants-ui)
10. [Fonctions Edge (Backend)](#10-fonctions-edge-backend)
11. [Système de Design](#11-système-de-design)
12. [Utilitaires et Helpers](#12-utilitaires-et-helpers)
13. [Intégrations Externes](#13-intégrations-externes)

---

## 1. Introduction et Vue d'ensemble

### 1.1 Qu'est-ce que CDO Coaching ?

CDO Coaching est une application web complète de coaching sportif personnalisé. Elle permet :
- Aux **coachs** de programmer des séances d'entraînement pour leurs athlètes
- Aux **sportifs** de consulter leurs séances, valider leurs exercices, et suivre leur progression

### 1.2 Technologies utilisées

| Technologie | Rôle | Pourquoi ce choix |
|-------------|------|-------------------|
| **React 18** | Framework Frontend | Composants réutilisables, gestion d'état efficace |
| **TypeScript** | Typage statique | Détection d'erreurs à la compilation, meilleure maintenabilité |
| **Vite** | Bundler | Démarrage ultra-rapide, Hot Module Replacement |
| **Tailwind CSS** | Styles | Classes utilitaires, design system cohérent |
| **shadcn/ui** | Composants UI | Composants accessibles et personnalisables |
| **Supabase** | Backend-as-a-Service | Base de données PostgreSQL, Auth, Storage, Edge Functions |
| **React Router** | Navigation | Routing côté client |
| **TanStack Query** | Gestion des données | Cache, synchronisation, refetch automatique |

---

## 2. Architecture Technique

### 2.1 Point d'entrée de l'application

#### `src/main.tsx` - Le point de démarrage

```typescript
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// createRoot est la nouvelle API React 18 pour le rendu concurrent
// Elle remplace ReactDOM.render() et permet des fonctionnalités comme Suspense
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* StrictMode active des vérifications supplémentaires en développement */}
    <App />
  </React.StrictMode>,
);
```

**Explication détaillée :**
- `createRoot()` : Nouvelle API React 18 qui active le mode concurrent
- `document.getElementById("root")!` : Le `!` indique à TypeScript que l'élément existe (non-null assertion)
- `<React.StrictMode>` : Active des vérifications supplémentaires en mode développement

#### Service Worker (PWA)

```typescript
// Enregistrer le service worker UNIQUEMENT en production
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js");
      
      // Vérifie périodiquement s'il y a une nouvelle version
      setInterval(() => {
        registration.update();
      }, 60000); // Vérifie toutes les minutes
    } catch (error) {
      console.error("Erreur Service Worker:", error);
    }
  });
}
```

**Pourquoi un Service Worker ?**
- Permet l'installation comme application (PWA)
- Cache les ressources pour un fonctionnement hors-ligne
- Améliore les performances avec le cache

---

### 2.2 Composant App Principal

#### `src/App.tsx` - L'orchestrateur

```typescript
import React, { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";

// QueryClient gère le cache et la synchronisation des données
const queryClient = new QueryClient();

// Lazy loading : les pages sont chargées uniquement quand nécessaires
const Index = lazy(() => import("./pages/Index"));
const DashboardCoach = lazy(() => import("./pages/DashboardCoach"));
const DashboardSportif = lazy(() => import("./pages/DashboardSportif"));
// ... autres imports lazy

const App = () => (
  // QueryClientProvider : fournit le client React Query à toute l'app
  <QueryClientProvider client={queryClient}>
    {/* TooltipProvider : permet les tooltips partout dans l'app */}
    <TooltipProvider>
      {/* Toaster : système de notifications (toasts) */}
      <Toaster />
      <Sonner />
      
      {/* BrowserRouter : active le routing avec l'API History */}
      <BrowserRouter>
        {/* AuthProvider : contexte d'authentification global */}
        <AuthProvider>
          {/* ScrollToTop : scrolle en haut à chaque changement de page */}
          <ScrollToTop />
          
          {/* Suspense : affiche un fallback pendant le chargement lazy */}
          <Suspense fallback={<div>Chargement...</div>}>
            <Routes>
              {/* Routes publiques */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              
              {/* Routes protégées Coach - le /* capture toutes les sous-routes */}
              <Route path="/coach/*" element={<DashboardCoach />} />
              
              {/* Routes protégées Sportif */}
              <Route path="/sportif/*" element={<DashboardSportif />} />
              
              {/* Route catch-all pour les 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
```

**Concepts clés expliqués :**

| Concept | Explication |
|---------|-------------|
| `lazy()` | Charge le composant uniquement quand la route est visitée (code splitting) |
| `Suspense` | Affiche un fallback pendant que le composant lazy se charge |
| `QueryClientProvider` | Fournit le cache React Query à tous les composants |
| `AuthProvider` | Contexte React qui partage l'état d'authentification |
| `path="/*"` | Le `*` permet de capturer toutes les sous-routes |

---

## 3. Structure des Fichiers

### 3.1 Organisation du projet

```
src/
├── assets/              # Images, logos, ressources statiques
├── components/          # Composants React réutilisables
│   └── ui/             # Composants shadcn/ui (Button, Card, etc.)
├── contexts/           # Contextes React (Auth, Theme)
├── hooks/              # Hooks personnalisés
├── integrations/       # Configuration des services externes
│   └── supabase/       # Client Supabase
├── lib/                # Fonctions utilitaires
├── pages/              # Pages/Vues de l'application
│   ├── coach/          # Pages spécifiques au coach
│   └── sportif/        # Pages spécifiques au sportif
└── App.tsx             # Composant racine
```

### 3.2 Conventions de nommage

| Type | Convention | Exemple |
|------|------------|---------|
| Composants | PascalCase | `CoachSidebar.tsx` |
| Hooks | camelCase avec préfixe `use` | `useUserProfile.ts` |
| Utilitaires | camelCase | `weekUtils.ts` |
| Pages | PascalCase | `SeanceDetail.tsx` |
| Constantes | SCREAMING_SNAKE_CASE | `STRIPE_PUBLIC_KEY` |

---

## 4. Système d'Authentification

### 4.1 Contexte d'Authentification

#### `src/contexts/AuthContext.tsx`

```typescript
import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Interface définissant la forme du contexte
interface AuthContextType {
  session: Session | null;  // Session Supabase (contient le token JWT)
  user: User | null;        // Utilisateur connecté
  loading: boolean;         // État de chargement initial
}

// Création du contexte avec des valeurs par défaut
const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
});

// Hook personnalisé pour accéder au contexte
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Écouter les changements d'état d'authentification
    // Cette subscription se déclenche lors de :
    // - Connexion
    // - Déconnexion
    // - Renouvellement du token
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // 2. Vérifier s'il y a une session existante (page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Cleanup : se désabonner quand le composant se démonte
    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
```

**Pourquoi ce pattern ?**
- Le contexte permet de partager l'état d'authentification sans prop drilling
- `onAuthStateChange` maintient l'état synchronisé avec Supabase
- Le `loading` permet d'éviter les flashs d'UI pendant la vérification initiale

### 4.2 Page d'Authentification

#### `src/pages/Auth.tsx`

```typescript
const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);           // Toggle connexion/inscription
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [healthDataConsent, setHealthDataConsent] = useState(false);  // RGPD

  const navigate = useNavigate();
  const { session, loading } = useAuth();

  // Redirection automatique si déjà connecté
  useEffect(() => {
    if (loading) return;  // Attendre que l'auth soit initialisée

    if (session) {
      // L'utilisateur est connecté, rediriger selon son rôle
      const redirectUser = async () => {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("approved, role, first_name, last_name")
          .eq("id", session.user.id)
          .single();

        // Logique de redirection selon l'état du profil
        if (!profile?.first_name || !profile?.last_name) {
          navigate("/sportif/profil");  // Profil incomplet
        } else if (!profile?.approved) {
          navigate("/en-attente");       // En attente d'approbation
        } else if (profile.role === "coach") {
          navigate("/coach/mes-clients"); // Dashboard coach
        } else {
          navigate("/sportif/seances");   // Dashboard sportif
        }
      };
      redirectUser();
    }
  }, [session, loading, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (isLogin) {
        // === CONNEXION ===
        const { data, error } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
        });
        if (error) throw error;
        
        toast({ title: "Connexion réussie" });
        // La redirection est gérée par le useEffect ci-dessus
        
      } else {
        // === INSCRIPTION ===
        
        // Vérification du consentement RGPD (obligatoire)
        if (!healthDataConsent) {
          toast({
            variant: "destructive",
            title: "Consentement requis",
            description: "Vous devez accepter le traitement des données de santé."
          });
          return;
        }

        // Création du compte avec Supabase Auth
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { 
            emailRedirectTo: `${window.location.origin}/auth/callback` 
          },
        });
        if (error) throw error;

        // Création du profil utilisateur dans notre table
        await supabase.from("user_profiles").insert({
          id: data.user?.id,
          email: email,
          role: "sportif",           // Par défaut, les nouveaux sont des sportifs
          approved: false,           // Doit être approuvé par un coach
          health_data_consent: true,
          health_data_consent_at: new Date().toISOString(),
        });

        // Notification au coach (webhook)
        await supabase.functions.invoke("notify-signup", {
          body: { email, signupDate: new Date().toISOString() },
        });
      }
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Erreur", 
        description: error.message 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <form onSubmit={handleAuth}>
        <Input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
        />
        <Input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
        />
        
        {/* Case à cocher RGPD - uniquement à l'inscription */}
        {!isLogin && (
          <Checkbox 
            checked={healthDataConsent}
            onCheckedChange={(checked) => setHealthDataConsent(checked === true)}
          />
        )}
        
        <Button type="submit" disabled={isSubmitting}>
          {isLogin ? "Se connecter" : "Créer mon compte"}
        </Button>
      </form>
    </Card>
  );
};
```

**Points importants :**
- Deux modes : connexion et inscription (toggle)
- Consentement RGPD obligatoire à l'inscription
- Redirection automatique selon le rôle et l'état du profil
- Webhooks pour notifier le coach des nouvelles inscriptions

---

## 5. Interface Sportif (Athlète)

### 5.1 Dashboard Sportif

#### `src/pages/DashboardSportif.tsx`

```typescript
export default function DashboardSportif() {
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const { session, loading: authLoading } = useAuth();
  
  // Hooks pour les rappels quotidiens
  const { shouldShowDialog, handleClose } = useDailyFatigueCheck();
  const { shouldShowReminder: shouldShowWeightReminder, handleDismiss } = useWeeklyWeightReminder();

  // Protection de route : vérifier l'accès
  useEffect(() => {
    if (authLoading) return;  // Attendre le chargement

    const checkAccess = async () => {
      if (!session) {
        navigate("/auth", { replace: true });  // Pas connecté
        return;
      }

      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("approved, role")
        .eq("id", session.user.id)
        .single();

      if (!profileData?.approved) {
        navigate("/en-attente");  // Pas encore approuvé
        return;
      }

      if (profileData.role === "coach") {
        navigate("/coach/programmation");  // C'est un coach, pas un sportif
        return;
      }
    };

    checkAccess();
  }, [session, authLoading, navigate]);

  // Affichage du loader pendant la vérification
  if (authLoading || !session) {
    return <div>Chargement...</div>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Sidebar avec navigation */}
        <SportifSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header avec salutation personnalisée */}
          <header className="h-14 border-b flex items-center px-4">
            <SidebarTrigger />
            <h2>Salut {profile?.first_name || "Sportif"} 👋</h2>
          </header>
          
          {/* Contenu principal avec sous-routes */}
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/sportif/seances" replace />} />
              <Route path="/seances" element={<Seances />} />
              <Route path="/seance/:weekId/:sessionId" element={<SeanceDetail />} />
              <Route path="/fatigue" element={<Fatigue />} />
              <Route path="/maxes" element={<Maxes />} />
              {/* ... autres routes */}
            </Routes>
          </main>
        </div>
        
        {/* Bulle de chat flottante */}
        <ChatBubble />
      </div>
      
      {/* Dialogs de rappels */}
      <DailyFatigueDialog 
        open={shouldShowDialog} 
        onClose={handleClose}
      />
      <WeightReminderDialog 
        open={shouldShowWeightReminder}
        onDismiss={handleDismiss}
      />
    </SidebarProvider>
  );
}
```

**Architecture de la page :**
- `SidebarProvider` : Gère l'état ouvert/fermé de la sidebar
- Protection de route avec vérification du rôle et de l'approbation
- Sous-routage avec `<Routes>` pour les différentes sections
- Dialogs conditionnels pour les rappels (fatigue, poids)

### 5.2 Page des Séances

#### `src/pages/sportif/Seances.tsx`

```typescript
export default function Seances() {
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const [weeks, setWeeks] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeeks();
  }, []);

  const loadWeeks = async () => {
    setLoading(true);
    
    // Récupérer toutes les semaines validées par le coach
    const { data, error } = await supabase
      .from("training_weeks")
      .select("*")
      .eq("validated", true)  // Seulement les semaines validées
      .order("year", { ascending: false })
      .order("week_number", { ascending: false });

    if (data) {
      // Filtrer pour ne garder que les semaines passées ou actuelles
      const now = new Date();
      const currentYear = getWeekYear(now);
      const currentWeekNumber = getWeekNumber(now);

      const filteredWeeks = data.filter((week) => {
        if (week.year < currentYear) return true;
        if (week.year > currentYear) return false;
        return week.week_number <= currentWeekNumber;
      });

      setWeeks(filteredWeeks);
      
      // Sélectionner automatiquement la semaine actuelle
      const currentWeek = filteredWeeks.find(
        (week) => week.week_number === currentWeekNumber && week.year === currentYear
      );
      
      if (currentWeek) {
        loadWeekSessions(currentWeek.id);
        setSelectedWeek(currentWeek);
      }
    }
    setLoading(false);
  };

  const loadWeekSessions = async (weekId: string) => {
    // Récupérer les séances avec leurs exercices
    const { data } = await supabase
      .from("training_sessions")
      .select(`
        *,
        session_exercises (*)
      `)
      .eq("week_id", weekId)
      .order("session_number");

    if (data) {
      // Trier : séances non complétées en premier
      const sorted = data.sort((a, b) => {
        const aCompleted = isSessionCompleted(a);
        const bCompleted = isSessionCompleted(b);
        if (aCompleted === bCompleted) {
          return a.session_number - b.session_number;
        }
        return aCompleted ? 1 : -1;  // Non complétées en premier
      });
      setSessions(sorted);
    }
  };

  // Déterminer si une séance est complétée
  const isSessionCompleted = useCallback((session: any) => {
    if (!session.session_exercises?.length) return false;
    
    // Pour les séances Récup : vérifier la durée
    if (session.session_type === "recup") {
      return session.duration_minutes !== null;
    }
    
    // Pour les autres : tous les exercices doivent avoir un RPE ou être skipped
    return session.session_exercises.every((ex: any) => 
      ex.sportif_rpe !== null || ex.skipped === true
    );
  }, []);

  return (
    <div>
      {/* Sélecteur de semaine */}
      <select
        value={selectedWeek?.id || ""}
        onChange={(e) => handleWeekChange(e.target.value)}
      >
        {weeks.map((week) => (
          <option key={week.id} value={week.id}>
            S{week.week_number} - {week.year}
          </option>
        ))}
      </select>

      {/* Liste des séances */}
      {sessions.map((session) => {
        const completed = isSessionCompleted(session);
        
        return (
          <Card
            key={session.id}
            className={completed ? "border-green-500" : ""}
            onClick={() => navigate(`/sportif/seance/${selectedWeek.id}/${session.id}`)}
          >
            <h3>{session.name}</h3>
            <Badge>{session.session_exercises?.length} exercices</Badge>
            {completed && <CheckCircle2 className="text-green-500" />}
          </Card>
        );
      })}
    </div>
  );
}
```

**Logique métier :**
- Chargement des semaines validées par le coach
- Filtrage pour n'afficher que les semaines passées/actuelles
- Tri des séances : non complétées en premier pour encourager l'action
- Indicateur visuel pour les séances terminées

### 5.3 Détail d'une Séance

#### `src/pages/sportif/SeanceDetail.tsx`

```typescript
export default function SeanceDetail() {
  useWakeLock(true);  // Empêche l'écran de s'éteindre pendant l'entraînement
  
  const { weekId, sessionId } = useParams();
  const [session, setSession] = useState<any>(null);
  const [exercises, setExercises] = useState<any[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  const [isSessionActive, setIsSessionActive] = useState(false);

  // Restaurer le timer depuis localStorage (en cas de refresh)
  useEffect(() => {
    const savedTimer = localStorage.getItem(`session_timer_${sessionId}`);
    if (savedTimer) {
      const { startTime, isActive } = JSON.parse(savedTimer);
      if (isActive) {
        setSessionStartTime(startTime);
        setIsSessionActive(true);
        
        // Recalculer le temps écoulé
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setSessionDuration(elapsed);
        
        // Relancer le timer
        const interval = setInterval(() => {
          const currentElapsed = Math.floor((Date.now() - startTime) / 1000);
          setSessionDuration(currentElapsed);
          
          // Arrêt automatique après 2 heures
          if (currentElapsed >= 7200) {
            clearInterval(interval);
            // Sauvegarder la séance
          }
        }, 1000);
      }
    }
  }, [sessionId]);

  const loadSessionDetail = async () => {
    const { data } = await supabase
      .from("training_sessions")
      .select(`*, session_exercises (*)`)
      .eq("id", sessionId)
      .single();

    if (data) {
      setSession(data);
      
      // Regrouper les exercices par superset
      const grouped = groupExercisesBySuperset(data.session_exercises);
      setExercises(grouped);
    }
  };

  // Grouper les exercices qui font partie d'un superset
  const groupExercisesBySuperset = (exercises: any[]) => {
    const grouped: any[] = [];
    const processedGroups = new Set<string>();

    exercises.forEach((exercise) => {
      if (exercise.super_set_group && !processedGroups.has(exercise.super_set_group)) {
        // C'est un superset - regrouper tous les exercices du groupe
        processedGroups.add(exercise.super_set_group);
        const supersetExercises = exercises.filter(
          (ex) => ex.super_set_group === exercise.super_set_group
        );
        grouped.push({
          isSuperset: true,
          exercises: supersetExercises,
        });
      } else if (!exercise.super_set_group) {
        // Exercice normal
        grouped.push(exercise);
      }
    });

    return grouped;
  };

  // Démarrer le chronomètre de séance
  const startSession = () => {
    const startTime = Date.now();
    setSessionStartTime(startTime);
    setIsSessionActive(true);
    
    // Sauvegarder dans localStorage (persistance en cas de refresh)
    localStorage.setItem(`session_timer_${sessionId}`, JSON.stringify({ 
      startTime, 
      isActive: true 
    }));
    
    // Démarrer le timer
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setSessionDuration(elapsed);
    }, 1000);
  };

  // Terminer la séance
  const handleSessionCompletion = async (data: { date: Date; rpe: number; comment: string }) => {
    // Arrêter le timer
    clearInterval(timerInterval);
    localStorage.removeItem(`session_timer_${sessionId}`);
    
    // Marquer les exercices non faits comme "skipped"
    const incompleteExercises = exercises.filter(ex => ex.sportif_rpe === null);
    if (incompleteExercises.length > 0) {
      await supabase
        .from("session_exercises")
        .update({ skipped: true })
        .in("id", incompleteExercises.map(ex => ex.id));
    }
    
    // Sauvegarder la séance
    await supabase
      .from("training_sessions")
      .update({
        duration_minutes: Math.floor(sessionDuration / 60),
        completed_at: data.date.toISOString(),
        session_rpe: data.rpe,
        session_comment: data.comment,
      })
      .eq("id", sessionId);
    
    // Célébration !
    setShowCelebration(true);
  };

  return (
    <div>
      {/* Header avec timer */}
      <div className="flex justify-between">
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft /> Retour
        </Button>
        
        {isSessionActive ? (
          <div>
            <span>{formatDuration(sessionDuration)}</span>
            <Button onClick={requestEndSession}>
              <Square /> Terminer
            </Button>
          </div>
        ) : (
          <Button onClick={startSession}>
            <Play /> Démarrer
          </Button>
        )}
      </div>

      {/* Liste des exercices */}
      {exercises.map((item, index) => (
        item.isSuperset ? (
          <SupersetCard key={item.super_set_group} exercises={item.exercises} />
        ) : (
          <ExerciseCard key={item.id} exercise={item} />
        )
      ))}

      {/* Dialog de validation finale */}
      <SessionCompletionDialog
        open={completionDialogOpen}
        onComplete={handleSessionCompletion}
        duration={sessionDuration}
      />
      
      {/* Animation de célébration */}
      <CelebrationOverlay show={showCelebration} />
    </div>
  );
}
```

**Fonctionnalités clés :**
- **Wake Lock** : Empêche l'écran de s'éteindre
- **Timer persistant** : Sauvegardé dans localStorage, survit aux refresh
- **Supersets** : Exercices groupés visuellement
- **Validation flexible** : Les exercices non faits sont marqués "skipped"
- **Célébration** : Animation de félicitations à la fin

---

## 6. Interface Coach

### 6.1 Dashboard Coach

#### `src/pages/DashboardCoach.tsx`

```typescript
export default function DashboardCoach() {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const { profile } = useUserProfile();
  const { session, loading: authLoading } = useAuth();
  
  // Hooks pour les différents rappels
  const { shouldShowReminder, handleDismiss } = useCoachDailyPaymentReminder();
  const { reminders: pauseReminders, dismissReminder } = useCoachPauseReminders(profile?.id);
  const { pendingReminder, acknowledgeReminder } = useCoachNoteReminder();
  const { birthdayAthletes, dismissBirthday } = useCoachBirthdayReminder(profile?.id);

  // Vérification d'accès
  useEffect(() => {
    if (authLoading) return;

    const checkAccess = async () => {
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }

      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("approved, role")
        .eq("id", session.user.id)
        .single();

      if (!profileData?.approved) {
        navigate("/en-attente");
        return;
      }

      if (profileData.role !== "coach") {
        navigate("/sportif/seances");  // Ce n'est pas un coach
        return;
      }
    };

    checkAccess();
  }, [session, authLoading, navigate]);

  // Charger le nombre de demandes en attente
  useEffect(() => {
    const loadPendingRequests = async () => {
      if (!profile?.id) return;

      const { data } = await supabase
        .from("coach_athlete_relationships")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", profile.id)
        .eq("status", "pending");

      if (data) {
        setPendingCount(data.length);
      }
    };

    loadPendingRequests();
  }, [profile]);

  return (
    <>
      {/* Dialogs de rappels */}
      <CoachPaymentReminderDialog open={shouldShowReminder} onDismiss={handleDismiss} />
      <CoachNoteReminderDialog open={!!pendingReminder} {...pendingReminder} />
      
      {pauseReminders.length > 0 && (
        <CoachPauseReminderAlert reminders={pauseReminders} onDismiss={dismissReminder} />
      )}

      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <CoachSidebar />
          
          <div className="flex-1 flex flex-col">
            <header>
              <SidebarTrigger />
              <h2>Salut {profile?.first_name || "Coach"} 👋</h2>
            </header>
            
            <main>
              {/* Alerte anniversaires */}
              {birthdayAthletes.length > 0 && (
                <CoachBirthdayAlert athletes={birthdayAthletes} onDismiss={dismissBirthday} />
              )}
              
              {/* Alerte demandes en attente */}
              {pendingCount > 0 && (
                <Alert>
                  Tu as {pendingCount} nouvelle(s) demande(s) !
                  <Button onClick={() => navigate("/coach/mes-clients")}>
                    Voir les demandes
                  </Button>
                </Alert>
              )}
              
              {/* Sous-routes */}
              <Routes>
                <Route path="/mes-clients" element={<MesClients />} />
                <Route path="/client/:athleteId" element={<ClientDetail />} />
                <Route path="/messagerie" element={<Messagerie />} />
                {/* ... */}
              </Routes>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </>
  );
}
```

### 6.2 Gestion des Clients

#### `src/pages/coach/MesClients.tsx`

```typescript
export default function MesClients() {
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  
  const [pendingRequests, setPendingRequests] = useState<AthleteRelationship[]>([]);
  const [approvedAthletes, setApprovedAthletes] = useState<AthleteRelationship[]>([]);
  const [pausedAthletes, setPausedAthletes] = useState<AthleteRelationship[]>([]);
  const [externalClients, setExternalClients] = useState<ExternalClient[]>([]);

  const loadRelationships = async () => {
    if (!profile?.id) return;

    // Récupérer les relations (pending, approved, paused)
    const [pendingRels, approvedRels, pausedRels] = await Promise.all([
      supabase
        .from("coach_athlete_relationships")
        .select("id, athlete_id, status, requested_at")
        .eq("coach_id", profile.id)
        .eq("status", "pending"),
      supabase
        .from("coach_athlete_relationships")
        .select("id, athlete_id, status, requested_at")
        .eq("coach_id", profile.id)
        .eq("status", "approved"),
      supabase
        .from("coach_athlete_relationships")
        .select("id, athlete_id, status, requested_at")
        .eq("coach_id", profile.id)
        .eq("status", "paused"),
    ]);

    // Charger les profils des athlètes
    const athleteIds = [...pendingRels.data, ...approvedRels.data, ...pausedRels.data]
      .map(r => r.athlete_id);

    const { data: athletes } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, email")
      .in("id", athleteIds);

    // Compter les semaines programmées à l'avance pour chaque athlète
    // Cela permet de voir qui a besoin d'une nouvelle programmation
    const currentWeek = getWeekNumber(new Date());
    const { data: weeks } = await supabase
      .from("training_weeks")
      .select("athlete_id, week_number, year")
      .in("athlete_id", athleteIds)
      .eq("validated", true);

    // Calculer combien de semaines d'avance chaque athlète a
    // ...
  };

  // Accepter/Refuser une demande
  const handleResponse = async (relationshipId: string, status: "approved" | "rejected") => {
    await supabase
      .from("coach_athlete_relationships")
      .update({
        status,
        responded_at: new Date().toISOString(),
      })
      .eq("id", relationshipId);

    toast.success(status === "approved" 
      ? "Demande acceptée !" 
      : "Demande refusée"
    );
    
    await loadRelationships();
  };

  // Mettre en pause un athlète (avec rappel optionnel)
  const handlePauseConfirm = async (reminderDate: Date | null) => {
    await supabase
      .from("coach_athlete_relationships")
      .update({
        status: "paused",
        reminder_date: reminderDate?.toISOString() || null,
      })
      .eq("id", selectedAthleteForPause.id);

    // Désactiver l'accès de l'athlète
    await supabase
      .from("user_profiles")
      .update({ approved: false })
      .eq("id", selectedAthleteForPause.athlete_id);
  };

  return (
    <Tabs defaultValue="approved">
      <TabsList>
        <TabsTrigger value="pending">
          En attente {pendingRequests.length > 0 && `(${pendingRequests.length})`}
        </TabsTrigger>
        <TabsTrigger value="approved">
          Actifs ({approvedAthletes.length})
        </TabsTrigger>
        <TabsTrigger value="paused">
          En pause ({pausedAthletes.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="pending">
        {pendingRequests.map((request) => (
          <Card key={request.id}>
            <span>{request.athlete.first_name} {request.athlete.last_name}</span>
            <Button onClick={() => handleResponse(request.id, "approved")}>
              <Check /> Accepter
            </Button>
            <Button onClick={() => handleResponse(request.id, "rejected")}>
              <X /> Refuser
            </Button>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="approved">
        {/* Liste des athlètes actifs avec indication des semaines programmées */}
        {approvedAthletes.map((rel) => (
          <Card 
            key={rel.id}
            onClick={() => navigate(`/coach/client/${rel.athlete_id}`)}
          >
            <span>{rel.athlete.first_name} {rel.athlete.last_name}</span>
            <Badge>{rel.weeksAheadCount} semaines d'avance</Badge>
          </Card>
        ))}
      </TabsContent>
    </Tabs>
  );
}
```

### 6.3 Programmation d'un Athlète

#### `src/pages/coach/ClientDetail.tsx` (5420 lignes - le plus gros fichier)

Ce fichier gère la programmation complète des séances. Voici les sections principales :

```typescript
export default function ClientDetail() {
  const { athleteId } = useParams();
  
  // États principaux
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionExercises, setSessionExercises] = useState<Record<number, Exercise[]>>({});
  const [selectedWeekToProgram, setSelectedWeekToProgram] = useState({ week: currentWeek, year: currentYear });
  
  // Vues analytiques
  const [activeTab, setActiveTab] = useState("programmation");  // programmation | stats | fatigue | etc.

  // === SECTION 1: Chargement des données ===
  
  const loadAthleteData = async () => {
    // Charger le profil de l'athlète
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", athleteId)
      .single();
    setAthlete(data);
  };

  // === SECTION 2: Gestion des séances ===
  
  const addSession = () => {
    const newSession = {
      id: Date.now(),  // ID temporaire
      name: `Séance ${sessions.length + 1}`,
      isExpanded: true,
      session_type: "renfo" as const,
    };
    setSessions([...sessions, newSession]);
    setSessionExercises({
      ...sessionExercises,
      [newSession.id]: [],
    });
  };

  // === SECTION 3: Gestion des exercices ===
  
  const addExercise = (sessionId: number) => {
    const newExercise = {
      id: Date.now(),
      exercice: "",
      series: "",
      reps: "",
      charge: "",
      recuperation: "",
      tempo: "",
      rpe: "",
      commentaire: "",
    };
    
    setSessionExercises({
      ...sessionExercises,
      [sessionId]: [...(sessionExercises[sessionId] || []), newExercise],
    });
  };

  const updateExercise = (sessionId: number, exerciseId: number, field: string, value: any) => {
    setSessionExercises({
      ...sessionExercises,
      [sessionId]: sessionExercises[sessionId].map((ex) =>
        ex.id === exerciseId ? { ...ex, [field]: value } : ex
      ),
    });
  };

  // === SECTION 4: Validation de la semaine ===
  
  const validateWeek = async () => {
    // 1. Créer la semaine d'entraînement
    const { data: weekData, error: weekError } = await supabase
      .from("training_weeks")
      .insert({
        athlete_id: athleteId,
        week_number: selectedWeekToProgram.week,
        year: selectedWeekToProgram.year,
        validated: true,
      })
      .select()
      .single();

    if (weekError) {
      toast.error("Erreur lors de la création de la semaine");
      return;
    }

    // 2. Créer les séances
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      
      const { data: sessionData, error: sessionError } = await supabase
        .from("training_sessions")
        .insert({
          week_id: weekData.id,
          name: session.name,
          session_number: i + 1,
          session_type: session.session_type,
        })
        .select()
        .single();

      if (sessionError) continue;

      // 3. Créer les exercices
      const exercises = sessionExercises[session.id] || [];
      for (let j = 0; j < exercises.length; j++) {
        const ex = exercises[j];
        
        await supabase
          .from("session_exercises")
          .insert({
            session_id: sessionData.id,
            exercise_name: ex.exercice,
            series: ex.series,
            reps: ex.reps,
            charge: ex.charge,
            recuperation: ex.recuperation,
            tempo: ex.tempo,
            target_rpe: ex.rpe,
            commentaire: ex.commentaire,
            exercise_order: j + 1,
          });
      }
    }

    toast.success("Semaine validée !");
    
    // Vider le formulaire
    setSessions([]);
    setSessionExercises({});
    localStorage.removeItem(`coach-programming-${athleteId}`);
    
    // Recharger l'historique
    loadHistoricalWeeks();
  };

  // === SECTION 5: Copie d'une semaine précédente ===
  
  const copyWeekToEditor = async (weekId: string) => {
    // Charger les séances de la semaine à copier
    const { data: sessionsData } = await supabase
      .from("training_sessions")
      .select(`*, session_exercises (*)`)
      .eq("week_id", weekId)
      .order("session_number");

    // Recréer la structure dans l'éditeur
    const newSessions = sessionsData.map((s, i) => ({
      id: Date.now() + i,
      name: s.name,
      isExpanded: false,
      session_type: s.session_type,
    }));

    const newExercises: Record<number, Exercise[]> = {};
    sessionsData.forEach((s, i) => {
      newExercises[newSessions[i].id] = s.session_exercises.map((ex, j) => ({
        id: Date.now() + i * 100 + j,
        exercice: ex.exercise_name,
        series: ex.series,
        reps: ex.reps,
        charge: ex.charge,
        recuperation: ex.recuperation,
        tempo: ex.tempo,
        rpe: ex.target_rpe,
        commentaire: ex.commentaire,
      }));
    });

    setSessions(newSessions);
    setSessionExercises(newExercises);
    
    toast.success("Semaine copiée dans l'éditeur !");
  };

  return (
    <div>
      {/* Header avec infos athlète */}
      <div className="flex items-center gap-4">
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft /> Retour
        </Button>
        <h1>{athlete?.first_name} {athlete?.last_name}</h1>
      </div>

      {/* Onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="programmation">Programmation</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
          <TabsTrigger value="fatigue">Fatigue</TabsTrigger>
          <TabsTrigger value="maxes">Maxes</TabsTrigger>
        </TabsList>

        <TabsContent value="programmation">
          {/* Sélecteur de semaine */}
          <Select value={`${selectedWeekToProgram.week}-${selectedWeekToProgram.year}`}>
            {availableWeeks.map((week) => (
              <SelectItem key={week.week} value={`${week.week}-${week.year}`}>
                Semaine {week.week} ({formatWeekRange(week.date)})
              </SelectItem>
            ))}
          </Select>

          {/* Liste des séances */}
          {sessions.map((session) => (
            <Collapsible key={session.id}>
              <CollapsibleTrigger>
                <Input
                  value={session.name}
                  onChange={(e) => updateSessionName(session.id, e.target.value)}
                />
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                {/* Liste des exercices */}
                {sessionExercises[session.id]?.map((exercise) => (
                  <div key={exercise.id} className="grid grid-cols-7 gap-2">
                    <ExerciseCombobox
                      value={exercise.exercice}
                      onChange={(val) => updateExercise(session.id, exercise.id, "exercice", val)}
                    />
                    <Input
                      placeholder="Séries"
                      value={exercise.series}
                      onChange={(e) => updateExercise(session.id, exercise.id, "series", e.target.value)}
                    />
                    <Input
                      placeholder="Reps"
                      value={exercise.reps}
                      onChange={(e) => updateExercise(session.id, exercise.id, "reps", e.target.value)}
                    />
                    {/* ... autres champs */}
                  </div>
                ))}
                
                <Button onClick={() => addExercise(session.id)}>
                  <Plus /> Ajouter un exercice
                </Button>
              </CollapsibleContent>
            </Collapsible>
          ))}

          <Button onClick={addSession}>
            <Plus /> Ajouter une séance
          </Button>

          <Button onClick={validateWeek} variant="hero">
            Valider la semaine
          </Button>
        </TabsContent>

        <TabsContent value="stats">
          <CoachStrengthView athleteId={athleteId} />
          <CoachRunningView athleteId={athleteId} />
          <CoachCyclingView athleteId={athleteId} />
        </TabsContent>

        <TabsContent value="fatigue">
          <CoachFatigueView athleteId={athleteId} />
        </TabsContent>

        <TabsContent value="maxes">
          <CoachMaxesView athleteId={athleteId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## 7. Base de Données (Supabase)

### 7.1 Tables Principales

```sql
-- Profils utilisateurs
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'sportif',      -- 'sportif' ou 'coach'
  approved BOOLEAN DEFAULT FALSE,    -- Doit être approuvé par un coach
  date_of_birth DATE,
  gender TEXT,
  vma DECIMAL,                       -- Vitesse Maximale Aérobie
  fc_max INTEGER,                    -- Fréquence cardiaque max
  fc_repos INTEGER,                  -- FC au repos
  health_data_consent BOOLEAN,       -- Consentement RGPD
  payment_enabled BOOLEAN            -- Accès au module paiement
);

-- Relations coach-athlète
CREATE TABLE coach_athlete_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID REFERENCES user_profiles(id),
  athlete_id UUID REFERENCES user_profiles(id),
  status TEXT DEFAULT 'pending',     -- pending, approved, rejected, paused
  requested_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP,
  reminder_date DATE                 -- Pour les athlètes en pause
);

-- Semaines d'entraînement
CREATE TABLE training_weeks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID REFERENCES user_profiles(id),
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  validated BOOLEAN DEFAULT FALSE,   -- Validée par le coach
  created_at TIMESTAMP DEFAULT NOW()
);

-- Séances
CREATE TABLE training_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_id UUID REFERENCES training_weeks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  session_number INTEGER,
  session_type TEXT DEFAULT 'renfo', -- renfo, cardio, recup
  duration_minutes INTEGER,          -- Rempli par le sportif
  completed_at TIMESTAMP,            -- Date de réalisation
  session_rpe INTEGER,               -- RPE global de la séance
  session_comment TEXT,
  scheduled_date DATE                -- Date programmée (optionnel)
);

-- Exercices
CREATE TABLE session_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  series TEXT,
  reps TEXT,
  charge TEXT,
  recuperation TEXT,
  tempo TEXT,
  target_rpe TEXT,
  commentaire TEXT,
  exercise_order INTEGER,
  -- Champs remplis par le sportif
  sportif_rpe INTEGER,
  sportif_comment TEXT,
  skipped BOOLEAN DEFAULT FALSE,
  -- Pour les supersets
  super_set_group TEXT,
  -- Cardio
  cardio_sport TEXT,
  cardio_content JSONB
);

-- Suivi de fatigue quotidien
CREATE TABLE daily_fatigue_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id),
  date DATE NOT NULL,
  fatigue INTEGER,      -- 1-7
  courbatures INTEGER,  -- 1-7
  sommeil INTEGER,      -- 1-7
  stress INTEGER,       -- 1-7
  score_total INTEGER,  -- Calculé (4-28)
  has_injury BOOLEAN,
  injury_level INTEGER,
  injury_location TEXT
);

-- Maxes (records personnels)
CREATE TABLE exercise_maxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id),
  exercise_id UUID REFERENCES exercise_library(id),
  weight_kg DECIMAL NOT NULL,
  max_type TEXT DEFAULT '1RM',
  recorded_at TIMESTAMP DEFAULT NOW()
);
```

### 7.2 Row Level Security (RLS)

```sql
-- Les athlètes ne voient que leurs propres données
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Les coachs peuvent voir les profils de leurs athlètes
CREATE POLICY "Coaches can view their athletes"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM coach_athlete_relationships
      WHERE coach_id = auth.uid()
      AND athlete_id = user_profiles.id
      AND status = 'approved'
    )
  );

-- Les athlètes ne voient que leurs séances
CREATE POLICY "Athletes see own sessions"
  ON training_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM training_weeks
      WHERE training_weeks.id = training_sessions.week_id
      AND training_weeks.athlete_id = auth.uid()
    )
  );
```

---

## 8. Hooks Personnalisés

### 8.1 useUserProfile

```typescript
// src/hooks/useUserProfile.ts

export const useUserProfile = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      // Récupérer la session active
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoading(false);
        return;
      }

      // Charger le profil depuis la base
      const { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (data) {
        setProfile(data);
      }
      setLoading(false);
    };

    loadProfile();

    // Écouter les changements de profil en temps réel
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles'
        },
        (payload) => {
          // Mettre à jour le profil quand il change dans la base
          setProfile(payload.new as UserProfile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { profile, loading };
};
```

**Utilisation :**
```typescript
const MyComponent = () => {
  const { profile, loading } = useUserProfile();
  
  if (loading) return <Spinner />;
  
  return <h1>Bonjour {profile?.first_name}</h1>;
};
```

### 8.2 useDailyFatigueCheck

```typescript
// src/hooks/useDailyFatigueCheck.ts

export function useDailyFatigueCheck() {
  const [shouldShowDialog, setShouldShowDialog] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkDailyFatigue();
  }, []);

  const checkDailyFatigue = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsChecking(false);
        return;
      }

      // Vérifier si les notifications sont désactivées
      const notificationPreference = localStorage.getItem(`fatigue_notifications_${user.id}`);
      if (notificationPreference === 'false') {
        setIsChecking(false);
        return;
      }

      // Vérifier si l'utilisateur a déjà répondu aujourd'hui
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from("daily_fatigue_log")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      // Afficher le dialog si pas encore répondu
      setShouldShowDialog(!data);
    } finally {
      setIsChecking(false);
    }
  };

  const handleClose = () => {
    setShouldShowDialog(false);
  };

  return { shouldShowDialog, isChecking, handleClose };
}
```

### 8.3 useRecoveryTimer

```typescript
// src/hooks/useRecoveryTimer.ts

export const useRecoveryTimer = () => {
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [isRunning, setIsRunning] = useState<Record<string, boolean>>({});
  const timerStateRef = useRef<Record<string, TimerState>>({});

  // Parser une durée comme "1min30s" en secondes
  const parseRecuperationTime = (timeStr: string): number => {
    const minMatch = timeStr.match(/(\d+)\s*min/);
    const secMatch = timeStr.match(/(\d+)\s*s(?:ec)?/);
    
    let totalSeconds = 0;
    if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
    if (secMatch) totalSeconds += parseInt(secMatch[1]);
    
    return totalSeconds || 60;  // Par défaut 60 secondes
  };

  // Démarrer un timer
  const startTimer = (id: string, recuperation: string) => {
    const duration = parseRecuperationTime(recuperation);
    const targetTime = Date.now() + duration * 1000;
    
    timerStateRef.current[id] = {
      startTime: Date.now(),
      targetTime,
      isRunning: true,
    };
    
    setTimers(prev => ({ ...prev, [id]: duration }));
    setIsRunning(prev => ({ ...prev, [id]: true }));
    
    // Lancer l'intervalle
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
      setTimers(prev => ({ ...prev, [id]: remaining }));
      
      if (remaining <= 0) {
        clearInterval(interval);
        setIsRunning(prev => ({ ...prev, [id]: false }));
        // Jouer un son de fin
        playNotificationSound();
      }
    }, 100);
  };

  // Formater le temps pour l'affichage
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    timers,
    isRunning,
    startTimer,
    pauseTimer,
    resetTimer,
    formatTime,
  };
};
```

---

## 9. Composants UI

### 9.1 Système de Design (shadcn/ui)

Les composants UI sont basés sur shadcn/ui et se trouvent dans `src/components/ui/`. Ils sont entièrement personnalisables.

#### Button (`src/components/ui/button.tsx`)

```typescript
const buttonVariants = cva(
  // Classes de base communes à tous les boutons
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Variante personnalisée pour les CTA importants
        hero: "bg-gradient-cta text-primary-foreground shadow-intense hover:shadow-glow",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

### 9.2 Composants Métier

#### ExerciseFeedbackDialog

```typescript
// src/components/ExerciseFeedbackDialog.tsx
// Dialog pour valider un exercice avec RPE et commentaire

interface ExerciseFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidate: (rpe: number, comment: string) => void;
  onCancel: () => void;
  exerciseName: string;
  isRpeRequired?: boolean;
}

export function ExerciseFeedbackDialog({
  open,
  onOpenChange,
  onValidate,
  onCancel,
  exerciseName,
  isRpeRequired = true,
}: ExerciseFeedbackDialogProps) {
  const [rpe, setRpe] = useState("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleValidate = async () => {
    // Validation du RPE
    if (isRpeRequired && !rpe) {
      toast.error("Le RPE est obligatoire");
      return;
    }

    const rpeNumber = Number(rpe);
    if (rpe && (rpeNumber < 1 || rpeNumber > 10)) {
      toast.error("Le RPE doit être entre 1 et 10");
      return;
    }

    setIsSubmitting(true);
    await onValidate(rpeNumber || 0, comment);
    
    // Reset le formulaire
    setRpe("");
    setComment("");
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Valider : {exerciseName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Saisie du RPE */}
          <div>
            <Label>RPE (1-10) {isRpeRequired && "*"}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="10"
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                placeholder="Ex: 7"
              />
              {/* Bouton d'aide pour expliquer le RPE */}
              <RPEExplanationDialog />
            </div>
          </div>

          {/* Historique du RPE pour cet exercice */}
          <ExerciseRPEHistoryChart exerciseName={exerciseName} />

          {/* Commentaire optionnel */}
          <div>
            <Label>Commentaire (optionnel)</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Sensations, ajustements..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Non effectué
          </Button>
          <Button onClick={handleValidate} disabled={isSubmitting}>
            {isSubmitting ? "Validation..." : "Valider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### CelebrationOverlay

```typescript
// src/components/CelebrationOverlay.tsx
// Animation de confettis pour célébrer une séance terminée

export function CelebrationOverlay({ 
  show, 
  onComplete 
}: { 
  show: boolean; 
  onComplete: () => void;
}) {
  useEffect(() => {
    if (show) {
      // Fermer automatiquement après 3 secondes
      const timer = setTimeout(() => {
        onComplete();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
      {/* Animation de confettis */}
      <ConfettiEffect />
      
      <div className="text-center animate-bounce">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-3xl font-bold text-primary">Bravo !</h2>
        <p className="text-muted-foreground">Séance terminée avec succès</p>
      </div>
    </div>
  );
}
```

---

## 10. Fonctions Edge (Backend)

### 10.1 Notification d'inscription

#### `supabase/functions/notify-signup/index.ts`

```typescript
// Fonction déclenchée quand un nouveau sportif s'inscrit

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const COACH_EMAIL = Deno.env.get("COACH_EMAIL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

interface SignupNotificationRequest {
  email: string;
  signupDate: string;
}

serve(async (req: Request) => {
  // Gérer les requêtes CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, signupDate }: SignupNotificationRequest = await req.json();

    // Envoyer un email au coach via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "CDO Coaching <noreply@cdocoaching.com>",
        to: COACH_EMAIL,
        subject: "🆕 Nouvelle inscription sur CDO Coaching",
        html: `
          <h1>Nouvelle inscription !</h1>
          <p>Un nouveau sportif vient de s'inscrire :</p>
          <ul>
            <li><strong>Email :</strong> ${email}</li>
            <li><strong>Date :</strong> ${new Date(signupDate).toLocaleString("fr-FR")}</li>
          </ul>
          <p>Connecte-toi pour valider son compte.</p>
        `,
      }),
    });

    const data = await res.json();
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### 10.2 Checkout Stripe

#### `supabase/functions/create-checkout/index.ts`

```typescript
// Crée une session de paiement Stripe

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.3.0?target=deno";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialiser les clients
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });

    // Récupérer l'utilisateur connecté
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Non authentifié");

    // Parser la requête
    const { priceId, mode } = await req.json();

    // Vérifier si le client Stripe existe déjà
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    let customerId = customers.data[0]?.id;

    // Créer le client s'il n'existe pas
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
    }

    // Créer la session de checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: mode,  // 'payment' ou 'subscription'
      success_url: `${req.headers.get("origin")}/sportif/paiement-succes?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/sportif/paiement`,
      metadata: { user_id: user.id },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

---

## 11. Système de Design

### 11.1 Variables CSS

#### `src/index.css`

```css
@layer base {
  :root {
    /* === Couleurs principales === */
    --background: 0 0% 7%;           /* Noir profond */
    --foreground: 48 100% 96%;       /* Blanc cassé */
    
    /* === Couleur d'accent (Or/Jaune) === */
    --primary: 48 100% 50%;          /* Or vif */
    --primary-foreground: 0 0% 7%;   /* Texte sur primary */
    
    /* === Couleurs secondaires === */
    --secondary: 0 0% 15%;           /* Gris foncé */
    --muted: 0 0% 20%;               /* Gris moyen */
    --muted-foreground: 48 20% 65%;  /* Texte atténué */
    
    /* === États === */
    --destructive: 0 84% 60%;        /* Rouge erreur */
    --success: 142 76% 36%;          /* Vert succès */
    
    /* === Composants === */
    --card: 0 0% 10%;                /* Fond des cartes */
    --border: 0 0% 20%;              /* Bordures */
    --input: 0 0% 20%;               /* Champs de formulaire */
    --ring: 48 100% 50%;             /* Focus ring */
    
    /* === Gradients === */
    --gradient-hero: linear-gradient(135deg, hsl(0 0% 7%) 0%, hsl(0 0% 15%) 100%);
    --gradient-cta: linear-gradient(135deg, hsl(48 100% 50%) 0%, hsl(45 100% 45%) 100%);
    
    /* === Ombres === */
    --shadow-glow: 0 0 30px hsla(48 100% 50% / 0.3);
    --shadow-intense: 0 10px 40px hsla(48 100% 50% / 0.4);
    
    /* === Dimensions === */
    --radius: 0.75rem;
  }
}
```

### 11.2 Configuration Tailwind

#### `tailwind.config.ts`

```typescript
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    screens: {
      'xs': '375px',    // Petits téléphones
      'sm': '640px',    // Grands téléphones
      'md': '768px',    // Tablettes
      'lg': '1024px',   // Petits laptops
      'xl': '1280px',   // Grands écrans
      '2xl': '1536px',  // Très grands écrans
    },
    extend: {
      colors: {
        // Mapper les variables CSS vers Tailwind
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ... autres couleurs
      },
      backgroundImage: {
        "gradient-hero": "var(--gradient-hero)",
        "gradient-cta": "var(--gradient-cta)",
      },
      boxShadow: {
        "glow": "var(--shadow-glow)",
        "intense": "var(--shadow-intense)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.6s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
```

---

## 12. Utilitaires et Helpers

### 12.1 Calculs de dates/semaines

#### `src/lib/weekUtils.ts`

```typescript
import { getISOWeek, getISOWeekYear, startOfISOWeek, endOfISOWeek, addWeeks, format } from "date-fns";
import { fr } from "date-fns/locale";

// Obtenir le numéro de semaine ISO
export function getWeekNumber(date: Date): number {
  return getISOWeek(date);
}

// Obtenir l'année de la semaine ISO
export function getWeekYear(date: Date): number {
  return getISOWeekYear(date);
}

// Obtenir le lundi de la semaine
export function getMondayOfWeek(date: Date): Date {
  return startOfISOWeek(date);
}

// Obtenir le dimanche de la semaine
export function getSundayOfWeek(date: Date): Date {
  return endOfISOWeek(date);
}

// Générer les N prochaines semaines
export function getNextWeeks(count: number = 12) {
  const weeks = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const date = addWeeks(now, i);
    weeks.push({
      week: getWeekNumber(date),
      year: getWeekYear(date),
      date,
    });
  }
  
  return weeks;
}

// Formater la plage de dates d'une semaine
export function formatWeekRange(date: Date): string {
  const monday = getMondayOfWeek(date);
  const sunday = getSundayOfWeek(date);
  
  return `${format(monday, "dd/MM")} - ${format(sunday, "dd/MM")}`;
}
```

### 12.2 Calculs pour le cardio

#### `src/lib/cardioCalculations.ts`

```typescript
// Formater une durée en secondes vers "Xh Xmin Xs"
export function formatCardioTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min ${secs}s`;
}

// Formater une distance en mètres
export function formatCardioDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${meters} m`;
}

// Calculer l'allure (pace) en min/km
export function calculatePace(distanceMeters: number, durationSeconds: number): number {
  if (distanceMeters <= 0) return 0;
  const distanceKm = distanceMeters / 1000;
  const durationMin = durationSeconds / 60;
  return durationMin / distanceKm;  // minutes par km
}

// Formater une allure décimale en "X'XX""
export function formatPaceFromDecimal(paceMinPerKm: number): string {
  if (!paceMinPerKm || paceMinPerKm <= 0) return "";
  
  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - minutes) * 60);
  
  return `${minutes}'${seconds.toString().padStart(2, '0')}"`;
}

// Calculer les métriques d'une séance cardio
export function calculateCardioMetrics(
  cardioContent: CardioData,
  athleteVma: number | null
): {
  totalDistance: number;
  totalDuration: number;
  averageIntensity: number;
} {
  let totalDistance = 0;
  let totalDuration = 0;
  let weightedIntensity = 0;
  
  // Parcourir les blocs et steps
  cardioContent.blocks.forEach(block => {
    for (let rep = 0; rep < block.repetitions; rep++) {
      block.steps.forEach(step => {
        if (step.effortType === 'distance') {
          totalDistance += step.distanceMeters || 0;
          // Calculer la durée à partir de l'allure
          if (step.vmaPercentage && athleteVma) {
            const speed = (athleteVma * step.vmaPercentage) / 100; // km/h
            const durationHours = (step.distanceMeters / 1000) / speed;
            totalDuration += durationHours * 3600;
          }
        } else if (step.effortType === 'duration') {
          totalDuration += step.durationSeconds || 0;
        }
        
        // Intensité pondérée
        if (step.vmaPercentage) {
          weightedIntensity += step.vmaPercentage * (step.durationSeconds || 60);
        }
      });
    }
  });
  
  const averageIntensity = totalDuration > 0 
    ? weightedIntensity / totalDuration 
    : 0;
  
  return { totalDistance, totalDuration, averageIntensity };
}
```

### 12.3 Calculs de maxes

#### `src/lib/maxCalculations.ts`

```typescript
// Calculer le 1RM estimé à partir d'une performance

// Coefficient de tempo (tempo plus lent = charge équivalente plus lourde)
export function getTempoCoefficient(tempoSeconds: number | null): number {
  if (!tempoSeconds) return 1;
  
  if (tempoSeconds >= 12) return 1.15;  // Tempo très lent
  if (tempoSeconds >= 8) return 1.10;   // Tempo lent
  if (tempoSeconds >= 5) return 1.05;   // Tempo modéré
  return 1;                              // Tempo normal
}

// Formule de Brzycki pour estimer le 1RM
export function calculate1RM(
  weight: number,
  reps: number,
  rpe: number,
  tempo?: string | null
): number {
  // Formule de Brzycki : 1RM = weight × (36 / (37 - reps))
  // Ajusté pour le RPE : on considère que RPE 10 = échec, RPE 7 = 3 reps en réserve
  const repsInReserve = 10 - rpe;
  const effectiveReps = reps + repsInReserve;
  
  let estimated1RM = weight * (36 / (37 - effectiveReps));
  
  // Appliquer le coefficient de tempo
  const tempoSeconds = parseTempo(tempo);
  const tempoCoef = getTempoCoefficient(tempoSeconds);
  estimated1RM *= tempoCoef;
  
  return Math.round(estimated1RM * 10) / 10;  // Arrondir à 0.5kg
}

// Parser un tempo comme "3211" en secondes totales
export function parseTempo(tempo: string | null | undefined): number | null {
  if (!tempo || !/^\d{4}$/.test(tempo)) return null;
  
  const eccentric = parseInt(tempo[0]);    // Phase descendante
  const pauseLow = parseInt(tempo[1]);     // Pause en bas
  const concentric = parseInt(tempo[2]);   // Phase montante
  const pauseHigh = parseInt(tempo[3]);    // Pause en haut
  
  return eccentric + pauseLow + concentric + pauseHigh;
}

// Vérifier si on doit enregistrer un nouveau max
export function shouldRecordMax(
  charge: string | null,
  reps: string | null,
  rpe: number | null
): boolean {
  // Conditions pour enregistrer un max :
  // 1. Charge et reps renseignés
  // 2. RPE >= 7 (effort significatif)
  if (!charge || !reps || !rpe) return false;
  return rpe >= 7;
}
```

---

## 13. Intégrations Externes

### 13.1 Supabase

#### Configuration du client

```typescript
// src/integrations/supabase/client.ts

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://supabasekong.cdocoaching.com';
const SUPABASE_ANON_KEY = 'eyJ...';  // Clé publique (anon)

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,         // Stockage du token
    persistSession: true,          // Persister la session
    autoRefreshToken: true,        // Renouveler automatiquement le token
  }
});
```

**Opérations courantes :**

```typescript
// SELECT
const { data, error } = await supabase
  .from('training_sessions')
  .select('*, session_exercises (*)')
  .eq('week_id', weekId)
  .order('session_number');

// INSERT
const { data, error } = await supabase
  .from('training_sessions')
  .insert({ name: 'Séance 1', week_id: weekId })
  .select()
  .single();

// UPDATE
const { error } = await supabase
  .from('training_sessions')
  .update({ completed_at: new Date().toISOString() })
  .eq('id', sessionId);

// DELETE
const { error } = await supabase
  .from('session_exercises')
  .delete()
  .eq('id', exerciseId);

// Temps réel
const channel = supabase
  .channel('messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
  }, (payload) => {
    console.log('Nouveau message:', payload.new);
  })
  .subscribe();
```

### 13.2 Stripe

#### Configuration côté client

```typescript
// src/lib/stripeConfig.ts

export const STRIPE_PUBLIC_KEY = "pk_test_...";

export const STRIPE_PRODUCTS = [
  {
    id: "prod_abc123",
    name: "Abonnement mensuel",
    priceId: "price_xyz789",
    paymentLink: "https://buy.stripe.com/...",
    amount: 8000,  // 80€ en centimes
    currency: "eur",
    isRecurring: true,
    interval: "month",
  },
];

// Ajouter des paramètres au payment link
export function getPaymentLinkWithParams(
  paymentLink: string,
  options?: { prefillEmail?: string; clientReferenceId?: string }
): string {
  const url = new URL(paymentLink);
  
  if (options?.prefillEmail) {
    url.searchParams.set("prefilled_email", options.prefillEmail);
  }
  
  if (options?.clientReferenceId) {
    url.searchParams.set("client_reference_id", options.clientReferenceId);
  }
  
  return url.toString();
}
```

### 13.3 Google Calendar (OAuth)

#### Flux d'authentification

```
1. Utilisateur clique "Connecter Google Calendar"
     ↓
2. Appel à l'Edge Function `google-calendar-auth`
     ↓
3. Redirection vers Google OAuth
     ↓
4. Utilisateur autorise l'accès
     ↓
5. Google redirige vers le callback avec un code
     ↓
6. Edge Function échange le code contre des tokens
     ↓
7. Tokens stockés dans `google_calendar_tokens`
     ↓
8. Application peut maintenant récupérer les événements
```

---

## Glossaire

| Terme | Définition |
|-------|------------|
| **RPE** | Rate of Perceived Exertion - Échelle de 1 à 10 pour mesurer l'effort perçu |
| **VMA** | Vitesse Maximale Aérobie - Vitesse de course à VO2max |
| **1RM** | One Rep Max - Charge maximale pour une répétition |
| **Superset** | Deux exercices enchaînés sans repos |
| **Mésocycle** | Période d'entraînement de 2-6 semaines avec un objectif |
| **FC max** | Fréquence Cardiaque Maximale |
| **Tempo** | Vitesse d'exécution d'un exercice (ex: 3211 = 3s descente, 2s pause, 1s montée, 1s pause) |
| **RLS** | Row Level Security - Sécurité au niveau des lignes dans PostgreSQL |

---

## Conclusion

Cette documentation couvre l'ensemble de l'architecture technique de CDO Coaching. L'application est construite sur des bases solides avec :

1. **React + TypeScript** pour un frontend robuste et typé
2. **Supabase** pour un backend complet (auth, database, storage, functions)
3. **Tailwind + shadcn/ui** pour un design system cohérent
4. **Architecture modulaire** avec séparation claire des responsabilités

Pour toute question ou contribution, référez-vous à cette documentation et au code source commenté.

---

*Document généré le 21 janvier 2026*
*Version 1.0*
