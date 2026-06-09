/**
 * DailyDebriefCard — Débrief quotidien automatique
 * Analyse tous les signaux disponibles et génère un texte explicatif en français.
 * Fermé par défaut, ouvert via chevron.
 */

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, BookOpen, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus, Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── Types internes ────────────────────────────────────────────────────────────

interface DebriefData {
  // Score Prépa
  prepScore: number | null;
  prepStatus: string | null;
  acwr: number | null;
  monotony: number | null;
  weeklyLoadUA: number | null;
  // Hooper
  lastHooper: { fatigue: number; courbatures: number; sommeil: number; stress: number; score_total: number; date: string } | null;
  hoopers3days: { score_total: number; date: string }[];
  // SFMS
  sfmsScore: number | null;
  sfmsDate: string | null;
  // HR zones (Karvonen)
  hasKarvonen: boolean;
  z1pct: number; z2pct: number; z3pct: number; z4pct: number; z5pct: number;
  totalHRSec: number;
  // Strava
  stravaRunCount: number;
  stravaRunKm: number;
  // Sessions semaine
  sessionsThisWeek: number;
  sessionsDoneThisWeek: number;
  sessionsWithRpe: number; // nb séances avec RPE sur 7 jours → fiabilité monotonie
  // Douleur / blessure
  injury: { location: string; level: number; date: string } | null;
}

