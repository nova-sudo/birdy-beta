"use client";

// The four connections (GoHighLevel, Meta, HotProspector, Slack): their status,
// and connecting and removing them. Moved here unchanged from the old settings
// page, API calls, cookies and cache keys included.
//
// Every provider's OAuth callback lands on /settings?tokens=…&status=…, so this
// also banks a callback's tokens, and sends an onboarding hop back where it
// came from (lib/oauth-handoff).

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { isPassingThrough, peekOAuthHandoff, takeOAuthHandoff } from "@/lib/oauth-handoff";
import { cachedConnection, cachedSlack, integrationFromScope, needsYouCount } from "@/lib/integrations";

const CACHE = { gohighlevel: "goHighLevelIntegration", facebook: "facebookIntegration", hotprospector: "hotprospectorIntegration", slack: "slackBotIntegration" };
const COOKIE = { gohighlevel: "gohighlevel_tokens", facebook: "facebook_tokens" };
const REMOVE = {
  gohighlevel: "/api/integrations/gohighlevel/remove",
  facebook: "/api/integrations/facebook/remove",
  hotprospector: "/api/integrations/hotprospector/remove",
  slack: "/api/integrations/slack/remove",
};
export const INTEGRATION_LABEL = { gohighlevel: "GoHighLevel", facebook: "Meta (Facebook)", hotprospector: "HotProspector", slack: "Slack" };

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};
const setCookie = (name, value, maxAge) => {
  const safeMaxAge = Number.isInteger(maxAge) && maxAge > 0 ? maxAge : 3600;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${safeMaxAge}; SameSite=Lax`;
};
const clearCookie = (name) => {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
};
const detail = async (res) => (await res.json().catch(() => ({}))).detail;

export function useIntegrations() {
  const router = useRouter();
  const search = useSearchParams();
  // Only the callback's own parameters re-run the load, so switching sections
  // (which rewrites ?section=) does not re-fetch every status.
  const tokens = search.get("tokens");
  const status = search.get("status");
  const errorMsg = search.get("error");
  const errorDescription = search.get("error_description");

  // Read during the first render, before anything paints: see lib/oauth-handoff.
  const [passingThrough, setPassingThrough] = useState(() => isPassingThrough());

  // The last known state, so a revisit does not flash "Connect" while /api/status loads.
  const [ghl, setGhl] = useState(() => cachedConnection(read(CACHE.gohighlevel)));
  const [facebook, setFacebook] = useState(() => cachedConnection(read(CACHE.facebook)));
  const [hotprospector, setHotprospector] = useState(() => cachedConnection(read(CACHE.hotprospector)));
  const [slack, setSlack] = useState(() => cachedSlack(read(CACHE.slack)));
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        setBusy(true);
        setError(null);
        // `replace` on every hand-back: the URL left behind carries a spent callback.
        const storedRedirect = peekOAuthHandoff();

        if (errorMsg && status === "error") {
          const msg = `${errorMsg}${errorDescription ? `: ${errorDescription}` : ""}`;
          setError(msg);
          toast.error("Connection Failed", { description: msg });
          if (storedRedirect) {
            takeOAuthHandoff();
            router.replace(storedRedirect);
          }
          return;
        }

        // Slack's callback returns status=success with no tokens.
        if (status === "success" && !tokens && storedRedirect) {
          takeOAuthHandoff();
          router.replace(storedRedirect);
          return;
        }

        if (tokens && status === "success") {
          try {
            const parsed = JSON.parse(decodeURIComponent(tokens));
            const type = integrationFromScope(parsed.scope);
            const expiresIn = parsed.expires_in || (type === "facebook" ? 60 * 24 * 60 * 60 : 3600);
            setCookie(COOKIE[type], JSON.stringify(parsed), expiresIn);
            const next = {
              connected: true,
              expires_at: parsed.expires_at,
              token_expired: parsed.expires_at ? new Date(parsed.expires_at) < new Date() : false,
            };
            write(CACHE[type], next);
            (type === "gohighlevel" ? setGhl : setFacebook)(next);
            const handoff = takeOAuthHandoff();
            if (!handoff) {
              toast.success("Connection Successful", { description: `${type === "gohighlevel" ? "GoHighLevel" : "Meta"} connected successfully.` });
            } else {
              router.replace(handoff);
            }
            return;
          } catch (e) {
            console.error("Error parsing OAuth callback tokens:", e);
            takeOAuthHandoff();
            setPassingThrough(false);
            setError("Invalid token data received");
            toast.error("Connection Failed", { description: "Invalid token data received" });
            return;
          }
        }

        // Any other callback shape while a return path is pending: honour it.
        if (storedRedirect && (tokens || status || errorMsg)) {
          takeOAuthHandoff();
          router.replace(storedRedirect);
          return;
        }

        // A normal load: the backend is the source of truth.
        const res = await apiRequest("/api/status");
        if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`);
        const data = await res.json();

        if (data.gohighlevel?.agency?.connected) {
          const s = { connected: true, expires_at: data.gohighlevel.agency.expires_at, token_expired: data.gohighlevel.agency.token_expired ?? false };
          write(CACHE.gohighlevel, s);
          setGhl(s);
        } else {
          setGhl({ connected: false });
          write(CACHE.gohighlevel, null);
        }

        if (data.facebook?.connected) {
          const s = { connected: true, expires_at: data.facebook.expires_at, token_expired: data.facebook.token_expired ?? false };
          write(CACHE.facebook, s);
          setFacebook(s);
        } else {
          setFacebook({ connected: false });
          write(CACHE.facebook, null);
        }

        const hpRes = await apiRequest("/api/hotprospector/status");
        if (hpRes.ok) {
          const hp = await hpRes.json();
          setHotprospector(hp);
          write(CACHE.hotprospector, hp?.connected ? hp : null);
        }

        const slackRes = await apiRequest("/api/integrations/slack/status");
        if (slackRes.ok) {
          const s = await slackRes.json();
          setSlack(s);
          write(CACHE.slack, s?.installed ? s : null);
        }
      } catch (err) {
        console.error("init error:", err);
        setError(`Failed to fetch integration status: ${err.message}`);
        toast.error("Error", { description: err.message });
        // The last known state stays on screen.
        const g = cachedConnection(read(CACHE.gohighlevel));
        if (g.connected) setGhl(g);
        const f = cachedConnection(read(CACHE.facebook));
        if (f.connected) setFacebook(f);
      } finally {
        setBusy(false);
        setChecking(false);
      }
    };
    init();
  }, [tokens, status, errorMsg, errorDescription]); // eslint-disable-line react-hooks/exhaustive-deps

  // A connection changed in another tab: follow it without waiting for /api/status.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === CACHE.gohighlevel) setGhl(cachedConnection(read(CACHE.gohighlevel)));
      else if (e.key === CACHE.facebook) setFacebook(cachedConnection(read(CACHE.facebook)));
      else if (e.key === CACHE.hotprospector) setHotprospector(cachedConnection(read(CACHE.hotprospector)));
      else if (e.key === CACHE.slack) setSlack(cachedSlack(read(CACHE.slack)));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /** GoHighLevel and Meta: off to the provider's consent screen. */
  const connect = useCallback(async (type) => {
    try {
      setBusy(true);
      setError(null);
      const res = await apiRequest(type === "gohighlevel" ? "/api/connect" : "/api/connect/facebook");
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const { auth_url } = await res.json();
      if (auth_url) window.location.href = auth_url;
      else throw new Error("No auth URL returned");
    } catch (err) {
      setError(`Failed to connect: ${err.message}`);
      toast.error("Connection Failed", { description: err.message });
    } finally {
      setBusy(false);
    }
  }, []);

  const connectSlack = useCallback(async () => {
    try {
      setBusy(true);
      setError(null);
      const res = await apiRequest("/api/connect/slack");
      if (!res.ok) throw new Error((await detail(res)) || `${res.status} ${res.statusText}`);
      const { auth_url } = await res.json();
      if (auth_url) window.location.href = auth_url;
      else throw new Error("No auth URL returned");
    } catch (err) {
      setError(`Failed to connect: ${err.message}`);
      toast.error("Connection Failed", { description: err.message });
    } finally {
      setBusy(false);
    }
  }, []);

  /** HotProspector takes an API UID and key. Resolves true when it connected. */
  const connectHotprospector = useCallback(async (credentials) => {
    try {
      setBusy(true);
      setError(null);
      const res = await apiRequest("/api/hotprospector/connect", { method: "POST", body: JSON.stringify(credentials) });
      if (!res.ok) throw new Error((await detail(res)) || "Failed to connect HotProspector");
      const data = await res.json();
      const next = { connected: true, api_uid: credentials.api_uid };
      setHotprospector(next);
      write(CACHE.hotprospector, next);
      toast.success("Connection Successful", { description: `HotProspector connected. Found ${data.groups_count ?? 0} groups.` });
      return true;
    } catch (err) {
      setError(`Failed to connect HotProspector: ${err.message}`);
      toast.error("Connection Failed", { description: err.message });
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const remove = useCallback(async (type) => {
    try {
      setRemoving(type);
      setError(null);
      const res = await apiRequest(REMOVE[type], { method: "DELETE" });
      if (!res.ok) throw new Error((await detail(res)) || `${res.status} ${res.statusText}`);
      write(CACHE[type], null);
      if (COOKIE[type]) clearCookie(COOKIE[type]);
      if (type === "gohighlevel") setGhl({ connected: false });
      else if (type === "facebook") setFacebook({ connected: false });
      else if (type === "hotprospector") setHotprospector({ connected: false });
      else setSlack({ installed: false });
      toast.success("Integration Removed", { description: `${type === "slack" ? "Slack Bot" : INTEGRATION_LABEL[type]} credentials have been deleted.` });
    } catch (err) {
      setError(`Failed to remove integration: ${err.message}`);
      toast.error("Removal Failed", { description: err.message });
    } finally {
      setRemoving(null);
    }
  }, []);

  /** Slack's channel or brief changed: keep the cached copy in step. */
  const updateSlack = useCallback((patch) => {
    setSlack((prev) => {
      const next = { ...prev, ...patch };
      if (next.installed) write(CACHE.slack, next);
      return next;
    });
  }, []);

  return {
    passingThrough,
    checking,
    busy,
    removing,
    error,
    ghl,
    facebook,
    hotprospector,
    slack,
    needsYou: needsYouCount({ ghl, facebook }),
    connect,
    connectSlack,
    connectHotprospector,
    remove,
    updateSlack,
  };
}
