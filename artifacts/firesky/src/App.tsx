import { useEffect, useRef } from "react";
import { Router as WouterRouter, Switch, Route, Redirect, useLocation } from "wouter";
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from "@clerk/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SkyProvider } from "./components/sky";
import { useSkyActions } from "./components/sky/SkyContext";
import { Router } from "./AppRouter";
import { ErrorBoundary } from "./components/error-boundary";
import TrackPage from "./pages/track";
import QuoteAcceptPage from "./pages/quotes/accept";
import { initDarkMode } from "./hooks/use-dark-mode";
import { brand } from "./brand.config";

initDarkMode();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Use the env var if explicitly set, otherwise auto-detect in production:
// In dev (localhost) Clerk works directly; in production (.replit.app etc)
// we route through our own /api/__clerk proxy so the dev Clerk keys work.
const isLocalhost = typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const clerkProxyUrl: string | undefined =
  import.meta.env.VITE_CLERK_PROXY_URL ||
  (isLocalhost ? undefined : `${typeof window !== "undefined" ? window.location.origin : ""}/api/__clerk`);
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const queryClient = new QueryClient();

const clerkAppearance = {
  variables: {
    colorPrimary: brand.primaryColor,
  },
  elements: {
    card: "shadow-2xl border-0 rounded-2xl",
    headerTitle: "text-[#222] font-bold",
    headerSubtitle: "text-gray-500",
    socialButtonsBlockButton: "border border-gray-200 hover:bg-gray-50",
  },
};

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* ── Mobile: stacked — full image on top, form below ─────────────── */}
      <div className="md:hidden min-h-[100dvh] flex flex-col bg-gray-950">
        <img
          src={`${basePath}/firesky-splash.png`}
          alt={brand.name}
          className="w-full h-auto object-contain"
        />
        <div className="flex-1 flex items-start justify-center px-4 pt-4 pb-8">
          {children}
        </div>
      </div>

      {/* ── Desktop: full-screen background with form centred ────────────── */}
      <div
        className="hidden md:flex min-h-[100dvh] items-center justify-center relative overflow-hidden"
        style={{
          backgroundImage: `url(${basePath}/firesky-splash.png)`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/70 pointer-events-none" />
        <div className="relative z-10 w-full max-w-sm px-4 py-8">
          {children}
        </div>
      </div>
    </>
  );
}

function SignInPage() {
  return (
    <AuthLayout>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        appearance={clerkAppearance}
      />
    </AuthLayout>
  );
}

function SignUpPage() {
  return (
    <AuthLayout>
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        appearance={clerkAppearance}
      />
    </AuthLayout>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);
  return null;
}

function SkyPageTracker() {
  const [location] = useLocation();
  const { user } = useUser();
  const { setCurrentPage } = useSkyActions();
  const role = (user?.publicMetadata?.role as string) || "guest";

  useEffect(() => {
    if (role !== "admin") return;
    setCurrentPage(location);
  }, [location, role, setCurrentPage]);

  return null;
}

function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Redirect to="/sign-in" />;
  }

  return <Router />;
}

function AppRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <ErrorBoundary>
            <SkyProvider>
              <SkyPageTracker />
              <Switch>
                <Route path="/sign-in/*?" component={SignInPage} />
                <Route path="/sign-up/*?" component={SignUpPage} />
                <Route path="/track/:token" component={TrackPage} />
                <Route path="/quote/:token" component={QuoteAcceptPage} />
                <Route>
                  <AuthGate />
                </Route>
              </Switch>
              <Toaster />
            </SkyProvider>
          </ErrorBoundary>
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  if (!clerkPubKey) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Authentication not configured. Please check environment variables.
      </div>
    );
  }

  return (
    <WouterRouter base={basePath}>
      <AppRoutes />
    </WouterRouter>
  );
}

export default App;
