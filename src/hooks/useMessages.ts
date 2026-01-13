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
  attachment_url?: string | null;
  attachment_type?: string | null;
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

    // Subscribe to new messages - using simpler filters that work with Supabase realtime
    const channel = supabase
      .channel(`messages-${user.id}-${otherUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new as Message;
          // Filter client-side for this conversation
          const isRelevant =
            (newMessage.sender_id === user.id && newMessage.receiver_id === otherUserId) ||
            (newMessage.sender_id === otherUserId && newMessage.receiver_id === user.id);
          
          if (isRelevant) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((msg) => msg.id === newMessage.id)) {
                return prev;
              }
              return [...prev, newMessage];
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updatedMessage.id ? updatedMessage : msg
            )
          );
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

  const uploadAttachment = async (file: File): Promise<{ url: string; type: string } | null> => {
    if (!user) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(fileName, file);
    
    if (uploadError) {
      console.error('Error uploading attachment:', uploadError);
      throw uploadError;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(fileName);
    
    // Determine attachment type
    const mimeType = file.type;
    let attachmentType = 'file';
    if (mimeType.startsWith('video/')) attachmentType = 'video';
    else if (mimeType.startsWith('image/')) attachmentType = 'image';
    
    return { url: publicUrl, type: attachmentType };
  };

  const sendMessage = async (receiverId: string, content: string, attachment?: File) => {
    if (!user || (!content.trim() && !attachment)) return;

    let attachmentUrl: string | null = null;
    let attachmentType: string | null = null;

    // Upload attachment if provided
    if (attachment) {
      const result = await uploadAttachment(attachment);
      if (result) {
        attachmentUrl = result.url;
        attachmentType = result.type;
      }
    }

    // Create optimistic message with temporary ID
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      sender_id: user.id,
      receiver_id: receiverId,
      content: content.trim(),
      created_at: new Date().toISOString(),
      read_at: null,
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
    };

    // Add optimistically to UI immediately
    setMessages((prev) => [...prev, optimisticMessage]);

    const { data, error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: receiverId,
      content: content.trim() || (attachmentType === 'video' ? '📹 Vidéo' : '📎 Fichier'),
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
    }).select().single();

    if (error) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id));
      console.error("Error sending message:", error);
      throw error;
    }

    // Replace optimistic message with real one from DB
    if (data) {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === optimisticMessage.id ? data : msg))
      );
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
