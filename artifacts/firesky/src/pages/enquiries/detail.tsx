import { useGetEnquiry, getGetEnquiryQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ClipboardCheck, Briefcase, AlignLeft, Info, Calendar, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { SkyInlineButton } from "@/components/sky";

export default function EnquiryDetail() {
  const params = useParams();
  const id = Number(params.id);
  
  const { data: enquiry, isLoading, error } = useGetEnquiry(id, { 
    query: { enabled: !!id, queryKey: getGetEnquiryQueryKey(id) } 
  });

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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link href="/enquiries" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ChevronLeft className="h-4 w-4" /> Enquiries
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">{enquiry.title}</h1>
            <Badge variant={enquiry.status === "new" ? "default" : "secondary"}>
              {enquiry.status.replace("_", " ")}
            </Badge>
            {enquiry.priority && (
              <Badge variant={enquiry.priority === "high" ? "destructive" : enquiry.priority === "medium" ? "default" : "outline"} className="uppercase">
                {enquiry.priority}
              </Badge>
            )}
          </div>
          <Link href={`/customers/${enquiry.customerId}`}>
            <p className="text-xl text-primary hover:underline cursor-pointer">{enquiry.customerName || `Customer #${enquiry.customerId}`}</p>
          </Link>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-col sm:flex-row">
          <SkyInlineButton
            contextType="enquiry"
            contextData={enquiry as unknown as Record<string, unknown>}
            contextLabel={enquiry.title}
            variant="outline"
            className="w-full sm:w-auto"
          />
          <Link href={`/inspections/new?enquiryId=${enquiry.id}&customerId=${enquiry.customerId}`}>
            <Button variant="outline" className="w-full sm:w-auto"><ClipboardCheck className="mr-2 h-4 w-4" /> Do Inspection</Button>
          </Link>
          <Link href={`/jobs/new?enquiryId=${enquiry.id}&customerId=${enquiry.customerId}`}>
            <Button className="w-full sm:w-auto"><Briefcase className="mr-2 h-4 w-4" /> Convert to Job</Button>
          </Link>
        </div>
      </div>

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
    </div>
  );
}