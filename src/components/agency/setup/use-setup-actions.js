"use client";

import { useCallback, useState } from "react";
import { apiRequest } from "@/lib/api";
import { SETUP_PATH, STORAGE_KEYS } from "@/lib/constants";
import { setOAuthHandoff } from "@/lib/oauth-handoff";

/** Where each OAuth connection starts. The provider's callback lands on /settings, which hands back to setup. */
export const OAUTH_ENDPOINTS = { ghl: "/api/connect", meta: "/api/connect/facebook", slack: "/api/connect/slack" };

const detailOf = (body, fallback) => {
  const d = body?.detail;
  return typeof d === "string" ? d : d?.message || fallback;
};

/**
 * What setup's steps do: save answers, start a connection, finish.
 * `pending[id]` is a connection in flight ("connecting") or one that failed ("error", with `errors[id]`).
 *
 * @param {(which?: string) => void} refresh re-reads a fact (lib/use-setup)
 * @param {{go?: (url: string) => void}} [opts] `go` leaves for the provider (tests replace it)
 */
export function useSetupActions(refresh, { go = (url) => window.location.assign(url) } = {}) {
  const [pending, setPending] = useState({});
  const [errors, setErrors] = useState({});
  const mark = (id, state, error = null) => {
    setPending((p) => ({ ...p, [id]: state }));
    setErrors((e) => ({ ...e, [id]: error }));
  };

  /** PUT /api/onboarding/state. `data.name`, `data.agency` and `data.currency` also update the profile. */
  const saveAnswers = useCallback(async (data) => {
    const res = await apiRequest("/api/onboarding/state", { method: "PUT", body: JSON.stringify({ data }) });
    if (!res.ok) throw new Error("Couldn’t save that. Check your connection and try again.");
    if (data.currency) {
      try { localStorage.setItem(STORAGE_KEYS.DEFAULT_CURRENCY, data.currency); } catch { /* the server copy wins on next login */ }
    }
    refresh("onboarding");
  }, [refresh]);

  /**
   * Leave for GoHighLevel, Meta or Slack. The return path is parked first, so the callback comes back here.
   * `{ real: true }` asks for a real Slack workspace on a sandbox account (it gets a test one otherwise).
   */
  const startOAuth = useCallback(async (id, { real = false } = {}) => {
    mark(id, "connecting");
    try {
      setOAuthHandoff(SETUP_PATH);
      const res = await apiRequest(real ? `${OAUTH_ENDPOINTS[id]}?real=true` : OAUTH_ENDPOINTS[id]);
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.auth_url) throw new Error(detailOf(body, "The connection couldn’t start. Try again."));
      go(body.auth_url);
    } catch (e) {
      // What the server said beats a guess: the request may never have reached the provider.
      mark(id, "error", e?.message || "The connection couldn’t start. Try again.");
    }
  }, [go]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Hot Prospector takes an API UID and key rather than a login. */
  const connectHp = useCallback(async (uid, key) => {
    if (!uid.trim() || !key.trim()) return false;
    mark("hp", "connecting");
    try {
      const res = await apiRequest("/api/hotprospector/connect", {
        method: "POST",
        body: JSON.stringify({ api_uid: uid.trim(), api_key: key.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(detailOf(body, "Hot Prospector didn’t accept that key."));
      mark("hp", null);
      refresh("hp");
      return true;
    } catch (e) {
      mark("hp", "error", e?.message || "Hot Prospector didn’t accept that key.");
      return false;
    }
  }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Marks onboarding finished, so the app stops holding the account in setup. */
  const complete = useCallback(async () => {
    try {
      await apiRequest("/api/onboarding/complete", { method: "POST" });
    } catch { /* stays incomplete server-side; still let them in */ }
    try { localStorage.removeItem("onboarding_incomplete"); } catch { /* nothing to clear */ }
    refresh("onboarding");
  }, [refresh]);

  return { pending, errors, saveAnswers, startOAuth, connectHp, complete, clear: (id) => mark(id, null) };
}
