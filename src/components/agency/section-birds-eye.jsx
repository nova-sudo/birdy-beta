"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Link2, Phone, Users } from "lucide-react";
import { Button, Card, Delta, EmptyState, Funnel, Notice, RankList, SectionHeader } from "@/components/by";
import { usePortfolioData } from "@/app/dashboard/usePortfolioData";
import { resolveSection } from "@/components/agency/sections";
import { sectionTabHref, useSectionTabs } from "@/components/agency/tabs";
import { clientDetailHref } from "@/components/shell/nav";
import { CHART_COPY, buildTiles, rankCampaigns } from "@/lib/birds-eye";
import { LINK_SALES_TOOL_HREF, groupHasCallCentre } from "@/lib/call-centre-availability";
import { isActive } from "@/lib/client-status";
import { buildFunnel } from "@/lib/portfolio-aggregate";
import { diagnoseFunnel } from "@/lib/portfolio-metrics";
import {
  COACH_CHART_COPY, COACH_CHART_KEYS, buyerChartKeys, buyerClientRows, buyerFinding, buyerTiles, callFunnel, callSeries, callTotals, calledByClient,
  cheapestClients, coachClientRows, coachFinding, coachTiles, cplBands, cplChanges, previousByClient,
} from "@/lib/section-birds-eye";
import {
  AskDock, CardHead, ChartCard, Diagnosis, LoadingBody, PAGE, RangeMenu, Tiles, scopedSubtitle, useAddressRange, useMoney, useSectionChat,
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
 * Bird's Eye for Media Buyer or Sales Coach: the section's tiles, its per-day chart, two cards, and the ask bar.
 * With `?client=<id>` it is the same page fed that client's numbers.
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
  const coach = section.key === "coach";

  // Sales Coach draws its calls from each client's own per-day series, so the portfolio hook never fetches call logs here.
  const data = usePortfolioData({ preset: range.preset, granularity: "Daily", chartMetric: "leads", clientId });
  const { client, chartMetrics, loading, error, hasClients } = data;
  const { money, format } = useMoney(chartMetrics.spend?.valuePrefix ?? "");
  const chat = useSectionChat(section, "ask", client);

  const caption = scoped ? client?.name ?? "Client" : coach ? `${data.groups.filter((g) => isActive(g) && groupHasCallCentre(g)).length} clients with a call centre` : `${data.clientCount} client${data.clientCount === 1 ? "" : "s"}`;
  const dashboardHref = sectionTabHref(section, "dashboard", search);

  return (
    <div className={PAGE}>
      <SectionHeader
        section={section.kit}
        subtitle={scopedSubtitle(scoped ? client : null)}
        tabs={tabs}
        tab="birdseye"
        onTabChange={(value) => value !== "birdseye" && router.push(sectionTabHref(section, value, search))}
        dateRange={<RangeMenu preset={range.preset} label={range.label} onPick={range.setPreset} />}
      />
      <AskDock
        section={section}
        chat={chat}
        title={scoped && client ? `${section.kit.name} · ${client.name}` : undefined}
        placeholder={scoped && client ? `Ask ${section.kit.name} about ${client.name}` : `Ask ${section.kit.name}, or tell it what to change on this dashboard`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-6 pb-28">
          <div className="mx-auto flex max-w-[1040px] flex-col gap-3.5">
            <div className="flex items-center gap-3 text-by-body-sm font-medium text-by-text-2">
              <span>{range.label} · {caption}</span>
              {scoped && client && (
                <Link href={clientDetailHref(client.id)} className="ml-auto inline-flex items-center gap-1 rounded-by-sm font-semibold text-by-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent">
                  Open client page<ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              )}
            </div>

            {error ? (
              <Notice tone="danger">Couldn’t load these figures. Check your connection and refresh the page.</Notice>
            ) : loading ? (
              <LoadingBody tiles={coach || scoped ? 4 : 3} />
            ) : scoped && !client ? (
              <Card><EmptyState icon={<Users />} title="This client isn’t in your account">It may have been removed. Pick another from the switcher at the top of the rail.</EmptyState></Card>
            ) : scoped && !isActive(client) ? (
              <Card><EmptyState icon={<Users />} title={`${client.name} is inactive`}>Inactive clients are left out of the figures. Set the client active on its page to see them here.</EmptyState></Card>
            ) : !hasClients ? (
              <Card><EmptyState icon={<Users />} title="No active clients yet">Add or import a client from the Clients page and its figures appear here.</EmptyState></Card>
            ) : coach ? (
              <CoachBody data={data} preset={range.preset} rangeLabel={range.label} format={format} scoped={scoped} dashboardHref={dashboardHref} />
            ) : (
              <BuyerBody data={data} preset={range.preset} rangeLabel={range.label} money={money} format={format} scoped={scoped} dashboardHref={dashboardHref} />
            )}
          </div>
        </div>
      </AskDock>
    </div>
  );
}

/** "Open in Dashboard" at the top right of a card. */
function OpenLink({ href }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-1 rounded-by-sm text-by-body-sm font-semibold text-by-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent">
      Open in Dashboard<ArrowRight aria-hidden="true" className="size-3.5" />
    </Link>
  );
}

