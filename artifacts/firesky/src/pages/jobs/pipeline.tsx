import { useState } from "react";
import { useListJobs, useUpdateJob, getListJobsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Plus, ArrowRight, ArrowLeft, X, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

const STAGES = [
  { id: "enquiry", label: "Enquiry" },
  { id: "inspection", label: "Inspection" },
  { id: "quoting", label: "Quoting" },
  { id: "quoted", label: "Quoted" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
  { id: "closed", label: "Closed" },
];

const ACTIVE_STAGES = STAGES.slice(0, 4);
const TERMINAL_STAGES = STAGES.slice(4);

type CloseState = { jobId: number } | null;

export default function JobsPipeline() {
  const { data: jobs, isLoading, error } = useListJobs();
  const queryClient = useQueryClient();
  const updateJob = useUpdateJob();
  const [closePrompt, setClosePrompt] = useState<CloseState>(null);

  const handleMoveJob = (e: React.MouseEvent, jobId: number, currentStage: string, direction: "next" | "prev") => {
    e.preventDefault();
    const activeIndex = ACTIVE_STAGES.findIndex(s => s.id === currentStage);
    const newIndex = direction === "next" ? activeIndex + 1 : activeIndex - 1;
    if (newIndex >= 0 && newIndex < ACTIVE_STAGES.length) {
      updateJob.mutate(
        { id: jobId, data: { stage: ACTIVE_STAGES[newIndex].id as any } },
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
        <h1 className="text-3xl font-bold">Pipeline</h1>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="min-w-[260px] space-y-4 shrink-0">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !jobs) {
    return <div className="text-destructive">Failed to load pipeline</div>;
  }

  const groupedJobs: Record<string, any[]> = {};
  STAGES.forEach(stage => {
    groupedJobs[stage.id] = jobs.filter(j => j.stage === stage.id) || [];
  });

  const renderCard = (job: any, stage: { id: string; label: string }, stageIndex: number, isTerminal: boolean) => {
    const isShowingClose = closePrompt?.jobId === job.id;

    return (
      <Link key={job.id} href={`/jobs/${job.id}`}>
        <Card className="hover:border-primary/50 transition-colors cursor-pointer shadow-sm relative group">
          <CardContent className="p-3 space-y-2">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground line-clamp-1">{job.customerName || `Customer #${job.customerId}`}</p>
              <h4 className="font-semibold text-sm leading-tight line-clamp-2">{job.title}</h4>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-1.5 flex-wrap">
                {job.priority && (
                  <Badge
                    variant={job.priority === "high" ? "destructive" : job.priority === "medium" ? "default" : "outline"}
                    className="text-[10px] px-1.5 h-5 uppercase"
                  >
                    {job.priority}
                  </Badge>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(job.createdAt), "MMM d")}
              </span>
            </div>

            {/* Close prompt */}
            {isShowingClose && !isTerminal && (
              <div
                className="bg-card border rounded-lg p-2 space-y-1.5 mt-1"
                onClick={(e) => e.preventDefault()}
              >
                <p className="text-xs font-semibold text-foreground">Close as:</p>
                <div className="flex gap-1.5 flex-wrap">
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 gap-1"
                    disabled={updateJob.isPending}
                    onClick={(e) => handleCloseAs(e, job.id, "won")}
                  >
                    <Trophy className="h-3 w-3" /> Won
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 px-2 text-xs"
                    disabled={updateJob.isPending}
                    onClick={(e) => handleCloseAs(e, job.id, "lost")}
                  >
                    Lost
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={updateJob.isPending}
                    onClick={(e) => handleCloseAs(e, job.id, "closed")}
                  >
                    Cancelled
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => { e.preventDefault(); setClosePrompt(null); }}
                  >
                    Back
                  </Button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {!isShowingClose && !isTerminal && (
              <div className="flex justify-between pt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={stageIndex === 0 || updateJob.isPending}
                  onClick={(e) => handleMoveJob(e, job.id, stage.id, "prev")}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                  disabled={updateJob.isPending}
                  title="Close job"
                  onClick={(e) => { e.preventDefault(); setClosePrompt({ jobId: job.id }); }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={stageIndex === ACTIVE_STAGES.length - 1 || updateJob.isPending}
                  onClick={(e) => handleMoveJob(e, job.id, stage.id, "next")}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs Pipeline</h1>
          <p className="text-muted-foreground">Track installation progress</p>
        </div>
        <Link href="/jobs/new">
          <Button size="lg" className="w-full sm:w-auto">
            <Plus className="mr-2 h-5 w-5" /> New Job
          </Button>
        </Link>
      </div>

      {/* Active stages kanban */}
      <div className="overflow-x-auto -mx-4 px-4 md:-mx-8 md:px-8 pb-4">
        <div className="flex gap-4 min-w-max">
          {ACTIVE_STAGES.map((stage, stageIndex) => (
            <div key={stage.id} className="w-[260px] sm:w-[280px] flex flex-col bg-muted/30 rounded-xl p-3 shrink-0">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="font-semibold text-foreground/80 text-sm">{stage.label}</h3>
                <Badge variant="secondary" className="rounded-full text-xs">{groupedJobs[stage.id].length}</Badge>
              </div>
              <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-0.5">
                {groupedJobs[stage.id].map(job => renderCard(job, stage, stageIndex, false))}
                {groupedJobs[stage.id].length === 0 && (
                  <div className="h-16 border-2 border-dashed rounded-lg border-muted-foreground/20 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground/50">Empty</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Terminal stage rows */}
      {TERMINAL_STAGES.some(s => groupedJobs[s.id]?.length > 0) && (
        <div className="space-y-4 pt-2 border-t">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Closed Jobs</h2>
          <div className="overflow-x-auto -mx-4 px-4 md:-mx-8 md:px-8 pb-4">
            <div className="flex gap-4 min-w-max">
              {TERMINAL_STAGES.map((stage) => (
                groupedJobs[stage.id].length > 0 && (
                  <div key={stage.id} className="w-[260px] sm:w-[280px] flex flex-col bg-muted/20 rounded-xl p-3 shrink-0">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="font-semibold text-foreground/60 text-sm">{stage.label}</h3>
                      <Badge variant="outline" className="rounded-full text-xs">{groupedJobs[stage.id].length}</Badge>
                    </div>
                    <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-0.5">
                      {groupedJobs[stage.id].map(job => renderCard(job, stage, -1, true))}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
