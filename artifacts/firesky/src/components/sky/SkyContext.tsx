import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
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
  systemSnapshot: Record<string, unknown> | null;
  snapshotLoading: boolean;
}

interface SkyActions {
  openSky: (context?: Partial<SkyContextData>) => void;
  closeSky: () => void;
  setContext: (context: Partial<SkyContextData>) => void;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  refreshSnapshot: () => void;
}

const SkyStateContext = createContext<SkyState | null>(null);
const SkyActionsContext = createContext<SkyActions | null>(null);

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

function getApiUrl(path: string) {
  return `${BASE_URL}${path}`;
}

const MAX_STORED_MESSAGES = 60;
const MAX_HISTORY_SENT = 30;

function adminStorageKey(userId: string) {
  return `sky-conversation-${userId}`;
}

async function fetchSystemSnapshot(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(getApiUrl("/api/sky/context"), { credentials: "include" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function SkyProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const role = ((user?.publicMetadata?.role as string) || "guest") as "admin" | "user" | "guest";
  const isAdmin = role === "admin";
  const userId = user?.id ?? null;

  const [isOpen, setIsOpen] = useState(false);
  const [context, setContextState] = useState<SkyContextData>({ contextType: "general" });
  const [messages, setMessages] = useState<SkyChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [systemSnapshot, setSystemSnapshot] = useState<Record<string, unknown> | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const userName = user?.firstName || user?.fullName || user?.primaryEmailAddress?.emailAddress || undefined;

  // Load persisted conversation for admin after mount
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!isAdmin || !userId || loadedRef.current) return;
    loadedRef.current = true;
    try {
      const raw = localStorage.getItem(adminStorageKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages);
        }
      }
    } catch {
      // ignore corrupt storage
    }
  }, [isAdmin, userId]);

  // Persist conversation to localStorage whenever messages change (admin only)
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (!isAdmin || !userId) return;
    try {
      localStorage.setItem(
        adminStorageKey(userId),
        JSON.stringify({ messages: messages.slice(-MAX_STORED_MESSAGES), savedAt: new Date().toISOString() })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [messages, isAdmin, userId]);

  // Fetch system snapshot for admins
  const refreshSnapshot = useCallback(() => {
    if (!isAdmin) return;
    setSnapshotLoading(true);
    fetchSystemSnapshot()
      .then((snap) => {
        if (snap) setSystemSnapshot(snap);
      })
      .finally(() => setSnapshotLoading(false));
  }, [isAdmin]);

  // Fetch on mount (admin only), and refresh every 5 minutes
  useEffect(() => {
    if (!isAdmin) return;
    refreshSnapshot();
    const interval = setInterval(refreshSnapshot, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAdmin, refreshSnapshot]);

  // Also refresh snapshot when Sky is opened
  useEffect(() => {
    if (isOpen && isAdmin) {
      refreshSnapshot();
    }
  }, [isOpen, isAdmin, refreshSnapshot]);

  const openSky = useCallback((ctx?: Partial<SkyContextData>) => {
    if (ctx) {
      setContextState((prev) => ({ ...prev, ...ctx }));
      setMessages([]);
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
    if (isAdmin && userId) {
      try {
        localStorage.removeItem(adminStorageKey(userId));
      } catch {}
    }
  }, [isAdmin, userId]);

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
            history: messages.slice(-MAX_HISTORY_SENT),
            userName,
            userRole: role,
            // For admins, pass the live system snapshot
            systemSnapshot: isAdmin ? systemSnapshot : undefined,
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
                    updated[updated.length - 1] = { ...last, content: last.content + parsed.content };
                  }
                  return updated;
                });
              }
              if (parsed.error) {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...updated[updated.length - 1], content: parsed.error };
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
    [context, isStreaming, messages, userName, role, isAdmin, systemSnapshot]
  );

  const state: SkyState = { isOpen, context, messages, isStreaming, systemSnapshot, snapshotLoading };
  const actions: SkyActions = { openSky, closeSky, setContext, sendMessage, clearMessages, refreshSnapshot };

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
