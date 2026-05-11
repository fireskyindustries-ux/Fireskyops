import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { ChevronLeft, MapPin, Battery, Wifi, WifiOff, Settings2, MessageSquare, AlertTriangle, Thermometer, CloudRain, Wind, Gauge } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiFetch, Tank, TankReading, levelColor, levelLabel, offlineStatus, formatLitres, timeAgo, windDirection } from "@/lib/api";
import { TankLevel } from "@/components/tank-level";
import { format, parseISO } from "date-fns";

export default function TankDetail() {
  const { id } = useParams<{ id: string }>();
  const [tank, setTank] = useState<Tank | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSupport, setShowSupport] = useState(false);
  const [supportMsg, setSupportMsg] = useState("");
  const [supportSent, setSupportSent] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName] = useState("");
  const [editThreshold, setEditThreshold] = useState(20);
  const [saving, setSaving] = useState(false);
  const [activeChart, setActiveChart] = useState<"level" | "temperature" | "rainfall" | "wind">("level");

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<Tank>(`/tanks/${id}`);
      setTank(data);
      setEditName(data.name ?? "");
      setEditThreshold(data.alertThresholdPercent);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function submitSupport() {
    if (!supportMsg.trim() || !tank) return;
    await apiFetch("/support", {
      method: "POST",
      body: JSON.stringify({ tankId: tank.id, message: supportMsg }),
    });
    setSupportSent(true);
    setSupportMsg("");
  }

  async function saveSettings() {
    if (!tank) return;
    setSaving(true);
    try {
      const updated = await apiFetch<Tank>(`/tanks/${tank.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName, alertThresholdPercent: editThreshold }),
      });
      setTank({ ...updated, readings: tank.readings });
      setShowSettings(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(20_14%_7%)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !tank) {
    return (
      <div className="min-h-screen bg-[hsl(20_14%_7%)] flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error ?? "Tank not found"}</p>
        <Link href="/dashboard"><button className="text-sm text-orange-500 hover:underline">Back to dashboard</button></Link>
      </div>
    );
  }

  const readings = (tank.readings ?? []).slice().reverse();
  const latest = tank.latestReading ?? readings[readings.length - 1] ?? null;
  const pct = latest?.levelPercent ?? 0;
  const color = levelColor(pct);
  const isOffline = offlineStatus(tank.lastSeenAt);

  const hasEnvData = latest && (
    latest.temperatureCelsius != null ||
    latest.rainfallMm != null ||
    latest.windSpeedKmh != null ||
    latest.pressureHpa != null
  );

  const chartReadings = readings.slice(-96);

  const chartData = chartReadings.map((r) => ({
    time: format(parseISO(r.recordedAt), "dd/MM HH:mm"),
    level: Math.round(r.levelPercent),
    litres: Math.round(r.litres),
    temperature: r.temperatureCelsius != null ? Math.round(r.temperatureCelsius * 10) / 10 : null,
    rainfall: r.rainfallMm != null ? Math.round(r.rainfallMm * 10) / 10 : null,
    wind: r.windSpeedKmh != null ? Math.round(r.windSpeedKmh) : null,
  }));

  const hasTemperatureChart = chartData.some(d => d.temperature != null);
  const hasRainfallChart = chartData.some(d => d.rainfall != null);
  const hasWindChart = chartData.some(d => d.wind != null);

  const chartTabs = [
    { key: "level" as const, label: "Level", always: true },
    { key: "temperature" as const, label: "Temp", show: hasTemperatureChart },
    { key: "rainfall" as const, label: "Rain", show: hasRainfallChart },
    { key: "wind" as const, label: "Wind", show: hasWindChart },
  ].filter(t => t.always || t.show);

  return (
    <div className="min-h-screen bg-[hsl(20_14%_7%)]">
      {/* Header */}
      <header className="border-b border-[hsl(24_10%_14%)] bg-[hsl(20_12%_9%)] sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard">
            <button className="p-1.5 rounded-full text-[hsl(24_8%_55%)] hover:text-white hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-white truncate">{tank.name ?? tank.serialNumber}</h1>
            <p className="text-xs font-mono text-[hsl(24_8%_45%)]">{tank.serialNumber}</p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-full text-[hsl(24_8%_55%)] hover:text-white hover:bg-white/10 transition-colors"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Settings panel */}
        {showSettings && (
          <div className="bg-[hsl(20_12%_12%)] border border-orange-500/20 rounded-2xl p-5">
            <h3 className="font-medium text-white mb-4">Tank Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[hsl(24_8%_55%)] block mb-1">Tank name</label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-[hsl(20_14%_8%)] border border-[hsl(24_10%_20%)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
                  placeholder="e.g. Barn Tank"
                />
              </div>
              <div>
                <label className="text-xs text-[hsl(24_8%_55%)] block mb-1">Alert threshold: {editThreshold}%</label>
                <input
                  type="range" min={5} max={50} value={editThreshold}
                  onChange={e => setEditThreshold(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={saveSettings} disabled={saving} className="px-4 py-2 rounded-full bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition-colors disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setShowSettings(false)} className="px-4 py-2 rounded-full border border-[hsl(24_10%_22%)] text-[hsl(24_8%_55%)] text-sm hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main level card */}
        <div className="bg-[hsl(20_12%_10%)] border border-[hsl(24_10%_16%)] rounded-2xl p-6">
          <div className="flex items-center gap-6">
            <TankLevel percent={pct} size={110} animated />
            <div className="flex-1">
              {latest ? (
                <>
                  <p className="text-4xl font-bold" style={{ color }}>{Math.round(pct)}%</p>
                  <p className="text-sm font-medium mt-1" style={{ color }}>{levelLabel(pct)}</p>
                  <p className="text-[hsl(24_8%_55%)] text-sm mt-2">
                    {formatLitres(latest.litres)} remaining
                  </p>
                  <p className="text-[hsl(24_8%_40%)] text-xs mt-0.5">
                    of {formatLitres(tank.capacityLitres)} total
                  </p>
                </>
              ) : (
                <p className="text-[hsl(24_8%_45%)]">No readings yet</p>
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-5 pt-4 border-t border-[hsl(24_10%_14%)] grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                {isOffline ? <WifiOff className="w-4 h-4 text-yellow-500" /> : <Wifi className="w-4 h-4 text-green-500" />}
              </div>
              <p className="text-xs text-[hsl(24_8%_45%)]">{isOffline ? "Offline" : "Online"}</p>
              <p className="text-xs text-[hsl(24_8%_35%)]">{timeAgo(tank.lastSeenAt)}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
              </div>
              <p className="text-xs text-[hsl(24_8%_45%)]">Alert at</p>
              <p className="text-xs text-orange-500">{tank.alertThresholdPercent}%</p>
            </div>
            {latest?.batteryPercent != null && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Battery className="w-4 h-4 text-[hsl(24_8%_55%)]" />
                </div>
                <p className="text-xs text-[hsl(24_8%_45%)]">Battery</p>
                <p className="text-xs text-white">{latest.batteryPercent}%</p>
              </div>
            )}
            {tank.locationDescription && (
              <div className="text-center col-span-1">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <MapPin className="w-4 h-4 text-[hsl(24_8%_55%)]" />
                </div>
                <p className="text-xs text-[hsl(24_8%_45%)] truncate">{tank.locationDescription}</p>
              </div>
            )}
          </div>
        </div>

        {/* Environment sensors */}
        {hasEnvData && (
          <div className="bg-[hsl(20_12%_10%)] border border-[hsl(24_10%_16%)] rounded-2xl p-5">
            <h2 className="text-sm font-medium text-white mb-4">Environment</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {latest.temperatureCelsius != null && (
                <div className="bg-[hsl(20_14%_8%)] rounded-xl p-3 text-center">
                  <Thermometer className="w-5 h-5 text-red-400 mx-auto mb-1.5" />
                  <p className="text-lg font-semibold text-white">{latest.temperatureCelsius.toFixed(1)}°C</p>
                  <p className="text-xs text-[hsl(24_8%_45%)] mt-0.5">Temperature</p>
                </div>
              )}
              {latest.rainfallMm != null && (
                <div className="bg-[hsl(20_14%_8%)] rounded-xl p-3 text-center">
                  <CloudRain className="w-5 h-5 text-blue-400 mx-auto mb-1.5" />
                  <p className="text-lg font-semibold text-white">{latest.rainfallMm.toFixed(1)} mm</p>
                  <p className="text-xs text-[hsl(24_8%_45%)] mt-0.5">Rainfall</p>
                </div>
              )}
              {latest.windSpeedKmh != null && (
                <div className="bg-[hsl(20_14%_8%)] rounded-xl p-3 text-center">
                  <Wind className="w-5 h-5 text-cyan-400 mx-auto mb-1.5" />
                  <p className="text-lg font-semibold text-white">{Math.round(latest.windSpeedKmh)} km/h</p>
                  <p className="text-xs text-[hsl(24_8%_45%)] mt-0.5">
                    Wind {latest.windDirectionDeg != null ? windDirection(latest.windDirectionDeg) : ""}
                  </p>
                </div>
              )}
              {latest.pressureHpa != null && (
                <div className="bg-[hsl(20_14%_8%)] rounded-xl p-3 text-center">
                  <Gauge className="w-5 h-5 text-purple-400 mx-auto mb-1.5" />
                  <p className="text-lg font-semibold text-white">{Math.round(latest.pressureHpa)}</p>
                  <p className="text-xs text-[hsl(24_8%_45%)] mt-0.5">hPa</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="bg-[hsl(20_12%_10%)] border border-[hsl(24_10%_16%)] rounded-2xl p-5">
            {/* Chart tabs */}
            {chartTabs.length > 1 && (
              <div className="flex gap-1 mb-4">
                {chartTabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveChart(tab.key)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      activeChart === tab.key
                        ? "bg-orange-500 text-white"
                        : "text-[hsl(24_8%_50%)] hover:text-white border border-[hsl(24_10%_20%)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {activeChart === "level" && (
              <>
                <h2 className="text-sm font-medium text-white mb-4">Level History</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="levelGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e85d04" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#e85d04" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(24 10% 14%)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(24 8% 40%)" }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(24 8% 40%)" }} unit="%" />
                    <Tooltip
                      contentStyle={{ background: "hsl(20 12% 12%)", border: "1px solid hsl(24 10% 20%)", borderRadius: "10px", fontSize: 12 }}
                      labelStyle={{ color: "hsl(24 8% 65%)" }}
                      itemStyle={{ color: "#e85d04" }}
                      formatter={(v: number, name: string) => name === "level" ? [`${v}%`, "Level"] : [`${v}L`, "Volume"]}
                    />
                    <Area type="monotone" dataKey="level" stroke="#e85d04" strokeWidth={2} fill="url(#levelGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}

            {activeChart === "temperature" && (
              <>
                <h2 className="text-sm font-medium text-white mb-4">Temperature History</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(24 10% 14%)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(24 8% 40%)" }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(24 8% 40%)" }} unit="°" />
                    <Tooltip
                      contentStyle={{ background: "hsl(20 12% 12%)", border: "1px solid hsl(24 10% 20%)", borderRadius: "10px", fontSize: 12 }}
                      labelStyle={{ color: "hsl(24 8% 65%)" }}
                      itemStyle={{ color: "#f87171" }}
                      formatter={(v: number) => [`${v}°C`, "Temperature"]}
                    />
                    <Area type="monotone" dataKey="temperature" stroke="#f87171" strokeWidth={2} fill="url(#tempGrad)" dot={false} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}

            {activeChart === "rainfall" && (
              <>
                <h2 className="text-sm font-medium text-white mb-4">Rainfall History</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(24 10% 14%)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(24 8% 40%)" }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(24 8% 40%)" }} unit="mm" />
                    <Tooltip
                      contentStyle={{ background: "hsl(20 12% 12%)", border: "1px solid hsl(24 10% 20%)", borderRadius: "10px", fontSize: 12 }}
                      labelStyle={{ color: "hsl(24 8% 65%)" }}
                      itemStyle={{ color: "#60a5fa" }}
                      formatter={(v: number) => [`${v} mm`, "Rainfall"]}
                    />
                    <Area type="monotone" dataKey="rainfall" stroke="#60a5fa" strokeWidth={2} fill="url(#rainGrad)" dot={false} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}

            {activeChart === "wind" && (
              <>
                <h2 className="text-sm font-medium text-white mb-4">Wind Speed History</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="windGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(24 10% 14%)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(24 8% 40%)" }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(24 8% 40%)" }} unit=" km/h" />
                    <Tooltip
                      contentStyle={{ background: "hsl(20 12% 12%)", border: "1px solid hsl(24 10% 20%)", borderRadius: "10px", fontSize: 12 }}
                      labelStyle={{ color: "hsl(24 8% 65%)" }}
                      itemStyle={{ color: "#22d3ee" }}
                      formatter={(v: number) => [`${v} km/h`, "Wind"]}
                    />
                    <Area type="monotone" dataKey="wind" stroke="#22d3ee" strokeWidth={2} fill="url(#windGrad)" dot={false} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        )}

        {/* Support */}
        <div className="bg-[hsl(20_12%_10%)] border border-[hsl(24_10%_16%)] rounded-2xl p-5">
          <button
            onClick={() => setShowSupport(!showSupport)}
            className="flex items-center gap-2 text-sm text-[hsl(24_8%_55%)] hover:text-white transition-colors w-full"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Contact support for this tank</span>
          </button>
          {showSupport && !supportSent && (
            <div className="mt-4 space-y-3">
              <textarea
                value={supportMsg}
                onChange={e => setSupportMsg(e.target.value)}
                placeholder="Describe your issue..."
                rows={3}
                className="w-full bg-[hsl(20_14%_8%)] border border-[hsl(24_10%_20%)] rounded-xl px-3 py-2 text-sm text-white placeholder:text-[hsl(24_8%_35%)] focus:outline-none focus:border-orange-500/50 resize-none"
              />
              <button
                onClick={submitSupport}
                disabled={!supportMsg.trim()}
                className="px-4 py-2 rounded-full bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition-colors disabled:opacity-40"
              >
                Send request
              </button>
            </div>
          )}
          {supportSent && (
            <p className="mt-3 text-sm text-green-400">Support request sent. We will be in touch shortly.</p>
          )}
        </div>
      </main>
    </div>
  );
}
