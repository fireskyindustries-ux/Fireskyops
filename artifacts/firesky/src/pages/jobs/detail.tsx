import { useGetJob, useUpdateJob, getGetJobQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Briefcase, Calendar, Info, DollarSign, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkyInlineButton } from "@/components/sky";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const STAGES = [
  { id: "enquiry", label: "Enquiry" },
  { id: "inspection", label: "Inspection" },
  { id: "quoting", label: "Quoting" },
  { id: "quoted", label: "Quoted" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" }
];

export default function JobDetail() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const updateJob = useUpdateJob();
  const { toast } = useToast();
  
  const { data: job, isLoading, error } = useGetJob(id, { 
    query: { enabled: !!id, queryKey: getGetJobQueryKey(id) } 
  });

  const handleStageChange = (newStage: string) => {
    updateJob.mutate({ id, data: { stage: newStage as any } }, {
      onSuccess: () => {
        toast({ title: "Job stage updated" });
        queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(id) });
      }
    });
  };

  if (isLoading) {
    return <div className="space-y-4 max-w-4xl mx-auto">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-64 w-full" />
    </div>;
  }

  if (error || !job) {
    return <div className="text-destructive">Job not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">{job.title}</h1>
            {job.priority && (
              <Badge variant={job.priority === "high" ? "destructive" : job.priority === "medium" ? "default" : "outline"} className="uppercase">
                {job.priority}
              </Badge>
            )}
          </div>
          <Link href={`/customers/${job.customerId}`}>
            <p className="text-xl text-primary hover:underline cursor-pointer">{job.customerName || `Customer #${job.customerId}`}</p>
          </Link>
        </div>
        <div className="flex gap-2 w-full sm:w-auto items-center flex-wrap">
          <SkyInlineButton
            contextType="job"
            contextData={job as unknown as Record<string, unknown>}
            contextLabel={job.title}
            variant="outline"
          />
          <span className="text-sm font-medium mr-2">Stage:</span>
          <Select value={job.stage} onValueChange={handleStageChange} disabled={updateJob.isPending}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Job Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(job.tankSize || job.tankQuantity) && (
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Installation Scope</p>
                  <p className="text-sm text-muted-foreground">
                    {job.tankQuantity || 1}x {job.tankSize || "Unknown size"}
                  </p>
                </div>
              </div>
            )}
            
            {job.estimatedValue && (
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Estimated Value</p>
                  <p className="text-sm text-muted-foreground">R {job.estimatedValue.toLocaleString()}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Created</p>
                <p className="text-sm text-muted-foreground">{format(new Date(job.createdAt), "PPP p")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Related Records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {job.enquiryId && (
              <Link href={`/enquiries/${job.enquiryId}`}>
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <Info className="h-5 w-5 text-primary" />
                    <span className="font-medium">View Original Enquiry</span>
                  </div>
                </div>
              </Link>
            )}
            {job.inspectionId && (
              <Link href={`/inspections/${job.inspectionId}`}>
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span className="font-medium">View Site Inspection</span>
                  </div>
                </div>
              </Link>
            )}
            {!job.enquiryId && !job.inspectionId && (
              <p className="text-sm text-muted-foreground py-4 text-center">No related records found</p>
            )}
          </CardContent>
        </Card>
      </div>

      {job.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}