import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useUser } from "@clerk/react";

export type SkyContextType = "dashboard" | "customer" | "enquiry" | "inspection" | "job" | "general";

export interface SkyContextData {
  contextType: SkyContextType;
  contextData?: Record<string, unknown>;
  contextLabel?: string;
}

export interface SkyChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SkyState {
  isOpen: boolean;
  context: SkyContextData;
  messages: SkyChatMessage[];
  isStreaming: boolean;
}

interface SkyActions {
  openSky: (context?: Partial<SkyContextData>) => void;
  closeSky: () => void;
  setContext: (context: Partial<SkyContextData>) => void;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
}

const SkyStateContext = createContext<SkyState | null>(null);
const SkyActionsContext = createContext<SkyActions | null>(null);

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

function getApiUrl(path: string) {
  return `${BASE_URL}${path}`;
}

export function SkyProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContextState] = useState<SkyContextData>({ contextType: "general" });
  const [messages, setMessages] = useState<SkyChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const userName = user?.firstName || user?.fullName || user?.primaryEmailAddress?.emailAddress || undefined;

  const openSky = useCallback((ctx?: Partial<SkyContextData>) => {
    if (ctx) {
      setContextState((prev) => {
        const newCtx = { ...prev, ...ctx };
        if (JSON.stringify(newCtx) !== JSON.stringify(prev)) {
          setMessages([]);
        }
        return newCtx;
      });
    }
    setIsOpen(true);
  }, []);

  const closeSky = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setContext = useCallback((ctx: Partial<SkyContextData>) => {
    setContextState((prev) => ({ ...prev, ...ctx }));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      if (isStreaming) return;

      const userMsg: SkyChatMessage = { role: "user", content: message };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      const assistantMsg: SkyChatMessage = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMsg]);

      try {
        const response = await fetch(getApiUrl("/api/sky/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            contextType: context.contextType,
            contextData: context.contextData,
            history: messages.slice(-10),
            userName,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error("Sky is unavailable");
        }

        const reader = response.body.getReader();
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
              const parsed = JSON.parse(line.slice(6));
              if (parsed.content) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + parsed.content,
                    };
                  }
                  return updated;
                });
              }
              if (parsed.error) {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: parsed.error,
                  };
                  return updated;
                });
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: "Sky is unavailable right now. Please try again.",
          };
          return updated;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [context, isStreaming, messages]
  );

  const state: SkyState = { isOpen, context, messages, isStreaming };
  const actions: SkyActions = { openSky, closeSky, setContext, sendMessage, clearMessages };

  return (
    <SkyStateContext.Provider value={state}>
      <SkyActionsContext.Provider value={actions}>{children}</SkyActionsContext.Provider>
    </SkyStateContext.Provider>
  );
}

export function useSkyState() {
  const ctx = useContext(SkyStateContext);
  if (!ctx) throw new Error("useSkyState must be used inside SkyProvider");
  return ctx;
}

export function useSkyActions() {
  const ctx = useContext(SkyActionsContext);
  if (!ctx) throw new Error("useSkyActions must be used inside SkyProvider");
  return ctx;
}
