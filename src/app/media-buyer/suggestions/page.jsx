import { Suspense } from "react";
import { SuggestionsTab } from "@/components/agency/suggestions-tab";

// Media Buyer's Suggestions tab: its own suggestions only.
export default function MediaBuyerSuggestionsPage() {
  return (
    <Suspense fallback={null}>
      <SuggestionsTab section="buyer" />
    </Suspense>
  );
}
