import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Users, FileText, Briefcase, ArrowRight, ChevronRight, Clock,
  AlertTriangle, Package, Building2, Plus,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SkyInlineButton } from "@/components/sky";

async function apiFetch(path: string) {
  const res = await fetch(`/api${path}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

const ENQUIRY_STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  new:             { dot: "bg-blue-500",   badge: "bg-blue-50 text-blue-700 border-blue-200",    label: "New" },
  in_progress:     { dot: "bg-amber-500",  badge: "bg-amber-50 text-amber-700 border-amber-200",  label: "In Progress" },
  inspection_done: { dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700 border-violet-200", label: "Inspection Done" },
  quoted:          { dot: "bg-cyan-600",   badge: "bg-cyan-50 text-cyan-700 border-cyan-200",     label: "Quoted" },
  won:             { dot: "bg-green-600",  badge: "bg-green-50 text-green-700 border-green-200",  label: "Won" },
  lost:            { dot: "bg-red-500",    badge: "bg-red-50 text-red-700 border-red-200",        label: "Lost" },
};

const JOB_STAGE_STYLES: Record<string, { dot: string; badge: string }> = {
  enquiry:    { dot: "bg-blue-400",   badge: "bg-blue-50 text-blue-700 border-blue-200" },
  inspection: { dot: "bg-violet-400", badge: "bg-violet-50 text-violet-700 border-violet-200" },
  quoting:    { dot: "bg-amber-400",  badge: "bg-amber-50 text-amber-700 border-amber-200" },
  quoted:     { dot: "bg-cyan-500",   badge: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  won:        { dot: "bg-green-500",  badge: "bg-green-50 text-green-700 border-green-200" },
  lost:       { dot: "bg-red-400",    badge: "bg-red-50 text-red-700 border-red-200" },
  closed:     { dot: "bg-gray-400",   badge: "bg-gray-50 text-gray-600 border-gray-200" },
};

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

function AlertTile({ count, label, icon: Icon, activeClass }: {
  count: number; label: string; icon: React.ElementType; activeClass: string;
}) {
  const active = count > 0;
  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-center",
      active ? activeClass : "border-transparent bg-muted/40 text-muted-foreground",
    )}>
      <Icon className="h-4 w-4 opacity-70" />
      <span className="text-2xl font-bold leading-none tabular-nums">{count}</span>
      <span className="text-[10px] leading-tight font-medium">{label}</span>
    </div>
  );
}

export default function BranchDashboard() {
  const { user } = useUser();
  const branchId = user?.publicMetadata?.branchId as number | null ?? null;

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ["branch-dashboard", branchId],
    queryFn: () => apiFetch("/dashboard/branch-summary"),
    enabled: branchId != null,
  });

  if (!branchId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-semibold">No branch assigned</p>
        <p className="text-sm text-muted-foreground mt-1">Ask your system admin to assign you to a branch.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return <div className="text-destructive py-8 text-center">Failed to load branch dashboard</div>;
  }

  const s = summary as any;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <Badge variant="secondary" className="text-xs">{s.branchRegion || "Branch"}</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{s.branchName}</h1>
          <p className="text-sm text-muted-foreground">Branch operations overview</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <SkyInlineButton
            contextType="dashboard"
            contextData={s}
            contextLabel="Branch Overview"
            variant="outline"
            className="flex-1 sm:flex-none"
          />
          <Link href="/enquiries/new">
            <Button size="lg" className="w-full sm:w-auto h-10 px-6 font-semibold tracking-wide">
              <Plus className="mr-2 h-4 w-4" /> New Enquiry
            </Button>
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard
          label="Customers"
          value={s.totalCustomers}
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          sub="In this branch"
          href="/customers"
        />
        <StatCard
          label="Open Enquiries"
          value={s.totalEnquiries}
          icon={FileText}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          sub="Active requests"
          href="/enquiries"
        />
        <StatCard
          label="Active Jobs"
          value={s.totalJobs}
          icon={Briefcase}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          sub="In pipeline"
          href="/jobs"
        />
        <StatCard
          label="Stock Items"
          value={s.stockItemsTracked}
          icon={Package}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          sub="Lines tracked"
          href="/stock"
        />
      </div>

      {/* Alert HUD */}
      {(s.staleEnquiries > 0 || s.staleJobs > 0 || s.urgentEnquiries > 0 || s.urgentJobs > 0) && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Needs Attention</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <AlertTile count={s.staleEnquiries} label="Stale Enquiries" icon={Clock}
              activeClass="bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400" />
            <AlertTile count={s.staleJobs} label="Stale Jobs" icon={Clock}
              activeClass="bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400" />
            <AlertTile count={s.urgentEnquiries} label="Urgent Enquiries" icon={AlertTriangle}
              activeClass="bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400" />
            <AlertTile count={s.urgentJobs} label="Urgent Jobs" icon={AlertTriangle}
              activeClass="bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400" />
          </div>
        </div>
      )}

      {/* Recent cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Enquiries */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Recent Enquiries</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Latest from {s.branchName}</p>
            </div>
            <Link href="/enquiries">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-primary">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {s.recentEnquiries?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No enquiries yet</p>
            ) : (
              s.recentEnquiries?.map((enquiry: any) => {
                const st = ENQUIRY_STATUS_STYLES[enquiry.status] ?? ENQUIRY_STATUS_STYLES.new;
                return (
                  <Link key={enquiry.id} href={`/enquiries/${enquiry.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors group cursor-pointer">
                      <div className={cn("w-1 self-stretch rounded-full flex-shrink-0", st.dot)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight line-clamp-1">{enquiry.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{enquiry.customerName || `Customer #${enquiry.customerId}`}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", st.badge)}>{st.label}</span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(enquiry.createdAt), "MMM d")}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
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
              <p className="text-xs text-muted-foreground mt-0.5">Active pipeline</p>
            </div>
            <Link href="/jobs">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-primary">
                Pipeline <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {s.recentJobs?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No jobs yet</p>
            ) : (
              s.recentJobs?.map((job: any) => {
                const st = JOB_STAGE_STYLES[job.stage] ?? JOB_STAGE_STYLES.enquiry;
                return (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors group cursor-pointer">
                      <div className={cn("w-1 self-stretch rounded-full flex-shrink-0", st.dot)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight line-clamp-1">{job.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{job.customerName || `Customer #${job.customerId}`}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize", st.badge)}>{job.stage}</span>
                        {job.priority === "high" && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200 uppercase">High</span>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stock snapshot */}
      {s.stockSnapshot?.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Stock Snapshot</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Current levels at {s.branchName}</p>
            </div>
            <Link href="/stock">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-primary">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {s.stockSnapshot.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{item.itemName}</p>
                    {item.itemCategory && <p className="text-xs text-muted-foreground">{item.itemCategory}</p>}
                  </div>
                  <div className="text-right">
                    <p className={cn("text-xl font-bold tabular-nums",
                      item.quantity === 0 ? "text-destructive" : item.quantity <= 2 ? "text-orange-500" : "text-primary"
                    )}>
                      {item.quantity}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.itemUnit}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
