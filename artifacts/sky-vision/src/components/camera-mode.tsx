import { useRef, useEffect, useState, useCallback } from "react";
import { X, Camera, Loader2, Sparkles, Mic, MicOff, Volume2, VolumeX, FlipHorizontal, RotateCcw, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface VisionTurn { role: "user" | "assistant"; content: string; }

interface CameraModeProps { onClose: () => void; }

const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const hasVoiceInput = !!SR;
const hasTTS = typeof window !== "undefined" && "speechSynthesis" in window;

function speakText(text: string, onEnd?: () => void) {
  if (!hasTTS) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 1.05; utt.pitch = 1; utt.lang = "en-ZA";
  utt.onend = () => onEnd?.();
  utt.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utt);
}
function stopSpeaking() { if (hasTTS) window.speechSynthesis.cancel(); }

export function CameraMode({ onClose }: CameraModeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const srRef = useRef<any>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(hasTTS);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [history, setHistory] = useState<VisionTurn[]>([]);
  const [captureCount, setCaptureCount] = useState(0);

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access in your browser settings."
          : "Could not access the camera. Please check your device settings."
      );
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      stopSpeaking();
      srRef.current?.stop();
    };
  }, []);

  const flipCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  };

  const startListening = useCallback(() => {
    if (!hasVoiceInput || isListening) return;
    stopSpeaking();
    const sr = new SR();
    srRef.current = sr;
    sr.lang = "en-ZA"; sr.interimResults = false; sr.maxAlternatives = 1;
    sr.onstart = () => setIsListening(true);
    sr.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setQuestion(transcript);
      setIsListening(false);
      setTimeout(() => captureAndAnalyze(transcript), 300);
    };
    sr.onerror = () => setIsListening(false);
    sr.onend = () => setIsListening(false);
    sr.start();
  }, [isListening]);

  const stopListening = useCallback(() => {
    srRef.current?.stop();
    setIsListening(false);
  }, []);

  const captureAndAnalyze = useCallback(async (customQuestion?: string) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || isAnalyzing || video.videoWidth === 0) return;

    stopSpeaking();
    setSuggestions([]);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const base64 = dataUrl.split(",")[1];

    const askedQuestion = customQuestion || question || undefined;
    setIsAnalyzing(true);
    setResponse("");
    setQuestion("");

    try {
      const res = await fetch(`${BASE}/api/sky-vision/vision`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: "image/jpeg", question: askedQuestion, history }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) { fullResponse += data.content; setResponse(fullResponse); }
            if (data.suggestions && Array.isArray(data.suggestions)) setSuggestions(data.suggestions.slice(0, 3));
            if (data.error) setResponse(data.error);
          } catch {}
        }
      }

      setHistory((prev) => [
        ...prev,
        { role: "user", content: askedQuestion || "What do you see?" },
        { role: "assistant", content: fullResponse },
      ]);
      setCaptureCount((c) => c + 1);

      if (voiceEnabled && fullResponse) {
        setIsSpeaking(true);
        speakText(fullResponse, () => setIsSpeaking(false));
      }
    } catch {
      setResponse("Sky could not analyse the image. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, question, history, voiceEnabled]);

  const clearSession = () => {
    setHistory([]); setResponse(""); setSuggestions([]);
    setCaptureCount(0); stopSpeaking(); setIsSpeaking(false);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col overflow-hidden select-none">
      <canvas ref={canvasRef} className="hidden" />

      {!cameraError && (
        <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
      )}

      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="text-center text-white">
            <Camera className="h-14 w-14 mx-auto mb-4 opacity-40" />
            <p className="text-sm text-white/70 leading-relaxed">{cameraError}</p>
          </div>
        </div>
      )}

      {/* Corner scan frame */}
      {!cameraError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-56 h-56 relative opacity-40">
            <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-orange-400" />
            <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-orange-400" />
            <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-orange-400" />
            <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-orange-400" />
          </div>
        </div>
      )}

      {isSpeaking && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-56 h-56 rounded-full border-2 border-orange-400 opacity-60 animate-ping" />
        </div>
      )}

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-6"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.80) 0%, transparent 100%)" }}>
        <div className="flex items-center gap-2.5">
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors",
            isAnalyzing ? "bg-orange-500" : isSpeaking ? "bg-blue-500" : "bg-orange-500")}>
            {isAnalyzing
              ? <Loader2 className="h-4 w-4 text-white animate-spin" />
              : isSpeaking ? <Volume2 className="h-4 w-4 text-white" />
              : <Sparkles className="h-4 w-4 text-white" />}
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">Sky Vision</p>
            <p className="text-[10px] text-white/55 leading-none mt-0.5">
              {captureCount === 0 ? "Point camera and capture" : `${captureCount} observation${captureCount !== 1 ? "s" : ""} this session`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {captureCount > 0 && (
            <button onClick={clearSession} className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white/70 hover:text-white" title="Clear session">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          {hasTTS && (
            <button onClick={() => { if (voiceEnabled) { stopSpeaking(); setIsSpeaking(false); } setVoiceEnabled((v) => !v); }}
              className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                voiceEnabled ? "bg-blue-500 text-white" : "bg-black/40 text-white/60")}>
              {voiceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>
          )}
          <button onClick={flipCamera} className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white">
            <FlipHorizontal className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1" />

      {/* Suggestions */}
      {suggestions.length > 0 && !isAnalyzing && (
        <div className="relative z-10 px-3 mb-3 flex flex-col gap-1.5">
          <p className="text-[10px] text-white/50 uppercase tracking-wider font-medium px-1">Sky suggests</p>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => captureAndAnalyze(s)}
              className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-xl text-sm text-white font-medium active:scale-[0.98]"
              style={{ background: "rgba(249,115,22,0.22)", backdropFilter: "blur(12px)", border: "1px solid rgba(249,115,22,0.35)" }}>
              <ChevronRight className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Response HUD */}
      {(response || isAnalyzing) && (
        <div className="relative z-10 mx-3 mb-3 rounded-2xl p-4" style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(16px)" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs font-semibold text-orange-400">Sky</span>
            {isSpeaking && <span className="ml-auto flex items-center gap-1 text-[10px] text-blue-400"><Volume2 className="h-3 w-3" /> Speaking...</span>}
          </div>
          <p className="text-sm text-white leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
            {isAnalyzing && !response ? <span className="text-white/50 italic">Analysing what I see...</span> : response}
          </p>
        </div>
      )}

      {/* Input row */}
      <div className="relative z-10 px-3 pb-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="flex gap-2 items-end rounded-2xl px-3 py-2" style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(16px)" }}>
          {hasVoiceInput && (
            <button onPointerDown={startListening} onPointerUp={stopListening} onPointerLeave={stopListening}
              disabled={isAnalyzing}
              className={cn("mb-1 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                isListening ? "bg-red-500 animate-pulse" : "bg-white/15 hover:bg-white/25 disabled:opacity-40")}>
              {isListening ? <MicOff className="h-4 w-4 text-white" /> : <Mic className="h-4 w-4 text-white" />}
            </button>
          )}
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); captureAndAnalyze(); } }}
            placeholder={isListening ? "Listening..." : "Ask Sky about what you see..."}
            className="flex-1 min-h-[38px] max-h-[72px] resize-none text-sm bg-transparent border-0 text-white placeholder:text-white/40 focus:outline-none py-2 px-0 leading-snug"
            rows={1} disabled={isAnalyzing || isListening} />
          <button onClick={() => captureAndAnalyze()} disabled={isAnalyzing || !!cameraError}
            className={cn("mb-1 w-12 h-12 rounded-full border-4 flex items-center justify-center flex-shrink-0 transition-all active:scale-95",
              isAnalyzing ? "border-orange-400 bg-orange-500" : "border-white bg-white/20 hover:bg-white/30 disabled:opacity-40")}>
            {isAnalyzing ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
          </button>
        </div>
        <p className="text-center text-[10px] text-white/35 mt-1.5">
          {hasVoiceInput ? "Hold mic to speak • Tap camera to capture" : "Type a question • Tap camera to capture"}
        </p>
      </div>
    </div>
  );
}
