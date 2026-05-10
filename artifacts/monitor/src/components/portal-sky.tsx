import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Sparkles, X, Send, RotateCcw } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

const SUGGESTED = [
  { label: "What are my tank levels?", message: "Give me a quick summary of all my current tank levels." },
  { label: "Any tanks running low?", message: "Are any of my tanks running low or below their alert threshold?" },
  { label: "Any sensors offline?", message: "Are any of my sensors offline or not reporting?" },
  { label: "When should I top up?", message: "Based on my current levels, which tanks should I prioritise topping up soon?" },
];

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-orange-500 text-white rounded-tr-sm"
            : "bg-[hsl(20_12%_13%)] text-[hsl(24_8%_90%)] rounded-tl-sm"
        }`}
      >
        {msg.content || (
          <span className="flex gap-1 items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce [animation-delay:300ms]" />
          </span>
        )}
      </div>
    </div>
  );
}

export function PortalSky() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    setInput("");
    const userMsg: Message = { role: "user", content: trimmed };
    const assistantMsg: Message = { role: "assistant", content: "", isStreaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/portal/sky/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages.filter((m) => !m.isStreaming).slice(-20),
        }),
      });

      if (!res.ok || !res.body) throw new Error("Sky unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.content) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + parsed.content,
                    isStreaming: true,
                  };
                }
                return updated;
              });
            }
            if (parsed.error) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: parsed.error,
                  isStreaming: false,
                };
                return updated;
              });
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      // Mark streaming done
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = { ...last, isStreaming: false };
        }
        return updated;
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sky is unavailable right now. Please try again.",
          isStreaming: false,
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-4 z-40 flex items-center gap-2 h-12 px-5 rounded-full bg-orange-500 hover:bg-orange-400 active:scale-95 text-white text-sm font-semibold shadow-lg shadow-orange-500/30 transition-all"
          aria-label="Ask Sky"
        >
          <Sparkles className="w-4 h-4" />
          Ask Sky
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[hsl(20_14%_7%)] md:inset-auto md:bottom-6 md:right-4 md:w-[400px] md:h-[600px] md:rounded-2xl md:shadow-2xl md:border md:border-[hsl(24_10%_16%)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(24_10%_14%)] bg-[hsl(20_12%_9%)] flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Ask Sky</p>
              <p className="text-xs text-[hsl(24_8%_45%)]">Your tank assistant</p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="p-1.5 rounded-full text-[hsl(24_8%_45%)] hover:text-white hover:bg-white/10 transition-colors"
                  title="Clear conversation"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full text-[hsl(24_8%_45%)] hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close Sky"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
            {isEmpty ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Hi, I'm Sky</p>
                  <p className="text-xs text-[hsl(24_8%_45%)] mt-1">Ask me anything about your tanks</p>
                </div>
                <div className="w-full space-y-2 mt-2">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => sendMessage(s.message)}
                      className="w-full text-left text-xs px-3.5 py-2.5 rounded-xl bg-[hsl(20_12%_12%)] border border-[hsl(24_10%_18%)] text-[hsl(24_8%_70%)] hover:border-orange-500/30 hover:text-white transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-[hsl(24_10%_14%)] bg-[hsl(20_12%_9%)] flex-shrink-0">
            <div className="flex items-end gap-2 bg-[hsl(20_12%_12%)] border border-[hsl(24_10%_18%)] rounded-xl px-3 py-2 focus-within:border-orange-500/40 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about your tanks…"
                rows={1}
                disabled={isStreaming}
                className="flex-1 bg-transparent text-sm text-white placeholder-[hsl(24_8%_40%)] resize-none outline-none leading-relaxed disabled:opacity-50 max-h-24 overflow-y-auto"
                style={{ minHeight: "24px" }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isStreaming}
                className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                aria-label="Send"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <p className="text-[10px] text-[hsl(24_8%_30%)] text-center mt-2">Sky uses live tank data · Powered by Firesky AI</p>
          </div>
        </div>
      )}
    </>
  );
}
