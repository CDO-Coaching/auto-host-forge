/**
 * MethodologyAIChat
 * Chat IA pour créer des fiches de méthodes d'entraînement.
 * Supporte texte + images (vision GPT-4o).
 * À la fin, génère automatiquement un document structuré.
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Send, Paperclip, X, Bot, User, Sparkles, Loader2, FileText, Image as ImageIcon,
} from "lucide-react";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL   = "gpt-4o";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImageAttachment {
  dataUrl: string;   // base64 data URL
  name: string;
  type: string;
}

interface Message {
  role: "user" | "assistant";
  content: string | Array<{ type: string; [key: string]: any }>;
  images?: ImageAttachment[];
}

interface GeneratedDoc {
  title: string;
  category: "force" | "cardio" | "endurance" | "explosivite" | "mental" | "autre";
  tags: string[];
  content: string;
}

interface MethodologyAIChatProps {
  onDocumentGenerated: (doc: GeneratedDoc) => void;
}

// ── Prompts ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un expert en sciences du sport et en méthodologie d'entraînement (force, cardio, endurance, périodisation, récupération).

Le coach t'envoie une méthode d'entraînement : texte libre, image d'un tableau Excel/PDF, photo d'un livre, etc.

Ton rôle :
1. Si c'est une image avec un tableau : extrais TOUTES les données (semaines, séances, séries×reps, % 1RM, charges, etc.) et reproduis le tableau en markdown. Pose 1-2 questions max pour clarifier ce qui manque.
2. Si c'est un texte : pose quelques questions ciblées pour compléter la méthode.
3. Quand le coach dit "génère", "crée", "c'est bon", "ok" → génère la fiche immédiatement.

⚠️ TOUJOURS en français. Sois direct et pratique.

Quand tu génères la fiche, réponds UNIQUEMENT avec ce JSON (rien d'autre avant ni après) :
\`\`\`json
{
  "title": "Nom court de la méthode",
  "category": "force|cardio|endurance|explosivite|mental|autre",
  "tags": ["tag1", "tag2"],
  "content": "Fiche complète en markdown. OBLIGATOIRE : inclure un tableau markdown si des données tabulaires existent (semaines/séances/charges/etc.), suivi d'explications claires."
}
\`\`\`

Format du contenu idéal :
## Description
Courte description de la méthode.

## Objectif
À qui ça s'adresse et pourquoi.

## Programme
| Semaine | Séance | Séries×Reps | % 1RM | Charge (ex: 1RM=115kg) |
|---------|--------|-------------|-------|------------------------|
| ... | ... | ... | ... | ... |

## Points clés
- Point 1
- Point 2

## Quand l'utiliser
Contexte d'utilisation.`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseGeneratedDoc(text: string): GeneratedDoc | null {
  try {
    const match = text.match(/```json\s*([\s\S]*?)```/);
    if (!match) return null;
    const parsed = JSON.parse(match[1]);
    if (!parsed.title || !parsed.content) return null;
    return parsed as GeneratedDoc;
  } catch { return null; }
}

function messageTextContent(msg: Message): string {
  if (typeof msg.content === "string") return msg.content;
  const textPart = msg.content.find((p: any) => p.type === "text");
  return textPart?.text ?? "";
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function MethodologyAIChat({ onDocumentGenerated }: MethodologyAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [loading, setLoading]   = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDoc | null>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Envoi d'un message ────────────────────────────────────────────────────

  const handleSend = async () => {
    const text = input.trim();
    if (!text && attachments.length === 0) return;

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) { toast.error("Clé API OpenAI manquante"); return; }

    // Construire le contenu du message user
    let userContent: any;
    if (attachments.length > 0) {
      userContent = [
        { type: "text", text: text || "Voici une image de la méthode." },
        ...attachments.map(img => ({
          type: "image_url",
          image_url: { url: img.dataUrl, detail: "high" },
        })),
      ];
    } else {
      userContent = text;
    }

    const userMsg: Message = { role: "user", content: userContent, images: [...attachments] };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setAttachments([]);
    setLoading(true);

    try {
      // Construire les messages pour l'API (sans les images locales)
      const apiMessages = newMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const resp = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...apiMessages],
          temperature: 0.4,
          max_tokens: 2000,
          stream: true,
        }),
      });

      if (!resp.ok) throw new Error(`API error ${resp.status}`);

      // Streaming
      const assistantMsg: Message = { role: "assistant", content: "" };
      setMessages(prev => [...prev, assistantMsg]);

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(l => l.startsWith("data: ") && l !== "data: [DONE]");
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            const delta = data.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              fullText += delta;
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: fullText };
                return copy;
              });
            }
          } catch { /* ignore */ }
        }
      }

      // Vérifier si c'est un JSON de document généré
      const doc = parseGeneratedDoc(fullText);
      if (doc) {
        setGeneratedDoc(doc);
      }

    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la communication avec l'IA");
      setMessages(prev => prev.slice(0, -1)); // retire le message vide
    } finally {
      setLoading(false);
    }
  };

  // ── Upload d'image ────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(f => f.type.startsWith("image/"));
    if (imageFiles.length === 0) { toast.error("Seules les images sont supportées"); return; }
    if (imageFiles.length + attachments.length > 4) { toast.error("Maximum 4 images"); return; }

    const newAttachments = await Promise.all(
      imageFiles.map(async f => ({
        dataUrl: await fileToBase64(f),
        name: f.name,
        type: f.type,
      }))
    );
    setAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Assistant Méthodes</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Explique-moi une méthode d'entraînement ou envoie une image — je créerai la fiche pour toi.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {["Méthode 5/3/1", "Pyramide inversée", "EMOM / AMRAP", "Zones FCR Karvonen", "Périodisation ondulatoire"].map(ex => (
                <button
                  key={ex}
                  onClick={() => setInput(ex)}
                  className="text-xs bg-muted hover:bg-muted/80 px-2.5 py-1 rounded-full text-muted-foreground transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          const text   = messageTextContent(msg);
          const doc    = !isUser ? parseGeneratedDoc(text) : null;

          return (
            <div key={i} className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5 text-primary" />}
              </div>

              <div className={`flex flex-col gap-1.5 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
                {/* Images jointes (user) */}
                {isUser && msg.images && msg.images.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {msg.images.map((img, j) => (
                      <img key={j} src={img.dataUrl} alt={img.name} className="w-20 h-20 object-cover rounded-lg border border-border" />
                    ))}
                  </div>
                )}

                {/* Bulle */}
                {text && !doc && (
                  <div className={`rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${isUser ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"}`}>
                    {text}
                  </div>
                )}

                {/* Document généré */}
                {doc && (
                  <div className="bg-muted rounded-2xl rounded-tl-sm p-4 space-y-3 max-w-md">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Fiche générée ✓</span>
                    </div>
                    <div className="bg-background rounded-lg p-3 border border-border space-y-1.5">
                      <p className="font-semibold text-sm">{doc.title}</p>
                      <Badge variant="outline" className="text-[10px]">{doc.category}</Badge>
                      <p className="text-xs text-muted-foreground line-clamp-3">{doc.content.replace(/[#*`]/g, "").slice(0, 150)}...</p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {doc.tags.map(t => <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">#{t}</span>)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => onDocumentGenerated(doc)}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                      Enregistrer dans la bibliothèque
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Zone d'input */}
      <div className="border-t border-border p-3 space-y-2">
        {/* Aperçu images */}
        {attachments.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {attachments.map((img, i) => (
              <div key={i} className="relative group">
                <img src={img.dataUrl} alt={img.name} className="w-14 h-14 object-cover rounded-lg border border-border" />
                <button
                  onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 shrink-0"
            onClick={() => fileRef.current?.click()}
            title="Ajouter une image"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Explique la méthode ou pose une question... (Entrée pour envoyer)"
            className="min-h-[40px] max-h-32 resize-none text-sm py-2"
            rows={1}
          />
          <Button
            size="sm"
            className="h-9 w-9 p-0 shrink-0"
            onClick={handleSend}
            disabled={loading || (!input.trim() && attachments.length === 0)}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Dis <span className="font-medium">"génère le document"</span> quand tu es prêt à créer la fiche
        </p>
      </div>
    </div>
  );
}
