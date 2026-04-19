import { useState, useEffect, useRef, useCallback, memo, type KeyboardEvent } from "react";
import { Sidebar } from "@/components/chat/sidebar";
import { useConversation, useCreateConversation, type Message } from "@/hooks/use-conversations";
import { useChat } from "@/hooks/use-chat";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, X, RotateCcw, Sparkles, ChevronRight, Database, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTED_ACTIONS = [
  { label: "What can you help me with?", message: "Give me a quick overview of everything you can help me with." },
  { label: "Write something for me", message: "I need help writing something — a professional email, a report, a message, or anything else. What do you need from me to get started?" },
  { label: "Explain a concept", message: "I want to understand something better. What topic would you like me to explain?" },
  { label: "Help me think through a problem", message: "I have a problem or decision I need to work through. Can you help me think it out clearly?" },
  { label: "Research or summarise a topic", message: "I need you to research or summarise something for me. What would you like to know about?" },
  { label: "What's in stock?", message: "Check our current stock levels and tell me what we have and what's running low." },
];

function MessageBubble({ role, content, isThinking }: { role: "user" | "assistant"; content: string; isThinking?: boolean }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className={cn("flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-1", isThinking ? "bg-amber-500" : "bg-primary")}>
          {isThinking
            ? <RefreshCw className="h-3.5 w-3.5 text-white animate-spin" />
            : <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
          }
        </div>
      )}
      <div className={cn(
        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
        isUser
          ? "bg-primary text-primary-foreground rounded-tr-sm"
          : isThinking
          ? "bg-amber-500/10 text-amber-200 border border-amber-500/30 rounded-tl-sm italic"
          : "bg-muted text-foreground rounded-tl-sm"
      )}>
        {!content ? (
          <span className="flex gap-1 items-center text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
          </span>
        ) : content}
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="px-3 py-1.5 border-b border-border bg-muted/30 flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-green-400">
        <Database className="h-3 w-3" />
        System connected
      </div>
      <Badge className="h-5 text-[10px] px-1.5 text-green-400 bg-green-400/10 border-green-400/30 hover:bg-green-400/10">
        Pipeline healthy
      </Badge>
    </div>
  );
}

// Isolated input component — has its own state so streaming re-renders never touch it
const ChatInput = memo(function ChatInput({
  isStreaming,
  onSend,
}: {
  isStreaming: boolean;
  onSend: (text: string) => void;
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Use a ref so the callback stays stable but always has the latest onSend
  const onSendRef = useRef(onSend);
  useEffect(() => { onSendRef.current = onSend; }, [onSend]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    onSendRef.current(text);
  }, [input, isStreaming]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = (e.target as HTMLTextAreaElement).value.trim();
      if (!text || isStreaming) return;
      setInput("");
      onSendRef.current(text);
    }
  }, [isStreaming]);

  return (
    <div className="border-t border-border flex-shrink-0 bg-background">
      <div className="p-3">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Sky a question..."
            className="min-h-[40px] max-h-[100px] resize-none text-sm rounded-xl flex-1"
            rows={1}
            disabled={isStreaming}
          />
          <Button
            size="icon"
            className="h-10 w-10 rounded-xl flex-shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Sky reads live system data and provides business intelligence
        </p>
      </div>
    </div>
  );
});

export function ChatPage() {
  const [activeId, setActiveId] = useState<string>("");
  const { data: conversation, isLoading } = useConversation(activeId || null);
  const createConv = useCreateConversation();
  const { sendMessage, isStreaming, streamingMessage } = useChat(activeId || null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages, streamingMessage]);

  // Stable send handler — wrapped in a ref so ChatInput never gets a new function reference
  const handleSend = useCallback(async (text: string) => {
    let targetId = activeId;
    if (!targetId) {
      try {
        const newConv = await createConv.mutateAsync();
        targetId = newConv.id;
        setActiveId(targetId);
      } catch {
        return;
      }
    }
    sendMessage(text, targetId);
  }, [activeId, createConv, sendMessage]);

  const handleSuggestion = useCallback(async (message: string) => {
    if (isStreaming) return;
    let targetId = activeId;
    if (!targetId) {
      try {
        const newConv = await createConv.mutateAsync();
        targetId = newConv.id;
        setActiveId(targetId);
      } catch {
        return;
      }
    }
    sendMessage(message, targetId);
  }, [activeId, createConv, isStreaming, sendMessage]);

  const messages: Message[] = conversation?.messages || [];
  const showWelcome = !activeId || (!isLoading && messages.length === 0);

  return (
    <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:block h-full">
        <Sidebar activeId={activeId} onSelect={setActiveId} />
      </div>

      {/* Main panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Orange header */}
        <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="md:hidden">
              <Sidebar activeId={activeId} onSelect={setActiveId} isMobile />
            </div>
            <Sparkles className="h-5 w-5 hidden md:block" />
            <div>
              <span className="font-bold text-lg tracking-tight">Sky</span>
              <div className="flex items-center gap-1 -mt-0.5">
                <ChevronRight className="h-3 w-3 opacity-60" />
                <span className="text-xs opacity-80 font-medium">System Brain</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && !isStreaming && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setActiveId("")}
                title="New conversation"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => window.close()}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <StatusBar />

        {/* Message area — only this part re-renders on every streaming chunk */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-4">
            {showWelcome ? (
              <div className="space-y-4">
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="h-7 w-7 text-primary" />
                  </div>
                  <p className="font-semibold text-foreground">Sky is ready.</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                    Ask me absolutely anything — business, research, writing, calculations, or any topic at all.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Quick starts</p>
                  {SUGGESTED_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleSuggestion(action.message)}
                      disabled={isStreaming}
                      className="w-full text-left px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/60 transition-colors text-sm font-medium flex items-center justify-between gap-2 group"
                    >
                      <span>{action.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
                ))}
                {isStreaming && (
                  <MessageBubble role="assistant" content={streamingMessage} isThinking={!streamingMessage} />
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input — isolated component, unaffected by streaming re-renders */}
        <ChatInput isStreaming={isStreaming} onSend={handleSend} />
      </div>
    </div>
  );
}
