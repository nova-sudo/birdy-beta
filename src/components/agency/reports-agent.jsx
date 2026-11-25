"use client";

import Link from "next/link";
import { ArrowUpRight, Megaphone } from "lucide-react";
import { Button, Card, EmptyState, Notice, Pill, Skeleton, buttonVariants } from "@/components/by";
import { CardSection, Crumbs, Fact, Facts, PageTitle } from "@/components/agency/section-page";
import { ReportList, ReportRow } from "@/components/agency/report-row";
import { agentSchedule, buyerReports, runLine, runsOf } from "@/lib/agency-reports";
import { useAgent } from "@/lib/agents-api";
import { zonedParts } from "@/lib/report-schedule";
import { STOCK_AGENT_PATH, STOCK_SETUP_PATH, useLatestRun, useRuns, useStockAgent } from "@/lib/stock-agent-api";

const LIST = "/media-buyer/reports";
const runHref = (id) => `${STOCK_AGENT_PATH}?run=${encodeURIComponent(id)}`;
const SETTINGS = `${STOCK_AGENT_PATH}?tab=settings`;
const LINK = "font-semibold text-by-text-2 underline decoration-by-line-strong underline-offset-3 hover:text-by-accent";

/** What each report's runs show. Taken from the agent's own description of its reports (backend ai/agents/stock). */
const SHOWS = {
  morning: [
    "The clients in that day's batch, each against its green and red CPL lines.",
    "The changes Birdy suggests for each one, for you to apply or dismiss.",
    "Alerts across every client, every day, batch or not.",
  ],
  weekly: [
    "Last Monday to Sunday against the week before: leads, CPL and ad spend for every client with zones.",
    "Clients in the red, each with one reason, and clients that changed zone or stopped spending.",
    "The three biggest drops in CPL.",
  ],
};

/** The Media Buying Agent, its full record (settings and schedule) and its newest run. */
function useBuyerAgent() {
  const { agent: listed, error, isLoading, mutate } = useStockAgent();
  const { agent: full, isLoading: fullLoading } = useAgent(listed?.id);
  const agent = full ?? listed;
  const latest = useLatestRun(agent?.id);
  return { agent, latest, loading: isLoading || (listed && fullLoading && !full), error, retry: () => mutate() };
}

/** The status pill of the agent's report: off, run today, or waiting for its next run. */
function statusOf(report, latest, agent) {
  if (!report.on) return { tone: "neutral", label: agent?.status === "draft" ? "Not set up" : "Off" };
  const today = zonedParts(new Date(), agentSchedule(agent).tz);
  const iso = `${today.y}-${String(today.m).padStart(2, "0")}-${String(today.d).padStart(2, "0")}`;
  if (report.key === "morning" && latest?.local_date === iso) return { tone: "success", label: "Ran today" };
  return { tone: "accent", label: "Scheduled" };
}

function Loading() {
  return (
    <Card aria-busy="true" aria-label="Loading reports">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2 border-b border-by-line px-5 py-5 last:border-b-0">
          <Skeleton className="h-3.5 w-48" />
          <Skeleton className="w-72" />
        </div>
      ))}
    </Card>
  );
}

/** With no agent, or one still in setup, there are no reports: say where to start. */
function NoAgent({ agent }) {
  const draft = agent?.status === "draft";
  return (
    <Card>
      <EmptyState
        icon={<Megaphone />}
        title={draft ? "Finish setting up the Media Buying Agent" : "Set up the Media Buying Agent"}
        action={<Link href={STOCK_SETUP_PATH} className={buttonVariants({ kind: "primary" })}>{draft ? "Finish setup" : "Set it up"}</Link>}
      >
        Its morning report checks your clients against their CPL zones every day and posts what needs you to Slack.
      </EmptyState>
    </Card>
  );
}

/** Marketing Guru › Reports: the Media Buying Agent's morning report, and its weekly one when it is on. */
export function AgentReportsList({ client }) {
  const { agent, latest, loading, error, retry } = useBuyerAgent();

  let body;
  if (loading) body = <Loading />;
  else if (error) body = <Notice tone="danger" action={<Button size="sm" onClick={retry}>Retry</Button>}>Couldn’t load the agent’s reports. Check your connection and try again.</Notice>;
  else if (!agent || agent.status === "draft") body = <NoAgent agent={agent} />;
  else {
    const reports = buyerReports(agent, latest.run);
    body = (
      <ReportList label="The agent's reports">
        {reports.map((r) => (
          <ReportRow
            key={r.key}
            href={`${LIST}/${r.key}`}
            name={r.name}
            what={r.what}
            when={`${r.when} · ${r.channel}`}
            status={statusOf(r, latest.run, agent)}
            channel={r.channel}
            next={r.next}
            last={r.last}
            off={!r.on}
          />
        ))}
      </ReportList>
    );
  }

  return (
    <>
      <PageTitle title="Reports">
        {client ? `These cover all your clients, ${client.name} included. ` : ""}
        To change when they run or where they go, open the <Link href={SETTINGS} className={LINK}>agent’s settings</Link>.
      </PageTitle>
      {body}
    </>
  );
}

