import { useState } from "react";
import { useGetInspection, useUpdateInspection, getGetInspectionQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { MapPin, Briefcase, CheckCircle2, XCircle, ExternalLink, ChevronLeft, Camera, Save, Pencil, X, FileDown, PenLine, ShieldCheck } from "lucide-react";
import { AssignUser } from "@/components/assign-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { SkyInlineButton } from "@/components/sky";
import { PhotoPicker } from "@/components/photo-picker";
import { SignaturePad } from "@/components/signature-pad";
import { generateInspectionPDF } from "@/lib/pdf-generator";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/react";

export default function InspectionDetail() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateInspection = useUpdateInspection();
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as string) || "guest";
  const canEdit = role === "admin" || role === "user";
  const [editingPhotos, setEditingPhotos] = useState(false);
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [signingOff, setSigningOff] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: inspection, isLoading, error } = useGetInspection(id, {
    query: { enabled: !!id, queryKey: getGetInspectionQueryKey(id) }
  });

  const startEdit = () => {
    if (!inspection) return;
    setEditForm({
      tankSize: inspection.tankSize ?? "",
      tankQuantity: inspection.tankQuantity ?? "",
      requiresStand: inspection.requiresStand ?? false,
      requiresPlinth: inspection.requiresPlinth ?? false,
      truckAccess: inspection.truckAccess ?? false,
      trailerAccess: inspection.trailerAccess ?? false,
      siteReadyToQuote: inspection.siteReadyToQuote ?? false,
      notes: inspection.notes ?? "",
      offloadingConstraints: inspection.offloadingConstraints ?? "",
    });
    setEditing(true);
  };

  const handleSaveEdit = () => {
    const payload: any = {
      siteReadyToQuote: editForm.siteReadyToQuote,
      requiresStand: editForm.requiresStand,
      requiresPlinth: editForm.requiresPlinth,
      truckAccess: editForm.truckAccess,
      trailerAccess: editForm.trailerAccess,
    };
    if (editForm.tankSize) payload.tankSize = editForm.tankSize;
    if (editForm.tankQuantity) payload.tankQuantity = Number(editForm.tankQuantity);
    if (editForm.notes) payload.notes = editForm.notes;
    if (editForm.offloadingConstraints) payload.offloadingConstraints = editForm.offloadingConstraints;

    updateInspection.mutate({ id, data: payload }, {
      onSuccess: () => {
        toast({ title: "Inspection updated" });
        queryClient.invalidateQueries({ queryKey: getGetInspectionQueryKey(id) });
        setEditing(false);
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    });
  };

  const handleSavePhotos = () => {
    const photoUrls = photos.filter((p): p is string => p !== null);
    updateInspection.mutate(
      { id, data: { photoUrls: photoUrls.length > 0 ? photoUrls : [] } as any },
      {
        onSuccess: () => {
          toast({ title: "Photos saved" });
          queryClient.invalidateQueries({ queryKey: getGetInspectionQueryKey(id) });
          setEditingPhotos(false);
        },
        onError: () => toast({ title: "Failed to save photos", variant: "destructive" }),
      }
    );
  };

  const startEditingPhotos = () => {
    const existing = inspection?.photoUrls ?? [];
    const slots: (string | null)[] = [null, null, null, null];
    existing.forEach((url, i) => { if (i < 4) slots[i] = url; });
    setPhotos(slots);
    setEditingPhotos(true);
  };

  const handleSignOff = (signatureDataUrl: string) => {
    const signedOffBy = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Unknown";
    updateInspection.mutate(
      {
        id,
        data: {
          signatureUrl: signatureDataUrl,
          signedOffBy,
          signedOffAt: new Date() as any,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: "Inspection signed off", description: `Signed by ${signedOffBy}` });
          queryClient.invalidateQueries({ queryKey: getGetInspectionQueryKey(id) });
          setSigningOff(false);
        },
        onError: () => toast({ title: "Failed to save sign-off", variant: "destructive" }),
      }
    );
  };

  const handleDownloadPDF = async () => {
    if (!inspection) return;
    setPdfLoading(true);
    try {
      await generateInspectionPDF(inspection, inspection.customerName ?? undefined);
    } catch {
      toast({ title: "Failed to generate PDF", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };

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

  const hasPhotos = inspection.photoUrls && inspection.photoUrls.length > 0;
  const isSigned = !!(inspection as any).signatureUrl;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/inspections" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ChevronLeft className="h-4 w-4" /> Inspections
        </Link>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">Inspection #{inspection.id}</h1>
              {inspection.siteReadyToQuote && (
                <Badge className="bg-green-500 hover:bg-green-600 text-white">Ready to Quote</Badge>
              )}
              {isSigned && (
                <Badge className="bg-blue-500 hover:bg-blue-600 text-white gap-1">
                  <ShieldCheck className="h-3 w-3" /> Signed Off
                </Badge>
              )}
            </div>
            <Link href={`/customers/${inspection.customerId}`}>
              <p className="text-xl text-primary hover:underline cursor-pointer">
                {inspection.customerName || `Customer #${inspection.customerId}`}
                {inspection.farmName ? ` - ${inspection.farmName}` : ''}
              </p>
            </Link>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {inspection.visitType && (
                <Badge variant={inspection.visitType === "delivery_only" ? "secondary" : "outline"} className="text-xs">
                  {inspection.visitType === "delivery_only" ? "Delivery Only" : "Full Inspection"}
                </Badge>
              )}
              <p className="text-sm text-muted-foreground">
                Inspected: {inspection.inspectedAt ? format(new Date(inspection.inspectedAt), "PPP") : "Unknown"}
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto flex-col sm:flex-row">
            <SkyInlineButton
              contextType="inspection"
              contextData={inspection as unknown as Record<string, unknown>}
              contextLabel={`#${inspection.id}${inspection.farmName ? ` - ${inspection.farmName}` : ''}`}
              variant="outline"
              className="w-full sm:w-auto"
            />
            <Button
              variant="outline"
              className="w-full sm:w-auto gap-2"
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
            >
              <FileDown className="h-4 w-4" />
              {pdfLoading ? "Generating..." : "PDF Report"}
            </Button>
            {canEdit && !editing && (
              <Button variant="outline" className="w-full sm:w-auto gap-2" onClick={startEdit}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            )}
            <Link href={`/jobs/new?inspectionId=${inspection.id}&customerId=${inspection.customerId}${inspection.enquiryId ? `&enquiryId=${inspection.enquiryId}` : ''}`}>
              <Button className="w-full sm:w-auto"><Briefcase className="mr-2 h-4 w-4" /> Convert to Job</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Inline Edit Form */}
      {editing && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Edit Inspection</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setEditing(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Tank Size</label>
                <Input
                  value={editForm.tankSize}
                  onChange={e => setEditForm(f => ({ ...f, tankSize: e.target.value }))}
                  placeholder="e.g. 10000L"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Quantity</label>
                <Input
                  type="number"
                  value={editForm.tankQuantity}
                  onChange={e => setEditForm(f => ({ ...f, tankQuantity: e.target.value }))}
                  placeholder="1"
                />
              </div>
            </div>

            <div className="space-y-3">
              {[
                { key: "siteReadyToQuote", label: "Site ready to quote" },
                { key: "requiresStand", label: "Requires stand" },
                { key: "requiresPlinth", label: "Requires plinth" },
                { key: "truckAccess", label: "Truck access" },
                { key: "trailerAccess", label: "Trailer access" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  <Switch
                    checked={!!editForm[key]}
                    onCheckedChange={v => setEditForm(f => ({ ...f, [key]: v }))}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Offloading constraints</label>
              <Input
                value={editForm.offloadingConstraints}
                onChange={e => setEditForm(f => ({ ...f, offloadingConstraints: e.target.value }))}
                placeholder="e.g. Narrow gate, soft ground"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="Any additional site notes..."
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleSaveEdit} disabled={updateInspection.isPending} className="flex-1">
                <Save className="mr-2 h-4 w-4" />
                {updateInspection.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Site Photos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Site Photos</CardTitle>
            {!editingPhotos && (
              <Button variant="outline" size="sm" onClick={startEditingPhotos}>
                <Camera className="h-4 w-4 mr-1.5" />
                {hasPhotos ? "Edit Photos" : "Add Photos"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingPhotos ? (
            <div className="space-y-4">
              <PhotoPicker
                photos={photos}
                onChange={setPhotos}
                disabled={updateInspection.isPending}
              />
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={handleSavePhotos}
                  disabled={updateInspection.isPending}
                  className="flex-1 sm:flex-none"
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  {updateInspection.isPending ? "Saving..." : "Save Photos"}
                </Button>
                <Button variant="outline" onClick={() => setEditingPhotos(false)} className="flex-1 sm:flex-none">
                  Cancel
                </Button>
              </div>
            </div>
          ) : hasPhotos ? (
            <div className="grid grid-cols-2 gap-3">
              {inspection.photoUrls!.map((url, i) => (
                <div key={i} className="aspect-[4/3] rounded-lg overflow-hidden border shadow-sm">
                  <img src={url} alt={`Site photo ${i + 1}`} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No photos captured yet. Tap "Add Photos" to capture site photos.</p>
          )}
        </CardContent>
      </Card>

      {/* Digital Sign-Off */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              Digital Sign-Off
            </CardTitle>
            {!signingOff && canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSigningOff(true)}
                className={isSigned ? "text-muted-foreground" : "border-green-300 text-green-700 hover:bg-green-50"}
              >
                <PenLine className="h-4 w-4 mr-1.5" />
                {isSigned ? "Re-sign" : "Sign Off"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {signingOff ? (
            <SignaturePad
              onSave={handleSignOff}
              onCancel={() => setSigningOff(false)}
            />
          ) : isSigned ? (
            <div className="space-y-3">
              <div className="border rounded-lg overflow-hidden bg-white p-2 inline-block">
                <img
                  src={(inspection as any).signatureUrl}
                  alt="Customer signature"
                  className="h-20 w-auto max-w-xs object-contain"
                />
              </div>
              <div className="text-sm space-y-0.5">
                <p className="font-medium text-green-700 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Signed off by {(inspection as any).signedOffBy || "Unknown"}
                </p>
                {(inspection as any).signedOffAt && (
                  <p className="text-muted-foreground text-xs">
                    {format(new Date((inspection as any).signedOffAt), "PPP 'at' p")}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-4 text-center space-y-2">
              <PenLine className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                No sign-off yet. Tap "Sign Off" to capture a digital signature.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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
            currentAssignedToId={(inspection as any).assignedToId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
