import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Building2, Phone, Mail, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// Fix Leaflet default marker icons broken by bundlers
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

// South Africa default center
const SA_CENTER: [number, number] = [-29.0, 25.0];
const SA_ZOOM = 5;

function FitBounds({ branches }: { branches: Branch[] }) {
  const map = useMap();
  const mapped = branches.filter((b) => b.lat != null && b.lng != null);
  if (mapped.length > 0) {
    const bounds = L.latLngBounds(mapped.map((b) => [b.lat!, b.lng!]));
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
  const { data: branches, isLoading } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiFetch("/branches"),
  });

  const mapped = (branches ?? []).filter((b) => b.lat != null && b.lng != null);
  const unmapped = (branches ?? []).filter((b) => b.lat == null || b.lng == null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Branch Map</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isLoading ? "Loading branches…" : `${mapped.length} branch${mapped.length !== 1 ? "es" : ""} on map${unmapped.length > 0 ? ` · ${unmapped.length} pending location` : ""}`}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[420px] rounded-xl border bg-card">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div style={{ height: 420 }} className="w-full z-0 relative">
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
              {mapped.map((branch) => (
                <Marker key={branch.id} position={[branch.lat!, branch.lng!]} icon={BRANCH_ICON}>
                  <Popup>
                    <div className="min-w-[160px] space-y-1">
                      <p className="font-semibold text-sm">{branch.name}</p>
                      {branch.region && <p className="text-xs text-gray-500">{branch.region}</p>}
                      {branch.address && <p className="text-xs">{branch.address}</p>}
                      {branch.phone && (
                        <p className="text-xs">
                          <a href={`tel:${branch.phone}`} className="text-blue-600 hover:underline">{branch.phone}</a>
                        </p>
                      )}
                      {branch.email && (
                        <p className="text-xs">
                          <a href={`mailto:${branch.email}`} className="text-blue-600 hover:underline">{branch.email}</a>
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
              {mapped.length > 0 && <FitBounds branches={branches ?? []} />}
            </MapContainer>
          </div>
        </Card>
      )}

      {/* Branch cards below the map */}
      {!isLoading && (branches ?? []).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(branches ?? []).map((branch) => (
            <Card key={branch.id} className={branch.lat == null ? "border-dashed opacity-75" : ""}>
              <CardContent className="pt-4 pb-4 flex gap-3 items-start">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${branch.lat != null ? "bg-primary/10" : "bg-muted"}`}>
                  {branch.lat != null
                    ? <MapPin className="h-4 w-4 text-primary" />
                    : <Building2 className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{branch.name}</p>
                  {branch.region && <p className="text-xs text-muted-foreground">{branch.region}</p>}
                  {branch.address && <p className="text-xs text-muted-foreground truncate">{branch.address}</p>}
                  <div className="flex flex-wrap gap-x-3 mt-1">
                    {branch.phone && (
                      <a href={`tel:${branch.phone}`} className="text-xs text-primary flex items-center gap-1 hover:underline">
                        <Phone className="h-3 w-3" />{branch.phone}
                      </a>
                    )}
                    {branch.email && (
                      <a href={`mailto:${branch.email}`} className="text-xs text-primary flex items-center gap-1 hover:underline">
                        <Mail className="h-3 w-3" />{branch.email}
                      </a>
                    )}
                  </div>
                  {branch.lat == null && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Add an address to pin on map
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && (branches ?? []).length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No branches yet. Add your first branch under Admin → Branches.
        </div>
      )}
    </div>
  );
}
