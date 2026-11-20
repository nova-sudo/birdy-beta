import { Suspense } from "react";
import { ContextTab } from "@/components/agency/context-tab";

// Sales Coach's Context page, under "More": what it knows, which Birdy uses in every answer.
export default function SalesCoachContextPage() {
  return (
    <Suspense fallback={null}>
      <ContextTab section="coach" />
    </Suspense>
  );
}
