import { useState } from "react";
import { useCreateEnquiry, useCreateCustomer, useListCustomers, getListEnquiriesQueryKey, getListCustomersQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, LocateFixed, Sparkles } from "lucide-react";
import { useSkyActions } from "@/components/sky";

const PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal",
  "Limpopo", "Mpumalanga", "Northern Cape", "North West", "Western Cape"
];

type CustomerMode = "new" | "existing";

interface FormValues {
  // Customer (new)
  name: string;
  phone: string;
  email?: string;
  contactName?: string;
  farmName?: string;
  nearestTown: string;
  province?: string;
  whatsappLocation?: string;
  manualDirections?: string;
  landmarks?: string;
  accessNotes?: string;
  // Customer (existing)
  existingCustomerId?: string;
  // Enquiry
  title: string;
  priority?: string;
  tankSize?: string;
  tankQuantity?: string;
  description?: string;
  notes?: string;
}

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function NewEnquiry() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { openSky } = useSkyActions();
  const { user } = useUser();
  const role = ((user?.publicMetadata?.role as string) || "guest") as "admin" | "user" | "guest";
  const isGuest = role === "guest";
  const createCustomer = useCreateCustomer();
  const createEnquiry = useCreateEnquiry();
  const { data: customers } = useListCustomers();
  const [mode, setMode] = useState<CustomerMode>("new");
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: { priority: "medium" }
  });

  const selectedProvince = watch("province");
  const selectedExistingId = watch("existingCustomerId");
  const locationValue = watch("whatsappLocation");

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "GPS not supported", description: "Your browser doesn't support location access", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
        setValue("whatsappLocation", coords, { shouldValidate: true });
        setLocating(false);
        toast({ title: "Location captured", description: coords });
      },
      (err) => {
        setLocating(false);
        const msg = err.code === 1 ? "Location permission denied — please allow location access in your browser" :
                    err.code === 2 ? "Location unavailable — check GPS signal" :
                    "Location request timed out";
        toast({ title: "Could not get location", description: msg, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      let customerId: number;

      if (mode === "new") {
        if (!data.name || !data.phone || !data.nearestTown) {
          toast({ title: "Please fill in required customer fields", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        const customer = await createCustomer.mutateAsync({
          data: {
            name: data.name,
            phone: data.phone,
            email: data.email || undefined,
            contactName: data.contactName || undefined,
            farmName: data.farmName || undefined,
            nearestTown: data.nearestTown,
            province: data.province || undefined,
            whatsappLocation: data.whatsappLocation || undefined,
            manualDirections: data.manualDirections || undefined,
            landmarks: data.landmarks || undefined,
            accessNotes: data.accessNotes || undefined,
          }
        });
        customerId = customer.id;
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
      } else {
        if (!data.existingCustomerId) {
          toast({ title: "Please select an existing customer", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        customerId = Number(data.existingCustomerId);
      }

      if (!data.title) {
        toast({ title: "Please fill in the enquiry title", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const enquiry = await createEnquiry.mutateAsync({
        data: {
          customerId,
          title: data.title,
          priority: data.priority || "medium",
          tankSize: data.tankSize || undefined,
          tankQuantity: data.tankQuantity ? Number(data.tankQuantity) : undefined,
          description: data.description || undefined,
          notes: data.notes || undefined,
          status: "new",
        }
      });

      queryClient.invalidateQueries({ queryKey: getListEnquiriesQueryKey() });
      if (isGuest) {
        setSubmitted(true);
      } else {
        toast({ title: "Enquiry created", description: "Customer and enquiry saved successfully" });
        setLocation(`/enquiries/${enquiry.id}`);
      }
    } catch (err: any) {
      toast({ title: "Failed to save", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center gap-6 px-4">
        <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Request Received</h1>
          <p className="text-muted-foreground">
            Thank you — your enquiry has been submitted. The Firesky Industries team will be in touch with you shortly.
          </p>
        </div>
        <Button
          className="h-12 px-10 hex-clip font-semibold text-base"
          onClick={() => { window.location.href = "https://www.fireskyindustries.co.za"; }}
        >
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">

      {/* Sky AI Ribbon */}
      <button
        type="button"
        onClick={() => openSky({ contextType: "enquiry" })}
        className="w-full flex items-center gap-3 px-5 py-3 rounded-lg bg-primary text-primary-foreground shadow-md hover:brightness-110 active:scale-[0.99] transition-all text-left"
      >
        <Sparkles className="h-5 w-5 shrink-0" />
        <span className="font-semibold text-sm tracking-wide">Use Sky AI to Assist you with your system build.</span>
      </button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Enquiry</h1>
        <p className="text-muted-foreground">Capture a new lead — customer info and request in one step</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* Customer Section */}
        <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b bg-muted/40">
            <div>
              <h2 className="text-base font-semibold">Customer Details</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Who is this enquiry from?</p>
            </div>
            {!isGuest && (
              <Tabs value={mode} onValueChange={(v) => setMode(v as CustomerMode)}>
                <TabsList className="h-8 text-xs">
                  <TabsTrigger value="new" className="text-xs px-3">New Customer</TabsTrigger>
                  <TabsTrigger value="existing" className="text-xs px-3">Existing</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            {mode === "existing" ? (
              <Field label="Select Customer" required>
                <Select onValueChange={(v) => setValue("existingCustomerId", v)} value={selectedExistingId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Choose an existing customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.farmName ? `${c.name} — ${c.farmName}` : c.name}
                        {c.nearestTown ? ` (${c.nearestTown})` : ""}
                      </SelectItem>
                    ))}
                    {!customers?.length && (
                      <SelectItem value="__none" disabled>No customers yet</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Customer / Business Name" required>
                    <Input {...register("name")} placeholder="e.g. John Smith or Willow Creek Farms" className="h-11" />
                  </Field>
                  <Field label="Contact Person" hint="If different from name above">
                    <Input {...register("contactName")} placeholder="e.g. Jane Smith" className="h-11" />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Phone Number" required>
                    <Input {...register("phone")} type="tel" placeholder="082 123 4567" className="h-11" />
                  </Field>
                  <Field label="Email Address">
                    <Input {...register("email")} type="email" placeholder="john@example.com" className="h-11" />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Farm / Site Name">
                    <Input {...register("farmName")} placeholder="e.g. Willow Creek" className="h-11" />
                  </Field>
                  <Field label="Nearest Town" required>
                    <Input {...register("nearestTown")} placeholder="e.g. Bethal" className="h-11" />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Province">
                    <Select onValueChange={(v) => setValue("province", v)} value={selectedProvince}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select province..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVINCES.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="GPS Location" hint={locationValue ? undefined : "Tap the button to capture phone location, or paste a link"}>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          {...register("whatsappLocation")}
                          placeholder="-26.123456, 28.456789"
                          className="h-11 flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 shrink-0"
                          onClick={handleGetLocation}
                          disabled={locating}
                          title="Use my current location"
                        >
                          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                        </Button>
                      </div>
                      {locationValue && /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(locationValue.trim()) && (
                        <a
                          href={`https://www.google.com/maps?q=${encodeURIComponent(locationValue.trim())}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                        >
                          <LocateFixed className="h-3 w-3" /> Open in Google Maps
                        </a>
                      )}
                    </div>
                  </Field>
                </div>

                <Field label="Manual Directions" hint="How to get there from the nearest town">
                  <Textarea {...register("manualDirections")} placeholder="Take the R38 from Bethal, turn left at the silo..." rows={2} />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Landmarks">
                    <Textarea {...register("landmarks")} placeholder="Red gate, green roof on the shed" rows={2} />
                  </Field>
                  <Field label="Access Notes">
                    <Textarea {...register("accessNotes")} placeholder="Call 10 mins before arrival for the gate code" rows={2} />
                  </Field>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Enquiry Section */}
        <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b bg-muted/40">
            <h2 className="text-base font-semibold">Enquiry Details</h2>
            <p className="text-xs text-muted-foreground mt-0.5">What are they looking for?</p>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <Field label="Enquiry Title" required hint='Brief description, e.g. "2x 10000L tanks on 2m stand for irrigation"'>
              <Input {...register("title")} placeholder="e.g. 2x 10000L cattle water tanks" className="h-11" />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Priority">
                <Select onValueChange={(v) => setValue("priority", v)} defaultValue="medium">
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tank Size (if known)">
                <Input {...register("tankSize")} placeholder="e.g. 10000L, 5000L" className="h-11" />
              </Field>
              <Field label="Quantity">
                <Input {...register("tankQuantity")} type="number" placeholder="1" min="1" className="h-11" />
              </Field>
            </div>

            <Field label="Description / Request">
              <Textarea {...register("description")} placeholder="Customer needs tanks installed on a 2m stand, prefers poly tanks, site has good access..." rows={3} />
            </Field>

            <Field label="Internal Notes">
              <Textarea {...register("notes")} placeholder="Any internal remarks — follow-up timing, pricing notes..." rows={2} />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => window.history.back()} className="h-11 px-6">
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="h-11 px-8 hex-clip font-semibold">
            {submitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              mode === "new" ? "Create Customer & Enquiry" : "Create Enquiry"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
