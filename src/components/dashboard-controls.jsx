"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Calendar, Clock } from "lucide-react";
import { PdMenu } from "@/components/portfolio/PdMenu";
import { DATE_PRESETS, DEFAULT_DATE_PRESET } from "@/lib/constants";
import { GRANULARITIES } from "@/lib/portfolio-series";
import { portfolioFontClass } from "@/app/dashboard/fonts";

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
  // Published upwards by the page: the header shows the client count, but only
  // the page knows it, and it should not fetch the portfolio a second time to
  // find out.
  const [clientCount, setClientCount] = useState(null);

  const value = useMemo(
    () => ({ preset, setPreset, granularity, setGranularity, clientCount, setClientCount }),
    [preset, granularity, clientCount]
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
  const [fallbackClientCount, setFallbackClientCount] = useState(null);

  return (
    ctx ?? {
      preset: fallbackPreset,
      setPreset: setFallbackPreset,
      granularity: fallbackGranularity,
      setGranularity: setFallbackGranularity,
      clientCount: fallbackClientCount,
      setClientCount: setFallbackClientCount,
    }
  );
}

/**
 * The dashboard's title block, which stands in for the Birdy wordmark in the
 * top bar while you are on that route.
 *
 * It carries the pd font variables itself: the page subtree that normally
 * provides them is below the header, not around it.
 */
export function DashboardHeaderTitle() {
  const pathname = usePathname();
  const { clientCount } = useDashboardControls();

  if (pathname !== DASHBOARD_ROUTE) return null;

  return (
    <div className={portfolioFontClass}>
      <h1 className="font-pd-display text-[19px] font-bold leading-none tracking-[-0.02em] text-pd-ink">
        Portfolio Dashboard
      </h1>
      <p className="mt-1 text-[12px] leading-none text-pd-faint">
        {clientCount
          ? `${clientCount.toLocaleString()} ${clientCount === 1 ? "client" : "clients"} · portfolio-level performance`
          : "Portfolio-level performance"}
      </p>
    </div>
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
