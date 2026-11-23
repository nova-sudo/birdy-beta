import { Suspense } from "react";
import { OpsDashboard } from "./ops-dashboard";

// Birdy opens on its Dashboard: the old Portfolio Dashboard. The page reads
// the client and the date range from the address, which needs a Suspense
// boundary.
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <OpsDashboard />
    </Suspense>
  );
}
