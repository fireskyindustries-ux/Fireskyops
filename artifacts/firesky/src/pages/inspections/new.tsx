import { useState, useEffect, useRef } from "react";
import { useCreateInspection, useListCustomers, useListEnquiries, getListInspectionsQueryKey } from "@workspace/api-client-react";
import { DynamicForm, FieldConfig } from "@/components/dynamic-form";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { PhotoPicker } from "@/components/photo-picker";
import { ChevronLeft, CloudOff, CheckCircle2 } from "lucide-react";
import { useOnline } from "@/hooks/use-online";
import { enqueue, getQueue, dequeue } from "@/lib/offline-queue";

const CUSTOMERS_CACHE_KEY = "firesky_customers_cache";
const ENQUIRIES_CACHE_KEY = "firesky_enquiries_cache";

export default function NewInspection() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createInspection = useCreateInspection();
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const online = useOnline();
  const syncingRef = useRef(false);

  const urlParams = new URLSearchParams(window.location.search);
  const customerIdParam = urlParams.get("customerId");
  const enquiryIdParam = urlParams.get("enquiryId");

  const { data: customers } = useListCustomers();
  const { data: enquiries } = useListEnquiries();

  useEffect(() => {
    if (customers && customers.length > 0) {
      localStorage.setItem(CUSTOMERS_CACHE_KEY, JSON.stringify(customers));
    }
  }, [customers]);

  useEffect(() => {
    if (enquiries && enquiries.length > 0) {
      localStorage.setItem(ENQUIRIES_CACHE_KEY, JSON.stringify(enquiries));
    }
  }, [enquiries]);

  const cachedCustomers = (() => {
    try { return JSON.parse(localStorage.getItem(CUSTOMERS_CACHE_KEY) || "[]"); } catch { return []; }
  })();
  const cachedEnquiries = (() => {
    try { return JSON.parse(localStorage.getItem(ENQUIRIES_CACHE_KEY) || "[]"); } catch { return []; }
  })();

  const resolvedCustomers = customers ?? cachedCustomers;
  const resolvedEnquiries = enquiries ?? cachedEnquiries;

  const customerOptions = resolvedCustomers.map((c: any) => ({
    label: c.farmName ? `${c.name} (${c.farmName})` : c.name,
    value: c.id.toString()
  }));

  const enquiryOptions = resolvedEnquiries.map((e: any) => ({
    label: `${e.title} (${e.status})`,
    value: e.id.toString()
  }));

  const syncQueue = async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    const queue = getQueue();
    if (queue.length === 0) { syncingRef.current = false; return; }

    for (const item of queue) {
      try {
        await new Promise<void>((resolve, reject) => {
          createInspection.mutate({ data: item.payload as any }, {
            onSuccess: () => { dequeue(item.id); resolve(); },
            onError: (err) => reject(err),
          });
        });
      } catch {
        break;
      }
    }

    const remaining = getQueue().length;
    if (remaining === 0) {
      queryClient.invalidateQueries({ queryKey: getListInspectionsQueryKey() });
      toast({ title: "Offline inspections synced", description: "All saved inspections have been uploaded." });
    }
    syncingRef.current = false;
  };

  useEffect(() => {
    if (online && getQueue().length > 0) {
      syncQueue();
    }
  }, [online]);

  const inspectionFields: FieldConfig[] = [
    { key: "customerId", label: "Customer", type: "select", required: true, options: customerOptions, section: "General" },
    { key: "enquiryId", label: "Related Enquiry", type: "select", options: enquiryOptions, section: "General" },

    { key: "farmName", label: "Farm / Site Name", type: "text", section: "Location Details" },
    { key: "nearestTown", label: "Nearest Town", type: "text", required: true, helperText: "Enter the nearest town as a landmark for navigation", section: "Location Details" },
    { key: "whatsappLocation", label: "GPS / WhatsApp Location", type: "gps", helperText: "Tap the crosshair to capture your current GPS location, or paste a WhatsApp location link", section: "Location Details" },
    { key: "manualDirections", label: "Manual Directions", type: "textarea", section: "Location Details" },
    { key: "landmarks", label: "Landmarks", type: "textarea", section: "Location Details" },
    { key: "accessNotes", label: "Access Notes", type: "textarea", section: "Location Details" },

    { key: "tankSize", label: "Tank Size Required", type: "text", placeholder: "e.g. 10000L", section: "Tank Requirements" },
    { key: "tankQuantity", label: "Quantity", type: "number", placeholder: "1", section: "Tank Requirements" },

    { key: "requiresStand", label: "Requires Tank Stand?", type: "boolean", section: "Installation Prep" },
    { key: "standHeight", label: "Stand Height", type: "text", placeholder: "e.g. 2m, 3m", section: "Installation Prep" },
    { key: "requiresPlinth", label: "Requires Concrete Plinth?", type: "boolean", section: "Installation Prep" },
    { key: "plinthDetails", label: "Plinth Details", type: "textarea", placeholder: "Dimensions, leveling required...", section: "Installation Prep" },
    { key: "pipeLength", label: "Estimated Pipe Length (meters)", type: "number", section: "Installation Prep" },
    { key: "pipeDetails", label: "Pipe Routing Details", type: "textarea", placeholder: "Underground routing to existing borehole...", section: "Installation Prep" },

    { key: "distanceFromRoad", label: "Distance from road (meters)", type: "number", section: "Site Access & Offloading" },
    { key: "distanceFromHouse", label: "Distance from house (meters)", type: "number", section: "Site Access & Offloading" },
    { key: "truckAccess", label: "Can a flatbed truck reach the site?", type: "boolean", section: "Site Access & Offloading" },
    { key: "trailerAccess", label: "Can a truck + trailer reach the site?", type: "boolean", section: "Site Access & Offloading" },
    { key: "offloadingConstraints", label: "Offloading Constraints", type: "textarea", placeholder: "Trees, powerlines, soft sand...", section: "Site Access & Offloading" },
    { key: "groundCondition", label: "Ground Condition", type: "text", placeholder: "Rocky, sandy, marshy...", section: "Site Access & Offloading" },

    { key: "siteReadyToQuote", label: "Is site ready to quote?", type: "boolean", section: "Readiness & Notes" },
    { key: "notes", label: "Inspection Notes", type: "textarea", placeholder: "Any other details observed on site...", section: "Readiness & Notes" },
  ];

  const buildPayload = (data: any) => {
    const photoUrls = photos.filter((p): p is string => p !== null);
    return {
      ...data,
      customerId: Number(data.customerId),
      enquiryId: data.enquiryId ? Number(data.enquiryId) : undefined,
      tankQuantity: data.tankQuantity ? Number(data.tankQuantity) : undefined,
      pipeLength: data.pipeLength ? Number(data.pipeLength) : undefined,
      distanceFromRoad: data.distanceFromRoad ? Number(data.distanceFromRoad) : undefined,
      distanceFromHouse: data.distanceFromHouse ? Number(data.distanceFromHouse) : undefined,
      photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
      inspectedAt: new Date().toISOString()
    };
  };

  const handleSubmit = (data: any) => {
    const payload = buildPayload(data);

    if (!online) {
      enqueue(payload);
      localStorage.removeItem("firesky_draft_inspection");
      toast({
        title: "Saved for later",
        description: "No signal detected. This inspection will upload automatically when you're back online.",
      });
      setLocation("/inspections");
      return;
    }

    createInspection.mutate({ data: payload }, {
      onSuccess: (res) => {
        toast({ title: "Inspection recorded successfully" });
        queryClient.invalidateQueries({ queryKey: getListInspectionsQueryKey() });
        setLocation(`/inspections/${res.id}`);
      },
      onError: (err) => {
        enqueue(payload);
        localStorage.removeItem("firesky_draft_inspection");
        toast({
          title: "Saved for later",
          description: "Could not reach the server. Inspection queued and will sync automatically.",
        });
        setLocation("/inspections");
      }
    });
  };

  const defaultValues = {
    customerId: customerIdParam || undefined,
    enquiryId: enquiryIdParam || undefined
  };

  const queuedCount = getQueue().length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/inspections" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ChevronLeft className="h-4 w-4" /> Inspections
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Site Inspection</h1>
        <p className="text-muted-foreground">Detailed site prep and access check</p>
      </div>

      {!online && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-400">
          <CloudOff className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Working offline</p>
            <p className="text-amber-400/80 mt-0.5">Fill in the form and tap Complete — it will be saved locally and uploaded automatically once you have signal.</p>
          </div>
        </div>
      )}

      {online && queuedCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-sm text-green-400">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Syncing {queuedCount} offline {queuedCount === 1 ? "inspection" : "inspections"}</p>
            <p className="text-green-400/80 mt-0.5">Your saved inspections are being uploaded now.</p>
          </div>
        </div>
      )}

      {/* Site Photos */}
      <div className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm space-y-3">
        <div>
          <h2 className="text-base font-semibold">Site Photos</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Tap a slot to take a photo or pick from your gallery. Up to 4 photos.</p>
        </div>
        <PhotoPicker
          photos={photos}
          onChange={setPhotos}
          disabled={createInspection.isPending}
        />
      </div>

      {/* Inspection Fields */}
      <div className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm">
        <DynamicForm
          fields={inspectionFields}
          onSubmit={handleSubmit}
          storageKey="firesky_draft_inspection"
          submitLabel={online ? "Complete Inspection" : "Save for Later"}
          isSubmitting={createInspection.isPending}
          defaultValues={defaultValues}
        />
      </div>
    </div>
  );
}