/** A report's runs, newest first; each opens the full report in the agent's page. */
function Runs({ agent, reportKey }) {
  const { runs, hasOlder, loadOlder, error, isLoading, mutate } = useRuns(agent.id);
  const mine = runsOf(reportKey, runs, agent);
  const batches = agentSchedule(agent).batches;
  return (
    <Card>
      <div className="flex items-baseline gap-2.5 border-b border-by-line px-5 py-4">
        <h3 className="font-by-display text-by-body-lg font-semibold">Runs</h3>
        <span className="text-by-body-sm text-by-muted">{reportKey === "weekly" ? "The morning reports it was built in, newest first" : "Newest first"}</span>
      </div>
      {error ? (
        <div className="p-4"><Notice tone="danger" action={<Button size="sm" onClick={() => mutate()}>Retry</Button>}>Couldn’t load the runs.</Notice></div>
      ) : isLoading ? (
        <div className="flex flex-col gap-3 px-5 py-5"><Skeleton className="w-40" /><Skeleton className="w-64" /></div>
      ) : !mine.length ? (
        <p className="px-5 py-5 text-by-body text-by-text-2">No runs yet. The first one comes at the next scheduled time.</p>
      ) : (
        <ul aria-label="Runs">
          {mine.map((run) => {
            const r = runLine(run, batches);
            return (
              <li key={run.id} className="border-b border-by-line last:border-b-0">
                <Link href={runHref(run.id)} className="group flex items-center gap-3 px-5 py-3.5 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-by-accent">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="font-semibold text-by-text group-hover:text-by-accent">{r.title}</b>
                    <span className="text-by-body-sm text-by-text-2">{r.line}</span>
                  </span>
                  {r.state && <Pill tone={r.state.tone}>{r.state.label}</Pill>}
                  <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-by-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {hasOlder && !error && (
        <div className="border-t border-by-line px-5 py-3"><Button kind="ghost" size="sm" onClick={loadOlder}>Show older runs</Button></div>
      )}
    </Card>
  );
}

/** One of the agent's reports: its schedule, what each run shows, and its runs. */
export function AgentReportPage({ reportKey }) {
  const { agent, latest, loading, error, retry } = useBuyerAgent();
  const crumbs = (label) => <Crumbs parts={[{ label: "Reports", href: LIST }, { label }]} />;
  if (loading) return <>{crumbs("Report")}<Loading /></>;
  if (error) return <Notice tone="danger" action={<Button size="sm" onClick={retry}>Retry</Button>}>Couldn’t load this report. Check your connection and try again.</Notice>;
  if (!agent || agent.status === "draft") return <>{crumbs("Report")}<NoAgent agent={agent} /></>;
  const report = buyerReports(agent, latest.run).find((r) => r.key === reportKey);
  if (!report) {
    return (
      <>
        {crumbs("Not found")}
        <Card>
          <EmptyState icon={<Megaphone />} title="This report isn’t on" action={<Link href={LIST} className={buttonVariants({ kind: "secondary" })}>See all reports</Link>}>
            {reportKey === "weekly" ? <>Turn on the weekly message in the <Link href={SETTINGS} className={LINK}>agent’s settings</Link>.</> : "There is no report here."}
          </EmptyState>
        </Card>
      </>
    );
  }
  const status = statusOf(report, latest.run, agent);
  return (
    <>
      {crumbs(report.name)}
      <PageTitle title={report.name} aside={<Pill tone={status.tone}>{status.label}</Pill>}>{report.what}</PageTitle>
      <Card className={report.on ? undefined : "opacity-70"}>
        <CardSection title="Schedule">
          <Facts>
            <Fact label="When">{report.when}</Fact>
            <Fact label={report.key === "weekly" ? "Posting" : "Clients"}>{report.detail}</Fact>
            <Fact label="Goes to">{report.goesTo}</Fact>
            <Fact label="Next run">{report.next ?? (report.on ? "—" : "Off: the agent isn’t running")}</Fact>
            {report.key === "morning" && <Fact label="Last run">{report.last ?? "Not run yet"}</Fact>}
          </Facts>
        </CardSection>
        <CardSection title="What it shows">
          <p className="mb-2 text-by-body-sm text-by-muted">Each run shows</p>
          <ul className="grid list-disc gap-1.5 pl-5 text-by-body text-by-text-2 marker:text-by-muted">
            {SHOWS[report.key].map((line) => <li key={line}>{line}</li>)}
          </ul>
        </CardSection>
      </Card>
      <Runs agent={agent} reportKey={report.key} />
      <p className="px-0.5 text-by-body-sm text-by-muted">
        To change this report, open the <Link href={SETTINGS} className={LINK}>agent’s settings</Link>.
      </p>
    </>
  );
}
