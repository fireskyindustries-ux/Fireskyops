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
import AdminUsers from "./pages/admin/users";
import NotFound from "./pages/not-found";

function useIsAdmin() {
  const { user } = useUser();
  return (user?.publicMetadata?.role as string) === "admin";
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const isAdmin = useIsAdmin();
  return isAdmin ? <Component /> : <Redirect to="/customers" />;
}

export function Router() {
  const isAdmin = useIsAdmin();

  return (
    <Layout>
      <Switch>
        {/* Root — admin sees dashboard, field workers go to customers */}
        <Route path="/">
          {isAdmin ? <Dashboard /> : <Redirect to="/customers" />}
        </Route>

        {/* Customers — accessible to everyone */}
        <Route path="/customers" component={CustomersList} />
        <Route path="/customers/new" component={NewCustomer} />
        <Route path="/customers/:id" component={CustomerDetail} />

        {/* Enquiries — admin only */}
        <Route path="/enquiries">
          <AdminRoute component={EnquiriesList} />
        </Route>
        <Route path="/enquiries/new">
          <AdminRoute component={NewEnquiry} />
        </Route>
        <Route path="/enquiries/:id">
          <AdminRoute component={EnquiryDetail} />
        </Route>

        {/* Inspections — accessible to everyone */}
        <Route path="/inspections" component={InspectionsList} />
        <Route path="/inspections/new" component={NewInspection} />
        <Route path="/inspections/:id" component={InspectionDetail} />

        {/* Jobs — admin only */}
        <Route path="/jobs">
          <AdminRoute component={JobsPipeline} />
        </Route>
        <Route path="/jobs/new">
          <AdminRoute component={NewJob} />
        </Route>
        <Route path="/jobs/:id">
          <AdminRoute component={JobDetail} />
        </Route>

        {/* Admin panel — admin only */}
        <Route path="/admin/users">
          <AdminRoute component={AdminUsers} />
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}
