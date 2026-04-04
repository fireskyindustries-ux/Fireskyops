import { Link, useLocation } from "wouter";
import { Home, Users, FileText, ClipboardCheck, Briefcase, Plus, Menu, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SkyPanel, SkyFloatingButton } from "./sky";
import { useUser, useClerk } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const adminNavItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/enquiries", label: "Enquiries", icon: FileText },
  { href: "/inspections", label: "Inspections", icon: ClipboardCheck },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
];

const fieldNavItems = [
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/inspections", label: "Inspections", icon: ClipboardCheck },
];

function isActive(location: string, href: string) {
  if (href === "/") return location === "/";
  return location.startsWith(href);
}

function UserFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const role = (user?.publicMetadata?.role as string) || "user";

  return (
    <div className="border-t border-sidebar-border">
      {role === "admin" && (
        <div className="px-4 pt-3">
          <Link href="/admin/users" onClick={onNavigate}>
            <Button variant="ghost" className="w-full justify-start h-10 text-primary">
              <Shield className="mr-2 h-4 w-4" />
              Manage Users
            </Button>
          </Link>
        </div>
      )}
      <div className="p-4 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-primary">
              {(user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || "U").toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">
            {user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user?.emailAddresses?.[0]?.emailAddress}
          </p>
          <p className="text-[10px] text-muted-foreground capitalize">{role}</p>
        </div>
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

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as string) || "user";
  const isAdmin = role === "admin";

  const navItems = isAdmin ? adminNavItems : fieldNavItems;

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-muted/30">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex flex-col items-center px-4 pt-6 pb-5 border-b border-sidebar-border bg-white">
          <img src={`${BASE}/firesky-logo.png`} alt="Firesky Industries" className="h-24 w-auto object-contain" />
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive(location, item.href) ? "secondary" : "ghost"}
                className="w-full justify-start h-12"
              >
                <item.icon className="mr-2 h-5 w-5" />
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>
        <div className="px-4 pb-3 pt-2">
          {isAdmin ? (
            <Link href="/enquiries/new">
              <Button className="w-full h-12 hex-clip px-8 font-semibold tracking-wide">
                <Plus className="mr-2 h-5 w-5" /> New Enquiry
              </Button>
            </Link>
          ) : (
            <Link href="/inspections/new">
              <Button className="w-full h-12 hex-clip px-8 font-semibold tracking-wide">
                <Plus className="mr-2 h-5 w-5" /> New Inspection
              </Button>
            </Link>
          )}
        </div>
        <UserFooter />
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-sidebar border-b border-sidebar-border sticky top-0 z-10">
        <img src={`${BASE}/firesky-logo.png`} alt="Firesky Industries" className="h-14 w-auto object-contain" />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 flex flex-col">
            <div className="flex flex-col items-center px-4 pt-6 pb-5 border-b border-sidebar-border">
              <img src={`${BASE}/firesky-logo.png`} alt="Firesky Industries" className="h-20 w-auto object-contain" />
            </div>
            <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive(location, item.href) ? "secondary" : "ghost"}
                    className="w-full justify-start h-12"
                  >
                    <item.icon className="mr-2 h-5 w-5" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
            <div className="px-4 pb-3 pt-2">
              {isAdmin ? (
                <Link href="/enquiries/new">
                  <Button className="w-full h-12 hex-clip px-8 font-semibold">
                    <Plus className="mr-2 h-5 w-5" /> New Enquiry
                  </Button>
                </Link>
              ) : (
                <Link href="/inspections/new">
                  <Button className="w-full h-12 hex-clip px-8 font-semibold">
                    <Plus className="mr-2 h-5 w-5" /> New Inspection
                  </Button>
                </Link>
              )}
            </div>
            <UserFooter />
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
      {isAdmin ? (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[80px] bg-sidebar border-t border-sidebar-border flex items-center justify-around px-2 z-10 pb-safe">
          {adminNavItems.slice(0, 2).map((item) => (
            <Link key={item.href} href={item.href} className="flex-1">
              <div className={`flex flex-col items-center justify-center h-full space-y-1 ${isActive(location, item.href) ? "text-primary" : "text-muted-foreground"}`}>
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
          {adminNavItems.slice(2, 4).map((item) => (
            <Link key={item.href} href={item.href} className="flex-1">
              <div className={`flex flex-col items-center justify-center h-full space-y-1 ${isActive(location, item.href) ? "text-primary" : "text-muted-foreground"}`}>
                <item.icon className="h-6 w-6" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>
      ) : (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[80px] bg-sidebar border-t border-sidebar-border flex items-center justify-around px-2 z-10 pb-safe">
          <Link href="/customers" className="flex-1">
            <div className={`flex flex-col items-center justify-center h-full space-y-1 ${isActive(location, "/customers") ? "text-primary" : "text-muted-foreground"}`}>
              <Users className="h-6 w-6" />
              <span className="text-[10px] font-medium">Customers</span>
            </div>
          </Link>
          <div className="flex-1 flex justify-center -mt-6">
            <Link href="/inspections/new">
              <Button size="icon" className="h-14 w-14 rounded-full shadow-lg shadow-primary/25">
                <Plus className="h-8 w-8" />
              </Button>
            </Link>
          </div>
          <Link href="/inspections" className="flex-1">
            <div className={`flex flex-col items-center justify-center h-full space-y-1 ${isActive(location, "/inspections") ? "text-primary" : "text-muted-foreground"}`}>
              <ClipboardCheck className="h-6 w-6" />
              <span className="text-[10px] font-medium">Inspections</span>
            </div>
          </Link>
        </nav>
      )}

      <SkyFloatingButton />
      <SkyPanel />
    </div>
  );
}
