import { useState, useMemo, useEffect } from "react";
import { useListJobs, useUpdateJob, getListJobsQueryKey } from "@workspace/api-client-react";
import { Link, useSearch, useLocation } from "wouter";
import { Plus, ArrowRight, ArrowLeft, X, Trophy, ChevronRight, LayoutList, Columns, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subHours } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STAGES = [
  { id: "enquiry",    label: "Enquiry",    color: "border-t-blue-400",   header: "text-blue-700",   count: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "inspection", label: "Inspection", color: "border-t-violet-400", header: "text-violet-700", count: "bg-violet-50 text-violet-700 border-violet-200" },
  { id: "quoting",    label: "Quoting",    color: "border-t-amber-400",  header: "text-amber-700",  count: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "quoted",     label: "Quoted",     color: "border-t-cyan-400",   header: "text-cyan-700",   count: "bg-cyan-50 text-cyan-700 border-cyan-200" },
];

const TERMINAL_STAGES = [
  { id: "won",    label: "Won",       color: "border-t-green-400", header: "text-green-700", count: "bg-green-50 text-green-700 border-green-200" },
  { id: "lost",   label: "Lost",      color: "border-t-red-400",   header: "text-red-600",   count: "bg-red-50 text-red-700 border-red-200" },
  { id: "closed", label: "Cancelled", color: "border-t-gray-300",  header: "text-gray-500",  count: "bg-gray-50 text-gray-500 border-gray-200" },
];

const ALL_STAGES = [...STAGES, ...TERMINAL_STAGES];

const STAGE_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  enquiry:    { dot: "bg-blue-400",   badge: "bg-blue-50 text-blue-700 border-blue-200",     label: "Enquiry" },
  inspection: { dot: "bg-violet-400", badge: "bg-violet-50 text-violet-700 border-violet-200", label: "Inspection" },
  quoting:    { dot: "bg-amber-400",  badge: "bg-amber-50 text-amber-700 border-amber-200",   label: "Quoting" },
  quoted:     { dot: "bg-cyan-500",   badge: "bg-cyan-50 text-cyan-700 border-cyan-200",      label: "Quoted" },
  won:        { dot: "bg-green-500",  badge: "bg-green-50 text-green-700 border-green-200",   label: "Won" },
  lost:       { dot: "bg-red-400",    badge: "bg-red-50 text-red-700 border-red-200",         label: "Lost" },
  closed:     { dot: "bg-gray-400",   badge: "bg-gray-50 text-gray-600 border-gray-200",      label: "Cancelled" },
};

const PRIORITY_BADGE: Record<string, string> = {
  high:   "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low:    "bg-gray-50 text-gray-500 border-gray-200",
};

const ACCESS_RISK_BADGE: Record<string, string> = {
  high:   "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low:    "bg-green-50 text-green-700 border-green-200",
};

const ACTIVE_STAGES = ["enquiry", "inspection", "quoting", "quoted"];

const QUICK_FILTER_LABELS: Record<string, string> = {
  stale:              "Stale (no update in 48h)",
  urgent:             "Urgent — High Priority",
  overdue_followup:   "Overdue Follow-up",
  no_next_action:     "No Next Action",
  quoted_no_followup: "Quoted — No Follow-up Date",
  lost_no_reason:     "Lost — No Reason Recorded",
  high_access_risk:   "High Access Risk",
};

const BULK_STAGE_OPTIONS = [
  { value: "enquiry",    label: "Move to Enquiry" },
  { value: "inspection", label: "Move to Inspection" },
  { value: "quoting",    label: "Move to Quoting" },
  { value: "quoted",     label: "Move to Quoted" },
  { value: "won",        label: "Mark Won" },
  { value: "lost",       label: "Mark Lost" },
  { value: "closed",     label: "Mark Cancelled" },
];

