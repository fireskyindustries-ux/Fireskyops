import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, SignIn, useAuth } from "@clerk/react";
import Dashboard from "@/pages/dashboard";
import TankDetail from "@/pages/tank-detail";
import RegisterTank from "@/pages/register-tank";
import Subscription from "@/pages/subscription";
import { PortalSky } from "@/components/portal-sky";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl: string | undefined = import.meta.env.VITE_CLERK_PROXY_URL || undefined;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

const clerkAppearance = {
  variables: { colorPrimary: "#e85d04" },
  elements: {
    card: "shadow-2xl border-0 rounded-2xl",
    rootBox: "w-full",
  },
};

function Spinner() {
  return (
    <div className="min-h-screen bg-[hsl(20_14%_7%)] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
}

function SignInPage() {
  return (
    <div className="min-h-screen bg-[hsl(20_14%_7%)] flex flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-3">
          <svg className="w-8 h-8 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white">Tank Monitor</h1>
        <p className="text-sm text-[hsl(24_8%_45%)] mt-1">by Firesky Industries</p>
      </div>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        forceRedirectUrl={`${basePath}/dashboard`}
        appearance={clerkAppearance}
      />
      <p className="mt-6 text-xs text-[hsl(24_8%_35%)]">
        Need a sensor unit?{" "}
        <a href="mailto:info@fireskyindustries.co.za" className="text-orange-500 hover:underline">
          Contact Firesky Industries
        </a>
      </p>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return <Spinner />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return (
    <>
      <Component />
      <PortalSky />
    </>
  );
}

function AppRouter() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/">
        {!isLoaded ? <Spinner /> : isSignedIn ? <Redirect to="/dashboard" /> : <Redirect to="/sign-in" />}
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/tanks/:id">
        <ProtectedRoute component={TankDetail} />
      </Route>
      <Route path="/register">
        <ProtectedRoute component={RegisterTank} />
      </Route>
      <Route path="/subscription">
        <ProtectedRoute component={Subscription} />
      </Route>
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
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
      <AppRouter />
    </ClerkProvider>
  );
}

function App() {
  if (!clerkPubKey) {
    return (
      <div className="min-h-screen bg-[hsl(20_14%_7%)] flex items-center justify-center text-[hsl(24_8%_45%)] text-sm">
        Authentication not configured.
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={basePath}>
        <AppRoutes />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
