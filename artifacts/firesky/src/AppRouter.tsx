import { Layout } from "./components/layout";
import { Switch, Route, Redirect } from "wouter";
import { useUser } from "@clerk/react";

import Dashboard from "./pages/dashboard";
import CustomersList from "./pages/customers/list";
import NewCustomer from "./pages/customers/new";
import CustomerDetail from "./pages/customers/detail";
import EnquiriesList from "./pages/enquiries/list";
import NewEnquiry from "./pages/enquiries/new";
import EnquiryDetail from "./pages/enquiries/detail";
import InspectionsList from "./pages/inspections/list";
import NewInspection from "./pages/inspections/new";
import InspectionDetail from "./pages/inspections/detail";
import JobsPipeline from "./pages/jobs/pipeline";
import NewJob from "./pages/jobs/new";
import JobDetail from "./pages/jobs/detail";
import CalendarPage from "./pages/calendar/index";
import AdminUsers from "./pages/admin/users";
import NotFound from "./pages/not-found";

function useRole() {
  const { user } = useUser();
  return ((user?.publicMetadata?.role as string) || "guest") as "admin" | "user" | "guest";
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const role = useRole();
  return role === "admin" ? <Component /> : <Redirect to="/customers" />;
}

export function Router() {
  const role = useRole();
  const isAdmin = role === "admin";
  const isFieldWorker = role === "user";
  const isGuest = role === "guest";

  return (
    <Layout>
      <Switch>
        {/* Root redirect based on role */}
        <Route path="/">
          {isAdmin ? <Dashboard /> : isFieldWorker ? <Redirect to="/customers" /> : <Redirect to="/enquiries/new" />}
        </Route>

        {/* Customers — admin + field worker */}
        <Route path="/customers">
          {isGuest ? <Redirect to="/enquiries/new" /> : <CustomersList />}
        </Route>
        <Route path="/customers/new">
          {isGuest ? <Redirect to="/enquiries/new" /> : <NewCustomer />}
        </Route>
        <Route path="/customers/:id">
          {isGuest ? <Redirect to="/enquiries/new" /> : <CustomerDetail />}
        </Route>

        {/* Enquiries — admin only (guests can submit via the new form) */}
        <Route path="/enquiries">
          <AdminRoute component={EnquiriesList} />
        </Route>
        <Route path="/enquiries/new" component={NewEnquiry} />
        <Route path="/enquiries/:id">
          <AdminRoute component={EnquiryDetail} />
        </Route>

        {/* Inspections — admin + field worker */}
        <Route path="/inspections">
          {isGuest ? <Redirect to="/enquiries/new" /> : <InspectionsList />}
        </Route>
        <Route path="/inspections/new">
          {isGuest ? <Redirect to="/enquiries/new" /> : <NewInspection />}
        </Route>
        <Route path="/inspections/:id">
          {isGuest ? <Redirect to="/enquiries/new" /> : <InspectionDetail />}
        </Route>

        {/* Jobs — admin + field worker */}
        <Route path="/jobs">
          {isGuest ? <Redirect to="/enquiries/new" /> : <JobsPipeline />}
        </Route>
        <Route path="/jobs/new">
          <AdminRoute component={NewJob} />
        </Route>
        <Route path="/jobs/:id">
          {isGuest ? <Redirect to="/enquiries/new" /> : <JobDetail />}
        </Route>

        {/* Calendar — admin + field worker */}
        <Route path="/calendar">
          {isGuest ? <Redirect to="/enquiries/new" /> : <CalendarPage />}
        </Route>

        {/* Admin panel */}
        <Route path="/admin/users">
          <AdminRoute component={AdminUsers} />
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}
