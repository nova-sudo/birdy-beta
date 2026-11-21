import { Suspense } from "react";
import { ReportsTab } from "@/components/agency/reports-tab";

// One of Agency Ops' Slack reports.
export default async function AgencyOpsReportPage({ params }) {
  const { report } = await params;
  return (
    <Suspense fallback={null}>
      <ReportsTab section="ops" reportId={decodeURIComponent(report)} />
    </Suspense>
  );
}
