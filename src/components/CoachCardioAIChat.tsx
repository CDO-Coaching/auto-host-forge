/**
 * CoachCardioAIChat
 *
 * Panel de discussion IA spécialisé en programmation course à pied / cardio.
 * S'ouvre depuis l'onglet Prog via un bouton flottant.
 * Reçoit en contexte les séances de la semaine sélectionnée pour aider
 * le coach à affiner sa programmation cardio.
 */

import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, Trash2, Bot, User, ChevronDown } from "lucide-react";
import { toast } from "sonner";

// ─── Groq config (same as CycleSetupGate) ────────────────────────────────────
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL   = "llama-3.3-70b-versatile";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ─── Context types (subset of what ClientDetail knows) ───────────────────────
export interface AIChatSession {
  name: string;
  type: string; // "renfo" | "cardio" | "recup"
  exerciseCount: number;
  cardioSummary?: string; // e.g. "8.5 km · 45min · 65-100% VMA"
}

export interface AIChatWeekHistory {
  weekNumber: number;
  year: number;
  totalKm: number;
  totalMinutes: number;
  sessionCount: number;
  avgIntensityPct?: number; // avg % VMA
}

export interface AIChatMesocycle {
  name: string;
  phaseType?: string;
  sport?: string;  // e.g. "course", "trail", "triathlon"
  start: string; // ISO date
  end: string;   // ISO date
  objective?: string;
  volumeTarget?: number;
  intensityTarget?: number;
}

export interface AIChatMilestone {
  label: string;       // name / label of the event
  targetDate: string;  // ISO date
  completed?: boolean;
  type?: string;       // "competition" | "test" | etc.
}

export interface AIChatContext {
  athleteName: string;
  athleteVma?: number | null;
  selectedWeek: { week: number; year: number };
  sessions: AIChatSession[];
  mesocycleName?: string;
  phaseType?: string;
  mesocycleStart?: string;
  mesocycleEnd?: string;
  objective?: string;
  recentHistory?: AIChatWeekHistory[];
  allMesocycles?: AIChatMesocycle[];   // full planning timeline
  milestones?: AIChatMilestone[];      // competitions / key dates
}

// ─── Pace calculator from VMA ─────────────────────────────────────────────────
function vmaTopace(vma: number, pct: number): string {
  const speed = vma * (pct / 100); // km/h
  const paceMin = 60 / speed;
  const min = Math.floor(paceMin);
  const sec = Math.round((paceMin - min) * 60);
  return `${min}:${sec.toString().padStart(2, "0")}/km`;
}

