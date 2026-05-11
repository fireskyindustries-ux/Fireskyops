import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Wifi, WifiOff, AlertTriangle, Droplets, Search, RefreshCw, ChevronUp, ChevronDown, Plus, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface TankReading {
  levelPercent: number;
  litres: number;
  batteryPercent: number | null;
  recordedAt: string;
}

interface AdminTank {
  id: number;
  serialNumber: string;
  name: string | null;
  capacityLitres: number;
  tankType: string;
  alertThresholdPercent: number;
  isLocked: boolean;
  lastSeenAt: string | null;
  branchId: number | null;
  portalUserId: number | null;
  portalUserName: string | null;
  portalUserEmail: string | null;
  latestReading: TankReading | null;
  isOffline: boolean;
  isLowLevel: boolean;
}

function levelColor(pct: number) {
  if (pct < 20) return "text-red-500";
  if (pct < 50) return "text-yellow-500";
  return "text-green-500";
}

function levelBg(pct: number) {
  if (pct < 20) return "bg-red-500";
  if (pct < 50) return "bg-yellow-500";
  return "bg-green-500";
}

function timeAgo(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatLitres(l: number) {
  return l >= 1000 ? `${(l / 1000).toFixed(1)}kL` : `${l.toFixed(0)}L`;
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || "Request failed");
  }
  return res.json();
}