interface DebriefSection {
  icon: "ok" | "warn" | "alert" | "info" | "up" | "down" | "neutral";
  title: string;
  text: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function acwrLabel(v: number): string {
  if (v < 0.8) return "très bas (sous-entraînement)";
  if (v <= 1.3) return "optimal";
  if (v <= 1.5) return "élevé (à surveiller)";
  return "critique (surmenage)";
}

function hooperLabel(v: number): string {
  if (v <= 12) return "excellent";
  if (v <= 16) return "correct";
  if (v <= 20) return "fatigué";
  return "très fatigué";
}

function pctLabel(v: number): string {
  if (v >= 80) return "très élevée";
  if (v >= 60) return "élevée";
  if (v >= 40) return "modérée";
  if (v >= 20) return "faible";
  return "très faible";
}

const TODAY = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// ── Génération du débrief ─────────────────────────────────────────────────────

function generateDebrief(d: DebriefData): DebriefSection[] {
  const sections: DebriefSection[] = [];

  // 1. Vue d'ensemble — contradiction Score Prépa / État de forme
  if (d.prepScore !== null && d.acwr !== null) {
    const prepGood = d.prepScore >= 70;
    const overloaded = d.acwr > 1.5;
    const underloaded = d.acwr < 0.8;

    if (prepGood && overloaded) {
      sections.push({
        icon: "warn",
        title: "Score Prépa élevé mais charge critique",
        text: `Le score de préparation est bon (${d.prepScore}/100), ce qui signifie que les séances sont réalisées régulièrement. Cependant, l'ACWR de ${d.acwr.toFixed(2)} indique que la charge de travail des 7 derniers jours est ${Math.round(d.acwr * 100 - 100)}% supérieure à la moyenne chronique des 28 derniers jours. En d'autres termes : l'athlète s'entraîne bien mais a augmenté la charge trop brusquement. Ce type de déséquilibre est un facteur de risque connu de blessure et de surmenage. Il est recommandé de réduire la charge cette semaine avant de reprendre la progression.`,
      });
    } else if (!prepGood && !overloaded && !underloaded) {
      sections.push({
        icon: "info",
        title: "Score Prépa en baisse — forme préservée",
        text: `Le score de préparation (${d.prepScore}/100) est en dessous du seuil idéal, ce qui peut indiquer des séances manquées ou incomplètes. L'ACWR (${d.acwr.toFixed(2)}) reste dans la zone normale, donc le corps n'est pas en surmenage. Il s'agit probablement d'une légère baisse d'assiduité ou de disponibilité, non d'un problème physiologique. Reprendre progressivement le volume habituel.`,
      });
    } else if (underloaded) {
      sections.push({
        icon: "down",
        title: "Charge d'entraînement insuffisante",
        text: `L'ACWR de ${d.acwr.toFixed(2)} est en dessous de 0.8, signe de sous-entraînement : la charge récente est nettement inférieure à la baseline habituelle. Cela peut résulter d'une semaine de repos, d'une absence ou d'une période de décharge. Si ce n'est pas voulu, il serait utile de reprendre progressivement pour ne pas perdre les adaptations acquises.`,
      });
    } else {
      sections.push({
        icon: "ok",
        title: "Équilibre charge / forme",
        text: `L'ACWR de ${d.acwr.toFixed(2)} est dans la zone optimale (0.8–1.3) et le score de préparation est de ${d.prepScore}/100. La progression de la charge est maîtrisée. C'est la situation idéale pour continuer à progresser sans risque excessif.`,
      });
    }
  }

  // 2. Monotonie — seulement si données suffisantes (≥4 séances avec RPE sur 7j)
  const monotonyReliable = d.sessionsWithRpe >= 4;
  if (d.monotony !== null) {
    if (!monotonyReliable) {
      sections.push({
        icon: "info",
        title: `Monotonie — données insuffisantes (${d.sessionsWithRpe}/7 séances avec RPE)`,
        text: `L'indice de monotonie (${d.monotony.toFixed(2)}) est calculé sur seulement ${d.sessionsWithRpe} séance${d.sessionsWithRpe > 1 ? "s" : ""} avec RPE renseigné cette semaine. Ce chiffre n'est pas fiable avec moins de 4 points de données. Pour activer cet indicateur, pense à renseigner le RPE après chaque séance.`,
      });
    } else if (d.monotony >= 2) {
      sections.push({
        icon: "warn",
        title: "Monotonie trop élevée",
        text: `L'indice de monotonie est de ${d.monotony.toFixed(2)} (seuil critique : 2.0), calculé sur ${d.sessionsWithRpe} séances avec RPE. Les séances sont trop similaires en intensité jour après jour, sans alternance suffisante. Recommandation : varier les intensités, intégrer des séances légères entre les séances chargées.`,
      });
    } else if (d.monotony >= 1.5) {
      sections.push({
        icon: "info",
        title: "Monotonie à surveiller",
        text: `La monotonie est de ${d.monotony.toFixed(2)} (${d.sessionsWithRpe} séances avec RPE). Zone orange (1.5–2.0) : les séances manquent un peu de variation d'intensité. Alterner davantage les charges serait bénéfique.`,
      });
    }
  }

  // 3. Bien-être Hooper
  if (d.lastHooper) {
    const h = d.lastHooper;
    const label = hooperLabel(h.score_total);
    const trend = d.hoopers3days.length >= 2
      ? d.hoopers3days[0].score_total - d.hoopers3days[d.hoopers3days.length - 1].score_total
      : null;
    const trendText = trend === null ? ""
      : trend > 2 ? " La tendance sur 3 jours est à la dégradation."
      : trend < -2 ? " La tendance sur 3 jours est à l'amélioration."
      : " Stable sur 3 jours.";
    const details: string[] = [];
    if (h.fatigue >= 5) details.push(`fatigue élevée (${h.fatigue}/7)`);
    if (h.sommeil <= 3) details.push(`sommeil perturbé (${h.sommeil}/7)`);
    if (h.stress >= 5) details.push(`stress important (${h.stress}/7)`);
    if (h.courbatures >= 5) details.push(`courbatures marquées (${h.courbatures}/7)`);
    const detailText = details.length ? ` Points d'attention : ${details.join(", ")}.` : "";

    sections.push({
      icon: h.score_total > 20 ? "alert" : h.score_total > 16 ? "warn" : "ok",
      title: `Bien-être du jour — ${label} (${h.score_total}/28)`,
      text: `Le questionnaire Hooper du ${new Date(h.date).toLocaleDateString("fr-FR")} donne un score de ${h.score_total}/28 (${label}).${detailText}${trendText} Rappel d'interprétation : un score Hooper bas (4–12) indique un excellent état de forme, un score élevé (>20) signale une fatigue importante qui peut justifier de réduire la charge ou d'insérer une séance de récupération active.`,
    });
  }

  // 4. SFMS
  if (d.sfmsScore !== null) {
    const sfmsDate = d.sfmsDate ? new Date(d.sfmsDate).toLocaleDateString("fr-FR") : "récemment";
    if (d.sfmsScore >= 35) {
      sections.push({
        icon: "alert",
        title: `SFMS élevé — risque de surentraînement (${d.sfmsScore}/54)`,
        text: `Le questionnaire SFMS du ${sfmsDate} indique un score de ${d.sfmsScore}/54. Au-delà de 35, on entre dans la zone d'alerte de surentraînement selon l'échelle SFMS (Société Française de Médecine du Sport). Il est fortement recommandé de consulter le contexte global : accumulation de fatigue, manque de sommeil, surcharge mentale. Une réduction significative du volume d'entraînement est conseillée jusqu'à normalisation du score.`,
      });
    } else if (d.sfmsScore >= 20) {
      sections.push({
        icon: "warn",
        title: `SFMS modéré (${d.sfmsScore}/54)`,
        text: `Le questionnaire SFMS du ${sfmsDate} donne ${d.sfmsScore}/54. Zone de vigilance (20–35). Des signes précoces de fatigue excessive sont présents. Surveiller l'évolution lors du prochain questionnaire et éviter d'augmenter la charge cette semaine.`,
      });
    } else {
      sections.push({
        icon: "ok",
        title: `SFMS normal (${d.sfmsScore}/54)`,
        text: `Le dernier questionnaire SFMS (${sfmsDate}) est à ${d.sfmsScore}/54, en dehors de toute zone d'alerte. Aucun signe de surentraînement détecté.`,
      });
    }
  }

  // 5. Zones FC
  if (d.totalHRSec > 0) {
    const lowZonePct = d.z1pct + d.z2pct + d.z3pct;
    const highZonePct = d.z4pct + d.z5pct;
    const pyramidal = lowZonePct >= 70;
    sections.push({
      icon: pyramidal ? "ok" : "info",
      title: `Répartition des zones FC — ${Math.round(lowZonePct)}% basse intensité`,
      text: `Sur les 7 derniers jours, ${Math.round(lowZonePct)}% du temps cardiaque est en zones basses (Z1–Z3) et ${Math.round(highZonePct)}% en zones hautes (Z4–Z5). ${
        pyramidal
          ? "Cette répartition est pyramidale (>70% basse intensité), ce qui correspond au modèle polarisé recommandé pour le développement aérobie à long terme sans accumulation excessive de fatigue."
          : "La proportion de travail en haute intensité (Z4–Z5) est élevée. Sur le long terme, trop de séances à haute intensité sans suffisamment de travail fondamental peut limiter la progression et augmenter la fatigue chronique. Envisager des séances d'endurance fondamentale pour rééquilibrer."
      }${d.z5pct > 10 ? ` Attention : ${Math.round(d.z5pct)}% en Z5 (max) sur la semaine est une proportion importante — vérifier que cela correspond à une séance de seuil prévue.` : ""}`,
    });
  }

  // 6. Course à pied Strava
  if (d.stravaRunCount > 0) {
    sections.push({
      icon: "info",
      title: `Activité Strava — ${d.stravaRunCount} sortie${d.stravaRunCount > 1 ? "s" : ""} · ${d.stravaRunKm.toFixed(1)} km`,
      text: `${d.stravaRunCount > 1
        ? `${d.stravaRunCount} sorties course ont été enregistrées sur Strava cette semaine, totalisant ${d.stravaRunKm.toFixed(1)} km.`
        : `1 sortie course de ${d.stravaRunKm.toFixed(1)} km enregistrée sur Strava cette semaine.`
      } Ces données alimentent le calcul de charge et d'efficacité aérobie. Pour un suivi optimal, s'assurer que le RPE (ressenti) est renseigné après chaque séance dans l'application.`,
    });
  }

  // Fallback si aucune donnée
  if (sections.length === 0) {
    sections.push({
      icon: "info",
      title: "Données insuffisantes",
      text: "Pas encore assez de données disponibles pour générer un débrief. Renseigner le questionnaire Hooper quotidien et valider les séances avec un RPE pour activer l'analyse.",
    });
  }

  return sections;
}

// ── Icône section ─────────────────────────────────────────────────────────────

function SectionIcon({ type }: { type: DebriefSection["icon"] }) {
  if (type === "ok") return <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />;
  if (type === "warn") return <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />;
  if (type === "alert") return <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />;
  if (type === "up") return <TrendingUp className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />;
  if (type === "down") return <TrendingDown className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />;
  return <Minus className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />;
}

// ── Fetch données ─────────────────────────────────────────────────────────────

async function fetchDebriefData(athleteId: string, coachId: string): Promise<DebriefData> {
  const now = new Date();
  const iso = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
  const isoDate = (d: number) => iso(d).slice(0, 10);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  const [statusData, hoopers, sfms, strava, weekSessions, customSessions, injuryData] = await Promise.all([
    // Fetch status card data (ACWR, monotony, score)
    supabase.from("training_sessions" as any)
      .select("completed_at, session_rpe, duration_minutes, training_weeks!inner(athlete_id)")
      .eq("training_weeks.athlete_id", athleteId)
      .not("completed_at", "is", null)
      .gte("completed_at", iso(28)),
    // Hooper 3 derniers jours
    supabase.from("daily_fatigue_log" as any)
      .select("date, fatigue, courbatures, sommeil, stress, score_total")
      .eq("user_id", athleteId)
      .gte("date", isoDate(3))
      .order("date", { ascending: false })
      .limit(3),
    // SFMS dernier
    supabase.from("sfms_questionnaire_results" as any)
      .select("total_score, completed_at")
      .eq("athlete_id", athleteId)
      .order("completed_at", { ascending: false })
      .limit(1),
    // Strava semaine
    supabase.from("strava_activities" as any)
      .select("start_date, distance_meters, moving_time_seconds, average_heartrate, sport_type")
      .eq("athlete_id", athleteId)
      .gte("start_date", weekStart.toISOString()),
    // Séances semaine programmées
    supabase.from("training_sessions" as any)
      .select("completed_at, training_weeks!inner(athlete_id)")
      .eq("training_weeks.athlete_id", athleteId)
      .gte("scheduled_date", weekStart.toISOString().slice(0, 10)),
    // Séances custom semaine
    supabase.from("custom_sessions" as any)
      .select("completed_at")
      .eq("user_id", athleteId)
      .gte("session_date", weekStart.toISOString().slice(0, 10)),
    // Dernière blessure signalée (7 derniers jours)
    supabase.from("daily_fatigue_log" as any)
      .select("date, has_injury, injury_level, injury_location")
      .eq("user_id", athleteId)
      .eq("has_injury", true)
      .gte("date", isoDate(7))
      .order("date", { ascending: false })
      .limit(1),
  ]);

  // Calcul ACWR
  const sessions = (statusData.data ?? []) as any[];
  const getLoad = (s: any) => s.session_rpe && s.duration_minutes ? s.session_rpe * s.duration_minutes : null;
  const acuteLoads = sessions
    .filter(s => new Date(s.completed_at) >= new Date(iso(7)))
    .map(getLoad).filter((v): v is number => v !== null);
  const chronicLoads = sessions.map(getLoad).filter((v): v is number => v !== null);
  const acuteAvg = acuteLoads.length ? acuteLoads.reduce((a, b) => a + b, 0) / 7 : null;
  const chronicAvg = chronicLoads.length ? chronicLoads.reduce((a, b) => a + b, 0) / 28 : null;
  const acwr = acuteAvg !== null && chronicAvg && chronicAvg > 0 ? Math.round((acuteAvg / chronicAvg) * 100) / 100 : null;

  // Monotonie (std des 7j) — uniquement sur séances avec RPE
  const weekLoads = sessions
    .filter(s => new Date(s.completed_at) >= new Date(iso(7)))
    .map(getLoad).filter((v): v is number => v !== null);
  const sessionsWithRpe = weekLoads.length; // nombre de séances avec RPE cette semaine
  let monotony: number | null = null;
  if (weekLoads.length >= 2) {
    const mean = weekLoads.reduce((a, b) => a + b, 0) / weekLoads.length;
    const std = Math.sqrt(weekLoads.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / weekLoads.length);
    monotony = std > 0 ? Math.round((mean / std) * 100) / 100 : null;
  }
  const weeklyLoadUA = weekLoads.length ? Math.round(weekLoads.reduce((a, b) => a + b, 0)) : null;

  // Score Prépa simplifié (ACWR zone)
  let prepScore: number | null = null;
  let prepStatus: string | null = null;
  if (acwr !== null) {
    if (acwr >= 0.8 && acwr <= 1.3) { prepScore = 85; prepStatus = "Prêt à l'entraînement"; }
    else if (acwr > 1.3 && acwr <= 1.5) { prepScore = 65; prepStatus = "Charge élevée"; }
    else if (acwr > 1.5) { prepScore = 40; prepStatus = "Surmenage"; }
    else { prepScore = 55; prepStatus = "Sous-entraîné"; }
  }

  // Hooper
  const hooperRows = (hoopers.data ?? []) as any[];
  const lastHooper = hooperRows.length > 0 ? hooperRows[0] : null;

  // SFMS
  const sfmsRow = ((sfms.data ?? []) as any[])[0];

  // Strava
  const stravaRows = (strava.data ?? []) as any[];
  const runs = stravaRows.filter(r => r.sport_type === "Run" || r.sport_type === "TrailRun");
  const stravaRunCount = runs.length;
  const stravaRunKm = runs.reduce((sum, r) => sum + (r.distance_meters ?? 0) / 1000, 0);

  // Zones HR (Strava 7j avec HR)
  const withHR = stravaRows.filter(r => r.average_heartrate && r.moving_time_seconds);
  let hasKarvonen = false, z1pct = 0, z2pct = 0, z3pct = 0, z4pct = 0, z5pct = 0, totalHRSec = 0;
  if (withHR.length > 0) {
    hasKarvonen = true;
    // Approx zones via HR ratio (sans FCmax/FCR dispo ici, on utilise des seuils HR bruts)
    // On fait une estimation en supposant HR moyen ~ Z2/Z3
    totalHRSec = withHR.reduce((s, r) => s + r.moving_time_seconds, 0);
    // Distribution simplifiée basée sur HR moyen relatif
    const avgHR = withHR.reduce((s, r) => s + r.average_heartrate * r.moving_time_seconds, 0) / totalHRSec;
    // Sans FCmax on fait une estimation heuristique
    if (avgHR < 120) { z1pct = 80; z2pct = 15; z3pct = 5; z4pct = 0; z5pct = 0; }
    else if (avgHR < 140) { z1pct = 20; z2pct = 50; z3pct = 20; z4pct = 8; z5pct = 2; }
    else if (avgHR < 160) { z1pct = 10; z2pct = 25; z3pct = 35; z4pct = 25; z5pct = 5; }
    else if (avgHR < 175) { z1pct = 5; z2pct = 10; z3pct = 20; z4pct = 45; z5pct = 20; }
    else { z1pct = 2; z2pct = 5; z3pct = 10; z4pct = 30; z5pct = 53; }
  }

  // Sessions semaine
  const wSessions = (weekSessions.data ?? []) as any[];
  const cSessions = (customSessions.data ?? []) as any[];
  const sessionsThisWeek = wSessions.length + cSessions.length;
  const sessionsDoneThisWeek = wSessions.filter(s => s.completed_at).length + cSessions.filter(s => s.completed_at).length;

  return {
    prepScore, prepStatus, acwr, monotony, weeklyLoadUA,
    lastHooper, hoopers3days: hooperRows,
    sfmsScore: sfmsRow?.total_score ?? null,
    sfmsDate: sfmsRow?.completed_at ?? null,
    hasKarvonen, z1pct, z2pct, z3pct, z4pct, z5pct, totalHRSec,
    stravaRunCount, stravaRunKm,
    sessionsThisWeek, sessionsDoneThisWeek, sessionsWithRpe,
    injury: (() => {
      const row = ((injuryData.data ?? []) as any[])[0];
      if (!row || !row.has_injury || !row.injury_level) return null;
      return { location: row.injury_location ?? "Non précisé", level: row.injury_level, date: row.date };
    })(),
  };
}

// ── Composant principal ───────────────────────────────────────────────────────

// ── Groq AI conseil ───────────────────────────────────────────────────────────

async function fetchAIAdvice(data: DebriefData): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("Clé Groq manquante");

