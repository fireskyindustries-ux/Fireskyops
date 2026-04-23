import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Building2, Phone, Mail, AlertCircle, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const BRANCH_ICON = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const CUSTOMER_ICON = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Branch {
  id: number;
  name: string;
  region: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  lat: number | null;
  lng: number | null;
}

interface Customer {
  id: number;
  name: string;
  phone: string | null;
  nearestTown: string | null;
  province: string | null;
  whatsappLocation: string | null;
}

interface LatLng { lat: number; lng: number; }

function parseCoords(raw: string | null | undefined): LatLng | null {
  if (!raw) return null;
  const s = raw.trim();

  const qMatch = s.match(/[?&]q=(-?\d+\.?\d*)[, ]+(-?\d+\.?\d*)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  const coordMatch = s.match(/^(-?\d+\.?\d*)[, ]+(-?\d+\.?\d*)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  return null;
}

const SA_CENTER: [number, number] = [-29.0, 25.0];
const SA_ZOOM = 5;

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  if (points.length > 0) {
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
  }
  return null;
}

async function apiFetch(path: string) {
  const res = await fetch(`/api${path}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function MapPage() {
  const { data: branches, isLoading: loadingBranches } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiFetch("/branches"),
  });

  const { data: customers, isLoading: loadingCustomers } = useQuery<Customer[]>({
    queryKey: ["customers-map"],
    queryFn: () => apiFetch("/customers"),
  });

  const isLoading = loadingBranches || loadingCustomers;

  const mappedBranches = (branches ?? []).filter((b) => b.lat != null && b.lng != null);
  const unmappedBranches = (branches ?? []).filter((b) => b.lat == null || b.lng == null);

  const mappedCustomers = (customers ?? [])
    .map((c) => ({ customer: c, coords: parseCoords(c.whatsappLocation) }))
    .filter((x): x is { customer: Customer; coords: LatLng } => x.coords !== null);

  const unmappedCustomers = (customers ?? []).filter((c) => !parseCoords(c.whatsappLocation));

  const allPoints: [number, number][] = [
    ...mappedBranches.map((b): [number, number] => [b.lat!, b.lng!]),
    ...mappedCustomers.map((x): [number, number] => [x.coords.lat, x.coords.lng]),
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Map</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isLoading
            ? "Loading…"
            : `${mappedCustomers.length} customer${mappedCustomers.length !== 1 ? "s" : ""} · ${mappedBranches.length} branch${mappedBranches.length !== 1 ? "es" : ""}${unmappedCustomers.length > 0 ? ` · ${unmappedCustomers.length} customers missing location` : ""}`}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[500px] rounded-xl border bg-card">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div style={{ height: 500 }} className="w-full z-0 relative">
            <MapContainer
              center={SA_CENTER}
              zoom={SA_ZOOM}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {mappedBranches.map((branch) => (
                <Marker key={`branch-${branch.id}`} position={[branch.lat!, branch.lng!]} icon={BRANCH_ICON}>
                  <Popup>
                    <div className="min-w-[160px] space-y-1">
                      <p className="font-semibold text-sm">{branch.name}</p>
                      <p className="text-[10px] uppercase tracking-wide text-orange-500 font-medium">Branch</p>
                      {branch.region && <p className="text-xs text-gray-500">{branch.region}</p>}
                      {branch.address && <p className="text-xs">{branch.address}</p>}
                      {branch.phone && (
                        <a href={`tel:${branch.phone}`} className="text-xs text-blue-600 hover:underline block">{branch.phone}</a>
                      )}
                      {branch.email && (
                        <a href={`mailto:${branch.email}`} className="text-xs text-blue-600 hover:underline block">{branch.email}</a>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}

              {mappedCustomers.map(({ customer, coords }) => (
                <Marker key={`customer-${customer.id}`} position={[coords.lat, coords.lng]} icon={CUSTOMER_ICON}>
                  <Popup>
                    <div className="min-w-[160px] space-y-1">
                      <p className="font-semibold text-sm">{customer.name}</p>
                      <p className="text-[10px] uppercase tracking-wide text-green-600 font-medium">Customer</p>
                      {customer.nearestTown && <p className="text-xs text-gray-500">{customer.nearestTown}{customer.province ? `, ${customer.province}` : ""}</p>}
                      {customer.phone && (
                        <a href={`tel:${customer.phone}`} className="text-xs text-blue-600 hover:underline block">{customer.phone}</a>
                      )}
                      <Link href={`/customers/${customer.id}`} className="text-xs text-blue-600 hover:underline block mt-1">View profile →</Link>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {allPoints.length > 0 && <FitBounds points={allPoints} />}
            </MapContainer>
          </div>
        </Card>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
          Customers ({mappedCustomers.length} mapped{unmappedCustomers.length > 0 ? `, ${unmappedCustomers.length} no location` : ""})
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-orange-500" />
          Branches ({mappedBranches.length} mapped{unmappedBranches.length > 0 ? `, ${unmappedBranches.length} no location` : ""})
        </div>
      </div>

      {/* Customers missing location */}
      {unmappedCustomers.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Customers without a saved location
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {unmappedCustomers.map((c) => (
              <Link key={c.id} href={`/customers/${c.id}`}>
                <Card className="border-dashed opacity-75 hover:opacity-100 transition-opacity cursor-pointer">
                  <CardContent className="py-3 px-4 flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      {c.nearestTown && <p className="text-xs text-muted-foreground truncate">{c.nearestTown}</p>}
                    </div>
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
