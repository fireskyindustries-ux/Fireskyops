import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/chat/sidebar";
import { useConversation, useCreateConversation, Message } from "@/hooks/use-conversations";
import { useChat } from "@/hooks/use-chat";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SendHorizontal, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ChatPage() {
  const [activeId, setActiveId] = useState<string>("");
  const { data: conversation, isLoading } = useConversation(activeId || null);
  const createConv = useCreateConversation();
  const { sendMessage, isStreaming, streamingMessage } = useChat(activeId || null);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.messages, streamingMessage, isStreaming]);

  // Focus input when conversation changes
  useEffect(() => {
    if (activeId && !isLoading) {
      inputRef.current?.focus();
    }
  }, [activeId, isLoading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    let targetId = activeId;
    
    // Create conversation on the fly if there isn't one
    if (!targetId) {
      try {
        const newConv = await createConv.mutateAsync();
        targetId = newConv.id;
        setActiveId(targetId);
      } catch (e) {
        return;
      }
    }

    setInput("");
    
    // Wait for state to settle before sending if we just created it
    // In a real app we'd await the setState or pass it down, but the hook grabs activeId.
    // For simplicity, we pass the id directly to a slightly modified hook, but since useChat 
    // depends on activeId, it might miss the immediate update. We'll do a slight timeout.
    setTimeout(() => {
      sendMessage(text);
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const messages: Message[] = conversation?.messages || [];

  return (
    <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden">
      <Sidebar activeId={activeId} onSelect={setActiveId} />
      
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center p-3 border-b border-border bg-background/95 backdrop-blur z-10">
          <Sidebar activeId={activeId} onSelect={setActiveId} isMobile />
          <span className="font-semibold ml-2">Sky Vision</span>
        </header>

        {/* Chat Area */}
        {!activeId && !isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Hello, I'm Sky</h2>
            <p className="text-muted-foreground mb-8">Your Firesky AI Assistant. Ask me anything.</p>
            <Button onClick={() => {
              createConv.mutateAsync().then(c => setActiveId(c.id));
            }} size="lg">
              Start a conversation
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 md:p-6" ref={scrollRef}>
              <div className="max-w-3xl mx-auto space-y-6 pb-20">
                {isLoading && messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full mt-20">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                      >
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          msg.role === "user" ? "bg-secondary" : "bg-primary"
                        }`}>
                          {msg.role === "user" ? (
                            <span className="text-xs font-medium text-secondary-foreground">U</span>
                          ) : (
                            <span className="text-xs font-bold text-primary-foreground">S</span>
                          )}
                        </div>
                        <div className={`px-4 py-3 rounded-2xl max-w-[85%] whitespace-pre-wrap ${
                          msg.role === "user" 
                            ? "bg-secondary text-secondary-foreground rounded-tr-sm" 
                            : "bg-card border border-border text-card-foreground rounded-tl-sm"
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    
                    {isStreaming && (
                      <div className="flex gap-4 flex-row">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-xs font-bold text-primary-foreground">S</span>
                        </div>
                        <div className="px-4 py-3 rounded-2xl max-w-[85%] whitespace-pre-wrap bg-card border border-border text-card-foreground rounded-tl-sm min-w-[60px]">
                          {streamingMessage || (
                            <span className="flex gap-1 items-center h-5">
                              <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                              <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                              <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" />
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-background/95 backdrop-blur border-t border-border">
              <div className="max-w-3xl mx-auto relative">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Sky anything..."
                  className="min-h-[56px] max-h-32 pr-14 resize-none bg-input border-none focus-visible:ring-1 focus-visible:ring-ring rounded-xl text-base py-4"
                  rows={1}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming || isLoading}
                  size="icon"
                  className="absolute right-2 bottom-2 rounded-lg w-10 h-10 transition-transform active:scale-95"
                >
                  <SendHorizontal className="w-5 h-5" />
                </Button>
              </div>
              <div className="text-center mt-2 text-xs text-muted-foreground">
                Sky may produce inaccurate information.
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
