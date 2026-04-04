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

function FireskyLogo({ size = "full" }: { size?: "full" | "compact" }) {
  if (size === "compact") {
    return (
      <div className="flex items-center gap-2.5">
        <div className="bg-white rounded-md px-2 py-1">
          <img
            src={`${BASE}/firesky-logo.png`}
            alt="Firesky Industries"
            className="h-7 w-auto object-contain"
          />
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-md px-3 py-2">
      <img
        src={`${BASE}/firesky-logo.png`}
        alt="Firesky Industries"
        className="h-10 w-auto object-contain"
      />
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-muted/30">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="px-5 py-4 border-b border-sidebar-border">
          <FireskyLogo size="full" />
          <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 mt-2 font-medium">
            Field Operations
          </p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 h-11 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Link href="/enquiries/new">
            <Button className="w-full h-10 text-sm font-semibold bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground">
              <Plus className="mr-2 h-4 w-4" /> New Enquiry
            </Button>
          </Link>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-sidebar border-b border-sidebar-border sticky top-0 z-10">
        <FireskyLogo size="compact" />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
            <div className="px-5 py-4 border-b border-sidebar-border">
              <FireskyLogo size="full" />
              <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 mt-2 font-medium">
                Field Operations
              </p>
            </div>
            <nav className="p-3 space-y-0.5">
              {navItems.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={`flex items-center gap-3 px-3 h-11 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-sidebar-border">
              <Link href="/enquiries/new">
                <Button className="w-full h-10 text-sm font-semibold bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground">
                  <Plus className="mr-2 h-4 w-4" /> New Enquiry
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-sidebar border-t border-sidebar-border flex items-center justify-around px-2 z-10 pb-safe">
        {navItems.slice(0, 2).map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div className={`flex flex-col items-center justify-center h-full space-y-1 py-2 ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50"}`}>
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
        <div className="flex-1 flex justify-center -mt-4">
          <Link href="/enquiries/new">
            <Button
              size="icon"
              className="h-13 w-13 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
              style={{ width: 52, height: 52 }}
            >
              <Plus className="h-7 w-7" />
            </Button>
          </Link>
        </div>
        {navItems.slice(2, 4).map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div className={`flex flex-col items-center justify-center h-full space-y-1 py-2 ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50"}`}>
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Sky AI Assistant */}
      <SkyFloatingButton />
      <SkyPanel />
    </div>
  );
}
