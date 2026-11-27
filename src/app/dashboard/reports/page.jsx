import { Suspense } from "react";
import { ReportsTab } from "@/components/agency/reports-tab";

// Birdy's Reports, under "More": Birdy's own Slack reports.
export default function AgencyOpsReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsTab section="ops" />
    </Suspense>
  );
}
