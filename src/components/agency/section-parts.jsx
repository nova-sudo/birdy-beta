"use client";

// Pieces every agent section's tabs are built from: the date range in the
// address, the header's range menu, the "Scoped to" line, the ask bar with
// the conversation column it opens, the chart card and the loading shape.
// Page-level: they wire the kit to the app's data and routes.

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Calendar, CheckCircle2, MessageSquare } from "lucide-react";
import {
  AskBar, AskPanel, Button, Card, Delta, DropdownTrigger, EmptyState, KpiTile, LineChart, Menu, MenuContent, MenuItem, MenuTrigger, Notice, Skeleton, TabPill,
} from "@/components/by";
import { ChatThread } from "@/components/agency/chat/thread";
import { useAgentChat } from "@/components/agency/chat/use-agent-chat";
import { sectionTabHref } from "@/components/agency/tabs";
import { isActive } from "@/lib/client-status";
import { statusOf } from "@/lib/clients-list";
import { DATE_PRESETS, DEFAULT_DATE_PRESET } from "@/lib/constants";
import { rememberSectionChat } from "@/lib/section-chats";

export const STATUS_WORDS = { danger: "At risk", warning: "At risk", ok: "On track", off: "Inactive" };
export const NOTE_TONE = { bad: "text-by-danger", good: "text-by-success" };
/** The page body of every section tab: the canvas, the body font, the selection colour. */
export const PAGE = "flex min-h-0 flex-1 flex-col bg-by-canvas font-by-body text-by-body text-by-text selection:bg-by-accent-line selection:text-by-text";

/** "Last 7 Days" -> "Last 7 days". */
export const sentence = (label) => label.charAt(0) + label.slice(1).toLowerCase();

/** The header's line under the section name when it is narrowed to one client. */
export function scopedSubtitle(client) {
  return client ? <>Scoped to <b className="font-semibold text-by-text">{client.name}</b> · {STATUS_WORDS[statusOf(client)]}</> : undefined;
}

/** The date range the address carries (`?range=`), with its words and a way to change it. */
export function useAddressRange() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const requested = search.get("range");
  const preset = DATE_PRESETS.some((p) => p.value === requested) ? requested : DEFAULT_DATE_PRESET;
  const label = sentence(DATE_PRESETS.find((p) => p.value === preset).label);
  const setPreset = (value) => {
    const next = new URLSearchParams(search.toString());
    if (value === DEFAULT_DATE_PRESET) next.delete("range");
    else next.set("range", value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };
  return { preset, label, setPreset };
}

