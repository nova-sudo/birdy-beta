"use client";

import { useMemo, useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, Zap, Check, Trash2, Clock, Pause, Image as ImageIcon, DollarSign, Sparkles, RotateCcw } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  useDashboardData,
  applySuggestion,
  undoSuggestion,
  dismissSuggestion,
  runAlertAction,
  completeWin,
} from "./useDashboardData";

const SEVERITY_STYLE = {
  HIGH:        { badge: "bg-red-100 text-red-700",     border: "border-l-red-500",   icon: "bg-red-100 text-red-500" },
  MEDIUM:      { badge: "bg-amber-100 text-amber-700",  border: "border-l-amber-500", icon: "bg-amber-100 text-amber-500" },
  OPPORTUNITY: { badge: "bg-green-100 text-green-700",  border: "border-l-green-500", icon: "bg-green-100 text-green-500" },
};

const TAB_META = [
  { value: "suggestions", label: "Birdy suggestions" },
  { value: "alerts",      label: "Alerts triggered" },
  { value: "wins",        label: "Client wins" },
];

// Server suggestions send `icon` as a string name; the bundled mock data sends a
// lucide component directly. resolveIcon accepts either and always returns a
// renderable component.
const ICON_MAP = {
  pause: Pause,
  "trending-up": TrendingUp,
  image: ImageIcon,
  dollar: DollarSign,
  sparkles: Sparkles,
  alert: AlertTriangle,
  zap: Zap,
};
function resolveIcon(icon) {
  if (typeof icon === "string") return ICON_MAP[icon] || Sparkles;
  return icon || Sparkles; // already a component (mock data)
}

// ─── Sub-components ────────────────────────────────────────────────────────

function FadeWrap({ dismissing, children }) {
  return (
    <div
      className={`transition-all duration-300 ease-in-out overflow-hidden ${
        dismissing ? "max-h-0 opacity-0 -translate-x-4" : "max-h-96 opacity-100"
      }`}
    >
      {children}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="flex items-start gap-4 bg-white border border-border/60 rounded-xl border-l-4 border-l-muted p-4 shadow-sm mb-4">
      <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-3 w-full max-w-md" />
      </div>
      <Skeleton className="h-8 w-28 rounded-lg shrink-0" />
    </div>
  );
}

function RecommendationCard({ item, dismissing, onApply, onUndo, onDismiss }) {
  const style = SEVERITY_STYLE[item.severity] || SEVERITY_STYLE.MEDIUM;
  const Icon = resolveIcon(item.icon);

  // An applied suggestion stays on the board (muted) with a lasting Undo, so the
  // dashboard matches the persistent Undo button on the Slack card.
  if (item.status === "applied") {
    const n = item.applied_count ?? 0;
    return (
      <FadeWrap dismissing={dismissing}>
        <div className="flex items-start gap-4 bg-white border border-border/60 rounded-xl border-l-4 border-l-green-500 p-4 shadow-sm mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-green-100 text-green-600">
            <Check className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[11px] font-bold tracking-wide text-green-600">DONE</span>
              <span className="text-xs text-muted-foreground truncate">
                {item.client} · {item.platform}
              </span>
            </div>
            <p className="text-sm font-semibold text-muted-foreground">{item.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Paused {n} ad{n === 1 ? "" : "s"} · you can still undo this.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUndo(item)}
            className="rounded-lg h-8 px-3 text-xs gap-1.5 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Undo
          </Button>
        </div>
      </FadeWrap>
    );
  }

  return (
    <FadeWrap dismissing={dismissing}>
      <div className={`flex items-start gap-4 bg-white border border-border/60 rounded-xl border-l-4 ${style.border} p-4 shadow-sm mb-4`}>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${style.icon}`}>
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[11px] font-bold tracking-wide text-purple-600">RECOMMENDATION</span>
            <Badge className={`${style.badge} border-transparent`}>{item.severity}</Badge>
            <span className="text-xs text-muted-foreground truncate">
              {item.client} · {item.platform}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">{item.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{item.description}</p>

          {item.stats?.length > 0 && (
            <div className="flex items-center gap-5 mt-3">
              {item.stats.map((s) => (
                <div key={s.label}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
                  <p className={`text-sm font-semibold mt-0.5 ${s.bad ? "text-red-600" : "text-foreground"}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => onApply(item)}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-8 px-3 text-xs gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            Do it for me
          </Button>
          <button
            onClick={() => onDismiss(item)}
            title="Dismiss"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border/60 hover:bg-muted transition-colors shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </FadeWrap>
  );
}

