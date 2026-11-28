"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { MessageSquareText, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { BirdyAvatar, Button, Card, Dialog, DialogBody, DialogContent, DialogFooter, EmptyState, Notice, Skeleton, Switch, buttonVariants } from "@/components/by";
import { errorLabel } from "@/components/reports/report-format";
import { useSlackReports } from "@/components/reports/useSlackReports";
import { CardSection, Crumbs, Fact, Facts, PageTitle } from "@/components/agency/section-page";
import { ReportList, ReportRow } from "@/components/agency/report-row";
import { SlackReportDialog } from "@/components/agency/slack-report-dialog";
import { Preview, reportPreview } from "@/components/agency/report-preview";
import { slackReportView } from "@/lib/agency-reports";
import { fetcher } from "@/lib/fetcher";
import { queryKeys } from "@/lib/query-keys";

/**
 * Whose reports a Reports page shows and where it lives. Every section has the same Slack reports
 * screens; only the owner (the agent the reports belong to), the address and the name differ.
 * @typedef {{owner: "birdy"|"media_buyer"|"sales_coach", base: string, name: string}} ReportScope
 */

/** @type {ReportScope} Birdy's, under Agency Ops. */
export const OPS_REPORTS = { owner: "birdy", base: "/dashboard/reports", name: "Birdy" };

/** A section's report scope (sections.js). Birdy speaks for Agency Ops; the others by their own name. */
export const reportScope = (section) => ({
  owner: section.reportOwner,
  base: section.paths.reports,
  name: section.key === "ops" ? "Birdy" : section.kit.name,
});

// The preview lives in its own file so the chat can show it without the Reports screens.
export { Preview };

const reportHref = (scope, id) => `${scope.base}/${encodeURIComponent(id)}`;

/** Slack's connection, the reports, and what their words need: alerts (for "“CPL high” fires") and the account's timezone. */
function useSlackReportData(owner) {
  const { data: slack, error: slackError, isLoading: slackLoading, mutate: retrySlack } = useSWR(queryKeys.slackStatus(), fetcher);
  const connected = Boolean(slack?.installed);
  const api = useSlackReports(owner);
  const { data: alertData } = useSWR(connected ? queryKeys.alerts() : null, fetcher);
  const { data: profile } = useSWR(connected ? "/api/user/profile" : null, fetcher);
  const alerts = useMemo(() => alertData?.alerts ?? [], [alertData]);
  const ctx = { alerts, birdyChannel: slack?.notify_channel_name ?? null, accountTz: profile?.timezone ?? null };
  return {
    slack, connected, api, alerts, ctx, accountTz: profile?.timezone ?? null,
    loading: slackLoading || (connected && api.isLoading),
    error: slackError || api.error,
    retry: () => { retrySlack(); api.retry(); },
  };
}

function ConnectSlack({ scope }) {
  return (
    <Card>
      <div className="flex flex-col items-center px-5 py-8 text-center">
        <BirdyAvatar size={56} />
        <h3 className="mt-3 font-by-display text-by-heading font-semibold">Connect Slack to get reports</h3>
        <p className="mt-1 max-w-[360px] text-by-body-sm text-by-text-2">
          {scope.owner === "birdy"
            ? "Birdy posts your daily brief, weekly round-ups and alert follow-ups straight into Slack."
            : `${scope.name} posts its reports straight into Slack, on a schedule or when something happens.`}
        </p>
        <Link href="/settings?tab=integrations" className={buttonVariants({ kind: "primary", className: "mt-4" })}>Connect Slack</Link>
      </div>
    </Card>
  );
}

