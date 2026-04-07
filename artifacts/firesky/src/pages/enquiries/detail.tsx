import { useState } from "react";
import { useGetEnquiry, useUpdateEnquiry, getGetEnquiryQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ClipboardCheck, Briefcase, AlignLeft, Info, Calendar, ChevronLeft, Pencil, Save, X, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { SkyInlineButton } from "@/components/sky";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/react";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  new:             { badge: "bg-blue-50 text-blue-700 border-blue-200",      label: "New" },
  in_progress:     { badge: "bg-amber-50 text-amber-700 border-amber-200",    label: "In Progress" },
  inspection_done: { badge: "bg-violet-50 text-violet-700 border-violet-200", label: "Inspection Done" },
  quoted:          { badge: "bg-cyan-50 text-cyan-700 border-cyan-200",       label: "Quoted" },
  won:             { badge: "bg-green-50 text-green-700 border-green-200",    label: "Won" },
  lost:            { badge: "bg-red-50 text-red-700 border-red-200",          label: "Lost" },
  closed:          { badge: "bg-gray-50 text-gray-600 border-gray-200",       label: "Closed" },
};

const STATUS_STEP: Record<string, number> = {
  new: 0, in_progress: 0, inspection_done: 1, quoted: 2, won: 3,
};
const PIPELINE_LABELS = ["Enquiry", "Inspection", "Quote", "Job"];

