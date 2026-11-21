"use client";

// Settings: Connections, Plan & credits, Account, Alerts and Metrics, one tab each in the section pill. ?section= opens one; plain
// /settings is Connections, and the old ?tab= values and /metrics, /alerts,
// /billing and /credits
// land on the section that holds what they showed (lib/settings-sections).
//
// Every provider's OAuth callback lands on /settings, so the integrations hook
// runs here, above the tabs: a callback is banked whichever section the
// address asks for.

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton, TabPanel, TabPill } from "@/components/by";
import { PAGE } from "@/components/agency/section-parts";
import { SETTINGS_SECTIONS, sectionFromParams, sectionHref } from "@/lib/settings-sections";
import { useIntegrations } from "./use-integrations";
import { ConnectionsSection } from "./connections-section";
import { PlanSection } from "./plan-section";
import { AccountSection } from "./account-section";
import { MetricsSection } from "./metrics/metrics-section";
import { AlertsSection } from "./alerts/alerts-section";

/** The section's heading line: its name and what it holds. */
function SectionTitle({ section, id }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 id={id} className="font-by-display text-by-heading font-bold tracking-[-0.01em]">{section.title}</h2>
      <p className="text-by-body-sm text-by-muted">{section.sub}</p>
    </div>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const section = sectionFromParams(search);
  const integrations = useIntegrations();

  // At phone width the pill scrolls sideways: keep the open section in sight.
  useEffect(() => {
    document.querySelector('[aria-label="Settings sections"] [role="tab"][aria-selected="true"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [section]);

  const open = useCallback((key) => {
    if (key === section) return;
    router.replace(sectionHref(key), { scroll: false });
  }, [router, section]);

  // On its way back to the onboarding wizard after an OAuth hop: this page is
  // not the destination, so it never paints (see lib/oauth-handoff).
  if (integrations.passingThrough) {
    return (
      <div role="status" aria-label="Finishing up" className="grid min-h-dvh place-items-center bg-by-canvas">
        <div className="w-full max-w-[600px] space-y-4 px-6">
          <Skeleton className="mx-auto size-20 rounded-full" />
          <Skeleton className="mx-auto h-8 w-2/3" />
          <Skeleton className="mx-auto h-4 w-1/2" />
        </div>
      </div>
    );
  }

  const connectionsNeedYou = integrations.needsYou;
  const items = SETTINGS_SECTIONS.map((s) => (s.key === "connections" && connectionsNeedYou > 0 ? { value: s.key, label: s.label, count: connectionsNeedYou } : { value: s.key, label: s.label }));

  return (
    <div className={PAGE}>
      <header className="shrink-0 border-b border-by-line bg-by-surface px-4 py-3.5 sm:px-7">
        <h1 className="font-by-display text-by-title leading-[1.2] font-bold tracking-[-0.01em]">Settings</h1>
        <p className="truncate text-by-body text-by-muted">Connections, account, alerts and metrics</p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col pt-4.5">
        <TabPill items={items} value={section} onValueChange={open} fill aria-label="Settings sections" className="mx-4 max-w-[calc(100%-2rem)] overflow-x-auto [scrollbar-width:none] sm:mx-7 sm:max-w-[calc(100%-3.5rem)] [&::-webkit-scrollbar]:hidden">
          {SETTINGS_SECTIONS.map((s) => (
            <TabPanel
              key={s.key}
              value={s.key}
              // Connections stays mounted: an OAuth callback and a half-typed
              // HotProspector key survive a look at another section.
              forceMount={s.key === "connections" ? true : undefined}
              aria-labelledby={`settings-h-${s.key}`}
              className={
                s.key === "metrics"
                  ? "flex min-h-0 flex-1 flex-col gap-3.5 px-4 pt-4.5 pb-5 data-[state=inactive]:hidden sm:px-7"
                  : "min-h-0 flex-1 overflow-y-auto px-4 pt-4.5 pb-10 data-[state=inactive]:hidden sm:px-7"
              }
            >
              <div className={s.key === "metrics" ? "contents" : "flex flex-col gap-3.5"}>
                <SectionTitle section={s} id={`settings-h-${s.key}`} />
                {s.key === "connections" && <ConnectionsSection integrations={integrations} />}
                {s.key === "plan" && <PlanSection />}
                {s.key === "account" && <AccountSection />}
                {s.key === "alerts" && <AlertsSection />}
                {s.key === "metrics" && <MetricsSection />}
              </div>
            </TabPanel>
          ))}
        </TabPill>
      </div>
    </div>
  );
}
