import { useEffect, useRef } from "react";
import { Router as WouterRouter, Switch, Route, Redirect, useLocation } from "wouter";
import { ClerkProvider, SignIn, useAuth, useClerk } from "@clerk/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatPage } from "./pages/chat";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL ||
  (isLocalhost ? undefined : window.location.origin + "/api/__clerk");
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const clerkAppearance = {
  variables: {
    colorPrimary: "hsl(23, 97%, 46%)",
    colorBackground: "hsl(240, 10%, 3.9%)",
    colorText: "hsl(0, 0%, 98%)",
    colorInputBackground: "hsl(240, 3.7%, 15.9%)",
    colorInputText: "hsl(0, 0%, 98%)",
    colorTextSecondary: "hsl(240, 5%, 64.9%)",
  },
  elements: {
    card: "shadow-2xl border border-gray-800 rounded-2xl bg-background",
    headerTitle: "text-foreground font-bold",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButton: "border border-gray-800 hover:bg-gray-900 text-foreground",
    socialButtonsBlockButtonText: "text-foreground",
    formFieldLabel: "text-foreground",
    formFieldInput: "bg-input border-none text-foreground",
    footerActionText: "text-muted-foreground",
    footerActionLink: "text-primary hover:text-primary/90",
  },
};

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

function SignInPage() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center mb-4">
            <span className="text-primary-foreground font-bold text-xl">S</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Sky Vision</h1>
          <p className="text-muted-foreground text-sm mt-1">Firesky Industries AI Assistant</p>
        </div>
        <SignIn routing="path" path={`${basePath}/sign-in`} appearance={clerkAppearance} />
      </div>
    </div>
  );
}

function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Redirect to="/sign-in" />;
  }

  return <ChatPage />;
}

function AppRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route>
              <AuthGate />
            </Route>
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  // Ensure document has dark class since it's the default
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  if (!clerkPubKey) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm bg-background">
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