  const injuryLine = data.injury
    ? `⚠️ BLESSURE/DOULEUR ACTIVE: ${data.injury.location}, niveau ${data.injury.level}/7 (signalée le ${new Date(data.injury.date).toLocaleDateString("fr-FR")})`
    : "Aucune douleur signalée";

  const context = [
    injuryLine,
    data.acwr !== null ? `ACWR: ${data.acwr.toFixed(2)} (${data.acwr > 1.5 ? "critique" : data.acwr > 1.3 ? "élevé" : data.acwr < 0.8 ? "bas" : "optimal"})` : null,
    data.monotony !== null
      ? `Monotonie: ${data.monotony.toFixed(2)}${data.sessionsWithRpe < 4 ? ` ⚠️ NON FIABLE (seulement ${data.sessionsWithRpe} séances avec RPE sur 7j, minimum requis: 4)` : data.monotony >= 2 ? " ⚠️ critique" : ""}`
      : null,
    data.weeklyLoadUA ? `Charge semaine: ${Math.round(data.weeklyLoadUA)} UA` : null,
    data.lastHooper ? `Hooper: ${data.lastHooper.score_total}/28 — fatigue ${data.lastHooper.fatigue}/7, sommeil ${data.lastHooper.sommeil}/7, stress ${data.lastHooper.stress}/7, courbatures ${data.lastHooper.courbatures}/7` : "Hooper: pas de données",
    data.sfmsScore !== null ? `SFMS: ${data.sfmsScore}/54${data.sfmsScore >= 35 ? " ⚠️ zone alerte" : ""}` : null,
    data.stravaRunCount > 0 ? `Course: ${data.stravaRunCount} sorties, ${data.stravaRunKm.toFixed(1)} km cette semaine` : "Aucune sortie Strava cette semaine",
    data.totalHRSec > 0 ? `Zones FC: ${Math.round(data.z1pct + data.z2pct + data.z3pct)}% basse intensité, ${Math.round(data.z4pct + data.z5pct)}% haute intensité` : null,
  ].filter(Boolean).join("\n");

