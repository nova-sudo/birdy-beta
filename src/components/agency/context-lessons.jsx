"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, CalendarDays, DollarSign, Euro, PoundSterling, RefreshCw, TriangleAlert } from "lucide-react";
import { Button, Card, Notice, Skeleton, buttonVariants, cn } from "@/components/by";
import { SubHeading } from "@/components/agency/context-parts";
// Where a lesson came from and its icon: the same words and picks as the Media Buying Agent's own Lessons tab.
import { lessonIcon, sourceLabel } from "@/components/agents/stock/LessonsTab";
import { STOCK_AGENT_PATH, parseServerDate, shortDay, useLessons, useStockAgent } from "@/lib/stock-agent-api";
import { DEFAULT_DATE_PRESET } from "@/lib/constants";
import { useClientGroups } from "@/lib/useClientGroups";

const TONE = new Map([
  [TriangleAlert, "bg-by-accent-soft text-by-accent"],
  [RefreshCw, "bg-by-success-bg text-by-success"],
  [CalendarDays, "bg-by-buyer-bg text-by-buyer"],
  [PoundSterling, "bg-by-warning-bg text-by-warning"],
  [DollarSign, "bg-by-warning-bg text-by-warning"],
  [Euro, "bg-by-warning-bg text-by-warning"],
  [BookOpen, "bg-by-accent-soft text-by-accent"],
]);

const newestFirst = (a, b) => (parseServerDate(b.created_at)?.getTime() ?? 0) - (parseServerDate(a.created_at)?.getTime() ?? 0);
const MANAGE_HREF = `${STOCK_AGENT_PATH}?tab=lessons`;

/**
 * Media Buyer's lessons from chat on its Context page: what it has been told, newest first, where
 * each came from and how often it was used. Read from the Media Buying Agent (GET /api/agents/{id}/lessons);
 * they are kept, overruled and taught on that agent's own page.
 */
export function LessonsSection() {
  const { agent, isLoading: agentLoading, error: agentError } = useStockAgent();
  const { lessons, error, isLoading, mutate } = useLessons(agent?.id);
  const { clientGroups } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false });
  const nameOf = (gid) => clientGroups.find((g) => g.id === gid)?.name ?? "A client";
  const active = useMemo(() => [...lessons].filter((l) => l.status !== "overruled" && l.active !== false).sort(newestFirst), [lessons]);

  const loading = agentLoading || (agent && isLoading && lessons.length === 0);
  const manage = agent && <Link href={MANAGE_HREF} className={buttonVariants({ kind: "ghost", size: "sm", className: "text-by-accent hover:bg-by-accent-soft hover:text-by-accent" })}>Manage lessons<ArrowUpRight aria-hidden="true" /></Link>;

  return (
    <section aria-labelledby="cx-lessons" className="mt-1 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <SubHeading id="cx-lessons">Lessons from chat</SubHeading>
          {!loading && agent && !error && (
            <p className="text-by-body-sm text-by-text-2 tabular-nums">{active.length === 0 ? "No lessons yet." : `${active.length === 1 ? "1 lesson" : `${active.length} lessons`}. Birdy uses these on every run.`}</p>
          )}
        </div>
        {manage}
      </div>
      {agentError || (error && lessons.length === 0) ? (
        <Notice tone="danger" action={<Button size="sm" onClick={() => mutate()}>Retry</Button>}>Couldn’t load the lessons. Check your connection and try again.</Notice>
      ) : loading ? (
        <Card aria-busy="true" aria-label="Loading lessons" className="px-4 py-4"><Skeleton className="w-56" /><Skeleton className="mt-3 w-80 max-w-full" /></Card>
      ) : !agent ? (
        <Card className="px-5 py-4 text-by-body text-by-text-2">Lessons come from the Media Buying Agent. Once it is set up, what you tell it to do differently shows here.</Card>
      ) : active.length === 0 ? (
        <Card className="px-5 py-4 text-by-body text-by-text-2">Tell Media Buyer what to do differently, in Chat or on a card, and it keeps it as a lesson here.</Card>
      ) : (
        <ul aria-label="Lessons" className="flex flex-col gap-2">
          {active.map((l) => {
            const Icon = lessonIcon(l);
            const uses = Number(l.uses) || 0;
            const meta = [l.client_group_id ? nameOf(l.client_group_id) : "All clients", sourceLabel(l, nameOf), l.created_at ? shortDay(l.created_at) : null].filter(Boolean).join(" · ");
            return (
              <li key={l.id}>
                <Card className="flex items-center gap-3.5 px-3.5 py-3">
                  <span aria-hidden="true" className={cn("grid size-9 shrink-0 place-items-center rounded-[10px] [&_svg]:size-[18px]", TONE.get(Icon))}><Icon /></span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-by-caption text-by-muted">{meta}</span>
                    <span className="text-by-body-lg leading-[1.3] font-semibold text-by-text [overflow-wrap:anywhere]">{l.text}</span>
                  </span>
                  <span className="shrink-0 text-by-body-sm whitespace-nowrap text-by-muted tabular-nums">
                    {uses > 0 ? <><b className="font-by-display text-by-body-lg font-bold text-by-text">{uses}×</b> used</> : "Not used yet"}
                  </span>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
