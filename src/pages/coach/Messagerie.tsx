import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/hooks/useMessages";
import { Badge } from "@/components/ui/badge";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  unread_count?: number;
}

export default function Messagerie() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [messageText, setMessageText] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  const { messages, sendMessage, markAsRead } = useMessages(selectedClient?.id);

  // Load all clients
  useEffect(() => {
    if (!user) return;

    const loadClients = async () => {
      const { data } = await supabase
        .from("coach_athlete_relationships")
        .select("athlete_id, user_profiles!coach_athlete_relationships_athlete_id_fkey(id, first_name, last_name)")
        .eq("coach_id", user.id)
        .eq("status", "approved");

      if (data) {
        const clientsList = data.map((rel: any) => ({
          id: rel.athlete_id,
          first_name: rel.user_profiles?.first_name || "Prénom",
          last_name: rel.user_profiles?.last_name || "Nom",
        }));
        setClients(clientsList);
      }
    };

    loadClients();
  }, [user]);

  // Load unread counts for all clients
  useEffect(() => {
    if (!user) return;

    const loadUnreadCounts = async () => {
      const { data } = await supabase.rpc("get_unread_count_by_sender");

      if (data) {
        const counts: Record<string, number> = {};
        data.forEach((item: any) => {
          counts[item.sender_id] = item.unread_count;
        });
        setUnreadCounts(counts);
      }
    };

    loadUnreadCounts();

    // Subscribe to changes
    const channel = supabase
      .channel(`coach-unread-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          loadUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Mark as read when selecting a client or when new messages arrive
  useEffect(() => {
    if (selectedClient && messages.length > 0 && user) {
      const unreadMessages = messages.filter(
        (msg) => msg.receiver_id === user.id && !msg.read_at
      );
      if (unreadMessages.length > 0) {
        markAsRead(unreadMessages.map((msg) => msg.id));
      }
    }
  }, [selectedClient, messages, user, markAsRead]);

  const handleSend = async () => {
    if (!messageText.trim() || !selectedClient) return;

    try {
      await sendMessage(selectedClient.id, messageText);
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

  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Messagerie</h1>
        <p className="text-muted-foreground mt-2">
          Communique avec tes clients {totalUnread > 0 && `(${totalUnread} nouveau${totalUnread > 1 ? 'x' : ''} message${totalUnread > 1 ? 's' : ''})`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Liste des clients */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Mes clients</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {clients.map((client) => (
                  <Button
                    key={client.id}
                    variant={selectedClient?.id === client.id ? "secondary" : "ghost"}
                    className="w-full justify-start relative"
                    onClick={() => setSelectedClient(client)}
                  >
                    <User className="h-4 w-4 mr-2" />
                    <span className="flex-1 text-left">
                      {client.first_name} {client.last_name}
                    </span>
                    {unreadCounts[client.id] > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {unreadCounts[client.id]}
                      </Badge>
                    )}
                  </Button>
                ))}
                {clients.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Aucun client pour le moment
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Zone de conversation */}
        <Card className="md:col-span-2">
          {selectedClient ? (
            <>
              <CardHeader>
                <CardTitle>
                  Conversation avec {selectedClient.first_name} {selectedClient.last_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-[500px] pr-4">
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
                            <p className="text-sm break-words">{msg.content}</p>
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
            </>
          ) : (
            <CardContent className="h-[600px] flex items-center justify-center">
              <p className="text-muted-foreground">
                Sélectionne un client pour voir la conversation
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
