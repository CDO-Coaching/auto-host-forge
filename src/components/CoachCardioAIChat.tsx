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

export interface AIChatContext {
  athleteName: string;
  athleteVma?: number | null;
  selectedWeek: { week: number; year: number };
  sessions: AIChatSession[];
  mesocycleName?: string;
  phaseType?: string;
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
        `  Séance cardio ${i + 1} (${s.type === "recup" ? "récupération active" : "cardio"}): "${s.name}"` +
        (s.cardioSummary ? ` — ${s.cardioSummary}` : "")
      ).join("\n")
    : "  Aucune séance cardio programmée pour cette semaine.";

  const phaseInfo = ctx.mesocycleName
    ? `Phase active : ${ctx.mesocycleName}${ctx.phaseType ? ` (${ctx.phaseType})` : ""}.`
    : "";

  const vmaSection = ctx.athleteVma
    ? `\nTable d'allures calculées pour VMA = ${ctx.athleteVma} km/h :\n${buildVmaTable(ctx.athleteVma)}`
    : "";

  return `Tu es un préparateur physique expert en course à pied et endurance, avec 15 ans d'expérience en entraînement de coureurs de tous niveaux.

RÈGLE ABSOLUE : Tu ne proposes JAMAIS de séances vagues. Chaque réponse contenant une séance doit inclure :
- Le format EXACT : Nbre rép × distance ou durée @ allure min/km (ou % VMA) — récupération
- Exemple obligatoire : "8 × 400m @ 3:45/km (105% VMA) — récup 90s trot"
- L'échauffement (15-20 min EF + éducatifs) et le retour au calme (10 min EF)
- Le volume total de la séance en km

Tu dois systématiquement utiliser les allures calculées depuis la VMA de l'athlète. Jamais de "courez à allure confortable" ou "intensité modérée" — toujours des chiffres.

Types de séances que tu maîtrises parfaitement :
- Fractionné court (200-400m, 100-110% VMA, récup = durée effort)
- Fractionné long (1000-2000m, 95-100% VMA, récup 2-3 min)
- Seuil / tempo (20-40 min continu ou 2-3 × 10-15 min, 83-88% VMA)
- VMA longue (600-1200m, 95-100% VMA)
- Endurance fondamentale (EF, 60-70% VMA, volume long)
- Côtes (8-12 × 80-150m en montée, 100-105% VMA effort perçu)
- Fartlek (séquences libres avec variations d'allure intégrées)
- Allure spécifique compétition (allure objectif 5km/10km/semi/marathon)

Périodisation endurance :
- Fondamental (6-8 sem) : 80% EF, 20% seuil, pas de VMA pure
- Développement (4-6 sem) : 65% EF, 20% seuil, 15% VMA
- Spécifique (3-4 sem) : allure cible + seuil, réduction EF
- Affûtage (2-3 sem) : réduction volume 30-40%, maintien intensité

Contexte athlète :
- Nom : ${ctx.athleteName}
- VMA : ${ctx.athleteVma ? `${ctx.athleteVma} km/h` : "non renseignée (demande-la au coach si besoin)"}
- Semaine : S${ctx.selectedWeek.week} ${ctx.selectedWeek.year}
${phaseInfo}
${vmaSection}

Séances cardio programmées cette semaine (les séances de renforcement musculaire sont exclues — tu n'en tiens pas compte) :
${sessionLines}

Format de réponse :
- Réponds en français
- Structure tes séances avec des tirets ou numéros clairs
- Donne toujours les allures en min/km ET en % VMA
- Si tu donnes plusieurs options, note laquelle tu recommandes en premier
- Pas de blabla introductif — va directement à l'essentiel
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