function buildVmaTable(vma: number): string {
  const zones: [string, number, number][] = [
    ["EF (endurance fondamentale)", 60, 70],
    ["Seuil aérobie", 75, 80],
    ["Seuil anaérobie / tempo", 83, 88],
    ["VMA courte (100-110%)", 100, 110],
    ["Survitesse (110-120%)", 110, 120],
  ];
  return zones
    .map(([label, lo, hi]) =>
      `  • ${label} : ${vmaTopace(vma, lo)} → ${vmaTopace(vma, hi)} (${lo}-${hi}% VMA)`
    )
    .join("\n");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function weeksUntil(isoDate: string, fromWeek: { week: number; year: number }): number {
  // Approximate: compute monday of fromWeek
  const jan4 = new Date(fromWeek.year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (fromWeek.week - 1) * 7);
  const target = new Date(isoDate);
  return Math.ceil((target.getTime() - monday.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(ctx: AIChatContext): string {
  const cardioSessions = ctx.sessions.filter((s) => s.type === "cardio" || s.type === "recup");
  const sessionLines = cardioSessions.length > 0
    ? cardioSessions.map((s, i) =>
        `  ${i + 1}. "${s.name}" (${s.type === "recup" ? "récup active" : "cardio"})` +
        (s.cardioSummary ? ` → ${s.cardioSummary}` : " → contenu non renseigné")
      ).join("\n")
    : "  Aucune séance cardio programmée pour cette semaine.";

  const vmaSection = ctx.athleteVma
    ? `VMA = ${ctx.athleteVma} km/h — Table d'allures :
${buildVmaTable(ctx.athleteVma)}`
    : "VMA non renseignée — demande-la impérativement avant de prescrire des allures.";

  // ── Recent training history ────────────────────────────────────────────────
  let historySection = "Historique des dernières semaines cardio : non disponible.";
  if (ctx.recentHistory && ctx.recentHistory.length > 0) {
    const nonEmpty = ctx.recentHistory.filter((w) => w.totalKm > 0 || w.totalMinutes > 0);
    // Detect last deload week (volume drop ≥25% vs previous)
    const deloadFlags = nonEmpty.map((w, i) => {
      if (i === 0) return false;
      const prev = nonEmpty[i - 1];
      return prev.totalKm > 0 && w.totalKm < prev.totalKm * 0.75;
    });
    const rows = ctx.recentHistory.map((w, i) => {
      const dur = w.totalMinutes > 0 ? `${Math.round(w.totalMinutes)} min` : "-";
      const km = w.totalKm > 0 ? `${w.totalKm.toFixed(1)} km` : "0 km";
      const intensity = w.avgIntensityPct ? ` | ~${Math.round(w.avgIntensityPct)}% VMA` : "";
      const deload = deloadFlags[i] ? " ⬇ décharge" : "";
      return `  S${w.weekNumber}/${w.year} : ${km} · ${dur} · ${w.sessionCount} séance(s)${intensity}${deload}`;
    });
    const nonZero = nonEmpty.filter((w) => w.totalKm > 0);
    const avgKm = nonZero.length > 0 ? nonZero.reduce((a, w) => a + w.totalKm, 0) / nonZero.length : 0;
    const avgMin = nonZero.length > 0 ? nonZero.reduce((a, w) => a + w.totalMinutes, 0) / nonZero.length : 0;
    // Detect recent overload: last 2 weeks both grew >15%
    const last3 = nonEmpty.slice(-3);
    let overloadWarning = "";
    if (last3.length === 3 &&
        last3[1].totalKm > last3[0].totalKm * 1.15 &&
        last3[2].totalKm > last3[1].totalKm * 1.15) {
      overloadWarning = "\n  ⚠ ALERTE : Augmentation de volume >15% sur 2 semaines consécutives — risque de surmenage.";
    }
    // Detect missing deload
    const weeksSinceDeload = deloadFlags.lastIndexOf(true);
    let deloadWarning = "";
    if (weeksSinceDeload === -1 && ctx.recentHistory.length >= 4) {
      deloadWarning = "\n  ⚠ Aucune semaine de décharge détectée sur les 8 dernières semaines.";
    } else if (weeksSinceDeload >= 0 && (ctx.recentHistory.length - 1 - weeksSinceDeload) >= 4) {
      deloadWarning = `\n  ⚠ La dernière décharge remonte à ${ctx.recentHistory.length - 1 - weeksSinceDeload} semaines — une décharge bientôt recommandée.`;
    }
    historySection = `Historique des ${ctx.recentHistory.length} dernières semaines (du plus récent au plus ancien) :
${rows.join("\n")}
  → Moyenne (semaines actives) : ${avgKm.toFixed(1)} km/sem · ${Math.round(avgMin)} min/sem${overloadWarning}${deloadWarning}`;
  }

  // ── Mesocycles timeline ────────────────────────────────────────────────────
  let mesocycleSection = "Aucun mésocycle / cycle de planification renseigné.";
  const upcomingMesos: AIChatMesocycle[] = [];
  if (ctx.allMesocycles && ctx.allMesocycles.length > 0) {
    const today = new Date();
    const rows = ctx.allMesocycles.map((m) => {
      const start = new Date(m.start);
      const end = new Date(m.end);
      const weeksLeft = Math.ceil((end.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));
      let status = "✗ passé";
      if (today >= start && today <= end) status = "● EN COURS";
      else if (start > today) {
        status = "○ à venir";
        upcomingMesos.push(m);
      }
      const obj = m.objective ? ` | Objectif : ${m.objective}` : "";
      const phase = m.phaseType ? ` (${m.phaseType})` : "";
      const sportLabel = m.sport ? ` [${m.sport}]` : "";
      const remaining = today <= end && today >= start ? ` — ${weeksLeft} sem. restantes` : "";
      return `  [${status}] ${m.name}${phase}${sportLabel} : ${formatDate(m.start)} → ${formatDate(m.end)}${remaining}${obj}`;
    });
    mesocycleSection = `Mésocycles / cycles planifiés :
${rows.join("\n")}`;
  }

  // ── Milestones (competitions / key dates) ─────────────────────────────────
  let milestonesSection = "Aucune compétition ou date clé renseignée.";
  let criticalCompetitionAlert = "";
  if (ctx.milestones && ctx.milestones.length > 0) {
    const today = new Date();
    const upcoming = ctx.milestones
      .filter((m) => !m.completed && new Date(m.targetDate) >= today)
      .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
    const past = ctx.milestones.filter((m) => m.completed || new Date(m.targetDate) < today);
    const formatMilestone = (m: AIChatMilestone) => {
      const w = weeksUntil(m.targetDate, ctx.selectedWeek);
      const wLabel = w <= 0 ? "cette semaine ou passé" : `dans ${w} semaine(s)`;
      return `  • ${m.label} — ${formatDate(m.targetDate)} (${wLabel})`;
    };
    const upcomingLines = upcoming.map(formatMilestone);
    const pastLines = past.slice(-3).map((m) => `  • ✓ ${m.label} — ${formatDate(m.targetDate)} (passé)`);
    milestonesSection = [
      upcoming.length > 0 ? `Compétitions / objectifs à venir :\n${upcomingLines.join("\n")}` : "Aucune compétition à venir.",
      pastLines.length > 0 ? `Récents (passés) :\n${pastLines.join("\n")}` : "",
    ].filter(Boolean).join("\n");

    // Alert if competition is close
    if (upcoming.length > 0) {
      const next = upcoming[0];
      const weeksAway = weeksUntil(next.targetDate, ctx.selectedWeek);
      if (weeksAway <= 3 && weeksAway > 0) {
        criticalCompetitionAlert = `
⚠ COMPÉTITION IMMINENTE : "${next.label}" dans ${weeksAway} semaine(s) !
  → AFFÛTAGE OBLIGATOIRE : réduire le volume de ${weeksAway === 1 ? "50-60%" : "30-40%"}, maintenir l'intensité.
  → Pas de nouvelle stimulation, pas de séance longue.
  → ${weeksAway === 1 ? "Semaine de course : séances courtes, allures spécifiques uniquement." : "Réduire les séances qualité à 1 maximum cette semaine."}`;
      } else if (weeksAway <= 6 && weeksAway > 3) {
        criticalCompetitionAlert = `
ℹ Compétition "${next.label}" dans ${weeksAway} semaines → Phase spécifique recommandée.
  → Intégrer des séances à allure compétition, réduire progressivement le volume.`;
      }
    }

    // Multiple upcoming mesocycles → instruction to ask
    if (upcomingMesos.length > 1) {
      criticalCompetitionAlert += `
ℹ Il y a ${upcomingMesos.length} mésocycles à venir (${upcomingMesos.map((m) => `"${m.name}"`).join(", ")}).
  → Si le coach demande une programmation sur plusieurs semaines, demande-lui sur quel mésocycle / objectif se concentrer en priorité.`;
    }
  }

  // ── Active phase info ──────────────────────────────────────────────────────
  const phaseInfo = ctx.mesocycleName
    ? `Phase active : ${ctx.mesocycleName}${ctx.phaseType ? ` (${ctx.phaseType})` : ""}` +
      (ctx.mesocycleStart && ctx.mesocycleEnd ? ` | ${formatDate(ctx.mesocycleStart)} → ${formatDate(ctx.mesocycleEnd)}` : "")
    : "Aucune phase active définie.";

  const objectiveInfo = ctx.objective
    ? `Objectif en cours : ${ctx.objective}`
    : "Objectif : non renseigné (pose la question si pertinent pour la programmation)";

  return `Tu es un entraîneur expert en course à pied et endurance, avec 20 ans d'expérience auprès de coureurs amateurs et semi-professionnels. Tu as formé des athlètes de tous niveaux : débutants, compétiteurs sur 5km/10km/semi/marathon/trail.

═══════════════════════════════════════════
RÈGLES ABSOLUES — NE JAMAIS DÉROGER
═══════════════════════════════════════════

1. PRÉCISION OBLIGATOIRE : Toute séance prescrite doit comporter :
   - Format strict : N × distance @ allure (% VMA) — récup
   - Exemple : "6 × 1000m @ ${ctx.athleteVma ? vmaTopace(ctx.athleteVma, 97) : "X:XX/km"} (97% VMA) — récup 2min trot"
   - Échauffement détaillé (durée + allure + éducatifs)
   - Corps principal avec toutes les répétitions
   - Retour au calme (durée + allure)
   - Volume total de la séance en km

2. TOUJOURS UTILISER LA VMA RÉELLE pour les allures — jamais "allure confortable" ou "effort modéré".

3. POSER DES QUESTIONS si un élément manque avant de proposer une programmation :
   - VMA ? (obligatoire pour les allures)
   - Sur quel mésocycle / objectif le coach veut-il se concentrer ? (si plusieurs existent)
   - Nombre de séances cardio par semaine disponibles ?
   - Blessures / contraintes particulières ?
   → Ne pose pas toutes ces questions à la fois — priorise selon ce qui bloque vraiment la réponse.

4. ANALYSER L'HISTORIQUE ET LA PLANIFICATION avant toute recommandation :
   a) Respect de la progressivité : max +10-15% de volume par semaine
   b) Décharge obligatoire toutes les 3-4 semaines (-25 à -30% volume)
   c) Ne jamais augmenter volume ET intensité la même semaine
   d) Vérifier les alertes surcharge / décharge dans l'historique ci-dessous
   e) Adapter le type de séance à la phase du mésocycle actif

5. GESTION DE LA PROXIMITÉ AVEC LA COMPÉTITION :
   - 8-6 semaines avant : phase spécifique — allure compétition + seuil, réduction EF
   - 3-4 semaines avant : début de réduction volume (-15% puis -25%)
   - 2-3 semaines avant : affûtage — volume -30 à -40%, maintien intensité
   - 1 semaine avant : semaine de course — volume -50 à -60%, séances très courtes, allures spécifiques uniquement
   - Jamais de stimulus nouveau dans les 2 semaines avant une compétition

6. MULTIPLE MÉSOCYCLES / OBJECTIFS :
   Si le coach veut programmer sur plusieurs semaines et qu'il y a plusieurs mésocycles ou compétitions,
   demande-lui sur lequel se concentrer AVANT de proposer un plan.

═══════════════════════════════════════════
CATALOGUE DE SÉANCES
═══════════════════════════════════════════

ENDURANCE FONDAMENTALE (EF) — 60-70% VMA | RPE 2-4
  → 40-90 min | Base : 70-80% du volume hebdomadaire total

SEUIL AÉROBIE — 75-80% VMA | RPE 5-6
  → 20-30 min continu OU 3-4 × 8 min — récup 2 min trot

TEMPO / SEUIL ANAÉROBIE — 83-88% VMA | RPE 7-8
  → 20-40 min continu OU 2-3 × 10-15 min — récup 3 min

FRACTIONNÉ COURT (développement VMA) — 100-110% VMA | RPE 9
  → 30s/30s, 1min/1min, 200-400m — récup = durée effort

FRACTIONNÉ LONG (consolidation VMA) — 95-100% VMA | RPE 8-9
  → 600m, 800m, 1000m, 1200m — récup 2-3 min trot

VMA LONGUE — 92-97% VMA | RPE 8
  → 3-5 × 1500-2000m — récup 3-4 min

CÔTES (puissance) — 100-110% VMA perçue | 5-8% pente
  → 8-15 × 80-150m — récup descente marchée

FARTLEK STRUCTURÉ — 40-60 min
  → Ex : 10min EF + 6 × (3min @ 90% VMA + 2min EF) + 10min EF

ALLURE SPÉCIFIQUE COMPÉTITION :
  → 5km : 102-105% VMA | 10km : 97-100% VMA | Semi : 90-93% VMA | Marathon : 83-86% VMA

RÉCUPÉRATION ACTIVE — 55-60% VMA | RPE 1-2 | 20-40 min max

═══════════════════════════════════════════
PRINCIPES DE PROGRAMMATION
═══════════════════════════════════════════

MODÈLE POLARISÉ 80/20 (distribution idéale) :
  • 75-80% volume en EF/récup (zones basses)
  • 10-15% en seuil/tempo
  • 5-10% en VMA/fractionné
  → Jamais 2 séances intenses consécutives
  → Séance longue EF le week-end de préférence
  → Séance clé qualité en milieu de semaine (J+2 après récup)

CYCLE DE CHARGE STANDARD (3:1 ou 4:1) :
  Semaine 1 : charge normale (base)
  Semaine 2 : +8-10% volume, même intensité
  Semaine 3 : +10-15% volume, légère intensification
  Semaine 4 : décharge (-25 à -30% volume, maintien fréquence)
  → Après décharge : reprise à +5% du niveau pré-décharge

PROGRESSION VERS LA COMPÉTITION :
  Phase fondamentale (6-10 sem) : 80% EF, 20% seuil, 0% VMA
  Phase développement (4-6 sem) : 65% EF, 20% seuil, 15% VMA
  Phase spécifique (3-5 sem) : allure compétition + seuil, réduction EF
  Phase affûtage (2-3 sem) : volume -30-40%, maintien intensité, 0 stimulus nouveau
  Semaine de compétition : volume -50-60%, uniquement activation

═══════════════════════════════════════════
CONTEXTE DE L'ATHLÈTE${criticalCompetitionAlert}
═══════════════════════════════════════════

Nom : ${ctx.athleteName}
${vmaSection}

${objectiveInfo}
${phaseInfo}

Semaine consultée : S${ctx.selectedWeek.week} ${ctx.selectedWeek.year}
Séances cardio de la semaine (renfo exclue) :
${sessionLines}

─── Planning complet ─────────────────────
${mesocycleSection}

─── Compétitions & objectifs clés ────────
${milestonesSection}

─── Volume récent ────────────────────────
${historySection}

═══════════════════════════════════════════
FORMAT DE RÉPONSE
═══════════════════════════════════════════

- Langue : français uniquement
- Commence par une analyse de contexte (1-3 lignes) si l'historique ou la proximité d'une compétition le justifient
- Structure les séances avec numéros et tirets
- Allures toujours en min/km + (% VMA) entre parenthèses
- Si tu proposes une semaine complète : indique le volume total et la répartition EF/seuil/VMA
- Si tu proposes un bloc de semaines : indique la logique de progression semaine par semaine
- Si une information manque, pose UNE question ciblée d'abord — ne suppose pas
- Signal les risques de surcharge ou de manque de récupération si détectés
`;
}

// ─── Groq call ────────────────────────────────────────────────────────────────
async function askGroq(messages: Message[], systemPrompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("Clé API Groq manquante (VITE_GROQ_API_KEY)");

  const resp = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.4,
      max_tokens: 1536,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Groq ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "Pas de réponse.";
}

// ─── Suggested questions ──────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Analyse le volume récent et propose la semaine suivante en conséquence.",
  "Construis un bloc de 4 semaines (3+1 décharge) adapté à la phase actuelle.",
  "Propose-moi une séance de fractionné court avec les allures exactes.",
  "Donne-moi une séance de seuil / tempo complète avec échauffement.",
  "Comment préparer les 3 dernières semaines avant la compétition ?",
  "Donne-moi une séance de côtes avec le détail complet.",
];

// ─── Component ────────────────────────────────────────────────────────────────
interface CoachCardioAIChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: AIChatContext;
}

export function CoachCardioAIChat({ open, onOpenChange, context }: CoachCardioAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const systemPrompt = buildSystemPrompt(context);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: Message = { role: "user", content };
    const nextMessages = [...messages, userMsg];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const reply = await askGroq(nextMessages, systemPrompt);
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
    } catch (err: any) {
      toast.error("Erreur IA : " + (err?.message ?? "Inconnue"));
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 gap-0">

        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold leading-tight">
                  IA Cardio & Course
                </SheetTitle>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Conseils programmation — S{context.selectedWeek.week}
                  {context.athleteName ? ` · ${context.athleteName}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {context.athleteVma && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  VMA {context.athleteVma} km/h
                </Badge>
              )}
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={clearChat}
                  title="Effacer la conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Context pills */}
        {(() => {
          const today = new Date();
          const nextComp = context.milestones
            ?.filter((m) => !m.completed && new Date(m.targetDate) >= today)
            .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime())[0];
          const weeksAway = nextComp ? weeksUntil(nextComp.targetDate, context.selectedWeek) : null;
          const isUrgent = weeksAway !== null && weeksAway <= 3 && weeksAway > 0;
          return (
            <div className="px-4 py-2 border-b bg-muted/30 shrink-0 space-y-1">
              {context.sessions.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  <span className="font-medium">Séances :</span>{" "}
                  {context.sessions.map((s) => s.name).join(", ")}
                </p>
              )}
              {context.mesocycleName && (
                <p className="text-[10px] text-muted-foreground">
                  <span className="font-medium">Phase :</span>{" "}
                  {context.mesocycleName}{context.phaseType ? ` · ${context.phaseType}` : ""}
                </p>
              )}
              {nextComp && (
                <p className={`text-[10px] font-medium ${isUrgent ? "text-amber-600" : "text-muted-foreground"}`}>
                  {isUrgent ? "⚠ " : "🎯 "}
                  {nextComp.label} — {new Date(nextComp.targetDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  {weeksAway !== null ? ` (J-${weeksAway * 7} · ${weeksAway} sem.)` : ""}
                </p>
              )}
            </div>
          );
        })()}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">

          {/* Welcome state */}
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-muted/40 rounded-2xl rounded-tl-sm px-3 py-2.5 text-sm text-foreground max-w-[85%]">
                  Bonjour ! Je suis ton assistant spécialisé en programmation course à pied.{" "}
                  {context.athleteVma
                    ? `Je connais la VMA de ${context.athleteName} (${context.athleteVma} km/h)`
                    : `Je suis prêt à travailler sur ${context.athleteName}`}
                  {(context.allMesocycles?.length ?? 0) > 0
                    ? `, son planning de ${context.allMesocycles!.length} mésocycle(s)`
                    : ""}
                  {(context.milestones?.filter((m) => !m.completed).length ?? 0) > 0
                    ? ` et ses ${context.milestones!.filter((m) => !m.completed).length} objectif(s) à venir`
                    : ""}
                  {(context.recentHistory?.some((w) => w.totalKm > 0)) ?? false
                    ? ". J'ai accès à l'historique de volume des dernières semaines."
                    : "."}
                  {" "}Comment puis-je t'aider ?
                </div>
              </div>

              {/* Suggestions */}
              <div className="space-y-1.5 pl-8">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  Questions suggérées
                </p>
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left text-xs text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat history */}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 items-start ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.role === "user"
                  ? <User className="h-3.5 w-3.5" />
                  : <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                }
              </div>
              <div
                className={`rounded-2xl px-3 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted/40 text-foreground rounded-tl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-2 items-start">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="bg-muted/40 rounded-2xl rounded-tl-sm px-3 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-3 border-t bg-background shrink-0">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pose ta question sur la programmation cardio…"
              rows={2}
              className="resize-none text-sm min-h-[60px] max-h-[120px]"
              disabled={loading}
            />
            <Button
              size="sm"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="h-10 w-10 p-0 shrink-0"
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            Entrée pour envoyer · Maj+Entrée pour saut de ligne
          </p>
        </div>

      </SheetContent>
    </Sheet>
  );
}
