import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface UseVoiceOptions {
  onTranscript: (text: string) => void;
  autoLoop?: boolean;
}

export function useVoice({ onTranscript, autoLoop = false }: UseVoiceOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const autoLoopRef = useRef(autoLoop);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => { autoLoopRef.current = autoLoop; }, [autoLoop]);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

  const { toast } = useToast();

  const cancelSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    cancelSpeaking();
    if (!text?.trim()) return;

    setIsSpeaking(true);
    try {
      const res = await fetch("/api/sky-vision/tts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) throw new Error("TTS failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setIsSpeaking(false);
        if (autoLoopRef.current) {
          setTimeout(() => startListeningFn(), 600);
        }
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setIsSpeaking(false);
      };

      await audio.play();
    } catch {
      setIsSpeaking(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelSpeaking]);

  const stopListening = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    setIsListening(false);
  }, []);

  // Internal ref so speak's onended closure can call startListening without stale closure
  const stopListeningRef = useRef(stopListening);
  useEffect(() => { stopListeningRef.current = stopListening; }, [stopListening]);

  const startListeningFn = useCallback(async () => {
    cancelSpeaking();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Silence detection
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.fftSize);
      let lastSoundTime = Date.now();
      const SILENCE_THRESHOLD = 12;
      const SILENCE_DURATION = 2200;
      let soundDetectedOnce = false;

      const checkSilence = () => {
        analyser.getByteTimeDomainData(data);
        const amplitude = Math.max(...Array.from(data).map((v) => Math.abs(v - 128)));
        if (amplitude > SILENCE_THRESHOLD) {
          soundDetectedOnce = true;
          lastSoundTime = Date.now();
        }
        if (soundDetectedOnce && Date.now() - lastSoundTime > SILENCE_DURATION) {
          stopListeningRef.current();
          audioCtx.close();
          return;
        }
        animFrameRef.current = requestAnimationFrame(checkSilence);
      };
      animFrameRef.current = requestAnimationFrame(checkSilence);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());

        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        if (audioBlob.size < 2000) return;

        setIsTranscribing(true);
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);

          const res = await fetch("/api/sky-vision/transcribe", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64: base64, mimeType: mimeType.split(";")[0] }),
          });
          if (!res.ok) throw new Error("Transcription failed");
          const { text } = await res.json();
          if (text?.trim()) onTranscriptRef.current(text.trim());
        } catch {
          toast({ title: "Couldn't hear that", description: "Please try again.", variant: "destructive" });
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsListening(true);
    } catch {
      toast({
        title: "Microphone access denied",
        description: "Allow microphone access to use voice mode.",
        variant: "destructive",
      });
    }
  }, [cancelSpeaking, toast]);

  const startListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListeningFn();
    }
  }, [isListening, stopListening, startListeningFn]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      cancelSpeaking();
    };
  }, [cancelSpeaking]);

  return { isListening, isSpeaking, isTranscribing, startListening, stopListening, speak, cancelSpeaking };
}
