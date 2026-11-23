"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Link2, Phone, Users } from "lucide-react";
import { Card, Delta, EmptyState, Funnel, RankList, SectionHeader, Skeleton } from "@/components/by";
import { usePortfolioData } from "@/app/dashboard/usePortfolioData";
import { MarketingContent } from "@/components/campaigns/MarketingContent";
import { CallCentreOverview } from "@/components/saleshub/CallCentreOverview";
import { resolveSection } from "@/components/agency/sections";
import { sectionTabHref, useSectionTabs } from "@/components/agency/tabs";
import { SectionMore } from "@/components/agency/section-more";
import { clientDetailHref } from "@/components/shell/nav";
import { rankCampaigns } from "@/lib/birds-eye";
import { groupHasCallCentre } from "@/lib/call-centre-availability";
import { isActive } from "@/lib/client-status";
import { pdFontClass } from "@/lib/pd-fonts";
import { buildFunnel } from "@/lib/portfolio-aggregate";
import { diagnoseFunnel } from "@/lib/portfolio-metrics";
import {
  buyerClientRows, callFunnel, calledByClient, cheapestClients, coachClientRows, cplBands, cplChanges, previousByClient,
} from "@/lib/section-birds-eye";
import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries";
import { useGranularity } from "@/lib/useGranularity";
import {
  AskDock, CardHead, Diagnosis, GranularityMenu, PAGE, RangeMenu, scopedSubtitle, useAddressRange, useMoney, useRangeGroups, useSectionChat,
} from "./section-parts";

const FUNNEL_PARTS = {
  leads: { label: "Meta leads", icon: <Users /> },
  engaged: { label: "In CRM", icon: <Link2 /> },
  called: { label: "Called", icon: <Phone /> },
  closes: { label: "Closed", icon: <Check /> },
  crm: { label: "New in CRM", icon: <Link2 /> },
};
const BAND_FILL = { success: "bg-by-success", danger: "bg-by-danger-solid", accent: "bg-by-accent", neutral: "bg-by-line-strong" };

/**
 * Bird's Eye for Media Buyer or Sales Coach.
 *
 * The top is the old hub's first section, drawn by the old components on the same data: Media Buyer gets the Marketing
 * Hub's metric tabs over the chart with Birdy's read beside it (MarketingContent's hero), Sales Coach the Sales Hub's
 * (CallCentreOverview). Under it, the two cards the old hubs had no equivalent of.
 *
 * The client comes from the rail's switcher (`?client=`), the range from the header (`?range=`), and the chart's
 * granularity from the header's menu beside it. "Ask Birdy about this" opens this section's conversation.
 *
 * @param {import("./sections").SectionConfig} props.section
 */
export function SectionBirdsEye({ section: which }) {
  const section = resolveSection(which);
  const router = useRouter();
  const search = useSearchParams();
  const tabs = useSectionTabs(section);
  const clientId = search.get("client") || null;
  const scoped = clientId != null;
  const range = useAddressRange();
  const { granularity, setGranularity } = useGranularity(range.preset);
  const coach = section.key === "coach";

  // What the old hubs were handed: every client group with its per-day series, for the address's range.
  const { clientGroups, loading: groupsLoading, error: groupsError, refresh, invalidate } = useRangeGroups(useClientGroupsWithSeries, range.preset);
  // The cards under the old section.
  const data = usePortfolioData({ preset: range.preset, granularity: "Daily", chartMetric: "leads", clientId });
  const { client } = data;
  const chat = useSectionChat(section, "ask", client);
  const dashboardHref = sectionTabHref(section, "dashboard", search);

  return (
    <div className={PAGE}>
      <SectionHeader
        section={section.kit}
        subtitle={scopedSubtitle(scoped ? client : null)}
        tabs={tabs}
        tab="birdseye"
        more={<SectionMore section={section} tab="birdseye" />}
        onTabChange={(value) => value !== "birdseye" && router.push(sectionTabHref(section, value, search))}
        dateRange={
          <div className="flex items-center gap-2">
            <GranularityMenu value={granularity} onPick={setGranularity} />
            <RangeMenu preset={range.preset} label={range.label} onPick={range.setPreset} />
          </div>
        }
      />
      <AskDock
        section={section}
        chat={chat}
        title={scoped && client ? `${section.kit.name} · ${client.name}` : undefined}
        placeholder={scoped && client ? `Ask ${section.kit.name} about ${client.name}` : `Ask ${section.kit.name}, or tell it what to change on this dashboard`}
      >
        {(ask) => (
          <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-6 pb-28">
            <div className="flex flex-col gap-[18px]">
              {scoped && client && (
                <Link href={clientDetailHref(client.id)} className="-mb-2 inline-flex items-center gap-1 self-end rounded-by-sm text-by-body-sm font-semibold text-by-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent">
                  Open client page<ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              )}

              <div className={`${pdFontClass} min-w-0`}>
                {coach ? (
                  <CallCentreOverview
                    clientGroups={clientGroups}
                    groupsLoading={groupsLoading}
                    datePreset={range.preset}
                    selectedClientGroup={clientId ?? "all"}
                    granularity={granularity}
                    groupsError={groupsError}
                    onRetry={refresh}
                    onAsk={ask}
                  />
                ) : (
                  <MarketingContent
                    part="hero"
                    clientGroups={clientGroups}
                    groupsLoading={groupsLoading}
                    groupsError={groupsError}
                    datePreset={range.preset}
                    showGroupFilter={false}
                    showHeader={false}
                    selectedClientGroup={clientId}
                    granularity={granularity}
                    onAskBirdy={ask}
                    onCacheInvalidate={invalidate}
                  />
                )}
              </div>

              <SectionCards data={data} coach={coach} preset={range.preset} rangeLabel={range.label} scoped={scoped} dashboardHref={dashboardHref} />
            </div>
          </div>
        )}
      </AskDock>
    </div>
  );
}

