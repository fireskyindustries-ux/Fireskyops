import { useState } from "react";
import { brand } from "@/brand.config";
import { useGetJob, useUpdateJob, getGetJobQueryKey, useListJobLoads, useCreateJobLoad, useUpdateJobLoad, useDeleteJobLoad } from "@workspace/api-client-react";
import type { JobLoad } from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { Briefcase, CalendarDays, Calendar, Info, DollarSign, CheckCircle, ChevronLeft, Trophy, XCircle, Plus, Clock, User, MessageCircle, Bell, BellOff, Copy, Mail, Truck, Wrench, ChevronDown, ChevronUp, Trash2, Package, Printer, FileDown, PenLine, ShieldCheck, CheckCircle2 } from "lucide-react";
import { SignaturePad } from "@/components/signature-pad";
import { generateJobPDF } from "@/lib/pdf-generator";
import { AssignUser } from "@/components/assign-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";

const LOAD_STATUS_STYLES: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pending",    color: "bg-gray-100 text-gray-700 border-gray-200" },
  scheduled:  { label: "Scheduled", color: "bg-blue-100 text-blue-700 border-blue-200" },
  in_transit: { label: "In Transit",color: "bg-amber-100 text-amber-700 border-amber-200" },
  delivered:  { label: "Delivered", color: "bg-green-100 text-green-700 border-green-200" },
};

