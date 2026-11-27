"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronRight, Megaphone, Pencil, Send } from "lucide-react";
import { Button, Card, Dialog, DialogBody, DialogContent, EmptyState, Notice, Pill, Skeleton, Switch, buttonVariants } from "@/components/by";
import { CardSection, Crumbs, Fact, Facts, PageTitle } from "@/components/agency/section-page";
import { ReportRow } from "@/components/agency/report-row";
import { ConfirmDialog, LoadingList, Preview, SlackReportsList, reportScope } from "@/components/agency/reports-slack";
import { BUYER_SECTION } from "@/components/agency/sections";
import { AgentReportDialog } from "@/components/agency/agent-report-dialog";
import { ZONES, cplText } from "@/components/agents/stock/cpl";
import { agentSchedule, buyerReports, runLine, runsOf } from "@/lib/agency-reports";
import { useAgent } from "@/lib/agents-api";
import { fetcher } from "@/lib/fetcher";
import { queryKeys } from "@/lib/query-keys";
import { zonedParts } from "@/lib/report-schedule";
import { openLines, previewSlackTemplate, testAgentReport, useLatestRun, useRun, useRuns, useStockActions, useStockAgent } from "@/lib/stock-agent-api";

/** Marketing Guru's Slack reports. */
const BUYER_REPORTS = reportScope(BUYER_SECTION);
const LIST = BUYER_REPORTS.base;

/** The keys of the agent's own reports; any other id under /media-buyer/reports is a Slack report. */
export const AGENT_REPORT_KEYS = ["morning", "weekly"];

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

/** The Slack messages each report is made of, for its preview: the morning report opens with the summary, then a card per client. */
const MESSAGES = {
  morning: [{ kind: "summary", label: "The summary" }, { kind: "card", label: "Then one message per client, like this" }],
  weekly: [{ kind: "weekly" }],
};

/** Whether the agent has been set up: a live agent, or one a person turned off. A draft still in setup has no reports yet. */
const hasReports = (agent) => Boolean(agent) && (agent.status === "active" || Boolean(agent.turned_off_at));

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
  if (!report.running) return { tone: "neutral", label: "Agent off" };
  if (!report.enabled) return { tone: "neutral", label: "Paused" };
  const today = zonedParts(new Date(), agentSchedule(agent).tz);
  const iso = `${today.y}-${String(today.m).padStart(2, "0")}-${String(today.d).padStart(2, "0")}`;
  if (report.key === "morning" && latest?.local_date === iso) return { tone: "success", label: "Ran today" };
  return { tone: "accent", label: "Scheduled" };
}

/** Turns the weekly report on or off (settings.weekly.enabled). A failed save says so. */
function WeeklySwitch({ agent, report, onError }) {
  const actions = useStockActions(agent.id);
  const [busy, setBusy] = useState(false);
  return (
    <Switch
      checked={report.enabled}
      disabled={busy}
      onCheckedChange={async (enabled) => {
        onError?.(null);
        setBusy(true);
        try {
          await actions.patchSettings({ settings: { weekly: { enabled } } });
        } catch (e) {
          onError?.(e.message || "Couldn't change that report. Try again.");
        } finally {
          setBusy(false);
        }
      }}
      aria-label={`${report.name}: ${report.enabled ? "on" : "paused"}`}
    />
  );
}

/**
 * Marketing Guru › Reports: its agent's morning and weekly reports first, then its Slack reports, with
 * New report to add one. Without the Media Buying Agent set up the list is its Slack reports only.
 */
export function AgentReportsList({ client }) {
  const { agent, latest, loading, error, retry } = useBuyerAgent();
  const [problem, setProblem] = useState(null);
  const leading = !loading && !error && hasReports(agent)
    ? buyerReports(agent, latest.run).map((r) => (
      <ReportRow
        key={r.key}
        href={`${LIST}/${r.key}`}
        name={r.name}
        what={r.what}
        when={`${r.when} · ${r.slackChannel ?? "Birdy only"}`}
        status={statusOf(r, latest.run, agent)}
        channel={r.channel}
        next={r.next}
        last={r.last}
        off={!r.on}
        control={r.key === "weekly" && r.running ? <WeeklySwitch agent={agent} report={r} onError={setProblem} /> : null}
      />
    ))
    : [];

  const notice = (
    <>
      {error && <Notice tone="danger" action={<Button size="sm" onClick={retry}>Retry</Button>}>Couldn’t load the morning and weekly reports. Check your connection and try again.</Notice>}
      {problem && <Notice tone="danger">{problem}</Notice>}
    </>
  );

  return (
    <SlackReportsList
      scope={BUYER_REPORTS}
      leading={leading}
      leadingLoading={Boolean(loading)}
      notice={notice}
      intro={`${client ? `These cover all your clients, ${client.name} included. ` : ""}Marketing Guru’s morning and weekly reports, and any Slack report you add.`}
    />
  );
}

