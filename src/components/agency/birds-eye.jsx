"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Calendar, Check, CheckCircle2, Link2, MessageSquare, Phone, Users } from "lucide-react";
import {
  AskBar, AskPanel, Button, Card, Delta, DropdownTrigger, EmptyState, Funnel, KpiTile, LineChart, Menu, MenuContent, MenuItem, MenuTrigger, Notice,
  RankList, SECTIONS, SectionHeader, Skeleton, TabPill,
} from "@/components/by";
import { usePortfolioData } from "@/app/dashboard/usePortfolioData";
import { ChatThread } from "@/components/agency/chat/thread";
import { useAgentChat } from "@/components/agency/chat/use-agent-chat";
import { opsTabHref, useOpsTabs } from "@/components/agency/tabs";
import { OPS_SECTION } from "@/components/agency/sections";
import { SectionMore } from "@/components/agency/section-more";
import { useStoredUser } from "@/components/shell/account-menu";
import { clientDetailHref, clientHref } from "@/components/shell/nav";
import { CHART_COPY, buildFinding, buildTiles, chartKeys, greeting, rankCampaigns } from "@/lib/birds-eye";
import { isActive } from "@/lib/client-status";
import { statusOf } from "@/lib/clients-list";
import { DATE_PRESETS, DEFAULT_DATE_PRESET } from "@/lib/constants";
import { buildFunnel, buildLeaderboards } from "@/lib/portfolio-aggregate";
import { diagnoseFunnel } from "@/lib/portfolio-metrics";

const OPS = SECTIONS.find((s) => s.id === "ops");
const STATUS_WORDS = { danger: "At risk", warning: "At risk", ok: "On track", off: "Inactive" };
const FUNNEL_PARTS = {
  leads: { label: "Meta leads", icon: <Users /> },
  engaged: { label: "In CRM", icon: <Link2 /> },
  called: { label: "Called", icon: <Phone /> },
  closes: { label: "Closed", icon: <Check /> },
};
const NOTE_TONE = { bad: "text-by-danger", good: "text-by-success" };

/** "Last 7 Days" -> "Last 7 days". */
const sentence = (label) => label.charAt(0) + label.slice(1).toLowerCase();

/**
 * Birdy's first view: the headline figures, the per-day chart, who is doing
 * best and where leads are being lost. With `?client=<id>` in the address it is
 * the same page fed one client's numbers.
 */
