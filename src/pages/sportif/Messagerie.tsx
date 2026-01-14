import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Video, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/hooks/useMessages";
import { toast } from "sonner";
import { MediaPreviewDialog } from "@/components/MediaPreviewDialog";

export default function Messagerie() {
  const { user } = useAuth();
  const [coachId, setCoachId] = useState<string | null>(null);
  const [coachName, setCoachName] = useState<string>("ton coach");
  const [messageText, setMessageText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'video' | 'image' } | null>(null);
  
  const { messages, sendMessage, markAsRead } = useMessages(coachId || undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll vers le dernier message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Charger le coach de l'athlète
  useEffect(() => {
    if (!user) return;

    const loadCoach = async () => {
      const { data: relationship } = await supabase
        .from("coach_athlete_relationships")
        .select("coach_id")
        .eq("athlete_id", user.id)
        .eq("status", "approved")
        .single();

      if (relationship?.coach_id) {
        setCoachId(relationship.coach_id);

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("first_name, last_name")
          .eq("id", relationship.coach_id)
          .single();

        if (profile) {
          setCoachName(`${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "ton coach");
        }
      }
    };

    loadCoach();
  }, [user]);

  // Mark as read when new messages arrive
  useEffect(() => {
    if (coachId && messages.length > 0 && user) {
      const unreadMessages = messages.filter(
        (msg) => msg.receiver_id === user.id && !msg.read_at
      );
      if (unreadMessages.length > 0) {
        markAsRead(unreadMessages.map((msg) => msg.id));
      }
    }
  }, [coachId, messages, user, markAsRead]);

  const handleSend = async () => {
    if (!messageText.trim() || !coachId) return;

    try {
      await sendMessage(coachId, messageText);
      setMessageText("");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Erreur lors de l'envoi du message");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !coachId) return;

    // Check file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Le fichier est trop volumineux (max 100MB)");
      return;
    }

    // Check file type
    if (!file.type.startsWith('video/') && !file.type.startsWith('image/')) {
      toast.error("Format non supporté. Utilisez une vidéo ou une image.");
      return;
    }

    setIsUploading(true);
    try {
      await sendMessage(coachId, "", file);
      toast.success("Fichier envoyé !");
    } catch (error) {
      console.error("Failed to send file:", error);
      toast.error("Erreur lors de l'envoi du fichier");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!coachId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Messagerie</h1>
          <p className="text-muted-foreground mt-2">
            Échange avec ton coach
          </p>
        </div>
        <Card>
          <CardContent className="h-[400px] flex items-center justify-center">
            <p className="text-muted-foreground">
              Aucun coach n'est encore associé à ton compte.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Messagerie</h1>
        <p className="text-muted-foreground mt-2">
          Échange avec {coachName}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Conversation avec {coachName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-[400px] sm:h-[500px] pr-4">
            <div className="space-y-3">
              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        isMe
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {/* Afficher la vidéo si présente */}
                      {msg.attachment_url && msg.attachment_type === 'video' && (
                        <video
                          src={msg.attachment_url}
                          controls
                          className="max-w-full rounded-md mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                          style={{ maxHeight: '300px' }}
                          onClick={() => setPreviewMedia({ url: msg.attachment_url!, type: 'video' })}
                        />
                      )}
                      {/* Afficher l'image si présente */}
                      {msg.attachment_url && msg.attachment_type === 'image' && (
                        <img
                          src={msg.attachment_url}
                          alt="Image"
                          className="max-w-full rounded-md mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                          style={{ maxHeight: '300px' }}
                          onClick={() => setPreviewMedia({ url: msg.attachment_url!, type: 'image' })}
                        />
                      )}
                      {msg.content && !msg.content.startsWith('📹') && !msg.content.startsWith('📎') && (
                        <p className="text-sm break-words">{msg.content}</p>
                      )}
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(msg.created_at).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucun message pour le moment. Commence la conversation !
                </p>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="video/*,image/*"
            className="hidden"
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Envoyer une vidéo ou image"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Video className="h-4 w-4" />
              )}
            </Button>
            <Input
              placeholder="Écris ton message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
              disabled={isUploading}
            />
            <Button onClick={handleSend} size="icon" disabled={!messageText.trim() || isUploading}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de prévisualisation média */}
      <MediaPreviewDialog
        open={!!previewMedia}
        onOpenChange={(open) => !open && setPreviewMedia(null)}
        url={previewMedia?.url || ''}
        type={previewMedia?.type || 'image'}
      />
    </div>
  );
}
