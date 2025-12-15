import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

export const useMessages = (otherUserId?: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load messages for a specific conversation
  useEffect(() => {
    if (!user || !otherUserId) {
      setLoading(false);
      return;
    }

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
      setLoading(false);
    };

    loadMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages-${user.id}-${otherUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `or(and(sender_id=eq.${user.id},receiver_id=eq.${otherUserId}),and(sender_id=eq.${otherUserId},receiver_id=eq.${user.id}))`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMessages((prev) => [...prev, payload.new as Message]);
          } else if (payload.eventType === "UPDATE") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === payload.new.id ? (payload.new as Message) : msg
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, otherUserId]);

  // Load unread count (for global notification badge)
  useEffect(() => {
    if (!user) return;

    const loadUnreadCount = async () => {
      const { data, error } = await supabase.rpc("count_unread_messages", {
        user_id: user.id,
      });

      if (!error && data !== null) {
        setUnreadCount(data);
      }
    };

    loadUnreadCount();

    // Subscribe to message changes to update unread count
    const channel = supabase
      .channel(`unread-count-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const sendMessage = async (receiverId: string, content: string) => {
    if (!user || !content.trim()) return;

    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: receiverId,
      content: content.trim(),
    });

    if (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  };

  const sendBroadcastMessage = async (receiverIds: string[], content: string) => {
    if (!user || !content.trim() || receiverIds.length === 0) return;

    const messages = receiverIds.map((receiverId) => ({
      sender_id: user.id,
      receiver_id: receiverId,
      content: content.trim(),
    }));

    const { error } = await supabase.from("messages").insert(messages);

    if (error) {
      console.error("Error sending broadcast message:", error);
      throw error;
    }
  };

  const markAsRead = async (messageIds: string[]) => {
    if (!user || messageIds.length === 0) return;

    const { error } = await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", messageIds)
      .eq("receiver_id", user.id)
      .is("read_at", null);

    if (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  return { messages, loading, unreadCount, sendMessage, sendBroadcastMessage, markAsRead };
};
