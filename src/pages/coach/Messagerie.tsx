import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, User, Users, Video, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/hooks/useMessages";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { MediaPreviewDialog } from "@/components/MediaPreviewDialog";

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
  const [broadcastDialogOpen, setBroadcastDialogOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'video' | 'image' } | null>(null);
  
  const { messages, sendMessage, sendBroadcastMessage, markAsRead } = useMessages(selectedClient?.id);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll vers le dernier message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, selectedClient]);

  // Load all clients
  useEffect(() => {
    if (!user) return;

    const loadClients = async () => {
      // Get all relationships first
      const { data: relationships } = await supabase
        .from("coach_athlete_relationships")
        .select("athlete_id")
        .eq("coach_id", user.id)
        .eq("status", "approved");

      if (relationships) {
        // Get profiles for all athletes
        const athleteIds = relationships.map((rel) => rel.athlete_id);
        
        if (athleteIds.length > 0) {
          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("id, first_name, last_name")
            .in("id", athleteIds);

          if (profiles) {
            const clientsList = profiles.map((profile) => ({
              id: profile.id,
              first_name: profile.first_name || "Prénom",
              last_name: profile.last_name || "Nom",
            }));
            setClients(clientsList);
          }
        }
      }
    };

    loadClients();
  }, [user]);

  // Load unread counts for all clients
  useEffect(() => {
    if (!user) return;

    const loadUnreadCounts = async () => {
      // Récupérer tous les messages non lus où le coach est le receiver
      const { data, error } = await supabase
        .from("messages")
        .select("sender_id")
        .eq("receiver_id", user.id)
        .is("read_at", null);

      if (!error && data) {
        const counts: Record<string, number> = {};
        data.forEach((msg) => {
          counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
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

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClient) return;

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
      await sendMessage(selectedClient.id, "", file);
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

  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim() || clients.length === 0) return;

    setIsSendingBroadcast(true);
    try {
      const clientIds = clients.map((c) => c.id);
      await sendBroadcastMessage(clientIds, broadcastMessage);
      setBroadcastMessage("");
      setBroadcastDialogOpen(false);
      toast.success(`Message envoyé à ${clients.length} client${clients.length > 1 ? 's' : ''}`);
    } catch (error) {
      console.error("Failed to send broadcast message:", error);
      toast.error("Erreur lors de l'envoi du message");
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Messagerie</h1>
          <p className="text-muted-foreground mt-2">
            Communique avec tes clients {totalUnread > 0 && `(${totalUnread} nouveau${totalUnread > 1 ? 'x' : ''} message${totalUnread > 1 ? 's' : ''})`}
          </p>
        </div>
        <Button 
          onClick={() => setBroadcastDialogOpen(true)} 
          disabled={clients.length === 0}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          Message général
        </Button>
      </div>

      {/* Dialog message général */}
      <Dialog open={broadcastDialogOpen} onOpenChange={setBroadcastDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message général</DialogTitle>
            <DialogDescription>
              Ce message sera envoyé à tous tes clients ({clients.length} client{clients.length > 1 ? 's' : ''})
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Écris ton message..."
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            rows={5}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBroadcastDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleSendBroadcast} 
              disabled={!broadcastMessage.trim() || isSendingBroadcast}
            >
              {isSendingBroadcast ? "Envoi..." : "Envoyer à tous"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Liste des clients */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Mes clients</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {[...clients]
                  .sort((a, b) => {
                    const unreadA = unreadCounts[a.id] || 0;
                    const unreadB = unreadCounts[b.id] || 0;
                    // Clients avec messages non lus en premier
                    if (unreadA > 0 && unreadB === 0) return -1;
                    if (unreadA === 0 && unreadB > 0) return 1;
                    // Parmi ceux avec messages non lus, trier par nombre décroissant
                    if (unreadA > 0 && unreadB > 0) return unreadB - unreadA;
                    // Sinon, ordre alphabétique
                    return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
                  })
                  .map((client) => (
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
                  onChange={handleVideoSelect}
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