/** The line under the caption. */
function Finding({ finding }) {
  if (!finding) return null;
  return (
    <p className="-mt-0.5 mb-1 text-[length:1.0625rem] leading-[1.6] text-by-text-2 text-pretty">
      <b className="font-semibold text-by-text underline decoration-by-line-strong underline-offset-[3px]">{finding.lead}</b>{finding.rest}
    </p>
  );
}

/** The chart's pick, kept to the figures this view offers. */
function useMetric(keys) {
  const [metric, setMetric] = useState(keys[0]);
  return [keys.includes(metric) ? metric : keys[0], setMetric];
}

// ── Media Buyer ─────────────────────────────────────────────────────────────

function BuyerBody({ data, preset, rangeLabel, money, format, scoped, dashboardHref }) {
  const { current, previous, client, chartMetrics, groups, previousGroups, seriesLoading } = data;
  const keys = buyerChartKeys(scoped);
  const [metric, setMetric] = useMetric(keys);
  const cplTarget = client?.targets?.cpl ?? null;

  const rows = useMemo(() => buyerClientRows(groups), [groups]);
  const tiles = useMemo(
    () => (scoped ? buildTiles({ current, previous, preset, hasCallCentre: true, scoped: true, cplTarget, money }) : buyerTiles({ current, previous, preset, rows })),
    [scoped, current, previous, preset, cplTarget, money, rows],
  );
  const finding = useMemo(() => (scoped ? null : buyerFinding({ current, previous, preset, rows })), [scoped, current, previous, preset, rows]);
  const changes = useMemo(() => (scoped ? [] : cplChanges(rows, previousByClient(previousGroups, groups, preset), { money })), [scoped, rows, previousGroups, groups, preset, money]);
  const cheapest = useMemo(() => (scoped ? [] : cheapestClients(rows, { money })), [scoped, rows, money]);
  const bands = useMemo(() => cplBands(rows), [rows]);

  const stages = useMemo(() => buildFunnel(current, previous), [current, previous]);
  const diagnosis = useMemo(() => (stages.length ? diagnoseFunnel(stages) : null), [stages]);
  const ads = useMemo(() => rankCampaigns(client?.facebook?.ads, { cplTarget, money }).map((row) => ({ ...row, value: money(row.cpl, 2) })), [client, cplTarget, money]);

  const series = chartMetrics[metric];
  const tile = tiles.find((t) => t.key === metric);

  return (
    <>
      <Finding finding={finding} />
      <Tiles tiles={tiles} format={format} />
      <ChartCard
        keys={keys}
        copy={CHART_COPY}
        metric={metric}
        onMetric={setMetric}
        series={series}
        delta={tile?.delta}
        goodWhen={tile?.goodWhen}
        format={format}
        rangeLabel={rangeLabel}
        loading={seriesLoading || series?.loading}
      />
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
    </>
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

function CoachBody({ data, preset, rangeLabel, format, scoped, dashboardHref }) {
  const router = useRouter();
  const { current, previous, client, chartMetrics, groups, seriesLoading, hasCallCentre } = data;
  const [metric, setMetric] = useMetric(COACH_CHART_KEYS);
  const calls = useMemo(() => callTotals(groups, preset), [groups, preset]);
  const tiles = useMemo(() => coachTiles({ current, previous, preset, calls }), [current, previous, preset, calls]);
  const finding = useMemo(() => (scoped ? null : coachFinding({ current, previous, preset })), [scoped, current, previous, preset]);
  const days = useMemo(() => callSeries(calls.days, preset), [calls.days, preset]);
  const rows = useMemo(() => coachClientRows(groups, preset), [groups, preset]);
  const ranked = useMemo(() => calledByClient(rows), [rows]);
  const funnel = useMemo(() => callFunnel(current), [current]);

  if (scoped ? !groupHasCallCentre(client) : !hasCallCentre) {
    return (
      <Card>
        <EmptyState
          icon={<Phone />}
          title={scoped ? `${client.name} has no call centre connected` : "No call centre connected"}
          action={<Button size="sm" onClick={() => router.push(LINK_SALES_TOOL_HREF)}>Connect a call centre</Button>}
        >
          {scoped ? "Sales Coach reads calls only, so there is nothing to show for this client yet." : "Sales Coach reads calls only. Connect Hot Prospector in Settings and its calls appear here."}
        </EmptyState>
      </Card>
    );
  }

  const own = days[metric];
  const series = metric === "closes"
    ? chartMetrics.closes
    : own && { ...own, total: format[COACH_CHART_COPY[metric].kind](own.sum) };
  const tile = tiles.find((t) => t.key === metric);
  const row = scoped ? rows.find((r) => r.id === client.id) : null;

  return (
    <>
      <Finding finding={finding} />
      <Tiles tiles={tiles} format={format} />
      <ChartCard
        keys={COACH_CHART_KEYS}
        copy={COACH_CHART_COPY}
        metric={metric}
        onMetric={setMetric}
        series={series}
        delta={tile?.delta}
        goodWhen={tile?.goodWhen}
        format={format}
        rangeLabel={rangeLabel}
        loading={metric === "closes" && seriesLoading}
      />
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
    </>
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
