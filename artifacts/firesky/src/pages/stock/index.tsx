import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, ArrowUpCircle, ArrowDownCircle, Settings2, History, Plus, List } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface Branch { id: number; name: string; region: string | null; }
interface StockItem { id: number; name: string; unit: string; category: string | null; }
interface StockLevel {
  id: number; branchId: number; stockItemId: number; quantity: number;
  itemName: string; itemUnit: string; itemCategory: string | null; itemDescription: string | null;
  updatedAt: string;
}
interface StockMovement {
  id: number; type: string; quantity: number; note: string | null;
  itemName: string; itemUnit: string; createdAt: string; userId: string | null;
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

function MovementBadge({ type }: { type: string }) {
  if (type === "in") return <Badge className="bg-green-100 text-green-800 border-0 text-xs gap-1"><ArrowUpCircle className="h-3 w-3" /> Stock In</Badge>;
  if (type === "out") return <Badge className="bg-red-100 text-red-800 border-0 text-xs gap-1"><ArrowDownCircle className="h-3 w-3" /> Stock Out</Badge>;
  return <Badge variant="secondary" className="text-xs gap-1"><Settings2 className="h-3 w-3" /> Adjustment</Badge>;
}

function RecordMovement({ branchId, items, onDone }: { branchId: number; items: StockItem[]; onDone: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ stockItemId: "", type: "in", quantity: "", note: "" });

