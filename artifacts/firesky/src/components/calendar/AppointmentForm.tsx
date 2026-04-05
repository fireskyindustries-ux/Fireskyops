import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  }).then(async (r) => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      const e: any = new Error(err.error || "Request failed");
      e.status = r.status;
      e.conflicting = err.conflicting;
      throw e;
    }
    return r.json();
  });
}

export interface AppointmentFormValues {
  id?: number;
  jobId: number | "";
  type: "inspection" | "delivery" | "installation";
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  travelBufferMinutes: number;
  assignedToId: string;
  assignedToName: string;
  notes: string;
  status: "scheduled" | "completed" | "cancelled";
}

const DEFAULT: AppointmentFormValues = {
  jobId: "",
  type: "inspection",
  title: "",
  date: format(new Date(), "yyyy-MM-dd"),
  time: "08:00",
  durationMinutes: 120,
  travelBufferMinutes: 30,
  assignedToId: "",
  assignedToName: "",
  notes: "",
  status: "scheduled",
};

const TYPE_LABELS = { inspection: "Site Inspection", delivery: "Tank Delivery", installation: "Installation" };
const DURATIONS = [
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
  { value: 180, label: "3 hours" },
  { value: 240, label: "4 hours" },
  { value: 360, label: "6 hours" },
  { value: 480, label: "8 hours" },
];
const BUFFERS = [
  { value: 0, label: "No buffer" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
];

interface ConflictInfo {
  title: string;
  scheduledAt: string;
  assignedToName: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Partial<AppointmentFormValues>;
  onSaved: () => void;
}

export function AppointmentForm({ open, onClose, initial, onSaved }: Props) {
  const [values, setValues] = useState<AppointmentFormValues>({ ...DEFAULT, ...initial });
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues({ ...DEFAULT, ...initial });
      setConflict(null);
      setError(null);
    }
  }, [open, initial]);

  // Auto-generate title when job or type changes
  useEffect(() => {
    if (!values.title || values.title === autoTitle(values.type, undefined)) {
      setValues((v) => ({ ...v, title: autoTitle(v.type, jobs?.find((j: any) => j.id === v.jobId)) }));
    }
  }, [values.type, values.jobId]);

  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
    queryFn: () => apiFetch("/api/jobs"),
    staleTime: 30_000,
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiFetch("/api/users"),
    staleTime: 60_000,
  });

  const set = (field: keyof AppointmentFormValues, value: any) => {
    setValues((v) => ({ ...v, [field]: value }));
    setConflict(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!values.jobId) { setError("Please select a job."); return; }
    if (!values.title.trim()) { setError("Please enter a title."); return; }
    if (!values.date || !values.time) { setError("Please set a date and time."); return; }

    const scheduledAt = new Date(`${values.date}T${values.time}:00`).toISOString();
    const payload = {
      jobId: Number(values.jobId),
      type: values.type,
      title: values.title.trim(),
      scheduledAt,
      durationMinutes: values.durationMinutes,
      travelBufferMinutes: values.travelBufferMinutes,
      assignedToId: values.assignedToId || undefined,
      assignedToName: values.assignedToName || undefined,
      notes: values.notes || undefined,
      status: values.status,
    };

    setSaving(true);
    setConflict(null);
    setError(null);

    try {
      if (values.id) {
        await apiFetch(`/api/appointments/${values.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/appointments", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      if (err.status === 409 && err.conflicting) {
        setConflict(err.conflicting);
      } else {
        setError(err.message || "Failed to save appointment.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!values.id || !confirm("Delete this appointment?")) return;
    setSaving(true);
    try {
      await apiFetch(`/api/appointments/${values.id}`, { method: "DELETE" });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const isEditing = !!values.id;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{isEditing ? "Edit Appointment" : "New Appointment"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Job */}
          <div className="space-y-1.5">
            <Label>Job</Label>
            <Select
              value={String(values.jobId || "")}
              onValueChange={(v) => {
                const job = jobs.find((j: any) => j.id === Number(v));
                set("jobId", Number(v));
                if (job) setValues((prev) => ({ ...prev, jobId: Number(v), title: autoTitle(prev.type, job) }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a job..." />
              </SelectTrigger>
              <SelectContent>
                {jobs.filter((j: any) => !["won", "lost", "closed"].includes(j.stage)).map((j: any) => (
                  <SelectItem key={j.id} value={String(j.id)}>
                    <span className="font-medium">{j.title}</span>
                    <span className="text-muted-foreground ml-2 text-xs capitalize">{j.stage}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Appointment type</Label>
            <div className="flex gap-2">
              {(["inspection", "delivery", "installation"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => set("type", t)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                    values.type === t
                      ? t === "inspection"
                        ? "bg-blue-600 text-white border-blue-600"
                        : t === "delivery"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-orange-600 text-white border-orange-600"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Appointment title"
            />
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={values.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Start time</Label>
              <Input type="time" value={values.time} onChange={(e) => set("time", e.target.value)} />
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <Label>Duration</Label>
            <Select value={String(values.durationMinutes)} onValueChange={(v) => set("durationMinutes", Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Travel buffer */}
          <div className="space-y-1.5">
            <Label>Travel buffer</Label>
            <Select value={String(values.travelBufferMinutes)} onValueChange={(v) => set("travelBufferMinutes", Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUFFERS.map((b) => (
                  <SelectItem key={b.value} value={String(b.value)}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Buffer time reserved before and after the appointment for travel.
            </p>
          </div>

          {/* Crew */}
          <div className="space-y-1.5">
            <Label>Crew member</Label>
            <Select
              value={values.assignedToId || "__none__"}
              onValueChange={(v) => {
                if (v === "__none__") {
                  set("assignedToId", "");
                  set("assignedToName", "");
                } else {
                  const u = users.find((u: any) => u.id === v);
                  set("assignedToId", v);
                  set("assignedToName", u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email : "");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {users.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {`${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status (edit only) */}
          {isEditing && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={values.status} onValueChange={(v) => set("status", v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Any notes for the crew..."
              rows={3}
            />
          </div>

          {/* Conflict warning */}
          {conflict && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 space-y-1">
              <div className="flex items-center gap-2 text-destructive text-sm font-semibold">
                <AlertCircle className="h-4 w-4" />
                Double-booking conflict
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>{conflict.assignedToName || "This crew member"}</strong> is already scheduled for{" "}
                <strong>{conflict.title}</strong> at{" "}
                {format(new Date(conflict.scheduledAt), "EEE d MMM, h:mm a")}.
                Including travel buffers, the times overlap. Please choose a different time or crew member.
              </p>
            </div>
          )}

          {/* Generic error */}
          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEditing ? "Save changes" : "Schedule"}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
          {isEditing && (
            <Button
              variant="ghost"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
              disabled={saving}
            >
              Delete appointment
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function autoTitle(type: string, job: any): string {
  const typeLabel = TYPE_LABELS[type as keyof typeof TYPE_LABELS] || type;
  if (job?.title) return `${typeLabel} - ${job.title}`;
  return typeLabel;
}
