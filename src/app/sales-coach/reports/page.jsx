import { Suspense } from "react";
import { ReportsTab } from "@/components/agency/reports-tab";

// Sales Coach's Reports, under "More": its own Slack reports.
export default function SalesCoachReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsTab section="coach" />
    </Suspense>
  );
}
