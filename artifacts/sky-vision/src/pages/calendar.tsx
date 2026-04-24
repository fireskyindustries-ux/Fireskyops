import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isSameMonth, isToday, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X, MapPin, Clock, Tag, Trash2, Pencil, Loader2, CalendarDays, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface DiaryEvent {
  id: number;
  title: string;
  description?: string;
  start_at: string;
  end_at?: string;
  all_day: boolean;
  type: string;
  status: string;
  location?: string;
  color: string;
}

const COLOR_MAP: Record<string, string> = {
  orange: "bg-orange-500",
  blue:   "bg-blue-500",
  green:  "bg-green-500",
  red:    "bg-red-500",
  purple: "bg-purple-500",
};

const COLOR_BORDER: Record<string, string> = {
  orange: "border-orange-500",
  blue:   "border-blue-500",
  green:  "border-green-500",
  red:    "border-red-500",
  purple: "border-purple-500",
};

const TYPE_LABELS: Record<string, string> = {
  event: "Event", meeting: "Meeting", task: "Task", reminder: "Reminder",
};

function formatTime(iso: string) {
  try { return format(parseISO(iso), "HH:mm"); } catch { return ""; }
}

function formatDateTime(iso: string) {
  try { return format(parseISO(iso), "EEE d MMM, HH:mm"); } catch { return ""; }
}

interface EventFormData {
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  type: string;
  location: string;
  color: string;
}

const BLANK_FORM: EventFormData = {
  title: "", description: "", start_at: "", end_at: "",
  all_day: false, type: "event", location: "", color: "orange",
};

function toLocalInput(iso: string) {
  if (!iso) return "";
  try {
    const d = parseISO(iso);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  } catch { return ""; }
}

function fromLocalInput(val: string) {
  if (!val) return "";
  try { return new Date(val).toISOString(); } catch { return val; }
}

function dateToLocalInput(date: Date) {
  return format(date, "yyyy-MM-dd'T'09:00");
}

