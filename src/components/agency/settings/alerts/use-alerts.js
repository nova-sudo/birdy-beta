"use client";

// Settings › Alerts' data and actions: the same calls the old /alerts page
// made. Reads: GET /api/alerts, /api/client-groups?include_daily=false,
// /api/custom-metrics, and the fired history (GET /api/alerts/notifications).
// Writes happen only when a function below is called from a button: create,
// update, pause or activate, snooze, evaluate, delete, dismiss one client.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { activeGroups } from "@/lib/client-status";
import { SNOOZE_OPTIONS } from "@/lib/alert-helpers";
import { alertMetricOptions, allRules, historyRows, tagsFromGroups } from "@/lib/alert-rules";

const EMPTY = { active: [], triggered: [], paused: [], counts: {} };

async function post(url, body) {
  const res = await apiRequest(url, { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res;
}

export function useAlerts() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [groups, setGroups] = useState([]);
  const [customMetrics, setCustomMetrics] = useState([]);
  const [history, setHistory] = useState({ loading: false, failed: false, loaded: false, items: [] });
  const [evaluating, setEvaluating] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await apiRequest("/api/alerts");
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
    // Names and ids for the target list; no per-day series.
    apiRequest("/api/client-groups?include_daily=false")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => d && setGroups(d.client_groups || []))
      .catch(() => {});
    apiRequest("/api/custom-metrics")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => d && setCustomMetrics((d.custom_metrics || []).map((m) => ({ id: m.id, name: m.name }))))
      .catch(() => {});
  }, [refresh]);

  /** Read the fired history. Read-only: nothing is marked as read. */
  const loadHistory = useCallback(async () => {
    setHistory((h) => ({ ...h, loading: true, failed: false }));
    try {
      const res = await apiRequest("/api/alerts/notifications?unread_only=false");
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      setHistory({ loading: false, failed: false, loaded: true, items: d.notifications || [] });
    } catch {
      setHistory((h) => ({ ...h, loading: false, failed: true, loaded: true }));
    }
  }, []);

  /** Create a rule, or update one when `id` is given. Resolves true when saved. */
  const save = useCallback(async (payload, id) => {
    try {
      const res = await apiRequest(id ? `/api/alerts/${id}` : "/api/alerts", { method: id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`${res.status}`);
      toast.success(id ? "Alert updated" : "Alert created");
      refresh();
      return true;
    } catch {
      toast.error("Couldn't save the alert", { description: "Nothing changed. Please try again." });
      return false;
    }
  }, [refresh]);

  /** Pause a rule, or switch it back on. */
  const setStatus = useCallback(async (alert, status) => {
    try {
      const res = await apiRequest(`/api/alerts/${alert.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error(`${res.status}`);
      toast.success(status === "paused" ? `${alert.name} paused` : `${alert.name} is on`);
      refresh();
      return true;
    } catch {
      toast.error("Couldn't update the alert");
      return false;
    }
  }, [refresh]);

  /** Snooze a rule, or one client of a per-client rule (a fanned-out row). */
  const snooze = useCallback(async (target, hours) => {
    const label = SNOOZE_OPTIONS.find((o) => o.value === hours)?.label ?? `${hours} hours`;
    try {
      if (target._virtual && target._client_id) await post(`/api/alerts/${target.id}/snooze-client`, { client_id: target._client_id, hours });
      else await post(`/api/alerts/${target.id}/snooze`, { hours });
      toast.success(target._virtual ? `${target._client_name} snoozed for ${label}` : `Alert snoozed for ${label}`);
      refresh();
      return true;
    } catch {
      toast.error("Couldn't snooze the alert");
      return false;
    }
  }, [refresh]);

  /** Check a rule now, and say what came back. */
  const evaluate = useCallback(async (alert) => {
    setEvaluating(alert._virtual_id ?? alert.id);
    try {
      const res = await post(`/api/alerts/${alert.id}/evaluate`);
      const ev = (await res.json()).evaluation;
      if (ev?.triggered) toast.warning("Alert fired", { description: ev.message });
      else toast.success("All clear", { description: `${Number(ev?.progress_pct ?? 0).toFixed(0)}% of the way to firing (now ${ev?.current_value != null ? Number(ev.current_value).toFixed(2) : "—"}).` });
      refresh();
    } catch {
      toast.error("Couldn't check the alert");
    } finally {
      setEvaluating(null);
    }
  }, [refresh]);

  const remove = useCallback(async (alert) => {
    try {
      const res = await apiRequest(`/api/alerts/${alert.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`${res.status}`);
      toast.success(`${alert.name} deleted`);
      refresh();
      return true;
    } catch {
      toast.error("Couldn't delete the alert");
      return false;
    }
  }, [refresh]);

  /** Clear one client's fired entry; it fires again if the condition still holds. */
  const dismissClient = useCallback(async (row) => {
    try {
      await post(`/api/alerts/${row.id}/dismiss-client`, { client_id: row._client_id });
      toast.success(`Cleared ${row._client_name}`);
      refresh();
      return true;
    } catch {
      toast.error("Couldn't clear that entry");
      return false;
    }
  }, [refresh]);

  const rules = useMemo(() => allRules(data), [data]);
  const clients = useMemo(() => activeGroups(groups), [groups]);
  const options = useMemo(() => alertMetricOptions({ availableTags: tagsFromGroups(groups), customMetrics }), [groups, customMetrics]);
  const fired = useMemo(() => historyRows(history.items, rules), [history.items, rules]);

  return {
    data, rules, loading, failed, reload, refresh, clients, options, evaluating,
    history: { ...history, rows: fired }, loadHistory,
    save, setStatus, snooze, evaluate, remove, dismissClient,
  };
}
