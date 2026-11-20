"use client";

import { useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowUpRight, Bot, Check, CircleAlert, Info, Megaphone, Minus, Phone, X } from "lucide-react";
import {
  agentChatHref, askedByName, findStep, liveIndex, liveWire, limitMessage, normalizeRoute, routeMeta, routeStatusLabel,
  routeStatusLine, stepMeta, stepStatusLabel,
} from "@/lib/agent-route";
import { BirdyAvatar } from "./avatar";
import { buttonVariants } from "./button";
import { cn } from "./cn";
import { FOCUS_RING } from "./motion";

// One colour pair per agent, the same as the agent's section on the rail.
// `solid` is the tile on a highlighted box, as on the rail when a section is open.
const ROLE = {
  ops: { tile: "bg-by-ops-bg text-by-ops", solid: "bg-by-ops text-by-on-accent", tint: "bg-by-ops-bg" },
  buyer: { tile: "bg-by-buyer-bg text-by-buyer", solid: "bg-by-buyer text-by-on-accent", tint: "bg-by-buyer-bg" },
  coach: { tile: "bg-by-coach-bg text-by-coach", solid: "bg-by-coach text-by-on-accent", tint: "bg-by-coach-bg" },
  neutral: { tile: "bg-by-sunken text-by-text-2", solid: "bg-by-text-2 text-by-on-accent", tint: "bg-by-sunken" },
};
const ICON = { megaphone: Megaphone, phone: Phone, bot: Bot };
const TILE = { 22: "size-[22px] rounded-[7px] [&>svg]:size-3", 32: "size-8 rounded-by-md [&>svg]:size-4" };

// A row needs this much room per agent and per line, or the map stacks.
const NODE_MIN = 136;
const WIRE = 32;
const PAD = 26;

/**
 * An agent's face: Birdy in its round frame, a main agent's section tile, or
 * a sub-agent's neutral tile with a small badge in its main agent's colour.
 *
 * @param {object} props.info `agentInfo()` from lib/agent-route
 * @param {22|32} [props.size]
 * @param {boolean} [props.solid] the strong tile, for a highlighted box
 */
export function AgentAvatar({ info, size = 22, solid = false, className }) {
  if (info?.icon === "mascot") return <BirdyAvatar size={size} className={className} />;
  const Icon = ICON[info?.icon] ?? Bot;
  const parent = info?.parent ? ROLE[{ media_buyer: "buyer", sales_coach: "coach" }[info.parent]] : null;
  const ParentIcon = { media_buyer: Megaphone, sales_coach: Phone }[info?.parent];
  return (
    <span aria-hidden="true" className={cn("relative grid shrink-0 place-items-center", TILE[size] ?? TILE[22], (ROLE[info?.role] ?? ROLE.neutral)[solid ? "solid" : "tile"], className)}>
      <Icon />
      {parent && ParentIcon && (
        <span className={cn("absolute -right-1 -bottom-1 grid size-3 place-items-center rounded-full ring-2 ring-by-surface [&>svg]:size-2", parent.tile)}>
          <ParentIcon strokeWidth={2.6} />
        </span>
      )}
    </span>
  );
}

/** What a box says under the agent's name. */
function stepLine(step) {
  if (step.status === "working") return step.summary || "Working…";
  if (step.status === "failed") return step.summary ? `Couldn’t finish · ${step.summary}` : "Couldn’t finish";
  if (step.status === "skipped") return step.summary ? `Skipped · ${step.summary}` : "Skipped";
  return step.summary;
}

/** Breathes while an agent works; still under "reduce motion". */
function Pulse({ className }) {
  return <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full bg-by-accent motion-safe:animate-[by-pulse_1.2s_ease-in-out_infinite]", className)} />;
}

