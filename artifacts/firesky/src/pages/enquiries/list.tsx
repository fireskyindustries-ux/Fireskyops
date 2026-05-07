import { useListEnquiries, useUpdateEnquiry, getListEnquiriesQueryKey } from "@workspace/api-client-react";
import { Link, useSearch, useLocation } from "wouter";
import { Plus, Filter, ChevronRight, X, CheckSquare, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subHours } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

const BULK_STATUS_OPTIONS = [
  { value: "in_progress",     label: "Mark In Progress" },
  { value: "inspection_done", label: "Mark Inspection Done" },
  { value: "quoted",          label: "Mark Quoted" },
  { value: "won",             label: "Mark Won" },
  { value: "lost",            label: "Mark Lost" },
  { value: "closed",          label: "Mark Closed" },
];

const PIPELINE_MAP: Record<string, number> = {
  new: 0, in_progress: 0, inspection_done: 1, quoted: 2, won: 3,
};
const PIPELINE_LABELS = ["Enquiry", "Inspection", "Quote", "Job"];

function PipelineTracker({ status }: { status: string }) {
  const currentStep = PIPELINE_MAP[status] ?? 0;
  const isLost = status === "lost" || status === "closed";
  const isDone = status === "won";

  if (isLost) return null;
  if (isDone) return (
    <div className="flex items-center gap-1 mt-1.5">
      {PIPELINE_LABELS.map((_, i) => (
        <div key={i} className="h-1 flex-1 rounded-full bg-green-500" />
      ))}
    </div>
  );

  return (
    <div className="flex items-center gap-1 mt-1.5">
      {PIPELINE_LABELS.map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full",
            i <= currentStep ? "bg-primary" : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

const ACTIVE_STATUSES = ["new", "in_progress", "inspection_done", "quoted"];
const QUICK_FILTER_LABELS: Record<string, string> = {
  stale: "Stale (no activity 48h+)",
  urgent: "High Priority",
  overdue_follow_up: "Overdue Follow-up",
  no_next_action: "No Next Action",
};

function applyQuickFilter(enquiries: any[], filter: string): any[] {
  const now = new Date();
  const fortyEightHoursAgo = subHours(now, 48);
  const today = new Date().toISOString().slice(0, 10);
  switch (filter) {
    case "stale":
      return enquiries.filter(e =>
        ACTIVE_STATUSES.includes(e.status) &&
        new Date(e.updatedAt) < fortyEightHoursAgo,
      );
    case "urgent":
      return enquiries.filter(e => e.priority === "high");
    case "overdue_follow_up":
      return enquiries.filter(e =>
        ACTIVE_STATUSES.includes(e.status) &&
        e.followUpDueDate &&
        e.followUpDueDate < today,
      );
    case "no_next_action":
      return enquiries.filter(e =>
        ACTIVE_STATUSES.includes(e.status) &&
        (!e.nextAction || e.nextAction === ""),
      );
    default:
      return enquiries;
  }
}

export default function EnquiriesList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const search = useSearch();
  const [, navigate] = useLocation();
  const quickFilter = new URLSearchParams(search).get("filter");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkPending, setBulkPending] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const updateEnquiry = useUpdateEnquiry();

  const { data: allEnquiries, isLoading, error } = useListEnquiries({
    status: quickFilter ? undefined : statusFilter !== "all" ? statusFilter : undefined,
  });

  const enquiries = useMemo(() => {
    if (!allEnquiries) return [];
    if (!quickFilter) return allEnquiries;
    return applyQuickFilter(allEnquiries, quickFilter);
  }, [allEnquiries, quickFilter]);

  const filterLabel = quickFilter ? QUICK_FILTER_LABELS[quickFilter] : null;

  function toggleSelect(id: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === enquiries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(enquiries.map(e => e.id)));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBulkStatus("");
  }

  async function applyBulk() {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkPending(true);
    try {
      const ids = Array.from(selectedIds);
      for (let i = 0; i < ids.length; i += 5) {
        await Promise.all(
          ids.slice(i, i + 5).map(id =>
            updateEnquiry.mutateAsync({ id, data: { status: bulkStatus as any } })
          )
        );
      }
      queryClient.invalidateQueries({ queryKey: getListEnquiriesQueryKey() });
      toast({ title: `Updated ${selectedIds.size} enquir${selectedIds.size === 1 ? "y" : "ies"}` });
      clearSelection();
    } catch {
      toast({ title: "Some updates failed. Please try again.", variant: "destructive" });
    } finally {
      setBulkPending(false);
    }
  }

  async function deleteSelected() {
    setDeleting(true);
    try {
      const resp = await fetch(`${BASE}/api/enquiries/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!resp.ok) throw new Error("Delete failed");
      queryClient.invalidateQueries({ queryKey: getListEnquiriesQueryKey() });
      toast({ title: `Deleted ${selectedIds.size} enquir${selectedIds.size === 1 ? "y" : "ies"}` });
      clearSelection();
    } catch {
      toast({ title: "Delete failed. Please try again.", variant: "destructive" });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const allSelected = enquiries.length > 0 && selectedIds.size === enquiries.length;

  return (
    <div className="space-y-6 pb-28">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Enquiries</h1>
          <p className="text-sm text-muted-foreground">Manage inbound requests and leads</p>
        </div>
        <Link href="/enquiries/new">
          <Button size="lg" className="w-full sm:w-auto h-10 px-6 font-semibold">
            <Plus className="mr-2 h-4 w-4" /> New Enquiry
          </Button>
        </Link>
      </div>

      {filterLabel && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">Filtered:</span>
          <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 text-xs font-semibold">
            {filterLabel}
            {!isLoading && (
              <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold ml-0.5">
                {enquiries.length}
              </span>
            )}
            <button onClick={() => navigate("/enquiries")} className="ml-0.5 hover:opacity-70 transition-opacity" aria-label="Clear filter">
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {!quickFilter && (
          <>
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
          </>
        )}
        {!isLoading && enquiries.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {allSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="text-destructive py-8 text-center">Failed to load enquiries</div>
      ) : enquiries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
          <p className="font-medium">No enquiries found</p>
          {quickFilter && (
            <p className="text-sm mt-1">
              No records match this filter.{" "}
              <button onClick={() => navigate("/enquiries")} className="text-primary underline underline-offset-2">Clear filter</button>
            </p>
          )}
          {!quickFilter && statusFilter !== "all" && (
            <p className="text-sm mt-1">Try clearing the status filter</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {enquiries.map((enquiry) => {
            const s = STATUS_STYLES[enquiry.status] ?? STATUS_STYLES.new;
            const checked = selectedIds.has(enquiry.id);
            return (
              <div key={enquiry.id} className="relative">
                <Link href={`/enquiries/${enquiry.id}`}>
                  <Card className={cn(
                    "cursor-pointer hover:shadow-md transition-all hover:border-primary/30 group",
                    checked && "border-primary/50 shadow-sm bg-primary/2"
                  )}>
                    <CardContent className="p-0">
                      <div className="flex items-center gap-0">
                        <div className={cn("w-1 self-stretch rounded-l-xl flex-shrink-0", s.dot)} />
                        <button
                          onClick={(e) => toggleSelect(enquiry.id, e)}
                          className="flex-shrink-0 flex items-center justify-center w-10 self-stretch hover:bg-muted/50 transition-colors rounded-none"
                          aria-label={checked ? "Deselect" : "Select"}
                        >
                          {checked
                            ? <CheckSquare className="h-4 w-4 text-primary" />
                            : <Square className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />}
                        </button>
                        <div className="flex-1 flex items-center gap-4 py-4 pr-4 min-w-0">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base leading-tight line-clamp-1">{enquiry.title}</h3>
                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                              {enquiry.customerName || `Customer #${enquiry.customerId}`}
                              {enquiry.tankSize && <span className="ml-2 text-xs">· {enquiry.tankQuantity || 1}× {enquiry.tankSize}</span>}
                            </p>
                            {enquiry.nextAction && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 italic">
                                Next: {enquiry.nextAction}
                              </p>
                            )}
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
              </div>
            );
          })}
        </div>
      )}

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg">
          <div className="bg-card border shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-primary shrink-0">
              {selectedIds.size} selected
            </span>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="flex-1 h-9 text-sm min-w-[150px]">
                <SelectValue placeholder="Change status..." />
              </SelectTrigger>
              <SelectContent>
                {BULK_STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-9 px-4 shrink-0"
              disabled={!bulkStatus || bulkPending}
              onClick={applyBulk}
            >
              {bulkPending ? "Updating..." : "Apply"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-9 px-3 shrink-0"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-9 px-3 shrink-0" onClick={clearSelection}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} enquir{selectedIds.size === 1 ? "y" : "ies"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected {selectedIds.size === 1 ? "enquiry" : "enquiries"}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteSelected}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Yes, delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
