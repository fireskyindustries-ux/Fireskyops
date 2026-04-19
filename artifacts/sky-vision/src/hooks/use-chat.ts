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
        // Clear streaming state — the cache already has the full content so
        // the streaming bubble disappears with no gap.
        setStreamState({ isStreaming: false, streamingMessage: "" });
        // Only refresh the sidebar list (to show auto-title updates etc.).
        // We deliberately do NOT refetch the individual conversation here because
        // the cache already has the correct content and a refetch would swap
        // local placeholder IDs for real DB IDs, causing React to re-render all
        // message bubbles (visible flicker). The real IDs arrive on next page load.
        queryClient.invalidateQueries({ queryKey: ["conversations"], exact: true });
      }
    },
    [queryClient, toast]
  );

  return { sendMessage, ...streamState };
}
