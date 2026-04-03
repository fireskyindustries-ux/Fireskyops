import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

export type FieldType = "text" | "textarea" | "number" | "select" | "boolean" | "email" | "tel";

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  section?: string;
  options?: { label: string; value: string }[];
}

interface DynamicFormProps {
  fields: FieldConfig[];
  onSubmit: (data: any) => void;
  defaultValues?: any;
  storageKey: string;
  submitLabel?: string;
  isSubmitting?: boolean;
}

export function DynamicForm({ fields, onSubmit, defaultValues = {}, storageKey, submitLabel = "Submit", isSubmitting }: DynamicFormProps) {
  const { toast } = useToast();
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);

  // Generate Zod Schema dynamically
  const schemaShape: any = {};
  fields.forEach(field => {
    let fieldSchema: any = z.any();
    
    if (field.type === "text" || field.type === "textarea" || field.type === "select") {
      fieldSchema = z.string();
      if (field.required) {
        fieldSchema = fieldSchema.min(1, `${field.label} is required`);
      } else {
        fieldSchema = fieldSchema.optional();
      }
    } else if (field.type === "email") {
      fieldSchema = z.string();
      if (field.required) {
        fieldSchema = fieldSchema.email("Invalid email").min(1, `${field.label} is required`);
      } else {
        fieldSchema = fieldSchema.email("Invalid email").optional().or(z.literal(""));
      }
    } else if (field.type === "tel") {
      fieldSchema = z.string();
      if (field.required) {
        fieldSchema = fieldSchema.min(1, `${field.label} is required`);
      } else {
        fieldSchema = fieldSchema.optional();
      }
    } else if (field.type === "number") {
      fieldSchema = z.coerce.number();
      if (field.required) {
        // Just required number
      } else {
        fieldSchema = fieldSchema.optional();
      }
    } else if (field.type === "boolean") {
      fieldSchema = z.boolean().default(false).optional();
    }
    
    schemaShape[field.key] = fieldSchema;
  });

  const formSchema = z.object(schemaShape);

  // Load draft
  const loadDraft = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.data) {
          setDraftSavedAt(new Date(parsed.timestamp));
          return { ...defaultValues, ...parsed.data };
        }
      }
    } catch (e) {
      console.error("Failed to load draft", e);
    }
    return defaultValues;
  };

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: loadDraft(),
  });

  const watchedValues = form.watch();

  // Auto-save draft
  useEffect(() => {
    const timer = setTimeout(() => {
      const hasValues = Object.values(watchedValues).some(v => v !== undefined && v !== "" && v !== false);
      if (hasValues) {
        localStorage.setItem(storageKey, JSON.stringify({
          timestamp: new Date().toISOString(),
          data: watchedValues
        }));
        setDraftSavedAt(new Date());
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [watchedValues, storageKey]);

  const handleClearDraft = () => {
    localStorage.removeItem(storageKey);
    setDraftSavedAt(null);
    form.reset(defaultValues);
    toast({
      title: "Draft cleared",
      description: "Form has been reset to default values.",
    });
  };

  const handleSubmit = (data: any) => {
    // Clean up empty strings to undefined if not required, etc, but zod handles most.
    onSubmit(data);
    // Draft will be cleared on success externally usually, or we can do it here if we pass a callback, but let's clear it here since it's submitting.
    localStorage.removeItem(storageKey);
    setDraftSavedAt(null);
  };

  // Group fields by section
  const sections: { [key: string]: FieldConfig[] } = {};
  fields.forEach(field => {
    const sec = field.section || "General";
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(field);
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        
        {draftSavedAt && (
          <div className="flex items-center justify-between bg-muted/50 p-3 rounded-md text-sm">
            <div className="flex items-center text-muted-foreground">
              <Save className="h-4 w-4 mr-2" />
              Draft saved at {draftSavedAt.toLocaleTimeString()}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={handleClearDraft} className="text-destructive h-8">
              <Trash2 className="h-4 w-4 mr-2" /> Clear
            </Button>
          </div>
        )}

        {Object.entries(sections).map(([sectionTitle, sectionFields], index) => (
          <div key={sectionTitle} className="space-y-6">
            {sectionTitle !== "General" && (
              <div className="pt-4">
                <h3 className="text-lg font-semibold text-foreground mb-2">{sectionTitle}</h3>
                <Separator />
              </div>
            )}
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {sectionFields.map((field) => (
                <div key={field.key} className={field.type === "textarea" || field.type === "boolean" ? "md:col-span-2" : ""}>
                  <FormField
                    control={form.control}
                    name={field.key}
                    render={({ field: formField }) => (
                      <FormItem className={field.type === "boolean" ? "flex flex-row items-center justify-between rounded-lg border p-4 space-y-0" : ""}>
                        <div className="space-y-1">
                          <FormLabel className="text-base md:text-sm font-medium">
                            {field.label} {field.required && <span className="text-destructive">*</span>}
                          </FormLabel>
                          {field.helperText && <FormDescription>{field.helperText}</FormDescription>}
                        </div>
                        
                        <FormControl>
                          {field.type === "text" || field.type === "email" || field.type === "tel" ? (
                            <Input 
                              placeholder={field.placeholder} 
                              type={field.type} 
                              {...formField} 
                              value={formField.value ?? ""} 
                              className="h-12 md:h-10" 
                            />
                          ) : field.type === "number" ? (
                            <Input 
                              placeholder={field.placeholder} 
                              type="number" 
                              {...formField} 
                              value={formField.value ?? ""} 
                              className="h-12 md:h-10" 
                            />
                          ) : field.type === "textarea" ? (
                            <Textarea 
                              placeholder={field.placeholder} 
                              {...formField} 
                              value={formField.value ?? ""} 
                              className="min-h-[100px] text-base md:text-sm" 
                            />
                          ) : field.type === "select" ? (
                            <Select 
                              onValueChange={formField.onChange} 
                              defaultValue={formField.value} 
                              value={formField.value}
                            >
                              <FormControl>
                                <SelectTrigger className="h-12 md:h-10">
                                  <SelectValue placeholder={field.placeholder || "Select an option"} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {field.options?.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : field.type === "boolean" ? (
                            <Switch 
                              checked={!!formField.value} 
                              onCheckedChange={formField.onChange} 
                              className="scale-125 md:scale-100 data-[state=checked]:bg-primary"
                            />
                          ) : (
                            <div />
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <Button type="submit" className="w-full h-14 md:h-10 text-lg md:text-sm font-semibold" disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="flex items-center"><div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</span>
          ) : (
            <span className="flex items-center"><CheckCircle2 className="mr-2 h-5 w-5 md:h-4 md:w-4" /> {submitLabel}</span>
          )}
        </Button>
      </form>
    </Form>
  );
}
