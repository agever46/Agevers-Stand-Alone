import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Send, Loader2, X, Pencil, Check, XCircle, Paperclip, FileText, Download } from "lucide-react";
import { gameSounds } from "@/lib/gameSounds";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  sender_role: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited?: boolean;
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
}

const ATTACHMENT_BUCKET = "chat-attachments";

const ChatAttachment = ({ msg }: { msg: ChatMessage }) => {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = (msg.attachment_type || "").startsWith("image/");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!msg.attachment_path) return;
      const { data } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrl(msg.attachment_path, 60 * 60);
      if (!cancelled) setUrl(data?.signedUrl || null);
    })();
    return () => { cancelled = true; };
  }, [msg.attachment_path]);

  if (!msg.attachment_path) return null;

  if (isImage) {
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img
          src={url}
          alt={msg.attachment_name || "Attachment"}
          loading="lazy"
          className="rounded-lg max-h-56 w-auto object-cover border border-border"
        />
      </a>
    ) : (
      <div className="mt-1 h-24 w-40 rounded-lg bg-muted/40 animate-pulse" />
    );
  }

  return (
    <a
      href={url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-background/40 px-2 py-1.5 text-xs hover:border-primary/50 transition-colors"
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate max-w-[160px]">{msg.attachment_name || "File"}</span>
      <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
    </a>
  );
};

interface LiveChatPanelProps {
  requestId: string;
  currentUserId: string;
  currentRole: "admin" | "user";
  userEmail?: string;
  onClose: (wasClosed?: boolean) => void;
}

