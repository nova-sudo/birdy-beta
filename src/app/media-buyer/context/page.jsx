import { Suspense } from "react";
import { ContextTab } from "@/components/agency/context-tab";

// Media Buyer's Context page, under "More": what it knows, which Birdy uses in every answer.
export default function MediaBuyerContextPage() {
  return (
    <Suspense fallback={null}>
      <ContextTab section="buyer" />
    </Suspense>
  );
}