function PipelineTracker({
  status,
  enquiryId,
  inspectionId,
  jobId,
}: {
  status: string;
  enquiryId: number;
  inspectionId?: number | null;
  jobId?: number | null;
}) {
  const isLost = status === "lost" || status === "closed";
  const statusReached = STATUS_STEP[status] ?? 0;

  // Compute the highest step reached using real data + status
  const stepReached = (i: number) => {
    if (i === 0) return true;
    if (i === 1) return !!inspectionId || statusReached >= 1;
    if (i === 2) return statusReached >= 2;
    if (i === 3) return !!jobId || statusReached >= 3;
    return false;
  };

  const currentStep = PIPELINE_LABELS.reduce(
    (acc, _, i) => (stepReached(i) ? i : acc),
    0,
  );

  const getHref = (i: number) => {
    if (i === 1 && inspectionId) return `/inspections/${inspectionId}`;
    if (i === 3 && jobId) return `/jobs/${jobId}`;
    return null;
  };

  if (isLost) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-red-600 capitalize">{status}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {PIPELINE_LABELS.map((label, i) => {
        const past = i < currentStep;
        const active = i === currentStep;
        const href = getHref(i);
        const pill = (
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all",
            past
              ? "bg-green-500 text-white border-green-500"
              : active
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted text-muted-foreground border-muted-foreground/20",
            href && "cursor-pointer hover:opacity-80",
          )}>
            {past && <CheckCircle2 className="h-2.5 w-2.5" />}
            {label}
            {href && (past || active) && <ExternalLink className="h-2 w-2 opacity-70" />}
          </div>
        );

        return (
          <div key={label} className="flex items-center gap-1">
            {href ? <Link href={href}>{pill}</Link> : pill}
            {i < PIPELINE_LABELS.length - 1 && (
              <div className={cn(
                "w-3 h-px",
                past ? "bg-green-400" : active ? "bg-primary/40" : "bg-muted-foreground/30",
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function EnquiryDetail() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateEnquiry = useUpdateEnquiry();
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as string) || "guest";
  const canEdit = role === "admin" || role === "user";

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  const { data: enquiry, isLoading, error } = useGetEnquiry(id, {
    query: { enabled: !!id, queryKey: getGetEnquiryQueryKey(id) }
  });

  const startEdit = () => {
    setEditForm({
      title: enquiry?.title ?? "",
      description: enquiry?.description ?? "",
      status: enquiry?.status ?? "new",
      priority: enquiry?.priority ?? "medium",
      tankSize: enquiry?.tankSize ?? "",
      tankQuantity: enquiry?.tankQuantity ?? "",
      notes: enquiry?.notes ?? "",
    });
    setEditing(true);
  };

  const handleSave = () => {
    const payload: any = {
      title: editForm.title,
      status: editForm.status,
      priority: editForm.priority,
    };
    if (editForm.description) payload.description = editForm.description;
    if (editForm.tankSize) payload.tankSize = editForm.tankSize;
    if (editForm.tankQuantity) payload.tankQuantity = Number(editForm.tankQuantity);
    if (editForm.notes) payload.notes = editForm.notes;

    updateEnquiry.mutate({ id, data: payload }, {
      onSuccess: () => {
        toast({ title: "Enquiry updated" });
        queryClient.invalidateQueries({ queryKey: getGetEnquiryQueryKey(id) });
        setEditing(false);
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    });
  };

  if (isLoading) {
    return <div className="space-y-4 max-w-4xl mx-auto">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-64 w-full" />
    </div>;
  }

  if (error || !enquiry) {
    return <div className="text-destructive">Enquiry not found</div>;
  }

  const statusStyle = STATUS_STYLES[enquiry.status] ?? STATUS_STYLES.new;
  const hasInspection = !!enquiry.inspectionId;
  const hasJob = !!enquiry.jobId;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <Link href="/enquiries" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ChevronLeft className="h-4 w-4" /> Enquiries
          </Link>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight">{enquiry.title}</h1>
            <span className={cn("text-[11px] font-medium px-2.5 py-0.5 rounded-full border", statusStyle.badge)}>
              {statusStyle.label}
            </span>
            {enquiry.priority && (
              <Badge variant={enquiry.priority === "high" ? "destructive" : enquiry.priority === "medium" ? "default" : "outline"} className="uppercase">
                {enquiry.priority}
              </Badge>
            )}
          </div>
          <Link href={`/customers/${enquiry.customerId}`}>
            <p className="text-xl text-primary hover:underline cursor-pointer">{enquiry.customerName || `Customer #${enquiry.customerId}`}</p>
          </Link>
          <div className="mt-2">
            <PipelineTracker
              status={enquiry.status}
              enquiryId={enquiry.id}
              inspectionId={enquiry.inspectionId}
              jobId={enquiry.jobId}
            />
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-col sm:flex-row">
          <SkyInlineButton
            contextType="enquiry"
            contextData={enquiry as unknown as Record<string, unknown>}
            contextLabel={enquiry.title}
            variant="outline"
            className="w-full sm:w-auto"
          />
          {canEdit && !editing && (
            <Button variant="outline" className="w-full sm:w-auto gap-2" onClick={startEdit}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}

          {/* Inspection button — done state links to existing inspection */}
          {hasInspection ? (
            <Link href={`/inspections/${enquiry.inspectionId}`}>
              <Button variant="outline" className="w-full sm:w-auto gap-2 border-green-300 text-green-700 bg-green-50 hover:bg-green-100">
                <CheckCircle2 className="h-4 w-4" /> Inspection Done
              </Button>
            </Link>
          ) : (
            <Link href={`/inspections/new?enquiryId=${enquiry.id}&customerId=${enquiry.customerId}`}>
              <Button variant="outline" className="w-full sm:w-auto">
                <ClipboardCheck className="mr-2 h-4 w-4" /> Do Inspection
              </Button>
            </Link>
          )}

          {/* Job button — done state links to existing job */}
          {hasJob ? (
            <Link href={`/jobs/${enquiry.jobId}`}>
              <Button className="w-full sm:w-auto gap-2">
                <Briefcase className="h-4 w-4" /> View Job
              </Button>
            </Link>
          ) : (
            <Link href={`/jobs/new?enquiryId=${enquiry.id}&customerId=${enquiry.customerId}`}>
              <Button className="w-full sm:w-auto">
                <Briefcase className="mr-2 h-4 w-4" /> Convert to Job
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Edit Enquiry</CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1 block">Title</label>
                <Input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Status</label>
                <Select value={editForm.status} onValueChange={v => setEditForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="inspection_done">Inspection Done</SelectItem>
                    <SelectItem value="quoted">Quoted</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Priority</label>
                <Select value={editForm.priority} onValueChange={v => setEditForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Tank Size</label>
                <Input value={editForm.tankSize} onChange={e => setEditForm(p => ({ ...p, tankSize: e.target.value }))} placeholder="e.g. 10000L" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Quantity</label>
                <Input type="number" value={editForm.tankQuantity} onChange={e => setEditForm(p => ({ ...p, tankQuantity: e.target.value }))} placeholder="1" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1 block">Description</label>
                <Textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} rows={2} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1 block">Internal Notes</label>
                <Textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={updateEnquiry.isPending} className="gap-2">
                <Save className="h-4 w-4" />
                {updateEnquiry.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(enquiry.tankSize || enquiry.tankQuantity) && (
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Tank Request</p>
                  <p className="text-sm text-muted-foreground">
                    {enquiry.tankQuantity || 1}x {enquiry.tankSize || "Unknown size"}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Created</p>
                <p className="text-sm text-muted-foreground">{format(new Date(enquiry.createdAt), "PPP p")}</p>
              </div>
            </div>

            {enquiry.description && (
              <div className="flex items-start gap-3">
                <AlignLeft className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Description</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{enquiry.description}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {enquiry.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Internal Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{enquiry.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
