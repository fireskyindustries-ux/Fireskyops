import { useUpdateCustomer, useGetCustomer, getGetCustomerQueryKey, getListCustomersQueryKey } from "@workspace/api-client-react";
import { DynamicForm, FieldConfig } from "@/components/dynamic-form";
import { useParams, useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const customerFields: FieldConfig[] = [
  { key: "name", label: "Customer / Business Name", type: "text", required: true, placeholder: "e.g. John Smith or Willow Creek Farms", section: "Basic Details" },
  { key: "contactName", label: "Contact Person", type: "text", placeholder: "If different from above", section: "Basic Details" },
  { key: "phone", label: "Phone Number", type: "tel", required: true, placeholder: "082 123 4567", section: "Basic Details" },
  { key: "email", label: "Email Address", type: "email", placeholder: "john@example.com", section: "Basic Details" },

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
    { label: "Western Cape", value: "Western Cape" },
  ], section: "Location Details" },
  { key: "whatsappLocation", label: "WhatsApp / GPS Location", type: "text", placeholder: "https://maps.app.goo.gl/... or -26.123, 28.456", helperText: "Paste a WhatsApp location link or GPS coordinates", section: "Location Details" },
  { key: "manualDirections", label: "Manual Directions", type: "textarea", placeholder: "Take the R38 from Bethal, turn left at the silo...", section: "Location Details" },
  { key: "landmarks", label: "Landmarks", type: "textarea", placeholder: "Red gate, green roof on the shed", section: "Location Details" },
  { key: "accessNotes", label: "Access Notes", type: "textarea", placeholder: "Call 10 mins before arrival for the gate code", section: "Location Details" },

  { key: "notes", label: "General Notes", type: "textarea", placeholder: "Any other details about the customer", section: "Other" },
];

export default function EditCustomer() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateCustomer = useUpdateCustomer();

  const { data: customer, isLoading } = useGetCustomer(id, {
    query: { enabled: !!id, queryKey: getGetCustomerQueryKey(id) },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!customer) {
    return <div className="text-destructive">Customer not found</div>;
  }

  const handleSubmit = (data: any) => {
    updateCustomer.mutate({ id, data }, {
      onSuccess: () => {
        toast({ title: "Customer updated successfully" });
        queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        setLocation(`/customers/${id}`);
      },
      onError: (err) => {
        toast({ title: "Failed to update customer", description: (err as any)?.message || "Unknown error", variant: "destructive" });
      },
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href={`/customers/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ChevronLeft className="h-4 w-4" /> {customer.name}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Edit Customer</h1>
        <p className="text-muted-foreground">Update details for {customer.name}</p>
      </div>

      <div className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm">
        <DynamicForm
          fields={customerFields}
          defaultValues={customer as any}
          storageKey={`firesky_edit_customer_${id}`}
          onSubmit={handleSubmit}
          submitLabel="Save Changes"
          isSubmitting={updateCustomer.isPending}
        />
      </div>
    </div>
  );
}
