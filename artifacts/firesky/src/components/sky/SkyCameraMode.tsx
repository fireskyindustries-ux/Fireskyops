import { useRef, useEffect, useState, useCallback } from "react";
import { X, Camera, Loader2, Sparkles, Zap, ZapOff, FlipHorizontal } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SkyCameraModeProps {
  onClose: () => void;
}

export function SkyCameraMode({ onClose }: SkyCameraModeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setCameraError("Camera permission denied. Please allow camera access in your browser settings and try again.");
      } else {
        setCameraError("Could not access the camera. Please check your device settings.");
      }
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const flipCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  };

  const captureAndAnalyze = useCallback(async (customQuestion?: string) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || isAnalyzing || video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const base64 = dataUrl.split(",")[1];

    setIsAnalyzing(true);
    setResponse("");

    try {
      const res = await fetch(`${BASE}/api/sky/vision`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: "image/jpeg",
          question: customQuestion || question || undefined,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
            if (data.content) setResponse((prev) => prev + data.content);
            if (data.error) setResponse(data.error);
          } catch {}
        }
      }
    } catch {
      setResponse("Sky could not analyse the image. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, question]);

  useEffect(() => {
    if (autoMode) {
      autoIntervalRef.current = setInterval(() => {
        captureAndAnalyze();
      }, 6000);
    } else {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
    }
    return () => {
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
    };
  }, [autoMode, captureAndAnalyze]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      captureAndAnalyze();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col overflow-hidden">
      <canvas ref={canvasRef} className="hidden" />

      {/* Live camera feed */}
      {!cameraError && (
        <video
          ref={videoRef}
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="text-center text-white">
            <Camera className="h-14 w-14 mx-auto mb-4 opacity-40" />
            <p className="text-sm text-white/70 leading-relaxed">{cameraError}</p>
          </div>
        </div>
      )}

      {/* Scanning frame overlay */}
      {!cameraError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 relative opacity-30">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-orange-400 rounded-tl-sm" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-orange-400 rounded-tr-sm" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-orange-400 rounded-bl-sm" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-orange-400 rounded-br-sm" />
          </div>
        </div>
      )}

      {/* Top bar */}
      <div
        className="relative z-10 flex items-center justify-between px-4 py-3"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)" }}
      >
        <div className="flex items-center gap-2 text-white">
          <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-white leading-none">Sky Vision</p>
            <p className="text-[10px] text-white/60 leading-none mt-0.5">Point camera at a site, tank, or installation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={flipCamera}
            className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white"
            title="Flip camera"
          >
            <FlipHorizontal className="h-4 w-4" />
          </button>
          <button
            onClick={() => setAutoMode((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-semibold transition-colors",
              autoMode ? "bg-orange-500 text-white" : "bg-black/40 text-white"
            )}
          >
            {autoMode ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
            {autoMode ? "Auto On" : "Auto"}
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Spacer pushes bottom content down */}
      <div className="flex-1" />

      {/* Sky response HUD */}
      {(response || isAnalyzing) && (
        <div
          className="relative z-10 mx-3 mb-3 rounded-2xl p-4"
          style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(14px)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs font-semibold text-orange-400">Sky</span>
            {isAnalyzing && <Loader2 className="h-3 w-3 text-white/50 animate-spin ml-auto" />}
          </div>
          <p className="text-sm text-white leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
            {isAnalyzing && !response ? (
              <span className="text-white/50 italic">Analysing what I see...</span>
            ) : (
              response
            )}
          </p>
        </div>
      )}

      {/* Capture button + input */}
      <div
        className="relative z-10 px-3 pb-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div
          className="flex gap-2 items-end rounded-2xl px-3 py-2"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(14px)" }}
        >
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Sky about what you see..."
            className="min-h-[38px] max-h-[80px] resize-none text-sm bg-transparent border-0 text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 py-2 px-0"
            rows={1}
            disabled={isAnalyzing}
          />
          <button
            onClick={() => captureAndAnalyze()}
            disabled={isAnalyzing || !!cameraError}
            className={cn(
              "mb-1 w-12 h-12 rounded-full border-4 flex items-center justify-center flex-shrink-0 transition-all active:scale-95",
              isAnalyzing
                ? "border-orange-400 bg-orange-500"
                : "border-white bg-white/20 hover:bg-white/30 disabled:opacity-40"
            )}
            title="Capture and analyse"
          >
            {isAnalyzing ? (
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            ) : (
              <Camera className="h-5 w-5 text-white" />
            )}
          </button>
        </div>
        <p className="text-center text-[10px] text-white/40 mt-2">
          Tap the camera button to capture a frame and ask Sky
        </p>
      </div>
    </div>
  );
}
