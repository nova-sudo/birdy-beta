import { Suspense } from "react";
import { OpsClientsDashboard } from "./ops-clients";

// Agency Ops' Dashboard tab: the Clients table. It reads the address, which needs a Suspense boundary.
export default function AgencyDashboardPage() {
  return (
    <Suspense fallback={null}>
      <OpsClientsDashboard />
    </Suspense>
  );
}