/** The two cards under the old section, when there is something for them to say. */
function SectionCards({ data, coach, preset, rangeLabel, scoped, dashboardHref }) {
  const { client, chartMetrics, loading, error, hasClients, hasCallCentre } = data;
  const { money, format } = useMoney(chartMetrics.spend?.valuePrefix ?? "");
  // The old section above says what went wrong, or that there is nothing yet; these add nothing to it.
  if (error) return null;
  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading" className="grid gap-3.5 lg:grid-cols-2">
        {[0, 1].map((i) => <Card key={i} className="px-5 py-4.5"><Skeleton className="w-44" /><Skeleton className="mt-4 h-28 w-full rounded-by-md" /></Card>)}
      </div>
    );
  }
  if (scoped && !client) {
    return <Card><EmptyState icon={<Users />} title="This client isn’t in your account">It may have been removed. Pick another from the switcher at the top of the rail.</EmptyState></Card>;
  }
  if (scoped && !isActive(client)) return null;
  if (!hasClients) {
    return <Card><EmptyState icon={<Users />} title="No active clients yet">Add or import a client from the Clients page and its figures appear here.</EmptyState></Card>;
  }
  if (coach) {
    // Without a call centre the old section already says so, with the way to connect one.
    if (scoped ? !groupHasCallCentre(client) : !hasCallCentre) return null;
    return <CoachCards data={data} preset={preset} rangeLabel={rangeLabel} format={format} scoped={scoped} dashboardHref={dashboardHref} />;
  }
  return <BuyerCards data={data} preset={preset} money={money} scoped={scoped} dashboardHref={dashboardHref} />;
}

/** "Open in Dashboard" at the top right of a card. */
function OpenLink({ href }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-1 rounded-by-sm text-by-body-sm font-semibold text-by-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent">
      Open in Dashboard<ArrowRight aria-hidden="true" className="size-3.5" />
    </Link>
  );
}

// ── Media Buyer ─────────────────────────────────────────────────────────────

function BuyerCards({ data, preset, money, scoped, dashboardHref }) {
  const { current, previous, client, groups, previousGroups } = data;
  const cplTarget = client?.targets?.cpl ?? null;

  const rows = useMemo(() => buyerClientRows(groups), [groups]);
  const changes = useMemo(() => (scoped ? [] : cplChanges(rows, previousByClient(previousGroups, groups, preset), { money })), [scoped, rows, previousGroups, groups, preset, money]);
  const cheapest = useMemo(() => (scoped ? [] : cheapestClients(rows, { money })), [scoped, rows, money]);
  const bands = useMemo(() => cplBands(rows), [rows]);

  const stages = useMemo(() => buildFunnel(current, previous), [current, previous]);
  const diagnosis = useMemo(() => (stages.length ? diagnoseFunnel(stages) : null), [stages]);
  const ads = useMemo(() => rankCampaigns(client?.facebook?.ads, { cplTarget, money }).map((row) => ({ ...row, value: money(row.cpl, 2) })), [client, cplTarget, money]);

  return (
    <div className="grid gap-3.5 lg:grid-cols-2">
      {scoped ? (
        <>
          <Card className="px-5 py-4.5">
            <CardHead title="Performance funnel" />
            {stages.length ? (
              <>
                <Funnel
                  className="mt-4"
                  stages={stages.map((s) => ({
                    key: s.key,
                    ...FUNNEL_PARTS[s.key],
                    value: s.count,
                    note: Number.isFinite(s.delta) ? <Delta value={s.direction === "down" ? -s.delta : s.delta} goodWhen="up" /> : s.share ? `${s.share} of leads` : null,
                  }))}
                />
                <Diagnosis diagnosis={diagnosis} />
              </>
            ) : (
              <EmptyState title="The funnel isn’t ready for this range">It fills in once leads for these dates have been matched to your CRM.</EmptyState>
            )}
          </Card>
          <Card className="px-5 py-4.5">
            <CardHead title={`${client.name}’s ads, by cost per lead`} sub={cplTarget > 0 ? `Limit ${money(cplTarget, 2)} a lead` : "Cheapest first"} action={<OpenLink href={dashboardHref} />} />
            {ads.length ? <RankList className="mt-2" numbered={false} items={ads} /> : (
              <EmptyState title="No ad brought a lead in this range">Ads appear here once they spend and bring in a lead.</EmptyState>
            )}
          </Card>
        </>
      ) : (
        <>
          <Card className="px-5 py-4.5">
            {changes.length ? (
              <>
                <CardHead title="Cost per lead, against the period before" sub="Biggest rise first" action={<OpenLink href={dashboardHref} />} />
                <RankList className="mt-2" numbered={false} items={changes} />
              </>
            ) : (
              <>
                <CardHead title="Cheapest leads, by client" sub="Lowest cost per lead first" action={<OpenLink href={dashboardHref} />} />
                {cheapest.length ? <RankList className="mt-2" items={cheapest} /> : (
                  <EmptyState title="No leads in this range">Clients are ranked once they have spend and leads.</EmptyState>
                )}
              </>
            )}
          </Card>
          <Card className="px-5 py-4.5">
            <CardHead title="Clients by cost per lead" sub="Against each client’s own limit" action={<OpenLink href={dashboardHref} />} />
            <CplBands bands={bands} />
          </Card>
        </>
      )}
    </div>
  );
}

