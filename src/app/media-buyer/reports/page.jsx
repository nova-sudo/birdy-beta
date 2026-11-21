import { Suspense } from "react";
import { ReportsTab } from "@/components/agency/reports-tab";

// Media Buyer's Reports, under "More": the Media Buying Agent's morning and weekly reports.
export default function MediaBuyerReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsTab section="buyer" />
    </Suspense>
  );
}