/** One run, opened in place: what it covered, each client's zone and CPL, its alerts, and whether it reached Slack. */
function RunDialog({ agent, run, onOpenChange }) {
  const { report, error, isLoading, mutate } = useRun(agent.id, run?.id);
  const batches = agentSchedule(agent).batches;
  const line = run ? runLine(run, batches) : null;
  const cards = report?.cards ?? [];
  const alerts = Array.isArray(report?.run?.alerts) ? report.run.alerts : Array.isArray(run?.alerts) ? run.alerts : [];
  return (
    <Dialog open={Boolean(run)} onOpenChange={(open) => !open && onOpenChange(null)}>
      <DialogContent title={line ? `Morning report, ${line.title}` : "Morning report"} description={line?.line} headerAside={line?.state ? <Pill tone={line.state.tone}>{line.state.label}</Pill> : null}>
        <DialogBody className="flex flex-col gap-5">
          {error ? (
            <Notice tone="danger" action={<Button size="sm" onClick={() => mutate()}>Retry</Button>}>Couldn’t load this run.</Notice>
          ) : isLoading || !report ? (
            <div className="flex flex-col gap-3"><Skeleton className="w-48" /><Skeleton className="w-72" /><Skeleton className="w-60" /></div>
          ) : (
            <>
              {report.run?.publish_error && <Notice tone="danger">It didn’t reach Slack: {String(report.run.publish_error)}</Notice>}
              <section className="flex flex-col gap-2">
                <h3 className="font-by-display text-by-body-lg font-semibold">Clients</h3>
                {cards.length ? (
                  <ul aria-label="Clients" className="overflow-hidden rounded-by-md border border-by-line">
                    {cards.map((c) => {
                      const zone = ZONES[c.zone] ?? ZONES.no_data;
                      const open = openLines(c).length;
                      return (
                        <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-by-line px-3.5 py-2.5 last:border-b-0">
                          <b className="min-w-0 flex-1 font-semibold text-by-text">{c.client_name}</b>
                          <span className="text-by-body-sm tabular-nums text-by-text-2">CPL {cplText(c)}{c.previous_cpl != null ? ` (was ${cplText(c, "previous_cpl")})` : ""}</span>
                          <Pill tone={zone.tone}>{zone.label}</Pill>
                          {open > 0 && <Pill tone="warning" dot={false}>{open} {open === 1 ? "change waits" : "changes wait"}</Pill>}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-by-body text-by-text-2">No client was checked in this run. Other days only look for problems.</p>
                )}
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="font-by-display text-by-body-lg font-semibold">Alerts</h3>
                {alerts.length ? (
                  <ul aria-label="Alerts" className="grid list-disc gap-1.5 pl-5 text-by-body text-by-text-2 marker:text-by-muted">
                    {alerts.map((a, i) => <li key={a.id ?? i}>{a.title}{a.detail ? `: ${a.detail}` : ""}</li>)}
                  </ul>
                ) : (
                  <p className="text-by-body text-by-text-2">No alerts.</p>
                )}
              </section>
              <p className="text-by-body-sm text-by-muted">Apply or dismiss waiting changes from the message in Slack, or ask Marketing Guru in chat.</p>
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/** A report's runs, newest first; each opens in place. */
function Runs({ agent, reportKey }) {
  const { runs, hasOlder, loadOlder, error, isLoading, mutate } = useRuns(agent.id);
  const [open, setOpen] = useState(null);
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
                <button type="button" onClick={() => setOpen(run)} className="group flex w-full items-center gap-3 px-5 py-3.5 text-left outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-by-accent">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="font-semibold text-by-text group-hover:text-by-accent">{r.title}</b>
                    <span className="text-by-body-sm text-by-text-2">{r.line}</span>
                  </span>
                  {r.state && <Pill tone={r.state.tone}>{r.state.label}</Pill>}
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-by-muted" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {hasOlder && !error && (
        <div className="border-t border-by-line px-5 py-3"><Button kind="ghost" size="sm" onClick={loadOlder}>Show older runs</Button></div>
      )}
      <RunDialog agent={agent} run={open} onOpenChange={setOpen} />
    </Card>
  );
}

/**
 * One of the agent's reports, laid out like a Slack report's page: its schedule, what it shows with a
 * preview, Change, Send a test, and its runs.
 */
export function AgentReportPage({ reportKey }) {
  const { agent, latest, loading, error, retry } = useBuyerAgent();
  const { data: slack } = useSWR(queryKeys.slackStatus(), fetcher);
  const [editing, setEditing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState(null);
  const crumbs = (label) => <Crumbs parts={[{ label: "Reports", href: LIST }, { label }]} />;

  if (loading) return <>{crumbs("Report")}<LoadingList /></>;
  if (error) return <Notice tone="danger" action={<Button size="sm" onClick={retry}>Retry</Button>}>Couldn’t load this report. Check your connection and try again.</Notice>;
  const report = hasReports(agent) ? buyerReports(agent, latest.run).find((r) => r.key === reportKey) : null;
  if (!report) {
    return (
      <>
        {crumbs("Not found")}
        <Card>
          <EmptyState icon={<Megaphone />} title="This report isn’t here" action={<Link href={LIST} className={buttonVariants({ kind: "secondary" })}>See all reports</Link>}>
            {hasReports(agent) ? "There is no report here." : "The Media Buying Agent isn’t set up yet, so it has no reports."}
          </EmptyState>
        </Card>
      </>
    );
  }

  const status = statusOf(report, latest.run, agent);
  const canTest = Boolean(slack?.installed && report.slackChannel);

  const sendTest = async () => {
    setSending(true);
    setNote(null);
    try {
      const res = await testAgentReport(agent.id, report.kind);
      const figures = res?.source === "latest" ? " with the latest run's figures" : res?.source === "sample" ? " with sample figures" : "";
      setNote({ tone: "success", text: `Test sent to ${res?.channel_name ? `#${res.channel_name}` : report.slackChannel}${figures}.` });
    } catch (e) {
      setNote({ tone: "danger", text: `Not sent: ${e.message || "Try again."}` });
    } finally {
      setSending(false);
      setTesting(false);
    }
  };

  const loadPreview = () => Promise.all(MESSAGES[report.key].map(async (m) => {
    const json = await previewSlackTemplate(agent.id, m.kind);
    return { blocks: json?.blocks ?? [], sample: Boolean(json?.sample), label: MESSAGES[report.key].length > 1 ? m.label : undefined };
  }));

  return (
    <>
      {crumbs(report.name)}
      <PageTitle
        title={report.name}
        aside={
          report.key === "weekly" && report.running ? (
            <label className="inline-flex items-center gap-2 text-by-body-sm font-semibold text-by-text-2">
              {report.enabled ? "On" : "Paused"}
              <WeeklySwitch agent={agent} report={report} onError={(text) => setNote(text ? { tone: "danger", text } : null)} />
            </label>
          ) : (
            <Pill tone={status.tone}>{status.label}</Pill>
          )
        }
      >
        {report.what}
      </PageTitle>

      {note && <Notice tone={note.tone}>{note.text}</Notice>}
      {!report.running && <Notice tone="info">The Media Buying Agent is off, so this report isn’t sending. Its settings and past runs are kept.</Notice>}

      <Card className={report.on ? undefined : "opacity-70"}>
        <CardSection title="Schedule">
          <Facts>
            <Fact label="When">{report.when}</Fact>
            <Fact label={report.key === "weekly" ? "Posting" : "Clients"}>{report.detail}</Fact>
            <Fact label="Goes to">{report.goesTo}</Fact>
            <Fact label="Next run">{report.next ?? (report.running ? "Paused" : "Off: the agent isn’t running")}</Fact>
            {report.key === "morning" && <Fact label="Last run">{report.last ?? "Not run yet"}</Fact>}
          </Facts>
        </CardSection>
        <CardSection title="What it says">
          <ul className="mb-3 grid list-disc gap-1.5 pl-5 text-by-body text-by-text-2 marker:text-by-muted">
            {SHOWS[report.key].map((line) => <li key={line}>{line}</li>)}
          </ul>
          <Preview load={loadPreview} sampleNote="The preview uses sample figures. Each run fills in your clients’ real numbers." />
        </CardSection>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button kind="secondary" onClick={() => setEditing(true)}><Pencil aria-hidden="true" />Change</Button>
        <Button
          kind="secondary"
          onClick={() => setTesting(true)}
          disabled={!canTest}
          title={canTest ? undefined : slack?.installed ? "Pick a Slack channel first (Change)" : "Connect Slack first"}
        >
          <Send aria-hidden="true" />Send a test
        </Button>
      </div>

      <Runs agent={agent} reportKey={report.key} />

      <AgentReportDialog open={editing} onOpenChange={setEditing} reportKey={report.key} agent={agent} slack={slack} onSaved={() => setNote({ tone: "success", text: "Report saved." })} />
      <ConfirmDialog open={testing} onOpenChange={setTesting} title="Send a test now?" confirm="Send test" busy={sending} onConfirm={sendTest}>
        Marketing Guru posts its {report.name.toLowerCase()} to {report.slackChannel} in Slack now, marked as a test, with the latest run’s figures (or samples before the first run). Everyone in that channel will see it. It isn’t counted as a run.
      </ConfirmDialog>
    </>
  );
}
