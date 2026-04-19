import { useState, useEffect, useRef, useCallback, memo, type KeyboardEvent, type ChangeEvent } from "react";
import { Sidebar } from "@/components/chat/sidebar";
import { useConversation, useCreateConversation, type Message } from "@/hooks/use-conversations";
import { useChat, type ImageAttachment } from "@/hooks/use-chat";
import { CameraMode } from "@/components/camera-mode";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, X, RotateCcw, Sparkles, ChevronRight, RefreshCw, Camera, ImageIcon, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";


const SUGGESTED_ACTIONS = [
  { label: "What can you help me with?", message: "Give me a quick overview of everything you can help me with." },
  { label: "Write something for me", message: "I need help writing something — a professional email, a report, a message, or anything else. What do you need from me to get started?" },
  { label: "Explain a concept", message: "I want to understand something better. What topic would you like me to explain?" },
  { label: "Help me think through a problem", message: "I have a problem or decision I need to work through. Can you help me think it out clearly?" },
  { label: "Research or summarise a topic", message: "I need you to research or summarise something for me. What would you like to know about?" },
  { label: "What's in stock?", message: "Check our current stock levels and tell me what we have and what's running low." },
];

interface PendingImage {
  base64: string;
  mimeType: string;
  preview: string;
}

function MessageBubble({ role, content, imagePreview, isThinking }: {
  role: "user" | "assistant";
  content: string;
  imagePreview?: string;
  isThinking?: boolean;
}) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

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
      <div className={cn("max-w-[85%] flex flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
        {imagePreview && (
          <img
            src={imagePreview}
            alt="Attached"
            className={cn("rounded-xl max-w-[220px] max-h-[160px] object-cover border", isUser ? "border-primary/40" : "border-border")}
          />
        )}
        {content && (
          <div className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
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
        )}
        {isThinking && !content && (
          <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5">
            <span className="flex gap-1 items-center text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
            </span>
          </div>
        )}
        {!isUser && !isThinking && content && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-0.5 px-1"
          >
            {copied
              ? <><Check className="h-3 w-3 text-green-500" /><span className="text-green-500">Copied</span></>
              : <><Copy className="h-3 w-3" /><span>Copy</span></>
            }
          </button>
        )}
      </div>
    </div>
  );
}

// Isolated input — its own state so streaming re-renders never touch it
const ChatInput = memo(function ChatInput({
  isStreaming,
  onSend,
  onCameraOpen,
}: {
  isStreaming: boolean;
  onSend: (text: string, image?: PendingImage) => void;
  onCameraOpen: () => void;
}) {
  const [input, setInput] = useState("");
  const [image, setImage] = useState<PendingImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onSendRef = useRef(onSend);
  useEffect(() => { onSendRef.current = onSend; }, [onSend]);

  const handleImageFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImage({ base64: dataUrl.split(",")[1], mimeType: file.type, preview: dataUrl });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
    e.target.value = "";
  }, [handleImageFile]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if ((!text && !image) || isStreaming) return;
    const img = image;
    setInput("");
    setImage(null);
    onSendRef.current(text || "What's in this image?", img ?? undefined);
  }, [input, image, isStreaming]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="border-t border-border flex-shrink-0 bg-background">
      {/* Image preview strip */}
      {image && (
        <div className="px-3 pt-3 flex items-start gap-2">
          <div className="relative inline-block">
            <img
              src={image.preview}
              alt="Attachment preview"
              className="h-20 w-20 object-cover rounded-xl border border-border"
            />
            <button
              onClick={() => setImage(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-foreground/80 text-background flex items-center justify-center hover:bg-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Image attached — type a question or send as-is</p>
        </div>
      )}

      <div className="p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex gap-2 items-end">
          {/* Image upload button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            title="Attach an image"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>

          {/* Camera button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={onCameraOpen}
            disabled={isStreaming}
            title="Open live camera"
          >
            <Camera className="h-4 w-4" />
          </Button>

          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={image ? "Ask Sky about this image..." : "Ask Sky anything..."}
            className="min-h-[40px] max-h-[100px] resize-none text-sm rounded-xl flex-1"
            rows={1}
            disabled={isStreaming}
          />
          <Button
            size="icon"
            className="h-10 w-10 rounded-xl flex-shrink-0"
            onClick={handleSend}
            disabled={(!input.trim() && !image) || isStreaming}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Attach an image or open camera to share visuals with Sky
        </p>
      </div>
    </div>
  );
});

export function ChatPage() {
  const [activeId, setActiveId] = useState<string>("");
  const [cameraOpen, setCameraOpen] = useState(false);

  const { data: conversation, isLoading } = useConversation(activeId || null);
  const createConv = useCreateConversation();
  const { sendMessage, isStreaming, streamingMessage } = useChat(activeId || null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
  const prevMessageCount = useRef(0);
  const wasStreaming = useRef(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Handle initial load and new confirmed messages — not triggered by streaming chunks
  useEffect(() => {
    const count = conversation?.messages?.length ?? 0;
    const isNewMessage = count > prevMessageCount.current;
    prevMessageCount.current = count;

    if (!initialScrollDone.current && count > 0) {
      scrollToBottom("instant");
      initialScrollDone.current = true;
    } else if (isNewMessage) {
      scrollToBottom("smooth");
    }
  }, [conversation?.messages, scrollToBottom]);

  // Scroll once when streaming starts — not on every chunk
  useEffect(() => {
    if (isStreaming && !wasStreaming.current) {
      scrollToBottom("smooth");
    }
    wasStreaming.current = isStreaming;
  }, [isStreaming, scrollToBottom]);

  // Reset scroll tracking when switching conversations
  useEffect(() => {
    initialScrollDone.current = false;
    prevMessageCount.current = 0;
  }, [activeId]);

  const handleSend = useCallback(async (text: string, image?: PendingImage) => {
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
    const imageAttachment: ImageAttachment | undefined = image
      ? { base64: image.base64, mimeType: image.mimeType }
      : undefined;
    sendMessage(text, targetId, imageAttachment);
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
    <>
      {cameraOpen && <CameraMode onClose={() => setCameraOpen(false)} />}

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

          {/* Message area — plain div so scroll position is owned by the DOM element,
               not reset by a Radix viewport on every re-render */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-4 space-y-4">
              {showWelcome ? (
                <div className="space-y-4">
                  <div className="text-center py-6">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="h-7 w-7 text-primary" />
                    </div>
                    <p className="font-semibold text-foreground">Sky is ready.</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                      Ask me anything, or attach an image to analyse visuals instantly.
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
                    <MessageBubble
                      key={msg.id}
                      role={msg.role}
                      content={msg.content}
                    />
                  ))}
                  {isStreaming && (
                    <MessageBubble role="assistant" content={streamingMessage} isThinking={!streamingMessage} />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Input — isolated, unaffected by streaming re-renders */}
          <ChatInput
            isStreaming={isStreaming}
            onSend={handleSend}
            onCameraOpen={() => setCameraOpen(true)}
          />
        </div>
      </div>
    </>
  );
}
