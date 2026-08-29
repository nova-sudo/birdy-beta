"use client";

import { useMemo, useState } from "react";

import { presetToDateRange } from "@/lib/date-utils";
import { granularityForRange } from "@/lib/saleshub-series";

// ─── The hubs' chart granularity ────────────────────────────────────────────
// Two things share one value here, and the order matters:
//
//   the window chooses    until you say otherwise, the granularity is whatever
//                         granularityForRange makes of the selected date range
//                         — daily up to a month, weekly up to four, monthly
//                         beyond. That is what these charts did before there
//                         was a control, and it is still the right first
//                         answer: picking "maximum" and being handed four
//                         hundred daily points is not a reading of anything.
//
//   then you choose       an explicit pick from the chip overrides it, and
//                         keeps overriding it as you move the date range
//                         around. Having asked for weekly once, you meant it.
//
// The chip always shows the granularity actually being plotted, auto or not,
// so the label is never a claim about something other than the chart.

/**
 * @param {string} datePreset the hub's current date preset
 * @returns {{granularity: string, setGranularity: (g: string) => void, isAuto: boolean}}
 */
export function useGranularity(datePreset) {
  const [chosen, setChosen] = useState(null);

  const auto = useMemo(() => {
    const { start_date, end_date } = presetToDateRange(datePreset);
    return granularityForRange(start_date, end_date);
  }, [datePreset]);

  return {
    granularity: chosen ?? auto,
    setGranularity: setChosen,
    isAuto: chosen == null,
  };
}
