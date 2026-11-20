import { Suspense } from "react";
import { SuggestionsTab } from "@/components/agency/suggestions-tab";

// Agency Ops' Suggestions tab.
export default function AgencySuggestionsPage() {
  return (
    <Suspense fallback={null}>
      <SuggestionsTab />
    </Suspense>
  );
}