/** One bar split by how many clients sit in each band, and the legend with the counts. */
function CplBands({ bands }) {
  const total = bands.reduce((n, b) => n + b.count, 0);
  if (total === 0) return <EmptyState title="No clients to place">Clients appear here once they are active.</EmptyState>;
  return (
    <>
      <div role="img" aria-label={bands.map((b) => `${b.label}: ${b.count}`).join(", ")} className="mt-4 flex h-2.5 gap-1 overflow-hidden rounded-full">
        {bands.filter((b) => b.count > 0).map((b) => (
          <span key={b.key} className={`h-full rounded-full ${BAND_FILL[b.tone]}`} style={{ flexGrow: b.count }} />
        ))}
      </div>
      <ul className="mt-3 divide-y divide-by-line-soft">
        {bands.map((b) => (
          <li key={b.key} className="flex items-center gap-2.5 py-2.5 text-by-body">
            <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-[3px] ${BAND_FILL[b.tone]}`} />
            <span className="min-w-0 flex-1 text-by-text-2">{b.label}</span>
            <b className="font-semibold tabular-nums">{b.count}</b>
          </li>
        ))}
      </ul>
    </>
  );
}

// ── Sales Coach ─────────────────────────────────────────────────────────────

function CoachCards({ data, preset, rangeLabel, format, scoped, dashboardHref }) {
  const { current, client, groups } = data;
  const rows = useMemo(() => coachClientRows(groups, preset), [groups, preset]);
  const ranked = useMemo(() => calledByClient(rows), [rows]);
  const funnel = useMemo(() => callFunnel(current), [current]);
  const row = scoped ? rows.find((r) => r.id === client.id) : null;

  return (
    <div className="grid gap-3.5 lg:grid-cols-2">
      <Card className="px-5 py-4.5">
        <CardHead title="New lead to close" />
        {funnel ? (
          <>
            <Funnel
              className="mt-4"
              stages={funnel.stages.map((s) => ({ key: s.key, ...FUNNEL_PARTS[s.key], value: s.count.toLocaleString("en-GB"), note: s.share ? `${s.share} of new in CRM` : rangeLabel.toLowerCase() }))}
            />
            <Diagnosis diagnosis={funnel.diagnosis} />
          </>
        ) : (
          <EmptyState title="The funnel isn’t ready for this range">It fills in once leads for these dates have been matched to your CRM.</EmptyState>
        )}
      </Card>
      <Card className="px-5 py-4.5">
        {scoped ? (
          <>
            <CardHead title={`${client.name}’s call centre`} sub={rangeLabel} action={<OpenLink href={dashboardHref} />} />
            <CallCentreFacts row={row} format={format} />
          </>
        ) : (
          <>
            <CardHead title="New leads called, by client" sub="Lowest share first" action={<OpenLink href={dashboardHref} />} />
            {ranked.length ? <RankList className="mt-2" numbered={false} items={ranked} /> : (
              <EmptyState title="Nothing to rank for this range">Clients are ranked once their new leads have been matched to your CRM.</EmptyState>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

/** One client's call centre in a few lines. */
function CallCentreFacts({ row, format }) {
  if (!row) return null;
  const facts = [
    ["New leads called", row.share == null ? "Not ready" : `${format.count(row.called)} of ${format.count(row.inCrm)} · ${Math.round(row.share)}%`, row.share != null && row.share < 50],
    ["Calls made", format.count(row.calls), false],
    ["Time on the phone", format.minutes(row.talk), false],
    ["Calls answered", row.answered == null ? "No calls" : `${Math.round(row.answered)}%`, false],
    ["Closed", format.count(row.closes), false],
  ];
  return (
    <dl className="mt-2 divide-y divide-by-line-soft">
      {facts.map(([label, value, bad]) => (
        <div key={label} className="flex items-baseline gap-3 py-2.5">
          <dt className="min-w-0 flex-1 text-by-text-2">{label}</dt>
          <dd className={`font-semibold tabular-nums ${bad ? "text-by-danger" : "text-by-text"}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
