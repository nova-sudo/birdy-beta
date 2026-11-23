"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SectionHeader } from "@/components/by";
import { OPS_SECTION } from "@/components/agency/sections";
import { SectionMore } from "@/components/agency/section-more";
import { opsTabHref, useOpsTabs } from "@/components/agency/tabs";
import {
  DashboardControlsProvider,
  DashboardHeaderControls,
  useDashboardControls,
} from "@/components/dashboard-controls";
import { DATE_PRESETS, DEFAULT_DATE_PRESET } from "@/lib/constants";
import { PortfolioDashboard } from "./portfolio-dashboard";

/**
 * Birdy's Bird's Eye tab at /dashboard: the old Portfolio Dashboard under the
 * section header. For the whole agency it covers every client; narrowed to one
 * (`?client=<id>`, where the rail's client switcher leads) it is the same page
 * with every figure, and the suggestions and activity, for that client only.
 */
export function OpsDashboard() {
  return <AgencyDashboard clientId={useSearchParams().get("client")} />;
}

/**
 * The old page's controls lived in the old top bar. Here they sit in the
 * section header's date slot, the one control group on the page. The range is
 * kept in the address as `?range=`, like every other tab, so it carries over
 * when the tab changes; granularity only re-buckets the chart and stays local.
 */
function AgencyDashboard({ clientId }) {
  const [clientName, setClientName] = useState(null);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const tabs = useOpsTabs();
  const requested = search.get("range");
  const preset = DATE_PRESETS.some((p) => p.value === requested) ? requested : DEFAULT_DATE_PRESET;

  const setPreset = useCallback(
    (value) => {
      const next = new URLSearchParams(search.toString());
      if (value === DEFAULT_DATE_PRESET) next.delete("range");
      else next.set("range", value);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, search]
  );

  return (
    <DashboardControlsProvider preset={preset} onPresetChange={setPreset}>
      <div className="flex min-h-0 flex-1 flex-col">
        <SectionHeader
          section={OPS_SECTION.kit}
          subtitle={clientId ? <ClientSubtitle name={clientName} /> : <PortfolioSubtitle />}
          tabs={tabs}
          tab="birdseye"
          more={<SectionMore section={OPS_SECTION} tab="birdseye" />}
          onTabChange={(value) => value !== "birdseye" && router.push(opsTabHref(value, search))}
          dateRange={<DashboardHeaderControls />}
        />
        <PortfolioDashboard clientId={clientId} onClientName={setClientName} />
      </div>
    </DashboardControlsProvider>
  );
}

/** What the old top bar said under its title: how many clients the figures cover. */
function PortfolioSubtitle() {
  const { clientCount } = useDashboardControls();
  return clientCount
    ? `Portfolio dashboard · ${clientCount.toLocaleString()} ${clientCount === 1 ? "client" : "clients"}`
    : "Portfolio dashboard";
}

/** The line under the section name when the page is narrowed to one client. */
function ClientSubtitle({ name }) {
  return name ? <>Scoped to <b className="font-semibold text-by-text">{name}</b></> : "One client";
}
