import { Layout } from "./components/layout";
import { Switch, Route } from "wouter";

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

export function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />

        <Route path="/customers" component={CustomersList} />
        <Route path="/customers/new" component={NewCustomer} />
        <Route path="/customers/:id" component={CustomerDetail} />

        <Route path="/enquiries" component={EnquiriesList} />
        <Route path="/enquiries/new" component={NewEnquiry} />
        <Route path="/enquiries/:id" component={EnquiryDetail} />

        <Route path="/inspections" component={InspectionsList} />
        <Route path="/inspections/new" component={NewInspection} />
        <Route path="/inspections/:id" component={InspectionDetail} />

        <Route path="/jobs" component={JobsPipeline} />
        <Route path="/jobs/new" component={NewJob} />
        <Route path="/jobs/:id" component={JobDetail} />

        <Route path="/admin/users" component={AdminUsers} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}
