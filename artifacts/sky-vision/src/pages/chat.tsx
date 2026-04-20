import { useState, useEffect, useRef, useCallback, memo, forwardRef, useImperativeHandle, type KeyboardEvent, type ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Sidebar } from "@/components/chat/sidebar";
import { useConversation, useCreateConversation, type Message } from "@/hooks/use-conversations";
import { useChat, type ImageAttachment } from "@/hooks/use-chat";
import { useVoice } from "@/hooks/use-voice";
import { CameraMode } from "@/components/camera-mode";
import { VoiceOverlay } from "@/components/voice-overlay";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, X, RotateCcw, Sparkles, ChevronRight, RefreshCw, Camera, ImageIcon, Copy, Check, Zap, Brain, Wand2, Pencil, Eye, Mic, ImagePlus, BarChart3, Lightbulb, PenLine, Paperclip, FileText, Download, BookMarked } from "lucide-react";
import { PromptLibrary } from "@/components/chat/prompt-library";
import { cn } from "@/lib/utils";

const markdownComponents: Record<string, React.FC<any>> = {
  code({ inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || "");
    return !inline && match ? (
      <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" className="rounded-xl text-xs my-2" {...props}>
        {String(children).replace(/\n$/, "")}
      </SyntaxHighlighter>
    ) : (
      <code className="bg-black/20 rounded px-1 py-0.5 text-xs font-mono" {...props}>{children}</code>
    );
  },
  p: ({ children }: any) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }: any) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }: any) => <li className="text-sm leading-relaxed">{children}</li>,
  h1: ({ children }: any) => <h1 className="text-base font-bold mb-1 mt-2">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-sm font-bold mb-1 mt-2">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-sm font-semibold mb-1 mt-1">{children}</h3>,
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: any) => <em className="italic opacity-90">{children}</em>,
  blockquote: ({ children }: any) => <blockquote className="border-l-2 border-primary/50 pl-3 italic text-foreground/70 my-1">{children}</blockquote>,
  hr: () => <hr className="border-border my-2" />,
  a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">{children}</a>,
  table: ({ children }: any) => <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
  th: ({ children }: any) => <th className="border border-border px-2 py-1 bg-muted font-semibold text-left">{children}</th>,
  td: ({ children }: any) => <td className="border border-border px-2 py-1">{children}</td>,
};

type ModelMode = "auto" | "fast" | "smart";

const MODEL_MODES: { mode: ModelMode; label: string; icon: React.ReactNode; title: string }[] = [
  { mode: "auto",  label: "Auto",  icon: <Wand2 className="h-3.5 w-3.5" />, title: "Auto — picks Fast or Smart based on your message" },
  { mode: "fast",  label: "Fast",  icon: <Zap className="h-3.5 w-3.5" />,  title: "Fast — quick replies, lower cost" },
  { mode: "smart", label: "Smart", icon: <Brain className="h-3.5 w-3.5" />, title: "Smart — full power model for complex tasks" },
];

const QUICK_ACTIONS: {
  label: string;
  icon: React.FC<{ className?: string }>;
  action: "generate" | "chat";
  message?: string;
}[] = [
  {
    label: "Create image",
    icon: ImagePlus,
    action: "generate",
  },
  {
    label: "Analyse data",
    icon: BarChart3,
    action: "chat",
    message: "I have some data I'd like you to analyse — it could be numbers, a report, a chart, or a table. What would you like me to look at?",
  },
  {
    label: "Get advice",
    icon: Lightbulb,
    action: "chat",
    message: "I need some expert advice. What topic or situation would you like guidance on?",
  },
  {
    label: "Help me write",
    icon: PenLine,
    action: "chat",
    message: "I need help writing something — an email, a report, a message, or anything else. What would you like to create?",
  },
];

interface PendingImage {
  base64: string;
  mimeType: string;
  preview: string;
}