const LiveChatPanel = ({ requestId, currentUserId, currentRole, userEmail, onClose }: LiveChatPanelProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [otherTyping, setOtherTyping] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isClosed, setIsClosed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    if (messages.length > prevCountRef.current && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.sender_role !== currentRole) {
        gameSounds.notification();
      }
    }
    prevCountRef.current = messages.length;
  }, [messages, currentRole]);

  const setTypingStatus = useCallback(async (isTyping: boolean) => {
    await supabase.from("live_chat_typing" as any).upsert({
      request_id: requestId,
      user_id: currentUserId,
      is_typing: isTyping,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: "request_id,user_id" } as any);
  }, [requestId, currentUserId]);

  const handleInputChange = (val: string) => {
    setInput(val);
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000) {
      setTypingStatus(true);
      lastTypingSentRef.current = now;
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTypingStatus(false), 3000);
  };

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("live_chat_messages")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as ChatMessage[]);
      setLoading(false);
    };
    fetchMessages();

    if (currentRole === "admin") {
      supabase
        .from("live_support_requests")
        .update({ status: "active" } as any)
        .eq("id", requestId)
        .then(() => {});
      
      // Send system message that agent joined - but only if no messages exist yet
      // to avoid cluttering if the admin just re-opens the panel.
      if (messages.length === 0) {
        supabase.from("live_chat_messages").insert({
          request_id: requestId,
          sender_id: currentUserId,
          sender_role: "system",
          content: "An agent has joined the chat.",
        }).then(() => {});
      }
    }

    // Buyer presence heartbeat — updates buyer_last_seen_at so the notifier
    // edge function can skip emails when buyer is actively in the chat.
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    if (currentRole === "user") {
      const ping = () => {
        supabase
          .from("live_support_requests")
          .update({ buyer_last_seen_at: new Date().toISOString() } as any)
          .eq("id", requestId)
          .then(() => {});
      };
      ping();
      heartbeatTimer = setInterval(ping, 20000);
    }

    const channel = supabase
      .channel(`live-chat-${requestId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `request_id=eq.${requestId}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_chat_messages", filter: `request_id=eq.${requestId}` },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m));
        }
      )
      .subscribe();

    // Listen for chat closed by the other side
    const statusChannel = supabase
      .channel(`live-status-panel-${requestId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_support_requests", filter: `id=eq.${requestId}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated.status === "closed") {
            setIsClosed(true);
          }
        }
      )
      .subscribe();

    const typingChannel = supabase
      .channel(`live-typing-${requestId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_chat_typing", filter: `request_id=eq.${requestId}` },
        (payload) => {
          const row = payload.new as any;
          if (row.user_id !== currentUserId) {
            setOtherTyping(row.is_typing || false);
          }
        }
      )
      .subscribe();

    // Ground-truth poll: a postgres_changes channel can silently stop
    // delivering events after a network blip or a backgrounded tab (not
    // every browser/network fires a clean error for that), which otherwise
    // only self-heals when this panel gets unmounted and remounted. Re-fetch
    // periodically so a missed message or closed-status update surfaces
    // within seconds instead of requiring a manual rejoin/refresh.
    const pollInterval = setInterval(() => {
      fetchMessages();
      supabase
        .from("live_support_requests")
        .select("status")
        .eq("id", requestId)
        .maybeSingle()
        .then(({ data }) => {
          if ((data as any)?.status === "closed") setIsClosed(true);
        });
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(statusChannel);
      supabase.removeChannel(typingChannel);
      setTypingStatus(false);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      clearInterval(pollInterval);
    };
  }, [requestId, currentRole, currentUserId, setTypingStatus]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = "36px";
    }
    setTypingStatus(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    const { data: inserted, error } = await supabase
      .from("live_chat_messages")
      .insert({
        request_id: requestId,
        sender_id: currentUserId,
        sender_role: currentRole,
        content: trimmed,
      })
      .select()
      .maybeSingle();
    if (error) {
      setInput(trimmed);
      console.error("Send error:", error);
    } else {
      // Optimistic append — don't rely on realtime echo for our own message
      if (inserted) {
        const row = inserted as unknown as ChatMessage;
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
      }
      if (currentRole === "admin") {
      // Fire-and-forget: notify buyer by email if they are away/throttle ok
      supabase.functions.invoke("notify-buyer-chat-message", {
        body: { requestId, messagePreview: trimmed },
      }).catch((e) => console.warn("notify-buyer-chat-message failed", e));
      }
    }
    setSending(false);
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file || uploading || isClosed) return;

    const allowed = /^(image\/(png|jpe?g|webp|gif|heic|heif)|application\/pdf)$/i;
    if (!allowed.test(file.type)) {
      toast.error("Only images (JPG, PNG, WEBP, GIF) or PDF files are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${requestId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (upErr) {
      setUploading(false);
      toast.error("Upload failed: " + upErr.message);
      return;
    }

    const caption = input.trim();
    const { data: inserted, error } = await supabase
      .from("live_chat_messages")
      .insert({
        request_id: requestId,
        sender_id: currentUserId,
        sender_role: currentRole,
        content: caption || (file.type === "application/pdf" ? "📎 Sent a document" : "📷 Sent an image"),
        attachment_path: path,
        attachment_name: file.name,
        attachment_type: file.type,
        attachment_size: file.size,
      } as any)
      .select()
      .maybeSingle();

    setUploading(false);

    if (error) {
      await supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
      toast.error("Could not send the file. Please try again.");
      return;
    }

    setInput("");
    if (inserted) {
      const row = inserted as unknown as ChatMessage;
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
    }
    if (currentRole === "admin") {
      supabase.functions.invoke("notify-buyer-chat-message", {
        body: { requestId, messagePreview: caption || "Sent you a file" },
      }).catch(() => {});
    }
  };

  const handleEdit = async (msgId: string) => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    const { data: updated } = await supabase
      .from("live_chat_messages")
      .update({ content: trimmed, edited: true })
      .eq("id", msgId)
      .select()
      .maybeSingle();
    if (updated) {
      const row = updated as unknown as ChatMessage;
      setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
    }
    setEditingId(null);
    setEditText("");
  };

  const handleUserClose = async () => {
    // Send system close message
    const closedBy = currentRole === "admin" ? "Admin" : "User";
    const { data: sysMsg } = await supabase
      .from("live_chat_messages")
      .insert({
        request_id: requestId,
        sender_id: currentUserId,
        sender_role: "system",
        content: `Chat ended by ${closedBy}.`,
      })
      .select()
      .maybeSingle();
    if (sysMsg) {
      const row = sysMsg as unknown as ChatMessage;
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
    }
    await supabase
      .from("live_support_requests")
      .update({ status: "closed" } as any)
      .eq("id", requestId);
    setIsClosed(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30 shrink-0">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isClosed ? "bg-red-400" : "bg-green-400 animate-pulse"}`} />
          <span className="text-xs font-display font-bold text-foreground">
            {currentRole === "admin"
              ? `Live Chat — ${userEmail || "User"}`
              : isClosed
                ? "Chat Ended"
                : "Live Agent Connected"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isClosed && (
            <button
              onClick={handleUserClose}
              className="text-xs text-destructive hover:text-destructive/80 font-display font-semibold mr-2"
            >
              End Chat
            </button>
          )}
          <button onClick={() => onClose(isClosed)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">
            {currentRole === "admin" ? "Send a message to start the conversation." : "An agent has joined. How can we help?"}
          </p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            // "system" role is for join/leave notifications. 
            // Automated security messages are sent with sender_role "admin" but from system UUID.
            const isSystemNotification = msg.sender_role === "system";
            const isEditing = editingId === msg.id;

            if (isSystemNotification) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-[10px] text-muted-foreground italic bg-muted/50 rounded-full px-3 py-1">
                    {msg.content}
                  </span>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} group`}>
                <div className="flex flex-col max-w-[80%]">
                  {isEditing ? (
                    <div className="flex gap-1 items-end">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleEdit(msg.id); if (e.key === "Escape") setEditingId(null); }}
                        className="flex-1 h-8 px-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                      />
                      <button onClick={() => handleEdit(msg.id)} className="text-primary hover:text-primary/80">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div
                        className={`rounded-xl px-3 py-2 text-sm ${
                          isMe || (currentRole === "admin" && msg.sender_id === "00000000-0000-0000-0000-000000000000")
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-secondary text-foreground rounded-bl-sm"
                        }`}
                      >
                        {msg.content}
                        {msg.edited && (
                          <span className="text-[9px] opacity-60 ml-1">(edited)</span>
                        )}
                        <ChatAttachment msg={msg} />
                      </div>
                      {isMe && (
                        <button
                          onClick={() => { setEditingId(msg.id); setEditText(msg.content); }}
                          className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {otherTyping && (
          <div className="flex justify-start">
            <div className="bg-secondary rounded-xl px-3 py-2 flex items-center gap-1">
              <span className="text-xs text-muted-foreground italic">typing</span>
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input / Closed */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        {isClosed ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-display">This chat has ended.</span>
            <Button size="sm" variant="outline" onClick={() => onClose(isClosed)} className="text-xs h-8">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFilePick}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || sending}
              title="Attach a photo or document (max 10MB)"
              aria-label="Attach a photo or document"
              className="h-9 w-9 shrink-0 rounded-lg border border-border bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </button>
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim()) handleSend();
                }
              }}
              placeholder={uploading ? "Uploading file..." : "Type a message..."}
              className="flex-1 min-h-[36px] max-h-[160px] px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none overflow-y-auto"
              disabled={sending || uploading}
            />
            <Button type="submit" size="sm" className="h-9 w-9 p-0" disabled={!input.trim() || sending || uploading}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LiveChatPanel;
