import { useEffect, useRef } from "react";
import { Router as WouterRouter, Switch, Route, Redirect, useLocation } from "wouter";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SkyProvider } from "./components/sky";
import { Router } from "./AppRouter";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const queryClient = new QueryClient();

const clerkAppearance = {
  elements: {
    card: "shadow-2xl border-0 rounded-2xl",
    headerTitle: "text-[#222] font-bold",
    headerSubtitle: "text-gray-500",
    formButtonPrimary: "bg-[#E85D04] hover:bg-[#d45200] text-white font-semibold rounded-none",
    footerActionLink: "text-[#E85D04] font-semibold",
    socialButtonsBlockButton: "border border-gray-200 hover:bg-gray-50",
  }
};

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex">
      {/* Left panel — tanks image + branding (desktop only) */}
      <div
        className="hidden lg:flex flex-col justify-between w-[55%] relative overflow-hidden"
        style={{
          backgroundImage: `url(${basePath}/tanks-bg.jpg)`,
          backgroundSize: "cover",
          backgroundPosition: "center 60%",
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/30" />
        <div className="relative z-10 p-10 flex flex-col justify-between h-full">
          <div className="bg-white/95 rounded-xl px-4 py-2 self-start shadow-md">
            <img
              src={`${basePath}/firesky-logo.png`}
              alt="Firesky Industries"
              className="h-14 w-auto object-contain"
            />
          </div>
          <div>
            <h1 className="text-5xl font-extrabold text-white leading-tight mb-4 tracking-tight">
              Field Ops.<br />Under Control.
            </h1>
            <p className="text-white/70 text-lg max-w-sm">
              Manage customers, inspections, jobs, and quotes — all from the field.
            </p>
          </div>
          <p className="text-white/40 text-sm">Firesky Industries · Your Solution</p>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-10">
        {/* Logo shown only on mobile */}
        <div className="lg:hidden mb-8 text-center">
          <img
            src={`${basePath}/firesky-logo.png`}
            alt="Firesky Industries"
            className="h-20 w-auto object-contain mx-auto"
          />
        </div>
        {children}
      </div>
    </div>
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
          <SkyProvider>
            <Switch>
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route>
                <Show when="signed-in">
                  <Router />
                </Show>
                <Show when="signed-out">
                  <Redirect to="/sign-in" />
                </Show>
              </Route>
            </Switch>
            <Toaster />
          </SkyProvider>
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
