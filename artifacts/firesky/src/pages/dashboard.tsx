import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Users, FileText, Briefcase, Plus, ArrowRight, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { SkyInlineButton } from "@/components/sky";
import { cn } from "@/lib/utils";

const ENQUIRY_STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  new:              { dot: "bg-blue-500",   badge: "bg-blue-50 text-blue-700 border-blue-200",    label: "New" },
  in_progress:      { dot: "bg-amber-500",  badge: "bg-amber-50 text-amber-700 border-amber-200",  label: "In Progress" },
  inspection_done:  { dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700 border-violet-200", label: "Inspection Done" },
  quoted:           { dot: "bg-cyan-600",   badge: "bg-cyan-50 text-cyan-700 border-cyan-200",     label: "Quoted" },
  won:              { dot: "bg-green-600",  badge: "bg-green-50 text-green-700 border-green-200",   label: "Won" },
  lost:             { dot: "bg-red-500",    badge: "bg-red-50 text-red-700 border-red-200",         label: "Lost" },
};

const JOB_STAGE_STYLES: Record<string, { dot: string; badge: string }> = {
  enquiry:   { dot: "bg-blue-400",   badge: "bg-blue-50 text-blue-700 border-blue-200" },
  inspection:{ dot: "bg-violet-400", badge: "bg-violet-50 text-violet-700 border-violet-200" },
  quoting:   { dot: "bg-amber-400",  badge: "bg-amber-50 text-amber-700 border-amber-200" },
  quoted:    { dot: "bg-cyan-500",   badge: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  won:       { dot: "bg-green-500",  badge: "bg-green-50 text-green-700 border-green-200" },
  lost:      { dot: "bg-red-400",    badge: "bg-red-50 text-red-700 border-red-200" },
  closed:    { dot: "bg-gray-400",   badge: "bg-gray-50 text-gray-600 border-gray-200" },
};

const PIPELINE_STAGE_BAR: Record<string, string> = {
  enquiry:    "bg-blue-400",
  inspection: "bg-violet-400",
  quoting:    "bg-amber-400",
  quoted:     "bg-cyan-500",
  won:        "bg-green-500",
  lost:       "bg-red-400",
  closed:     "bg-gray-400",
};

const ENQUIRY_PIPELINE_MAP: Record<string, number> = {
  new: 0, in_progress: 0, inspection_done: 1, quoted: 2, won: 3,
};
const ENQUIRY_PIPELINE_LABELS = ["Enquiry", "Inspection", "Quote", "Job"];

function EnquiryPipelineTracker({ status }: { status: string }) {
  const currentStep = ENQUIRY_PIPELINE_MAP[status] ?? 0;
  const isLost = status === "lost" || status === "closed";
  const isDone = status === "won";
  if (isLost) return null;
  return (
    <div className="flex items-center gap-0.5 mt-1">
      {ENQUIRY_PIPELINE_LABELS.map((label, i) => {
        const active = i === currentStep;
        const done = i < currentStep || isDone;
        return (
          <div key={label} className="flex items-center gap-0.5">
            <div className={cn(
              "text-[8px] font-semibold px-1 py-0.5 rounded-full border leading-none",
              done ? "bg-green-500 text-white border-green-500" :
              active ? "bg-primary text-primary-foreground border-primary" :
              "bg-muted/60 text-muted-foreground/60 border-muted-foreground/15"
            )}>
              {label}
            </div>
            {i < ENQUIRY_PIPELINE_LABELS.length - 1 && (
              <div className={cn("w-1.5 h-px shrink-0", done ? "bg-green-400" : "bg-muted-foreground/20")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, iconBg, iconColor, sub, href }: {
  label: string; value: number; icon: React.ElementType;
  iconBg: string; iconColor: string; sub?: string; href?: string;
}) {
  const card = (
    <Card className={cn("border shadow-sm", href && "cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-150")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5 px-5">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
  if (href) return <Link href={href}>{card}</Link>;
  return card;
}

export default function Dashboard() {
  const { data: summary, isLoading, error } = useGetDashboardSummary();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !summary) {
    return <div className="text-destructive py-8 text-center">Failed to load dashboard data</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Field operations overview</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <SkyInlineButton
            contextType="dashboard"
            contextData={summary as unknown as Record<string, unknown>}
            contextLabel="Overview"
            variant="outline"
            className="flex-1 sm:flex-none"
          />
          <Link href="/enquiries/new">
            <Button size="lg" className="w-full sm:w-auto h-10 px-6 hex-clip font-semibold tracking-wide">
              <Plus className="mr-2 h-4 w-4" /> New Enquiry
            </Button>
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard
          label="Total Customers"
          value={summary.totalCustomers}
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          sub="Registered accounts"
          href="/customers"
        />
        <StatCard
          label="Active Enquiries"
          value={summary.totalEnquiries}
          icon={FileText}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          sub="Open requests"
          href="/enquiries"
        />
        <StatCard
          label="Active Jobs"
          value={summary.totalJobs}
          icon={Briefcase}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          sub="In pipeline"
          href="/jobs"
        />
      </div>

      {/* Recent cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Enquiries */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Recent Enquiries</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Latest inbound requests</p>
            </div>
            <Link href="/enquiries">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-primary">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {summary.recentEnquiries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No recent enquiries</p>
            ) : (
              summary.recentEnquiries.map((enquiry) => {
                const s = ENQUIRY_STATUS_STYLES[enquiry.status] ?? ENQUIRY_STATUS_STYLES.new;
                return (
                  <Link key={enquiry.id} href={`/enquiries/${enquiry.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors group cursor-pointer">
                      <div className={cn("w-1 self-stretch rounded-full flex-shrink-0", s.dot)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight line-clamp-1">{enquiry.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{enquiry.customerName || `Customer #${enquiry.customerId}`}</p>
                        <EnquiryPipelineTracker status={enquiry.status} />
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", s.badge)}>
                          {s.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(enquiry.createdAt), "MMM d")}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Jobs */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Recent Jobs</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Active pipeline updates</p>
            </div>
            <Link href="/jobs">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-primary">
                Pipeline <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {summary.recentJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No recent jobs</p>
            ) : (
              summary.recentJobs.map((job) => {
                const s = JOB_STAGE_STYLES[job.stage] ?? JOB_STAGE_STYLES.enquiry;
                return (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors group cursor-pointer">
                      <div className={cn("w-1 self-stretch rounded-full flex-shrink-0", s.dot)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight line-clamp-1">{job.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{job.customerName || `Customer #${job.customerId}`}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize", s.badge)}>
                          {job.stage}
                        </span>
                        {job.priority === "high" && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200 uppercase">
                            High
                          </span>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline breakdown */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pipeline Breakdown</CardTitle>
          <p className="text-xs text-muted-foreground">Jobs by current stage</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(summary.jobsByStage).map(([stage, count]) => (
              <div key={stage} className="flex flex-col rounded-xl border bg-card p-3 gap-2">
                <div className={cn("h-1 w-full rounded-full", PIPELINE_STAGE_BAR[stage] ?? "bg-muted")} />
                <span className="text-2xl font-bold leading-none">{count as number}</span>
                <span className="text-xs text-muted-foreground capitalize leading-tight">{stage.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
