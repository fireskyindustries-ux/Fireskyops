import { useListJobs, useUpdateJob, getListJobsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Plus, ArrowRight, ArrowLeft } from "lucide-react";
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
  { id: "lost", label: "Lost" }
];

export default function JobsPipeline() {
  const { data: jobs, isLoading, error } = useListJobs();
  const queryClient = useQueryClient();
  const updateJob = useUpdateJob();

  const handleMoveJob = (e: React.MouseEvent, jobId: number, currentStage: string, direction: "next" | "prev") => {
    e.preventDefault(); // Prevent navigating to job detail
    
    const currentIndex = STAGES.findIndex(s => s.id === currentStage);
    let newIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    
    if (newIndex >= 0 && newIndex < STAGES.length) {
      updateJob.mutate({ 
        id: jobId, 
        data: { stage: STAGES[newIndex].id as any } 
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
        }
      });
    }
  };

  if (isLoading) {
    return <div className="space-y-4">
      <h1 className="text-3xl font-bold">Pipeline</h1>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="min-w-[300px] space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ))}
      </div>
    </div>;
  }

  if (error || !jobs) {
    return <div className="text-destructive">Failed to load pipeline</div>;
  }

  // Group jobs by stage
  const groupedJobs: Record<string, any[]> = {};
  STAGES.forEach(stage => {
    groupedJobs[stage.id] = jobs.filter(j => j.stage === stage.id) || [];
  });

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
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

      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex gap-4 h-full min-w-max">
          {STAGES.map((stage, stageIndex) => (
            <div key={stage.id} className="w-[300px] flex flex-col bg-muted/30 rounded-xl p-3 h-full">
              <div className="flex items-center justify-between mb-3 px-1 shrink-0">
                <h3 className="font-semibold text-foreground/80">{stage.label}</h3>
                <Badge variant="secondary" className="rounded-full">{groupedJobs[stage.id].length}</Badge>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {groupedJobs[stage.id].map(job => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer shadow-sm relative group">
                      <CardContent className="p-4 space-y-3">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground line-clamp-1">{job.customerName || `Customer #${job.customerId}`}</p>
                          <h4 className="font-semibold text-base leading-tight line-clamp-2">{job.title}</h4>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2">
                            {job.priority && (
                              <Badge variant={job.priority === "high" ? "destructive" : job.priority === "medium" ? "default" : "outline"} className="text-[10px] px-1.5 h-5 uppercase">
                                {job.priority}
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(job.createdAt), "MMM d")}
                          </span>
                        </div>

                        {/* Hover actions for quick move */}
                        <div className="absolute inset-x-0 bottom-0 bg-background/95 backdrop-blur-sm border-t p-2 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity rounded-b-lg">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2" 
                            disabled={stageIndex === 0 || updateJob.isPending}
                            onClick={(e) => handleMoveJob(e, job.id, stage.id, "prev")}
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2" 
                            disabled={stageIndex === STAGES.length - 1 || updateJob.isPending}
                            onClick={(e) => handleMoveJob(e, job.id, stage.id, "next")}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
                {groupedJobs[stage.id].length === 0 && (
                  <div className="h-20 border-2 border-dashed rounded-lg border-muted-foreground/20 flex items-center justify-center">
                    <span className="text-sm text-muted-foreground/50">Empty</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}