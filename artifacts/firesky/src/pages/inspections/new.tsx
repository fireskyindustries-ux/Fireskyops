import { useState } from "react";
import { useCreateInspection, useListCustomers, useListEnquiries, getListInspectionsQueryKey } from "@workspace/api-client-react";
import { DynamicForm, FieldConfig } from "@/components/dynamic-form";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { PhotoPicker } from "@/components/photo-picker";
import { ChevronLeft, LayoutTemplate, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  label: string;
  description: string;
  defaults: Record<string, any>;
}

const INSPECTION_TEMPLATES: Template[] = [
  {
    id: "flat_ground",
    label: "Flat Ground",
    description: "Standard install — truck + trailer access",
    defaults: {
      requiresStand: false,
      requiresPlinth: false,
      truckAccess: true,
      trailerAccess: true,
      groundCondition: "Flat, firm ground",
    },
  },
  {
    id: "elevated_stand",
    label: "Elevated Stand",
    description: "High-pressure supply — steel stand required",
    defaults: {
      requiresStand: true,
      standHeight: "2m",
      requiresPlinth: false,
      truckAccess: true,
      trailerAccess: false,
    },
  },
  {
    id: "plinth_pump",
    label: "Plinth + Pump",
    description: "Concrete plinth with pump installation",
    defaults: {
      requiresStand: false,
      requiresPlinth: true,
      plinthDetails: "Concrete plinth required — level site prep needed before pour",
      truckAccess: true,
      trailerAccess: false,
    },
  },
  {
    id: "sloped_site",
    label: "Sloped / Hillside",
    description: "Uneven terrain — additional site prep",
    defaults: {
      requiresStand: true,
      requiresPlinth: true,
      plinthDetails: "Level cut or build-up required before plinth pour",
      groundCondition: "Sloped / uneven — requires levelling",
      truckAccess: false,
      trailerAccess: false,
      offloadingConstraints: "Sloped terrain — confirm offload point with crane or manual carry",
    },
  },
];

export default function NewInspection() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createInspection = useCreateInspection();
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [templateDefaults, setTemplateDefaults] = useState<Record<string, any>>({});

  const urlParams = new URLSearchParams(window.location.search);
  const customerIdParam = urlParams.get("customerId");
  const enquiryIdParam = urlParams.get("enquiryId");

  const { data: customers } = useListCustomers();
  const { data: enquiries } = useListEnquiries();

  const customerOptions = customers?.map(c => ({
    label: c.farmName ? `${c.name} (${c.farmName})` : c.name,
    value: c.id.toString()
  })) || [];

  const enquiryOptions = enquiries?.map(e => ({
    label: `${e.title} (${e.status})`,
    value: e.id.toString()
  })) || [];

  const inspectionFields: FieldConfig[] = [
    { key: "customerId", label: "Customer", type: "select", required: true, options: customerOptions, section: "General" },
    { key: "enquiryId", label: "Related Enquiry", type: "select", options: enquiryOptions, section: "General" },
    { key: "visitType", label: "Visit Type", type: "select", required: true, options: [
      { label: "Full Inspection", value: "inspection" },
      { label: "Delivery Only", value: "delivery_only" },
    ], section: "General" },

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

  function applyTemplate(template: Template) {
    localStorage.removeItem("firesky_draft_inspection");
    setSelectedTemplate(template.id);
    setTemplateDefaults(template.defaults);
    setFormKey(k => k + 1);
  }

  function clearTemplate() {
    localStorage.removeItem("firesky_draft_inspection");
    setSelectedTemplate(null);
    setTemplateDefaults({});
    setFormKey(k => k + 1);
  }

  const handleSubmit = (data: any) => {
    const photoUrls = photos.filter((p): p is string => p !== null);
    const payload = {
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

    createInspection.mutate({ data: payload }, {
      onSuccess: (res) => {
        toast({ title: "Inspection recorded successfully" });
        queryClient.invalidateQueries({ queryKey: getListInspectionsQueryKey() });
        setLocation(`/inspections/${res.id}`);
      },
      onError: (err) => {
        toast({ title: "Failed to record inspection", description: (err as any)?.message || "Unknown error", variant: "destructive" });
      }
    });
  };

  const defaultValues = {
    ...templateDefaults,
    customerId: customerIdParam || undefined,
    enquiryId: enquiryIdParam || undefined
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/inspections" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ChevronLeft className="h-4 w-4" /> Inspections
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Site Inspection</h1>
        <p className="text-muted-foreground">Detailed site prep and access check</p>
      </div>

      {/* Site Templates */}
      <div className="bg-card border rounded-lg p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Quick Start Template</h2>
          <span className="text-xs text-muted-foreground">(optional — pre-fills common install settings)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {INSPECTION_TEMPLATES.map(tpl => {
            const active = selectedTemplate === tpl.id;
            return (
              <button
                key={tpl.id}
                onClick={() => active ? clearTemplate() : applyTemplate(tpl)}
                className={cn(
                  "text-left rounded-lg border px-3 py-2.5 transition-all text-sm",
                  active
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/60"
                )}
              >
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="font-semibold text-xs">{tpl.label}</span>
                  {active && <Check className="h-3 w-3 text-primary shrink-0" />}
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">{tpl.description}</p>
              </button>
            );
          })}
        </div>
        {selectedTemplate && (
          <p className="text-xs text-primary font-medium">
            Template applied — installation defaults pre-filled. You can edit any field below.
          </p>
        )}
      </div>

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
          key={formKey}
          fields={inspectionFields}
          onSubmit={handleSubmit}
          storageKey="firesky_draft_inspection"
          submitLabel="Complete Inspection"
          isSubmitting={createInspection.isPending}
          defaultValues={defaultValues}
        />
      </div>
    </div>
  );
}
