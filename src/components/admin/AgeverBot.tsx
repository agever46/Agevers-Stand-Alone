import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, Bot, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";
import ageverBotImg from "@/assets/agever-bot.png";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const AgeverBot = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<boolean>(() => {
    try { return localStorage.getItem("agever-bot-hidden") === "1"; } catch { return false; }
  });
  const [btnPos, setBtnPos] = useState({ x: 24, y: 24 });
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ mx: 0, my: 0, bx: 0, by: 0 });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [conversationId] = useState(() => crypto.randomUUID());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentStep]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const processSSE = useCallback(async (response: Response) => {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7);
        } else if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (currentEvent === "status") {
              setCurrentStep(data.step);
            } else if (currentEvent === "done") {
              setCurrentStep(null);
               setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "No response" }]);
            } else if (currentEvent === "error") {
              setCurrentStep(null);
              setMessages((prev) => [...prev, { role: "assistant", content: `❌ Error: ${data.error}` }]);
            }
          } catch {}
        }
      }
    }
  }, []);

  const sendRequest = useCallback(async (newMessages: Message[]) => {
    setLoading(true);
    setCurrentStep("🤔 Connecting...");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
            conversationId,
          }),
          signal: controller.signal,
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status}`);
      }

      // Check if SSE or JSON
      const contentType = res.headers.get("Content-Type") || "";
      if (contentType.includes("text/event-stream")) {
        await processSSE(res);
      } else {
        const data = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "No response" }]);
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setCurrentStep(null);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ Error: ${err.message}` },
      ]);
    } finally {
      abortRef.current = null;
      setLoading(false);
      setCurrentStep(null);
    }
  }, [conversationId, processSSE]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !user) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    await sendRequest(newMessages);
  }, [input, loading, user, messages, sendRequest]);

  const sendQuickMessage = useCallback((text: string) => {
    if (loading || !user) return;
    setInput("");
    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    sendRequest(newMessages);
  }, [loading, user, messages, sendRequest]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setMessages([]);
    setLoading(false);
    setCurrentStep(null);
    setInput("");
  };

  if (!user) return null;
  if (hidden) {
    return (
      <button
        onClick={() => {
          try { localStorage.removeItem("agever-bot-hidden"); } catch {}
          setHidden(false);
        }}
        className="fixed bottom-2 right-2 z-50 h-6 w-6 rounded-full bg-[hsl(250,60%,20%)]/60 hover:bg-[hsl(250,60%,30%)] border border-[hsl(250,60%,40%)]/50 flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"
        aria-label="Show Agever Bot"
        title="Show Agever Bot"
      >
        <Bot className="h-3.5 w-3.5 text-blue-300" />
      </button>
    );
  }

  return (
    <>
      {/* Floating Robot Button */}
      <AnimatePresence>
        {!open && (
          <div className="fixed z-50" style={{ right: btnPos.x, bottom: btnPos.y }}>
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={draggingRef.current ? undefined : { scale: 1.1 }}
            whileTap={draggingRef.current ? undefined : { scale: 0.9 }}
            onClick={() => {
              if (!draggingRef.current) setOpen(true);
            }}
            onPointerDown={(e) => {
              dragStartRef.current = { mx: e.clientX, my: e.clientY, bx: btnPos.x, by: btnPos.y };
              const onMove = (ev: PointerEvent) => {
                const dx = ev.clientX - dragStartRef.current.mx;
                const dy = ev.clientY - dragStartRef.current.my;
                if (!draggingRef.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
                  draggingRef.current = true;
                }
                if (draggingRef.current) {
                  setBtnPos({
                    x: Math.max(0, dragStartRef.current.bx - dx),
                    y: Math.max(0, dragStartRef.current.by + dy),
                  });
                }
              };
              const onUp = () => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                setTimeout(() => { draggingRef.current = false; }, 50);
              };
              window.addEventListener("pointermove", onMove);
              window.addEventListener("pointerup", onUp);
            }}
            className="relative h-14 w-14 rounded-full bg-gradient-to-br from-[hsl(250,80%,20%)] to-[hsl(220,80%,15%)] border-2 border-[hsl(250,60%,40%)] shadow-[0_0_20px_hsl(250,80%,50%,0.3),0_0_40px_hsl(220,80%,50%,0.15)] flex items-center justify-center group transition-shadow hover:shadow-[0_0_25px_hsl(250,80%,50%,0.5),0_0_50px_hsl(220,80%,50%,0.25)] cursor-grab active:cursor-grabbing select-none touch-none"
            aria-label="Open Agever Bot"
          >
            <img src={ageverBotImg} alt="Agever Bot" className="w-10 h-10 rounded-full object-cover pointer-events-none" />
          </motion.button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                try { localStorage.setItem("agever-bot-hidden", "1"); } catch {}
                setHidden(true);
              }}
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-md border border-white/20"
              aria-label="Hide Agever Bot"
              title="Hide bot (refresh page to bring back)"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-0 right-0 z-50 w-full h-full sm:bottom-6 sm:right-6 sm:w-[400px] sm:h-[550px] flex flex-col sm:rounded-2xl overflow-hidden border border-[hsl(250,40%,25%)] shadow-[0_0_30px_hsl(250,80%,50%,0.2)] bg-[hsl(230,25%,10%)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[hsl(250,60%,15%)] to-[hsl(220,60%,15%)] border-b border-[hsl(250,40%,25%)]">
              <div className="flex items-center gap-3">
                <img src={ageverBotImg} alt="Agever Bot" className="w-8 h-8 rounded-lg object-cover" />
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wider">AGEVER BOT</h3>
                  <p className="text-[10px] text-blue-300/60">Smart Admin Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearChat}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {messages.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Bot className="h-12 w-12 text-blue-400/30 mb-3" />
                   <p className="text-sm text-white/50 font-medium">Hello! I'm Agever Bot 🤖</p>
                   <p className="text-xs text-white/30 mt-1 max-w-[250px]">
                    I can help you manage the store - search products, update prices, manage tickets and more
                  </p>
                  <div className="mt-4 space-y-1.5 w-full max-w-[280px]">
                    {[
                      "📊 Show store statistics",
                      "🔍 Search Steam products",
                      "📦 Import products from Kinguin",
                      "🎫 Show open tickets",
                      "👤 Show pending seller requests",
                      "💰 Show pending withdrawals",
                      "🚨 Show open fraud flags",
                      "🗂️ Show all collections",
                      "🗂️ Create a new collection for Fortnite products",
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => sendQuickMessage(q)}
                        className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors"
                        style={{ direction: "rtl" }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-sm"
                        : "bg-white/8 text-white/85 border border-white/10 rounded-bl-sm"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:text-blue-300 [&_code]:text-purple-300 [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded text-xs">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="text-xs">{msg.content}</span>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Live step indicator */}
              {loading && currentStep && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-white/8 border border-white/10 rounded-xl rounded-bl-sm px-4 py-3 max-w-[85%]">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin shrink-0" />
                      <span className="text-xs text-white/70" style={{ direction: "rtl" }}>
                        {currentStep}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-[hsl(250,40%,25%)] bg-[hsl(230,25%,8%)]">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="What would you like me to do?"
                  rows={1}
                  className="flex-1 resize-none bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                  style={{ direction: "rtl" }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="h-10 w-10 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:from-blue-500 hover:to-purple-500 transition-all shrink-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AgeverBot;
