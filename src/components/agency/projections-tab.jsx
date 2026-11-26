"use client";

import { useMemo } from "react";
import Link from "next/link";
import getSymbolFromCurrency from "currency-symbol-map";
import { Info, Wallet } from "lucide-react";
import { Button, Card, EmptyState, Notice, Pill, Skeleton, Table, TableBody, TableHead, TableScroll, Td, Th, Tr, cn } from "@/components/by";
import { SectionPage } from "@/components/agency/section-page";
import { resolveSection } from "@/components/agency/sections";
import { useMoney } from "@/components/agency/section-parts";
import { PACE_WORDS, pacingOf, runsOutWords } from "@/lib/budget-pacing";
import { useClientGroups } from "@/lib/useClientGroups";

const TONE_TEXT = { danger: "text-by-danger", warning: "text-by-warning", success: "text-by-success", neutral: "text-by-text" };
const LINK = "font-semibold text-by-text-2 underline decoration-by-line-strong underline-offset-3 hover:text-by-accent";
const pct = (n) => `${Math.round(n)}%`;

/** Spend against the budget: what's spent today (solid), where this pace ends the month (light), the budget's mark. */
function Progress({ title, soFar, pace, goal, show, month }) {
  const max = Math.max(goal || 0, pace, soFar, 1);
  const at = (n) => `${Math.min(100, (n / max) * 100)}%`;
  const paceEnd = pace / max > 0.7;
  return (
    <Card className="px-5 pt-4 pb-5 sm:px-6" aria-label={`${title} against the budget`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-by-body-sm">
        <span className="font-semibold text-by-text-2">{title}</span>
        {goal > 0 && <span className="text-by-muted">Budget <b className="font-semibold text-by-text tabular-nums">{show(goal)}</b></span>}
      </div>
      <div className="relative mt-3 mb-3 sm:mb-12">
        <div className="relative h-3 overflow-hidden rounded-full bg-by-sunken">
          <i className="absolute inset-y-0 left-0 rounded-full bg-by-accent-line transition-[width] duration-(--by-dur-enter) ease-by-out motion-reduce:transition-none" style={{ width: at(pace) }} />
          <i className="absolute inset-y-0 left-0 rounded-full bg-by-accent transition-[width] duration-(--by-dur-enter) ease-by-out motion-reduce:transition-none" style={{ width: at(soFar) }} />
        </div>
        {goal > 0 && <span aria-hidden="true" className="absolute -top-1.5 h-6 w-0.5 -translate-x-full rounded-full bg-by-text" style={{ left: at(goal) }} />}
        <span className={cn("absolute top-5 hidden flex-col text-by-caption whitespace-nowrap text-by-muted sm:flex", soFar / max < 0.2 ? "items-start" : "-translate-x-full items-end")} style={{ left: at(soFar) }}>
          Today · {month.day} {month.name.slice(0, 3)}<b className="text-by-body-lg font-semibold text-by-text tabular-nums">{show(soFar)}</b>
        </span>
        <span className={cn("absolute top-5 hidden flex-col text-by-caption whitespace-nowrap text-by-muted sm:flex", paceEnd ? "-translate-x-full items-end" : "items-start")} style={{ left: at(pace) }}>
          On pace for · {month.days} {month.name.slice(0, 3)}<b className="text-by-body-lg font-semibold text-by-text tabular-nums">{show(pace)}</b>
        </span>
      </div>
      {/* On a phone the two labels would collide under the bar: they sit side by side instead. */}
      <div className="flex justify-between gap-3 text-by-caption text-by-muted sm:hidden">
        <span className="flex flex-col">Today · {month.day} {month.name.slice(0, 3)}<b className="text-by-body-lg font-semibold text-by-text tabular-nums">{show(soFar)}</b></span>
        <span className="flex flex-col items-end">On pace for · {month.days} {month.name.slice(0, 3)}<b className="text-by-body-lg font-semibold text-by-text tabular-nums">{show(pace)}</b></span>
      </div>
    </Card>
  );
}

/** A gap as a signed figure: "+£1,120" or "−£300". */
const signed = (n, show) => (Math.abs(n) < 0.005 ? show(0) : `${n > 0 ? "+" : "−"}${show(Math.abs(n))}`);

/** The month in four numbers: so far, on pace for, the target, and the gap. */
function Sheet({ totals, money, month }) {
  const count = (n) => Math.round(n).toLocaleString("en-GB");
  const rows = [
    {
      key: "spend", label: "Ad spend", hero: true, soFar: money.money(totals.spend), pace: money.money(totals.projected), target: money.money(totals.budget),
      gap: signed(totals.projected - totals.budget, money.money), tone: PACE_WORDS[totals.status].tone,
    },
    {
      key: "leads", label: "Leads", soFar: count(totals.leads), pace: count(totals.projectedLeads),
      target: totals.leadTarget ? count(totals.leadTarget) : "—",
      gap: totals.leadTarget ? signed(Math.round(totals.projectedLeads - totals.leadTarget), count) : "—",
      tone: !totals.leadTarget ? "neutral" : totals.projectedLeads >= totals.leadTarget ? "success" : "danger",
    },
    {
      key: "cpl", label: "Cost per lead", soFar: totals.cpl != null ? money.money2(totals.cpl) : "—", pace: totals.cpl != null ? money.money2(totals.cpl) : "—",
      target: totals.cplTarget ? money.money2(totals.cplTarget) : "—",
      gap: totals.cplTarget && totals.cpl != null ? signed(totals.cpl - totals.cplTarget, money.money2) : "—",
      tone: !totals.cplTarget || totals.cpl == null ? "neutral" : totals.cpl <= totals.cplTarget ? "success" : "danger",
    },
  ];
  return (
    <TableScroll>
      <Table aria-label={`${month.name}: so far, on pace for, the target and the gap`}>
        <TableHead>
          <tr>
            <Th className="w-[28%]">This month</Th>
            <Th numeric title={`Day ${month.day} of ${month.days}`}>So far</Th>
            <Th numeric title={`Spend and leads so far, carried in a straight line to all ${month.days} days`}>On pace for</Th>
            <Th numeric>Target</Th>
            <Th numeric>Gap</Th>
          </tr>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <Tr key={r.key} className={r.hero ? "bg-by-canvas" : undefined}>
              <Td className={cn("font-semibold", r.hero && "h-16 text-by-body-lg")}><span>{r.label}</span></Td>
              <Td numeric className={r.hero ? "font-by-display text-[length:1.2rem] font-semibold" : undefined}>{r.soFar}</Td>
              <Td numeric className={r.hero ? "font-by-display text-[length:1.2rem] font-semibold" : undefined}>{r.pace}</Td>
              <Td numeric className={cn("font-semibold", r.hero && "font-by-display text-[length:1.2rem] font-bold")}>{r.target}</Td>
              <Td numeric className={cn("font-semibold", TONE_TEXT[r.tone], r.hero && "font-by-display text-[length:1.2rem]")}>{r.gap}</Td>
            </Tr>
          ))}
        </TableBody>
      </Table>
    </TableScroll>
  );
}

