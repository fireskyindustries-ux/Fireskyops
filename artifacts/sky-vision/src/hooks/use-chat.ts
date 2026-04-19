import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Conversation } from "./use-conversations";

interface StreamState {
  isStreaming: boolean;
  streamingMessage: string;
}

export function useChat(conversationId: string | null) {
  const [streamState, setStreamState] = useState<StreamState>({
    isStreaming: false,
    streamingMessage: "",
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const conversationIdRef = useRef(conversationId);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

  const sendMessage = useCallback(
    async (message: string, overrideConversationId?: string) => {
      const id = overrideConversationId || conversationIdRef.current;
      if (!id) return;

      // Optimistically add user message immediately so it shows before the server responds
      const optimisticId = `opt-${Date.now()}`;
      queryClient.setQueryData(["conversations", id], (old: Conversation | undefined) => {
        if (!old) return old;
        return {
          ...old,
          messages: [
            ...(old.messages || []),
            {
              id: optimisticId,
              conversationId: id,
              role: "user" as const,
              content: message,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      });

      setStreamState({ isStreaming: true, streamingMessage: "" });

      try {
        const response = await fetch(`/api/sky-vision/conversations/${id}/chat`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });

        if (!response.ok) throw new Error("Failed to send message");

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                setStreamState((prev) => ({
                  ...prev,
                  streamingMessage: prev.streamingMessage + data.content,
                }));
              }
              if (data.title) {
                queryClient.invalidateQueries({ queryKey: ["conversations"] });
              }
              if (data.error) {
                toast({ title: "Error", description: data.error, variant: "destructive" });
              }
            } catch (e) {
              console.error("Failed to parse SSE line", line, e);
            }
          }
        }
      } catch {
        // Roll back the optimistic message on failure
        queryClient.setQueryData(["conversations", id], (old: Conversation | undefined) => {
          if (!old) return old;
          return {
            ...old,
            messages: (old.messages || []).filter((m) => m.id !== optimisticId),
          };
        });
        toast({
          title: "Error",
          description: "Failed to communicate with Sky.",
          variant: "destructive",
        });
      } finally {
        setStreamState({ isStreaming: false, streamingMessage: "" });
        // Sync final state from server (replaces optimistic message with real one)
        queryClient.invalidateQueries({ queryKey: ["conversations", id] });
      }
    },
    [queryClient, toast]
  );

  return { sendMessage, ...streamState };
}