  const prompt = `Tu es un coach sportif expert en préparation physique et en entraînement. Voici les données du jour d'un athlète :

${context}

Donne un conseil général de coaching court, pratique et bienveillant en français (3-4 phrases maximum).
- Commence directement par le conseil, sans introduction comme "Voici mon conseil".
- Si une blessure/douleur est signalée, elle doit être centrale dans ton conseil (adapter l'entraînement, zones à éviter, précautions spécifiques au lieu de la douleur).
- Sois précis sur ce que l'athlète devrait faire ou éviter cette semaine.
- Tiens compte de tous les signaux disponibles, pas seulement d'un seul.
- Utilise un ton de coach, direct mais encourageant.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 200,
    }),
  });

  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() ?? "Conseil indisponible.";
}

// ── Composant ─────────────────────────────────────────────────────────────────

interface Props { athleteId: string; }

export function DailyDebriefCard({ athleteId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<DebriefSection[] | null>(null);
  const [rawData, setRawData] = useState<DebriefData | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [dataDate] = useState(TODAY);

  // Lazy-load au premier clic
  useEffect(() => {
    if (!open || sections !== null) return;
    let cancelled = false;
    setLoading(true);
    fetchDebriefData(athleteId, "")
      .then(data => {
        if (!cancelled) {
          setSections(generateDebrief(data));
          setRawData(data);
        }
      })
      .catch(() => { if (!cancelled) setSections([{ icon: "info", title: "Erreur", text: "Impossible de charger les données du débrief." }]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, athleteId, sections]);

  const handleAIAdvice = async () => {
    if (!rawData) return;
    setAiLoading(true);
    setAiError(false);
    try {
      const advice = await fetchAIAdvice(rawData);
      setAiAdvice(advice);
    } catch {
      setAiError(true);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* En-tête cliquable */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left"
        aria-expanded={open}
      >
        <CardHeader className="py-2.5 px-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold">Analyse du jour</span>
              <span className="hidden sm:inline text-xs text-muted-foreground truncate">— {dataDate}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">
                Débrief auto
              </Badge>
              {open
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </CardHeader>
      </button>

      {/* Corps collapsible */}
      {open && (
        <CardContent className="px-4 pb-4 pt-0 space-y-3 border-t border-border/50">
          {loading ? (
            <div className="space-y-2 pt-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-40 bg-muted animate-pulse rounded" />
                  <div className="h-2 w-full bg-muted animate-pulse rounded" />
                  <div className="h-2 w-4/5 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="pt-2 space-y-3">
              {sections?.map((s, i) => (
                <div key={i} className="flex gap-2.5">
                  <SectionIcon type={s.icon} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground mb-0.5">{s.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.text}</p>
                  </div>
                </div>
              ))}

              {/* ── Conseil IA ── */}
              <div className="border-t border-border/40 pt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                    <span className="text-xs font-semibold">Conseil du coach IA</span>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-violet-500/10 text-violet-400 border-0">Groq · llama3</Badge>
                  </div>
                  <button
                    onClick={handleAIAdvice}
                    disabled={aiLoading || !rawData}
                    className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 disabled:opacity-40 transition-colors"
                  >
                    <RefreshCw className={`h-3 w-3 ${aiLoading ? "animate-spin" : ""}`} />
                    {aiAdvice ? "Régénérer" : "Générer"}
                  </button>
                </div>

                {aiLoading && (
                  <div className="space-y-1.5">
                    <div className="h-2 w-full bg-muted animate-pulse rounded" />
                    <div className="h-2 w-4/5 bg-muted animate-pulse rounded" />
                    <div className="h-2 w-3/5 bg-muted animate-pulse rounded" />
                  </div>
                )}

                {aiAdvice && !aiLoading && (
                  <div className="bg-violet-500/5 border border-violet-500/20 rounded-md px-3 py-2">
                    <p className="text-xs text-foreground/90 leading-relaxed">{aiAdvice}</p>
                  </div>
                )}

                {aiError && !aiLoading && (
                  <p className="text-[11px] text-destructive">Erreur lors de la génération. Réessaie.</p>
                )}

                {!aiAdvice && !aiLoading && !aiError && (
                  <p className="text-[11px] text-muted-foreground/60 italic">Clique sur "Générer" pour obtenir un conseil personnalisé basé sur tes données.</p>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground/50 text-right border-t border-border/30 pt-1">
                Analyse générée automatiquement · données temps réel
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default DailyDebriefCard;
