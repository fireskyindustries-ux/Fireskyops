const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/portal${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(body?.error ?? res.statusText), { status: res.status, data: body });
  }
  return res.json() as Promise<T>;
}

export interface PortalUser {
  id: number;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface TankReading {
  id: number;
  tankId: number;
  levelCm: number;
  levelPercent: number;
  litres: number;
  batteryPercent: number | null;
  temperatureCelsius: number | null;
  rainfallMm: number | null;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
  pressureHpa: number | null;
  recordedAt: string;
}

export interface Tank {
  id: number;
  serialNumber: string;
  portalUserId: number | null;
  branchId: number | null;
  name: string | null;
  capacityLitres: number;
  heightCm: number | null;
  diameterCm: number | null;
  tankType: string;
  lat: number | null;
  lng: number | null;
  locationDescription: string | null;
  alertThresholdPercent: number;
  isLocked: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  latestReading?: TankReading | null;
  readings?: TankReading[];
}

export interface Subscription {
  id: number;
  tier: string;
  maxTanks: number;
  priceZar: string;
  status: string;
  nextBillingDate: string | null;
}

export function levelColor(pct: number): string {
  if (pct < 20) return "#ef4444";
  if (pct < 50) return "#f59e0b";
  return "#22c55e";
}

export function levelLabel(pct: number): string {
  if (pct < 20) return "Critical";
  if (pct < 50) return "Low";
  if (pct < 80) return "Good";
  return "Full";
}

export function offlineStatus(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return true;
  return Date.now() - new Date(lastSeenAt).getTime() > 2 * 60 * 60 * 1000;
}

export function formatLitres(l: number): string {
  return l >= 1000 ? `${(l / 1000).toFixed(1)}kL` : `${l.toFixed(0)}L`;
}

export function timeAgo(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function windDirection(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}
