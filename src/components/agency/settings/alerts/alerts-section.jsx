"use client";

// Settings › Alerts: everything the old /alerts page did. The rules, split
// into Triggered, Active and Snoozed & paused as GET /api/alerts returns them,
// plus a History tab of every time one fired. Create and edit in a dialog,
// switch a rule off and on, snooze, check now, delete, and clear one client
// of a per-client rule. Ask Birdy sets an alert up in a chat.
//
// ?tab= (the old page's) opens a tab and follows it as tabs change.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, BellRing, Plus, RefreshCw } from "lucide-react";
import { Button, Card, EmptyState, Notice, Skeleton, TabPanel, TabPill } from "@/components/by";
import { useAgentChat } from "@/components/agency/chat/use-agent-chat";
import { useCreativeTests } from "@/lib/creatives-api";
import { ALERT_TABS, BLANK_FORM, EMPTY_TAB, alertsTabHref, formFromAlert, groupTriggered, nextStatus, tabFromParam } from "@/lib/alert-rules";
import { useAlerts } from "./use-alerts";
import { FiredGroup, RuleRow } from "./alert-rows";
import { AlertDialog } from "./alert-dialog";
import { ConfirmDialog, SnoozeDialog } from "./alert-confirm";
import { AlertHistory } from "./alert-history";
import { AlertsAskBar, AlertsAskPanel } from "./alerts-ask";

function accountEmail() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}")?.email || "";
  } catch {
    return "";
  }
}

