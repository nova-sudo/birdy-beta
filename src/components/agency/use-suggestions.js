"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { applySuggestionRequest, dismissSuggestionRequest } from "@/app/dashboard/usePortfolioData";
import { shapeSummary } from "@/lib/agency-suggestions";
import { revalidateAgentWork } from "@/lib/agents-api";
import { apiRequest } from "@/lib/api";

const KEY = "/api/dashboard/summary";
const fetcher = async (url) => {
  const res = await apiRequest(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/**
 * Agency Ops' suggestions and what has been done, with the two actions.
 *
 * Acting is immediate on screen and put back if the request fails. Both
 * actions go to the same endpoints the old Dashboard used.
 */
export function useSuggestions() {
  const router = useRouter();
  const { mutate: mutateCache } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR(KEY, fetcher, { revalidateOnFocus: false });
  const shaped = useMemo(() => shapeSummary(data), [data]);

  const [gone, setGone] = useState({});
  const [done, setDone] = useState([]);
  const [busy, setBusy] = useState(null);

  const hide = (id, hidden) => setGone((prev) => ({ ...prev, [id]: hidden }));

  const apply = useCallback(async (s) => {
    setBusy(s.id);
    const result = await applySuggestionRequest(s.id);
    setBusy(null);
    if (s.agentId) revalidateAgentWork(mutateCache);
    if (!result) return toast.error("Couldn’t do that", { description: s.title });
    if (result.ok === false) return toast.warning("Not done", { description: result.blocked_reason?.message ?? s.title });
    hide(s.id, true);
    setDone((prev) => [{ id: `done-${s.id}`, what: s.title, client: s.client, mode: "Approved", when: "just now" }, ...prev]);
    // Some suggestions finish on another screen (scaling a creative test opens its wizard).
    if (typeof result.redirect === "string" && result.redirect) return router.push(result.redirect);
    const count = (result.succeeded ?? []).length;
    toast.success(count ? `Applied to ${count} ad${count === 1 ? "" : "s"}` : "Done", { description: s.title });
    mutate();
  }, [mutateCache, mutate, router]);

  const dismiss = useCallback(async (s) => {
    hide(s.id, true);
    const ok = await dismissSuggestionRequest(s.id);
    if (s.agentId) revalidateAgentWork(mutateCache);
    if (!ok) {
      hide(s.id, false);
      return toast.error("Couldn’t dismiss that", { description: s.title });
    }
    setDone((prev) => [{ id: `dismissed-${s.id}`, what: s.title, client: s.client, mode: "Dismissed", when: "just now" }, ...prev]);
    toast("Suggestion dismissed", { description: s.title });
  }, [mutateCache]);

  const suggestions = useMemo(() => shaped.suggestions.filter((s) => !gone[s.id]), [shaped.suggestions, gone]);
  // What was acted on here shows at once; once the server's own record of it arrives, that one is kept.
  const history = useMemo(() => {
    const served = new Set(shaped.history.map((h) => `${h.mode}|${h.what}|${h.client}`));
    return [...done.filter((d) => !served.has(`${d.mode}|${d.what}|${d.client}`)), ...shaped.history];
  }, [done, shaped.history]);

  return { suggestions, history, loading: isLoading, error: error && !data ? error : null, refresh: () => mutate(), apply, dismiss, busy };
}

/** How many suggestions are open, for the tab's badge. Shares the tab's own request. */
export function useSuggestionCount() {
  const { data } = useSWR(KEY, fetcher, { revalidateOnFocus: false });
  return data?.suggestions?.length ?? 0;
}
