import { useState } from "react";
import { useListJobs, useUpdateJob, getListJobsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Plus, ArrowRight, ArrowLeft, X, Trophy, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
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

const PRIORITY_BADGE: Record<string, string> = {
  high:   "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low:    "bg-gray-50 text-gray-500 border-gray-200",
};

type CloseState = { jobId: number } | null;

export default function JobsPipeline() {
  const { data: jobs, isLoading, error } = useListJobs();
  const queryClient = useQueryClient();
  const updateJob = useUpdateJob();
  const [closePrompt, setClosePrompt] = useState<CloseState>(null);

  const handleMoveJob = (e: React.MouseEvent, jobId: number, currentStage: string, direction: "next" | "prev") => {
    e.preventDefault();
    const idx = STAGES.findIndex(s => s.id === currentStage);
    const newIdx = direction === "next" ? idx + 1 : idx - 1;
    if (newIdx >= 0 && newIdx < STAGES.length) {
      updateJob.mutate(
        { id: jobId, data: { stage: STAGES[newIdx].id as any } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() }) }
      );
    }
  };

  const handleCloseAs = (e: React.MouseEvent, jobId: number, outcome: "won" | "lost" | "closed") => {
    e.preventDefault();
    updateJob.mutate(
      { id: jobId, data: { stage: outcome as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
          setClosePrompt(null);
        }
      }
    );
  };

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

  const renderCard = (job: any, stage: typeof STAGES[0], stageIndex: number, isTerminal: boolean) => {
    const isShowingClose = closePrompt?.jobId === job.id;

    return (
      <Link key={job.id} href={`/jobs/${job.id}`}>
        <div className="bg-white border rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group p-3 space-y-2">
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

          {/* Close prompt */}
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

          {/* Move buttons */}
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jobs Pipeline</h1>
          <p className="text-sm text-muted-foreground">Track installation progress</p>
        </div>
        <Link href="/jobs/new">
          <Button size="lg" className="w-full sm:w-auto h-10 px-6 hex-clip font-semibold">
            <Plus className="mr-2 h-4 w-4" /> New Job
          </Button>
        </Link>
      </div>

      {/* Active kanban */}
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
                {grouped[stage.id].map(job => renderCard(job, stage, stageIndex, false))}
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

      {/* Terminal stages */}
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
                    {grouped[stage.id].map(job => renderCard(job, stage, -1, true))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
