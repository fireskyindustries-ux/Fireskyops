import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Plus, RefreshCw, AlertTriangle, Wifi, WifiOff, Droplets, LogOut } from "lucide-react";
import { apiFetch, Tank, levelColor, levelLabel, offlineStatus, formatLitres, timeAgo } from "@/lib/api";
import { TankLevel } from "@/components/tank-level";
import { useUser, useClerk } from "@clerk/react";

export default function Dashboard() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<Tank[]>("/tanks");
      setTanks(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const alerts = tanks.filter(t => t.latestReading && t.latestReading.levelPercent < t.alertThresholdPercent);
  const offline = tanks.filter(t => offlineStatus(t.lastSeenAt));

  async function handleLogout() {
    await signOut();
  }

  return (
    <div className="min-h-screen bg-[hsl(20_14%_7%)]">
      {/* Header */}
      <header className="border-b border-[hsl(24_10%_14%)] bg-[hsl(20_12%_9%)] sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-orange-500" />
            <span className="font-semibold text-white text-sm">Tank Monitor</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[hsl(24_8%_55%)] hidden sm:block">{user?.fullName ?? user?.primaryEmailAddress?.emailAddress}</span>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-full text-[hsl(24_8%_45%)] hover:text-white hover:bg-white/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Alert banners */}
        {(alerts.length > 0 || offline.length > 0) && (
          <div className="space-y-2 mb-6">
            {alerts.length > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{alerts.length} tank{alerts.length > 1 ? "s" : ""} below critical level</span>
              </div>
            )}
            {offline.length > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
                <WifiOff className="w-4 h-4 shrink-0" />
                <span>{offline.length} sensor{offline.length > 1 ? "s" : ""} offline (&gt;2h)</span>
              </div>
            )}
          </div>
        )}

        {/* Title row */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white">My Tanks</h1>
            <p className="text-xs text-[hsl(24_8%_45%)] mt-0.5">{tanks.length} device{tanks.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-full border border-[hsl(24_10%_18%)] text-[hsl(24_8%_55%)] hover:text-white hover:border-orange-500/40 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <Link href="/register">
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" />
                Add Tank
              </button>
            </Link>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">{error}</div>
        )}

        {/* Empty state */}
        {!loading && tanks.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4">
              <Droplets className="w-8 h-8 text-orange-500/60" />
            </div>
            <h3 className="text-white font-semibold mb-1">No tanks yet</h3>
            <p className="text-sm text-[hsl(24_8%_45%)] mb-5 max-w-xs">
              Register your first sensor unit to start monitoring your water levels.
            </p>
            <Link href="/register">
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" />
                Register a tank
              </button>
            </Link>
          </div>
        )}

        {/* Tank grid */}
        {tanks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tanks.map((tank) => {
              const reading = tank.latestReading;
              const pct = reading?.levelPercent ?? 0;
              const color = levelColor(pct);
              const isOffline = offlineStatus(tank.lastSeenAt);

              return (
                <Link href={`/tanks/${tank.id}`} key={tank.id}>
                  <div className="group bg-[hsl(20_12%_10%)] border border-[hsl(24_10%_16%)] hover:border-orange-500/30 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg hover:shadow-orange-500/5">
                    {/* Status row */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono text-[hsl(24_8%_40%)]">{tank.serialNumber}</span>
                      <div className="flex items-center gap-1.5">
                        {isOffline ? (
                          <span className="flex items-center gap-1 text-xs text-yellow-500">
                            <WifiOff className="w-3 h-3" />Offline
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-green-500">
                            <Wifi className="w-3 h-3" />Online
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Level visual + info */}
                    <div className="flex items-center gap-4">
                      <TankLevel percent={pct} size={72} animated />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{tank.name ?? tank.serialNumber}</h3>
                        {reading ? (
                          <>
                            <p className="text-2xl font-bold mt-1" style={{ color }}>{Math.round(pct)}%</p>
                            <p className="text-xs text-[hsl(24_8%_50%)] mt-0.5">{formatLitres(reading.litres)} / {formatLitres(tank.capacityLitres)}</p>
                            <p className="text-xs mt-1 font-medium" style={{ color }}>{levelLabel(pct)}</p>
                          </>
                        ) : (
                          <p className="text-sm text-[hsl(24_8%_45%)] mt-1">No readings yet</p>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-4 pt-3 border-t border-[hsl(24_10%_14%)] flex items-center justify-between">
                      <span className="text-xs text-[hsl(24_8%_40%)]">Last update: {timeAgo(tank.lastSeenAt)}</span>
                      {reading?.batteryPercent != null && (
                        <span className="text-xs text-[hsl(24_8%_45%)]">Bat {reading.batteryPercent}%</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Footer nav */}
        <div className="mt-10 flex items-center justify-center gap-6 text-xs text-[hsl(24_8%_35%)]">
          <Link href="/subscription" className="hover:text-orange-400 transition-colors">Subscription</Link>
          <span>·</span>
          <a href="mailto:info@fireskyindustries.co.za" className="hover:text-orange-400 transition-colors">Support</a>
          <span>·</span>
          <span>Firesky Industries</span>
        </div>
      </main>
    </div>
  );
}
