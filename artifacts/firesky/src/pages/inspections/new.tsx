import { useCreateInspection, useListCustomers, useListEnquiries, getListInspectionsQueryKey } from "@workspace/api-client-react";
import { DynamicForm, FieldConfig } from "@/components/dynamic-form";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function NewInspection() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createInspection = useCreateInspection();
  
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

  const handleSubmit = (data: any) => {
    const payload = {
      ...data,
      customerId: Number(data.customerId),
      enquiryId: data.enquiryId ? Number(data.enquiryId) : undefined,
      tankQuantity: data.tankQuantity ? Number(data.tankQuantity) : undefined,
      pipeLength: data.pipeLength ? Number(data.pipeLength) : undefined,
      distanceFromRoad: data.distanceFromRoad ? Number(data.distanceFromRoad) : undefined,
      distanceFromHouse: data.distanceFromHouse ? Number(data.distanceFromHouse) : undefined,
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
    customerId: customerIdParam || undefined,
    enquiryId: enquiryIdParam || undefined
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Site Inspection</h1>
        <p className="text-muted-foreground">Detailed site prep and access check</p>
      </div>

      <div className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm">
        <DynamicForm 
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