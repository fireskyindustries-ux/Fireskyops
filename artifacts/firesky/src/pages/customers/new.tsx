import { useCreateCustomer, getListCustomersQueryKey } from "@workspace/api-client-react";
import { DynamicForm, FieldConfig } from "@/components/dynamic-form";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const customerFields: FieldConfig[] = [
  { key: "name", label: "Customer / Business Name", type: "text", required: true, placeholder: "e.g. John Smith or Willow Creek Farms", section: "Basic Details" },
  { key: "contactName", label: "Contact Person", type: "text", placeholder: "If different from above", section: "Basic Details" },
  { key: "phone", label: "Phone Number", type: "tel", required: true, placeholder: "082 123 4567", section: "Basic Details" },
  { key: "email", label: "Email Address", type: "email", placeholder: "john@example.com", section: "Basic Details" },
  { key: "vatNumber", label: "VAT Number", type: "text", placeholder: "4500000000", section: "Basic Details" },

  { key: "billingAddress", label: "Street Address / P.O. Box", type: "text", placeholder: "e.g. 12 Main Street or P.O. Box 45", section: "Billing Address" },
  { key: "billingCity", label: "City / Town", type: "text", placeholder: "e.g. Johannesburg", section: "Billing Address" },
  { key: "billingProvince", label: "Province", type: "select", options: [
    { label: "Eastern Cape", value: "Eastern Cape" },
    { label: "Free State", value: "Free State" },
    { label: "Gauteng", value: "Gauteng" },
    { label: "KwaZulu-Natal", value: "KwaZulu-Natal" },
    { label: "Limpopo", value: "Limpopo" },
    { label: "Mpumalanga", value: "Mpumalanga" },
    { label: "Northern Cape", value: "Northern Cape" },
    { label: "North West", value: "North West" },
    { label: "Western Cape", value: "Western Cape" },
  ], section: "Billing Address" },
  { key: "billingPostalCode", label: "Postal Code", type: "text", placeholder: "e.g. 2000", section: "Billing Address" },

  { key: "farmName", label: "Farm / Site Name", type: "text", placeholder: "e.g. Willow Creek", section: "Location Details" },
  { key: "nearestTown", label: "Nearest Town", type: "text", required: true, placeholder: "e.g. Bethal", helperText: "Enter the nearest town as a landmark for navigation", section: "Location Details" },
  { key: "province", label: "Province", type: "select", options: [
    { label: "Eastern Cape", value: "Eastern Cape" },
    { label: "Free State", value: "Free State" },
    { label: "Gauteng", value: "Gauteng" },
    { label: "KwaZulu-Natal", value: "KwaZulu-Natal" },
    { label: "Limpopo", value: "Limpopo" },
    { label: "Mpumalanga", value: "Mpumalanga" },
    { label: "Northern Cape", value: "Northern Cape" },
    { label: "North West", value: "North West" },
    { label: "Western Cape", value: "Western Cape" }
  ], section: "Location Details" },
  { key: "whatsappLocation", label: "WhatsApp / GPS Location", type: "text", placeholder: "https://maps.app.goo.gl/... or -26.123, 28.456", helperText: "Paste a WhatsApp location link or GPS coordinates", section: "Location Details" },
  { key: "manualDirections", label: "Manual Directions", type: "textarea", placeholder: "Take the R38 from Bethal, turn left at the silo...", section: "Location Details" },
  { key: "landmarks", label: "Landmarks", type: "textarea", placeholder: "Red gate, green roof on the shed", section: "Location Details" },
  { key: "accessNotes", label: "Access Notes", type: "textarea", placeholder: "Call 10 mins before arrival for the gate code", section: "Location Details" },
  
  { key: "notes", label: "General Notes", type: "textarea", placeholder: "Any other details about the customer", section: "Other" },
];

export default function NewCustomer() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createCustomer = useCreateCustomer();

  const handleSubmit = (data: any) => {
    createCustomer.mutate({ data }, {
      onSuccess: (res) => {
        toast({ title: "Customer created successfully" });
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        setLocation(`/customers/${res.id}`);
      },
      onError: (err) => {
        toast({ title: "Failed to create customer", description: (err as any)?.message || "Unknown error", variant: "destructive" });
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Customer</h1>
        <p className="text-muted-foreground">Add a new farm or client to the database</p>
      </div>

      <div className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm">
        <DynamicForm 
          fields={customerFields} 
          onSubmit={handleSubmit} 
          storageKey="firesky_draft_customer" 
          submitLabel="Create Customer"
          isSubmitting={createCustomer.isPending}
        />
      </div>
    </div>
  );
}