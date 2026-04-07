import React, { useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MoveRight, PhoneCall, Mail, MapPin, CheckCircle2 } from "lucide-react";
import NotFound from "@/pages/not-found";

// Import generated images
import heroBg from "@/assets/hero-bg.png";
import verticalTank from "@/assets/vertical-tank.png";
import horizontalTank from "@/assets/horizontal-tank.png";
import septicTank from "@/assets/septic-tank.png";

const queryClient = new QueryClient();

// -- Logo Component --
function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="w-10 h-10 bg-primary clip-hexagon flex items-center justify-center text-primary-foreground font-display font-bold text-xl leading-none pt-0.5">
        FI
      </div>
      <span className="font-display font-bold text-xl tracking-tight text-foreground dark:text-white uppercase">
        Firesky<span className="text-primary">.</span>
      </span>
    </div>
  );
}

// -- Enquiry Form Schema --
const enquirySchema = z.object({
  name: z.string().min(1, "Full Name is required"),
  phone: z.string().min(1, "Phone Number is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  nearestTown: z.string().optional(),
  province: z.string().optional(),
  message: z.string().min(1, "Please tell us what you're looking for"),
  tankSize: z.string().optional(),
  tankQuantity: z.string().optional(),
});

type EnquiryFormValues = z.infer<typeof enquirySchema>;

// -- Home Page --
function Home() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<EnquiryFormValues>({
    resolver: zodResolver(enquirySchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      nearestTown: "",
      province: "",
      message: "",
      tankSize: "",
      tankQuantity: "",
    },
  });

  const onSubmit = async (data: EnquiryFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/website/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          tankQuantity: data.tankQuantity ? parseInt(data.tankQuantity, 10) : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit enquiry");
      }

      setIsSuccess(true);
      form.reset();
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "There was a problem sending your enquiry. Please try again or contact us directly.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToContact = () => {
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background dark bg-zinc-950 text-zinc-50 overflow-x-hidden selection:bg-primary selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Logo />
          <div className="hidden md:flex items-center gap-8 font-medium text-sm text-zinc-300">
            <a href="#about" className="hover:text-primary transition-colors">About</a>
            <a href="#products" className="hover:text-primary transition-colors">Products</a>
            <a href="#contact" className="hover:text-primary transition-colors">Contact</a>
          </div>
          <Button onClick={scrollToContact} className="font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 text-white border-none rounded-none clip-hexagon py-6 px-8 shadow-[0_0_20px_rgba(234,88,12,0.3)] hover:shadow-[0_0_30px_rgba(234,88,12,0.5)] transition-all">
            Get a Quote
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 min-h-[90vh] flex items-center">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-transparent z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent z-10" />
          <img src={heroBg} alt="Firesky tanks delivery" className="w-full h-full object-cover object-center opacity-60" />
        </div>
        
        <div className="relative z-20 max-w-7xl mx-auto w-full">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-900/80 border border-zinc-800 text-primary text-xs font-bold uppercase tracking-widest mb-6">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Serving South Africa
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-black text-white leading-[1.1] uppercase mb-8">
              We deliver <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400">when others</span><br/>
              won't.
            </h1>
            <p className="text-xl md:text-2xl text-zinc-300 mb-10 max-w-2xl leading-relaxed">
              Rugged, bold, and trustworthy water storage solutions for homes, farms, and remote businesses. Quality tanks delivered where you need them.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={scrollToContact} size="lg" className="bg-primary hover:bg-primary/90 text-white rounded-none clip-hexagon py-8 px-10 text-lg font-bold uppercase tracking-wider group">
                Request a Quote
                <MoveRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="outline" size="lg" className="rounded-none border-zinc-700 hover:bg-zinc-900 hover:text-white py-8 px-10 text-lg font-bold uppercase tracking-wider" asChild>
                <a href="#products">View Products</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 px-6 bg-zinc-950 relative border-b border-zinc-900">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div>
              <h2 className="text-4xl md:text-6xl font-display font-black uppercase mb-8">
                Built to do <br/><span className="text-primary">things differently.</span>
              </h2>
              <div className="w-20 h-2 bg-primary mb-8" />
              
              <div className="space-y-6 text-lg text-zinc-400 leading-relaxed">
                <p>
                  Firesky Industries was founded to do things differently. In a market often let down by poor quality products and unreliable service, we saw an opportunity to build a business focused on what truly matters.
                </p>
                <p>
                  Our first tank was donated to a rural school in Lesotho. Our first commercial project: 10 × 10,000L tanks to a remote customer that others would not service. <strong className="text-white font-bold">We delivered.</strong>
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 p-8 clip-hexagon relative overflow-hidden group hover:border-primary/50 transition-colors">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="text-2xl font-display font-bold text-white mb-4 uppercase">Our Vision</h3>
                <p className="text-zinc-400">Grow into a trusted leader in water storage, expand into manufacturing and complete water solution systems.</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-8 clip-hexagon relative overflow-hidden group hover:border-primary/50 transition-colors sm:translate-y-12">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="text-2xl font-display font-bold text-white mb-4 uppercase">Our Mission</h3>
                <p className="text-zinc-400">Provide dependable, cost-effective water storage solutions while delivering service that customers can trust.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="py-24 px-6 bg-zinc-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-display font-black uppercase mb-6">Our Products</h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">Dependable water storage solutions built for the South African landscape. Built to last.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Vertical Tanks */}
            <div className="bg-zinc-900 border border-zinc-800 flex flex-col hover:border-zinc-700 transition-colors group">
              <div className="relative h-64 overflow-hidden bg-zinc-800 p-6 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent z-10" />
                <img src={verticalTank} alt="Vertical Water Tank" className="w-full h-full object-contain relative z-0 group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute top-4 right-4 z-20 bg-primary text-white text-xs font-bold px-3 py-1 uppercase clip-hexagon">Best Seller</div>
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <h3 className="text-2xl font-display font-bold uppercase mb-2">Vertical Tanks</h3>
                <p className="text-sm text-zinc-400 mb-6">Also available for Chemical & Fertilizer Storage</p>
                
                <div className="space-y-4 flex-1">
                  <div className="flex justify-between items-end border-b border-zinc-800 pb-3">
                    <span className="font-medium">500L Water Tank</span>
                    <span className="text-primary font-bold">P.O.A.</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-zinc-800 pb-3">
                    <span className="font-medium">1000L Water Tank</span>
                    <span className="text-primary font-bold">R 2 142.45</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-zinc-800 pb-3">
                    <span className="font-medium">1000L Space Saver</span>
                    <span className="text-primary font-bold">R 2 205.93</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-zinc-800 pb-3">
                    <span className="font-medium">2500L Water Tank</span>
                    <span className="text-primary font-bold">R 2 618.88</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-zinc-800 pb-3">
                    <span className="font-medium">5000L Water Tank</span>
                    <span className="text-primary font-bold">R 5 792.55</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="font-medium">10000L Water Tank</span>
                    <span className="text-primary font-bold">R 15 983.85</span>
                  </div>
                </div>
                
                <Button onClick={scrollToContact} className="w-full mt-8 rounded-none border border-zinc-700 bg-transparent hover:bg-white hover:text-black uppercase font-bold">
                  Enquire Now
                </Button>
              </div>
            </div>

            {/* Horizontal Tanks */}
            <div className="bg-zinc-900 border border-zinc-800 flex flex-col hover:border-zinc-700 transition-colors group lg:translate-y-8">
              <div className="relative h-64 overflow-hidden bg-zinc-800 p-6 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent z-10" />
                <img src={horizontalTank} alt="Horizontal Water Tank" className="w-full h-full object-contain relative z-0 group-hover:scale-105 transition-transform duration-700" />
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <h3 className="text-2xl font-display font-bold uppercase mb-2">Horizontal Tanks</h3>
                <p className="text-sm text-zinc-400 mb-6">Also available for Chemical & Fertilizer Storage</p>
                
                <div className="space-y-4 flex-1">
                  <div className="flex justify-between items-end border-b border-zinc-800 pb-3">
                    <span className="font-medium">500L Horizontal Tank</span>
                    <span className="text-primary font-bold">R 2 697.90</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-zinc-800 pb-3">
                    <span className="font-medium">1000L Horizontal Tank</span>
                    <span className="text-primary font-bold">R 5 699.00</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="font-medium">2500L Horizontal Tank</span>
                    <span className="text-primary font-bold">R 9 918.75</span>
                  </div>
                </div>
                
                <Button onClick={scrollToContact} className="w-full mt-8 rounded-none border border-zinc-700 bg-transparent hover:bg-white hover:text-black uppercase font-bold">
                  Enquire Now
                </Button>
              </div>
            </div>

            {/* Septic Tanks */}
            <div className="bg-zinc-900 border border-zinc-800 flex flex-col hover:border-zinc-700 transition-colors group">
              <div className="relative h-64 overflow-hidden bg-zinc-800 p-6 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent z-10" />
                <img src={septicTank} alt="Septic Tank" className="w-full h-full object-contain relative z-0 group-hover:scale-105 transition-transform duration-700 mix-blend-luminosity opacity-80" />
                <div className="absolute top-4 right-4 z-20 bg-zinc-700 text-white text-xs font-bold px-3 py-1 uppercase clip-hexagon">Install Available</div>
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <h3 className="text-2xl font-display font-bold uppercase mb-2">Septic Tanks</h3>
                <p className="text-sm text-zinc-400 mb-6">Installation services available on request</p>
                
                <div className="space-y-4 flex-1">
                  <div className="flex justify-between items-end border-b border-zinc-800 pb-3">
                    <span className="font-medium">1500L Septic Tank</span>
                    <span className="text-primary font-bold">R 6 482.00</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-zinc-800 pb-3">
                    <span className="font-medium">2500L Septic Tank</span>
                    <span className="text-primary font-bold">R 11 727.93</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="font-medium">7500L Septic Tank</span>
                    <span className="text-primary font-bold">R 23 329.90</span>
                  </div>
                </div>
                
                <Button onClick={scrollToContact} className="w-full mt-8 rounded-none border border-zinc-700 bg-transparent hover:bg-white hover:text-black uppercase font-bold">
                  Enquire Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 px-6 bg-zinc-900 border-t border-zinc-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            
            {/* Contact Info */}
            <div className="lg:col-span-4 space-y-12">
              <div>
                <h2 className="text-4xl md:text-5xl font-display font-black uppercase mb-6">Get in Touch</h2>
                <p className="text-zinc-400 text-lg">Ready to order or need some advice? We're here to help you find the right solution.</p>
              </div>
              
              <div className="space-y-8">
                <div className="flex items-start gap-4 group">
                  <div className="w-12 h-12 bg-zinc-800 text-primary flex items-center justify-center clip-hexagon group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm text-zinc-500 uppercase font-bold tracking-wider mb-1">Call Us</h4>
                    <a href="tel:+27762785966" className="text-xl font-medium hover:text-primary transition-colors">+27 76 278 5966</a>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 group">
                  <div className="w-12 h-12 bg-zinc-800 text-primary flex items-center justify-center clip-hexagon group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm text-zinc-500 uppercase font-bold tracking-wider mb-1">Email</h4>
                    <a href="mailto:info@fireskyindustries.co.za" className="text-xl font-medium hover:text-primary transition-colors break-all">info@fireskyindustries.co.za</a>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 group">
                  <div className="w-12 h-12 bg-zinc-800 text-primary flex items-center justify-center clip-hexagon group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm text-zinc-500 uppercase font-bold tracking-wider mb-1">WhatsApp</h4>
                    <a href="https://wa.me/27762785966" target="_blank" rel="noreferrer" className="text-xl font-medium hover:text-primary transition-colors">Chat with us</a>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-8 bg-zinc-950 border border-zinc-800 p-8 md:p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[50px]" />
              
              {isSuccess ? (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-3xl font-display font-bold uppercase">Enquiry Sent</h3>
                  <p className="text-zinc-400 text-lg max-w-md">Thank you! We'll be in touch shortly to discuss your water storage needs.</p>
                  <Button onClick={() => setIsSuccess(false)} variant="outline" className="mt-4 rounded-none border-zinc-700 uppercase font-bold tracking-wider">
                    Send Another
                  </Button>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-zinc-400 uppercase text-xs font-bold tracking-wider">Full Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" className="bg-zinc-900 border-zinc-800 rounded-none h-12 focus-visible:ring-primary focus-visible:border-primary" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-zinc-400 uppercase text-xs font-bold tracking-wider">Phone Number *</FormLabel>
                            <FormControl>
                              <Input placeholder="082 123 4567" className="bg-zinc-900 border-zinc-800 rounded-none h-12 focus-visible:ring-primary focus-visible:border-primary" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-zinc-400 uppercase text-xs font-bold tracking-wider">Email Address</FormLabel>
                            <FormControl>
                              <Input placeholder="john@example.com" type="email" className="bg-zinc-900 border-zinc-800 rounded-none h-12 focus-visible:ring-primary focus-visible:border-primary" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="nearestTown"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-zinc-400 uppercase text-xs font-bold tracking-wider">Nearest Town</FormLabel>
                              <FormControl>
                                <Input placeholder="Town" className="bg-zinc-900 border-zinc-800 rounded-none h-12 focus-visible:ring-primary focus-visible:border-primary" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="province"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-zinc-400 uppercase text-xs font-bold tracking-wider">Province</FormLabel>
                              <FormControl>
                                <Input placeholder="Province" className="bg-zinc-900 border-zinc-800 rounded-none h-12 focus-visible:ring-primary focus-visible:border-primary" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="tankSize"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-zinc-400 uppercase text-xs font-bold tracking-wider">Tank Size</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-zinc-900 border-zinc-800 rounded-none h-12 focus:ring-primary focus:border-primary">
                                  <SelectValue placeholder="Select a size" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-zinc-900 border-zinc-800 text-white rounded-none">
                                <SelectItem value="500l">500L</SelectItem>
                                <SelectItem value="1000l">1000L</SelectItem>
                                <SelectItem value="2500l">2500L</SelectItem>
                                <SelectItem value="5000l">5000L</SelectItem>
                                <SelectItem value="7500l">7500L (Septic)</SelectItem>
                                <SelectItem value="10000l">10000L</SelectItem>
                                <SelectItem value="custom">Custom / Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="tankQuantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-zinc-400 uppercase text-xs font-bold tracking-wider">Quantity</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" placeholder="1" className="bg-zinc-900 border-zinc-800 rounded-none h-12 focus-visible:ring-primary focus-visible:border-primary" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-zinc-400 uppercase text-xs font-bold tracking-wider">What are you looking for? *</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Tell us about your requirements..." 
                              className="bg-zinc-900 border-zinc-800 rounded-none min-h-[120px] focus-visible:ring-primary focus-visible:border-primary resize-y" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full bg-primary hover:bg-primary/90 text-white rounded-none clip-hexagon py-7 text-lg font-bold uppercase tracking-wider"
                    >
                      {isSubmitting ? "Sending..." : "Send Enquiry"}
                    </Button>
                  </form>
                </Form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-950 border-t border-zinc-900 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <Logo className="opacity-80" />
          <p className="text-zinc-500 text-sm">
            &copy; {new Date().getFullYear()} Firesky Industries. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
