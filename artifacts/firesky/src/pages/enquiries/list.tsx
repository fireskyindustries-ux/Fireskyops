import { useListEnquiries } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Plus, Filter, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  new:             { dot: "bg-blue-500",   badge: "bg-blue-50 text-blue-700 border-blue-200",      label: "New" },
  in_progress:     { dot: "bg-amber-500",  badge: "bg-amber-50 text-amber-700 border-amber-200",    label: "In Progress" },
  inspection_done: { dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700 border-violet-200", label: "Inspection Done" },
  quoted:          { dot: "bg-cyan-600",   badge: "bg-cyan-50 text-cyan-700 border-cyan-200",       label: "Quoted" },
  won:             { dot: "bg-green-600",  badge: "bg-green-50 text-green-700 border-green-200",    label: "Won" },
  lost:            { dot: "bg-red-500",    badge: "bg-red-50 text-red-700 border-red-200",          label: "Lost" },
  closed:          { dot: "bg-gray-400",   badge: "bg-gray-50 text-gray-600 border-gray-200",       label: "Closed" },
};

const PRIORITY_STYLES: Record<string, string> = {
  high:   "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low:    "bg-gray-50 text-gray-600 border-gray-200",
};

const PIPELINE_MAP: Record<string, number> = {
  new: 0, in_progress: 0, inspection_done: 1, quoted: 2, won: 3,
};
const PIPELINE_LABELS = ["Enquiry", "Inspection", "Quote", "Job"];

function PipelineTracker({ status }: { status: string }) {
  const currentStep = PIPELINE_MAP[status] ?? 0;
  const isLost = status === "lost" || status === "closed";
  const isDone = status === "won";

  if (isLost) return null;

  return (
    <div className="flex items-center gap-0.5 mt-1.5">
      {PIPELINE_LABELS.map((label, i) => {
        const active = i === currentStep;
        const done = i < currentStep || isDone;
        return (
          <div key={label} className="flex items-center gap-0.5">
            <div className={cn(
              "text-[9px] font-semibold px-1.5 py-0.5 rounded-full border leading-none",
              done ? "bg-green-500 text-white border-green-500" :
              active ? "bg-primary text-primary-foreground border-primary" :
              "bg-muted/60 text-muted-foreground border-muted-foreground/20"
            )}>
              {label}
            </div>
            {i < PIPELINE_LABELS.length - 1 && (
              <div className={cn("w-2 h-px shrink-0", done ? "bg-green-400" : "bg-muted-foreground/20")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function EnquiriesList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: enquiries, isLoading, error } = useListEnquiries({
    status: statusFilter !== "all" ? statusFilter : undefined
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Enquiries</h1>
          <p className="text-sm text-muted-foreground">Manage inbound requests and leads</p>
        </div>
        <Link href="/enquiries/new">
          <Button size="lg" className="w-full sm:w-auto h-10 px-6 hex-clip font-semibold">
            <Plus className="mr-2 h-4 w-4" /> New Enquiry
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px] h-9 text-sm">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="inspection_done">Inspection Done</SelectItem>
            <SelectItem value="quoted">Quoted</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="text-destructive py-8 text-center">Failed to load enquiries</div>
      ) : enquiries?.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
          <p className="font-medium">No enquiries found</p>
          {statusFilter !== "all" && <p className="text-sm mt-1">Try clearing the status filter</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {enquiries?.map((enquiry) => {
            const s = STATUS_STYLES[enquiry.status] ?? STATUS_STYLES.new;
            return (
              <Link key={enquiry.id} href={`/enquiries/${enquiry.id}`}>
                <Card className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30 group">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-0">
                      <div className={cn("w-1 self-stretch rounded-l-xl flex-shrink-0", s.dot)} />
                      <div className="flex-1 flex items-center gap-4 p-4 min-w-0">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base leading-tight line-clamp-1">{enquiry.title}</h3>
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                            {enquiry.customerName || `Customer #${enquiry.customerId}`}
                            {enquiry.tankSize && <span className="ml-2 text-xs">· {enquiry.tankQuantity || 1}× {enquiry.tankSize}</span>}
                          </p>
                          <PipelineTracker status={enquiry.status} />
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={cn("text-[11px] font-medium px-2.5 py-0.5 rounded-full border", s.badge)}>
                            {s.label}
                          </span>
                          {enquiry.priority && (
                            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border uppercase", PRIORITY_STYLES[enquiry.priority] ?? "")}>
                              {enquiry.priority}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">{format(new Date(enquiry.createdAt), "MMM d, yyyy")}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
