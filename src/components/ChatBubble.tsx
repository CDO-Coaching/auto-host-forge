import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export function ChatBubble() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [coachName, setCoachName] = useState<string>("Coach");
  const [messageText, setMessageText] = useState("");
  const { messages, unreadCount, sendMessage, markAsRead } = useMessages(coachId || undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load coach info
  useEffect(() => {
    if (!user) return;

    const loadCoach = async () => {
      // Get the relationship first
      const { data: relationship } = await supabase
        .from("coach_athlete_relationships")
        .select("coach_id")
        .eq("athlete_id", user.id)
        .eq("status", "approved")
        .single();

      if (relationship?.coach_id) {
        setCoachId(relationship.coach_id);
        
        // Then get the coach profile
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("first_name, last_name")
          .eq("id", relationship.coach_id)
          .single();

        if (profile) {
          setCoachName(`${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Coach");
        }
      }
    };

    loadCoach();
  }, [user]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Mark messages as read when opening chat
  useEffect(() => {
    if (isOpen && messages.length > 0 && user) {
      const unreadMessages = messages.filter(
        (msg) => msg.receiver_id === user.id && !msg.read_at
      );
      if (unreadMessages.length > 0) {
        markAsRead(unreadMessages.map((msg) => msg.id));
      }
    }
  }, [isOpen, messages, user, markAsRead]);

  const handleSend = async () => {
    if (!messageText.trim() || !coachId) return;

    try {
      await sendMessage(coachId, messageText);
      setMessageText("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!coachId) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="rounded-full h-14 w-14 shadow-lg relative"
        >
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center p-0 rounded-full"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      ) : (
        <Card className="w-80 sm:w-96 shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">Message à {coachName}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-80 pr-4" ref={scrollRef}>
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 ${
                          isMe
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm break-words">{msg.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(msg.created_at).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Input
                placeholder="Écris ton message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button onClick={handleSend} size="icon" disabled={!messageText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
