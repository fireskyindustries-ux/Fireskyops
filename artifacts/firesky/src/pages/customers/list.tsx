import { useState } from "react";
import { useListCustomers } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Plus, Search, MapPin, Phone, ChevronRight, LayoutList, Map } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

// Fix Leaflet default marker icons in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-green-100 text-green-700",
  "bg-cyan-100 text-cyan-700",
  "bg-rose-100 text-rose-700",
];

function avatarColor(name: string) {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

interface LatLng { lat: number; lng: number; }

function parseCoords(raw: string | null | undefined): LatLng | null {
  if (!raw) return null;
  const s = raw.trim();

  // Google Maps link: https://maps.google.com/?q=-25.7461,28.1881
  const qMatch = s.match(/[?&]q=(-?\d+\.?\d*)[, ]+(-?\d+\.?\d*)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Plain "lat, lng" or "lat,lng" format
  const coordMatch = s.match(/^(-?\d+\.?\d*)[, ]+(-?\d+\.?\d*)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  return null;
}

function CustomerMap({ customers }: { customers: any[] }) {
  const mapped = customers
    .map(c => ({ customer: c, coords: parseCoords(c.whatsappLocation) }))
    .filter((x): x is { customer: any; coords: LatLng } => x.coords !== null);

  const center: [number, number] = mapped.length > 0
    ? [
        mapped.reduce((s, x) => s + x.coords.lat, 0) / mapped.length,
        mapped.reduce((s, x) => s + x.coords.lng, 0) / mapped.length,
      ]
    : [-28.7, 24.8]; // South Africa centre

  const noCoords = customers.filter(c => !parseCoords(c.whatsappLocation));

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden border shadow-sm" style={{ height: "60vh", minHeight: 300 }}>
        <MapContainer
          center={center}
          zoom={mapped.length > 0 ? (mapped.length === 1 ? 12 : 6) : 5}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {mapped.map(({ customer, coords }) => (
            <Marker key={customer.id} position={[coords.lat, coords.lng]}>
              <Popup>
                <div className="space-y-1 text-sm min-w-[160px]">
                  <p className="font-semibold">{customer.name}</p>
                  {customer.farmName && <p className="text-muted-foreground text-xs">{customer.farmName}</p>}
                  {customer.nearestTown && <p className="text-xs">Near {customer.nearestTown}</p>}
                  {customer.phone && <p className="text-xs">{customer.phone}</p>}
                  <a
                    href={`/customers/${customer.id}`}
                    className="inline-block mt-1 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Open record →
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{mapped.length} of {customers.length} customers plotted</span>
        {noCoords.length > 0 && (
          <span>{noCoords.length} without GPS location — open the customer record and capture GPS to add them.</span>
        )}
      </div>
    </div>
  );
}

type ViewMode = "list" | "map";

export default function CustomersList() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const debouncedSearch = useDebounce(search, 500);

  const { data: customers, isLoading, error } = useListCustomers({ search: debouncedSearch || undefined });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Farms and client contacts</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* List / Map toggle */}
          <div className="flex items-center rounded-full border bg-muted/40 p-0.5 gap-0.5">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                viewMode === "list"
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutList className="h-3.5 w-3.5" /> List
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                viewMode === "map"
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Map className="h-3.5 w-3.5" /> Map
            </button>
          </div>
          <Link href="/customers/new">
            <Button size="lg" className="w-full sm:w-auto h-10 px-6 font-semibold">
              <Plus className="mr-2 h-4 w-4" /> Add Customer
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by name, farm, or town..."
          className="pl-9 h-10 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="text-destructive py-8 text-center">Failed to load customers</div>
      ) : customers?.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
          <p className="font-medium">No customers found</p>
          {search && <p className="text-sm mt-1">Try adjusting your search</p>}
        </div>
      ) : viewMode === "map" ? (
        <CustomerMap customers={customers || []} />
      ) : (
        <div className="space-y-2">
          {customers?.map((customer) => (
            <Link key={customer.id} href={`/customers/${customer.id}`}>
              <div className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                <div className={cn(
                  "h-11 w-11 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0",
                  avatarColor(customer.name)
                )}>
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base leading-tight line-clamp-1">{customer.name}</h3>
                  {customer.farmName ? (
                    <p className="text-sm text-muted-foreground line-clamp-1">{customer.farmName}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                    {(customer.nearestTown || customer.province) && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {[customer.nearestTown, customer.province].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {customer.phone && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
