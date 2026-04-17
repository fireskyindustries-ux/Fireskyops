import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Building2, Pencil, Check, X } from "lucide-react";

interface Branch {
  id: number;
  name: string;
  region: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
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

function BranchRow({ branch, onSaved }: { branch: Branch; onSaved: () => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: branch.name, region: branch.region || "", address: branch.address || "", phone: branch.phone || "", email: branch.email || "" });

  const save = async () => {
    try {
      await apiFetch(`/branches/${branch.id}`, { method: "PATCH", body: JSON.stringify(form) });
      toast({ title: "Branch updated" });
      onSaved();
      setEditing(false);
    } catch (err: any) {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    }
  };

  if (!editing) {
    return (
      <div className="flex items-start gap-3 px-4 py-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{branch.name}</p>
          <p className="text-xs text-muted-foreground">{[branch.region, branch.address].filter(Boolean).join(" — ") || "No location set"}</p>
          {(branch.phone || branch.email) && (
            <p className="text-xs text-muted-foreground mt-0.5">{[branch.phone, branch.email].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-3 bg-muted/30 border-y border-border">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Region</Label>
          <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="h-9 text-sm" placeholder="e.g. Western Cape" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Address</Label>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-9 text-sm" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Email</Label>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} className="h-8 px-4 text-xs"><Check className="h-3.5 w-3.5 mr-1" /> Save</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-8 px-4 text-xs"><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
      </div>
    </div>
  );
}

export default function AdminBranches() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", region: "", address: "", phone: "", email: "" });

  const { data: branches, isLoading } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiFetch("/branches"),
  });

  const createBranch = useMutation({
    mutationFn: () => apiFetch("/branches", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast({ title: "Branch created" });
      setForm({ name: "", region: "", address: "", phone: "", email: "" });
      setCreating(false);
    },
    onError: (err: any) => toast({ title: "Failed to create branch", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Branches</h1>
          <p className="text-muted-foreground">Manage your operational branches</p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Branch
          </Button>
        )}
      </div>

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> New Branch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Branch Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cape Town Branch" className="h-10" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Region</Label>
                <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="e.g. Western Cape" className="h-10" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-10" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-10" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={() => createBranch.mutate()} disabled={!form.name.trim() || createBranch.isPending} className="h-10 px-6">
                {createBranch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-4 w-4" /> Create Branch</>}
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)} className="h-10">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Branches</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : branches?.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No branches yet. Add your first branch above.</div>
          ) : (
            <div className="divide-y">
              {branches?.map((branch) => (
                <BranchRow
                  key={branch.id}
                  branch={branch}
                  onSaved={() => queryClient.invalidateQueries({ queryKey: ["branches"] })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
