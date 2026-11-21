import { Suspense } from "react";
import { ProjectionsTab } from "@/components/agency/projections-tab";

// Media Buyer's Projections, under "More": this month's budget pacing.
export default function MediaBuyerProjectionsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectionsTab section="buyer" />
    </Suspense>
  );
}