  const move = useMutation({
    mutationFn: () => apiFetch("/stock/movements", {
      method: "POST",
      body: JSON.stringify({ branchId, stockItemId: Number(form.stockItemId), type: form.type, quantity: Number(form.quantity), note: form.note || undefined }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-levels", branchId] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements", branchId] });
      toast({ title: "Stock recorded" });
      setForm({ stockItemId: "", type: "in", quantity: "", note: "" });
      onDone();
    },
    onError: (err: any) => toast({ title: "Failed to record", description: err.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" /> Record Stock Movement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Item *</Label>
            <Select value={form.stockItemId} onValueChange={(v) => setForm({ ...form, stockItemId: v })}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Select item" /></SelectTrigger>
              <SelectContent>
                {items.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type *</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Stock In</SelectItem>
                <SelectItem value="out">Stock Out</SelectItem>
                <SelectItem value="adjustment">Set / Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quantity *</Label>
            <Input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="h-10" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Note</Label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional" className="h-10" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button onClick={() => move.mutate()} disabled={!form.stockItemId || !form.quantity || move.isPending} className="h-10 px-6">
            {move.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Movement"}
          </Button>
          <Button variant="ghost" onClick={onDone} className="h-10">Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BranchStock({ branch, isAdmin }: { branch: Branch; isAdmin: boolean }) {
  const [showMovement, setShowMovement] = useState(false);

  const { data: levels, isLoading } = useQuery<StockLevel[]>({
    queryKey: ["stock-levels", branch.id],
    queryFn: () => apiFetch(`/stock/levels/${branch.id}`),
  });

  const { data: movements } = useQuery<StockMovement[]>({
    queryKey: ["stock-movements", branch.id],
    queryFn: () => apiFetch(`/stock/movements/${branch.id}`),
  });

  const { data: items } = useQuery<StockItem[]>({
    queryKey: ["stock-items"],
    queryFn: () => apiFetch("/stock/items"),
    enabled: showMovement,
  });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const grouped = (levels || []).reduce((acc: Record<string, StockLevel[]>, l) => {
    const cat = l.itemCategory || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(l);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          {!showMovement ? (
            <Button onClick={() => setShowMovement(true)} size="sm" className="h-9">
              <Plus className="mr-2 h-4 w-4" /> Record Movement
            </Button>
          ) : null}
        </div>
      )}

      {showMovement && items && (
        <RecordMovement branchId={branch.id} items={items} onDone={() => setShowMovement(false)} />
      )}

      <Tabs defaultValue="levels">
        <TabsList>
          <TabsTrigger value="levels" className="gap-2"><Package className="h-4 w-4" /> Stock Levels</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> Movement History</TabsTrigger>
        </TabsList>

        <TabsContent value="levels" className="mt-4">
          {Object.keys(grouped).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">No stock recorded yet</p>
                <p className="text-xs text-muted-foreground mt-1">Record a stock movement to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([category, items]) => (
                <Card key={category}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">{category}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {items.map((level) => (
                        <div key={level.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">{level.itemName}</p>
                            {level.itemDescription && <p className="text-xs text-muted-foreground">{level.itemDescription}</p>}
                          </div>
                          <div className="text-right">
                            <p className={`text-xl font-bold ${level.quantity === 0 ? "text-destructive" : level.quantity <= 2 ? "text-orange-500" : "text-primary"}`}>
                              {level.quantity}
                            </p>
                            <p className="text-xs text-muted-foreground">{level.itemUnit}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {!movements || movements.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">No movement history yet.</div>
              ) : (
                <div className="divide-y">
                  {movements.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <MovementBadge type={m.type} />
                          <span className="text-sm font-medium">{m.itemName}</span>
                        </div>
                        {m.note && <p className="text-xs text-muted-foreground mt-0.5">{m.note}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">{new Date(m.createdAt).toLocaleString("en-ZA")}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-lg font-bold ${m.type === "out" ? "text-red-600" : "text-green-600"}`}>
                          {m.type === "out" ? "-" : "+"}{m.quantity}
                        </p>
                        <p className="text-xs text-muted-foreground">{m.itemUnit}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CataloguePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", unit: "units", category: "" });

  const { data: items, isLoading } = useQuery<StockItem[]>({
    queryKey: ["stock-items"],
    queryFn: () => apiFetch("/stock/items"),
  });

  const createItem = useMutation({
    mutationFn: () => apiFetch("/stock/items", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      toast({ title: "Stock item created" });
      setForm({ name: "", description: "", unit: "units", category: "" });
      setCreating(false);
    },
    onError: (err: any) => toast({ title: "Failed to create item", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Item
          </Button>
        )}
      </div>

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> New Stock Item
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 5000L Tank" className="h-10" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Tanks, Fittings" className="h-10" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="units / m / kg" className="h-10" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="resize-none text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createItem.mutate()} disabled={!form.name.trim() || createItem.isPending} className="h-10 px-6">
                {createItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Item"}
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)} className="h-10">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !items || items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No items in the catalogue yet</p>
              <p className="text-xs mt-1">Add stock items above to start tracking inventory.</p>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{[item.category, `per ${item.unit}`].filter(Boolean).join(" · ")}</p>
                  </div>
                  {item.category && <Badge variant="secondary" className="text-xs shrink-0">{item.category}</Badge>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function StockPage() {
  const { user, isLoaded: clerkLoaded } = useUser();
  const role = (user?.publicMetadata?.role as string) || "guest";
  const isAdmin = role === "admin" || role === "branch_admin";
  const isSuperAdmin = role === "admin";

  // Fetch branches — server already scopes this to what the user can see
  const { data: branches, isLoading: branchesLoading } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiFetch("/branches"),
    enabled: clerkLoaded, // wait for Clerk to be ready before fetching
  });

  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  // Wait for both Clerk and branches to load
  if (!clerkLoaded || branchesLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  // Use all branches returned from API — server handles auth scoping
  const visibleBranches = branches || [];
  const activeBranch = visibleBranches.find((b) => b.id === (selectedBranchId ?? visibleBranches[0]?.id)) ?? visibleBranches[0];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stock</h1>
        <p className="text-muted-foreground">Track stock levels per branch</p>
      </div>

      <Tabs defaultValue="inventory">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="inventory" className="gap-2"><Package className="h-4 w-4" /> Inventory</TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="catalogue" className="gap-2"><List className="h-4 w-4" /> Catalogue</TabsTrigger>}
          </TabsList>

          {visibleBranches.length > 1 && (
            <Select value={String(activeBranch?.id ?? "")} onValueChange={(v) => setSelectedBranchId(Number(v))}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visibleBranches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value="inventory" className="mt-4">
          {!activeBranch ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <Package className="h-10 w-10 mb-3" />
              <p className="text-sm">No branch assigned. Ask your admin to assign you to a branch.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{activeBranch.name}</p>
                  {activeBranch.region && <p className="text-xs text-muted-foreground">{activeBranch.region}</p>}
                </div>
              </div>
              <BranchStock branch={activeBranch} isAdmin={isAdmin} />
            </>
          )}
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="catalogue" className="mt-4">
            <CataloguePage />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
