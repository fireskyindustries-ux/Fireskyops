import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

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
      const conversationId = overrideConversationId || conversationIdRef.current;
      if (!conversationId) return;

      setStreamState({ isStreaming: true, streamingMessage: "" });

      try {
        const response = await fetch(`/api/sky-vision/conversations/${conversationId}/chat`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

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
        toast({
          title: "Error",
          description: "Failed to communicate with Sky.",
          variant: "destructive",
        });
      } finally {
        setStreamState({ isStreaming: false, streamingMessage: "" });
        queryClient.invalidateQueries({ queryKey: ["conversations", conversationId] });
      }
    },
    [queryClient, toast]
  );

  return { sendMessage, ...streamState };
}
