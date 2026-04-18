import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, FunnelChart, Funnel, LabelList,
} from "recharts";
import { subDays, subMonths, startOfYear, format } from "date-fns";
import { TrendingUp, Users, Briefcase, FileText, Trophy, Target, DollarSign, BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Colour palette ────────────────────────────────────────────
const COLOURS = {
  primary:    "#E85D04",
  blue:       "#3b82f6",
  violet:     "#8b5cf6",
  amber:      "#f59e0b",
  cyan:       "#06b6d4",
  green:      "#22c55e",
  red:        "#ef4444",
  gray:       "#94a3b8",
  rose:       "#f43f5e",
};

const STATUS_COLOURS: Record<string, string> = {
  new:             COLOURS.blue,
  in_progress:     COLOURS.amber,
  inspection_done: COLOURS.violet,
  quoted:          COLOURS.cyan,
  won:             COLOURS.green,
  lost:            COLOURS.red,
  closed:          COLOURS.gray,
};

const STAGE_COLOURS: Record<string, string> = {
  enquiry:    COLOURS.blue,
  inspection: COLOURS.violet,
  quoting:    COLOURS.amber,
  quoted:     COLOURS.cyan,
  won:        COLOURS.green,
  lost:       COLOURS.red,
  closed:     COLOURS.gray,
};

const PRIORITY_COLOURS: Record<string, string> = {
  high:   COLOURS.red,
  medium: COLOURS.amber,
  low:    COLOURS.gray,
};

const PIE_COLOURS = [COLOURS.green, COLOURS.red, COLOURS.cyan];

// ── Date ranges ───────────────────────────────────────────────
type Range = "30d" | "90d" | "6m" | "12m" | "ytd" | "all";

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "30d",  label: "30 Days" },
  { value: "90d",  label: "90 Days" },
  { value: "6m",   label: "6 Months" },
  { value: "12m",  label: "12 Months" },
  { value: "ytd",  label: "This Year" },
  { value: "all",  label: "All Time" },
];

function rangeToParams(range: Range): { from?: string; to?: string } {
  const now = new Date();
  const to = now.toISOString();
  switch (range) {
    case "30d":  return { from: subDays(now, 30).toISOString(), to };
    case "90d":  return { from: subDays(now, 90).toISOString(), to };
    case "6m":   return { from: subMonths(now, 6).toISOString(), to };
    case "12m":  return { from: subMonths(now, 12).toISOString(), to };
    case "ytd":  return { from: startOfYear(now).toISOString(), to };
    case "all":  return {};
  }
}