function MessageBubble({ role, content, imagePreview, resultImage, isThinking, fileName }: {
  role: "user" | "assistant";
  content: string;
  imagePreview?: string;
  resultImage?: string;
  isThinking?: boolean;
  fileName?: string;
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
        {isUser && fileName && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-primary/20 border border-primary/30 text-xs font-medium text-primary-foreground max-w-[240px]">
            <FileText className="h-3 w-3 shrink-0 text-primary-foreground/70" />
            <span className="truncate">{fileName}</span>
          </div>
        )}
        {content && (
          <div className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm whitespace-pre-wrap"
              : isThinking
              ? "bg-amber-500/10 text-amber-200 border border-amber-500/30 rounded-tl-sm italic"
              : "bg-muted text-foreground rounded-tl-sm"
          )}>
            {isUser || isThinking ? content : (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {content}
              </ReactMarkdown>
            )}
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

const IMAGE_GEN_REGEX = /\b(create|generate|draw|make|design|paint|sketch|illustrate|produce|render)\b.{0,40}\b(image|photo|picture|illustration|artwork|painting|drawing|portrait|scene|wallpaper|logo|icon|poster|banner)\b/i;

function isImageGenRequest(text: string): boolean {
  return IMAGE_GEN_REGEX.test(text);
}

interface DocFile { name: string; context: string; }

type ChatInputHandle = { activateGenerateMode: () => void; setInputText: (text: string) => void };

// Isolated input — its own state so streaming re-renders never touch it
const ChatInput = memo(forwardRef<ChatInputHandle, {
  isStreaming: boolean;
  isEditing: boolean;
  isGenerating: boolean;
  onSend: (text: string, image?: PendingImage, fileContext?: string, fileName?: string) => void;
  onEdit: (text: string, image: PendingImage) => void;
  onGenerate: (text: string) => void;
  onCameraOpen: () => void;
}>(function ChatInput({
  isStreaming,
  isEditing,
  isGenerating,
  onSend,
  onEdit,
  onGenerate,
  onCameraOpen,
}, ref) {
  const [input, setInput] = useState("");
  const [image, setImage] = useState<PendingImage | null>(null);
  const [imageMode, setImageMode] = useState<"analyze" | "edit">("analyze");
  const [generateMode, setGenerateMode] = useState(false);
  const [docFile, setDocFile] = useState<DocFile | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [promptLibOpen, setPromptLibOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const onSendRef = useRef(onSend);
  const onEditRef = useRef(onEdit);
  const onGenerateRef = useRef(onGenerate);
  useEffect(() => { onSendRef.current = onSend; }, [onSend]);
  useEffect(() => { onEditRef.current = onEdit; }, [onEdit]);
  useEffect(() => { onGenerateRef.current = onGenerate; }, [onGenerate]);

  useImperativeHandle(ref, () => ({
    activateGenerateMode: () => { setGenerateMode(true); setImage(null); },
    setInputText: (text: string) => setInput(text),
  }));

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

  const handleDocFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsParsing(true);
    try {
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/sky-vision/parse-file", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64, mimeType: file.type, fileName: file.name }),
      });
      if (!res.ok) throw new Error("Failed to parse file");
      const { text } = await res.json();
      setDocFile({ name: file.name, context: text });
    } catch {
      setDocFile(null);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const busy = isStreaming || isEditing || isGenerating;

  const handleSend = useCallback(() => {
    const text = input.trim();
    if ((!text && !image && !docFile) || busy) return;
    const img = image;
    const doc = docFile;
    setInput("");
    setImage(null);
    setDocFile(null);
    if (img && imageMode === "edit") {
      onEditRef.current(text || "Edit this image", img);
    } else if (generateMode || (!img && !doc && isImageGenRequest(text))) {
      setGenerateMode(false);
      onGenerateRef.current(text);
    } else {
      onSendRef.current(text || "What's in this image?", img ?? undefined, doc?.context, doc?.name);
    }
  }, [input, image, docFile, busy, imageMode, generateMode]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const placeholder = generateMode
    ? "Describe the image you want to create..."
    : image
      ? imageMode === "edit"
        ? "Describe the edit you want (e.g. 'remove the background')"
        : "Ask Sky about this image..."
      : docFile
        ? `Ask Sky about ${docFile.name}...`
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

      {/* Document file badge */}
      {docFile && (
        <div className="px-3 pt-3 flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-medium text-primary max-w-xs">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{docFile.name}</span>
          </div>
          <button
            onClick={() => setDocFile(null)}
            className="w-5 h-5 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors text-muted-foreground"
          >
            <X className="h-3 w-3" />
          </button>
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
        <input
          ref={docFileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.csv,.txt,.md"
          className="hidden"
          onChange={handleDocFileChange}
        />
        {generateMode && (
          <div className="mb-2 flex items-center gap-2 px-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <ImagePlus className="h-3.5 w-3.5" />
              Image generation mode
            </div>
            <button
              onClick={() => setGenerateMode(false)}
              className="ml-auto text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy || generateMode}
            title="Attach an image"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className={cn("h-10 w-10 rounded-xl flex-shrink-0 hover:bg-muted relative", docFile ? "text-primary" : "text-muted-foreground hover:text-foreground")}
            onClick={() => docFileInputRef.current?.click()}
            disabled={busy || generateMode || isParsing}
            title="Attach a document (PDF, DOCX, CSV, TXT)"
          >
            {isParsing
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <Paperclip className="h-4 w-4" />
            }
            {docFile && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />}
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
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => setPromptLibOpen(true)}
            disabled={busy}
            title="Saved prompts"
          >
            <BookMarked className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            className={cn("h-10 w-10 rounded-xl flex-shrink-0", generateMode && "bg-primary")}
            onClick={handleSend}
            disabled={(!input.trim() && !image && !docFile) || busy}
          >
            {isGenerating
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : isEditing
                ? <RefreshCw className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
            }
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          {generateMode ? "Describe what you want — Sky will create it using DALL-E 3" : "Attach an image or document to analyse with AI"}
        </p>
      </div>

      <PromptLibrary
        open={promptLibOpen}
        onOpenChange={setPromptLibOpen}
        currentInput={input}
        onSelect={(content) => { setInput(content); setPromptLibOpen(false); }}
      />
    </div>
  );
}));

export function ChatPage() {
  const [activeId, setActiveId] = useState<string>("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [modelMode, setModelMode] = useState<ModelMode>("auto");
  const [voiceMode, setVoiceMode] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [pendingStart, setPendingStart] = useState(false);
  const chatInputRef = useRef<ChatInputHandle>(null);

  const { data: conversation, isLoading } = useConversation(activeId || null);
  const createConv = useCreateConversation();
  const { sendMessage, editImage, generateImage, isStreaming, isSearching, isEditing, isGenerating, streamingMessage, activeModel, lastCompletedResponse, suggestions } = useChat(activeId || null);

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
      const newConv = await createConv.mutateAsync(undefined);
      setActiveId(newConv.id);
      return newConv.id;
    } catch {
      return null;
    }
  }, [activeId, createConv]);

  const handleSend = useCallback(async (text: string, image?: PendingImage, fileContext?: string, fileName?: string) => {
    const targetId = await ensureConversation();
    if (!targetId) return;
    const imageAttachment: ImageAttachment | undefined = image
      ? { base64: image.base64, mimeType: image.mimeType, dataUrl: image.preview }
      : undefined;
    sendMessage(text, targetId, imageAttachment, modelMode, fileContext, fileName);
  }, [ensureConversation, sendMessage, modelMode]);

  const handleExport = useCallback(() => {
    if (!messages.length) return;
    const lines = messages.map((m) => {
      const role = m.role === "user" ? "**You**" : "**Sky**";
      return `${role}\n\n${m.content}`;
    });
    const md = lines.join("\n\n---\n\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sky-conversation-${activeId || "chat"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, activeId]);

  const handleEdit = useCallback(async (text: string, image: PendingImage) => {
    const targetId = await ensureConversation();
    if (!targetId) return;
    editImage(text, targetId, { base64: image.base64, mimeType: image.mimeType, dataUrl: image.preview });
  }, [ensureConversation, editImage]);

  const handleGenerate = useCallback(async (prompt: string) => {
    const targetId = await ensureConversation();
    if (!targetId) return;
    generateImage(prompt, targetId);
  }, [ensureConversation, generateImage]);

  const handleSuggestion = useCallback(async (message: string) => {
    if (isStreaming || pendingStart) return;
    setPendingStart(true);
    const targetId = await ensureConversation();
    if (!targetId) { setPendingStart(false); return; }
    setPendingStart(false);
    sendMessage(message, targetId, undefined, modelMode);
  }, [ensureConversation, isStreaming, pendingStart, sendMessage, modelMode]);

  const handleQuickGenerate = useCallback(async () => {
    if (pendingStart) return;
    setPendingStart(true);
    const targetId = await ensureConversation();
    if (!targetId) { setPendingStart(false); return; }
    setActiveId(String(targetId));
    // Do NOT reset pendingStart here — keep welcome hidden until a message arrives
    chatInputRef.current?.activateGenerateMode();
  }, [ensureConversation, pendingStart]);

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

  // Reset pendingStart once messages arrive (handles the "Create image" flow)
  const messages: Message[] = conversation?.messages || [];
  useEffect(() => {
    if (pendingStart && messages.length > 0) setPendingStart(false);
  }, [pendingStart, messages.length]);

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

  const showWelcome = !pendingStart && !isStreaming && !isGenerating && (!activeId || (!isLoading && messages.length === 0));
  const currentModeConfig = MODEL_MODES.find((m) => m.mode === modelMode)!;

  return (
    <>
      {cameraOpen && <CameraMode onClose={() => setCameraOpen(false)} />}

      <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden">
        <div className="hidden md:block h-full">
          <Sidebar activeId={activeId} onSelect={setActiveId} />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white flex-shrink-0 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #B82200 0%, #FF3C00 45%, #FF6B30 80%, #FF8C42 100%)" }}
          >
            {/* Shine overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/15 via-transparent to-black/10 pointer-events-none" />
            {/* Subtle radial glow behind logo */}
            <div className="absolute left-0 top-0 w-32 h-full bg-[radial-gradient(ellipse_at_left_center,_rgba(255,255,255,0.12)_0%,_transparent_70%)] pointer-events-none" />

            <div className="flex items-center gap-2.5 relative z-10">
              <div className="md:hidden">
                <Sidebar activeId={activeId} onSelect={setActiveId} isMobile />
              </div>
              {/* Animated icon */}
              <div className="hidden md:flex relative items-center justify-center w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm border border-white/20">
                <Sparkles className="h-4 w-4 text-white" />
                <span className="absolute inset-0 rounded-full animate-ping bg-white/20 opacity-40" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight drop-shadow-sm">Sky</span>
                <div className="flex items-center gap-1.5 -mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80] animate-pulse" />
                  <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>System Brain</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 relative z-10">
              {/* Model mode toggle */}
              <button
                onClick={cycleModel}
                title={currentModeConfig.title}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/15 hover:bg-white/25 transition-colors text-white border border-white/10"
              >
                {currentModeConfig.icon}
                <span className="hidden sm:inline">{currentModeConfig.label}</span>
              </button>

              {/* Voice mode toggle */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 hover:bg-white/20 text-white",
                  voiceMode && "bg-white/25"
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
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={handleExport}
                    title="Export conversation"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={() => setActiveId("")}
                    title="New conversation"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
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
                    {QUICK_ACTIONS.map((action) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.label}
                          onClick={() => {
                            if (action.action === "generate") {
                              handleQuickGenerate();
                            } else if (action.message) {
                              handleSuggestion(action.message);
                            }
                          }}
                          disabled={isStreaming || isGenerating}
                          className="w-full text-left px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/60 transition-colors text-sm font-medium flex items-center gap-3 group"
                        >
                          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span className="flex-1">{action.label}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                        </button>
                      );
                    })}
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
                      fileName={(msg as any).fileName}
                    />
                  ))}
                  {isStreaming && (
                    <>
                      {isSearching && !streamingMessage && (
                        <div className="flex items-center gap-2 px-1 text-sm text-orange-400 animate-pulse">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="8" strokeWidth="2" />
                            <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                          Searching the web...
                        </div>
                      )}
                      <MessageBubble role="assistant" content={streamingMessage} isThinking={!streamingMessage && !isSearching} />
                    </>
                  )}
                  {/* Follow-up suggestion chips */}
                  {!isStreaming && suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 pl-10">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestion(s)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                        >
                          <ChevronRight className="h-3 w-3" />
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>

          <ChatInput
            ref={chatInputRef}
            isStreaming={isStreaming}
            isEditing={isEditing}
            isGenerating={isGenerating}
            onSend={handleSend}
            onEdit={handleEdit}
            onGenerate={handleGenerate}
            onCameraOpen={() => setCameraOpen(true)}
          />
        </div>
      </div>
    </>
  );
}
