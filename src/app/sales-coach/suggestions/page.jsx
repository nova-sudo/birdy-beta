import { Suspense } from "react";
import { SuggestionsTab } from "@/components/agency/suggestions-tab";

// Sales Coach's Suggestions tab: its own suggestions only.
export default function SalesCoachSuggestionsPage() {
  return (
    <Suspense fallback={null}>
      <SuggestionsTab section="coach" />
    </Suspense>
  );
}
