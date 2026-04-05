import { useGetCustomer, getGetCustomerQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { MapPin, Phone, Mail, Map, Navigation, AlignLeft, Info, Plus, LocateFixed, ExternalLink, ChevronLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkyInlineButton } from "@/components/sky";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function buildMapsUrl(value: string): string | null {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  const coordRegex = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/;
  if (coordRegex.test(value.trim())) {
    return `https://www.google.com/maps?q=${encodeURIComponent(value.trim())}`;
  }
  return null;
}

export default function CustomerDetail() {
  const params = useParams();
  const id = Number(params.id);
  
  const { data: customer, isLoading, error } = useGetCustomer(id, { 
    query: { enabled: !!id, queryKey: getGetCustomerQueryKey(id) } 
  });

  if (isLoading) {
    return <div className="space-y-4 max-w-4xl mx-auto">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-64 w-full" />
    </div>;
  }

  if (error || !customer) {
    return <div className="text-destructive">Customer not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ChevronLeft className="h-4 w-4" /> Customers
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
          {customer.farmName && <p className="text-xl text-muted-foreground mt-1">{customer.farmName}</p>}
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          <SkyInlineButton
            contextType="customer"
            contextData={customer as unknown as Record<string, unknown>}
            contextLabel={customer.name}
            variant="outline"
            className="w-full sm:w-auto"
          />
          <Link href={`/enquiries/new?customerId=${customer.id}`}>
            <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> New Enquiry</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.contactName && (
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Contact Person</p>
                  <p className="text-sm text-muted-foreground">{customer.contactName}</p>
                </div>
              </div>
            )}
            
            {customer.phone && (
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Phone</p>
                  <div className="flex items-center gap-3 flex-wrap mt-0.5">
                    <a href={`tel:${customer.phone}`} className="text-sm text-primary hover:underline">{customer.phone}</a>
                    <a
                      href={`https://wa.me/${customer.phone.replace(/\D/g, "").replace(/^0/, "27")}?text=${encodeURIComponent(`Hi, this is Firesky Industries reaching out regarding your account.`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full hover:bg-green-100 transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            )}

            {customer.email && (
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <a href={`mailto:${customer.email}`} className="text-sm text-primary hover:underline">{customer.email}</a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Location Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Nearest Town / Region</p>
                <p className="text-sm text-muted-foreground">
                  {[customer.nearestTown, customer.province].filter(Boolean).join(", ") || "Not specified"}
                </p>
              </div>
            </div>

            {customer.whatsappLocation && (() => {
              const mapsUrl = buildMapsUrl(customer.whatsappLocation!);
              const isCoord = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(customer.whatsappLocation!.trim());
              return (
                <div className="flex items-start gap-3">
                  <LocateFixed className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-sm font-medium">GPS Location</p>
                    {isCoord && (
                      <p className="text-xs text-muted-foreground font-mono">{customer.whatsappLocation}</p>
                    )}
                    {mapsUrl ? (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-md hex-clip-sm hover:bg-primary/90 active:scale-95 transition-all"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open in Google Maps
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground break-all">{customer.whatsappLocation}</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {customer.manualDirections && (
              <div className="flex items-start gap-3">
                <Navigation className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Manual Directions</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.manualDirections}</p>
                </div>
              </div>
            )}

            {customer.landmarks && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Landmarks</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.landmarks}</p>
                </div>
              </div>
            )}
            
            {customer.accessNotes && (
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Access Notes</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.accessNotes}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {customer.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <AlignLeft className="h-5 w-5 text-muted-foreground mt-0.5" />
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Could also show related Enquiries/Jobs here if the API returned them, 
          but we only have separate list endpoints. Let's just provide a simple button. */}
    </div>
  );
}