import { Suspense } from "react";
import { DashboardTab } from "@/components/agency/dashboard-tab";

// Agency Ops' Dashboard tab: the Clients table with the ask bar.
export default function AgencyDashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardTab />
    </Suspense>
  );
}