/** Every client's pacing: the tool's own table, budgets first, furthest ahead of pace first. */
function ClientsTable({ clients, money }) {
  return (
    <section aria-labelledby="pj-clients" className="flex flex-col gap-2.5">
      <h3 id="pj-clients" className="px-0.5 font-by-display text-by-body-lg font-semibold">Client by client</h3>
      <TableScroll className="max-h-[520px]">
        <Table aria-label="Each client's spend against its monthly budget">
          <TableHead>
            <tr>
              <Th>Client</Th>
              <Th numeric>Spent so far</Th>
              <Th numeric>Budget</Th>
              <Th numeric title="Share of the budget spent, against the share of the month gone">Used</Th>
              <Th numeric>On pace for</Th>
              <Th>Pace</Th>
              <Th>Budget runs out</Th>
            </tr>
          </TableHead>
          <TableBody>
            {clients.map((c) => {
              const words = PACE_WORDS[c.status];
              return (
                <Tr key={c.id}>
                  <Td primary className="max-w-[240px] truncate">
                    <Link href={`/clients/${encodeURIComponent(c.id)}`} className="hover:text-by-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent">{c.name}</Link>
                  </Td>
                  <Td numeric>{money.money(c.spend)}</Td>
                  <Td numeric>{c.budget ? money.money(c.budget) : <span className="text-by-muted">—</span>}</Td>
                  <Td numeric>{c.used_pct != null ? <>{pct(c.used_pct)} <span className="text-by-muted">of {pct(c.expected_pct)}</span></> : <span className="text-by-muted">—</span>}</Td>
                  <Td numeric>{money.money(c.projected)}</Td>
                  <Td><Pill tone={words.tone}>{words.label}</Pill></Td>
                  <Td className="text-by-text-2">{runsOutWords(c.runs_out_on) ?? <span className="text-by-muted">—</span>}</Td>
                </Tr>
              );
            })}
          </TableBody>
        </Table>
      </TableScroll>
    </section>
  );
}

function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading projections" className="flex flex-col gap-[18px]">
      <Skeleton className="h-3 w-56" />
      <Skeleton className="h-7 w-96 max-w-full" />
      <Skeleton className="h-28 w-full rounded-by-lg" />
      <Skeleton className="h-48 w-full rounded-by-lg" />
    </div>
  );
}

