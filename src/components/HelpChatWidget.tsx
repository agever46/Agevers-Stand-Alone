import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { gameSounds } from "@/lib/gameSounds";
import { MessageCircle, X, Send, Loader2, Clock, Ticket, ArrowLeft, Headphones, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import LiveChatPanel from "@/components/LiveChatPanel";

type Msg = { role: "user" | "assistant"; content: string };

interface ChatHistory {
  id: string;
  user_email: string;
  status: string;
  created_at: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/help-chat`;

// Israel timezone helper
const getIsraelTime = () => {
  const now = new Date();
  const israelTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  return israelTime;
};

export const isHumanAvailable = () => {
  const it = getIsraelTime();
  const day = it.getDay(); // 0=Sun
  const hour = it.getHours();
  const minute = it.getMinutes();
  const time = hour + minute / 60;

  if (day === 6) return time >= 20 && time < 23; // Saturday 20:00-23:00
  if (day === 5) return time >= 8 && time < 12; // Friday 8:00-12:00
  if (day >= 0 && day <= 4) return time >= 8 && time < 23; // Sun-Thu 8:00-23:00
  return false;
};

type OverrideMode = "auto" | "force_on" | "force_off";

const useLiveSupportSettings = () => {
  const [settings, setSettings] = useState<{ is_enabled: boolean; override_mode: OverrideMode }>({
    is_enabled: true,
    override_mode: "auto",
  });
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data, error } = await supabase
        .from("live_support_settings" as any)
        .select("is_enabled, override_mode")
        .eq("id", 1)
        .maybeSingle() as any;
      if (!cancelled && !error && data) {
        setSettings({
          is_enabled: data.is_enabled,
          override_mode: (data.override_mode as OverrideMode) || "auto",
        });
      }
    };
    check();
    const ch = supabase
      .channel("live-support-setting-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_support_settings" }, (payload) => {
        const row = (payload.new as any) || (payload.old as any);
        if (row) {
          setSettings({
            is_enabled: typeof row.is_enabled === "boolean" ? row.is_enabled : true,
            override_mode: (row.override_mode as OverrideMode) || "auto",
          });
        }
      })
      .subscribe();
    const interval = setInterval(check, 30000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(ch);
    };
  }, []);
  return settings;
};

const HelpChatWidget = () => {
  const location = useLocation();
  const liveSettings = useLiveSupportSettings();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "ticket" | "live" | "history" | "history-detail">("chat");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const [historyDetailId, setHistoryDetailId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ticketForm, setTicketForm] = useState({ issue_type: "general", message: "" });
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [liveRequested, setLiveRequested] = useState(false);
  const [liveRequestLoading, setLiveRequestLoading] = useState(false);
  const [liveRequestId, setLiveRequestId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Web Audio notification sounds are silently blocked by the browser until
  // the user has interacted with the page at least once, so a customer who
  // hasn't clicked anything yet gets no audible cue for a new support
  // message. Flash the tab title as a reliable fallback that doesn't depend
  // on that — stops as soon as the tab regains focus or the chat is opened.
  const originalTitleRef = useRef<string | null>(null);
  const titleFlashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTitleFlash = useCallback(() => {
    if (titleFlashIntervalRef.current) {
      clearInterval(titleFlashIntervalRef.current);
      titleFlashIntervalRef.current = null;
    }
    if (originalTitleRef.current) {
      document.title = originalTitleRef.current;
      originalTitleRef.current = null;
    }
  }, []);

  const startTitleFlash = useCallback(() => {
    if (titleFlashIntervalRef.current) return;
    originalTitleRef.current = document.title;
    let showAlert = true;
    document.title = "🔴 New message — Agever's Support";
    titleFlashIntervalRef.current = setInterval(() => {
      showAlert = !showAlert;
      document.title = showAlert ? "🔴 New message — Agever's Support" : (originalTitleRef.current || document.title);
    }, 1500);
  }, []);

  useEffect(() => {
    const onFocusOrVisible = () => {
      if (document.visibilityState === "visible") stopTitleFlash();
    };
    document.addEventListener("visibilitychange", onFocusOrVisible);
    window.addEventListener("focus", onFocusOrVisible);
    return () => {
      document.removeEventListener("visibilitychange", onFocusOrVisible);
      window.removeEventListener("focus", onFocusOrVisible);
      stopTitleFlash();
    };
  }, [stopTitleFlash]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Allow other components to open the chat widget via a global event
  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setUnreadCount(0);
    };
    window.addEventListener("agevers:open-help-chat", handler);
    return () => window.removeEventListener("agevers:open-help-chat", handler);
  }, []);

  // Persistent listener: detect when admin reopens/rejoins a previously closed chat
  useEffect(() => {
    if (!user) return;
    // If user already has an active liveRequestId, no need for this fallback
    if (liveRequestId) return;

    // Check for any active/pending request on mount
    const checkExisting = async () => {
      const { data } = await supabase
        .from("live_support_requests")
        .select("id, status")
        .eq("user_id", user.id)
        .in("status", ["pending", "active"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setLiveRequestId(data[0].id);
        setLiveRequested(true);
        if (data[0].status === "active") {
          // Admin is already there, jump to live view
          setOpen(true);
          setView("live");
        }
      }
    };
    checkExisting();

    // Listen for any of user's requests becoming active (admin rejoined)
    const channel = supabase
      .channel(`user-global-live-reopen-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_support_requests", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated.status === "active" && !liveRequestId) {
            setLiveRequestId(updated.id);
            setLiveRequested(true);
            setView("live");
            setOpen(true);
            gameSounds.notification();
            toast.info("An agent has rejoined your chat!");
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_support_requests", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const inserted = payload.new as any;
          if (inserted.status === "active" && !liveRequestId) {
            setLiveRequestId(inserted.id);
            setLiveRequested(true);
            setView("live");
            setOpen(true);
            gameSounds.notification();
            toast.info("An agent has started a live chat with you!");
          }
        }
      )
      .subscribe();

    // Ground-truth poll: same reasoning as the other live-chat channels —
    // an admin starting a chat directly from the Users list inserts this
    // row with no prior action from the customer, so this INSERT listener
    // is the only realtime path that could catch it. Poll as a fallback so
    // a missed event still surfaces within seconds.
    const pollInterval = setInterval(checkExisting, 20000);

    return () => { supabase.removeChannel(channel); clearInterval(pollInterval); };
  }, [user, liveRequestId]);

  // Listen for admin joining the live chat
  const lastPolledStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!liveRequestId) return;

    const channel = supabase
      .channel(`live-req-status-${liveRequestId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_support_requests", filter: `id=eq.${liveRequestId}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated.status === "active") {
            setView("live");
          } else if (updated.status === "closed") {
            if (view === "live") {
              // Don't switch view immediately — let LiveChatPanel show closed state
            } else {
              // Admin dismissed the request while user was waiting — reset to initial state
              setLiveRequested(false);
              setLiveRequestId(null);
              setUnreadCount(0);
              toast.info("Your support request was closed. You can start a new one.");
            }
          }
        }
      )
      .subscribe();

    // Ground-truth poll: this channel can silently stop delivering events
    // after a network blip or backgrounded tab, which otherwise only
    // self-heals when the widget bubble gets closed and reopened. Verify
    // the real status periodically so an admin joining surfaces within
    // seconds instead of requiring that manual workaround.
    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from("live_support_requests")
        .select("status")
        .eq("id", liveRequestId)
        .maybeSingle();
      if (!data) return;
      const prev = lastPolledStatusRef.current;
      lastPolledStatusRef.current = data.status;
      // Only react to an actual status *transition* — otherwise a user who
      // navigated away from the live view (tickets/history/FAQ) would be
      // dragged back every tick.
      if (prev === data.status) return;
      if (data.status === "active" && view !== "live") {
        setView("live");
        setOpen(true);
        gameSounds.notification();
        toast.info("An agent has rejoined your chat!");
      } else if (data.status === "closed" && view !== "live") {
        setLiveRequested(false);
        setLiveRequestId(null);
        setUnreadCount(0);
        toast.info("Your support request was closed. You can start a new one.");
      }
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [liveRequestId, view]);


  // Listen for unread messages when widget is closed
  useEffect(() => {
    if (!liveRequestId || !user) return;
    // If the widget is open and showing live chat, don't count unreads
    if (open && (view === "live" || view === "history-detail")) {
      setUnreadCount(0);
      stopTitleFlash();
      try {
        localStorage.setItem(`agevers:chat-read:${liveRequestId}`, new Date().toISOString());
      } catch {}
      return;
    }
    // Initial unread count: any messages from others after last_read_at
    (async () => {
      let lastRead: string | null = null;
      try {
        lastRead = localStorage.getItem(`agevers:chat-read:${liveRequestId}`);
      } catch {}
      const q = supabase
        .from("live_chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("request_id", liveRequestId)
        .neq("sender_id", user.id)
        .neq("sender_role", "system");
      const { count } = lastRead ? await q.gt("created_at", lastRead) : await q;
      if (typeof count === "number" && count > 0) {
        setUnreadCount(count);
      }
    })();
    const ch = supabase
      .channel(`unread-live-${liveRequestId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `request_id=eq.${liveRequestId}` },
        (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id !== user.id && msg.sender_role !== "system") {
            setUnreadCount((c) => c + 1);
            gameSounds.notification();
            // Only alert if the customer isn't already looking at this chat —
            // matches the condition above that resets unreadCount to 0.
            if (!(open && view === "live")) {
              toast.info("New message from support", {
                description: String(msg.content || "").slice(0, 120),
                duration: 8000,
              });
              if (document.hidden) startTitleFlash();
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [liveRequestId, user, open, view, startTitleFlash, stopTitleFlash]);

  const streamChat = useCallback(async (userMessages: Msg[]) => {
    setIsLoading(true);
    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: userMessages }),
      });

      if (!resp.ok || !resp.body) {
        toast.error("Failed to connect to support. Please try again.");
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error("Chat error:", e);
      toast.error("Connection error. Please try again.");
    }

    setIsLoading(false);
  }, []);

  // Hide on admin pages
  if (location.pathname.startsWith("/admin")) return null;

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    await streamChat(updated);
  };

  const handleSubmitTicket = async () => {
    if (!user) {
      toast.error("Please sign in to open a support ticket");
      return;
    }
    if (!ticketForm.message.trim()) {
      toast.error("Please describe your issue");
      return;
    }

    setTicketSubmitting(true);
    try {
      const { error } = await supabase.from("support_tickets").insert({
        buyer_id: user.id,
        buyer_email: user.email || "",
        issue_type: ticketForm.issue_type,
        message: ticketForm.message.trim(),
        status: "open",
      } as any);
      if (error) throw error;

      toast.success("Support ticket created! We'll get back to you soon.");
      setTicketForm({ issue_type: "general", message: "" });
      setView("chat");
    } catch (err: any) {
      toast.error(err.message || "Failed to create ticket");
    } finally {
      setTicketSubmitting(false);
    }
  };

  // Override mode controls behavior:
  //  - 'force_off' → always offline (admin override)
  //  - 'force_on'  → always online (admin override, even outside business hours)
  //  - 'auto'      → follow scheduled business hours
  const humanOnline =
    liveSettings.override_mode === "force_off"
      ? false
      : liveSettings.override_mode === "force_on"
        ? true
        : isHumanAvailable() && liveSettings.is_enabled;

  const handleRequestHuman = async () => {
    if (!user) {
      toast.error("Please sign in to request live support");
      return;
    }
    setLiveRequestLoading(true);
    try {
      const { data, error } = await supabase.from("live_support_requests" as any).insert({
        user_id: user.id,
        user_email: user.email || "",
        status: "pending",
      } as any).select().single() as any;
      if (error) throw error;
      if (data) {
        setLiveRequestId(data.id);
        // Insert system message so user sees it in chat
        await supabase.from("live_chat_messages").insert({
          request_id: data.id,
          sender_id: user.id,
          sender_role: "system",
          content: "Request sent. Waiting for an agent to join...",
        });
      }

      // Send email notification to admin
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "live-support-request",
          recipientEmail: "admin@agevers.com",
          idempotencyKey: `live-support-${user.id}-${Date.now()}`,
          templateData: { userEmail: user.email || "Unknown", userId: user.id },
        },
      }).catch(() => {});

      setLiveRequested(true);
      toast.success("Request sent! An agent will be with you shortly.");
    } catch (err: any) {
      toast.error(err.message || "Failed to send request");
    } finally {
      setLiveRequestLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setUnreadCount(0); }}
          className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
          aria-label="Open help chat"
        >
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[360px] max-w-[calc(100vw-40px)] h-[520px] max-h-[calc(100vh-100px)] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-primary px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {(view === "ticket" || view === "live" || view === "history" || view === "history-detail") && (
                <button onClick={() => { setView("chat"); setHistoryDetailId(null); }} className="text-primary-foreground hover:opacity-80">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <MessageCircle className="h-5 w-5 text-primary-foreground" />
              <span className="font-display font-bold text-primary-foreground text-sm">
                {view === "ticket" ? "Open Ticket" : view === "live" ? "Live Agent" : view === "history" ? "Chat History" : view === "history-detail" ? "Past Chat" : "Agever's Support"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className={`h-2 w-2 rounded-full ${humanOnline ? "bg-green-400" : "bg-yellow-400"}`} />
                <span className="text-[10px] text-primary-foreground/80">
                  {humanOnline ? "Online" : "Offline"}
                </span>
              </div>
              <button onClick={() => setOpen(false)} className="text-primary-foreground hover:opacity-80">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {view === "live" && liveRequestId && user ? (
            <LiveChatPanel
              requestId={liveRequestId}
              currentUserId={user.id}
              currentRole="user"
              onClose={() => { setView("chat"); setLiveRequestId(null); setLiveRequested(false); }}
            />
          ) : view === "chat" ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-8 space-y-3">
                    <MessageCircle className="h-10 w-10 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">How can we help you today?</p>
                    {humanOnline ? (
                      liveRequested ? (
                        <div className="flex items-center justify-center gap-1.5 text-xs text-green-400">
                          <Headphones className="h-3.5 w-3.5" />
                          <span>Request sent — an agent will join soon</span>
                        </div>
                      ) : (
                        <button
                          onClick={handleRequestHuman}
                          disabled={liveRequestLoading}
                          className="flex items-center justify-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors animate-pulse cursor-pointer disabled:opacity-50"
                        >
                          <Headphones className="h-3.5 w-3.5" />
                          <span className="underline underline-offset-2">
                            {liveRequestLoading ? "Sending..." : "Human support is available now — click to connect"}
                          </span>
                        </button>
                      )
                    ) : (
                      <div className="text-center space-y-1.5">
                        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Human support is currently closed</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Hours: Sun–Thu 8AM–11PM · Fri 8AM–12PM · Sat 8PM–11PM (Israel time)
                        </p>
                        <p className="text-[10px] text-primary/80">
                          💡 Most issues can be resolved by our AI support bot below!
                        </p>
                      </div>
                    )}
                    <div className="space-y-2 pt-2">
                      {[
                        "Where can I find my game code?",
                        "What's the refund policy?",
                        "I have a payment issue",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            const msg: Msg = { role: "user", content: q };
                            setMessages([msg]);
                            streamChat([msg]);
                          }}
                          className="block w-full text-left text-xs bg-secondary/80 hover:bg-secondary rounded-lg px-3 py-2 text-foreground transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-secondary text-foreground rounded-bl-sm"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex justify-start">
                    <div className="bg-secondary rounded-xl px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Actions bar */}
              <div className="px-4 py-1 shrink-0 flex items-center gap-3">
                <button
                  onClick={() => setView("ticket")}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Ticket className="h-3 w-3" />
                  Open a support ticket
                </button>
                {user && (
                  <button
                    onClick={async () => {
                      const { data } = await supabase
                        .from("live_support_requests")
                        .select("*")
                        .eq("user_id", user.id)
                        .order("created_at", { ascending: false }) as any;
                      setChatHistories(data || []);
                      setView("history");
                    }}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <History className="h-3 w-3" />
                    Chat history
                  </button>
                )}
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-border shrink-0">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    disabled={isLoading}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="h-9 w-9 p-0"
                    disabled={!input.trim() || isLoading}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : view === "history" ? (
             <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {chatHistories.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-8">No chat history yet.</p>
              ) : (
                chatHistories.map((h) => {
                  const isClosed = h.status === "closed";
                  return (
                    <div
                      key={h.id}
                      className="w-full text-left bg-secondary/80 rounded-lg px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">
                          {new Date(h.created_at).toLocaleDateString()} {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={`text-[10px] font-display px-1.5 py-0.5 rounded ${isClosed ? 'bg-muted text-muted-foreground' : h.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {h.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {isClosed ? (
                          <button
                            onClick={async () => {
                              if (!user) return;
                              // Reopen: set status back to pending
                              await supabase.from("live_support_requests" as any).update({ status: "pending" } as any).eq("id", h.id);
                              // Insert system message
                              await supabase.from("live_chat_messages").insert({
                                request_id: h.id,
                                sender_id: user.id,
                                sender_role: "system",
                                content: "Chat reopened by user. Waiting for an agent...",
                              });
                              setLiveRequestId(h.id);
                              setLiveRequested(true);
                              setView("live");
                              // Email admin
                              await supabase.functions.invoke("send-transactional-email", {
                                body: {
                                  templateName: "live-support-request",
                                  recipientEmail: "admin@agevers.com",
                                  idempotencyKey: `live-reopen-${h.id}-${Date.now()}`,
                                  templateData: { userEmail: user.email || "Unknown", userId: user.id },
                                },
                              }).catch(() => {});
                            }}
                            className="text-[11px] font-display font-semibold text-primary hover:text-primary/80 transition-colors"
                          >
                            Reopen Chat
                          </button>
                        ) : (
                          <button
                            onClick={() => { setHistoryDetailId(h.id); setView("history-detail"); }}
                            className="text-[11px] font-display font-semibold text-primary hover:text-primary/80 transition-colors"
                          >
                            View Chat
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : view === "history-detail" && historyDetailId && user ? (
            <LiveChatPanel
              requestId={historyDetailId}
              currentUserId={user.id}
              currentRole="user"
              onClose={() => { setView("history"); setHistoryDetailId(null); setLiveRequestId(null); setLiveRequested(false); }}
            />
          ) : (
            /* Ticket form */
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Describe your issue and we'll get back to you as soon as possible.
              </p>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Issue Type</label>
                <select
                  value={ticketForm.issue_type}
                  onChange={(e) => setTicketForm(f => ({ ...f, issue_type: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="general">General Question</option>
                  <option value="order_issue">Order Issue</option>
                  <option value="payment">Payment Problem</option>
                  <option value="code_not_working">Code Not Working</option>
                  <option value="refund">Refund Request</option>
                  <option value="account">Account Issue</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Description</label>
                <textarea
                  value={ticketForm.message}
                  onChange={(e) => setTicketForm(f => ({ ...f, message: e.target.value }))}
                  rows={5}
                  className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  placeholder="Tell us what happened..."
                />
              </div>

              {!user && (
                <p className="text-xs text-destructive">
                  Please sign in to open a support ticket.
                </p>
              )}

              <Button
                variant="hero"
                className="w-full"
                disabled={ticketSubmitting || !user || !ticketForm.message.trim()}
                onClick={handleSubmitTicket}
              >
                {ticketSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting...</>
                ) : (
                  "Submit Ticket"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default HelpChatWidget;
