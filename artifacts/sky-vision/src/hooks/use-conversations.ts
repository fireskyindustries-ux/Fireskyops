import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  imagePreview?: string;  // in-memory: attached image shown in the bubble
  resultImage?: string;   // in-memory: AI-edited image returned in the bubble
  fileName?: string;      // in-memory: attached document filename badge
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: () => apiFetch("/api/sky-vision/conversations"),
  });
}

export function useConversation(id: string | null) {
  return useQuery<Conversation>({
    queryKey: ["conversations", id],
    queryFn: () => {
      if (!id) throw new Error("No id");
      return apiFetch(`/api/sky-vision/conversations/${id}`);
    },
    enabled: !!id,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (title?: string) => {
      return apiFetch("/api/sky-vision/conversations", {
        method: "POST",
        body: JSON.stringify({ title }),
      }) as Promise<Conversation>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      return apiFetch(`/api/sky-vision/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }) as Promise<Conversation>;
    },
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(["conversations"], (old: Conversation[] | undefined) => {
        if (!old) return old;
        return old.map((c) => (c.id === id ? { ...c, title: data.title } : c));
      });
      queryClient.invalidateQueries({ queryKey: ["conversations", id] });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sky-vision/conversations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete conversation");
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.removeQueries({ queryKey: ["conversations", id] });
    },
  });
}
