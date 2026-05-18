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

export interface AIChatContext {
  athleteName: string;
  athleteVma?: number | null;
  selectedWeek: { week: number; year: number };
  sessions: AIChatSession[];
  mesocycleName?: string;
  phaseType?: string;
  mesocycleStart?: string;
  mesocycleEnd?: string;
  objective?: string; // athlete's main objective
  recentHistory?: AIChatWeekHistory[]; // last 8 weeks of cardio
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

// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(ctx: AIChatContext): string {
  const cardioSessions = ctx.sessions.filter((s) => s.type === "cardio" || s.type === "recup");
  const sessionLines = cardioSessions.length > 0
    ? cardioSessions.map((s, i) =>
        `  ${i + 1}. "${s.name}" (${s.type === "recup" ? "récup active" : "cardio"})` +
        (s.cardioSummary ? ` → ${s.cardioSummary}` : " → contenu non renseigné")
      ).join("\n")
    : "  Aucune séance cardio programmée pour cette semaine.";

  const phaseInfo = ctx.mesocycleName
    ? `  Phase : ${ctx.mesocycleName}${ctx.phaseType ? ` (${ctx.phaseType})` : ""}` +
      (ctx.mesocycleStart && ctx.mesocycleEnd ? ` | ${ctx.mesocycleStart} → ${ctx.mesocycleEnd}` : "")
    : "  Aucune phase active définie.";

  const objectiveInfo = ctx.objective
    ? `  Objectif : ${ctx.objective}`
    : "  Objectif : non renseigné (pose la question si pertinent)";

  const vmaSection = ctx.athleteVma
    ? `VMA = ${ctx.athleteVma} km/h — Table d'allures :
${buildVmaTable(ctx.athleteVma)}`
    : "VMA non renseignée — demande-la impérativement avant de prescrire des allures.";

