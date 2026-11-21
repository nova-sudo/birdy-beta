"use client";

import { useState } from "react";
import { Segmented } from "@/components/by";
import { Sub } from "../kit-parts";

/** The segmented toggle: a filter with counts, and a two-way choice. */
export function SegmentedDemo() {
  const [view, setView] = useState("all");
  const [channel, setChannel] = useState("sms");
  return (
    <Sub title="Segmented">
      <div className="flex flex-wrap items-center gap-4">
        <Segmented
          aria-label="Show in the conversation"
          value={view}
          onValueChange={setView}
          items={[{ value: "all", label: "All", count: 12 }, { value: "messages", label: "Messages", count: 9 }, { value: "calls", label: "Calls", count: 0 }]}
        />
        <Segmented aria-label="Send as" value={channel} onValueChange={setChannel} items={[{ value: "sms", label: "SMS" }, { value: "email", label: "Email" }]} />
      </div>
    </Sub>
  );
}