function RegisterTankDialog({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ serialNumber: "", capacityLitres: "5000", heightCm: "185", tankType: "vertical_round" });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/admin/tanks", {
        method: "POST",
        body: JSON.stringify({
          serialNumber: form.serialNumber.toUpperCase(),
          capacityLitres: Number(form.capacityLitres),
          heightCm: Number(form.heightCm),
          tankType: form.tankType,
        }),
      });
      toast({ title: "Device registered", description: form.serialNumber.toUpperCase() });
      onDone();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pt-2">
      <div>
        <Label>Serial number *</Label>
        <Input
          value={form.serialNumber}
          onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value.toUpperCase() }))}
          placeholder="FS-00123"
          required
          className="font-mono mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Capacity (L)</Label>
          <Input type="number" value={form.capacityLitres} onChange={e => setForm(f => ({ ...f, capacityLitres: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <Label>Height (cm)</Label>
          <Input type="number" value={form.heightCm} onChange={e => setForm(f => ({ ...f, heightCm: e.target.value }))} className="mt-1" />
        </div>
      </div>
      <Button type="submit" disabled={loading || !form.serialNumber.trim()} className="w-full rounded-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Register device
      </Button>
    </form>
  );
}

function MockSensorDialog({ tank, onDone }: { tank: AdminTank; onDone: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const [intervalId, setIntervalId] = useState<ReturnType<typeof setInterval> | null>(null);
  const [form, setForm] = useState({
    levelPercent: String(tank.latestReading?.levelPercent ?? 50),
    batteryPercent: "85",
    temperatureCelsius: "22",
    rainfallMm: "0",
    windSpeedKmh: "12",
    windDirectionDeg: "210",
    pressureHpa: "1013",
  });

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  }

  async function send() {
    setLoading(true);
    try {
      await apiFetch(`/admin/tanks/${tank.id}/reading`, {
        method: "POST",
        body: JSON.stringify({
          levelPercent: Number(form.levelPercent),
          batteryPercent: Number(form.batteryPercent),
          temperatureCelsius: Number(form.temperatureCelsius),
          rainfallMm: Number(form.rainfallMm),
          windSpeedKmh: Number(form.windSpeedKmh),
          windDirectionDeg: Number(form.windDirectionDeg),
          pressureHpa: Number(form.pressureHpa),
        }),
      });
      toast({ title: "Reading sent", description: `${tank.serialNumber} → ${form.levelPercent}%` });
      onDone();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function toggleLive() {
    if (live) {
      if (intervalId) clearInterval(intervalId);
      setIntervalId(null);
      setLive(false);
    } else {
      setLive(true);
      const id = setInterval(async () => {
        // slowly drift level down, add natural noise
        setForm(f => {
          const newPct = Math.max(0, Math.min(100, Number(f.levelPercent) - 0.3 + (Math.random() - 0.5) * 0.2));
          return { ...f, levelPercent: newPct.toFixed(1) };
        });
        await apiFetch(`/admin/tanks/${tank.id}/reading`, {
          method: "POST",
          body: JSON.stringify({
            levelPercent: Number(form.levelPercent),
            batteryPercent: Number(form.batteryPercent),
            temperatureCelsius: Number(form.temperatureCelsius) + (Math.random() - 0.5),
            rainfallMm: Number(form.rainfallMm),
            windSpeedKmh: Number(form.windSpeedKmh) + (Math.random() - 0.5) * 3,
            windDirectionDeg: Number(form.windDirectionDeg),
            pressureHpa: Number(form.pressureHpa),
          }),
        }).catch(() => {});
        onDone();
      }, 10000);
      setIntervalId(id);
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground font-mono">
        {tank.serialNumber} — {tank.name ?? "Unnamed"}
      </div>

      <div>
        <Label>Level % — <span className="text-primary font-bold">{form.levelPercent}%</span></Label>
        <input
          type="range" min="0" max="100" step="0.5"
          value={form.levelPercent}
          onChange={set("levelPercent")}
          className="w-full mt-2 accent-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Battery %</Label>
          <Input type="number" value={form.batteryPercent} onChange={set("batteryPercent")} className="mt-1" min="0" max="100" />
        </div>
        <div>
          <Label className="text-xs">Temp (°C)</Label>
          <Input type="number" value={form.temperatureCelsius} onChange={set("temperatureCelsius")} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Rainfall (mm)</Label>
          <Input type="number" value={form.rainfallMm} onChange={set("rainfallMm")} className="mt-1" min="0" />
        </div>
        <div>
          <Label className="text-xs">Wind (km/h)</Label>
          <Input type="number" value={form.windSpeedKmh} onChange={set("windSpeedKmh")} className="mt-1" min="0" />
        </div>
        <div>
          <Label className="text-xs">Wind dir (°)</Label>
          <Input type="number" value={form.windDirectionDeg} onChange={set("windDirectionDeg")} className="mt-1" min="0" max="360" />
        </div>
        <div>
          <Label className="text-xs">Pressure (hPa)</Label>
          <Input type="number" value={form.pressureHpa} onChange={set("pressureHpa")} className="mt-1" />
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={send} disabled={loading} className="flex-1 rounded-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Send reading
        </Button>
        <Button
          variant={live ? "destructive" : "outline"}
          onClick={toggleLive}
          className="rounded-full gap-1.5"
        >
          <Radio className="h-3.5 w-3.5" />
          {live ? "Stop live" : "Go live"}
        </Button>
      </div>
      {live && (
        <p className="text-xs text-center text-muted-foreground animate-pulse">
          Sending a reading every 10 seconds with natural drift...
        </p>
      )}
    </div>
  );
}

type SortKey = "level" | "lastSeen" | "name";

export default function TanksPage() {
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as string) || "guest";
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("level");
  const [sortAsc, setSortAsc] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [mockSensorTank, setMockSensorTank] = useState<AdminTank | null>(null);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const { toast } = useToast();

  const { data: tanks = [], isLoading, refetch } = useQuery<AdminTank[]>({
    queryKey: ["admin-tanks"],
    queryFn: () => apiFetch("/admin/tanks"),
    refetchInterval: 60_000,
  });

  async function seedDemo() {
    setSeedingDemo(true);
    try {
      const result = await apiFetch("/admin/tanks/demo-seed", { method: "POST" });
      await refetch();
      toast({ title: "Demo data seeded", description: `Serials: ${result.serials?.join(", ")}. Register them in the Tank Monitor portal to see the demo.` });
    } catch (e: any) {
      toast({ title: "Seed failed", description: e.message, variant: "destructive" });
    } finally {
      setSeedingDemo(false);
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  }

  const filtered = tanks
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.serialNumber.toLowerCase().includes(q) ||
        (t.name ?? "").toLowerCase().includes(q) ||
        (t.portalUserName ?? "").toLowerCase().includes(q) ||
        (t.portalUserEmail ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "level") {
        const pA = a.latestReading?.levelPercent ?? -1;
        const pB = b.latestReading?.levelPercent ?? -1;
        cmp = pA - pB;
      } else if (sortKey === "lastSeen") {
        const tA = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
        const tB = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
        cmp = tA - tB;
      } else {
        cmp = (a.name ?? a.serialNumber).localeCompare(b.name ?? b.serialNumber);
      }
      return sortAsc ? cmp : -cmp;
    });

  const alerts = tanks.filter(t => t.isLowLevel);
  const offline = tanks.filter(t => t.isOffline);

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return null;
    return sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Droplets className="h-6 w-6 text-primary" />
            Tank Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{tanks.length} device{tanks.length !== 1 ? "s" : ""} registered</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-full gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          {role === "admin" && (
            <>
              <Button variant="outline" size="sm" className="rounded-full gap-1.5" onClick={seedDemo} disabled={seedingDemo}>
                {seedingDemo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Droplets className="h-3.5 w-3.5" />}
                Seed Demo
              </Button>
              <Button size="sm" className="rounded-full gap-1.5" onClick={() => setShowRegister(true)}>
                <Plus className="h-3.5 w-3.5" />
                Register device
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Alert strip */}
      {(alerts.length > 0 || offline.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {alerts.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              <AlertTriangle className="h-4 w-4" />
              {alerts.length} low level alert{alerts.length > 1 ? "s" : ""}
            </div>
          )}
          {offline.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-sm">
              <WifiOff className="h-4 w-4" />
              {offline.length} sensor{offline.length > 1 ? "s" : ""} offline
            </div>
          )}
        </div>
      )}

      {/* Search + sort */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by serial, name, customer..."
            className="pl-9 rounded-full"
          />
        </div>
        <div className="flex gap-1.5">
          {(["level", "lastSeen", "name"] as SortKey[]).map(k => (
            <Button
              key={k}
              variant={sortKey === k ? "default" : "outline"}
              size="sm"
              onClick={() => toggleSort(k)}
              className="rounded-full gap-1 text-xs capitalize"
            >
              {k === "lastSeen" ? "Last seen" : k}
              <SortIcon k={k} />
            </Button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Droplets className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{search ? "No tanks match your search." : "No tanks registered yet."}</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(tank => {
            const pct = tank.latestReading?.levelPercent ?? null;
            return (
              <Card key={tank.id} className="border hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Level bar */}
                    <div className="flex flex-col items-center gap-1 w-14 shrink-0">
                      <div className="relative w-10 h-16 rounded-lg bg-muted border border-border overflow-hidden">
                        {pct !== null && (
                          <div
                            className={`absolute bottom-0 left-0 right-0 transition-all duration-700 ${levelBg(pct)} opacity-80`}
                            style={{ height: `${pct}%` }}
                          />
                        )}
                      </div>
                      <span className={`text-xs font-bold ${pct !== null ? levelColor(pct) : "text-muted-foreground"}`}>
                        {pct !== null ? `${Math.round(pct)}%` : "—"}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{tank.name ?? tank.serialNumber}</span>
                        <span className="font-mono text-xs text-muted-foreground">{tank.serialNumber}</span>
                        {tank.isLowLevel && <Badge variant="destructive" className="text-xs">Low</Badge>}
                        {tank.isLocked && <Badge variant="secondary" className="text-xs">Locked</Badge>}
                      </div>
                      <div className="flex items-center gap-4 mt-1 flex-wrap text-xs text-muted-foreground">
                        {tank.latestReading && (
                          <span>{formatLitres(tank.latestReading.litres)} / {formatLitres(tank.capacityLitres)}</span>
                        )}
                        {tank.portalUserName && (
                          <span className="truncate max-w-40">{tank.portalUserName}</span>
                        )}
                        {tank.portalUserEmail && (
                          <span className="truncate max-w-40 text-muted-foreground/70">{tank.portalUserEmail}</span>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1.5">
                        {tank.isOffline ? (
                          <span className="flex items-center gap-1 text-xs text-yellow-500">
                            <WifiOff className="h-3.5 w-3.5" /> Offline
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-green-500">
                            <Wifi className="h-3.5 w-3.5" /> Online
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{timeAgo(tank.lastSeenAt)}</span>
                      {tank.latestReading?.batteryPercent != null && (
                        <span className="text-xs text-muted-foreground">Bat {tank.latestReading.batteryPercent}%</span>
                      )}
                    </div>
                  </div>

                  {/* Level progress bar */}
                  {pct !== null && (
                    <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${levelBg(pct)}`}
                        style={{ width: `${pct}%`, opacity: 0.8 }}
                      />
                    </div>
                  )}
                  {role === "admin" && (
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full gap-1.5 text-xs text-muted-foreground h-7 px-3 hover:text-primary"
                        onClick={() => setMockSensorTank(tank)}
                      >
                        <Radio className="h-3 w-3" />
                        Send reading
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Register dialog */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register IoT device</DialogTitle>
          </DialogHeader>
          <RegisterTankDialog onDone={() => { setShowRegister(false); refetch(); }} />
        </DialogContent>
      </Dialog>

      {/* Mock sensor dialog */}
      <Dialog open={!!mockSensorTank} onOpenChange={o => { if (!o) setMockSensorTank(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              Mock sensor
            </DialogTitle>
          </DialogHeader>
          {mockSensorTank && (
            <MockSensorDialog
              tank={mockSensorTank}
              onDone={() => refetch()}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
