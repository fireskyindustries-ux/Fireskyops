import { Link, useLocation } from "wouter";
import { brand } from "@/brand.config";
import { Home, Users, FileText, ClipboardCheck, Briefcase, CalendarDays, Plus, Menu, LogOut, Shield, ExternalLink, Mail, Sun, Moon, Package, Building2, Loader2, Sparkles, BarChart2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SkyPanel, SkyFloatingButton, useSkyActions, useSkyState } from "./sky";
import { useUser, useClerk } from "@clerk/react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./NotificationBell";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const adminNavItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/enquiries", label: "Enquiries", icon: FileText },
  { href: "/inspections", label: "Inspections", icon: ClipboardCheck },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/reports", label: "Reports", icon: BarChart2 },
  { href: "/map", label: "Branch Map", icon: MapPin },
];

const branchAdminNavItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/enquiries", label: "Enquiries", icon: FileText },
  { href: "/inspections", label: "Inspections", icon: ClipboardCheck },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/reports", label: "Reports", icon: BarChart2 },
];

const fieldNavItems = [
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/inspections", label: "Inspections", icon: ClipboardCheck },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];

const guestNavItems = [
  { href: "/enquiries/new", label: "New Enquiry", icon: FileText },
];

function isActive(location: string, href: string) {
  if (href === "/") return location === "/";
  return location.startsWith(href);
}

function NavItem({ item, location, onClick }: { item: { href: string; label: string; icon: React.ElementType }; location: string; onClick?: () => void }) {
  const active = isActive(location, item.href);
  return (
    <Link href={item.href} onClick={onClick}>
      <div className={cn(
        "flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-medium transition-all cursor-pointer select-none",
        active
          ? "bg-primary/10 text-primary"
          : "text-foreground/65 hover:bg-muted hover:text-foreground"
      )}>
        <item.icon className={cn("h-5 w-5 flex-shrink-0", active && "text-primary")} />
        <span>{item.label}</span>
        {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
      </div>
    </Link>
  );
}

function UserFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const role = (user?.publicMetadata?.role as string) || "guest";
  const { isDark, toggle: toggleDark } = useDarkMode();
  const { toast } = useToast();
  const [claiming, setClaiming] = useState(false);

  async function claimAdmin() {
    setClaiming(true);
    try {
      const res = await fetch("/api/users/claim-admin", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Admin role granted", description: "Reloading now..." });
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: any) {
      toast({ title: "Could not claim admin", description: e.message, variant: "destructive" });
      setClaiming(false);
    }
  }

  return (
    <div className="border-t border-sidebar-border">
      {role === "guest" && (
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={claimAdmin}
            disabled={claiming}
            className="w-full flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-semibold text-primary bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-60"
          >
            {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            {claiming ? "Setting up..." : "Claim Admin Access"}
          </button>
          <p className="text-[10px] text-muted-foreground px-3 mt-1">Only works if no admin exists yet</p>
        </div>
      )}
      {role === "admin" && (
        <div className="px-3 pt-3 space-y-1">
          <Link href="/admin/users" onClick={onNavigate}>
            <div className="flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium text-primary hover:bg-primary/5 transition-colors cursor-pointer">
              <Shield className="h-4 w-4" />
              Manage Users
            </div>
          </Link>
          <Link href="/admin/branches" onClick={onNavigate}>
            <div className="flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium text-primary hover:bg-primary/5 transition-colors cursor-pointer">
              <Building2 className="h-4 w-4" />
              Branches
            </div>
          </Link>
          <Link href="/admin/email-log" onClick={onNavigate}>
            <div className="flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium text-primary hover:bg-primary/5 transition-colors cursor-pointer">
              <Mail className="h-4 w-4" />
              Email Log
            </div>
          </Link>
          <a href="https://accounting.sageone.co.za/Landing/Default.aspx" target="_blank" rel="noopener noreferrer">
            <div className="flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium text-green-700 hover:bg-green-50 transition-colors cursor-pointer">
              <ExternalLink className="h-4 w-4" />
              Sage Cloud Accounting
            </div>
          </a>
        </div>
      )}
      <div className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-primary/20">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-primary">
              {(user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || "U").toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">
            {user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user?.emailAddresses?.[0]?.emailAddress}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {role === "admin" ? "Super Admin" : role === "branch_admin" ? "Branch Admin" : role === "field_worker" || role === "user" ? "Field Worker" : "Guest"}
          </p>
        </div>
        {role !== "guest" && <NotificationBell />}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
          onClick={toggleDark}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => signOut(() => setLocation("/"))}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function BottomNavItem({ item, location }: { item: { href: string; label: string; icon: React.ElementType }; location: string }) {
  const active = isActive(location, item.href);
  return (
    <Link href={item.href} className="flex-1">
      <div className="flex flex-col items-center justify-center h-full gap-1">
        <item.icon className={cn("h-5 w-5 transition-colors", active ? "text-primary" : "text-muted-foreground")} />
        <span className={cn("text-[10px] font-medium transition-colors", active ? "text-primary" : "text-muted-foreground")}>
          {item.label}
        </span>
        <div className={cn("h-0.5 w-5 rounded-full transition-all", active ? "bg-primary" : "bg-transparent")} />
      </div>
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as string) || "guest";
  const isAdmin = role === "admin";
  const isBranchAdmin = role === "branch_admin";
  const isFieldWorker = role === "user" || role === "field_worker";
  const isGuest = role === "guest";
  const { openSky } = useSkyActions();
  const { isOpen: skyOpen } = useSkyState();

  const userBranchId = (user?.publicMetadata?.branchId as number) ?? null;
  const { data: branches } = useQuery<{ id: number; name: string; region: string | null }[]>({
    queryKey: ["branches-nav"],
    queryFn: () => fetch("/api/branches", { credentials: "include" }).then((r) => r.json()),
    enabled: !isAdmin && !isGuest && userBranchId != null,
    staleTime: 5 * 60 * 1000,
  });
  const userBranchName = branches?.find((b) => b.id === userBranchId)?.name ?? null;

  const navItems = isAdmin ? adminNavItems : isBranchAdmin ? branchAdminNavItems : isFieldWorker ? fieldNavItems : guestNavItems;

  const ctaLink = isAdmin || isBranchAdmin ? "/enquiries/new" : isFieldWorker ? "/inspections/new" : "/enquiries/new";
  const ctaLabel = isAdmin || isBranchAdmin ? "New Enquiry" : isFieldWorker ? "New Inspection" : "New Enquiry";

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-muted/30">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border pb-8">
        <div className="flex flex-col items-center px-4 pt-5 pb-4 border-b border-sidebar-border bg-sidebar">
          <img src={`${BASE}/${brand.logoFile}`} alt={brand.name} className="h-20 w-auto object-contain" style={{ mixBlendMode: "screen" }} />
          {userBranchName && (
            <div className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              <Building2 className="h-3 w-3 text-primary shrink-0" />
              <span className="text-xs font-semibold text-primary truncate max-w-[160px]">{userBranchName}</span>
            </div>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto pt-4">
          {navItems.map((item) => (
            <NavItem key={item.href} item={item} location={location} />
          ))}
        </nav>
        <div className="px-3 pb-3 pt-2">
          <Link href={ctaLink}>
            <Button className="w-full h-11 px-6 font-semibold tracking-wide text-sm">
              <Plus className="mr-2 h-4 w-4" /> {ctaLabel}
            </Button>
          </Link>
        </div>
        <UserFooter />
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-2 bg-sidebar border-b border-sidebar-border sticky top-0 z-10 shadow-sm">
        <img src={`${BASE}/${brand.logoFile}`} alt={brand.name} className="h-12 w-auto object-contain" style={{ mixBlendMode: "screen" }} />
        <div className="flex items-center gap-1">
          {!isGuest && !skyOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-primary"
              onClick={() => openSky()}
              aria-label="Ask Sky"
            >
              <Sparkles className="h-5 w-5" />
            </Button>
          )}
          {!isGuest && <NotificationBell />}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 flex flex-col bg-sidebar">
            <div className="flex flex-col items-center px-4 pt-5 pb-4 border-b border-sidebar-border bg-sidebar">
              <img src={`${BASE}/${brand.logoFile}`} alt={brand.name} className="h-16 w-auto object-contain" style={{ mixBlendMode: "screen" }} />
              {userBranchName && (
                <div className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                  <Building2 className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-primary truncate max-w-[160px]">{userBranchName}</span>
                </div>
              )}
            </div>
            <nav className="p-3 space-y-1 flex-1 overflow-y-auto pt-4">
              {navItems.map((item) => (
                <NavItem key={item.href} item={item} location={location} />
              ))}
            </nav>
            <div className="px-3 pb-3 pt-2">
              <Link href={ctaLink}>
                <Button className="w-full h-11 px-6 font-semibold text-sm">
                  <Plus className="mr-2 h-4 w-4" /> {ctaLabel}
                </Button>
              </Link>
            </div>
            <UserFooter />
          </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 pb-[80px] md:pb-0">
        <div className={`flex-1 overflow-y-auto min-h-0 ${location.startsWith("/calendar") ? "" : "p-4 md:p-8"}`}>
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav — Admin */}
      {isAdmin && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-sidebar border-t border-sidebar-border flex items-stretch justify-around px-1 z-10">
          {[adminNavItems[0], adminNavItems[1]].map((item) => (
            <BottomNavItem key={item.href} item={item} location={location} />
          ))}
          <div className="flex-1 flex justify-center items-center -mt-5">
            <Link href="/enquiries/new">
              <Button size="icon" className="h-13 w-13 h-[52px] w-[52px] rounded-full shadow-lg shadow-primary/30 ring-4 ring-sidebar">
                <Plus className="h-6 w-6" />
              </Button>
            </Link>
          </div>
          {[adminNavItems[4], adminNavItems[5]].map((item) => (
            <BottomNavItem key={item.href} item={item} location={location} />
          ))}
        </nav>
      )}

      {/* Mobile Bottom Nav — Field Worker */}
      {isFieldWorker && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-sidebar border-t border-sidebar-border flex items-stretch justify-around px-1 z-10">
          <BottomNavItem item={fieldNavItems[0]} location={location} />
          <BottomNavItem item={fieldNavItems[1]} location={location} />
          <div className="flex-1 flex justify-center items-center -mt-5">
            <Link href="/inspections/new">
              <Button size="icon" className="h-[52px] w-[52px] rounded-full shadow-lg shadow-primary/30 ring-4 ring-sidebar">
                <Plus className="h-6 w-6" />
              </Button>
            </Link>
          </div>
          <BottomNavItem item={fieldNavItems[2]} location={location} />
          <BottomNavItem item={fieldNavItems[3]} location={location} />
        </nav>
      )}

      {/* Mobile Bottom Nav — Guest */}
      {isGuest && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-sidebar border-t border-sidebar-border flex items-center justify-around px-2 z-10">
          <div className="flex-1 flex justify-center -mt-5">
            <Link href="/enquiries/new">
              <Button size="icon" className="h-[52px] w-[52px] rounded-full shadow-lg shadow-primary/30 ring-4 ring-sidebar">
                <Plus className="h-6 w-6" />
              </Button>
            </Link>
          </div>
        </nav>
      )}

      <div className="hidden md:block"><SkyFloatingButton /></div>
      <SkyPanel />

      {/* Desktop Footer */}
      <div className="hidden md:block fixed bottom-0 left-0 w-64 text-center py-2 border-t border-sidebar-border bg-sidebar">
        <p className="text-[10px] text-muted-foreground">
          {brand.credits}
        </p>
      </div>
    </div>
  );
}