export function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<DiaryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<DiaryEvent | null>(null);
  const [form, setForm] = useState<EventFormData>(BLANK_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const fetchEvents = useCallback(async (month: Date) => {
    setIsLoading(true);
    const from = format(startOfMonth(month), "yyyy-MM-01'T'00:00:00'Z'");
    const to = format(endOfMonth(month), "yyyy-MM-dd'T'23:59:59'Z'");
    try {
      const r = await fetch(`/api/sky-vision/diary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
        credentials: "include",
      });
      const data = await r.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Failed to load events", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchEvents(currentMonth); }, [currentMonth, fetchEvents]);

  const prevMonth = () => { const m = subMonths(currentMonth, 1); setCurrentMonth(m); setSelectedDay(null); };
  const nextMonth = () => { const m = addMonths(currentMonth, 1); setCurrentMonth(m); setSelectedDay(null); };
  const goToday   = () => { setCurrentMonth(new Date()); setSelectedDay(new Date()); };

  const eventsOnDay = (day: Date) =>
    events.filter((e) => {
      try { return isSameDay(parseISO(e.start_at), day); } catch { return false; }
    });

  const selectedDayEvents = selectedDay ? eventsOnDay(selectedDay) : [];

  const openCreateForm = (day?: Date) => {
    setEditingEvent(null);
    setForm({ ...BLANK_FORM, start_at: day ? dateToLocalInput(day) : "" });
    setShowForm(true);
  };

  const openEditForm = (event: DiaryEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description ?? "",
      start_at: toLocalInput(event.start_at),
      end_at: event.end_at ? toLocalInput(event.end_at) : "",
      all_day: event.all_day,
      type: event.type,
      location: event.location ?? "",
      color: event.color,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.start_at) {
      toast({ title: "Title and start time are required", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        start_at: fromLocalInput(form.start_at),
        end_at: form.end_at ? fromLocalInput(form.end_at) : null,
        all_day: form.all_day,
        type: form.type,
        location: form.location.trim() || null,
        color: form.color,
      };

      if (editingEvent) {
        await fetch(`/api/sky-vision/diary/${editingEvent.id}`, {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        toast({ title: "Event updated" });
      } else {
        await fetch("/api/sky-vision/diary", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        toast({ title: "Event created" });
      }

      setShowForm(false);
      await fetchEvents(currentMonth);
    } catch {
      toast({ title: "Failed to save event", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`/api/sky-vision/diary/${id}`, { method: "DELETE", credentials: "include" });
      setEvents((prev) => prev.filter((e) => e.id !== id));
      toast({ title: "Event deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days: Date[] = [];
  let d = gridStart;
  while (d <= gridEnd) { days.push(d); d = addDays(d, 1); }

  return (
    <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden">

      {/* ── Left sidebar / nav ──────────────────────────────────────────── */}
      <aside className="w-[220px] shrink-0 border-r border-border flex flex-col bg-sidebar">
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground font-bold text-sm">S</span>
            </div>
            <span className="font-semibold text-sm tracking-tight">Sky Vision</span>
          </div>
          <p className="text-xs text-muted-foreground">Personal Diary</p>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </button>
          <button
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            <CalendarDays className="w-4 h-4" />
            Calendar
          </button>
        </nav>

        <div className="mt-auto p-3">
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={() => openCreateForm(selectedDay ?? new Date())}
          >
            <Plus className="w-3.5 h-3.5" />
            New event
          </Button>
        </div>
      </aside>

      {/* ── Main calendar area ──────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">
              {format(currentMonth, "MMMM yyyy")}
            </h1>
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
            <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </header>

        <div className="relative flex-1 min-h-0 overflow-hidden">
          {/* Calendar grid — always full width */}
          <div className="h-full flex flex-col overflow-auto p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1 flex-1">
              {days.map((day) => {
                const dayEvents = eventsOnDay(day);
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isTodayDay = isToday(day);

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date(-1)) ? null : day)}
                    className={cn(
                      "min-h-[80px] rounded-lg p-1.5 cursor-pointer border transition-colors",
                      isCurrentMonth ? "bg-card" : "bg-muted/20",
                      isSelected ? "border-primary ring-1 ring-primary" : "border-transparent hover:border-border",
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 mx-auto",
                      isTodayDay ? "bg-primary text-primary-foreground" : isCurrentMonth ? "text-foreground" : "text-muted-foreground",
                    )}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <div
                          key={ev.id}
                          className={cn(
                            "text-[10px] px-1 py-0.5 rounded truncate text-white leading-tight",
                            COLOR_MAP[ev.color] ?? COLOR_MAP.orange,
                          )}
                        >
                          {ev.all_day ? "" : `${formatTime(ev.start_at)} `}{ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Day detail panel — floats over the grid, no squashing ── */}
          {selectedDay && (
            <aside className="absolute right-0 top-0 bottom-0 w-[300px] border-l border-border flex flex-col bg-background shadow-xl z-10">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{format(selectedDay, "EEEE")}</p>
                  <p className="text-xs text-muted-foreground">{format(selectedDay, "d MMMM yyyy")}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCreateForm(selectedDay)}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDay(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {selectedDayEvents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nothing scheduled</p>
                    <Button variant="ghost" size="sm" className="mt-2 text-xs gap-1" onClick={() => openCreateForm(selectedDay)}>
                      <Plus className="w-3 h-3" /> Add event
                    </Button>
                  </div>
                ) : (
                  selectedDayEvents.map((ev) => (
                    <div key={ev.id} className={cn("rounded-lg border-l-4 p-3 bg-card", COLOR_BORDER[ev.color] ?? COLOR_BORDER.orange)}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{ev.title}</p>
                        <div className="flex gap-0.5 shrink-0">
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => openEditForm(ev)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(ev.id)} disabled={deletingId === ev.id}>
                            {deletingId === ev.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                      {!ev.all_day && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(ev.start_at)}{ev.end_at ? ` – ${formatTime(ev.end_at)}` : ""}
                        </div>
                      )}
                      {ev.location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {ev.location}
                        </div>
                      )}
                      {ev.type !== "event" && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Tag className="w-3 h-3" />
                          {TYPE_LABELS[ev.type] ?? ev.type}
                        </div>
                      )}
                      {ev.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ev.description}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </aside>
          )}
        </div>
      </main>

      {/* ── Event form modal ──────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">{editingEvent ? "Edit event" : "New event"}</h2>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-5 space-y-3">
              <Input
                placeholder="Event title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="font-medium"
                autoFocus
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Start</label>
                  <input
                    type="datetime-local"
                    value={form.start_at}
                    onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                    className="w-full bg-input border border-border rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">End (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.end_at}
                    onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                    className="w-full bg-input border border-border rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.all_day}
                    onChange={(e) => setForm({ ...form, all_day: e.target.checked })}
                    className="rounded"
                  />
                  All day
                </label>

                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="flex-1 bg-input border border-border rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="event">Event</option>
                  <option value="meeting">Meeting</option>
                  <option value="task">Task</option>
                  <option value="reminder">Reminder</option>
                </select>

                <div className="flex gap-1">
                  {Object.entries(COLOR_MAP).map(([key, cls]) => (
                    <button
                      key={key}
                      onClick={() => setForm({ ...form, color: key })}
                      className={cn("w-5 h-5 rounded-full", cls, form.color === key ? "ring-2 ring-white ring-offset-1 ring-offset-card" : "")}
                    />
                  ))}
                </div>
              </div>

              <Input
                placeholder="Location (optional)"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />

              <textarea
                placeholder="Notes (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                {editingEvent ? "Save changes" : "Create event"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
