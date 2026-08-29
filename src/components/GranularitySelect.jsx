"use client";

import { Clock } from "lucide-react";
import { PdMenu } from "@/components/portfolio/PdMenu";
import { GRANULARITIES } from "@/lib/portfolio-series";

// The chart-granularity chip from the Portfolio Dashboard's top bar, lifted out
// so the Marketing, Sales and Lead hubs wear the same control rather than three
// copies of it. Purely presentational — see useGranularity for the state, which
// is what the hubs actually share.

export function GranularitySelect({ value, onChange, className }) {
  return (
    <PdMenu
      label="Chart granularity"
      value={value}
      options={GRANULARITIES}
      onChange={onChange}
      className={className}
      icon={<Clock className="size-[14px] shrink-0 text-pd-primary" aria-hidden="true" />}
    />
  );
}
