import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Conversation } from "./use-conversations";

interface StreamState {
  isStreaming: boolean;
  streamingMessage: string;
  activeModel: string | null;
  lastCompletedResponse: string;
}

export interface ImageAttachment {
  base64: string;
  mimeType: string;
  dataUrl?: string; // in-memory preview URL for the chat bubble
}

export function useChat(conversationId: string | null) {
  const [streamState, setStreamState] = useState<StreamState>({
    isStreaming: false,
    streamingMessage: "",
    activeModel: null,
    lastCompletedResponse: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const conversationIdRef = useRef(conversationId);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

  const sendMessage = useCallback(
    async (message: string, overrideConversationId?: string, image?: ImageAttachment, modelMode = "auto") => {
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
              imagePreview: image?.dataUrl,
            },
          ],
        };
      });

      setStreamState((prev) => ({ ...prev, isStreaming: true, streamingMessage: "", activeModel: null }));

      let fullResponse = "";
      let resolvedModel: string | null = null;

      try {
        const response = await fetch(`/api/sky-vision/conversations/${id}/chat`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            imageBase64: image?.base64,
            mimeType: image?.mimeType,
            modelMode,
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
              if (data.model) {
                resolvedModel = data.model;
                setStreamState((prev) => ({ ...prev, activeModel: data.model }));
              }
              if (data.title) {
                // Update the title in the conversation cache immediately
                queryClient.setQueryData(["conversations", id], (old: Conversation | undefined) => {
                  if (!old) return old;
                  return { ...old, title: data.title };
                });
                // Also update the conversations list cache
                queryClient.setQueryData(["conversations"], (old: Conversation[] | undefined) => {
                  if (!old) return old;
                  return old.map((c) => c.id === id ? { ...c, title: data.title } : c);
                });
              }
              if (data.error) {
                toast({ title: "Error", description: data.error, variant: "destructive" });
              }
            } catch (e) {
              console.error("Failed to parse SSE line", line, e);
            }
          }
        }

        if (fullResponse) {
          queryClient.setQueryData(["conversations", id], (old: Conversation | undefined) => {
            if (!old) return old;
            const withoutOptimistic = (old.messages || []).filter((m) => m.id !== optimisticId);
            const now = new Date().toISOString();
            return {
              ...old,
              messages: [
                ...withoutOptimistic,
                { id: `local-user-${Date.now()}`, conversationId: id, role: "user" as const, content: message, createdAt: now, imagePreview: image?.dataUrl },
                { id: `local-ai-${Date.now()}`, conversationId: id, role: "assistant" as const, content: fullResponse, createdAt: now },
              ],
            };
          });
        }
      } catch {
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
        setStreamState((prev) => ({
          ...prev,
          isStreaming: false,
          streamingMessage: "",
          activeModel: resolvedModel,
          lastCompletedResponse: fullResponse || prev.lastCompletedResponse,
        }));
        queryClient.invalidateQueries({ queryKey: ["conversations"], exact: true });
      }
    },
    [queryClient, toast]
  );

  const editImage = useCallback(
    async (prompt: string, conversationId: string, image: ImageAttachment) => {
      const id = conversationId;
      if (!id || isEditing) return;

      setIsEditing(true);

      // Add user message optimistically
      const optimisticUserId = `opt-edit-user-${Date.now()}`;
      const optimisticAiId = `opt-edit-ai-${Date.now()}`;

      queryClient.setQueryData(["conversations", id], (old: Conversation | undefined) => {
        if (!old) return old;
        return {
          ...old,
          messages: [
            ...(old.messages || []),
            {
              id: optimisticUserId,
              conversationId: id,
              role: "user" as const,
              content: prompt || "Edit this image",
              createdAt: new Date().toISOString(),
              imagePreview: image.dataUrl,
            },
            {
              id: optimisticAiId,
              conversationId: id,
              role: "assistant" as const,
              content: "Editing your image...",
              createdAt: new Date().toISOString(),
            },
          ],
        };
      });

      try {
        const res = await fetch("/api/sky-vision/edit-image", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: image.base64, mimeType: image.mimeType, prompt: prompt || "Edit this image" }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Edit failed");
        }

        const { imageBase64: resultB64, mimeType: resultMime } = await res.json();
        const resultDataUrl = `data:${resultMime};base64,${resultB64}`;

        // Replace optimistic AI message with the real result
        queryClient.setQueryData(["conversations", id], (old: Conversation | undefined) => {
          if (!old) return old;
          return {
            ...old,
            messages: (old.messages || []).map((m) =>
              m.id === optimisticAiId
                ? { ...m, content: "Here's your edited image:", resultImage: resultDataUrl }
                : m
            ),
          };
        });
      } catch (err: any) {
        // Remove optimistic messages and show error
        queryClient.setQueryData(["conversations", id], (old: Conversation | undefined) => {
          if (!old) return old;
          return {
            ...old,
            messages: (old.messages || []).filter(
              (m) => m.id !== optimisticUserId && m.id !== optimisticAiId
            ),
          };
        });
        toast({ title: "Edit failed", description: err.message, variant: "destructive" });
      } finally {
        setIsEditing(false);
      }
    },
    [queryClient, toast, isEditing]
  );

  const generateImage = useCallback(
    async (prompt: string, conversationId: string) => {
      const id = conversationId;
      if (!id || isGenerating) return;

      setIsGenerating(true);

      const optimisticUserId = `opt-gen-user-${Date.now()}`;
      const optimisticAiId = `opt-gen-ai-${Date.now()}`;

      queryClient.setQueryData(["conversations", id], (old: Conversation | undefined) => {
        if (!old) return old;
        return {
          ...old,
          messages: [
            ...(old.messages || []),
            { id: optimisticUserId, conversationId: id, role: "user" as const, content: prompt, createdAt: new Date().toISOString() },
            { id: optimisticAiId, conversationId: id, role: "assistant" as const, content: "Creating your image...", createdAt: new Date().toISOString() },
          ],
        };
      });

      try {
        const res = await fetch("/api/sky-vision/generate-image", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Generation failed");
        }

        const { imageBase64, mimeType, revisedPrompt } = await res.json();
        const resultDataUrl = `data:${mimeType};base64,${imageBase64}`;

        queryClient.setQueryData(["conversations", id], (old: Conversation | undefined) => {
          if (!old) return old;
          return {
            ...old,
            messages: (old.messages || []).map((m) =>
              m.id === optimisticAiId
                ? { ...m, content: revisedPrompt || "Here's your image:", resultImage: resultDataUrl }
                : m
            ),
          };
        });
      } catch (err: any) {
        queryClient.setQueryData(["conversations", id], (old: Conversation | undefined) => {
          if (!old) return old;
          return { ...old, messages: (old.messages || []).filter((m) => m.id !== optimisticUserId && m.id !== optimisticAiId) };
        });
        toast({ title: "Generation failed", description: err.message, variant: "destructive" });
      } finally {
        setIsGenerating(false);
      }
    },
    [queryClient, toast, isGenerating]
  );

  return { sendMessage, editImage, generateImage, isEditing, isGenerating, ...streamState };
}
