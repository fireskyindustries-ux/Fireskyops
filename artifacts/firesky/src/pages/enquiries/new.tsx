import { useCreateEnquiry, useListCustomers, getListEnquiriesQueryKey } from "@workspace/api-client-react";
import { DynamicForm, FieldConfig } from "@/components/dynamic-form";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function NewEnquiry() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createEnquiry = useCreateEnquiry();
  
  // Use a simple window.location parsing for query params since wouter doesn't have a built-in search params hook that's reactive enough without extra libraries
  const urlParams = new URLSearchParams(window.location.search);
  const customerIdParam = urlParams.get("customerId");

  // Need customers list for the select dropdown
  const { data: customers, isLoading: customersLoading } = useListCustomers();

  const customerOptions = customers?.map(c => ({
    label: c.farmName ? `${c.name} (${c.farmName})` : c.name,
    value: c.id.toString()
  })) || [];

  const enquiryFields: FieldConfig[] = [
    { key: "customerId", label: "Customer", type: "select", required: true, options: customerOptions, section: "General" },
    { key: "title", label: "Enquiry Title", type: "text", required: true, placeholder: "e.g. 2x 10000L tanks for irrigation", section: "General" },
    { key: "priority", label: "Priority", type: "select", options: [
      { label: "Low", value: "low" },
      { label: "Medium", value: "medium" },
      { label: "High", value: "high" }
    ], section: "General" },
    
    { key: "tankSize", label: "Tank Size (if known)", type: "text", placeholder: "e.g. 10000L, 5000L", section: "Requirements" },
    { key: "tankQuantity", label: "Quantity", type: "number", placeholder: "1", section: "Requirements" },
    { key: "description", label: "Description / Request", type: "textarea", placeholder: "Customer needs tanks installed on a 2m stand...", section: "Requirements" },
    { key: "notes", label: "Internal Notes", type: "textarea", placeholder: "Any internal remarks...", section: "Requirements" },
  ];

  const handleSubmit = (data: any) => {
    // Coerce customerId and tankQuantity to numbers
    const payload = {
      ...data,
      customerId: Number(data.customerId),
      tankQuantity: data.tankQuantity ? Number(data.tankQuantity) : undefined,
      status: "new"
    };

    createEnquiry.mutate({ data: payload }, {
      onSuccess: (res) => {
        toast({ title: "Enquiry created successfully" });
        queryClient.invalidateQueries({ queryKey: getListEnquiriesQueryKey() });
        setLocation(`/enquiries/${res.id}`);
      },
      onError: (err) => {
        toast({ title: "Failed to create enquiry", description: (err as any)?.message || "Unknown error", variant: "destructive" });
      }
    });
  };

  if (customersLoading) {
    return <div>Loading customers...</div>;
  }

  const defaultValues = customerIdParam ? { customerId: customerIdParam } : {};

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Enquiry</h1>
        <p className="text-muted-foreground">Capture a new lead or request</p>
      </div>

      <div className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm">
        <DynamicForm 
          fields={enquiryFields} 
          onSubmit={handleSubmit} 
          storageKey="firesky_draft_enquiry" 
          submitLabel="Create Enquiry"
          isSubmitting={createEnquiry.isPending}
          defaultValues={defaultValues}
        />
      </div>
    </div>
  );
}