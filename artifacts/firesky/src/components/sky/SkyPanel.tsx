import { useRef, useEffect, useState, type KeyboardEvent } from "react";
import { Sparkles, X, Send, RotateCcw, ChevronRight, Database, RefreshCw, AlertCircle, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useSkyState, useSkyActions, type SkyContextType } from "./SkyContext";
import { useUser } from "@clerk/react";
import { cn } from "@/lib/utils";
import { SkyCameraMode } from "./SkyCameraMode";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function skyApiUrl(path: string) { return `${BASE}${path}`; }

const ADMIN_SUGGESTED_ACTIONS = [
  { label: "What needs my attention today?", message: "Looking at the live system data, what are the most important things I should focus on today? Prioritise by urgency." },
  { label: "Pipeline briefing", message: "Give me a full pipeline briefing — how many jobs are in each stage, which ones are stalled, and what the overall health of the pipeline looks like." },
  { label: "Which quotes are overdue?", message: "Which jobs have been in the quoting or quoted stage for too long? List them by name with how many days they have been waiting, and recommend a specific next action for each." },
  { label: "Enquiries awaiting response", message: "Are there any new enquiries that have not been responded to or progressed? List them by name and how long they have been waiting." },
  { label: "Inspections ready to convert", message: "Which site inspections are marked ready to quote but have not yet been converted to a job? Give me the details so I can follow up." },
  { label: "Summarise the week", message: "Give me a brief summary of where the business stands right now — customers, pipeline, any urgent items that need action." },
];

const BRANCH_ADMIN_SUGGESTED_ACTIONS = [
  { label: "What's in stock?", message: "Check our current stock levels and tell me what we have and what's running low." },
  { label: "Record stock received", message: "I need to record stock that just came in. What do we have in the catalogue?" },
  { label: "Mark stock as used", message: "I need to mark some stock as used on a job. Can you help me record that?" },
  { label: "What needs attention?", message: "Looking at my branch, what enquiries or jobs need the most attention right now?" },
  { label: "Add a new stock item", message: "I need to add a new item to the stock catalogue. Can you help me set it up?" },
  { label: "Set stock to exact level", message: "I've done a stock count and need to set the exact quantity for an item. Can you help?" },
];

const GUEST_SUGGESTED_ACTIONS = [
  { label: "What size tank do I need?", message: "I need help figuring out what size water tank would suit my property. Can you help me work it out?" },
  { label: "Tanks for a farm", message: "I have a farm and need water storage for livestock and irrigation. What would you recommend?" },
  { label: "Home backup water", message: "I want backup water storage for my home in case of outages. What are my options?" },
  { label: "What is a stand or plinth?", message: "What is the difference between a tank stand and a concrete plinth? Which one would I need?" },
  { label: "How does installation work?", message: "How does the installation process work? What should I expect from start to finish?" },
  { label: "Chemical storage", message: "I need to store chemicals on my property. Do you have tanks suitable for that?" },
];

