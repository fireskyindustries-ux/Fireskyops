import { useState, useEffect, useRef, useCallback, memo, type KeyboardEvent, type ChangeEvent } from "react";
import { Sidebar } from "@/components/chat/sidebar";
import { useConversation, useCreateConversation, type Message } from "@/hooks/use-conversations";
import { useChat, type ImageAttachment } from "@/hooks/use-chat";
import { useVoice } from "@/hooks/use-voice";
import { CameraMode } from "@/components/camera-mode";
import { VoiceOverlay } from "@/components/voice-overlay";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, X, RotateCcw, Sparkles, ChevronRight, RefreshCw, Camera, ImageIcon, Copy, Check, Zap, Brain, Wand2, Pencil, Eye, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

type ModelMode = "auto" | "fast" | "smart";

const MODEL_MODES: { mode: ModelMode; label: string; icon: React.ReactNode; title: string }[] = [
  { mode: "auto",  label: "Auto",  icon: <Wand2 className="h-3.5 w-3.5" />, title: "Auto — picks Fast or Smart based on your message" },
  { mode: "fast",  label: "Fast",  icon: <Zap className="h-3.5 w-3.5" />,  title: "Fast — quick replies, lower cost" },
  { mode: "smart", label: "Smart", icon: <Brain className="h-3.5 w-3.5" />, title: "Smart — full power model for complex tasks" },
];

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

