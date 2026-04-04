import { Link, useLocation } from "wouter";
import { Home, Users, FileText, ClipboardCheck, Briefcase, Plus, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SkyPanel, SkyFloatingButton } from "./sky";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/enquiries", label: "Enquiries", icon: FileText },
  { href: "/inspections", label: "Inspections", icon: ClipboardCheck },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-muted/30">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="px-4 pt-5 pb-4 border-b border-sidebar-border">
          <img
            src={`${BASE}/firesky-logo.png`}
            alt="Firesky Industries"
            className="h-16 w-auto object-contain"
          />
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={location === item.href || (item.href !== "/" && location.startsWith(item.href)) ? "secondary" : "ghost"}
                className="w-full justify-start h-12"
              >
                <item.icon className="mr-2 h-5 w-5" />
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <Link href="/enquiries/new">
            <Button className="w-full h-12 hex-clip px-8 font-semibold tracking-wide">
              <Plus className="mr-2 h-5 w-5" /> New Enquiry
            </Button>
          </Link>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-2 bg-sidebar border-b border-sidebar-border sticky top-0 z-10">
        <img
          src={`${BASE}/firesky-logo.png`}
          alt="Firesky Industries"
          className="h-11 w-auto object-contain"
        />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="px-4 pt-5 pb-4 border-b border-sidebar-border">
              <img
                src={`${BASE}/firesky-logo.png`}
                alt="Firesky Industries"
                className="h-14 w-auto object-contain"
              />
            </div>
            <nav className="p-4 space-y-2">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={location === item.href || (item.href !== "/" && location.startsWith(item.href)) ? "secondary" : "ghost"}
                    className="w-full justify-start h-12"
                  >
                    <item.icon className="mr-2 h-5 w-5" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t border-sidebar-border">
              <Link href="/enquiries/new">
                <Button className="w-full h-12 hex-clip px-8 font-semibold">
                  <Plus className="mr-2 h-5 w-5" /> New Enquiry
                </Button>
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 pb-[80px] md:pb-0">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[80px] bg-sidebar border-t border-sidebar-border flex items-center justify-around px-2 z-10 pb-safe">
        {navItems.slice(0, 2).map((item) => (
          <Link key={item.href} href={item.href} className="flex-1">
            <div className={`flex flex-col items-center justify-center h-full space-y-1 ${location === item.href || (item.href !== "/" && location.startsWith(item.href)) ? "text-primary" : "text-muted-foreground"}`}>
              <item.icon className="h-6 w-6" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </div>
          </Link>
        ))}
        <div className="flex-1 flex justify-center -mt-6">
          <Link href="/enquiries/new">
            <Button size="icon" className="h-14 w-14 rounded-full shadow-lg shadow-primary/25">
              <Plus className="h-8 w-8" />
            </Button>
          </Link>
        </div>
        {navItems.slice(2, 4).map((item) => (
          <Link key={item.href} href={item.href} className="flex-1">
            <div className={`flex flex-col items-center justify-center h-full space-y-1 ${location === item.href || (item.href !== "/" && location.startsWith(item.href)) ? "text-primary" : "text-muted-foreground"}`}>
              <item.icon className="h-6 w-6" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </div>
          </Link>
        ))}
      </nav>

      {/* Sky AI Assistant */}
      <SkyFloatingButton />
      <SkyPanel />
    </div>
  );
}
