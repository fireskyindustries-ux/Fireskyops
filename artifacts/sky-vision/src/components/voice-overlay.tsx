import { X, Mic, MicOff, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceOverlayProps {
  isListening: boolean;
  isSpeaking: boolean;
  isTranscribing: boolean;
  lastTranscript: string;
  onMicToggle: () => void;
  onClose: () => void;
}

export function VoiceOverlay({
  isListening,
  isSpeaking,
  isTranscribing,
  lastTranscript,
  onMicToggle,
  onClose,
}: VoiceOverlayProps) {
  const status = isSpeaking
    ? "Sky is speaking…"
    : isTranscribing
    ? "Transcribing…"
    : isListening
    ? "Listening…"
    : "Tap the mic to speak";

  const orbColor = isSpeaking
    ? "bg-primary"
    : isListening
    ? "bg-rose-500"
    : "bg-white/20 hover:bg-white/30";

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-end pb-10 bg-black/65 backdrop-blur-sm">
      {/* Sky name at top */}
      <div className="absolute top-6 left-0 right-0 flex flex-col items-center gap-1 pointer-events-none">
        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
          <Volume2 className="h-5 w-5 text-primary-foreground" />
        </div>
        <p className="text-white font-semibold text-base mt-1">Sky Voice</p>
        <p className="text-white/60 text-xs">Female · Nova · Hands-free</p>
      </div>

      {/* Status + transcript */}
      <div className="flex flex-col items-center gap-3 mb-8 px-8">
        <p className={cn("text-sm font-medium transition-colors",
          isSpeaking ? "text-primary" : isListening ? "text-rose-400" : "text-white/60"
        )}>
          {status}
        </p>

        {lastTranscript && (
          <div className="bg-white/10 border border-white/10 rounded-2xl px-5 py-2.5 max-w-xs text-center">
            <p className="text-sm text-white/90 italic">"{lastTranscript}"</p>
          </div>
        )}
      </div>

      {/* Mic orb */}
      <button
        onClick={isSpeaking ? undefined : onMicToggle}
        disabled={isSpeaking || isTranscribing}
        className={cn(
          "relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl",
          orbColor,
          (isSpeaking || isTranscribing) && "cursor-default opacity-80"
        )}
        aria-label={isListening ? "Stop listening" : "Start listening"}
      >
        {/* Ripple rings */}
        {(isListening || isSpeaking) && (
          <>
            <span className={cn("absolute inset-0 rounded-full animate-ping opacity-25", isSpeaking ? "bg-primary" : "bg-rose-500")} />
            <span className={cn("absolute -inset-4 rounded-full animate-ping opacity-15 [animation-delay:0.4s]", isSpeaking ? "bg-primary" : "bg-rose-500")} />
            <span className={cn("absolute -inset-8 rounded-full animate-ping opacity-10 [animation-delay:0.8s]", isSpeaking ? "bg-primary" : "bg-rose-500")} />
          </>
        )}
        {isListening
          ? <MicOff className="h-9 w-9 text-white relative z-10" />
          : <Mic className="h-9 w-9 text-white relative z-10" />
        }
      </button>

      <p className="text-white/40 text-xs mt-4 mb-6">
        {isListening ? "Tap to stop" : "Tap to speak · auto-stops after silence"}
      </p>

      {/* Exit button */}
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-white/50 hover:text-white/80 text-sm transition-colors"
      >
        <X className="h-4 w-4" /> Exit voice mode
      </button>
    </div>
  );
}
