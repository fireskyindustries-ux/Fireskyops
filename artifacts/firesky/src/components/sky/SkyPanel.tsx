import { useRef, useEffect, useState, type KeyboardEvent } from "react";
import { Sparkles, X, Send, RotateCcw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSkyState, useSkyActions, type SkyContextType } from "./SkyContext";
import { cn } from "@/lib/utils";

const SUGGESTED_ACTIONS: Record<SkyContextType, { label: string; message: string }[]> = {
  inspection: [
    { label: "Review this inspection", message: "Review this inspection record and tell me if anything looks incomplete or unusual." },
    { label: "Is this ready to quote?", message: "Based on the captured data, is this site ready for a formal quotation? What is missing if not?" },
    { label: "Stand or plinth?", message: "Based on the site inspection data, should we use a steel stand or a concrete plinth for tank placement? Explain your reasoning." },
    { label: "Summarize for quote", message: "Generate a concise quote-ready summary of this inspection, including tank requirements, installation method, pipe runs, and any access or delivery notes." },
  ],
  customer: [
    { label: "Summarize this customer", message: "Give me a brief summary of this customer and what we know about their site." },
    { label: "What do we still need?", message: "What information is still needed to move this customer toward a quotation?" },
    { label: "Check access risks", message: "Based on the location and access details, are there any delivery or installation risks to flag?" },
    { label: "Recommend a system", message: "Based on what we know, what type of water tank system would you recommend for this customer?" },
  ],
  enquiry: [
    { label: "What do we need next?", message: "What information do we need to gather to progress this enquiry?" },
    { label: "Is this ready for inspection?", message: "Do we have enough information to schedule a site inspection?" },
    { label: "Suggest a tank size", message: "Based on the enquiry details, what tank size would you suggest?" },
    { label: "Summarize for file", message: "Write a short summary of this enquiry for the job file." },
  ],
  job: [
    { label: "Summarize for quote", message: "Generate a structured quote-ready summary from this job record." },
    { label: "What is the next step?", message: "Looking at this job's current stage, what is the recommended next action?" },
    { label: "Check progress", message: "Review this job and tell me if anything looks stalled or needs attention." },
    { label: "Identify risks", message: "Are there any risks or blockers visible from this job record?" },
  ],
  dashboard: [
    { label: "What needs attention?", message: "Looking at the current dashboard data, what needs the most immediate attention?" },
    { label: "Jobs ready to quote", message: "Which jobs or inspections look ready for quotation based on the current data?" },
    { label: "Check incomplete inspections", message: "Are there any inspections that appear incomplete or not ready to proceed?" },
    { label: "Pipeline summary", message: "Give me a quick summary of where the pipeline stands and any bottlenecks." },
  ],
  general: [
    { label: "How do I choose a tank size?", message: "How do I choose the right tank size for a residential or farm application?" },
    { label: "Stand vs plinth?", message: "When should I use a steel stand versus a concrete plinth for tank installation?" },
    { label: "What does a site inspection cover?", message: "Walk me through what a thorough Firesky site inspection should cover." },
    { label: "Delivery and access tips", message: "What should I check on site before a tank delivery to avoid problems on the day?" },
  ],
};

const CONTEXT_LABELS: Record<SkyContextType, string> = {
  inspection: "Site Inspection",
  customer: "Customer",
  enquiry: "Enquiry",
  job: "Job",
  dashboard: "Dashboard",
  general: "General",
};

function MessageBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center mt-1">
          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm"
        )}
      >
        {content || (
          <span className="flex gap-1 items-center text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
          </span>
        )}
      </div>
    </div>
  );
}

export function SkyPanel() {
  const { isOpen, context, messages, isStreaming } = useSkyState();
  const { closeSky, sendMessage, clearMessages } = useSkyActions();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const suggestedActions = SUGGESTED_ACTIONS[context.contextType] || SUGGESTED_ACTIONS.general;

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || isStreaming) return;
    setInput("");
    sendMessage(msg);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAction = (message: string) => {
    sendMessage(message);
  };

  if (!isOpen) return null;

  const contextLabel = context.contextLabel
    ? `${CONTEXT_LABELS[context.contextType]}: ${context.contextLabel}`
    : CONTEXT_LABELS[context.contextType];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 md:hidden"
        onClick={closeSky}
      />
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-background shadow-2xl border-l border-border",
          "w-full sm:w-[420px]"
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary text-primary-foreground flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5" />
            <div>
              <span className="font-bold text-lg tracking-tight">Sky</span>
              <div className="flex items-center gap-1 -mt-0.5">
                <ChevronRight className="h-3 w-3 opacity-60" />
                <span className="text-xs opacity-80 font-medium">{contextLabel}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={clearMessages}
                title="Clear conversation"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={closeSky}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="h-7 w-7 text-primary" />
                  </div>
                  <p className="font-semibold text-foreground">Sky is ready</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ask anything about this {CONTEXT_LABELS[context.contextType].toLowerCase()}, or choose a suggested action below.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Suggested actions</p>
                  {suggestedActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleAction(action.message)}
                      disabled={isStreaming}
                      className="w-full text-left px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/60 transition-colors text-sm font-medium flex items-center justify-between gap-2 group"
                    >
                      <span>{action.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <MessageBubble key={i} role={msg.role} content={msg.content} />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-border p-3 flex-shrink-0 bg-background">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Sky anything..."
              className="min-h-[44px] max-h-[120px] resize-none text-sm rounded-xl"
              rows={1}
              disabled={isStreaming}
            />
            <Button
              size="icon"
              className="h-11 w-11 rounded-xl flex-shrink-0"
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Sky reads the current record and provides field guidance
          </p>
        </div>
      </div>
    </>
  );
}

export function SkyFloatingButton() {
  const { isOpen } = useSkyState();
  const { openSky } = useSkyActions();

  if (isOpen) return null;

  return (
    <button
      onClick={() => openSky()}
      className={cn(
        "fixed z-40 flex items-center gap-2 shadow-lg shadow-primary/30 hex-clip",
        "bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95",
        "px-6 h-12 text-sm font-semibold tracking-wide",
        "bottom-[96px] right-4 md:bottom-6 md:right-6"
      )}
      aria-label="Ask Sky"
    >
      <Sparkles className="h-4 w-4" />
      Ask Sky
    </button>
  );
}

export function SkyInlineButton({
  contextType,
  contextData,
  contextLabel,
  label = "Ask Sky",
  variant = "outline",
  className,
}: {
  contextType: SkyContextType;
  contextData?: Record<string, unknown>;
  contextLabel?: string;
  label?: string;
  variant?: "outline" | "default" | "ghost";
  className?: string;
}) {
  const { openSky } = useSkyActions();

  return (
    <Button
      variant={variant}
      className={cn("gap-2 hex-clip-sm px-5", className)}
      onClick={() => openSky({ contextType, contextData, contextLabel })}
    >
      <Sparkles className="h-4 w-4" />
      {label}
    </Button>
  );
}
