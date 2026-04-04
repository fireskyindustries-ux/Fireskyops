import { useListInspections } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Plus, MapPin, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isValid } from "date-fns";

function safeFormat(value: unknown, fmt: string, fallback = "No date"): string {
  try {
    const d = new Date(value as any);
    return isValid(d) ? format(d, fmt) : fallback;
  } catch {
    return fallback;
  }
}

export default function InspectionsList() {
  const { data: inspections, isLoading, error } = useListInspections();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inspections</h1>
          <p className="text-muted-foreground">Site visits and installation prep</p>
        </div>
        <Link href="/inspections/new">
          <Button size="lg" className="w-full sm:w-auto">
            <Plus className="mr-2 h-5 w-5" /> New Inspection
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : error ? (
        <div className="text-destructive">Failed to load inspections</div>
      ) : inspections?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-card">
          <p>No inspections found.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {inspections?.map((inspection) => (
            <Link key={inspection.id} href={`/inspections/${inspection.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex flex-col justify-between h-full space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg line-clamp-1">{inspection.customerName || `Customer #${inspection.customerId}`}</h3>
                    {inspection.farmName && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{inspection.farmName}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {(inspection.nearestTown) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="line-clamp-1">{inspection.nearestTown}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 shrink-0" />
                      <span>{safeFormat(inspection.inspectedAt, "PPP")}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}