function applyJobFilter(jobs: any[], filter: string): any[] {
  const staleThreshold = subHours(new Date(), 48);
  const today = new Date().toISOString().slice(0, 10);

  switch (filter) {
    case "stale":
      return jobs.filter(j =>
        ACTIVE_STAGES.includes(j.stage) &&
        new Date(j.updatedAt) < staleThreshold,
      );
    case "urgent":
      return jobs.filter(j => j.priority === "high");
    case "overdue_followup":
      return jobs.filter(j =>
        ACTIVE_STAGES.includes(j.stage) &&
        j.followUpDueDate &&
        j.followUpDueDate < today,
      );
    case "no_next_action":
      return jobs.filter(j =>
        ACTIVE_STAGES.includes(j.stage) &&
        (!j.nextAction || j.nextAction === ""),
      );
    case "quoted_no_followup":
      return jobs.filter(j => j.stage === "quoted" && !j.followUpDueDate);
    case "lost_no_reason":
      return jobs.filter(j => j.stage === "lost" && !j.lostReason);
    case "high_access_risk":
      return jobs.filter(j => j.accessRisk === "high");
    default:
      return jobs;
  }
}

type CloseState = { jobId: number } | null;
type ViewMode = "pipeline" | "list";

export default function JobsPipeline() {
  const { data: jobs, isLoading, error } = useListJobs();
  const queryClient = useQueryClient();
  const updateJob = useUpdateJob();
  const { toast } = useToast();
  const [closePrompt, setClosePrompt] = useState<CloseState>(null);

  const search = useSearch();
  const [, navigate] = useLocation();
  const quickFilter = new URLSearchParams(search).get("filter");

  const [viewMode, setViewMode] = useState<ViewMode>("pipeline");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStage, setBulkStage] = useState<string>("");
  const [bulkPending, setBulkPending] = useState(false);

  useEffect(() => {
    if (quickFilter) setViewMode("list");
  }, [quickFilter]);

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    if (!quickFilter) return jobs;
    return applyJobFilter(jobs, quickFilter);
  }, [jobs, quickFilter]);

  const filterLabel = quickFilter ? QUICK_FILTER_LABELS[quickFilter] : null;

  const handleMoveJob = (e: React.MouseEvent, jobId: number, currentStage: string, direction: "next" | "prev") => {
    e.preventDefault();
    const idx = STAGES.findIndex(s => s.id === currentStage);
    const newIdx = direction === "next" ? idx + 1 : idx - 1;
    if (newIdx >= 0 && newIdx < STAGES.length) {
      updateJob.mutate(
        { id: jobId, data: { stage: STAGES[newIdx].id } as any },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() }) }
      );
    }
  };

  const handleCloseAs = (e: React.MouseEvent, jobId: number, outcome: "won" | "lost" | "closed") => {
    e.preventDefault();
    updateJob.mutate(
      { id: jobId, data: { stage: outcome } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
          setClosePrompt(null);
        }
      }
    );
  };

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
    if (selectedIds.size === filteredJobs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredJobs.map(j => j.id)));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBulkStage("");
  }

  async function applyBulk() {
    if (!bulkStage || selectedIds.size === 0) return;
    setBulkPending(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          updateJob.mutateAsync({ id, data: { stage: bulkStage } as any })
        )
      );
      queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
      toast({ title: `Updated ${selectedIds.size} job${selectedIds.size === 1 ? "" : "s"}` });
      clearSelection();
    } catch {
      toast({ title: "Some updates failed", variant: "destructive" });
    } finally {
      setBulkPending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="min-w-[240px] space-y-3 shrink-0">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !jobs) {
    return <div className="text-destructive py-8 text-center">Failed to load pipeline</div>;
  }

  const grouped: Record<string, any[]> = {};
  ALL_STAGES.forEach(s => { grouped[s.id] = jobs.filter(j => j.stage === s.id); });

  const renderKanbanCard = (job: any, stage: typeof STAGES[0], stageIndex: number, isTerminal: boolean) => {
    const isShowingClose = closePrompt?.jobId === job.id;

    return (
      <Link key={job.id} href={`/jobs/${job.id}`}>
        <div className="bg-card border rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group p-3 space-y-2">
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground line-clamp-1">{job.customerName || `Customer #${job.customerId}`}</p>
            <h4 className="font-semibold text-sm leading-snug line-clamp-2">{job.title}</h4>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-1.5 flex-wrap">
              {job.priority && (
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase", PRIORITY_BADGE[job.priority] ?? "")}>
                  {job.priority}
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">{format(new Date(job.createdAt), "MMM d")}</span>
          </div>

          {isShowingClose && !isTerminal && (
            <div className="bg-muted/50 border rounded-lg p-2 space-y-1.5 mt-1" onClick={(e) => e.preventDefault()}>
              <p className="text-xs font-semibold">Close as:</p>
              <div className="flex gap-1.5 flex-wrap">
                <Button size="sm" className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 gap-1" disabled={updateJob.isPending} onClick={(e) => handleCloseAs(e, job.id, "won")}>
                  <Trophy className="h-3 w-3" /> Won
                </Button>
                <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" disabled={updateJob.isPending} onClick={(e) => handleCloseAs(e, job.id, "lost")}>
                  Lost
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={updateJob.isPending} onClick={(e) => handleCloseAs(e, job.id, "closed")}>
                  Cancel
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={(e) => { e.preventDefault(); setClosePrompt(null); }}>
                  Back
                </Button>
              </div>
            </div>
          )}

          {!isShowingClose && !isTerminal && (
            <div className="flex justify-between pt-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={stageIndex === 0 || updateJob.isPending} onClick={(e) => handleMoveJob(e, job.id, stage.id, "prev")}>
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" disabled={updateJob.isPending} onClick={(e) => { e.preventDefault(); setClosePrompt({ jobId: job.id }); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={stageIndex === STAGES.length - 1 || updateJob.isPending} onClick={(e) => handleMoveJob(e, job.id, stage.id, "next")}>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {isTerminal && (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors ml-auto" />
          )}
        </div>
      </Link>
    );
  };

  const allSelected = filteredJobs.length > 0 && selectedIds.size === filteredJobs.length;

  return (
    <div className="space-y-6 pb-28">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jobs Pipeline</h1>
          <p className="text-sm text-muted-foreground">Track installation progress</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Pipeline / List toggle */}
          <div className="flex items-center rounded-full border bg-muted/40 p-0.5 gap-0.5">
            <button
              onClick={() => { setViewMode("pipeline"); clearSelection(); if (quickFilter) navigate("/jobs"); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                viewMode === "pipeline"
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Columns className="h-3.5 w-3.5" /> Pipeline
            </button>
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
          </div>
          <Link href="/jobs/new">
            <Button size="lg" className="w-full sm:w-auto h-10 px-6 font-semibold">
              <Plus className="mr-2 h-4 w-4" /> New Job
            </Button>
          </Link>
        </div>
      </div>

      {/* ── LIST VIEW ──────────────────────────────────────────── */}
      {viewMode === "list" && (
        <div className="space-y-4">
          {/* Active quick filter pill */}
          {filterLabel && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground">Filtered:</span>
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 text-xs font-semibold">
                {filterLabel}
                {!isLoading && (
                  <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold ml-0.5">
                    {filteredJobs.length}
                  </span>
                )}
                <button
                  onClick={() => navigate("/jobs")}
                  className="ml-0.5 hover:opacity-70 transition-opacity"
                  aria-label="Clear filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </div>
          )}

          {/* Select all row */}
          {filteredJobs.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
            >
              {allSelected
                ? <CheckSquare className="h-4 w-4 text-primary" />
                : <Square className="h-4 w-4" />}
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          )}

          {filteredJobs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
              <p className="font-medium">No jobs found</p>
              {quickFilter && (
                <p className="text-sm mt-1">
                  No records match this filter.{" "}
                  <button onClick={() => navigate("/jobs")} className="text-primary underline underline-offset-2">
                    Clear filter
                  </button>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredJobs.map((job) => {
                const s = STAGE_STYLES[job.stage] ?? STAGE_STYLES.enquiry;
                const checked = selectedIds.has(job.id);
                return (
                  <div key={job.id}>
                    <Link href={`/jobs/${job.id}`}>
                      <Card className={cn(
                        "cursor-pointer hover:shadow-md transition-all hover:border-primary/30 group",
                        checked && "border-primary/50 shadow-sm"
                      )}>
                        <CardContent className="p-0">
                          <div className="flex items-center gap-0">
                            <div className={cn("w-1 self-stretch rounded-l-xl flex-shrink-0", s.dot)} />
                            {/* Checkbox */}
                            <button
                              onClick={(e) => toggleSelect(job.id, e)}
                              className="flex-shrink-0 flex items-center justify-center w-10 self-stretch hover:bg-muted/50 transition-colors"
                              aria-label={checked ? "Deselect" : "Select"}
                            >
                              {checked
                                ? <CheckSquare className="h-4 w-4 text-primary" />
                                : <Square className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />}
                            </button>
                            <div className="flex-1 flex items-center gap-4 py-4 pr-4 min-w-0">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-base leading-tight line-clamp-1">{job.title}</h3>
                                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                                  {job.customerName || `Customer #${job.customerId}`}
                                </p>
                                {job.nextAction && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 italic">
                                    Next: {job.nextAction}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <span className={cn("text-[11px] font-medium px-2.5 py-0.5 rounded-full border capitalize", s.badge)}>
                                  {s.label}
                                </span>
                                {job.priority && (
                                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border uppercase", PRIORITY_BADGE[job.priority] ?? "")}>
                                    {job.priority}
                                  </span>
                                )}
                                {job.accessRisk && (
                                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize", ACCESS_RISK_BADGE[job.accessRisk] ?? "")}>
                                    {job.accessRisk} risk
                                  </span>
                                )}
                                <span className="text-[10px] text-muted-foreground">{format(new Date(job.createdAt), "MMM d, yyyy")}</span>
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
        </div>
      )}

      {/* ── PIPELINE VIEW ──────────────────────────────────────── */}
      {viewMode === "pipeline" && (
        <>
          <div className="overflow-x-auto -mx-4 px-4 md:-mx-8 md:px-8 pb-2">
            <div className="flex gap-4 min-w-max">
              {STAGES.map((stage, stageIndex) => (
                <div key={stage.id} className={cn("w-[240px] sm:w-[260px] flex flex-col bg-muted/20 rounded-xl border-t-4 p-3 shrink-0 shadow-sm", stage.color)}>
                  <div className="flex items-center justify-between mb-3 px-0.5">
                    <h3 className={cn("font-semibold text-sm", stage.header)}>{stage.label}</h3>
                    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", stage.count)}>
                      {grouped[stage.id].length}
                    </span>
                  </div>
                  <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-0.5">
                    {grouped[stage.id].map(job => renderKanbanCard(job, stage, stageIndex, false))}
                    {grouped[stage.id].length === 0 && (
                      <div className="h-16 border-2 border-dashed rounded-xl border-muted-foreground/15 flex items-center justify-center">
                        <span className="text-xs text-muted-foreground/40">Empty</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {TERMINAL_STAGES.some(s => grouped[s.id]?.length > 0) && (
            <div className="space-y-4 pt-2 border-t">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Closed</h2>
              <div className="overflow-x-auto -mx-4 px-4 md:-mx-8 md:px-8 pb-2">
                <div className="flex gap-4 min-w-max">
                  {TERMINAL_STAGES.filter(s => grouped[s.id]?.length > 0).map((stage) => (
                    <div key={stage.id} className={cn("w-[240px] sm:w-[260px] flex flex-col bg-muted/10 rounded-xl border-t-4 p-3 shrink-0", stage.color)}>
                      <div className="flex items-center justify-between mb-3 px-0.5">
                        <h3 className={cn("font-semibold text-sm", stage.header)}>{stage.label}</h3>
                        <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", stage.count)}>
                          {grouped[stage.id].length}
                        </span>
                      </div>
                      <div className="space-y-2.5 max-h-[35vh] overflow-y-auto pr-0.5">
                        {grouped[stage.id].map(job => renderKanbanCard(job, stage, -1, true))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Floating bulk action bar — list view only */}
      {viewMode === "list" && selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg">
          <div className="bg-card border shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-primary shrink-0">
              {selectedIds.size} selected
            </span>
            <Select value={bulkStage} onValueChange={setBulkStage}>
              <SelectTrigger className="flex-1 h-9 text-sm min-w-[160px]">
                <SelectValue placeholder="Choose action..." />
              </SelectTrigger>
              <SelectContent>
                {BULK_STAGE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-9 px-4 shrink-0"
              disabled={!bulkStage || bulkPending}
              onClick={applyBulk}
            >
              {bulkPending ? "Updating..." : "Apply"}
            </Button>
            <Button size="sm" variant="ghost" className="h-9 px-3 shrink-0" onClick={clearSelection}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