// ── Helpers ───────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return `R${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `R${(n / 1_000).toFixed(0)}k`;
  return `R${n.toLocaleString()}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card className={cn("shadow-sm", accent && "border-primary/30 bg-primary/3")}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className={cn("text-2xl font-bold mt-1 leading-none", accent && "text-primary")}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={cn("p-2 rounded-xl shrink-0", accent ? "bg-primary/10" : "bg-muted/60")}>
            <Icon className={cn("h-5 w-5", accent ? "text-primary" : "text-muted-foreground")} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Section header ─────────────────────────────────────────────
function SectionTitle({ children, description }: { children: React.ReactNode; description?: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold">{children}</h2>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

// ── Custom tooltip ─────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-xl shadow-lg px-3 py-2 text-xs space-y-1">
      {label && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill ?? p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{typeof p.value === "number" && p.value >= 1000 ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function ReportsPage() {
  const [range, setRange] = useState<Range>("12m");
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as string) || "guest";
  const isAdmin = role === "admin";

  const params = useMemo(() => rangeToParams(range), [range]);

  const queryString = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null) as [string, string][])
  ).toString();

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/analytics${queryString ? `?${queryString}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
  });

  const summary = data?.summary ?? {};
  const enquiryByStatus: any[] = data?.enquiryByStatus ?? [];
  const jobByStage: any[] = data?.jobByStage ?? [];
  const monthlyTrend: any[] = data?.monthlyTrend ?? [];
  const wonLost: any[] = data?.wonLost ?? [];
  const pipelineValue: any[] = data?.pipelineValue ?? [];
  const priorityBreakdown: any[] = data?.priorityBreakdown ?? [];
  const conversionFunnel: any[] = data?.conversionFunnel ?? [];
  const topTankSizes: any[] = data?.topTankSizes ?? [];
  const branchComparison: any[] = data?.branchComparison ?? [];

  // Trim monthly trend to only buckets with data
  const trimmedTrend = monthlyTrend.filter(m => m.enquiries > 0 || m.jobs > 0 || m.customers > 0).length < 3
    ? monthlyTrend.slice(-6)
    : monthlyTrend;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-primary" /> Reports & Analytics
          </h1>
          <p className="text-sm text-muted-foreground">Pipeline performance and business metrics</p>
        </div>

        {/* Date range tabs */}
        <div className="flex items-center rounded-full border bg-muted/40 p-0.5 flex-wrap gap-0.5">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                range === opt.value
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary stat cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <StatCard icon={FileText}  label="Total Enquiries"   value={summary.totalEnquiries ?? 0} />
            <StatCard icon={Briefcase} label="Total Jobs"        value={summary.totalJobs ?? 0} />
            <StatCard icon={Users}     label="New Customers"     value={summary.totalCustomers ?? 0} />
            <StatCard icon={Trophy}    label="Jobs Won"          value={summary.wonJobs ?? 0} accent />
            <StatCard icon={Target}    label="Conversion Rate"   value={`${summary.conversionRate ?? 0}%`} sub="Enquiries → Won" />
            <StatCard icon={TrendingUp} label="Active Jobs"      value={summary.activeJobs ?? 0} sub="In pipeline" />
            <StatCard icon={FileText}  label="Lost Jobs"         value={summary.lostJobs ?? 0} sub="Closed without winning" />
            <StatCard icon={DollarSign} label="Pipeline Value"   value={fmt(summary.totalPipelineValue ?? 0)} sub="Active jobs (estimated)" accent />
          </>
        )}
      </div>

      {/* ── Monthly trend ──────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionTitle description="Enquiries received, jobs created, and new customers per month">
          Monthly Activity Trend
        </SectionTitle>
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trimmedTrend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="enquiries" stroke={COLOURS.blue}   strokeWidth={2} dot={false} name="Enquiries" />
                  <Line type="monotone" dataKey="jobs"      stroke={COLOURS.violet} strokeWidth={2} dot={false} name="Jobs" />
                  <Line type="monotone" dataKey="jobsWon"   stroke={COLOURS.green}  strokeWidth={2} dot={false} name="Won" strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="customers" stroke={COLOURS.amber}  strokeWidth={2} dot={false} name="Customers" strokeDasharray="6 3" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Conversion funnel + Won/Lost ──────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Conversion funnel */}
        <div className="space-y-3">
          <SectionTitle description="How enquiries progress through the pipeline">
            Conversion Funnel
          </SectionTitle>
          <Card className="shadow-sm h-full">
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-48 w-full rounded-lg" />
              ) : (
                <div className="space-y-2">
                  {conversionFunnel.map((step: any, i: number) => {
                    const top = conversionFunnel[0]?.count || 1;
                    const pct = Math.round((step.count / top) * 100);
                    const colours = [COLOURS.blue, COLOURS.violet, COLOURS.cyan, COLOURS.green];
                    return (
                      <div key={step.label} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium">{step.label}</span>
                          <span className="text-muted-foreground">{step.count} ({pct}%)</span>
                        </div>
                        <div className="h-7 bg-muted/40 rounded-lg overflow-hidden">
                          <div
                            className="h-full rounded-lg flex items-center pl-3 transition-all duration-500"
                            style={{ width: `${Math.max(pct, 4)}%`, background: colours[i] }}
                          >
                            {pct > 15 && (
                              <span className="text-white text-[11px] font-bold">{step.count}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Won / Lost / Active donut */}
        <div className="space-y-3">
          <SectionTitle description="Overall job outcome distribution">
            Job Outcomes
          </SectionTitle>
          <Card className="shadow-sm h-full">
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-48 w-full rounded-lg" />
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie
                        data={wonLost}
                        cx="50%" cy="50%"
                        innerRadius={45} outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {wonLost.map((entry: any, i: number) => (
                          <Cell key={i} fill={PIE_COLOURS[i % PIE_COLOURS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex-1">
                    {wonLost.map((entry: any, i: number) => (
                      <div key={entry.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLOURS[i % PIE_COLOURS.length] }} />
                          <span className="text-sm">{entry.name}</span>
                        </div>
                        <span className="text-sm font-bold">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Enquiry status + Job stage ─────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Enquiry by status */}
        <div className="space-y-3">
          <SectionTitle description="Count of enquiries in each status">
            Enquiries by Status
          </SectionTitle>
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-56 w-full rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={enquiryByStatus.filter(e => e.count > 0)}
                    layout="vertical"
                    margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--muted))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={capitalize} width={96} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Enquiries" radius={[0, 4, 4, 0]}>
                      {enquiryByStatus.map((entry: any) => (
                        <Cell key={entry.status} fill={STATUS_COLOURS[entry.status] ?? COLOURS.gray} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Job by stage */}
        <div className="space-y-3">
          <SectionTitle description="Count of jobs in each pipeline stage">
            Jobs by Stage
          </SectionTitle>
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-56 w-full rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={jobByStage.filter(j => j.count > 0)}
                    layout="vertical"
                    margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--muted))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={capitalize} width={80} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Jobs" radius={[0, 4, 4, 0]}>
                      {jobByStage.map((entry: any) => (
                        <Cell key={entry.stage} fill={STAGE_COLOURS[entry.stage] ?? COLOURS.gray} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Pipeline value + Priority ──────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Pipeline value by stage */}
        <div className="space-y-3">
          <SectionTitle description="Estimated value (R) of jobs in each active stage">
            Pipeline Value by Stage
          </SectionTitle>
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-52 w-full rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={pipelineValue.filter(p => p.value > 0 || p.count > 0)}
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis dataKey="stage" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={capitalize} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `R${(v/1000).toFixed(0)}k` : `R${v}`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" name="Est. Value (R)" radius={[4, 4, 0, 0]}>
                      {pipelineValue.map((entry: any) => (
                        <Cell key={entry.stage} fill={STAGE_COLOURS[entry.stage] ?? COLOURS.gray} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Priority breakdown */}
        <div className="space-y-3">
          <SectionTitle description="Enquiries and jobs broken down by priority level">
            Priority Breakdown
          </SectionTitle>
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-52 w-full rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={priorityBreakdown}
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis dataKey="priority" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={capitalize} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="enquiries" name="Enquiries" fill={COLOURS.blue}   radius={[3, 3, 0, 0]} />
                    <Bar dataKey="jobs"      name="Jobs"      fill={COLOURS.violet} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Top tank sizes ─────────────────────────────────────── */}
      {topTankSizes.length > 0 && (
        <div className="space-y-3">
          <SectionTitle description="Most requested tank sizes across enquiries and jobs">
            Top Tank Sizes Requested
          </SectionTitle>
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-48 w-full rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={topTankSizes}
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis dataKey="size" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Units" fill={COLOURS.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Branch comparison (admin only) ─────────────────────── */}
      {isAdmin && branchComparison.length > 1 && (
        <div className="space-y-3">
          <SectionTitle description="Performance comparison across all branches">
            Branch Comparison
          </SectionTitle>
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-56 w-full rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={branchComparison}
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis dataKey="branchName" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="customers"  name="Customers"    fill={COLOURS.amber}  radius={[3, 3, 0, 0]} />
                    <Bar dataKey="enquiries"  name="Enquiries"    fill={COLOURS.blue}   radius={[3, 3, 0, 0]} />
                    <Bar dataKey="activeJobs" name="Active Jobs"  fill={COLOURS.violet} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="wonJobs"    name="Jobs Won"     fill={COLOURS.green}  radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Branch pipeline value table */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Pipeline Value by Branch</CardTitle>
              <CardDescription className="text-xs">Estimated value of active jobs per branch</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {branchComparison
                  .filter(b => b.pipelineValue > 0)
                  .sort((a, b) => b.pipelineValue - a.pipelineValue)
                  .map((b: any) => {
                    const max = Math.max(...branchComparison.map(x => x.pipelineValue), 1);
                    const pct = Math.round((b.pipelineValue / max) * 100);
                    return (
                      <div key={b.branchId} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium">{b.branchName}</span>
                          <span className="text-muted-foreground">{fmt(b.pipelineValue)} • {b.activeJobs} active jobs</span>
                        </div>
                        <div className="h-5 bg-muted/40 rounded-lg overflow-hidden">
                          <div
                            className="h-full rounded-lg transition-all duration-500"
                            style={{ width: `${Math.max(pct, 2)}%`, background: COLOURS.primary }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
