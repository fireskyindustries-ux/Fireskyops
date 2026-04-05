import { useListInspections } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Plus, MapPin, Calendar, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";

function safeFormat(value: unknown, fmt: string, fallback = "No date"): string {
  try {
    const d = new Date(value as any);
    return isValid(d) ? format(d, fmt) : fallback;
  } catch {
    return fallback;
  }
}

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-green-100 text-green-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
];

function avatarColor(name: string) {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

export default function InspectionsList() {
  const { data: inspections, isLoading, error } = useListInspections();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inspections</h1>
          <p className="text-sm text-muted-foreground">Site visits and installation prep</p>
        </div>
        <Link href="/inspections/new">
          <Button size="lg" className="w-full sm:w-auto h-10 px-6 hex-clip font-semibold">
            <Plus className="mr-2 h-4 w-4" /> New Inspection
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="text-destructive py-8 text-center">Failed to load inspections</div>
      ) : inspections?.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
          <p className="font-medium">No inspections yet</p>
          <p className="text-sm mt-1">Start by capturing a new site inspection</p>
        </div>
      ) : (
        <div className="space-y-2">
          {inspections?.map((inspection) => {
            const name = inspection.customerName || `Customer #${inspection.customerId}`;
            const isReady = (inspection as any).readyToQuote;
            return (
              <Link key={inspection.id} href={`/inspections/${inspection.id}`}>
                <div className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                  <div className={cn(
                    "h-11 w-11 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0",
                    avatarColor(name)
                  )}>
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base leading-tight line-clamp-1">{name}</h3>
                      {isReady && (
                        <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200 shrink-0">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Ready to quote
                        </span>
                      )}
                    </div>
                    {inspection.farmName && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{inspection.farmName}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      {inspection.nearestTown && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {inspection.nearestTown}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {safeFormat(inspection.inspectedAt, "d MMM yyyy")}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
