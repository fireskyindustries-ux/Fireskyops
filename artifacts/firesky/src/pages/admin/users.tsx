import { useState, useMemo } from "react";
import { brand } from "@/brand.config";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Shield, User, Building2, MessageCircle, BookUser, Search } from "lucide-react";

interface Branch { id: number; name: string; }
interface AppUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  imageUrl: string | null;
  role: string;
  branchId: number | null;
  createdAt: number;
  lastSignInAt: number | null;
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

function initials(u: AppUser) {
  const f = u.firstName?.[0] || "";
  const l = u.lastName?.[0] || "";
  return (f + l).toUpperCase() || u.email[0].toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Super Admin",
  branch_admin: "Branch Admin",
  user: "Field Worker",
  field_worker: "Field Worker",
  guest: "Guest",
};

interface Customer { id: number; name: string; phone: string | null; whatsapp: string | null; }

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["customers-for-invite"],
    queryFn: () => apiFetch("/customers"),
    enabled: showPicker,
  });

  const pickerResults = useMemo(() => {
    if (!customers) return [];
    const q = pickerSearch.toLowerCase();
    return customers
      .filter((c) => (c.phone || c.whatsapp) && (!q || c.name.toLowerCase().includes(q)))
      .slice(0, 50);
  }, [customers, pickerSearch]);

  async function openContactPicker() {
    if ("contacts" in navigator && "ContactsManager" in window) {
      try {
        const contacts = await (navigator as any).contacts.select(["tel", "name"], { multiple: false });
        if (contacts?.[0]?.tel?.[0]) {
          setInvitePhone(contacts[0].tel[0]);
          return;
        }
      } catch {
        // user dismissed or API unavailable — fall through to customer picker
      }
    }
    setPickerSearch("");
    setShowPicker(true);
  }

  function pickCustomer(c: Customer) {
    const num = c.whatsapp || c.phone || "";
    setInvitePhone(num);
    setShowPicker(false);
  }

  const { data: users, isLoading } = useQuery<AppUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/users"),
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiFetch("/branches"),
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiFetch(`/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Role updated" });
    },
    onError: (err: any) => toast({ title: "Failed to update role", description: err.message, variant: "destructive" }),
  });

  const updateBranch = useMutation({
    mutationFn: ({ userId, branchId }: { userId: string; branchId: number | null }) =>
      apiFetch(`/users/${userId}/branch`, { method: "PATCH", body: JSON.stringify({ branchId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Branch updated" });
    },
    onError: (err: any) => toast({ title: "Failed to update branch", description: err.message, variant: "destructive" }),
  });

  const deleteUser = useMutation({
    mutationFn: (userId: string) => apiFetch(`/users/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User removed" });
    },
    onError: (err: any) => toast({ title: "Failed to remove user", description: err.message, variant: "destructive" }),
  });

  const handleWhatsAppInvite = () => {
    const raw = invitePhone.trim().replace(/[\s\-()]/g, "");
    if (!raw) return;
    // Normalise to international format — strip leading 0 and prepend +27 if local SA number
    const number = raw.startsWith("+")
      ? raw.replace("+", "")
      : raw.startsWith("0")
      ? `27${raw.slice(1)}`
      : raw;
    const roleLabel =
      inviteRole === "branch_admin" ? "Branch Admin" : "Field Worker";
    const appUrl = window.location.origin;
    const message = encodeURIComponent(
      `Hi! You've been invited to join ${brand.name} Field Ops as a ${roleLabel}.\n\nOpen the link below and sign in with your Google account to get started:\n${appUrl}`
    );
    window.open(`https://wa.me/${number}?text=${message}`, "_blank");
  };

  const branchName = (id: number | null) => branches?.find((b) => b.id === id)?.name ?? null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">Manage who has access to {brand.shortName} Field Ops</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-[#25D366]" /> Invite via WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Phone number</Label>
              <div className="flex gap-2">
                <Input
                  type="tel"
                  placeholder="083 123 4567 or +27 83 123 4567"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  className="h-11 flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleWhatsAppInvite()}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={openContactPicker}
                  title="Pick from contacts"
                >
                  <BookUser className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="h-11 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Field Worker</SelectItem>
                  <SelectItem value="branch_admin">Branch Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground invisible">Send</Label>
              <Button
                onClick={handleWhatsAppInvite}
                disabled={!invitePhone.trim()}
                className="h-11 px-6 bg-[#25D366] hover:bg-[#1ebe5d] text-white"
              >
                <MessageCircle className="mr-2 h-4 w-4" /> Send on WhatsApp
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Tap <BookUser className="inline h-3 w-3 mx-0.5 relative -top-px" /> to choose from your device contacts (Android) or pick from existing customers. South African numbers (083…, 072…, etc.) are handled automatically.
          </p>
        </CardContent>

        {/* Customer picker dialog */}
        <Dialog open={showPicker} onOpenChange={setShowPicker}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookUser className="h-4 w-4 text-primary" /> Pick a Contact
              </DialogTitle>
            </DialogHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search customers…"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="pl-9 h-10"
                autoFocus
              />
            </div>
            <ScrollArea className="max-h-72 -mx-1">
              {!customers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : pickerResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {pickerSearch ? "No customers match your search." : "No customers with phone numbers found."}
                </p>
              ) : (
                <div className="space-y-0.5 px-1">
                  {pickerResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => pickCustomer(c)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">{c.name[0]?.toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.whatsapp || c.phone}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y">
              {users?.map((user) => (
                <div key={user.id} className="px-4 sm:px-6 py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {user.imageUrl ? (
                        <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-primary">{initials(user)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      {user.branchId && (
                        <p className="text-xs text-primary mt-0.5 flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {branchName(user.branchId) ?? `Branch #${user.branchId}`}
                        </p>
                      )}
                    </div>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-xs hidden sm:flex">
                      {user.role === "admin" ? <Shield className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                      {ROLE_LABELS[user.role] ?? user.role}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => {
                        if (confirm(`Remove ${user.email}?`)) deleteUser.mutate(user.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 pl-[52px] sm:pl-[52px]">
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Role</p>
                      <Select value={user.role} onValueChange={(role) => updateRole.mutate({ userId: user.id, role })}>
                        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Field Worker</SelectItem>
                          <SelectItem value="branch_admin">Branch Admin</SelectItem>
                          <SelectItem value="admin">Super Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {branches && branches.length > 0 && (
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Branch</p>
                        <Select
                          value={user.branchId ? String(user.branchId) : "none"}
                          onValueChange={(v) => updateBranch.mutate({ userId: user.id, branchId: v === "none" ? null : Number(v) })}
                        >
                          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="No branch" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No branch</SelectItem>
                            {branches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {users?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">No users yet</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
