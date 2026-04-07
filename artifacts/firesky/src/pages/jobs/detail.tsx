import { useState } from "react";
import { useGetJob, useUpdateJob, getGetJobQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Briefcase, CalendarDays, Calendar, Info, DollarSign, CheckCircle, ChevronLeft, Trophy, XCircle, Plus, Clock, User, MessageCircle, Bell, BellOff, Copy, Mail, Truck, Wrench } from "lucide-react";
import { AssignUser } from "@/components/assign-user";
import { Button } from "@/components/ui/button";
import { SkyInlineButton } from "@/components/sky";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AppointmentForm, type AppointmentFormValues } from "@/components/calendar/AppointmentForm";
import { useUser } from "@clerk/react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function apiFetch(path: string) {
  return fetch(`${BASE}${path}`, { credentials: "include" }).then((r) => r.json());
}

const APT_COLORS = {
  inspection: "bg-blue-100 text-blue-800",
  delivery: "bg-emerald-100 text-emerald-800",
  installation: "bg-orange-100 text-orange-800",
};

const STAGES = [
  { id: "enquiry", label: "Enquiry" },
  { id: "inspection", label: "Inspection" },
  { id: "quoting", label: "Quoting" },
  { id: "quoted", label: "Quoted" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
  { id: "closed", label: "Closed" },
];

const TERMINAL_STAGES = ["won", "lost", "closed"];

export default function JobDetail() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const updateJob = useUpdateJob();
  const { toast } = useToast();
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as string) || "guest";
  const canEdit = role === "admin" || role === "user";
  const [showCloseOptions, setShowCloseOptions] = useState(false);
  const [aptFormOpen, setAptFormOpen] = useState(false);
  const [aptFormInitial, setAptFormInitial] = useState<Partial<AppointmentFormValues>>({});

  const { data: appointments = [], refetch: refetchApts } = useQuery<any[]>({
    queryKey: ["/api/appointments", "job", id],
    queryFn: () => apiFetch(`/api/appointments?jobId=${id}`),
    enabled: !!id,
  });
  
  const { data: job, isLoading, error } = useGetJob(id, { 
    query: { enabled: !!id, queryKey: getGetJobQueryKey(id) } 
  });

  const handleStageChange = (newStage: string) => {
    updateJob.mutate({ id, data: { stage: newStage as any } }, {
      onSuccess: () => {
        toast({ title: "Job stage updated" });
        queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(id) });
        setShowCloseOptions(false);
      }
    });
  };

  const handleClose = (outcome: "won" | "lost" | "closed") => {
    handleStageChange(outcome);
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

  const isTerminal = TERMINAL_STAGES.includes(job.stage);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ChevronLeft className="h-4 w-4" /> Jobs Pipeline
        </Link>
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
              <SelectTrigger className="w-[160px]">
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
      </div>

      {/* Close Job Action */}
      {!isTerminal && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="pt-4 pb-4">
            {!showCloseOptions ? (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-semibold">Close this job</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Mark the outcome at any stage — no need to progress through all steps.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowCloseOptions(true)}
                  className="shrink-0 border-orange-300 hover:bg-orange-100"
                >
                  Close Job
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold">How would you like to close this job?</p>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => handleClose("won")}
                    disabled={updateJob.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white gap-2"
                  >
                    <Trophy className="h-4 w-4" /> Won
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleClose("lost")}
                    disabled={updateJob.isPending}
                    className="gap-2"
                  >
                    <XCircle className="h-4 w-4" /> Lost
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleClose("closed")}
                    disabled={updateJob.isPending}
                  >
                    Closed / Cancelled
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowCloseOptions(false)}
                    disabled={updateJob.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isTerminal && (
        <Card className={job.stage === "won" ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              {job.stage === "won" ? (
                <Trophy className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <div>
                <p className="text-sm font-semibold capitalize">Job {job.stage}</p>
                <p className="text-xs text-muted-foreground">Use the stage selector above to reopen this job if needed.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Job Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Job Type toggle */}
            {canEdit ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Job Type</p>
                <div className="flex rounded-xl border border-border overflow-hidden bg-muted/30 p-1 gap-1">
                  {[
                    { value: "full_install", label: "Full Install", icon: Wrench },
                    { value: "delivery_only", label: "Delivery Only", icon: Truck },
                  ].map(({ value, label, icon: Icon }) => {
                    const current = (job as any).jobType || "full_install";
                    const active = current === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={updateJob.isPending}
                        onClick={() => updateJob.mutate({ id, data: { jobType: value } as any }, {
                          onSuccess: () => {
                            toast({ title: `Job type updated to ${label}` });
                            queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(id) });
                          }
                        })}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                          active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {((job as any).jobType || "full_install") === "full_install"
                    ? "Includes delivery, placement, stand or plinth, and full pipe connection."
                    : "Tank delivered to site only. Customer handles placement and connection."}
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                {((job as any).jobType || "full_install") === "full_install"
                  ? <Wrench className="h-5 w-5 text-muted-foreground mt-0.5" />
                  : <Truck className="h-5 w-5 text-muted-foreground mt-0.5" />}
                <div>
                  <p className="text-sm font-medium">Job Type</p>
                  <p className="text-sm text-muted-foreground">
                    {((job as any).jobType || "full_install") === "full_install" ? "Full Install" : "Delivery Only"}
                  </p>
                </div>
              </div>
            )}

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

      {/* Customer Updates Card */}
      {(() => {
        const j = job as any;
        const hasEmail = !!j.customerEmail;
        const hasPhone = !!j.customerPhone;
        const token = j.customerToken;
        const notifEnabled = j.notificationsEnabled ?? true;
        const trackingUrl = token
          ? `${window.location.origin}${BASE}/track/${token}`
          : null;

        const handleToggleNotifications = () => {
          updateJob.mutate(
            { id, data: { notificationsEnabled: !notifEnabled } as any },
            {
              onSuccess: () => {
                toast({ title: notifEnabled ? "Notifications turned off" : "Notifications turned on" });
                queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(id) });
              },
            }
          );
        };

        const handleCopyLink = () => {
          if (trackingUrl) {
            navigator.clipboard.writeText(trackingUrl);
            toast({ title: "Tracking link copied" });
          }
        };

        const whatsappUrl = hasPhone
          ? `https://wa.me/${j.customerPhone.replace(/\D/g, "").replace(/^0/, "27")}?text=${encodeURIComponent(`Hi, this is Firesky Industries reaching out regarding your job: ${job.title}.`)}`
          : null;

        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Updates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Notifications toggle */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {notifEnabled ? (
                    <Bell className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  ) : (
                    <BellOff className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Email notifications</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hasEmail
                        ? notifEnabled
                          ? `Automatic updates sent to ${j.customerEmail}`
                          : "Notifications are off for this job"
                        : "No customer email on record — add one to enable updates"}
                    </p>
                  </div>
                </div>
                {hasEmail && canEdit && (
                  <Switch
                    checked={notifEnabled}
                    onCheckedChange={handleToggleNotifications}
                    disabled={updateJob.isPending}
                  />
                )}
              </div>

              {/* Tracking link */}
              {hasEmail && trackingUrl && (
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Customer tracking link</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{trackingUrl}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLink}
                      className="mt-2 gap-1.5 h-7 text-xs"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy link
                    </Button>
                  </div>
                </div>
              )}

              {/* WhatsApp */}
              {hasPhone && whatsappUrl && (
                <div className="flex items-start gap-3">
                  <MessageCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">WhatsApp</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{j.customerPhone}</p>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full hover:bg-green-100 transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Message on WhatsApp
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <AssignUser
            resourceType="jobs"
            resourceId={job.id}
            currentAssignedToId={(job as any).assignedToId}
            onAssigned={() => queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(id) })}
          />
        </CardContent>
      </Card>

      {/* Appointments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Appointments
          </CardTitle>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setAptFormInitial({ jobId: id, title: `${job.title}` });
                setAptFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Schedule
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 text-center">No appointments scheduled.</p>
          ) : (
            <div className="space-y-2">
              {appointments.map((apt: any) => (
                <button
                  key={apt.id}
                  onClick={() => {
                    const d = parseISO(apt.scheduledAt);
                    setAptFormInitial({
                      id: apt.id,
                      jobId: apt.jobId,
                      type: apt.type,
                      title: apt.title,
                      date: format(d, "yyyy-MM-dd"),
                      time: format(d, "HH:mm"),
                      durationMinutes: apt.durationMinutes,
                      travelBufferMinutes: apt.travelBufferMinutes,
                      assignedToId: apt.assignedToId || "",
                      assignedToName: apt.assignedToName || "",
                      notes: apt.notes || "",
                      status: apt.status,
                    });
                    setAptFormOpen(true);
                  }}
                  className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{apt.title}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 h-4 border-0 ${APT_COLORS[apt.type as keyof typeof APT_COLORS] || ""}`}>
                        {apt.type}
                      </Badge>
                      {apt.status !== "scheduled" && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                          {apt.status}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(parseISO(apt.scheduledAt), "EEE d MMM, h:mm a")} · {apt.durationMinutes}m
                      </span>
                      {apt.assignedToName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {apt.assignedToName}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AppointmentForm
        open={aptFormOpen}
        onClose={() => setAptFormOpen(false)}
        initial={aptFormInitial}
        onSaved={() => refetchApts()}
      />
    </div>
  );
}
