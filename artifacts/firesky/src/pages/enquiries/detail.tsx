import { useState, useRef } from "react";
import { brand } from "@/brand.config";
import { useGetEnquiry, useUpdateEnquiry, getGetEnquiryQueryKey } from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { ClipboardCheck, Briefcase, AlignLeft, Info, Calendar, ChevronLeft, Pencil, Save, X, CheckCircle2, ExternalLink, FileText, Send, Upload, Clock, ThumbsUp, ThumbsDown, MessageCircle, Printer } from "lucide-react";
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

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function printEnquiry(enquiry: any) {
  const win = window.open("", "_blank");
  if (!win) return;

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const logoUrl = `${window.location.origin}${base}/firesky-logo-print.png`;
  const refNo = `ENQ-${String(enquiry.id).padStart(5, "0")}`;
  const today = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  const statusLabel: Record<string, string> = {
    new: "New", in_progress: "In Progress", inspection_done: "Inspection Done",
    quoted: "Quoted", won: "Won", lost: "Lost", closed: "Closed",
  };
  const priorityLabel: Record<string, string> = { low: "Low", medium: "Medium", high: "High" };

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Enquiry ${refNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 32px 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 3px solid #e85d04; margin-bottom: 24px; }
    .doc-title h1 { font-size: 24px; font-weight: 800; color: #e85d04; text-transform: uppercase; letter-spacing: 2px; text-align: right; }
    .doc-title .ref { font-size: 13px; color: #444; margin-top: 4px; text-align: right; }
    .doc-title .date { font-size: 12px; color: #666; margin-top: 2px; text-align: right; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .info-box { border: 1px solid #ddd; border-radius: 6px; padding: 14px 16px; }
    .info-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #e85d04; font-weight: 700; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
    .info-box p { margin-bottom: 5px; font-size: 13px; }
    .info-box p span { color: #555; font-size: 12px; display: inline-block; min-width: 90px; }
    .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #e85d04; font-weight: 700; margin-bottom: 8px; margin-top: 16px; }
    .text-block { border: 1px solid #ddd; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #ddd; text-align: center; font-size: 11px; color: #888; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; background: #f5f5f5; color: #333; border: 1px solid #ddd; }
    @media print { body { padding: 16px 20px; } @page { margin: 16mm; size: A4; } }
  </style>
</head>
<body>
  <div class="header">
    <div><img src="${logoUrl}" alt="Firesky" style="height:64px;width:auto;display:block;" /></div>
    <div class="doc-title">
      <h1>Enquiry</h1>
      <div class="ref">Ref: ${refNo}</div>
      <div class="date">Printed: ${today}</div>
    </div>
  </div>

  <div class="grid-2">
    <div class="info-box">
      <h3>Customer</h3>
      <p>${enquiry.customerName || "—"}</p>
    </div>
    <div class="info-box">
      <h3>Enquiry Details</h3>
      <p><span>Title:</span> ${enquiry.title || "—"}</p>
      <p><span>Status:</span> ${statusLabel[enquiry.status] || enquiry.status || "—"}</p>
      <p><span>Priority:</span> ${priorityLabel[enquiry.priority] || enquiry.priority || "—"}</p>
      ${enquiry.tankSize || enquiry.tankQuantity ? `<p><span>Tank:</span> ${enquiry.tankQuantity ?? 1}x ${enquiry.tankSize || "—"}</p>` : ""}
      ${enquiry.assignedStaff ? `<p><span>Assigned:</span> ${enquiry.assignedStaff}</p>` : ""}
    </div>
  </div>

  ${enquiry.description ? `<div class="section-title">Description</div><div class="text-block">${enquiry.description}</div>` : ""}
  ${enquiry.notes ? `<div class="section-title">Internal Notes</div><div class="text-block">${enquiry.notes}</div>` : ""}
  ${enquiry.nextAction ? `<div class="section-title">Next Action</div><div class="text-block">${enquiry.nextAction}</div>` : ""}

  <div class="footer">${brand.name} &mdash; ${refNo} &mdash; Printed ${today}</div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`);
  win.document.close();
}

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
  quoteToken,
}: {
  status: string;
  enquiryId: number;
  inspectionId?: number | null;
  jobId?: number | null;
  quoteToken?: string | null;
}) {
  const isLost = status === "lost" || status === "closed";
  const statusReached = STATUS_STEP[status] ?? 0;

  // Step reached: use real artifact IDs where available, status otherwise
  const stepReached = (i: number) => {
    if (i === 0) return true;
    if (i === 1) return !!inspectionId || statusReached >= 1;
    if (i === 2) return !!quoteToken || statusReached >= 2;
    if (i === 3) return !!jobId || statusReached >= 3;
    return false;
  };

  const currentStep = PIPELINE_LABELS.reduce(
    (acc, _, i) => (stepReached(i) ? i : acc),
    0,
  );

  const getHref = (i: number) => {
    if (i === 1 && inspectionId) return `/inspections/${inspectionId}`;
    if (i === 2 && quoteToken) return `/quote/${quoteToken}`;
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

function SendQuoteSection({
  enquiryId,
  customerId,
  quoteId,
  quoteToken,
  quoteStatus,
  quotePaymentProofUrl,
  customerName,
  onSent,
}: {
  enquiryId: number;
  customerId: number;
  quoteId?: number | null;
  quoteToken?: string | null;
  quoteStatus?: string | null;
  quotePaymentProofUrl?: string | null;
  customerName?: string | null;
  onSent: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const { toast } = useToast();

  const uploadAndSubmit = async (isReplace: boolean) => {
    if (!selectedFile) {
      toast({ title: "Please select a PDF file", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      // Step 1: Request presigned upload URL
      const urlRes = await fetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedFile.name,
          size: selectedFile.size,
          contentType: selectedFile.type || "application/pdf",
        }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      // Step 2: Upload directly to presigned URL
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": selectedFile.type || "application/pdf" },
      });
      if (!uploadRes.ok) throw new Error("File upload failed");

      // Step 3: Create or replace quote record
      const quoteRes = isReplace && quoteId
        ? await fetch(`${BASE}/api/quotes/${quoteId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileUrl: objectPath, notes: notes || null }),
          })
        : await fetch(`${BASE}/api/quotes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enquiryId, customerId, fileUrl: objectPath, notes: notes || null }),
          });

      if (!quoteRes.ok) {
        const j = await quoteRes.json();
        throw new Error(j.error || "Failed to save quote");
      }

      toast({ title: isReplace ? "Quote replaced and re-sent to customer" : "Quote sent to customer" });
      setSelectedFile(null);
      setNotes("");
      setReplacing(false);
      if (fileRef.current) fileRef.current.value = "";
      onSent();
    } catch (e: any) {
      toast({ title: e.message || "Something went wrong", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSend = () => uploadAndSubmit(false);
  const handleReplace = () => uploadAndSubmit(true);

  const quoteStatusColors: Record<string, string> = {
    sent: "bg-cyan-50 border-cyan-200 text-cyan-700",
    accepted: "bg-green-50 border-green-200 text-green-700",
    rejected: "bg-red-50 border-red-200 text-red-700",
  };

  const quoteStatusLabel: Record<string, string> = {
    sent: "Awaiting customer response",
    accepted: "Customer accepted",
    rejected: "Customer declined",
  };

  return (
    <Card className={quoteId ? (quoteStatus === "accepted" ? "border-green-200" : quoteStatus === "rejected" ? "border-red-200" : "border-cyan-200") : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Quote
        </CardTitle>
      </CardHeader>
      <CardContent>
        {quoteId && !replacing ? (
          <div className="space-y-3">
            <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium", quoteStatusColors[quoteStatus ?? "sent"] ?? "bg-gray-50 border-gray-200 text-gray-600")}>
              {quoteStatus === "accepted" && <ThumbsUp className="h-4 w-4" />}
              {quoteStatus === "rejected" && <ThumbsDown className="h-4 w-4" />}
              {quoteStatus === "sent" && <Clock className="h-4 w-4" />}
              {quoteStatusLabel[quoteStatus ?? "sent"] ?? quoteStatus}
            </div>
            {quotePaymentProofUrl && (
              <a
                href={`${BASE}/api/storage${quotePaymentProofUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-200 bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors w-fit"
              >
                <CheckCircle2 className="h-4 w-4" />
                Proof of payment received — view file
              </a>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {quoteToken && (
                <a
                  href={`${BASE}/quote/${quoteToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View customer quote page
                </a>
              )}
              {quoteToken && (
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    brand.whatsapp.quoteReady(customerName, `${window.location.origin}${BASE}/quote/${quoteToken}`)
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#25D366] text-white hover:bg-[#1ebe5d] transition-colors"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Send via WhatsApp
                </a>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={() => { setReplacing(true); setSelectedFile(null); setNotes(""); }}
              >
                <Upload className="h-3.5 w-3.5" />
                Replace Quote
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {replacing && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Upload className="h-4 w-4" />
                Uploading a new PDF will replace the current quote and re-send the email to the customer.
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {replacing
                ? "Select the corrected PDF to send to the customer."
                : "Upload a PDF quote to send to the customer. They will receive an email with a link to review and accept or decline."}
            </p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Quote PDF</label>
              <div
                className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-4 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground" />
                {selectedFile ? (
                  <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Click to select a PDF file</p>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Note to customer (optional)</label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any message to include with the quote..."
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={replacing ? handleReplace : handleSend}
                disabled={uploading || !selectedFile}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {uploading
                  ? (replacing ? "Replacing..." : "Sending...")
                  : (replacing ? "Replace & Re-send to Customer" : "Send Quote to Customer")}
              </Button>
              {replacing && (
                <Button variant="outline" onClick={() => { setReplacing(false); setSelectedFile(null); }}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function EnquiryDetail() {
  const params = useParams();
  const id = Number(params.id);
  const [, navigate] = useLocation();
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
      nextAction: enquiry?.nextAction ?? "",
      nextActionDate: enquiry?.nextActionDate ?? "",
      followUpDueDate: enquiry?.followUpDueDate ?? "",
      assignedStaff: enquiry?.assignedStaff ?? "",
    });
    setEditing(true);
  };

  const handleSave = () => {
    const payload: any = {
      title: editForm.title,
      status: editForm.status,
      priority: editForm.priority,
      nextAction: editForm.nextAction || null,
      nextActionDate: editForm.nextActionDate || null,
      followUpDueDate: editForm.followUpDueDate || null,
      assignedStaff: editForm.assignedStaff || null,
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
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <button onClick={() => navigate("/enquiries")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ChevronLeft className="h-4 w-4" /> Enquiries
          </button>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight mb-2 w-full">{enquiry.title}</h1>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
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
              quoteToken={enquiry.quoteToken}
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
          <Button variant="outline" className="w-full sm:w-auto gap-2" onClick={() => printEnquiry(enquiry)}>
            <Printer className="h-4 w-4" /> Print
          </Button>

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
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1 block">Next Action</label>
                <Input value={editForm.nextAction} onChange={e => setEditForm(p => ({ ...p, nextAction: e.target.value }))} placeholder="e.g. Call customer to confirm site visit" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Next Action Date</label>
                <Input type="date" value={editForm.nextActionDate} onChange={e => setEditForm(p => ({ ...p, nextActionDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Follow-up Due Date</label>
                <Input type="date" value={editForm.followUpDueDate} onChange={e => setEditForm(p => ({ ...p, followUpDueDate: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1 block">Assigned Staff</label>
                <Input value={editForm.assignedStaff} onChange={e => setEditForm(p => ({ ...p, assignedStaff: e.target.value }))} placeholder="e.g. John Smith" />
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

      {/* Follow-up details — show when any pipeline field is set */}
      {(enquiry.nextAction || enquiry.nextActionDate || enquiry.followUpDueDate || enquiry.assignedStaff) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Follow-up Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {enquiry.assignedStaff && (
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assigned Staff</p>
                  <p className="text-sm">{enquiry.assignedStaff}</p>
                </div>
              </div>
            )}
            {enquiry.nextAction && (
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Next Action</p>
                  <p className="text-sm">{enquiry.nextAction}</p>
                </div>
              </div>
            )}
            {enquiry.nextActionDate && (
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Next Action Date</p>
                  <p className="text-sm">{format(new Date(enquiry.nextActionDate), "d MMM yyyy")}</p>
                </div>
              </div>
            )}
            {enquiry.followUpDueDate && (
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Follow-up Due</p>
                  <p className="text-sm">{format(new Date(enquiry.followUpDueDate), "d MMM yyyy")}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quote section — always visible for admin/user */}
      {canEdit && (
        <SendQuoteSection
          enquiryId={enquiry.id}
          customerId={enquiry.customerId}
          quoteId={enquiry.quoteId}
          quoteToken={enquiry.quoteToken}
          quoteStatus={enquiry.quoteStatus}
          quotePaymentProofUrl={enquiry.quotePaymentProofUrl}
          customerName={enquiry.customerName}
          onSent={() => queryClient.invalidateQueries({ queryKey: getGetEnquiryQueryKey(id) })}
        />
      )}
    </div>
  );
}
