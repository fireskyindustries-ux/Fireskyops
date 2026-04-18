import { Layout } from "./components/layout";
import { Switch, Route, Redirect } from "wouter";
import { useUser } from "@clerk/react";

import Dashboard from "./pages/dashboard";
import BranchDashboard from "./pages/branch-dashboard";
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
import AdminBranches from "./pages/admin/branches";
import EmailLog from "./pages/admin/email-log";
import StockPage from "./pages/stock/index";
import ReportsPage from "./pages/reports";
import MapPage from "./pages/map";
import NotFound from "./pages/not-found";

function useRole() {
  const { user } = useUser();
  return (user?.publicMetadata?.role as string) || "guest";
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const role = useRole();
  return role === "admin" ? <Component /> : <Redirect to="/customers" />;
}

function AdminOrBranchAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const role = useRole();
  return (role === "admin" || role === "branch_admin") ? <Component /> : <Redirect to="/customers" />;
}

export function Router() {
  const role = useRole();
  const isAdmin = role === "admin";
  const isBranchAdmin = role === "branch_admin";
  const isFieldWorker = role === "user" || role === "field_worker";
  const isGuest = role === "guest";
  const hasAccess = isAdmin || isBranchAdmin || isFieldWorker;

  return (
    <Layout>
      <Switch>
        {/* Root redirect based on role */}
        <Route path="/">
          {isAdmin ? <Dashboard /> : isBranchAdmin ? <BranchDashboard /> : isFieldWorker ? <Redirect to="/customers" /> : <Redirect to="/enquiries/new" />}
        </Route>

        {/* Customers — admin + branch_admin + field worker */}
        <Route path="/customers">
          {isGuest ? <Redirect to="/enquiries/new" /> : <CustomersList />}
        </Route>
        <Route path="/customers/new">
          {isGuest ? <Redirect to="/enquiries/new" /> : <NewCustomer />}
        </Route>
        <Route path="/customers/:id">
          {isGuest ? <Redirect to="/enquiries/new" /> : <CustomerDetail />}
        </Route>

        {/* Enquiries — admin + branch_admin */}
        <Route path="/enquiries">
          {isAdmin || isBranchAdmin ? <EnquiriesList /> : isFieldWorker ? <Redirect to="/customers" /> : <Redirect to="/enquiries/new" />}
        </Route>
        <Route path="/enquiries/new" component={NewEnquiry} />
        <Route path="/enquiries/:id">
          {isAdmin || isBranchAdmin ? <EnquiryDetail /> : <Redirect to="/customers" />}
        </Route>

        {/* Inspections — all authenticated users */}
        <Route path="/inspections">
          {isGuest ? <Redirect to="/enquiries/new" /> : <InspectionsList />}
        </Route>
        <Route path="/inspections/new">
          {isGuest ? <Redirect to="/enquiries/new" /> : <NewInspection />}
        </Route>
        <Route path="/inspections/:id">
          {isGuest ? <Redirect to="/enquiries/new" /> : <InspectionDetail />}
        </Route>

        {/* Jobs — all authenticated users */}
        <Route path="/jobs">
          {isGuest ? <Redirect to="/enquiries/new" /> : <JobsPipeline />}
        </Route>
        <Route path="/jobs/new">
          <AdminOrBranchAdminRoute component={NewJob} />
        </Route>
        <Route path="/jobs/:id">
          {isGuest ? <Redirect to="/enquiries/new" /> : <JobDetail />}
        </Route>

        {/* Stock — all authenticated users */}
        <Route path="/stock">
          {isGuest ? <Redirect to="/enquiries/new" /> : <StockPage />}
        </Route>

        {/* Calendar — all authenticated users */}
        <Route path="/calendar">
          {isGuest ? <Redirect to="/enquiries/new" /> : <CalendarPage />}
        </Route>

        {/* Reports — admin + branch admin only */}
        <Route path="/reports">
          <AdminOrBranchAdminRoute component={ReportsPage} />
        </Route>

        {/* Branch Map — admin only */}
        <Route path="/map">
          <AdminRoute component={MapPage} />
        </Route>

        {/* Admin panel — super admin only */}
        <Route path="/admin/users">
          <AdminRoute component={AdminUsers} />
        </Route>
        <Route path="/admin/branches">
          <AdminRoute component={AdminBranches} />
        </Route>
        <Route path="/admin/email-log">
          <AdminRoute component={EmailLog} />
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}