export function LoadingList() {
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

/** A report's on/off switch. A failed save puts it back and says so. */
export function ReportSwitch({ report, api, onError }) {
  return (
    <Switch
      checked={Boolean(report.enabled)}
      onCheckedChange={async (on) => {
        onError?.(null);
        try {
          await api.setEnabled(report.id, on);
        } catch (e) {
          onError?.(e.message || "Couldn't change that report. Try again.");
        }
      }}
      aria-label={`${report.name}: ${report.enabled ? "on" : "paused"}`}
    />
  );
}

/**
 * A section's Reports: its agent's Slack reports, each with its status, channel, next and last run and
 * its switch, and New report to add one with that owner.
 *
 * @param {ReportScope} [props.scope] Birdy's when left out
 * @param {React.ReactNode[]} [props.leading] rows listed before the Slack reports (Marketing Guru's own reports)
 * @param {boolean} [props.leadingLoading] those rows are still loading
 * @param {React.ReactNode} [props.notice] shown above the list (a problem loading the leading rows)
 * @param {React.ReactNode} [props.intro] the line under the title
 */
export function SlackReportsList({ scope = OPS_REPORTS, leading = [], leadingLoading = false, notice = null, intro }) {
  const router = useRouter();
  const data = useSlackReportData(scope.owner);
  const { api } = data;
  const [creating, setCreating] = useState(false);
  const [problem, setProblem] = useState(null);
  const full = api.reports.length >= api.max;
  const loading = data.loading || leadingLoading;

  const newButton = data.connected && !loading && !data.error && (
    <Button kind="primary" onClick={() => setCreating(true)} disabled={full} title={full ? `You can have up to ${api.max} reports` : undefined}>
      <Plus aria-hidden="true" />New report
    </Button>
  );

  const rows = [
    ...leading,
    ...(data.connected && !data.error ? api.reports : []).map((r) => {
      const v = slackReportView(r, data.ctx);
      return (
        <ReportRow
          key={r.id}
          href={reportHref(scope, r.id)}
          name={v.name}
          what={v.what}
          when={`${v.when} · ${v.channel}`}
          status={v.status}
          channel="Slack"
          next={v.next}
          last={v.last}
          off={!v.enabled}
          control={<ReportSwitch report={r} api={api} onError={setProblem} />}
        />
      );
    }),
  ];

  let body;
  if (loading) body = <LoadingList />;
  else if (data.error) {
    body = (
      <>
        {leading.length > 0 && <ReportList label="Your reports">{leading}</ReportList>}
        <Notice tone="danger" action={<Button size="sm" onClick={data.retry}>Retry</Button>}>Couldn’t load your reports. Check your connection and try again.</Notice>
      </>
    );
  } else if (!data.connected) {
    body = (
      <>
        {leading.length > 0 && <ReportList label="Your reports">{leading}</ReportList>}
        <ConnectSlack scope={scope} />
      </>
    );
  } else if (!rows.length) {
    body = (
      <Card>
        <EmptyState icon={<MessageSquareText />} title="No reports yet" action={newButton}>
          {scope.owner === "birdy"
            ? "Send your live numbers to Slack on a schedule, or when something happens in Birdy."
            : `Have ${scope.name} send your live numbers to Slack on a schedule, or when something happens in Birdy.`}
        </EmptyState>
      </Card>
    );
  } else {
    body = <ReportList label="Your reports">{rows}</ReportList>;
  }

  return (
    <>
      <PageTitle title="Reports" aside={rows.length > 0 ? newButton : null}>
        {intro ?? "Slack messages built from your live numbers, on a schedule or when something happens in Birdy."}
      </PageTitle>
      {notice}
      {problem && <Notice tone="danger">{problem}</Notice>}
      {body}
      {data.connected && (
        <SlackReportDialog
          open={creating}
          onOpenChange={setCreating}
          report={null}
          api={api}
          alerts={data.alerts}
          slack={data.slack}
          accountTz={data.accountTz}
          onSaved={(report) => report?.id && router.push(reportHref(scope, report.id))}
        />
      )}
    </>
  );
}

/** "Send a test" asks first: it posts to a real Slack channel. */
export function ConfirmDialog({ open, onOpenChange, title, children, confirm, kind = "primary", busy, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title}>
        <DialogBody className="text-by-body text-by-text-2">{children}</DialogBody>
        <DialogFooter className="justify-end">
          <Button kind="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button kind={kind} loading={busy} onClick={onConfirm}>{confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One Slack report: its schedule, what it says, its last run, and Change, Send test and Delete.
 * @param {ReportScope} [props.scope] Birdy's when left out
 */
export function SlackReportPage({ reportId, scope = OPS_REPORTS }) {
  const LIST = scope.base;
  const router = useRouter();
  const data = useSlackReportData(scope.owner);
  const { api } = data;
  const report = api.reports.find((r) => r.id === reportId) ?? null;
  const [editing, setEditing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [note, setNote] = useState(null);

  if (data.loading) return <><Crumbs parts={[{ label: "Reports", href: LIST }, { label: "Report" }]} /><LoadingList /></>;
  if (data.error) return <Notice tone="danger" action={<Button size="sm" onClick={data.retry}>Retry</Button>}>Couldn’t load this report. Check your connection and try again.</Notice>;
  if (!data.connected) return <><Crumbs parts={[{ label: "Reports", href: LIST }, { label: "Report" }]} /><ConnectSlack scope={scope} /></>;
  if (!report) {
    return (
      <>
        <Crumbs parts={[{ label: "Reports", href: LIST }, { label: "Not found" }]} />
        <Card><EmptyState icon={<MessageSquareText />} title="This report isn’t here" action={<Link href={LIST} className={buttonVariants({ kind: "secondary" })}>See all reports</Link>}>It may have been deleted.</EmptyState></Card>
      </>
    );
  }

  const v = slackReportView(report, data.ctx);

  const sendTest = async () => {
    setSending(true);
    setNote(null);
    try {
      const { status, error } = await api.test(report.id);
      setNote(status === "sent" ? { tone: "success", text: `Test sent to ${v.channel}.` } : { tone: "danger", text: `Not sent: ${errorLabel(error)}` });
    } catch (e) {
      setNote({ tone: "danger", text: e.message || "Couldn't send the test. Try again." });
    } finally {
      setSending(false);
      setTesting(false);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await api.remove(report.id);
      router.push(LIST);
    } catch (e) {
      setNote({ tone: "danger", text: e.message || "Couldn't delete the report. Try again." });
      setDeleting(false);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <Crumbs parts={[{ label: "Reports", href: LIST }, { label: v.name }]} />
      <PageTitle
        title={v.name}
        aside={
          <label className="inline-flex items-center gap-2 text-by-body-sm font-semibold text-by-text-2">
            {v.enabled ? "On" : "Paused"}
            <ReportSwitch report={report} api={api} onError={(text) => setNote(text ? { tone: "danger", text } : null)} />
          </label>
        }
      >
        {v.what}
      </PageTitle>

      {note && <Notice tone={note.tone}>{note.text}</Notice>}

      <Card className={v.enabled ? undefined : "opacity-70"}>
        <CardSection title="Schedule">
          <Facts>
            <Fact label="When">{v.when}</Fact>
            <Fact label="Goes to">{v.channel} in Slack</Fact>
            {v.next && <Fact label="Next run">{v.next}</Fact>}
            {!v.enabled && <Fact label="Next run">Paused</Fact>}
            <Fact label="Last run">
              {v.last ?? "Not sent yet"}
              {v.lastError && <span className="mt-0.5 block text-by-body-sm text-by-danger">{v.lastError}</span>}
            </Fact>
            <Fact label="Numbers cover">{v.window}</Fact>
          </Facts>
        </CardSection>
        <CardSection title="What it says">
          <p className="mb-3 text-by-body text-by-text-2">{v.contents && v.contents !== v.what ? `${v.what}: ${v.contents}.` : v.what}</p>
          <Preview load={() => reportPreview(report.template, scope.owner)} />
        </CardSection>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button kind="secondary" onClick={() => setEditing(true)}><Pencil aria-hidden="true" />Change</Button>
        <Button kind="secondary" onClick={() => setTesting(true)}><Send aria-hidden="true" />Send a test</Button>
        {!v.isDefault && <Button kind="ghost" className="ml-auto text-by-danger" onClick={() => setDeleting(true)}><Trash2 aria-hidden="true" />Delete</Button>}
      </div>

      <SlackReportDialog open={editing} onOpenChange={setEditing} report={report} api={api} alerts={data.alerts} slack={data.slack} accountTz={data.accountTz} onSaved={() => setNote({ tone: "success", text: "Report saved." })} />
      <ConfirmDialog open={testing} onOpenChange={setTesting} title="Send a test now?" confirm="Send test" busy={sending} onConfirm={sendTest}>
        {scope.name} posts “{v.name}” to {v.channel} in Slack now, with today’s numbers. Everyone in that channel will see it. It isn’t counted as a run.
      </ConfirmDialog>
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title="Delete this report?" confirm="Delete" kind="danger" busy={removing} onConfirm={remove}>
        “{v.name}” will stop sending and be removed. This can’t be undone.
      </ConfirmDialog>
    </>
  );
}

