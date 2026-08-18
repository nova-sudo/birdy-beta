"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Calendar, Clock, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PdMenu } from "@/components/portfolio/PdMenu";
import { DATE_PRESETS, DEFAULT_DATE_PRESET } from "@/lib/constants";
import { APP_VERSION } from "@/lib/changelog";
import { GRANULARITIES } from "@/lib/portfolio-series";
import { portfolioFontClass } from "@/app/dashboard/fonts";

// What sits at each end of the global top bar.
//
// A screen's title and its filters belong beside the notifications bell and the
// profile menu rather than repeated down the page — but the top bar is rendered
// by src/app/layout.jsx and the page is its child, so the two are in different
// parts of the tree. A context is the quiet way across: no portals, no DOM
// hunting, and the page reads the same values the header writes.
//
// Any page can publish into those slots with useHeaderSlot. Where nothing is
// published the left slot falls back to the Birdy wordmark and version badge,
// which is what every other route still shows.

const DASHBOARD_ROUTE = "/dashboard";

const DashboardControlsContext = createContext(null);

export function DashboardControlsProvider({ children }) {
  const [preset, setPreset] = useState(DEFAULT_DATE_PRESET);
  const [granularity, setGranularity] = useState("Daily");
  // Published upwards by the page: the header shows the client count, but only
  // the page knows it, and it should not fetch the portfolio a second time to
  // find out.
  const [clientCount, setClientCount] = useState(null);
  // The current page's title block and filter chips, published by useHeaderSlot.
  const [pageHeader, setPageHeader] = useState(null);
  const [pageControls, setPageControls] = useState(null);

  const value = useMemo(
    () => ({
      preset,
      setPreset,
      granularity,
      setGranularity,
      clientCount,
      setClientCount,
      pageHeader,
      setPageHeader,
      pageControls,
      setPageControls,
    }),
    [preset, granularity, clientCount, pageHeader, pageControls]
  );

  return (
    <DashboardControlsContext.Provider value={value}>
      {children}
    </DashboardControlsContext.Provider>
  );
}

/**
 * Publish a page's title and filter controls into the global top bar.
 *
 * Both slots clear on unmount, so leaving the route puts the wordmark back
 * rather than stranding one screen's filters on the next.
 *
 * `controls` is a React node held in state, so **the caller must memoise it**.
 * An inline element is a new object on every render, which would set state on
 * every render and loop.
 */
export function useHeaderSlot({ title, subtitle, controls } = {}) {
  const { setPageHeader, setPageControls } = useDashboardControls();

  useEffect(() => {
    setPageHeader(title ? { title, subtitle } : null);
    return () => setPageHeader(null);
  }, [title, subtitle, setPageHeader]);

  useEffect(() => {
    setPageControls(controls ?? null);
    return () => setPageControls(null);
  }, [controls, setPageControls]);
}

/** The title block shape both the published and built-in headers render. */
function TitleBlock({ title, subtitle }) {
  return (
    <div className={portfolioFontClass}>
      <h1 className="font-pd-display text-[19px] font-bold leading-none tracking-[-0.02em] text-pd-ink">
        {title}
      </h1>
      {subtitle && <p className="mt-1 text-[12px] leading-none text-pd-faint">{subtitle}</p>}
    </div>
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

  const [fallbackPageHeader, setFallbackPageHeader] = useState(null);
  const [fallbackPageControls, setFallbackPageControls] = useState(null);

  return (
    ctx ?? {
      preset: fallbackPreset,
      setPreset: setFallbackPreset,
      granularity: fallbackGranularity,
      setGranularity: setFallbackGranularity,
      clientCount: fallbackClientCount,
      setClientCount: setFallbackClientCount,
      pageHeader: fallbackPageHeader,
      setPageHeader: setFallbackPageHeader,
      pageControls: fallbackPageControls,
      setPageControls: setFallbackPageControls,
    }
  );
}

/**
 * Whatever belongs at the left of the top bar on this route.
 *
 * In precedence order: a title the page published, the dashboard's own title,
 * or the Birdy wordmark. Owning all three here is what lets src/app/layout.jsx
 * render one component instead of branching on the route itself.
 *
 * It carries the pd font variables: the page subtree that normally provides
 * them is below the header, not around it.
 */
export function DashboardHeaderTitle() {
  const pathname = usePathname();
  const { clientCount, pageHeader } = useDashboardControls();

  if (pageHeader) return <TitleBlock {...pageHeader} />;

  if (pathname === DASHBOARD_ROUTE) {
    return (
      <TitleBlock
        title="Portfolio Dashboard"
        subtitle={
          clientCount
            ? `${clientCount.toLocaleString()} ${clientCount === 1 ? "client" : "clients"} · portfolio-level performance`
            : "Portfolio-level performance"
        }
      />
    );
  }

  // Every other route keeps the wordmark and the version badge.
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg font-bold leading-none text-foreground">Birdy</span>
      <Link
        href="/changelog"
        aria-label={`What's new in Birdy — version ${APP_VERSION}`}
        title={`What's new — ${APP_VERSION}`}
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
      >
        <Badge
          variant="secondary"
          className="cursor-pointer gap-1 font-semibold transition-colors hover:bg-secondary/70"
        >
          <Tag className="h-3 w-3 text-purple-500" aria-hidden="true" />
          {APP_VERSION}
        </Badge>
      </Link>
    </div>
  );
}

/**
 * The filter chips at the right of the top bar, beside the bell and avatar.
 *
 * A page's own published controls win; otherwise the dashboard renders its two
 * chips. Every other route has nothing here to filter.
 */
export function DashboardHeaderControls() {
  const pathname = usePathname();
  const { preset, setPreset, granularity, setGranularity, pageControls } =
    useDashboardControls();

  if (pageControls) return pageControls;
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
