import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserCheck } from "lucide-react";
import { useUser } from "@clerk/react";

interface AppUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
}

function displayName(u: AppUser) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
  return name || u.email;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

interface AssignUserProps {
  resourceType: "inspections" | "jobs";
  resourceId: number;
  currentAssignedToId?: string | null;
  onAssigned?: () => void;
}

export function AssignUser({ resourceType, resourceId, currentAssignedToId, onAssigned }: AssignUserProps) {
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as string) || "guest";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users } = useQuery<AppUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/users"),
    enabled: role === "admin",
  });

  const fieldWorkers = users?.filter((u) => u.role === "user") ?? [];

  const assign = useMutation({
    mutationFn: (assignedToId: string | null) =>
      apiFetch(`/${resourceType}/${resourceId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ assignedToId }),
      }),
    onSuccess: () => {
      toast({ title: "Assigned successfully" });
      queryClient.invalidateQueries({ queryKey: [resourceType, resourceId] });
      queryClient.invalidateQueries({ queryKey: [resourceType] });
      onAssigned?.();
    },
    onError: (err: any) => {
      toast({ title: "Assignment failed", description: err.message, variant: "destructive" });
    },
  });

  if (role !== "admin") return null;

  const currentUser = users?.find((u) => u.id === currentAssignedToId);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <UserCheck className="h-4 w-4 text-primary" />
        Assigned To
      </div>
      <Select
        value={currentAssignedToId ?? "unassigned"}
        onValueChange={(val) => assign.mutate(val === "unassigned" ? null : val)}
        disabled={assign.isPending}
      >
        <SelectTrigger className="h-10">
          <SelectValue>
            {currentUser ? displayName(currentUser) : "Unassigned"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">
            <span className="text-muted-foreground">Unassigned</span>
          </SelectItem>
          {fieldWorkers.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {displayName(u)}
            </SelectItem>
          ))}
          {fieldWorkers.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No field workers yet</div>
          )}
        </SelectContent>
      </Select>
      {assign.isPending && (
        <p className="text-xs text-muted-foreground">Saving...</p>
      )}
    </div>
  );
}
