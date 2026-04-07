import { useState } from "react";
import { useCreateJob, useListCustomers, useListEnquiries, useListInspections, getListJobsQueryKey } from "@workspace/api-client-react";
import { DynamicForm, FieldConfig } from "@/components/dynamic-form";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Truck, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

function JobTypeToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Job Type</label>
      <div className="flex rounded-xl border border-border overflow-hidden bg-muted/30 p-1 gap-1">
        <button
          type="button"
          onClick={() => onChange("full_install")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all",
            value === "full_install"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Wrench className="h-4 w-4" />
          Full Install
        </button>
        <button
          type="button"
          onClick={() => onChange("delivery_only")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all",
            value === "delivery_only"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Truck className="h-4 w-4" />
          Delivery Only
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {value === "full_install"
          ? "Includes tank delivery, placement, stand or plinth, and full pipe connection."
          : "Tank delivered to site only. Customer handles placement and connection."}
      </p>
    </div>
  );
}

export default function NewJob() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createJob = useCreateJob();
  const [jobType, setJobType] = useState("full_install");

  const urlParams = new URLSearchParams(window.location.search);
  const customerIdParam = urlParams.get("customerId");
  const enquiryIdParam = urlParams.get("enquiryId");
  const inspectionIdParam = urlParams.get("inspectionId");

  const { data: customers } = useListCustomers();
  const { data: enquiries } = useListEnquiries();
  const { data: inspections } = useListInspections();

  const customerOptions = customers?.map(c => ({
    label: c.farmName ? `${c.name} (${c.farmName})` : c.name,
    value: c.id.toString()
  })) || [];

  const enquiryOptions = enquiries?.map(e => ({
    label: `${e.title} (${e.status})`,
    value: e.id.toString()
  })) || [];

  const inspectionOptions = inspections?.map(i => ({
    label: `Insp #${i.id} - ${i.customerName}`,
    value: i.id.toString()
  })) || [];

  const jobFields: FieldConfig[] = [
    { key: "customerId", label: "Customer", type: "select", required: true, options: customerOptions, section: "General" },
    { key: "title", label: "Job Title", type: "text", required: true, placeholder: "e.g. Install 2x 10000L tanks with stand", section: "General" },
    { key: "stage", label: "Pipeline Stage", type: "select", required: true, options: [
      { label: "Enquiry", value: "enquiry" },
      { label: "Inspection", value: "inspection" },
      { label: "Quoting", value: "quoting" },
      { label: "Quoted", value: "quoted" },
      { label: "Won", value: "won" },
      { label: "Lost", value: "lost" }
    ], section: "General" },
    { key: "priority", label: "Priority", type: "select", options: [
      { label: "Low", value: "low" },
      { label: "Medium", value: "medium" },
      { label: "High", value: "high" }
    ], section: "General" },

    { key: "enquiryId", label: "Related Enquiry", type: "select", options: enquiryOptions, section: "Related Records" },
    { key: "inspectionId", label: "Related Inspection", type: "select", options: inspectionOptions, section: "Related Records" },

    { key: "tankSize", label: "Tank Size", type: "text", placeholder: "e.g. 10000L", section: "Details" },
    { key: "tankQuantity", label: "Quantity", type: "number", placeholder: "1", section: "Details" },
    { key: "estimatedValue", label: "Estimated Value (R)", type: "number", placeholder: "50000", section: "Details" },

    { key: "notes", label: "Job Notes", type: "textarea", placeholder: "Any execution notes...", section: "Details" },
  ];

  const handleSubmit = (data: any) => {
    const payload = {
      ...data,
      jobType,
      customerId: Number(data.customerId),
      enquiryId: data.enquiryId ? Number(data.enquiryId) : undefined,
      inspectionId: data.inspectionId ? Number(data.inspectionId) : undefined,
      tankQuantity: data.tankQuantity ? Number(data.tankQuantity) : undefined,
      estimatedValue: data.estimatedValue ? Number(data.estimatedValue) : undefined,
    };

    createJob.mutate({ data: payload }, {
      onSuccess: (res) => {
        toast({ title: "Job created successfully" });
        queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
        setLocation(`/jobs/${res.id}`);
      },
      onError: (err) => {
        toast({ title: "Failed to create job", description: (err as any)?.message || "Unknown error", variant: "destructive" });
      }
    });
  };

  const defaultValues = {
    customerId: customerIdParam || undefined,
    enquiryId: enquiryIdParam || undefined,
    inspectionId: inspectionIdParam || undefined,
    stage: "quoted"
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Job</h1>
        <p className="text-muted-foreground">Add a new installation job to the pipeline</p>
      </div>

      <div className="bg-card border rounded-lg p-4 sm:p-6 shadow-sm space-y-6">
        <JobTypeToggle value={jobType} onChange={setJobType} />
        <div className="border-t pt-4">
          <DynamicForm
            fields={jobFields}
            onSubmit={handleSubmit}
            storageKey="firesky_draft_job"
            submitLabel="Create Job"
            isSubmitting={createJob.isPending}
            defaultValues={defaultValues}
          />
        </div>
      </div>
    </div>
  );
}
