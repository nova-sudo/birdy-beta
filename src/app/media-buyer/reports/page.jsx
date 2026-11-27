import { Suspense } from "react";
import { ReportsTab } from "@/components/agency/reports-tab";

// Marketing Guru's Reports, under "More": its agent's morning and weekly reports, then its Slack reports.
export default function MediaBuyerReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsTab section="buyer" />
    </Suspense>
  );
}