function Node({ step, selected, live, onSelect, stacked }) {
  const { info } = step;
  const tint = (ROLE[info.role] ?? ROLE.neutral).tint;
  const failed = step.status === "failed";
  const skipped = step.status === "skipped";
  const line = stepLine(step);
  return (
    <button
      type="button"
      data-route-step={step.id}
      aria-pressed={selected}
      onClick={() => onSelect?.(selected ? null : step.id)}
      className={cn(
        "flex min-w-0 cursor-pointer items-center gap-2 rounded-by-md px-2 py-1.5 text-left",
        "transition-colors duration-(--by-dur-fast) ease-by-out",
        FOCUS_RING,
        // No border of its own: the box at work, or the one whose part is open, takes its agent's tint.
        selected || live ? tint : "hover:bg-by-canvas",
        stacked ? "w-full" : "max-w-56 shrink",
      )}
    >
      <span
        className={cn(
          "relative shrink-0",
          // Skipped: a dashed outline and a faded face, so it reads without colour.
          skipped && "rounded-[8px] opacity-55 outline-1 outline-offset-2 outline-by-line-strong outline-dashed grayscale",
        )}
      >
        <AgentAvatar info={info} solid={selected || live} />
        {failed && (
          <span aria-hidden="true" className="absolute -top-1 -right-1 grid size-3 place-items-center rounded-full bg-by-danger-solid text-by-on-accent ring-2 ring-by-surface [&>svg]:size-2">
            <X strokeWidth={3.2} />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("flex items-center gap-1.5 text-by-body-sm font-semibold text-by-text", skipped && "text-by-muted")}>
          <span className="truncate">{info.name}</span>
          {step.status === "working" && <Pulse className="size-1.5" />}
        </span>
        {line && (
          <span className={cn("block truncate text-by-caption text-by-muted", failed && "text-by-danger", skipped && "italic")} title={line}>
            {line}
          </span>
        )}
        <span className="sr-only">
          {`, ${stepStatusLabel(step.status)}`}
          {info.kind === "sub" && info.parentName ? `, sub-agent of ${info.parentName}` : ""}
        </span>
      </span>
    </button>
  );
}

function Wire({ live, faint, stacked }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block",
        stacked ? "ml-[18px] h-3.5 w-0.5" : "mx-1 h-0.5 min-w-6 flex-1",
        // The arrowhead, pointing to the next agent.
        stacked
          ? "after:absolute after:-bottom-1 after:-left-[3px] after:border-4 after:border-transparent after:border-b-0"
          : "after:absolute after:-top-[3px] after:-right-1 after:border-4 after:border-transparent after:border-r-0",
        !live && (faint ? "bg-by-line-strong" : "bg-by-accent-line"),
        // Only the side the arrow points to is coloured; the other two stay transparent.
        stacked
          ? (faint ? "after:border-t-by-line-strong" : live ? "after:border-t-by-accent" : "after:border-t-by-accent-line")
          : (faint ? "after:border-l-by-line-strong" : live ? "after:border-l-by-accent" : "after:border-l-by-accent-line"),
        live && (stacked
          ? "bg-[repeating-linear-gradient(180deg,var(--by-accent)_0_6px,transparent_6px_12px)]"
          : "bg-[repeating-linear-gradient(90deg,var(--by-accent)_0_6px,transparent_6px_12px)]"),
        live && "motion-safe:animate-[by-flow_0.8s_linear_infinite]",
      )}
    />
  );
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** "row" when every agent fits side by side in the card's width, "stacked" otherwise. */
function useAutoLayout(ref, count, forced) {
  const [width, setWidth] = useState(0);
  useIsoLayoutEffect(() => {
    if (forced) return;
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [forced]);
  if (forced) return forced;
  // Not measured yet (the server render, or a test without layout): a row.
  if (!width) return "row";
  return width >= count * NODE_MIN + (count - 1) * WIRE + PAD ? "row" : "stacked";
}

/**
 * The route a reply took between agents: one box per agent, joined by lines,
 * with a few words under each name. While it works, the box at work is
 * highlighted and the line leading to it moves. A footer gives the status,
 * the time and the credits. Each box is a button that opens that agent's part.
 *
 * @param {object} props.route the route from the server (raw or already normalised)
 * @param {string|null} [props.selected] the step whose part is open
 * @param {(stepId: string|null) => void} [props.onSelect] a box was pressed; null when the open one is pressed again
 * @param {"auto"|"row"|"stacked"} [props.layout] auto picks by the card's width
 * @param {React.ReactNode} [props.children] shown inside the card under the footer, e.g. the selected agent's part
 */
export function RouteMap({ route: rawRoute, selected = null, onSelect, layout = "auto", className, children, ...props }) {
  const route = useMemo(() => normalizeRoute(rawRoute), [rawRoute]);
  const ref = useRef(null);
  const mode = useAutoLayout(ref, route?.steps.length ?? 0, layout === "auto" ? null : layout);
  if (!route) return null;

  const stacked = mode === "stacked";
  const live = liveIndex(route);
  const wire = liveWire(route);
  const limit = limitMessage(route.limit_hit);

  return (
    <div
      ref={ref}
      data-layout={mode}
      data-status={route.status}
      className={cn("rounded-by-lg border border-by-line bg-by-surface px-3 pt-3 pb-2.5 font-by-body shadow-by-card", className)}
      {...props}
    >
      <div
        role="group"
        aria-label="Agents in this reply"
        className={stacked ? "flex flex-col items-stretch gap-1" : "flex items-center"}
      >
        {route.steps.map((step, i) => [
          i > 0 && <Wire key={`w-${step.id}`} stacked={stacked} live={i - 1 === wire} faint={step.status === "skipped"} />,
          <Node key={step.id} step={step} stacked={stacked} selected={selected === step.id} live={i === live} onSelect={onSelect} />,
        ])}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-by-caption text-by-muted">
        {route.status === "working" ? <Pulse /> : route.status === "failed"
          ? <CircleAlert aria-hidden="true" className="size-3.5 shrink-0 text-by-danger" />
          : <Check aria-hidden="true" strokeWidth={2.6} className="size-3.5 shrink-0 text-by-success" />}
        <b className="font-semibold text-by-text-2">{routeStatusLabel(route)}</b>
        <span className="min-w-0">{routeStatusLine(route)}</span>
        <span className="ml-auto tabular-nums">{routeMeta(route)}</span>
      </div>

      {limit && (
        <p className="mt-2 flex items-start gap-2 rounded-by-md bg-by-warning-bg px-2.5 py-1.5 text-by-caption text-by-warning">
          <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          {limit}
        </p>
      )}

      {children && <div className="mt-3 border-t border-by-line-soft px-1 pt-3">{children}</div>}
    </div>
  );
}

function Quote({ label, children, tone }) {
  return (
    <div className={cn("rounded-by-md px-3 py-2.5 text-by-body-sm text-by-text", tone === "danger" ? "bg-by-danger-bg" : "bg-by-sunken")}>
      <small className={cn("mb-0.5 block text-by-label font-semibold uppercase tracking-[0.06em]", tone === "danger" ? "text-by-danger" : "text-by-muted")}>{label}</small>
      <span className="whitespace-pre-wrap">{children}</span>
    </div>
  );
}

/**
 * One agent's part of a reply: who asked it what, the tools it used and what
 * each found, its answer and its share of the credits, with a link to its own chat.
 *
 * @param {object} props.route the same route the map shows
 * @param {string} props.stepId which agent's part
 * @param {() => void} [props.onClose] shows a close button; Escape inside the part closes it too
 * @param {"panel"|"inline"} [props.variant] panel: its own card for a side column; inline: plain, inside the map's card
 * @param {string} [props.chatHref] overrides the link to the agent's chat
 */
export function AgentPart({ route: rawRoute, stepId, onClose, variant = "panel", chatHref, className, ...props }) {
  const route = useMemo(() => normalizeRoute(rawRoute), [rawRoute]);
  const step = findStep(route, stepId);
  if (!step) return null;
  const { info } = step;
  const asker = askedByName(route, step);
  const meta = stepMeta(step);
  const title = `${info.name}’s part`;
  const answerLabel = step.status === "failed" ? `${info.name} couldn’t finish` : `${info.name} answered`;
  const answer = step.answer
    ?? (step.status === "working" ? "Still working on it." : step.status === "skipped" ? "This agent was not asked in the end." : step.status === "failed" ? "No answer came back." : step.summary || null);

  return (
    <section
      aria-label={title}
      onKeyDown={(e) => { if (e.key === "Escape" && onClose) { e.stopPropagation(); onClose(); } }}
      className={cn(
        "flex flex-col gap-3 font-by-body text-by-body text-by-text",
        variant === "panel" && "motion-safe:animate-[by-fade_var(--by-dur-base)_var(--by-ease-out)]",
        className,
      )}
      {...props}
    >
      <header className="flex items-center gap-2">
        <AgentAvatar info={info} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-by-body font-semibold">{title}</h3>
          {info.kind === "sub" && info.parentName && <p className="text-by-caption text-by-muted">Sub-agent of {info.parentName}</p>}
        </div>
        {onClose && (
          <button type="button" aria-label={`Close ${title}`} onClick={onClose} className={cn(buttonVariants({ kind: "ghost", size: "sm", iconOnly: true }), "-mr-1")}>
            <X aria-hidden="true" />
          </button>
        )}
      </header>

      {step.question && <Quote label={asker ? `${asker} asked` : "You asked"}>{step.question}</Quote>}

      <div>
        <h4 className="mb-1 text-by-label font-semibold uppercase tracking-[0.06em] text-by-muted">Tools used</h4>
        {step.tools.length ? (
          <ul className="flex flex-col">
            {step.tools.map((tool, i) => (
              <li key={`${tool.name}-${i}`} className="flex items-baseline gap-2 border-b border-by-line-soft py-1.5 text-by-body-sm last:border-b-0">
                {step.status === "working" && i === step.tools.length - 1
                  ? <Pulse className="size-1.5 translate-y-[-2px]" />
                  : <Check aria-hidden="true" strokeWidth={2.6} className="size-3.5 shrink-0 translate-y-0.5 text-by-success" />}
                <span className="min-w-0 flex-1">{tool.label}</span>
                {tool.detail && <span className="shrink-0 text-by-caption text-by-muted tabular-nums">{tool.detail}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-by-body-sm text-by-muted"><Minus aria-hidden="true" className="size-3.5" />No tools used</p>
        )}
      </div>

      {answer && <Quote label={answerLabel} tone={step.status === "failed" ? "danger" : undefined}>{answer}</Quote>}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link href={chatHref ?? agentChatHref(info)} className={cn(buttonVariants({ kind: "soft", size: "sm" }))}>
          Open {info.kind === "sub" && info.parentName ? `${info.parentName}’s` : `${info.name}’s`} chat
          <ArrowUpRight aria-hidden="true" />
        </Link>
        {meta && <span className="ml-auto text-by-caption text-by-muted tabular-nums">{stepStatusLabel(step.status)} · {meta}</span>}
      </div>
    </section>
  );
}