/** The page body: this month's budget pacing for the agency, or for the client the address narrows it to. */
export function BuyerProjections({ client }) {
  const { clientGroups, loading, error, refresh } = useClientGroups("this_month", { includeDaily: false });
  const groups = client ? clientGroups.filter((g) => g.id === client.id) : clientGroups;
  const p = useMemo(() => pacingOf(groups), [groups]);
  const currency = groups.find((g) => g.facebook?.currency)?.facebook?.currency || groups.find((g) => g.ad_account_currency)?.ad_account_currency || "GBP";
  const money = useMoney(getSymbolFromCurrency(currency) || "£");
  const { month, totals, clients } = p;

  if (loading && !clientGroups.length) return <Loading />;
  if (error && !clientGroups.length) {
    return <Notice tone="danger" action={<Button size="sm" onClick={refresh}>Retry</Button>}>Couldn’t load this month’s spend. Check your connection and try again.</Notice>;
  }
  if (!clients.length) {
    return (
      <Card>
        <EmptyState icon={<Wallet />} title="No clients to pace">Add a client with a Meta ad account and its spend this month shows here.</EmptyState>
      </Card>
    );
  }

  const all = clients.reduce((t, c) => ({ spend: t.spend + c.spend, projected: t.projected + c.projected }), { spend: 0, projected: 0 });
  const status = totals ? PACE_WORDS[totals.status] : null;
  const gap = totals ? totals.projected - totals.budget : 0;
  const caption = `${month.name} · day ${month.day} of ${month.days} · ${client ? client.name : `${clients.length} ${clients.length === 1 ? "client" : "clients"}`}`;

  return (
    <>
      <p className="px-0.5 text-by-body-sm font-semibold text-by-text-2">{caption}</p>
      <div className="px-0.5">
        {totals ? (
          <>
            <h2 className="font-by-display text-[length:2rem] leading-[1.15] font-bold tracking-[-0.02em] text-balance">
              <span className={TONE_TEXT[status.tone]}>{status.label}</span> for {client ? "its" : "a"} {money.money(totals.budget)} budget
            </h2>
            <p className="mt-2 text-by-body-lg text-by-text-2">
              On pace for <b className="font-semibold text-by-text tabular-nums">{money.money(totals.projected)}</b> in {month.name}, {money.money(Math.abs(gap))} {gap >= 0 ? "over" : "under"} {client ? "its budget" : "the budgets"}.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-by-display text-[length:2rem] leading-[1.15] font-bold tracking-[-0.02em] text-balance">On pace for {money.money(all.projected)} in {month.name}</h2>
            <p className="mt-2 text-by-body-lg text-by-text-2">{client ? `${client.name} has no monthly budget` : "No client has a monthly budget yet"}, so there is nothing to pace against.</p>
          </>
        )}
        <p className="mt-2 text-by-body text-by-muted">
          A straight line from {money.money(totals ? totals.spend : all.spend)} spent in {month.elapsed} days, carried to all {month.days}.
          {totals && !client && ` Budgets are each client’s monthly spend target; ${totals.clients} of ${clients.length} ${clients.length === 1 ? "client has" : "clients have"} one.`}
          {" "}Set budgets in each <Link href={client ? `/clients/${encodeURIComponent(client.id)}` : "/clients"} className={LINK}>client’s targets</Link>.
        </p>
      </div>

      {totals && (
        <>
          <Progress title={`Ad spend in ${month.name}`} soFar={totals.spend} pace={totals.projected} goal={totals.budget} show={money.money} month={month} />
          <Sheet totals={totals} money={money.format} month={month} />
        </>
      )}

      {!client && <ClientsTable clients={clients} money={money} />}

      <p className="flex items-start gap-1.5 px-0.5 text-by-body-sm text-by-muted">
        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span>
          On pace for = spent so far ÷ days gone × days in the month, counting today as half a day (the figures include part of it). It assumes the rest of the month spends at the same daily rate; it is not a forecast.
          {totals?.leadTarget ? " The lead target is each budget ÷ its CPL target." : ""}
        </span>
      </p>
    </>
  );
}

/** Marketing Guru › Projections. Only Marketing Guru has one: budget pacing is the only projection Birdy computes. */
export function ProjectionsTab({ section: which = "buyer" }) {
  const section = resolveSection(which);
  return (
    <SectionPage section={section} tab="projections" placeholder={`Ask ${section.kit.name} about this month’s spend`}>
      {(client) => <BuyerProjections client={client} />}
    </SectionPage>
  );
}
