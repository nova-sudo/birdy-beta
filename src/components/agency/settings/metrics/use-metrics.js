"use client";

// Settings › Metrics' data: the catalogue (GET /api/custom-metrics/available-fields),
// the custom formulas (GET/POST/PATCH/DELETE /api/custom-metrics) and the
// metrics this person has hidden (GET/PUT /api/user/hidden-metrics). The same
// calls the old /metrics page made.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { setCustomMetricsCache } from "@/lib/metrics";
import { baseMetrics, catalogRows, customFromApi } from "@/lib/metrics-catalog";

export function useMetrics() {
  const [base, setBase] = useState([]);
  const [customs, setCustoms] = useState([]);
  const [hidden, setHidden] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [fieldsRes, metricsRes, hiddenRes] = await Promise.all([
        apiRequest("/api/custom-metrics/available-fields"),
        apiRequest("/api/custom-metrics"),
        apiRequest("/api/user/hidden-metrics"),
      ]);
      if (!fieldsRes.ok && !metricsRes.ok) throw new Error("catalogue failed");
      if (hiddenRes.ok) setHidden(new Set((await hiddenRes.json()).hidden || []));
      if (fieldsRes.ok) setBase(baseMetrics(await fieldsRes.json()));
      if (metricsRes.ok) setCustoms(((await metricsRes.json()).custom_metrics || []).map(customFromApi));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Other modules read custom metrics from this cache (lib/metrics).
  useEffect(() => {
    setCustomMetricsCache(customs);
  }, [customs]);

  /** Re-read the custom formulas, e.g. after Birdy made one in the chat. */
  const refreshCustoms = useCallback(async () => {
    try {
      const res = await apiRequest("/api/custom-metrics");
      if (res.ok) setCustoms(((await res.json()).custom_metrics || []).map(customFromApi));
    } catch {}
  }, []);

  /** Show or hide a metric. Optimistic, and put back if the save fails. */
  const toggleHidden = useCallback(async (row) => {
    const willHide = !hidden.has(row.id);
    const flip = (hide) => setHidden((prev) => {
      const next = new Set(prev);
      if (hide) next.add(row.id);
      else next.delete(row.id);
      return next;
    });
    flip(willHide);
    try {
      const res = await apiRequest("/api/user/hidden-metrics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric_id: row.id, hidden: willHide }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setHidden(new Set((await res.json()).hidden || []));
    } catch {
      flip(!willHide);
      toast.error("Could not save", { description: `"${row.name}" is still ${willHide ? "visible" : "hidden"}.` });
    }
  }, [hidden]);

  /**
   * Create a custom metric, or update one when `id` is given. Resolves to the
   * saved metric, or null when it failed (a toast says so).
   */
  const save = useCallback(async (payload, id) => {
    try {
      if (id) {
        const res = await apiRequest(`/api/custom-metrics/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
        if (!res.ok) throw new Error("Failed to update metric");
        const saved = customFromApi({ ...payload, id });
        setCustoms((list) => list.map((m) => (m.id === id ? saved : m)));
        return saved;
      }
      const res = await apiRequest("/api/custom-metrics", { method: "POST", body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Failed to create metric");
      const data = await res.json();
      const saved = customFromApi({ ...payload, id: data.metric.id });
      setCustoms((list) => [...list, saved]);
      return saved;
    } catch (err) {
      toast.error("Failed to save metric", { description: err.message });
      return null;
    }
  }, []);

  const remove = useCallback(async (metric) => {
    try {
      const res = await apiRequest(`/api/custom-metrics/${metric.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setCustoms((list) => list.filter((m) => m.id !== metric.id));
      toast.success(`${metric.name} deleted`);
      return true;
    } catch {
      toast.error("Failed to delete metric");
      return false;
    }
  }, []);

  const rows = useMemo(() => catalogRows(base, customs), [base, customs]);

  return { loading, failed, reload: load, base, customs, hidden, rows, toggleHidden, save, remove, refreshCustoms };
}