export function BirdsEye() {
  const router = useRouter();
  const tabs = useOpsTabs();
  const pathname = usePathname();
  const search = useSearchParams();
  const clientId = search.get("client") || null;
  const requested = search.get("range");
  const preset = DATE_PRESETS.some((p) => p.value === requested) ? requested : DEFAULT_DATE_PRESET;
  const rangeLabel = sentence(DATE_PRESETS.find((p) => p.value === preset).label);
  const scoped = clientId != null;

  const keys = chartKeys(scoped);
  const [metric, setMetric] = useState("leads");
  const chartMetric = keys.includes(metric) ? metric : "leads";

  const data = usePortfolioData({ preset, granularity: "Daily", chartMetric, clientId });
  const { current, previous, client, chartMetrics, hasCallCentre, hasClients, loading, seriesLoading, error, clientCount } = data;
  const user = useStoredUser();
  const [hour, setHour] = useState(null);
  useEffect(() => setHour(new Date().getHours()), []);

  // The ask bar: the first question opens the conversation beside the page. Each client has its own thread.
  const chat = useAgentChat({
    sessionKey: `by_ops_ask_${clientId ?? "agency"}`,
    page: scoped ? "client_detail" : "dashboard",
    // The Birdy section talks to Birdy, the orchestrator.
    agent: "birdy",
    client: client && isActive(client) ? { id: client.id, name: client.name } : null,
  });
  const [asking, setAsking] = useState(false);
  const ask = (text) => {
    setAsking(true);
    chat.send(text);
  };

  // The address carries the range and the client, so a link to this page opens the same view.
  const withQuery = (changes) => {
    const next = new URLSearchParams(search.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value == null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const money = useMemo(() => {
    const symbol = chartMetrics.spend?.valuePrefix ?? "";
    return (n, decimals = 0) => `${symbol}${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }, [chartMetrics.spend?.valuePrefix]);
  const FORMAT = useMemo(() => ({
    money: (n) => money(n),
    money2: (n) => money(n, 2),
    count: (n) => Math.round(n).toLocaleString("en-GB"),
    percent: (n) => `${Math.round(n)}%`,
  }), [money]);

  const cplTarget = client?.targets?.cpl ?? null;
  const tiles = useMemo(
    () => buildTiles({ current, previous, preset, hasCallCentre, scoped, cplTarget, money }),
    [current, previous, preset, hasCallCentre, scoped, cplTarget, money],
  );
  const finding = useMemo(
    () => (scoped ? null : buildFinding({ current, previous, preset, hasCallCentre })),
    [scoped, current, previous, preset, hasCallCentre],
  );

  // A step nobody can measure (no call centre) keeps its place but carries no change, so the verdict never names it.
  const stages = useMemo(
    () => buildFunnel(current, previous).map((s) => (s.key === "called" && !hasCallCentre ? { ...s, count: "—", share: null, direction: undefined, delta: undefined, muted: true } : s)),
    [current, previous, hasCallCentre],
  );
  const diagnosis = useMemo(() => (stages.length ? diagnoseFunnel(stages) : null), [stages]);

  const topClients = useMemo(
    () => (buildLeaderboards(current, money)["Avg CPL"] ?? []).map((row) => ({ ...row, href: `${clientHref(row.id)}${preset === DEFAULT_DATE_PRESET ? "" : `&range=${preset}`}` })),
    [current, money, preset],
  );
  const campaigns = useMemo(
    () => rankCampaigns(client?.facebook?.campaigns, { cplTarget, money }).map((row) => ({ ...row, value: money(row.cpl, 2) })),
    [client, cplTarget, money],
  );

  const series = chartMetrics[chartMetric];
  const copy = CHART_COPY[chartMetric];
  const tile = tiles.find((t) => t.key === chartMetric);
  const chartLoading = seriesLoading || series?.loading || series?.pending;
  const noCalls = chartMetric === "calls" && !hasCallCentre;

  const subtitle = scoped && client
    ? <>Scoped to <b className="font-semibold text-by-text">{client.name}</b> · {STATUS_WORDS[statusOf(client)]}</>
    : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-by-canvas font-by-body text-by-body text-by-text selection:bg-by-accent-line selection:text-by-text">
      <SectionHeader
        section={OPS}
        subtitle={subtitle}
        tabs={tabs}
        tab="birdseye"
        more={<SectionMore section={OPS_SECTION} tab="birdseye" />}
        onTabChange={(value) => value !== "birdseye" && router.push(opsTabHref(value, search))}
        dateRange={
          <Menu>
            <MenuTrigger asChild>
              <DropdownTrigger leading={<Calendar aria-hidden="true" />} aria-label={`Date range: ${rangeLabel}`}>
                <span className="font-semibold">{rangeLabel}</span>
              </DropdownTrigger>
            </MenuTrigger>
            <MenuContent align="end" className="max-h-80 overflow-y-auto">
              {DATE_PRESETS.map((p) => (
                <MenuItem key={p.value} selected={p.value === preset} onSelect={() => router.replace(withQuery({ range: p.value === DEFAULT_DATE_PRESET ? null : p.value }))}>
                  {sentence(p.label)}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        }
      />

      {/* The page and, once a question is asked, the conversation beside it. */}
      <div className="flex min-h-0 flex-1">
      <div className="relative flex min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-6 pb-28">
        <div className="flex flex-col gap-3.5">
          <div>
            <div className="flex items-center gap-3 text-by-body-sm font-medium text-by-text-2">
              <span>{rangeLabel} · {scoped ? client?.name ?? "Client" : `${clientCount} client${clientCount === 1 ? "" : "s"}`}</span>
              {scoped && client && (
                <Link href={clientDetailHref(client.id)} className="ml-auto inline-flex items-center gap-1 rounded-by-sm font-semibold text-by-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent">
                  Open client page<ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              )}
            </div>
            {!scoped && (
              <h2 className="mt-1.5 font-by-display text-[length:2.25rem] leading-[1.2] font-bold tracking-[-0.01em] text-balance">
                {hour == null ? "Hello" : greeting(hour)}{user.name ? `, ${user.name.split(" ")[0]}` : ""}.
              </h2>
            )}
          </div>

          {error ? (
            <Notice tone="danger">Couldn’t load these figures. Check your connection and refresh the page.</Notice>
          ) : loading ? (
            <LoadingBody />
          ) : scoped && !client ? (
            <Card><EmptyState icon={<Users />} title="This client isn’t in your account">It may have been removed. Pick another from the switcher at the top of the rail.</EmptyState></Card>
          ) : scoped && !isActive(client) ? (
            <Card><EmptyState icon={<Users />} title={`${client.name} is inactive`}>Inactive clients are left out of the figures. Set the client active on its page to see them here.</EmptyState></Card>
          ) : !hasClients ? (
            <Card><EmptyState icon={<Users />} title="No active clients yet">Add or import a client from the Clients page and its figures appear here.</EmptyState></Card>
          ) : (
            <>
              {finding && (
                <p className="-mt-0.5 mb-2 text-[length:1.0625rem] leading-[1.6] text-by-text-2 text-pretty">
                  <b className="font-semibold text-by-text underline decoration-by-line-strong underline-offset-[3px]">{finding.lead}</b>{finding.rest}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                {tiles.map((t) => (
                  <KpiTile
                    key={t.key}
                    size="lg"
                    label={t.label}
                    value={t.value}
                    format={FORMAT[t.kind]}
                    delta={t.delta != null && <Delta value={t.delta} goodWhen={t.goodWhen} />}
                    note={t.note && <span className={NOTE_TONE[t.noteTone]}>{t.note}</span>}
                  />
                ))}
              </div>

              <Card className="px-5 py-4.5">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2.5">
                  <div className="min-w-0">
                    <h3 className="text-by-body-lg font-semibold">{copy.title}</h3>
                    <p className="text-by-body-sm text-by-muted">{series?.previousValues ? `${rangeLabel}, against the period before (dashed)` : rangeLabel}</p>
                  </div>
                  <div className="ml-auto">
                    <TabPill
                      aria-label="Chart figure"
                      items={keys.map((key) => ({ value: key, label: CHART_COPY[key].tab }))}
                      value={chartMetric}
                      onValueChange={setMetric}
                    />
                  </div>
                </div>
                {noCalls ? (
                  <EmptyState icon={<Phone />} title="No call data">None of your active clients has a call centre connected.</EmptyState>
                ) : chartLoading ? (
                  <Skeleton className="mt-4 h-[220px] w-full rounded-by-md" />
                ) : !series?.values?.length ? (
                  <EmptyState icon={<Calendar />} title="Nothing to plot for this range">Try a longer date range.</EmptyState>
                ) : (
                  <>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-by-display text-[length:1.75rem] leading-[1.15] font-semibold tracking-[-0.01em] tabular-nums">{series.total}</span>
                      {tile?.delta != null && <Delta value={tile.delta} goodWhen={tile.goodWhen} />}
                    </div>
                    <LineChart
                      key={chartMetric}
                      className="mt-1 motion-safe:animate-[by-fade_var(--by-dur-base)_var(--by-ease-out)]"
                      aria-label={`${copy.title}, ${rangeLabel.toLowerCase()}`}
                      values={series.values}
                      previous={series.previousValues ?? undefined}
                      labels={series.labels}
                      pointLabels={series.tooltipLabels}
                      format={FORMAT[copy.kind]}
                      integers={copy.kind === "count"}
                    />
                  </>
                )}
              </Card>

              <div className="grid gap-3.5 lg:grid-cols-2">
                <Card className="px-5 py-4.5">
                  {scoped ? (
                    <>
                      <h3 className="text-by-body-lg font-semibold">{client.name}’s campaigns, by cost per lead</h3>
                      <p className="text-by-body-sm text-by-muted">{cplTarget > 0 ? `Limit ${money(cplTarget, 2)} a lead` : "Cheapest first"}</p>
                      {campaigns.length ? <RankList className="mt-2" numbered={false} items={campaigns} /> : (
                        <EmptyState title="No campaign spend in this range">Campaigns appear here once they spend and bring in a lead.</EmptyState>
                      )}
                    </>
                  ) : (
                    <>
                      <h3 className="text-by-body-lg font-semibold">Top performing clients</h3>
                      <p className="text-by-body-sm text-by-muted">Lowest cost per lead</p>
                      {topClients.length ? <RankList className="mt-2" items={topClients} /> : (
                        <EmptyState title="No leads in this range">Clients are ranked once they have spend and leads.</EmptyState>
                      )}
                    </>
                  )}
                </Card>

                <Card className="px-5 py-4.5">
                  <h3 className="text-by-body-lg font-semibold">Performance funnel</h3>
                  {stages.length ? (
                    <>
                      <Funnel
                        className="mt-4"
                        stages={stages.map((s) => ({
                          key: s.key,
                          ...FUNNEL_PARTS[s.key],
                          value: s.count,
                          muted: s.muted,
                          note: s.muted ? "No call centre" : Number.isFinite(s.delta)
                            ? <Delta value={s.direction === "down" ? -s.delta : s.delta} goodWhen="up" />
                            : s.share ? `${s.share} of leads` : null,
                        }))}
                      />
                      {diagnosis && (
                        <Notice
                          className="mt-4 items-start"
                          tone={diagnosis.state === "problem" ? "danger" : "success"}
                          icon={diagnosis.state === "problem" ? <AlertTriangle aria-hidden="true" className="mt-0.5" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5" />}
                        >
                          <b className="block font-by-display font-semibold">{diagnosis.title}</b>
                          {diagnosis.body && <span className="text-by-text-2">{diagnosis.body}</span>}
                        </Notice>
                      )}
                    </>
                  ) : (
                    <EmptyState title="The funnel isn’t ready for this range">It fills in once leads for these dates have been matched to your CRM.</EmptyState>
                  )}
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-7 pb-5">
        <AskBar
          className="pointer-events-auto"
          placeholder={scoped && client ? `Ask ${OPS.name} about ${client.name}` : `Ask ${OPS.name} about these numbers`}
          busy={chat.loading}
          onSubmit={ask}
        />
      </div>
      </div>
      {asking && (
        <AskPanel
          title={OPS.name}
          onClose={() => setAsking(false)}
          follow={`${chat.messages.length}-${chat.loading}`}
          actions={chat.sessionId && (
            <Button kind="ghost" size="sm" onClick={() => router.push(`${opsTabHref("chat", search)}${search.get("client") || search.get("range") ? "&" : "?"}c=${encodeURIComponent(chat.sessionId)}`)}>
              <MessageSquare aria-hidden="true" />Open in Chat
            </Button>
          )}
        >
          <ChatThread chat={chat} name={OPS.name} compact />
        </AskPanel>
      )}
      </div>
    </div>
  );
}

/** The page's shape while the figures load. */
function LoadingBody() {
  return (
    <div aria-busy="true" aria-label="Loading figures" className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="px-4 py-3.5"><Skeleton className="w-16" /><Skeleton className="mt-3 h-6 w-24" /><Skeleton className="mt-3 w-28" /></Card>
        ))}
      </div>
      <Card className="px-5 py-4.5"><Skeleton className="w-40" /><Skeleton className="mt-4 h-[220px] w-full rounded-by-md" /></Card>
      <div className="grid gap-3.5 lg:grid-cols-2">
        {[0, 1].map((i) => <Card key={i} className="px-5 py-4.5"><Skeleton className="w-44" /><Skeleton className="mt-4 h-28 w-full rounded-by-md" /></Card>)}
      </div>
    </div>
  );
}
