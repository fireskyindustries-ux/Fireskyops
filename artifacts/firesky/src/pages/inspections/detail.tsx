import { useGetInspection, getGetInspectionQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { MapPin, Briefcase, FileText, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { AssignUser } from "@/components/assign-user";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { SkyInlineButton } from "@/components/sky";

export default function InspectionDetail() {
  const params = useParams();
  const id = Number(params.id);
  
  const { data: inspection, isLoading, error } = useGetInspection(id, { 
    query: { enabled: !!id, queryKey: getGetInspectionQueryKey(id) } 
  });

  if (isLoading) {
    return <div className="space-y-4 max-w-4xl mx-auto">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-64 w-full" />
    </div>;
  }

  if (error || !inspection) {
    return <div className="text-destructive">Inspection not found</div>;
  }

  const BooleanDisplay = ({ value, label }: { value?: boolean, label: string }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium">{label}</span>
      {value ? (
        <CheckCircle2 className="h-5 w-5 text-green-500" />
      ) : (
        <XCircle className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">Inspection #{inspection.id}</h1>
            {inspection.siteReadyToQuote && (
              <Badge className="bg-green-500 hover:bg-green-600 text-white">Ready to Quote</Badge>
            )}
          </div>
          <Link href={`/customers/${inspection.customerId}`}>
            <p className="text-xl text-primary hover:underline cursor-pointer">
              {inspection.customerName || `Customer #${inspection.customerId}`}
              {inspection.farmName ? ` - ${inspection.farmName}` : ''}
            </p>
          </Link>
          <p className="text-sm text-muted-foreground mt-1">
            Inspected: {inspection.inspectedAt ? format(new Date(inspection.inspectedAt), "PPP") : "Unknown"}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-col sm:flex-row">
          <SkyInlineButton
            contextType="inspection"
            contextData={inspection as unknown as Record<string, unknown>}
            contextLabel={`#${inspection.id}${inspection.farmName ? ` - ${inspection.farmName}` : ''}`}
            variant="outline"
            className="w-full sm:w-auto"
          />
          <Link href={`/jobs/new?inspectionId=${inspection.id}&customerId=${inspection.customerId}${inspection.enquiryId ? `&enquiryId=${inspection.enquiryId}` : ''}`}>
            <Button className="w-full sm:w-auto"><Briefcase className="mr-2 h-4 w-4" /> Convert to Job</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Location & Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 divide-y">
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Location</p>
                  <p className="text-sm text-muted-foreground">{inspection.nearestTown || "Not specified"}</p>
                  {inspection.whatsappLocation && (
                    <div className="pt-1">
                      <p className="text-xs text-muted-foreground font-mono truncate">{inspection.whatsappLocation}</p>
                      {/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test((inspection.whatsappLocation ?? "").trim()) && (
                        <a
                          href={`https://www.google.com/maps?q=${encodeURIComponent((inspection.whatsappLocation ?? "").trim())}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary font-medium mt-1 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open in Google Maps
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="pt-4 space-y-1">
              <BooleanDisplay value={inspection.truckAccess} label="Truck Access" />
              <BooleanDisplay value={inspection.trailerAccess} label="Trailer Access" />
            </div>

            <div className="pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">Dist from road:</span>
                <span>{inspection.distanceFromRoad ? `${inspection.distanceFromRoad}m` : 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">Dist from house:</span>
                <span>{inspection.distanceFromHouse ? `${inspection.distanceFromHouse}m` : 'Unknown'}</span>
              </div>
              {inspection.groundCondition && (
                <div className="pt-2">
                  <span className="font-medium text-muted-foreground block mb-1">Ground Condition:</span>
                  <span>{inspection.groundCondition}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Installation Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 divide-y">
            <div className="space-y-2">
              <p className="text-sm font-medium">Tanks Required</p>
              <p className="text-sm text-muted-foreground">
                {inspection.tankQuantity || 1}x {inspection.tankSize || "Unknown size"}
              </p>
            </div>
            
            <div className="pt-4 space-y-1">
              <BooleanDisplay value={inspection.requiresStand} label="Requires Stand" />
              {inspection.requiresStand && inspection.standHeight && (
                <p className="text-sm text-muted-foreground pl-2 pb-2">- Height: {inspection.standHeight}</p>
              )}
              
              <BooleanDisplay value={inspection.requiresPlinth} label="Requires Plinth" />
            </div>

            {inspection.pipeLength && (
              <div className="pt-4 flex justify-between text-sm">
                <span className="font-medium text-muted-foreground">Pipe Length:</span>
                <span>{inspection.pipeLength}m</span>
              </div>
            )}
          </CardContent>
        </Card>

        {(inspection.notes || inspection.offloadingConstraints || inspection.plinthDetails || inspection.pipeDetails) && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Detailed Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {inspection.offloadingConstraints && (
                <div>
                  <p className="text-sm font-medium mb-1">Offloading Constraints</p>
                  <p className="text-sm text-muted-foreground">{inspection.offloadingConstraints}</p>
                </div>
              )}
              {inspection.plinthDetails && (
                <div>
                  <p className="text-sm font-medium mb-1">Plinth Details</p>
                  <p className="text-sm text-muted-foreground">{inspection.plinthDetails}</p>
                </div>
              )}
              {inspection.pipeDetails && (
                <div>
                  <p className="text-sm font-medium mb-1">Pipe Routing</p>
                  <p className="text-sm text-muted-foreground">{inspection.pipeDetails}</p>
                </div>
              )}
              {inspection.notes && (
                <div>
                  <p className="text-sm font-medium mb-1">General Notes</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{inspection.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <AssignUser
            resourceType="inspections"
            resourceId={inspection.id}
            currentAssignedToId={inspection.assignedToId}
          />
        </CardContent>
      </Card>
    </div>
  );
}