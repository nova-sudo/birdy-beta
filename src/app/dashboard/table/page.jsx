import { Suspense } from "react";
import { OpsLeadsDashboard } from "./ops-leads";

// Agency Ops' Dashboard tab: the Leads hub's table. It reads the client and the
// date range from the address, which needs a Suspense boundary.
export default function AgencyDashboardPage() {
  return (
    <Suspense fallback={null}>
      <OpsLeadsDashboard />
    </Suspense>
  );
}