function ListSkeleton() {
  return (
    <ul aria-label="Loading alerts" className="divide-y divide-by-line-soft">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-center gap-5 px-4 py-4">
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-64" /><Skeleton className="h-3 w-40" /></div>
          <Skeleton className="hidden h-8 w-36 sm:block" />
          <Skeleton className="h-5 w-9 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

export function AlertsSection() {
  const search = useSearchParams();
  const [tab, setTab] = useState(() => tabFromParam(search.get("tab")));
  const alerts = useAlerts();
  const [editor, setEditor] = useState(null); // {editing, initial}
  const [deleting, setDeleting] = useState(null);
  const [clearing, setClearing] = useState(null);
  const [snoozing, setSnoozing] = useState(null);
  const [switching, setSwitching] = useState(null);
  const [asking, setAsking] = useState(false);
  const [email, setEmail] = useState("");
  const chat = useAgentChat({ sessionKey: "by_settings_alerts", page: "alerts", onSettled: alerts.refresh });

  useEffect(() => setEmail(accountEmail()), []);

  // On a phone the tabs scroll sideways; keep the open one in view.
  const tabs = useRef(null);
  useEffect(() => {
    tabs.current?.querySelector('[role="tab"][aria-selected="true"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [tab]);

  // Keep ?tab= in the address, the way the old page's links wrote it.
  const openTab = useCallback((next) => {
    setTab(next);
    const href = alertsTabHref(next);
    if (href !== window.location.pathname + window.location.search) window.history.replaceState(window.history.state, "", href);
  }, []);

  const { loadHistory, history: { loaded: historyLoaded } } = alerts;
  useEffect(() => {
    if (tab === "history" && !historyLoaded) loadHistory();
  }, [tab, historyLoaded, loadHistory]);

  // Creative tests are read only while they are needed: the editor is open, or a rule targets tests.
  const hasCreative = alerts.rules.some((a) => a.scope === "creative_tests");
  const { tests } = useCreativeTests(editor || hasCreative ? {} : null);
  const testCodes = useMemo(() => Object.fromEntries((tests || []).map((t) => [t.id, t.code])), [tests]);

  const toggle = async (alert) => {
    setSwitching(alert.id);
    await alerts.setStatus(alert, nextStatus(alert));
    setSwitching(null);
  };

  const rowProps = {
    options: alerts.options,
    testCodes,
    evaluating: alerts.evaluating,
    onToggle: toggle,
    onEdit: (alert) => setEditor({ editing: alert, initial: formFromAlert(alert) }),
    onEvaluate: alerts.evaluate,
    onSnooze: setSnoozing,
    onDelete: setDeleting,
  };

  const counts = alerts.data.counts ?? {};
  const items = ALERT_TABS.map((t) => (counts[t.value] ? { ...t, count: counts[t.value] } : t));
  const newAlert = <Button kind="primary" size="sm" onClick={() => setEditor({ editing: null, initial: BLANK_FORM })}><Plus aria-hidden="true" />New alert</Button>;

  const list = (key) => {
    if (alerts.loading) return <ListSkeleton />;
    if (alerts.failed) {
      return (
        <div className="p-4">
          <Notice tone="danger" action={<Button size="sm" onClick={alerts.reload}><RefreshCw aria-hidden="true" />Try again</Button>}>Couldn't load your alerts.</Notice>
        </div>
      );
    }
    const rows = alerts.data[key] ?? [];
    if (!rows.length) {
      return (
        <EmptyState icon={key === "triggered" ? <BellRing /> : <Bell />} title={EMPTY_TAB[key].title} action={key === "active" ? newAlert : undefined}>
          {EMPTY_TAB[key].body}
        </EmptyState>
      );
    }
    if (key === "triggered") {
      return (
        <ul aria-label="Triggered alerts">
          {groupTriggered(rows).map((g) => (g.clients.length
            ? <FiredGroup key={g.key} group={g} {...rowProps} switching={switching === g.alert.id} onClear={setClearing} />
            : <RuleRow key={g.key} alert={g.alert} {...rowProps} switching={switching === g.alert.id} />))}
        </ul>
      );
    }
    return (
      <ul aria-label={`${key === "active" ? "Active" : "Snoozed and paused"} alerts`}>
        {rows.map((a) => <RuleRow key={a._virtual_id ?? a.id} alert={a} {...rowProps} switching={switching === a.id} />)}
      </ul>
    );
  };

  return (
    <>
      {/* The conversation opens beside the lists, never between the bar and them. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
      <AlertsAskBar chat={chat} onOpenChange={setAsking} />

      <div ref={tabs} className="contents">
      <TabPill items={items} value={tab} onValueChange={openTab} aria-label="Alert lists" toolbar={newAlert} className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ALERT_TABS.map((t) => (
          <TabPanel key={t.value} value={t.value}>
            {/* The list scrolls inside its card; the tabs above stay put. */}
            <Card className="mt-3 max-h-[min(36rem,calc(100dvh-20rem))] min-h-40 overflow-y-auto overscroll-contain">
              {t.value === "history" ? <AlertHistory history={alerts.history} onRetry={alerts.loadHistory} /> : list(t.value)}
            </Card>
            {t.value === "history" && alerts.history.rows.length > 0 && <p className="mt-2 text-by-caption text-by-muted">The 50 most recent.</p>}
          </TabPanel>
        ))}
      </TabPill>
      </div>
      </div>
      {asking && <AlertsAskPanel chat={chat} onOpenChange={setAsking} />}
      </div>

      {editor && (
        <AlertDialog
          editing={editor.editing}
          initial={editor.initial}
          options={alerts.options}
          clients={alerts.clients}
          tests={tests}
          email={email}
          onSave={alerts.save}
          onClose={() => setEditor(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog title="Delete this alert?" confirm="Delete" onConfirm={() => alerts.remove(deleting)} onClose={() => setDeleting(null)}>
          “{deleting.name}” will be deleted for good. This can’t be undone.
        </ConfirmDialog>
      )}
      {clearing && (
        <ConfirmDialog title="Clear this entry?" confirm="Clear" onConfirm={() => alerts.dismissClient(clearing)} onClose={() => setClearing(null)}>
          {clearing._client_name} comes off “{clearing.name}”. It fires again if the condition is still met.
        </ConfirmDialog>
      )}
      {snoozing && <SnoozeDialog target={snoozing} onSnooze={alerts.snooze} onClose={() => setSnoozing(null)} />}
    </>
  );
}
