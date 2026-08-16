"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Calendar, Clock } from "lucide-react";
import { PdMenu } from "@/components/portfolio/PdMenu";
import { DATE_PRESETS, DEFAULT_DATE_PRESET } from "@/lib/constants";
import { GRANULARITIES } from "@/lib/portfolio-series";

// The dashboard's date range and chart granularity live in the global top bar,
// beside the notifications bell and profile menu, rather than on the page.
//
// That puts the controls and the page that obeys them in two different parts of
// the tree — the header is rendered by src/app/layout.jsx, the page is its
// child — so the state has to sit above both. A context is the quiet way to do
// that: no portals, no DOM hunting, and the page reads the same values the
// header writes.

const DASHBOARD_ROUTE = "/dashboard";

const DashboardControlsContext = createContext(null);

export function DashboardControlsProvider({ children }) {
  const [preset, setPreset] = useState(DEFAULT_DATE_PRESET);
  const [granularity, setGranularity] = useState("Daily");

  const value = useMemo(
    () => ({ preset, setPreset, granularity, setGranularity }),
    [preset, granularity]
  );

  return (
    <DashboardControlsContext.Provider value={value}>
      {children}
    </DashboardControlsContext.Provider>
  );
}

/**
 * Read the shared dashboard controls.
 *
 * Falls back to defaults when no provider is above — the dashboard renders
 * something sensible in tests and anywhere else it's mounted standalone.
 */
export function useDashboardControls() {
  const ctx = useContext(DashboardControlsContext);
  const [fallbackPreset, setFallbackPreset] = useState(DEFAULT_DATE_PRESET);
  const [fallbackGranularity, setFallbackGranularity] = useState("Daily");

  return (
    ctx ?? {
      preset: fallbackPreset,
      setPreset: setFallbackPreset,
      granularity: fallbackGranularity,
      setGranularity: setFallbackGranularity,
    }
  );
}

/**
 * The two chips in the top bar. Renders only on the dashboard — every other
 * route has nothing for them to filter.
 */
export function DashboardHeaderControls() {
  const pathname = usePathname();
  const { preset, setPreset, granularity, setGranularity } = useDashboardControls();

  if (pathname !== DASHBOARD_ROUTE) return null;

  return (
    <div className="hidden items-center gap-2 md:flex">
      <PdMenu
        label="Chart granularity"
        value={granularity}
        options={GRANULARITIES}
        onChange={setGranularity}
        icon={<Clock className="size-[14px] shrink-0 text-pd-primary" aria-hidden="true" />}
      />
      <PdMenu
        label="Date range"
        value={preset}
        options={DATE_PRESETS}
        onChange={setPreset}
        className="[&_[role=listbox]]:w-[180px]"
        icon={<Calendar className="size-[14px] shrink-0" aria-hidden="true" />}
      />
    </div>
  );
}
