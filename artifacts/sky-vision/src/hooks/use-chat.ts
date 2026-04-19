import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Conversation } from "./use-conversations";

interface StreamState {
  isStreaming: boolean;
  streamingMessage: string;
}

export interface ImageAttachment {
  base64: string;
  mimeType: string;
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
    async (message: string, overrideConversationId?: string, image?: ImageAttachment) => {
      const id = overrideConversationId || conversationIdRef.current;
      if (!id) return;

      const optimisticId = `opt-${Date.now()}`;

      // Optimistically insert user message so it shows immediately
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

      let fullResponse = "";

      try {
        const response = await fetch(`/api/sky-vision/conversations/${id}/chat`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            imageBase64: image?.base64,
            mimeType: image?.mimeType,
          }),
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
                fullResponse += data.content;
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

        // Streaming done — write both messages directly into the cache so there
        // is no gap between the streaming bubble disappearing and the server
        // refetch completing. The background invalidation below will eventually
        // replace these with the real server IDs, but the content is identical.
        if (fullResponse) {
          queryClient.setQueryData(["conversations", id], (old: Conversation | undefined) => {
            if (!old) return old;
            const withoutOptimistic = (old.messages || []).filter((m) => m.id !== optimisticId);
            const now = new Date().toISOString();
            return {
              ...old,
              messages: [
                ...withoutOptimistic,
                { id: `local-user-${Date.now()}`, conversationId: id, role: "user" as const, content: message, createdAt: now },
                { id: `local-ai-${Date.now()}`, conversationId: id, role: "assistant" as const, content: fullResponse, createdAt: now },
              ],
            };
          });
        }
      } catch {
        // Roll back optimistic message on failure
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
        // Clear streaming state first so the streaming bubble disappears only
        // after the cache already has the real content above.
        setStreamState({ isStreaming: false, streamingMessage: "" });
        // Background sync with server — replaces the local IDs with real DB IDs.
        // Since the cache already has the correct content this refetch is invisible.
        queryClient.invalidateQueries({ queryKey: ["conversations", id] });
      }
    },
    [queryClient, toast]
  );

  return { sendMessage, ...streamState };
}