/** The header's date range menu. */
export function RangeMenu({ preset, label, onPick }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <DropdownTrigger leading={<Calendar aria-hidden="true" />} aria-label={`Date range: ${label}`}>
          <span className="font-semibold">{label}</span>
        </DropdownTrigger>
      </MenuTrigger>
      <MenuContent align="end" className="max-h-80 overflow-y-auto">
        {DATE_PRESETS.map((p) => (
          <MenuItem key={p.value} selected={p.value === preset} onSelect={() => onPick(p.value)}>{sentence(p.label)}</MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

/** Money in the account's currency, whole or to the penny. */
export function useMoney(symbol = "") {
  return useMemo(() => {
    const money = (n, decimals = 0) => `${symbol}${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    const format = {
      money: (n) => money(n),
      money2: (n) => money(n, 2),
      count: (n) => Math.round(n).toLocaleString("en-GB"),
      percent: (n) => `${Math.round(n)}%`,
      minutes: (n) => `${Math.round(n).toLocaleString("en-GB")} min`,
    };
    return { money, format };
  }, [symbol]);
}

/**
 * A section's conversation for one place, limited to the client the page is narrowed to.
 * @param {import("./sections").SectionConfig} section
 * @param {string} place what this conversation is about, e.g. "ask" or "ask_table"; the client id is added
 * @param {object|null} client the client group the page shows, if any
 */
export function useSectionChat(section, place, client) {
  // Remembered as it starts, so "Open in Chat" finds it in the section's conversation list.
  const onSessionId = useCallback((id) => rememberSectionChat(section.key, id), [section.key]);
  return useAgentChat({
    sessionKey: `by_${section.chat.session}_${place}_${client?.id ?? "agency"}`,
    page: section.chat.page,
    agent: section.chat.agent,
    client: client && isActive(client) ? { id: client.id, name: client.name } : null,
    onSessionId,
  });
}

/**
 * The ask bar and, once a question is sent, the conversation column beside the page.
 * `children` is the page body; with `floating` it scrolls under a bar that floats over its foot,
 * otherwise the bar sits under it (for pages whose table scrolls inside itself).
 */
export function AskDock({ section, chat, placeholder, title, floating = true, children }) {
  const router = useRouter();
  const search = useSearchParams();
  const [asking, setAsking] = useState(false);
  const ask = (text) => {
    setAsking(true);
    chat.send(text);
  };
  const bar = <AskBar className={floating ? "pointer-events-auto mx-auto max-w-[820px]" : "mx-auto max-w-[820px]"} placeholder={placeholder} busy={chat.loading} onSubmit={ask} />;
  return (
    <div className="flex min-h-0 flex-1">
      <div className="relative flex min-w-0 flex-1 flex-col">
        {children}
        <div className={floating ? "pointer-events-none absolute inset-x-0 bottom-0 px-7 pb-5" : "shrink-0 px-7 pb-5"}>{bar}</div>
      </div>
      {asking && (
        <AskPanel
          title={title ?? section.kit.name}
          onClose={() => setAsking(false)}
          follow={`${chat.messages.length}-${chat.loading}`}
          actions={chat.sessionId && (
            <Button kind="ghost" size="sm" onClick={() => router.push(sectionTabHref(section, "chat", search, { c: chat.sessionId }))}>
              <MessageSquare aria-hidden="true" />Open in Chat
            </Button>
          )}
        >
          <ChatThread chat={chat} name={section.kit.name} compact />
        </AskPanel>
      )}
    </div>
  );
}

/** The large tiles at the top of Bird's Eye. */
export function Tiles({ tiles, format }) {
  return (
    <div className={tiles.length === 3 ? "grid gap-2.5 sm:grid-cols-3" : "grid grid-cols-2 gap-2.5 lg:grid-cols-4"}>
      {tiles.map((t) => (
        <KpiTile
          key={t.key}
          size="lg"
          label={t.label}
          value={t.value}
          format={format[t.kind]}
          delta={t.delta != null && <Delta value={t.delta} goodWhen={t.goodWhen} />}
          note={t.note && <span className={NOTE_TONE[t.noteTone]}>{t.note}</span>}
        />
      ))}
    </div>
  );
}

/**
 * The per-day chart, switched between figures by a tab pill, with the period before as a dashed line.
 * @param {Record<string, {tab: string, title: string, kind: string}>} props.copy
 * @param {{values: number[], labels: string[], tooltipLabels?: string[], previousValues?: number[]|null, total: string}|undefined} props.series
 */
export function ChartCard({ keys, copy, metric, onMetric, series, delta, goodWhen, format, rangeLabel, loading, empty }) {
  const words = copy[metric];
  return (
    <Card className="px-5 py-4.5">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2.5">
        <div className="min-w-0">
          <h3 className="text-by-body-lg font-semibold">{words.title}</h3>
          <p className="text-by-body-sm text-by-muted">{series?.previousValues ? `${rangeLabel}, against the period before (dashed)` : rangeLabel}</p>
        </div>
        <div className="ml-auto">
          <TabPill aria-label="Chart figure" items={keys.map((key) => ({ value: key, label: copy[key].tab }))} value={metric} onValueChange={onMetric} />
        </div>
      </div>
      {empty ?? (loading ? (
        <Skeleton className="mt-4 h-[220px] w-full rounded-by-md" />
      ) : !series?.values?.length ? (
        <EmptyState icon={<Calendar />} title="Nothing to plot for this range">Try a longer date range.</EmptyState>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-by-display text-[length:1.75rem] leading-[1.15] font-semibold tracking-[-0.01em] tabular-nums">{series.total}</span>
            {delta != null && <Delta value={delta} goodWhen={goodWhen} />}
          </div>
          <LineChart
            key={metric}
            className="mt-1 motion-safe:animate-[by-fade_var(--by-dur-base)_var(--by-ease-out)]"
            aria-label={`${words.title}, ${rangeLabel.toLowerCase()}`}
            values={series.values}
            previous={series.previousValues ?? undefined}
            labels={series.labels}
            pointLabels={series.tooltipLabels}
            format={format[words.kind]}
            integers={words.kind === "count"}
          />
        </>
      ))}
    </Card>
  );
}

/** A funnel's verdict under it: what is wrong and the two numbers that prove it, or that it is fine. */
export function Diagnosis({ diagnosis }) {
  if (!diagnosis) return null;
  const problem = diagnosis.state === "problem";
  return (
    <Notice
      className="mt-4 items-start"
      tone={problem ? "danger" : "success"}
      icon={problem ? <AlertTriangle aria-hidden="true" className="mt-0.5" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5" />}
    >
      <b className="block font-by-display font-semibold">{diagnosis.title}</b>
      {diagnosis.body && <span className="text-by-text-2">{diagnosis.body}</span>}
    </Notice>
  );
}

/** A card's heading row: the title, a line under it, and an optional link on the right. */
export function CardHead({ title, sub, action }) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="text-by-body-lg font-semibold">{title}</h3>
        {sub && <p className="text-by-body-sm text-by-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/** Bird's Eye's shape while the figures load. */
export function LoadingBody({ tiles = 4 }) {
  return (
    <div aria-busy="true" aria-label="Loading figures" className="flex flex-col gap-3.5">
      <div className={tiles === 3 ? "grid gap-3 sm:grid-cols-3" : "grid grid-cols-2 gap-3 lg:grid-cols-4"}>
        {Array.from({ length: tiles }, (_, i) => (
          <Card key={i} className="px-4 py-3.5"><Skeleton className="w-16" /><Skeleton className="mt-3 h-6 w-24" /><Skeleton className="mt-3 w-28" /></Card>
        ))}
      </div>
      <Card className="px-5 py-4.5"><Skeleton className="w-40" /><Skeleton className="mt-4 h-[220px] w-full rounded-by-md" /></Card>
      <div className="grid gap-3.5 lg:grid-cols-2">
        {[0, 1].map((i) => <Card key={i} className="px-5 py-4.5"><Skeleton className="w-44" /><Skeleton className="mt-4 h-28 w-full rounded-by-md" /></Card>)}
      </div>
    </div>
  );
}
