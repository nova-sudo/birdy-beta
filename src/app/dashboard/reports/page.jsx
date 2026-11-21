import { Suspense } from "react";
import { ReportsTab } from "@/components/agency/reports-tab";

// Agency Ops' Reports, under "More": the account's Slack reports.
export default function AgencyOpsReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsTab section="ops" />
    </Suspense>
  );
}
