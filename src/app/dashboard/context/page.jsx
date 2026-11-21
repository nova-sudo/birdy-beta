import { Suspense } from "react";
import { ContextTab } from "@/components/agency/context-tab";

// Birdy's Context page, under "More": what it knows, which Birdy uses in every answer.
export default function AgencyOpsContextPage() {
  return (
    <Suspense fallback={null}>
      <ContextTab section="ops" />
    </Suspense>
  );
}
