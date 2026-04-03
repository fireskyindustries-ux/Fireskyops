import { useListEnquiries } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function EnquiriesList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const { data: enquiries, isLoading, error } = useListEnquiries({
    status: statusFilter !== "all" ? statusFilter : undefined
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Enquiries</h1>
          <p className="text-muted-foreground">Manage inbound requests and leads</p>
        </div>
        <Link href="/enquiries/new">
          <Button size="lg" className="w-full sm:w-auto">
            <Plus className="mr-2 h-5 w-5" /> New Enquiry
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-[200px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="inspection_done">Inspection Done</SelectItem>
              <SelectItem value="quoted">Quoted</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : error ? (
        <div className="text-destructive">Failed to load enquiries</div>
      ) : enquiries?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-card">
          <p>No enquiries found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {enquiries?.map((enquiry) => (
            <Link key={enquiry.id} href={`/enquiries/${enquiry.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4 flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">{enquiry.title}</h3>
                    <p className="text-sm text-muted-foreground">{enquiry.customerName || `Customer #${enquiry.customerId}`}</p>
                    {enquiry.tankSize && (
                      <p className="text-xs text-muted-foreground">
                        {enquiry.tankQuantity || 1}x {enquiry.tankSize}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {enquiry.priority && (
                      <Badge variant={enquiry.priority === "high" ? "destructive" : enquiry.priority === "medium" ? "default" : "secondary"} className="uppercase">
                        {enquiry.priority}
                      </Badge>
                    )}
                    <Badge variant={enquiry.status === "new" ? "default" : "secondary"}>
                      {enquiry.status.replace("_", " ")}
                    </Badge>
                    <div className="text-xs text-muted-foreground w-20 text-right">
                      {format(new Date(enquiry.createdAt), "MMM d, yyyy")}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}