import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addDays,
  subDays,
  eachDayOfInterval,
  isSameDay,
  isToday,
  isSameMonth,
  parseISO,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  List,
  Clock,
  User,
  Briefcase,
  LayoutGrid,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppointmentForm, type AppointmentFormValues } from "@/components/calendar/AppointmentForm";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function apiFetch(path: string) {
  return fetch(`${BASE}${path}`, { credentials: "include" }).then((r) => r.json());
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Appointment {
  id: number;
  jobId: number;
  jobTitle: string | null;
  customerName: string | null;
  type: "inspection" | "delivery" | "installation";
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  travelBufferMinutes: number;
  assignedToId: string | null;
  assignedToName: string | null;
  notes: string | null;
  status: "scheduled" | "completed" | "cancelled";
}

type ViewMode = "month" | "week" | "day" | "list";

// ─── Constants ────────────────────────────────────────────────────────────────
const START_HOUR = 6;
const END_HOUR = 19;
const SLOT_H = 64;
const TOTAL_H = (END_HOUR - START_HOUR) * SLOT_H;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TYPE_COLORS = {
  inspection: {
    bg: "bg-blue-100 border-blue-400",
    text: "text-blue-900",
    buffer: "bg-blue-50 border-blue-200",
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-800",
    monthBg: "bg-blue-100 border-l-2 border-blue-400 text-blue-900",
  },
  delivery: {
    bg: "bg-emerald-100 border-emerald-400",
    text: "text-emerald-900",
    buffer: "bg-emerald-50 border-emerald-200",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-800",
    monthBg: "bg-emerald-100 border-l-2 border-emerald-400 text-emerald-900",
  },
  installation: {
    bg: "bg-orange-100 border-orange-400",
    text: "text-orange-900",
    buffer: "bg-orange-50 border-orange-200",
    dot: "bg-orange-500",
    badge: "bg-orange-100 text-orange-800",
    monthBg: "bg-orange-100 border-l-2 border-orange-400 text-orange-900",
  },
};

const TYPE_LABELS = { inspection: "Inspection", delivery: "Delivery", installation: "Installation" };

function timeToY(dateStr: string): number {
  const d = parseISO(dateStr);
  const h = d.getHours() + d.getMinutes() / 60;
  return Math.max(0, (h - START_HOUR) * SLOT_H);
}

function toFormValues(apt: Appointment): Partial<AppointmentFormValues> {
  const d = parseISO(apt.scheduledAt);
  return {
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
  };
}

// ─── Appointment Block (week/day grid) ────────────────────────────────────────
function AptBlock({ apt, onClick }: { apt: Appointment; onClick: () => void }) {
  const colors = TYPE_COLORS[apt.type] || TYPE_COLORS.inspection;
  const y = timeToY(apt.scheduledAt);
  const h = (apt.durationMinutes / 60) * SLOT_H;
  const bufH = (apt.travelBufferMinutes / 60) * SLOT_H;
  const isCancelled = apt.status === "cancelled";
  const isCompleted = apt.status === "completed";

  return (
    <div className="absolute left-0.5 right-0.5" style={{ top: y }}>
      {bufH > 0 && (
        <div
          className={cn("absolute left-0 right-0 border-l-2 rounded-t opacity-50", colors.buffer)}
          style={{ top: -bufH, height: bufH }}
        />
      )}
      <button
        onClick={onClick}
        className={cn(
          "absolute left-0 right-0 border-l-2 rounded px-1.5 py-1 text-left overflow-hidden cursor-pointer",
          "hover:brightness-95 transition-all",
          isCancelled ? "opacity-40 line-through" : isCompleted ? "opacity-70" : "",
          colors.bg,
          colors.text
        )}
        style={{ height: Math.max(h, 20) }}
      >
        <p className="text-[10px] font-bold leading-tight truncate">{apt.title}</p>
        {h >= 40 && apt.assignedToName && (
          <p className="text-[9px] opacity-75 truncate">{apt.assignedToName}</p>
        )}
        {h >= 56 && (
          <p className="text-[9px] opacity-60">
            {format(parseISO(apt.scheduledAt), "h:mm a")} · {apt.durationMinutes}m
          </p>
        )}
      </button>
      {bufH > 0 && (
        <div
          className={cn("absolute left-0 right-0 border-l-2 rounded-b opacity-50", colors.buffer)}
          style={{ top: h, height: bufH }}
        />
      )}
    </div>
  );
}

// ─── Time Grid (shared by week + day views) ───────────────────────────────────
function TimeGrid({
  days,
  aptsByDay,
  canEdit,
  openNew,
  openEdit,
}: {
  days: Date[];
  aptsByDay: Map<string, Appointment[]>;
  canEdit: boolean;
  openNew: (date?: Date) => void;
  openEdit: (apt: Appointment) => void;
}) {
  return (
    <div className="flex-1 overflow-auto">
      {/* Day header row */}
      <div className="sticky top-0 z-20 bg-background border-b border-border flex">
        <div className="w-12 flex-shrink-0" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "flex-1 text-center py-2 text-xs border-l border-border",
              isToday(day) && "bg-primary/5"
            )}
          >
            <div className="font-medium text-muted-foreground">{format(day, "EEE")}</div>
            <div className={cn("font-bold text-sm", isToday(day) ? "text-primary" : "text-foreground")}>
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="flex" style={{ height: TOTAL_H }}>
        <div className="w-12 flex-shrink-0 relative">
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute right-1 text-[10px] text-muted-foreground leading-none"
              style={{ top: (h - START_HOUR) * SLOT_H - 6 }}
            >
              {h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`}
            </div>
          ))}
        </div>

        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayApts = aptsByDay.get(key) || [];
          return (
            <div
              key={key}
              className={cn(
                "flex-1 border-l border-border relative",
                isToday(day) && "bg-primary/[0.02]"
              )}
              style={{ height: TOTAL_H }}
              onDoubleClick={() => canEdit && openNew(day)}
            >
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-border/50"
                  style={{ top: (h - START_HOUR) * SLOT_H }}
                />
              ))}
              {dayApts.map((apt) => (
                <AptBlock key={apt.id} apt={apt} onClick={() => openEdit(apt)} />
              ))}
              {isToday(day) && (() => {
                const now = new Date();
                const ny = timeToY(now.toISOString());
                if (ny < 0 || ny > TOTAL_H) return null;
                return (
                  <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: ny }}>
                    <div className="h-0.5 bg-red-500" />
                    <div className="w-2 h-2 rounded-full bg-red-500 -mt-1 -ml-1" />
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Month Grid ───────────────────────────────────────────────────────────────
function MonthGrid({
  displayDays,
  anchorDate,
  aptsByDay,
  canEdit,
  openNew,
  openEdit,
  onDayClick,
}: {
  displayDays: Date[];
  anchorDate: Date;
  aptsByDay: Map<string, Appointment[]>;
  canEdit: boolean;
  openNew: (date?: Date) => void;
  openEdit: (apt: Appointment) => void;
  onDayClick: (day: Date) => void;
}) {
  return (
    <div className="flex-1 overflow-auto flex flex-col">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-border sticky top-0 bg-background z-10">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Grid cells */}
      <div className="grid grid-cols-7 flex-1">
        {displayDays.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const apts = aptsByDay.get(key) || [];
          const inMonth = isSameMonth(day, anchorDate);
          const maxVisible = 3;

          return (
            <div
              key={key}
              className={cn(
                "border-r border-b border-border min-h-[90px] p-1 cursor-pointer hover:bg-muted/20 transition-colors",
                !inMonth && "opacity-40 bg-muted/10",
                isToday(day) && "bg-primary/5"
              )}
              onClick={() => onDayClick(day)}
              onDoubleClick={(e) => { e.stopPropagation(); canEdit && openNew(day); }}
            >
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-0.5 select-none",
                  isToday(day)
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground"
                )}
              >
                {format(day, "d")}
              </div>

              <div className="space-y-0.5">
                {apts.slice(0, maxVisible).map((apt) => {
                  const colors = TYPE_COLORS[apt.type] || TYPE_COLORS.inspection;
                  return (
                    <div
                      key={apt.id}
                      className={cn(
                        "text-[10px] px-1 py-0.5 rounded truncate leading-tight",
                        colors.monthBg,
                        apt.status === "cancelled" && "opacity-40 line-through"
                      )}
                      onClick={(e) => { e.stopPropagation(); openEdit(apt); }}
                    >
                      {format(parseISO(apt.scheduledAt), "h:mm")} {apt.title}
                    </div>
                  );
                })}
                {apts.length > maxVisible && (
                  <div className="text-[10px] text-muted-foreground px-1 font-medium">
                    +{apts.length - maxVisible} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── List row ─────────────────────────────────────────────────────────────────
function AptListRow({ apt, onClick }: { apt: Appointment; onClick: () => void }) {
  const colors = TYPE_COLORS[apt.type] || TYPE_COLORS.inspection;
  const d = parseISO(apt.scheduledAt);
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-muted/40 transition-colors"
    >
      <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", colors.dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{apt.title}</span>
          <Badge className={cn("text-[10px] px-1.5 py-0 h-4 border-0", colors.badge)}>
            {TYPE_LABELS[apt.type]}
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
            {format(d, "h:mm a")} · {apt.durationMinutes}m
          </span>
          {apt.assignedToName && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {apt.assignedToName}
            </span>
          )}
          {apt.jobTitle && (
            <span className="flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {apt.jobTitle}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs text-muted-foreground flex-shrink-0 font-medium">
        {format(d, "EEE d MMM")}
      </span>
    </button>
  );
}

// ─── Main Calendar Page ───────────────────────────────────────────────────────
export default function CalendarPage() {
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as string) || "guest";
  const canEdit = role === "admin" || role === "user";
  const qc = useQueryClient();

  const [anchorDate, setAnchorDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("week");
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Partial<AppointmentFormValues>>({});

  // ── Compute range + display days from anchor + view ──────────────────────────
  const { rangeStart, rangeEnd, displayDays, title } = useMemo(() => {
    if (view === "month") {
      const mStart = startOfMonth(anchorDate);
      const mEnd = endOfMonth(anchorDate);
      const gridStart = startOfWeek(mStart, { weekStartsOn: 1 });
      const gridEnd = endOfWeek(mEnd, { weekStartsOn: 1 });
      return {
        rangeStart: gridStart,
        rangeEnd: gridEnd,
        displayDays: eachDayOfInterval({ start: gridStart, end: gridEnd }),
        title: format(anchorDate, "MMMM yyyy"),
      };
    }
    if (view === "day") {
      return {
        rangeStart: anchorDate,
        rangeEnd: anchorDate,
        displayDays: [anchorDate],
        title: format(anchorDate, "EEEE, d MMMM yyyy"),
      };
    }
    // week or list
    const ws = startOfWeek(anchorDate, { weekStartsOn: 1 });
    const we = endOfWeek(anchorDate, { weekStartsOn: 1 });
    return {
      rangeStart: ws,
      rangeEnd: we,
      displayDays: eachDayOfInterval({ start: ws, end: we }),
      title: `${format(ws, "d MMM")} – ${format(we, "d MMM yyyy")}`,
    };
  }, [view, anchorDate]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const navigate = (dir: 1 | -1) => {
    setAnchorDate((prev) => {
      if (view === "month") return dir === 1 ? addMonths(prev, 1) : subMonths(prev, 1);
      if (view === "day")   return dir === 1 ? addDays(prev, 1)   : subDays(prev, 1);
      return dir === 1 ? addWeeks(prev, 1) : subWeeks(prev, 1);
    });
  };

  const goToToday = () => setAnchorDate(new Date());

  // ── Data fetching ────────────────────────────────────────────────────────────
  const from = rangeStart.toISOString();
  const to = addDays(rangeEnd, 1).toISOString();

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments", from, to],
    queryFn: () => apiFetch(`/api/appointments?from=${from}&to=${to}`),
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/appointments"] });

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const openNew = (date?: Date) => {
    setFormInitial({ date: format(date || anchorDate, "yyyy-MM-dd") });
    setFormOpen(true);
  };

  const openEdit = (apt: Appointment) => {
    setFormInitial(toFormValues(apt));
    setFormOpen(true);
  };

  // ── Appointments mapped by day ───────────────────────────────────────────────
  const aptsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const d of displayDays) {
      map.set(format(d, "yyyy-MM-dd"), []);
    }
    for (const apt of appointments) {
      const key = format(parseISO(apt.scheduledAt), "yyyy-MM-dd");
      if (map.has(key)) map.get(key)!.push(apt);
    }
    return map;
  }, [appointments, displayDays]);

  const upcomingApts = useMemo(
    () =>
      [...appointments]
        .filter((a) => a.status !== "cancelled")
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    [appointments]
  );

  const VIEW_BUTTONS: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
    { id: "month", icon: <LayoutGrid className="h-3.5 w-3.5" />, label: "Month" },
    { id: "week",  icon: <CalendarDays className="h-3.5 w-3.5" />, label: "Week" },
    { id: "day",   icon: <Calendar className="h-3.5 w-3.5" />, label: "Day" },
    { id: "list",  icon: <List className="h-3.5 w-3.5" />, label: "List" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-background flex-shrink-0 flex-wrap gap-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToToday}
            className="text-sm font-semibold px-2 hover:text-primary transition-colors min-w-0 max-w-[220px] truncate"
            title={title}
          >
            {title}
          </button>
          <button
            onClick={() => navigate(1)}
            className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={goToToday}
            className="text-xs text-muted-foreground border border-border rounded-md px-2 h-7 hover:bg-muted transition-colors hidden sm:block"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {VIEW_BUTTONS.map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={cn(
                  "h-8 px-2.5 flex items-center gap-1.5 text-xs font-medium transition-colors border-l border-border first:border-l-0",
                  view === id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {canEdit && (
            <Button size="sm" className="gap-1.5 px-4" onClick={() => openNew()}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Schedule</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-b border-border bg-muted/30 flex-shrink-0">
        {Object.entries(TYPE_COLORS).map(([type, c]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={cn("w-2 h-2 rounded-full", c.dot)} />
            {TYPE_LABELS[type as keyof typeof TYPE_LABELS]}
          </div>
        ))}
        {(view === "week" || view === "day") && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
            <div className="w-3 h-1.5 bg-muted-foreground/30 rounded border" />
            Travel buffer
          </div>
        )}
      </div>

      {/* ── Month view ── */}
      {view === "month" && (
        <MonthGrid
          displayDays={displayDays}
          anchorDate={anchorDate}
          aptsByDay={aptsByDay}
          canEdit={canEdit}
          openNew={openNew}
          openEdit={openEdit}
          onDayClick={(day) => {
            setAnchorDate(day);
            setView("day");
          }}
        />
      )}

      {/* ── Week view ── */}
      {view === "week" && (
        <TimeGrid
          days={displayDays}
          aptsByDay={aptsByDay}
          canEdit={canEdit}
          openNew={openNew}
          openEdit={openEdit}
        />
      )}

      {/* ── Day view ── */}
      {view === "day" && (
        <TimeGrid
          days={displayDays}
          aptsByDay={aptsByDay}
          canEdit={canEdit}
          openNew={openNew}
          openEdit={openEdit}
        />
      )}

      {/* ── List view ── */}
      {view === "list" && (
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Loading appointments...
            </div>
          ) : upcomingApts.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground text-sm">No appointments this period.</p>
              {canEdit && (
                <Button size="sm" className="mt-4 gap-1.5" onClick={() => openNew()}>
                  <Plus className="h-4 w-4" />
                  Schedule something
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingApts.map((apt) => (
                <AptListRow key={apt.id} apt={apt} onClick={() => openEdit(apt)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Appointment form slide-over */}
      <AppointmentForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={formInitial}
        onSaved={invalidate}
      />
    </div>
  );
}