function printDeliveryNote(job: any, loads: JobLoad[]) {
  const win = window.open("", "_blank");
  if (!win) return;

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const logoUrl = `${window.location.origin}${base}/firesky-logo-print.png`;

  const refNo = `DN-${String(job.id).padStart(5, "0")}`;
  const jobRef = `JOB-${String(job.id).padStart(5, "0")}`;
  const today = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  const j = job as any;

  const loadsRows = loads.length > 0
    ? loads.map(l => `
        <tr>
          <td>Load ${l.loadNumber}</td>
          <td>${l.tankQuantity && l.tankSize ? `${l.tankQuantity}x ${l.tankSize}` : l.tankSize || l.tankQuantity || "—"}</td>
          <td>${l.scheduledDate ? new Date(l.scheduledDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
          <td>${(l as any).driverName || "—"}</td>
          <td>${LOAD_STATUS_STYLES[l.status ?? "pending"]?.label ?? l.status ?? "—"}</td>
        </tr>`).join("")
    : `<tr><td colspan="5" style="text-align:center;color:#666;">No delivery loads recorded</td></tr>`;

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Delivery Note / Job Card ${refNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 32px 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 3px solid #e85d04; margin-bottom: 24px; }
    .company-name { font-size: 22px; font-weight: 800; letter-spacing: 1px; color: #111; text-transform: uppercase; }
    .company-tagline { font-size: 11px; color: #666; margin-top: 3px; }
    .doc-title { text-align: right; }
    .doc-title h1 { font-size: 26px; font-weight: 800; color: #e85d04; text-transform: uppercase; letter-spacing: 2px; }
    .doc-title .ref { font-size: 13px; color: #444; margin-top: 4px; }
    .doc-title .date { font-size: 12px; color: #666; margin-top: 2px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    .info-box { border: 1px solid #ddd; border-radius: 6px; padding: 14px 16px; }
    .info-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #e85d04; font-weight: 700; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
    .info-box p { margin-bottom: 5px; font-size: 13px; }
    .info-box p span { color: #555; font-size: 12px; display: inline-block; min-width: 80px; }
    .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #e85d04; font-weight: 700; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
    thead tr { background: #f5f5f5; }
    th { text-align: left; padding: 9px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; border-bottom: 2px solid #ddd; }
    td { padding: 9px 12px; border-bottom: 1px solid #eee; vertical-align: top; }
    tbody tr:last-child td { border-bottom: none; }
    .notes-box { border: 1px solid #ddd; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px; min-height: 60px; }
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 40px; }
    .sig-box { border-top: 2px solid #333; padding-top: 10px; }
    .sig-box .label { font-size: 12px; font-weight: 600; }
    .sig-box .sub { font-size: 11px; color: #666; margin-top: 4px; }
    .sig-line { height: 48px; border-bottom: 1px solid #aaa; margin: 16px 0 6px; }
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #ddd; text-align: center; font-size: 11px; color: #888; }
    .ordered-box { border: 2px solid #e85d04; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px; background: #fff8f5; }
    .ordered-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #e85d04; font-weight: 700; margin-bottom: 10px; border-bottom: 1px solid #fddccc; padding-bottom: 6px; }
    .ordered-row { display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; border-bottom: 1px solid #fddccc; }
    .ordered-row:last-child { border-bottom: none; }
    .ordered-row .item { font-size: 13px; font-weight: 600; }
    .ordered-row .qty { font-size: 12px; color: #555; }
    .ordered-total { margin-top: 8px; display: flex; justify-content: space-between; font-weight: 700; font-size: 14px; border-top: 2px solid #e85d04; padding-top: 8px; }
    @media print {
      body { padding: 16px 20px; }
      @page { margin: 16mm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <img src="${logoUrl}" alt="${brand.name}" style="height:72px;width:auto;display:block;" />
    </div>
    <div class="doc-title">
      <h1>Delivery Note / Job Card</h1>
      <div class="ref">Ref: ${refNo}</div>
      <div class="date">Date: ${today}</div>
    </div>
  </div>

  <div class="grid-2">
    <div class="info-box">
      <h3>Customer Details</h3>
      <p><span>Name:</span> ${job.customerName || "—"}</p>
      ${j.customerPhone ? `<p><span>Phone:</span> ${j.customerPhone}</p>` : ""}
      ${j.customerEmail ? `<p><span>Email:</span> ${j.customerEmail}</p>` : ""}
      ${j.customerVatNumber ? `<p><span>VAT No:</span> ${j.customerVatNumber}</p>` : ""}
    </div>
    <div class="info-box">
      <h3>Job Details</h3>
      <p><span>Reference:</span> ${jobRef}</p>
      ${j.jobType ? `<p><span>Type:</span> ${j.jobType}</p>` : ""}
      ${job.tankSize || job.tankQuantity ? `<p><span>Tanks:</span> ${job.tankQuantity ?? 1}x ${job.tankSize || "—"}</p>` : ""}
      ${j.assignedStaff ? `<p><span>Assigned:</span> ${j.assignedStaff}</p>` : ""}
    </div>
  </div>

  <div class="ordered-box">
    <h3>Goods Ordered</h3>
    ${(job.tankSize || job.tankQuantity) ? `
    <div class="ordered-row">
      <span class="item">${job.tankQuantity ?? 1}x ${job.tankSize || "Tank"}</span>
      <span class="qty">${((job as any).jobType || "full_install") === "delivery_only" ? "Delivery Only" : "Full Installation"}</span>
    </div>` : ""}
    ${(job as any).accessRisk ? `
    <div class="ordered-row">
      <span class="item">Site Access</span>
      <span class="qty">${(job as any).accessRisk} risk</span>
    </div>` : ""}
  </div>

  <div class="section-title">Delivery Loads</div>
  <table>
    <thead>
      <tr>
        <th>Load</th>
        <th>Items</th>
        <th>Scheduled Date</th>
        <th>Driver</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${loadsRows}
    </tbody>
  </table>

  ${job.notes ? `
  <div class="section-title">Notes</div>
  <div class="notes-box">${job.notes}</div>
  ` : ""}

  <div class="sig-grid">
    <div class="sig-box">
      <div class="label">Received by (Customer)</div>
      <div class="sub">By signing below, you confirm receipt of the above goods.</div>
      <div class="sig-line"></div>
      <div class="sub">Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: _______________</div>
    </div>
    <div class="sig-box">
      <div class="label">Delivered by (Driver / Agent)</div>
      <div class="sub">${brand.name} representative</div>
      <div class="sig-line"></div>
      <div class="sub">Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: _______________</div>
    </div>
  </div>

  <div class="footer">
    ${brand.name} &mdash; ${refNo} &mdash; Printed ${today}
  </div>

  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`);
  win.document.close();
}

function LoadCard({ load, jobId, canEdit }: { load: JobLoad; jobId: number; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const updateLoad = useUpdateJobLoad(jobId);
  const deleteLoad = useDeleteJobLoad(jobId);
  const { toast } = useToast();
  const { user } = useUser();
  const isAdmin = (user?.publicMetadata?.role as string) === "admin";

  const startEdit = () => {
    setForm({
      status: load.status,
      scheduledDate: load.scheduledDate ? load.scheduledDate.slice(0, 10) : "",
      deliveredAt: load.deliveredAt ? load.deliveredAt.slice(0, 10) : "",
      tankSize: load.tankSize ?? "",
      tankQuantity: load.tankQuantity ?? "",
      driverName: load.driverName ?? "",
      vehicleReg: load.vehicleReg ?? "",
      notes: load.notes ?? "",
    });
    setOpen(true);
  };

  const handleSave = () => {
    const data: any = {
      status: form.status,
      driverName: form.driverName || null,
      vehicleReg: form.vehicleReg || null,
      notes: form.notes || null,
      tankSize: form.tankSize || null,
      tankQuantity: form.tankQuantity ? Number(form.tankQuantity) : null,
      scheduledDate: form.scheduledDate || null,
      deliveredAt: form.deliveredAt || null,
    };
    updateLoad.mutate({ id: load.id, data }, {
      onSuccess: () => { toast({ title: `Load ${load.loadNumber} updated` }); setOpen(false); },
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    });
  };

  const style = LOAD_STATUS_STYLES[load.status] ?? LOAD_STATUS_STYLES.pending;

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
        onClick={() => canEdit ? startEdit() : setOpen(!open)}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
          {load.loadNumber}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Load {load.loadNumber}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {load.tankQuantity && load.tankSize ? `${load.tankQuantity}x ${load.tankSize}` : ""}
            {load.driverName ? ` · ${load.driverName}` : ""}
            {load.scheduledDate ? ` · ${format(new Date(load.scheduledDate), "d MMM")}` : ""}
          </p>
        </div>
        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", style.color)}>
          {style.label}
        </span>
        {canEdit ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : null}
      </button>

      {open && (
        <div className="border-t bg-muted/20 p-4 space-y-4">
          {canEdit ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
                  <div className="flex rounded-lg border overflow-hidden bg-background">
                    {Object.entries(LOAD_STATUS_STYLES).map(([val, s]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setForm((f: any) => ({ ...f, status: val }))}
                        className={cn(
                          "flex-1 py-1.5 text-xs font-semibold transition-all border-r last:border-r-0",
                          form.status === val ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scheduled Date</label>
                  <Input type="date" value={form.scheduledDate} onChange={e => setForm((f: any) => ({ ...f, scheduledDate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Delivered Date</label>
                  <Input type="date" value={form.deliveredAt} onChange={e => setForm((f: any) => ({ ...f, deliveredAt: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tank Size</label>
                  <Input placeholder="e.g. 10000L" value={form.tankSize} onChange={e => setForm((f: any) => ({ ...f, tankSize: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Qty</label>
                  <Input type="number" placeholder="1" value={form.tankQuantity} onChange={e => setForm((f: any) => ({ ...f, tankQuantity: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Driver</label>
                  <Input placeholder="Driver name" value={form.driverName} onChange={e => setForm((f: any) => ({ ...f, driverName: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vehicle Reg</label>
                  <Input placeholder="e.g. CA 123-456" value={form.vehicleReg} onChange={e => setForm((f: any) => ({ ...f, vehicleReg: e.target.value }))} />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</label>
                  <Textarea rows={2} placeholder="Load notes..." value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={updateLoad.isPending} className="flex-1">
                  {updateLoad.isPending ? "Saving..." : "Save Load"}
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="destructive" onClick={() => deleteLoad.mutate(load.id)} disabled={deleteLoad.isPending}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
            </>
          ) : (
            <div className="space-y-2 text-sm">
              {load.scheduledDate && <p><span className="font-medium">Scheduled:</span> {format(new Date(load.scheduledDate), "d MMM yyyy")}</p>}
              {load.deliveredAt && <p><span className="font-medium">Delivered:</span> {format(new Date(load.deliveredAt), "d MMM yyyy")}</p>}
              {load.driverName && <p><span className="font-medium">Driver:</span> {load.driverName}</p>}
              {load.vehicleReg && <p><span className="font-medium">Vehicle:</span> {load.vehicleReg}</p>}
              {load.notes && <p className="text-muted-foreground">{load.notes}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const updateJob = useUpdateJob();
  const { toast } = useToast();
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as string) || "guest";
  const canEdit = role === "admin" || role === "user";
  const { data: jobLoads = [] } = useListJobLoads(id);
  const createLoad = useCreateJobLoad(id);
  const [showCloseOptions, setShowCloseOptions] = useState(false);
  const [aptFormOpen, setAptFormOpen] = useState(false);
  const [aptFormInitial, setAptFormInitial] = useState<Partial<AppointmentFormValues>>({});
  const [editingPipeline, setEditingPipeline] = useState(false);
  const [pipelineForm, setPipelineForm] = useState<Record<string, any>>({});
  const [signingOff, setSigningOff] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

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

  const startEditPipeline = () => {
    const j = job as any;
    setPipelineForm({
      nextAction: j.nextAction ?? "",
      nextActionDate: j.nextActionDate ?? "",
      followUpDueDate: j.followUpDueDate ?? "",
      quoteSentDate: j.quoteSentDate ?? "",
      lostReason: j.lostReason ?? "",
      accessRisk: j.accessRisk ?? "",
    });
    setEditingPipeline(true);
  };

  const handleSavePipeline = () => {
    updateJob.mutate(
      {
        id,
        data: {
          nextAction: pipelineForm.nextAction || null,
          nextActionDate: pipelineForm.nextActionDate || null,
          followUpDueDate: pipelineForm.followUpDueDate || null,
          quoteSentDate: pipelineForm.quoteSentDate || null,
          lostReason: pipelineForm.lostReason || null,
          accessRisk: pipelineForm.accessRisk || null,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: "Pipeline details saved" });
          queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(id) });
          setEditingPipeline(false);
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  };

  const handleJobSignOff = (signatureDataUrl: string) => {
    const signedOffBy = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Unknown";
    updateJob.mutate(
      {
        id,
        data: {
          signatureUrl: signatureDataUrl,
          signedOffBy,
          signedOffAt: new Date() as any,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: "Job signed off", description: `Signed by ${signedOffBy}` });
          queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(id) });
          setSigningOff(false);
        },
        onError: () => toast({ title: "Failed to save sign-off", variant: "destructive" }),
      }
    );
  };

  const handleJobDownloadPDF = async () => {
    if (!job) return;
    setPdfLoading(true);
    try {
      await generateJobPDF(job);
    } catch {
      toast({ title: "Failed to generate PDF", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
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
        <button onClick={() => navigate("/jobs")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ChevronLeft className="h-4 w-4" /> Jobs Pipeline
        </button>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight mb-2 w-full">{job.title}</h1>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {job.priority && (
                <Badge variant={job.priority === "high" ? "destructive" : job.priority === "medium" ? "default" : "outline"} className="uppercase">
                  {job.priority}
                </Badge>
              )}
              {(job as any).signatureUrl && (
                <Badge className="bg-blue-500 hover:bg-blue-600 text-white gap-1">
                  <ShieldCheck className="h-3 w-3" /> Signed Off
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
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => printDeliveryNote(job, jobLoads)}
            >
              <Printer className="h-4 w-4" />
              Delivery Note
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleJobDownloadPDF}
              disabled={pdfLoading}
            >
              <FileDown className="h-4 w-4" />
              {pdfLoading ? "Generating..." : "PDF Report"}
            </Button>
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

      {/* Delivery Loads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Delivery Loads
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {jobLoads.length === 0
                ? "No loads added yet"
                : `${jobLoads.filter(l => l.status === "delivered").length} of ${jobLoads.length} delivered`}
            </p>
          </div>
          {canEdit && jobLoads.length < 10 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
              disabled={createLoad.isPending}
              onClick={() => {
                const nextNum = jobLoads.length > 0 ? Math.max(...jobLoads.map(l => l.loadNumber)) + 1 : 1;
                createLoad.mutate({
                  loadNumber: nextNum,
                  status: "pending",
                  tankSize: job.tankSize ?? undefined,
                  tankQuantity: job.tankQuantity ?? undefined,
                }, {
                  onSuccess: () => toast({ title: `Load ${nextNum} added` }),
                  onError: () => toast({ title: "Failed to add load", variant: "destructive" }),
                });
              }}
            >
              <Plus className="h-4 w-4" />
              Add Load
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {jobLoads.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Truck className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Add loads to track bulk deliveries (Load 1, Load 2 ...)</p>
            </div>
          ) : (
            <>
              {/* Progress bar */}
              <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted mb-3">
                {jobLoads.map((load) => (
                  <div
                    key={load.id}
                    className={cn(
                      "flex-1 transition-colors",
                      load.status === "delivered" ? "bg-green-500" :
                      load.status === "in_transit" ? "bg-amber-400" :
                      load.status === "scheduled" ? "bg-blue-400" : "bg-muted-foreground/20"
                    )}
                  />
                ))}
              </div>
              {jobLoads.map((load) => (
                <LoadCard key={load.id} load={load} jobId={id} canEdit={canEdit} />
              ))}
            </>
          )}
        </CardContent>
      </Card>

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

        const whatsappMessage = trackingUrl
          ? `Hi${j.customerName ? ` ${j.customerName}` : ""}, here is your ${brand.name} job tracking link for *${job.title}*. You can use this to follow your progress at any time: ${trackingUrl}`
          : `Hi${j.customerName ? ` ${j.customerName}` : ""}, this is ${brand.name} reaching out regarding your job: *${job.title}*.`;
        const whatsappUrl = hasPhone
          ? `https://wa.me/${j.customerPhone.replace(/\D/g, "").replace(/^0/, "27")}?text=${encodeURIComponent(whatsappMessage)}`
          : trackingUrl
          ? `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`
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
              {whatsappUrl && (
                <div className="flex items-start gap-3">
                  <MessageCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">WhatsApp</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hasPhone ? j.customerPhone : "Send tracking link via WhatsApp"}
                    </p>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium bg-[#25D366] text-white px-3 py-1.5 rounded-full hover:bg-[#1ebe5d] transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {hasPhone ? "Send tracking link" : "Send via WhatsApp"}
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

      {/* Pipeline Details — edit form */}
      {canEdit && editingPipeline && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pipeline Details</CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingPipeline(false)}>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-sm font-medium">Next Action</label>
                <Input value={pipelineForm.nextAction} onChange={e => setPipelineForm((p: any) => ({ ...p, nextAction: e.target.value }))} placeholder="e.g. Send revised quote" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Next Action Date</label>
                <Input type="date" value={pipelineForm.nextActionDate} onChange={e => setPipelineForm((p: any) => ({ ...p, nextActionDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Follow-up Due Date</label>
                <Input type="date" value={pipelineForm.followUpDueDate} onChange={e => setPipelineForm((p: any) => ({ ...p, followUpDueDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Quote Sent Date</label>
                <Input type="date" value={pipelineForm.quoteSentDate} onChange={e => setPipelineForm((p: any) => ({ ...p, quoteSentDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Access Risk</label>
                <Select value={pipelineForm.accessRisk || ""} onValueChange={v => setPipelineForm((p: any) => ({ ...p, accessRisk: v || null }))}>
                  <SelectTrigger><SelectValue placeholder="Select risk level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-sm font-medium">Lost Reason</label>
                <Textarea value={pipelineForm.lostReason} onChange={e => setPipelineForm((p: any) => ({ ...p, lostReason: e.target.value }))} placeholder="Why was this job lost?" rows={2} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSavePipeline} disabled={updateJob.isPending} className="gap-2">
                <MessageCircle className="h-4 w-4" />
                {updateJob.isPending ? "Saving..." : "Save Details"}
              </Button>
              <Button variant="outline" onClick={() => setEditingPipeline(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pipeline Details — display card */}
      {(() => {
        const j = job as any;
        const hasAny = j.nextAction || j.nextActionDate || j.followUpDueDate || j.quoteSentDate || j.lostReason || j.accessRisk;
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">Pipeline Details</CardTitle>
              {canEdit && !editingPipeline && (
                <Button variant="outline" size="sm" className="gap-2" onClick={startEditPipeline}>
                  <MessageCircle className="h-4 w-4" /> Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!hasAny ? (
                <p className="text-sm text-muted-foreground py-2 text-center">No pipeline details recorded.</p>
              ) : (
                <div className="space-y-3">
                  {j.nextAction && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Next Action</p>
                      <p className="text-sm mt-0.5">{j.nextAction}</p>
                    </div>
                  )}
                  {j.nextActionDate && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Next Action Date</p>
                      <p className="text-sm mt-0.5">{format(new Date(j.nextActionDate), "d MMM yyyy")}</p>
                    </div>
                  )}
                  {j.followUpDueDate && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Follow-up Due</p>
                      <p className="text-sm mt-0.5">{format(new Date(j.followUpDueDate), "d MMM yyyy")}</p>
                    </div>
                  )}
                  {j.quoteSentDate && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quote Sent</p>
                      <p className="text-sm mt-0.5">{format(new Date(j.quoteSentDate), "d MMM yyyy")}</p>
                    </div>
                  )}
                  {j.accessRisk && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Access Risk</p>
                      <p className={`text-sm font-medium mt-0.5 capitalize ${j.accessRisk === "high" ? "text-red-600" : j.accessRisk === "medium" ? "text-amber-600" : "text-green-600"}`}>
                        {j.accessRisk}
                      </p>
                    </div>
                  )}
                  {j.lostReason && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lost Reason</p>
                      <p className="text-sm mt-0.5 text-muted-foreground">{j.lostReason}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

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

      {/* Digital Sign-Off */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              Digital Sign-Off
            </CardTitle>
            {!signingOff && canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSigningOff(true)}
                className={(job as any).signatureUrl ? "text-muted-foreground" : "border-green-300 text-green-700 hover:bg-green-50"}
              >
                <PenLine className="h-4 w-4 mr-1.5" />
                {(job as any).signatureUrl ? "Re-sign" : "Sign Off"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {signingOff ? (
            <SignaturePad
              onSave={handleJobSignOff}
              onCancel={() => setSigningOff(false)}
            />
          ) : (job as any).signatureUrl ? (
            <div className="space-y-3">
              <div className="border rounded-lg overflow-hidden bg-white p-2 inline-block">
                <img
                  src={(job as any).signatureUrl}
                  alt="Customer signature"
                  className="h-20 w-auto max-w-xs object-contain"
                />
              </div>
              <div className="text-sm space-y-0.5">
                <p className="font-medium text-green-700 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Signed off by {(job as any).signedOffBy || "Unknown"}
                </p>
                {(job as any).signedOffAt && (
                  <p className="text-muted-foreground text-xs">
                    {format(new Date((job as any).signedOffAt), "PPP 'at' p")}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-4 text-center space-y-2">
              <PenLine className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                No sign-off yet. Tap "Sign Off" to capture a customer signature.
              </p>
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