const FIELD_SUGGESTED_ACTIONS: Record<SkyContextType, { label: string; message: string }[]> = {
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
    { label: "Pipeline summary", message: "Give me a quick summary of where the pipeline stands and any bottlenecks." },
    { label: "Check incomplete inspections", message: "Are there any inspections that appear incomplete or not ready to proceed?" },
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

function MessageBubble({
  role,
  content,
  isThinking,
}: {
  role: "user" | "assistant";
  content: string;
  isThinking?: boolean;
}) {
  const isUser = role === "user";
  const isEmpty = !content;

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div
          className={cn(
            "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-1",
            isThinking ? "bg-amber-500" : "bg-primary"
          )}
        >
          {isThinking ? (
            <RefreshCw className="h-3.5 w-3.5 text-white animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
          )}
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : isThinking
            ? "bg-amber-50 text-amber-800 border border-amber-200 rounded-tl-sm italic"
            : "bg-muted text-foreground rounded-tl-sm"
        )}
      >
        {isEmpty ? (
          <span className="flex gap-1 items-center text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
          </span>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

function AdminStatusBar({ snapshot, loading, onRefresh }: {
  snapshot: Record<string, unknown> | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const s = snapshot as any;
  const stalledCount = s?.jobs?.stalledJobs?.length ?? 0;
  const newEnqCount = s?.enquiries?.byStatus?.new ?? 0;
  const readyCount = s?.inspections?.readyToQuote?.length ?? 0;
  const alertCount = stalledCount + newEnqCount + readyCount;

  return (
    <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className={cn("flex items-center gap-1.5 text-xs font-medium", snapshot ? "text-green-700" : "text-muted-foreground")}>
          <Database className="h-3 w-3" />
          {loading ? "Syncing..." : snapshot ? "System connected" : "Connecting..."}
        </div>
        {snapshot && alertCount > 0 && (
          <Badge variant="destructive" className="h-5 text-[10px] px-1.5 gap-1">
            <AlertCircle className="h-2.5 w-2.5" />
            {alertCount} item{alertCount !== 1 ? "s" : ""} need attention
          </Badge>
        )}
        {snapshot && alertCount === 0 && (
          <Badge variant="secondary" className="h-5 text-[10px] px-1.5 text-green-700 bg-green-50 border-green-200">
            Pipeline healthy
          </Badge>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={onRefresh}
        disabled={loading}
        title="Refresh system data"
      >
        <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
      </Button>
    </div>
  );
}

export function SkyPanel() {
  const { isOpen, context, messages, isStreaming, systemSnapshot, snapshotLoading } = useSkyState();
  const { closeSky, sendMessage, clearMessages, refreshSnapshot } = useSkyActions();
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as string) || "guest";
  const isAdmin = role === "admin";

  const [input, setInput] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isGuest = role === "guest";
  const isBranchAdmin = role === "branch_admin";
  const suggestedActions = isAdmin
    ? ADMIN_SUGGESTED_ACTIONS
    : isGuest
    ? GUEST_SUGGESTED_ACTIONS
    : isBranchAdmin
    ? BRANCH_ADMIN_SUGGESTED_ACTIONS
    : FIELD_SUGGESTED_ACTIONS[context.contextType] || FIELD_SUGGESTED_ACTIONS.general;

  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 100);
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

  if (!isOpen) return null;

  if (cameraOpen) {
    return <SkyCameraMode onClose={() => setCameraOpen(false)} />;
  }

  const contextLabel = isAdmin
    ? "System Brain"
    : context.contextLabel
    ? `${CONTEXT_LABELS[context.contextType]}: ${context.contextLabel}`
    : CONTEXT_LABELS[context.contextType];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={closeSky} />
      <div className={cn(
        "fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-background shadow-2xl border-l border-border",
        "w-full sm:w-[440px]"
      )}>
        {/* Header */}
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

        {/* Admin status bar */}
        {isAdmin && (
          <AdminStatusBar
            snapshot={systemSnapshot}
            loading={snapshotLoading}
            onRefresh={refreshSnapshot}
          />
        )}

        {/* Chat area */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="text-center py-5">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="h-7 w-7 text-primary" />
                  </div>
                  {isAdmin ? (
                    <>
                      <p className="font-semibold text-foreground">
                        Hi{user?.firstName ? `, ${user.firstName}` : ""}. Sky is ready.
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                        I have live access to your entire business — customers, pipeline, quotes, inspections. Ask me anything.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-foreground">Sky is ready</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Ask anything about this {CONTEXT_LABELS[context.contextType].toLowerCase()}, or choose a suggested action below.
                      </p>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                    {isAdmin ? "Quick insights" : "Suggested actions"}
                  </p>
                  {suggestedActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => sendMessage(action.message)}
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
                  <MessageBubble key={i} role={msg.role} content={msg.content} isThinking={msg.isThinking} />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border flex-shrink-0 bg-background">
          <div className="p-3">
            <div className="flex gap-2 items-end">
              <Button
                size="icon"
                variant="outline"
                className="h-10 w-10 rounded-xl flex-shrink-0"
                onClick={() => setCameraOpen(true)}
                title="Sky Vision — point camera at a site or installation"
              >
                <Camera className="h-4 w-4" />
              </Button>
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Sky a question..."
                className="min-h-[40px] max-h-[100px] resize-none text-sm rounded-xl"
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
              {isAdmin
                ? "Sky reads live system data and provides business intelligence"
                : "Sky reads the current record and provides field guidance"}
            </p>
          </div>
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
        "fixed z-40 flex items-center gap-2 shadow-lg shadow-primary/30",
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
      className={cn("gap-2 px-5", className)}
      onClick={() => openSky({ contextType, contextData, contextLabel })}
    >
      <Sparkles className="h-4 w-4" />
      {label}
    </Button>
  );
}