  // Recent history section
  let historySection = "Historique des 8 dernières semaines cardio : non disponible.";
  if (ctx.recentHistory && ctx.recentHistory.length > 0) {
    const rows = ctx.recentHistory.map((w) => {
      const dur = w.totalMinutes > 0 ? `${Math.round(w.totalMinutes)} min` : "-";
      const km = w.totalKm > 0 ? `${w.totalKm.toFixed(1)} km` : "-";
      const intensity = w.avgIntensityPct ? ` | ~${Math.round(w.avgIntensityPct)}% VMA` : "";
      return `  S${w.weekNumber}/${w.year} : ${km} · ${dur} · ${w.sessionCount} séance(s)${intensity}`;
    });
    const totalKm = ctx.recentHistory.reduce((a, w) => a + w.totalKm, 0);
    const avgKm = totalKm / ctx.recentHistory.length;
    const avgMin = ctx.recentHistory.reduce((a, w) => a + w.totalMinutes, 0) / ctx.recentHistory.length;
    historySection = `Historique des ${ctx.recentHistory.length} dernières semaines cardio :
${rows.join("\n")}
  → Moyenne : ${avgKm.toFixed(1)} km/sem · ${Math.round(avgMin)} min/sem`;
  }

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

2. TOUJOURS UTILISER LA VMA RÉELLE pour les allures — jamais "allure confortable" ou "effort modéré"

3. POSER DES QUESTIONS si un élément manque avant de proposer une programmation :
   - VMA ? (obligatoire pour les allures)
   - Objectif de compétition et date ?
   - Volume habituel ? (vérifie l'historique)
   - Nb de séances cardio par semaine disponibles ?
   - Blessures / contraintes ?
   Ne pose pas toutes ces questions en même temps — priorise selon ce qui manque vraiment.

4. ANALYSER L'HISTORIQUE avant toute recommandation de charge :
   - Respecter le principe de progressivité (max +10-15% de volume par semaine)
   - Identifier les semaines de décharge (toutes les 3-4 semaines)
   - Vérifier les ruptures de charge (surmenage ou désentraînement)
   - Si la charge actuelle est trop haute ou trop basse, le signaler explicitement

5. COHÉRENCE AVEC LA PHASE en cours :
   - Fondamental : 75-80% EF + seuil, PAS de VMA pure
   - Développement : 65% EF + 20% seuil + 15% VMA
   - Spécifique : allure compétition + seuil, réduction EF
   - Affûtage : -30% volume, maintien intensité, pas de nouveau stimulus

═══════════════════════════════════════════
CATALOGUE DE SÉANCES
═══════════════════════════════════════════

ENDURANCE FONDAMENTALE (EF)
  60-70% VMA | RPE 2-4 | Conversation possible
  → Volume : 40-90 min | Idéal : 70% du volume total hebdo

SEUIL AÉROBIE
  75-80% VMA | RPE 5-6 | "Confortablement dur"
  → 20-30 min continu ou 3-4 × 8 min — récup 2 min

TEMPO / SEUIL ANAÉROBIE
  83-88% VMA | RPE 7-8 | "Difficile mais tenable"
  → 20-40 min continu ou 2-3 × 10-15 min — récup 3 min

FRACTIONNÉ COURT (développement VMA)
  100-110% VMA | RPE 9 | Très difficile
  → 30s/30s, 1min/1min, ou 200-400m — récup = durée effort

FRACTIONNÉ LONG (consolidation VMA)
  95-100% VMA | RPE 8-9
  → 600m, 800m, 1000m, 1200m — récup 2-3 min trot

VMA LONGUE
  92-97% VMA | RPE 8
  → 3-5 × 1500-2000m — récup 3-4 min

CÔTES (développement puissance)
  100-110% VMA effort perçu | 5-8% pente
  → 8-15 × 80-150m — récup descente marchée

FARTLEK STRUCTURÉ
  Alternance EF + accélérations sur durée totale 40-60 min
  → Ex : 10min EF, puis 6 × (3min @ 90% + 2min EF), 10min EF

ALLURE SPÉCIFIQUE COMPÉTITION
  Allure cible course | À intégrer en phase spécifique
  → 5km : ~102-105% VMA | 10km : ~97-100% VMA | Semi : ~90-93% VMA | Marathon : ~83-86% VMA

RÉCUPÉRATION ACTIVE
  55-60% VMA | RPE 1-2 | 20-40 min max

═══════════════════════════════════════════
PRINCIPES DE PROGRAMMATION HEBDOMADAIRE
═══════════════════════════════════════════

Distribution idéale (modèle polarisé 80/20) :
  • 75-80% du volume total en EF/récup (zones basses)
  • 10-15% en seuil/tempo
  • 5-10% en VMA/fractionné
  → Jamais 2 séances intenses consécutives
  → Séance longue EF en fin de semaine si possible
  → Séance clé qualité au milieu de semaine (après récup)

Progression du volume :
  • Augmentation max +10-15%/semaine
  • Décharge toutes les 3-4 semaines (-25 à -30% volume)
  • Ne jamais augmenter volume ET intensité la même semaine

Détection de surcharge :
  → Si le volume récent a augmenté >15% sur 2 semaines consécutives : signaler
  → Si pas de semaine de décharge depuis >4 semaines : recommander

═══════════════════════════════════════════
CONTEXTE DE L'ATHLÈTE
═══════════════════════════════════════════

Nom : ${ctx.athleteName}
${vmaSection}

${objectiveInfo}
${phaseInfo}

Semaine en cours : S${ctx.selectedWeek.week} ${ctx.selectedWeek.year}
Séances cardio de cette semaine (renfo exclue) :
${sessionLines}

${historySection}

═══════════════════════════════════════════
FORMAT DE RÉPONSE
═══════════════════════════════════════════

- Langue : français uniquement
- Commence par une analyse rapide si l'historique le justifie (1-2 lignes max)
- Structure les séances avec numéros et tirets
- Allures toujours en min/km + (% VMA) entre parenthèses
- Si tu proposes plusieurs séances, identifie clairement la priorité
- Si une information manque pour répondre correctement, pose UNE question ciblée avant de proposer quoi que ce soit
- Termine toujours par le volume total de la semaine proposée si tu programmes une semaine complète
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
  "Propose-moi une séance de fractionné court avec les allures exactes.",
  "Donne-moi une séance de seuil / tempo complète avec échauffement.",
  "Quelle séance de VMA longue recommandes-tu cette semaine ?",
  "Propose un fartlek structuré de 45 minutes.",
  "Donne-moi une séance de côtes avec le détail complet.",
  "Comment construire un bloc de 4 semaines pour développer la VMA ?",
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

        {/* Context pill */}
        {context.sessions.length > 0 && (
          <div className="px-4 py-2 border-b bg-muted/30 shrink-0">
            <p className="text-[10px] text-muted-foreground">
              <span className="font-medium">Semaine en contexte :</span>{" "}
              {context.sessions.map((s) => s.name).join(", ")}
            </p>
          </div>
        )}

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
                  Bonjour ! Je suis ton assistant spécialisé en programmation course à pied et cardio.
                  {context.athleteVma
                    ? ` Je connais la VMA de ${context.athleteName} (${context.athleteVma} km/h) et la programmation de la semaine.`
                    : ` Je connais la programmation de la semaine pour ${context.athleteName}.`}
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
