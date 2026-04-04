import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Users, FileText, Briefcase, Plus, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { SkyInlineButton } from "@/components/sky";

export default function Dashboard() {
  const { data: summary, isLoading, error } = useGetDashboardSummary();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[60px]" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><Skeleton className="h-6 w-[150px]" /></CardHeader>
            <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
          </Card>
          <Card>
            <CardHeader><Skeleton className="h-6 w-[150px]" /></CardHeader>
            <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return <div className="text-destructive">Failed to load dashboard data</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of current field operations</p>
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
            <Button size="lg" className="w-full sm:w-auto h-12 px-8 hex-clip font-semibold tracking-wide">
              <Plus className="mr-2 h-5 w-5" /> Start New Enquiry
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Enquiries</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalEnquiries}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalJobs}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Enquiries</CardTitle>
              <CardDescription>Latest inbound requests</CardDescription>
            </div>
            <Link href="/enquiries">
              <Button variant="ghost" size="sm">View All <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
          </CardHeader>
          <CardContent>
            {summary.recentEnquiries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No recent enquiries</p>
            ) : (
              <div className="space-y-4">
                {summary.recentEnquiries.map((enquiry) => (
                  <Link key={enquiry.id} href={`/enquiries/${enquiry.id}`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">{enquiry.customerName || `Customer #${enquiry.customerId}`}</p>
                        <p className="text-sm text-muted-foreground">{enquiry.title}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={enquiry.status === "new" ? "default" : "secondary"}>
                          {enquiry.status.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(enquiry.createdAt), "MMM d")}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Jobs</CardTitle>
              <CardDescription>Active pipeline updates</CardDescription>
            </div>
            <Link href="/jobs">
              <Button variant="ghost" size="sm">Pipeline <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
          </CardHeader>
          <CardContent>
            {summary.recentJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No recent jobs</p>
            ) : (
              <div className="space-y-4">
                {summary.recentJobs.map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">{job.customerName || `Customer #${job.customerId}`}</p>
                        <p className="text-sm text-muted-foreground">{job.title}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {job.stage}
                        </Badge>
                        {job.priority && (
                          <Badge variant={job.priority === "high" ? "destructive" : job.priority === "medium" ? "default" : "secondary"}>
                            {job.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.jobsByStage).map(([stage, count]) => (
              <div key={stage} className="flex-1 min-w-[120px] p-4 rounded-lg border bg-card text-card-foreground flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{count}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{stage.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
