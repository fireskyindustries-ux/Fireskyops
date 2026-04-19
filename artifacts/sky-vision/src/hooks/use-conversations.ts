import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

async function authFetch(url: string, getToken: () => Promise<string | null>, options: RequestInit = {}) {
  const token = await getToken();
  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export function useConversations() {
  const { getToken } = useAuth();
  return useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await authFetch("/api/sky-vision/conversations", getToken);
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
  });
}

export function useConversation(id: string | null) {
  const { getToken } = useAuth();
  return useQuery<Conversation>({
    queryKey: ["conversations", id],
    queryFn: async () => {
      if (!id) throw new Error("No id");
      const res = await authFetch(`/api/sky-vision/conversations/${id}`, getToken);
      if (!res.ok) throw new Error("Failed to fetch conversation");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateConversation() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (title?: string) => {
      const res = await authFetch("/api/sky-vision/conversations", getToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return res.json() as Promise<Conversation>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useUpdateConversation() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const res = await authFetch(`/api/sky-vision/conversations/${id}`, getToken, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to update conversation");
      return res.json() as Promise<Conversation>;
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
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/sky-vision/conversations/${id}`, getToken, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete conversation");
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.removeQueries({ queryKey: ["conversations", id] });
    },
  });
}
