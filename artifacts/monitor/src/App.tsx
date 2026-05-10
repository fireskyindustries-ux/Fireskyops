import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/context/auth";
import SignIn from "@/pages/signin";
import Dashboard from "@/pages/dashboard";
import TankDetail from "@/pages/tank-detail";
import RegisterTank from "@/pages/register-tank";
import Subscription from "@/pages/subscription";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(20_14%_7%)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Redirect to="/" />;
  return <Component />;
}

function Router() {
  const { user, loading } = useAuth();

  return (
    <Switch>
      <Route path="/">
        {loading ? (
          <div className="min-h-screen bg-[hsl(20_14%_7%)] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : user ? (
          <Redirect to="/dashboard" />
        ) : (
          <SignIn />
        )}
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