function AlertRow({ item, dismissing, onAction }) {
  const border = item.color === "red" ? "border-l-red-500" : "border-l-amber-500";
  const iconTone = item.color === "red" ? "bg-red-100 text-red-500" : "bg-amber-100 text-amber-500";
  const badgeTone = item.badgeTone === "purple" ? "bg-purple-100 text-purple-700" : "bg-muted text-muted-foreground";
  const ctaTone =
    item.ctaVariant === "filled"
      ? "bg-purple-600 hover:bg-purple-700 text-white"
      : "bg-white border border-border/60 text-foreground hover:bg-muted";

  return (
    <FadeWrap dismissing={dismissing}>
      <div className={`flex items-center gap-4 bg-white border border-border/60 rounded-xl border-l-4 ${border} p-4 shadow-sm mb-4`}>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconTone}`}>
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground mb-0.5">{item.title}</p>
          <p className="text-xs text-muted-foreground mb-1.5">{item.client}</p>
          <span className={`inline-flex text-[10px] font-bold tracking-wide uppercase rounded px-2 py-0.5 ${badgeTone}`}>
            {item.badge}
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => onAction(item)}
          className={`${ctaTone} rounded-lg h-8 px-3 text-xs shrink-0`}
        >
          {item.cta}
        </Button>
      </div>
    </FadeWrap>
  );
}

function WinRow({ item, dismissing, onMarkDone }) {
  return (
    <FadeWrap dismissing={dismissing}>
      <div className="flex items-center gap-4 bg-white border border-border/60 rounded-xl border-l-4 border-l-green-500 p-4 shadow-sm mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="w-4 h-4 text-green-600 shrink-0" />
            <span className="text-[11px] font-bold tracking-wide text-green-600">CLIENT WIN</span>
            <span className="text-xs text-muted-foreground truncate">{item.client}</span>
          </div>
          <p className="text-sm font-semibold text-foreground">{item.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
        </div>
        <button
          onClick={() => onMarkDone(item)}
          title="Mark done"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-green-50 border border-green-200 text-green-600 hover:bg-green-100 transition-colors shrink-0"
        >
          <Check className="w-4 h-4" />
        </button>
      </div>
    </FadeWrap>
  );
}

// Icon + tone per activity kind, falling back to the actor when kind is absent
// (the bundled mock activity has only actor/title/client/time).
function activityVisual(kind, isBirdy) {
  switch (kind) {
    case "analysis_pass":        return { Ico: Clock,  tone: "bg-purple-100 text-purple-600" };
    case "suggestion_created":   return { Ico: Zap,    tone: "bg-purple-100 text-purple-600" };
    case "action_applied":       return { Ico: Check,  tone: "bg-green-100 text-green-600" };
    case "suggestion_dismissed": return { Ico: Trash2, tone: "bg-muted text-muted-foreground" };
    default:                     return isBirdy
      ? { Ico: Zap,   tone: "bg-purple-100 text-purple-600" }
      : { Ico: Check, tone: "bg-green-100 text-green-600" };
  }
}

function ActivityItem({ actor, kind, title, client, time, label }) {
  const isBirdy = actor === "birdy";
  const caption = label || (isBirdy ? "Auto-run by Birdy" : "Approved by you");
  const { Ico, tone } = activityVisual(kind, isBirdy);
  return (
    <div className="flex items-start gap-3">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
        <Ico className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground leading-snug">{title}</p>
        <p className="text-xs text-muted-foreground">{client}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
          {caption} · {time}
        </p>
      </div>
    </div>
  );
}

// ─── Strictness control ──────────────────────────────────────────────────────

const STRICTNESS_OPTIONS = [
  { value: "lenient", label: "Lenient" },
  { value: "balanced", label: "Balanced" },
  { value: "strict", label: "Strict" },
];

function StrictnessControl() {
  const [level, setLevel] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest("/api/dashboard/settings");
        if (res.ok && !cancelled) {
          const d = await res.json();
          setLevel(d.strictness || "balanced");
        }
      } catch {
        /* leave null → the select shows Balanced */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onChange = async (value) => {
    const prev = level;
    setLevel(value);
    setSaving(true);
    try {
      const res = await apiRequest("/api/dashboard/settings", {
        method: "PUT",
        body: JSON.stringify({ strictness: value }),
      });
      if (res.ok) toast.success(`Suggestion strictness set to ${value}`);
      else { setLevel(prev); toast.error("Couldn't save strictness"); }
    } catch {
      setLevel(prev);
      toast.error("Couldn't save strictness");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-xs text-muted-foreground whitespace-nowrap">Suggestion strictness</span>
      <select
        value={level ?? "balanced"}
        onChange={(e) => onChange(e.target.value)}
        disabled={level === null || saving}
        className="text-sm border border-border/60 rounded-lg px-2.5 py-1.5 bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-60"
      >
        {STRICTNESS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Dashboard Page ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("suggestions");
  const [dismissingIds, setDismissingIds] = useState(new Set());

  const {
    suggestions, setSuggestions,
    alerts, setAlerts,
    wins, setWins,
    activity,
    counts,
    loading,
  } = useDashboardData();

  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });
  const firstName = user?.name?.split(" ")[0] || "there";

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const dateLabel = useMemo(
    () => new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
    []
  );

  const SETTERS = { suggestions: setSuggestions, alerts: setAlerts, wins: setWins };

  const removeItem = (tabValue, id) => {
    setDismissingIds((prev) => new Set([...prev, id]));
    setTimeout(() => {
      SETTERS[tabValue]((prev) => prev.filter((i) => i.id !== id));
      setDismissingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, 300);
  };

  const setSuggestionStatus = (id, status, extra = {}) =>
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, status, ...extra } : s)));

  const handleUndo = async (item) => {
    setSuggestionStatus(item.id, "open"); // optimistic
    const data = await undoSuggestion(item.id);
    if (!data) {
      setSuggestionStatus(item.id, "applied");
      toast.error("Couldn't undo", { description: item.title });
      return;
    }
    toast.success("Undone — ads re-enabled", { description: item.title });
  };

  const handleApply = async (item) => {
    setSuggestionStatus(item.id, "applied"); // optimistic — the card stays, muted
    const data = await applySuggestion(item.id);
    if (!data) {
      setSuggestionStatus(item.id, "open");
      toast.error("Couldn't apply that", { description: item.title });
      return;
    }
    const n = (data.succeeded || []).length;
    setSuggestionStatus(item.id, "applied", { applied_count: n });
    toast.success(`Paused ${n} ad${n === 1 ? "" : "s"}`, {
      description: item.title,
      duration: 8000,
      action: { label: "Undo", onClick: () => handleUndo(item) },
    });
  };

  const handleDismiss = async (item) => {
    toast("Suggestion dismissed", { description: item.title });
    removeItem("suggestions", item.id);
    await dismissSuggestion(item.id);
  };

  const handleAlertAction = async (item) => {
    toast.info(item.cta, { description: `${item.title} — ${item.client}` });
    await runAlertAction(item.id, item.actionKey);
  };

  const handleMarkDone = async (item) => {
    toast.success("Marked as done", { description: item.title });
    removeItem("wins", item.id);
    await completeWin(item.id);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* ── Greeting ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {dateLabel} · Here&apos;s your day at a glance
          </p>
        </div>
        <StrictnessControl />
      </div>

      {/* ── Suggestions / Activity feed ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[3fr_1fr] gap-6 items-start">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full rounded-full bg-muted/70 p-1">
            {TAB_META.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 h-auto rounded-full px-3 py-1.5 text-xs font-semibold data-[state=active]:shadow-sm"
              >
                {tab.label} · {counts[tab.value]}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="suggestions" className="mt-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
            ) : suggestions.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-10 bg-white border border-border/60 rounded-xl">
                Nothing here right now
              </div>
            ) : (
              suggestions.map((item) => (
                <RecommendationCard
                  key={item.id}
                  item={item}
                  dismissing={dismissingIds.has(item.id)}
                  onApply={handleApply}
                  onUndo={handleUndo}
                  onDismiss={handleDismiss}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="alerts" className="mt-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
            ) : alerts.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-10 bg-white border border-border/60 rounded-xl">
                Nothing here right now
              </div>
            ) : (
              alerts.map((item) => (
                <AlertRow
                  key={item.id}
                  item={item}
                  dismissing={dismissingIds.has(item.id)}
                  onAction={handleAlertAction}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="wins" className="mt-4">
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => <CardSkeleton key={i} />)
            ) : wins.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-10 bg-white border border-border/60 rounded-xl">
                Nothing here right now
              </div>
            ) : (
              wins.map((item) => (
                <WinRow
                  key={item.id}
                  item={item}
                  dismissing={dismissingIds.has(item.id)}
                  onMarkDone={handleMarkDone}
                />
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* ── Activity feed ────────────────────────────────────────── */}
        <div className="bg-white border border-border/60 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              <h2 className="font-semibold text-foreground text-sm">Activity feed</h2>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">Changes today · {activity.length}</span>
          </div>
          <div className="flex flex-col gap-4">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                    <div className="flex-1 flex flex-col gap-1.5">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))
              : activity.map((a) => <ActivityItem key={a.id} {...a} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