function MessageBubble({ role, content, imagePreview, resultImage, isThinking }: {
  role: "user" | "assistant";
  content: string;
  imagePreview?: string;
  resultImage?: string;
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
        {resultImage && (
          <img
            src={resultImage}
            alt="Edited image"
            className="rounded-xl max-w-[320px] max-h-[320px] object-contain border border-border mt-1"
          />
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
  isEditing,
  onSend,
  onEdit,
  onCameraOpen,
}: {
  isStreaming: boolean;
  isEditing: boolean;
  onSend: (text: string, image?: PendingImage) => void;
  onEdit: (text: string, image: PendingImage) => void;
  onCameraOpen: () => void;
}) {
  const [input, setInput] = useState("");
  const [image, setImage] = useState<PendingImage | null>(null);
  const [imageMode, setImageMode] = useState<"analyze" | "edit">("analyze");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onSendRef = useRef(onSend);
  const onEditRef = useRef(onEdit);
  useEffect(() => { onSendRef.current = onSend; }, [onSend]);
  useEffect(() => { onEditRef.current = onEdit; }, [onEdit]);

  // Reset edit mode when image is cleared
  useEffect(() => { if (!image) setImageMode("analyze"); }, [image]);

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

  const busy = isStreaming || isEditing;

  const handleSend = useCallback(() => {
    const text = input.trim();
    if ((!text && !image) || busy) return;
    const img = image;
    setInput("");
    setImage(null);
    if (img && imageMode === "edit") {
      onEditRef.current(text || "Edit this image", img);
    } else {
      onSendRef.current(text || "What's in this image?", img ?? undefined);
    }
  }, [input, image, busy, imageMode]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const placeholder = image
    ? imageMode === "edit"
      ? "Describe the edit you want (e.g. 'remove the background')"
      : "Ask Sky about this image..."
    : "Ask Sky anything...";

  return (
    <div className="border-t border-border flex-shrink-0 bg-background">
      {/* Image preview strip */}
      {image && (
        <div className="px-3 pt-3 flex items-start gap-3">
          <div className="relative inline-block flex-shrink-0">
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
          {/* Analyze / Edit toggle */}
          <div className="flex flex-col gap-1.5 pt-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Image mode</p>
            <div className="flex gap-1">
              <button
                onClick={() => setImageMode("analyze")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                  imageMode === "analyze"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-muted-foreground border-border hover:bg-muted"
                )}
              >
                <Eye className="h-3 w-3" /> Analyse
              </button>
              <button
                onClick={() => setImageMode("edit")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                  imageMode === "edit"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-muted-foreground border-border hover:bg-muted"
                )}
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            </div>
            {imageMode === "edit" && (
              <p className="text-[10px] text-muted-foreground">Describe the change you want — AI will generate the edited image</p>
            )}
          </div>
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
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            title="Attach an image"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={onCameraOpen}
            disabled={busy}
            title="Open live camera"
          >
            <Camera className="h-4 w-4" />
          </Button>

          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[40px] max-h-[100px] resize-none text-sm rounded-xl flex-1"
            rows={1}
            disabled={busy}
          />
          <Button
            size="icon"
            className="h-10 w-10 rounded-xl flex-shrink-0"
            onClick={handleSend}
            disabled={(!input.trim() && !image) || busy}
          >
            {isEditing
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />
            }
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Attach an image to analyse or edit it with AI
        </p>
      </div>
    </div>
  );
});

export function ChatPage() {
  const [activeId, setActiveId] = useState<string>("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [modelMode, setModelMode] = useState<ModelMode>("auto");
  const [voiceMode, setVoiceMode] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");

  const { data: conversation, isLoading } = useConversation(activeId || null);
  const createConv = useCreateConversation();
  const { sendMessage, editImage, isStreaming, isEditing, streamingMessage, activeModel, lastCompletedResponse } = useChat(activeId || null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
  const prevMessageCount = useRef(0);
  const wasStreaming = useRef(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

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

  useEffect(() => {
    if (isStreaming && !wasStreaming.current) scrollToBottom("smooth");
    wasStreaming.current = isStreaming;
  }, [isStreaming, scrollToBottom]);

  useEffect(() => {
    initialScrollDone.current = false;
    prevMessageCount.current = 0;
  }, [activeId]);

  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (activeId) return activeId;
    try {
      const newConv = await createConv.mutateAsync();
      setActiveId(newConv.id);
      return newConv.id;
    } catch {
      return null;
    }
  }, [activeId, createConv]);

  const handleSend = useCallback(async (text: string, image?: PendingImage) => {
    const targetId = await ensureConversation();
    if (!targetId) return;
    const imageAttachment: ImageAttachment | undefined = image
      ? { base64: image.base64, mimeType: image.mimeType, dataUrl: image.preview }
      : undefined;
    sendMessage(text, targetId, imageAttachment, modelMode);
  }, [ensureConversation, sendMessage, modelMode]);

  const handleEdit = useCallback(async (text: string, image: PendingImage) => {
    const targetId = await ensureConversation();
    if (!targetId) return;
    editImage(text, targetId, { base64: image.base64, mimeType: image.mimeType, dataUrl: image.preview });
  }, [ensureConversation, editImage]);

  const handleSuggestion = useCallback(async (message: string) => {
    if (isStreaming) return;
    const targetId = await ensureConversation();
    if (!targetId) return;
    sendMessage(message, targetId, undefined, modelMode);
  }, [ensureConversation, isStreaming, sendMessage, modelMode]);

  const cycleModel = useCallback(() => {
    setModelMode((prev) => prev === "auto" ? "fast" : prev === "fast" ? "smart" : "auto");
  }, []);

  // Voice transcript handler — sends speech as a chat message
  const handleVoiceTranscript = useCallback(async (text: string) => {
    setLastTranscript(text);
    const targetId = await ensureConversation();
    if (!targetId) return;
    sendMessage(text, targetId, undefined, modelMode);
  }, [ensureConversation, sendMessage, modelMode]);

  const { isListening, isSpeaking, isTranscribing, startListening, cancelSpeaking, speak } = useVoice({
    onTranscript: handleVoiceTranscript,
    autoLoop: voiceMode,
  });

  // Auto-speak Sky's response when in voice mode
  const spokenResponseRef = useRef("");
  useEffect(() => {
    if (!voiceMode || !lastCompletedResponse || lastCompletedResponse === spokenResponseRef.current) return;
    spokenResponseRef.current = lastCompletedResponse;
    speak(lastCompletedResponse);
  }, [voiceMode, lastCompletedResponse, speak]);

  // Exit voice mode cleanly
  const exitVoiceMode = useCallback(() => {
    setVoiceMode(false);
    cancelSpeaking();
    setLastTranscript("");
  }, [cancelSpeaking]);

  const messages: Message[] = conversation?.messages || [];
  const showWelcome = !activeId || (!isLoading && messages.length === 0);
  const currentModeConfig = MODEL_MODES.find((m) => m.mode === modelMode)!;

  // What model was actually used for the last reply (if auto mode chose)
  const modelLabel = activeModel
    ? activeModel.includes("mini") ? "Fast" : "Smart"
    : null;

  return (
    <>
      {cameraOpen && <CameraMode onClose={() => setCameraOpen(false)} />}

      <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden">
        <div className="hidden md:block h-full">
          <Sidebar activeId={activeId} onSelect={setActiveId} />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
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
                  <span className="text-xs opacity-80 font-medium">
                    {modelLabel && !isStreaming ? modelLabel : "System Brain"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Model mode toggle */}
              <button
                onClick={cycleModel}
                title={currentModeConfig.title}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary-foreground/15 hover:bg-primary-foreground/25 transition-colors text-primary-foreground"
              >
                {currentModeConfig.icon}
                <span className="hidden sm:inline">{currentModeConfig.label}</span>
              </button>

              {/* Voice mode toggle */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 hover:bg-primary-foreground/20",
                  voiceMode
                    ? "text-primary-foreground bg-primary-foreground/25"
                    : "text-primary-foreground"
                )}
                onClick={() => {
                  if (voiceMode) {
                    exitVoiceMode();
                  } else {
                    setVoiceMode(true);
                    setTimeout(() => startListening(), 300);
                  }
                }}
                title={voiceMode ? "Exit voice mode" : "Voice mode (hands-free)"}
              >
                <Mic className="h-4 w-4" />
              </Button>

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

          {/* Message area */}
          <div className="flex-1 min-h-0 relative">
          {voiceMode && (
            <VoiceOverlay
              isListening={isListening}
              isSpeaking={isSpeaking}
              isTranscribing={isTranscribing}
              lastTranscript={lastTranscript}
              onMicToggle={startListening}
              onClose={exitVoiceMode}
            />
          )}
          <div ref={scrollRef} className="h-full overflow-y-auto">
            <div className="p-4 space-y-4">
              {showWelcome ? (
                <div className="space-y-4">
                  <div className="text-center py-6">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="h-7 w-7 text-primary" />
                    </div>
                    <p className="font-semibold text-foreground">Sky is ready.</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                      Ask me anything, attach an image to analyse or edit it with AI.
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
                      imagePreview={msg.imagePreview}
                      resultImage={msg.resultImage}
                    />
                  ))}
                  {isStreaming && (
                    <MessageBubble role="assistant" content={streamingMessage} isThinking={!streamingMessage} />
                  )}
                </div>
              )}
            </div>
          </div>
          </div>

          <ChatInput
            isStreaming={isStreaming}
            isEditing={isEditing}
            onSend={handleSend}
            onEdit={handleEdit}
            onCameraOpen={() => setCameraOpen(true)}
          />
        </div>
      </div>
    </>
  );
}
