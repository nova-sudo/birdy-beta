"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AgentPart, ChatSender, ChatTyping, Notice, RouteMap, UserMessage, cn } from "@/components/by";
// What a reply can carry (forms, metric cards, charts) is drawn by the app's existing chat blocks.
import ChatUIBlock from "@/components/chat/ChatUIBlock";
import CreativeTestCard from "@/components/chat/blocks/CreativeTestCard";
import InlineChart from "@/components/chat/blocks/InlineChart";
import MetricCard from "@/components/chat/blocks/MetricCard";
import StatsGrid from "@/components/chat/blocks/StatsGrid";
import StatusBadge from "@/components/chat/blocks/StatusBadge";
import { mdComponents } from "@/lib/chat-markdown";
import { delatex } from "@/lib/chat-math";
import { parseChatUI } from "@/lib/chat-ui-parser";
import { findStep, normalizeRoute, routeWorthShowing } from "@/lib/agent-route";
import { AgentLocked } from "@/components/agency/agent-locked";
import { ReplyProposals } from "./proposal-card";

const PROSE =
  "prose prose-sm max-w-none font-by-body text-by-text prose-headings:font-by-display prose-headings:font-semibold prose-headings:text-by-text " +
  "prose-p:my-1.5 prose-p:text-by-body-lg prose-p:text-by-text prose-strong:text-by-text prose-a:text-by-accent prose-ul:my-1.5 prose-li:my-0.5 prose-li:text-by-body-lg " +
  "prose-code:rounded-by-sm prose-code:bg-by-accent-soft prose-code:px-1 prose-code:text-by-accent";

/**
 * The white surface an agent's message sits on in the setup chats, so it is
 * easy to find against the page. Forms go under it in their own card.
 */
export const AGENT_BUBBLE = "w-fit max-w-full rounded-by-xl rounded-tl-by-sm border border-by-line bg-by-surface px-4 py-3 shadow-by-card";

/** The words inside a markdown node, to tell whether a line is a question. */
const textOf = (node) => (typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(textOf).join("") : node?.props ? textOf(node.props.children) : "");

/** Paragraphs in a bubble: full-strength text, and the question line a little heavier. */
const bubbleMd = {
  ...mdComponents,
  p: ({ children }) => (
    <p className={cn("my-1.5 text-by-body-lg leading-relaxed text-by-text first:mt-0 last:mb-0", textOf(children).trim().endsWith("?") && "font-medium")}>{children}</p>
  ),
};

/** One reply's body: its text, and any form, figure or chart it carries. */
function ReplyBody({ message, index, onUISubmit, onSend, submittedUIs, bubble = false, contentOf }) {
  const { segments } = parseChatUI(contentOf ? contentOf(message) : message.content);
  if (bubble && !segments.some((seg) => seg.type !== "text" || seg.content.trim())) return null;
  return (
    <div className={cn(PROSE, bubble && AGENT_BUBBLE)}>
      {segments.map((seg, i) => {
        const key = `${index}-${i}`;
        switch (seg.type) {
          case "text": return <ReactMarkdown key={key} remarkPlugins={[remarkGfm]} components={bubble ? bubbleMd : mdComponents}>{delatex(seg.content)}</ReactMarkdown>;
          case "ui": return <ChatUIBlock key={key} fields={seg.fields} disabled={submittedUIs?.includes(key)} onSubmit={(values) => onUISubmit?.(key, values)} />;
          case "metric": return <MetricCard key={key} payload={seg.payload} />;
          case "chart": return <InlineChart key={key} payload={seg.payload} />;
          case "status": return <StatusBadge key={key} payload={seg.payload} />;
          case "stats": return <StatsGrid key={key} payload={seg.payload} />;
          case "creative": return <CreativeTestCard key={key} data={seg.payload} onSend={onSend} />;
          default: return null;
        }
      })}
    </div>
  );
}

// The agent's part docked on the right of the chat page: its width, the gap
// it keeps from the messages, and the narrowest message area that still
// leaves the thread readable beside it. Below that, the part opens inline.
const DOCK_WIDTH = 340;
const DOCK_GAP = 24;
const DOCK_MIN_AREA = 760;

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const cssEscape = (v) => (globalThis.CSS?.escape ? CSS.escape(v) : String(v).replace(/["\\]/g, "\\$&"));

function scrollParent(el) {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

/**
 * Where the docked part sits: over the right edge of the thread's scrolling
 * area, from its top to its bottom. The messages make room for it by moving
 * left into the empty margin first (`shift`) and only then narrowing (`pad`),
 * so none of them sit under it. `fits` is false when the area is too narrow
 * for a column beside the thread.
 */
function useDock(rootRef, active) {
  const [dock, setDock] = useState(null);
  useIsoLayoutEffect(() => {
    if (!active) return setDock(null);
    const root = rootRef.current;
    const scroller = scrollParent(root);
    if (!root || !scroller) return setDock({ fits: false });
    const measure = () => {
      const area = scroller.getBoundingClientRect();
      const right = area.left + scroller.clientWidth;
      // The box the thread is centred in, which does not move when the thread does.
      const box = root.parentElement.getBoundingClientRect();
      const css = getComputedStyle(root.parentElement);
      const ownLeft = box.left + parseFloat(css.paddingLeft || 0);
      const ownRight = box.right - parseFloat(css.paddingRight || 0);
      const left = right - DOCK_WIDTH;
      const pad = Math.max(0, Math.round(ownRight - (left - DOCK_GAP)));
      const shift = Math.max(0, Math.min(pad, Math.round(ownLeft - area.left - DOCK_GAP)));
      setDock({
        fits: scroller.clientWidth >= DOCK_MIN_AREA,
        pad,
        shift,
        // The scrollbar's width: the thread is centred in the area beside it, not under it.
        gutter: Math.max(0, Math.round(scroller.offsetWidth - scroller.clientWidth)),
        style: { top: area.top, left, width: DOCK_WIDTH, height: scroller.clientHeight },
      });
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(scroller);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [active, rootRef]);
  return dock;
}

/**
 * A conversation's messages, in order, with the reply in flight at the end.
 *
 * @param {object} props.chat what useAgentChat returns
 * @param {string} props.name who is answering, shown over each reply
 * @param {boolean} [props.compact] the narrow column beside a page: replies are not indented under the sender
 * @param {"auto"|"side"|"inline"} [props.partPlacement] where an agent's part opens when its box on a route map is
 *   pressed. auto: beside the thread when there is room for it, otherwise under the map. Compact threads always open it inline.
 * @param {(room: {shift: number, pad: number, gutter: number}|null) => void} [props.onDock] told how the thread column moved to make room
 *   for a docked part (null once it closes), so whatever sits under the thread (the composer) can line up with it
 * @param {React.ReactNode} [props.avatar] the answering agent's face over its replies; Birdy in its frame when left out
 * @param {(message: object, index: number, info: {last: boolean}) => React.ReactNode} [props.renderAfter] drawn under a
 *   reply, after its proposals: e.g. the form the reply asks for. `last` is true for the newest reply while none is in flight.
 * @param {(message: object, index: number, info: {last: boolean}) => React.ReactNode} [props.renderBelow] like renderAfter,
 *   but drawn after the reply as a thread item of its own (full width, not indented): e.g. the owner's answer to it.
 * @param {boolean} [props.routeMap] false leaves out the route map ("who looked at what") on replies and while they're
 *   written: one light "thinking" line shows instead. The setup chats use this; every other chat keeps the map.
 * @param {boolean} [props.bubbles] the agent's text sits on a white surface, at full strength, with the question in medium weight
 * @param {boolean} [props.proposals] false leaves out the proposals replies carry, for a page that draws them its own way
 * @param {(message: object) => string} [props.contentOf] the text to show for a reply, when the page shortens or rewords it
 * @param {boolean} [props.continues] the thread follows a message from the same agent, so its first reply has no sender line
 *
 * A reply that other agents helped with carries a route map above it; while
 * agents are still at work, the live map stands in for the typing dots.
 */
export function ChatThread({
  chat, name, compact = false, partPlacement = "auto", onDock, avatar, renderAfter, renderBelow,
  routeMap = true, bubbles = false, proposals = true, contentOf, continues = false,
}) {
  const { messages, loading, send, submitUI, submittedUIs, configured, outOfCredits } = chat;
  const shown = messages.filter((m) => !(m.role === "user" && m.content?.startsWith("[UI_RESPONSE]")));
  const indent = compact ? "" : "pl-10";
  const liveRoute = routeMap && loading && chat.route?.steps?.length ? chat.route : null;
  const prevRole = (i) => (i === 0 && continues ? "assistant" : shown[i - 1]?.role);

  // One agent's part is open at a time: `at` is the reply's place in the thread
  // (the reply in flight takes the place it will land in), `step` the agent.
  const [part, setPart] = useState(null);
  const rootRef = useRef(null);
  const routeAt = (at) => (at === shown.length ? liveRoute : shown[at]?.route) ?? null;
  const openRoute = part ? normalizeRoute(routeAt(part.at)) : null;
  const openStep = part ? findStep(openRoute, part.step) : null;
  const wantsSide = !compact && partPlacement !== "inline" && Boolean(openStep);
  const dock = useDock(rootRef, wantsSide);
  const side = wantsSide && (partPlacement === "side" || dock?.fits === true);
  const room = side && dock?.pad ? { shift: dock.shift ?? 0, pad: dock.pad, gutter: dock.gutter ?? 0 } : null;

  // Tell the page how the column moved, once per change, so the composer follows it.
  const told = useRef(null);
  useEffect(() => {
    const key = room ? `${room.shift}:${room.pad}:${room.gutter}` : null;
    if (told.current === key) return;
    told.current = key;
    onDock?.(room);
  });
  useEffect(() => () => onDock?.(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    const was = part;
    setPart(null);
    // Back to the box that opened it.
    if (was) rootRef.current?.querySelector(`[data-route-at="${was.at}"] [data-route-step="${cssEscape(was.step)}"]`)?.focus();
  }, [part]);

  const mapFor = (route, at) => (
    <div data-route-at={at} className="mb-2">
      <RouteMap
        route={route}
        layout={compact ? "stacked" : "auto"}
        selected={part?.at === at ? part.step : null}
        onSelect={(step) => setPart(step ? { at, step } : null)}
      >
        {!side && part?.at === at && openStep ? <AgentPart route={route} stepId={part.step} variant="inline" onClose={close} /> : null}
      </RouteMap>
    </div>
  );

  return (
    <div ref={rootRef} className="flex flex-col gap-5" style={room ? { marginLeft: -room.shift, paddingRight: room.pad } : undefined}>
      {shown.map((message, i) => {
        const info = { last: !loading && i === shown.length - 1 };
        const below = renderBelow?.(message, messages.indexOf(message), info);
        return (
          <Fragment key={i}>
            {message.role === "user" ? (
              <UserMessage>{message.content}</UserMessage>
            ) : (
              <div className="flex flex-col gap-1.5 motion-safe:animate-[by-enter_var(--by-dur-base)_var(--by-ease-out)]">
                {/* The face shows once per run of replies. */}
                {prevRole(i) !== "assistant" && <ChatSender name={name} avatar={avatar} />}
                <div className={indent}>
                  {routeMap && routeWorthShowing(message.route) ? mapFor(message.route, i) : null}
                  <ReplyBody message={message} index={i} onUISubmit={submitUI} onSend={send} submittedUIs={submittedUIs} bubble={bubbles} contentOf={contentOf} />
                  {/* Changes other agents proposed, under the answer that explains them. */}
                  {proposals && <ReplyProposals proposals={message.proposals} onUpdate={chat.updateProposal} compact={compact} />}
                  {renderAfter?.(message, messages.indexOf(message), info)}
                </div>
              </div>
            )}
            {below}
          </Fragment>
        );
      })}
      {loading && (
        <div className="flex flex-col gap-1.5">
          {(shown.length ? shown[shown.length - 1]?.role : prevRole(0)) !== "assistant" && <ChatSender name={name} avatar={avatar} />}
          <div className={indent}>
            {liveRoute ? mapFor(liveRoute, shown.length) : routeMap ? <ChatTyping label={`${name} is replying`} /> : (
              <span className="inline-flex items-center gap-2 text-by-body-sm text-by-muted">
                <ChatTyping label={`${name} is replying`} />
                <span aria-hidden="true">Thinking</span>
              </span>
            )}
          </div>
        </div>
      )}
      {chat.locked && <AgentLocked agent={chat.locked.agent} waitsOn={chat.locked.waits_on} compact />}
      {!configured && (
        <Notice tone="warning" action={<Link href="/settings" className="font-semibold underline">Open Settings</Link>}>Add your AI key in Settings to chat.</Notice>
      )}
      {configured && outOfCredits && (
        <Notice tone="warning" action={<Link href="/credits" className="font-semibold underline">Top up</Link>}>You’re out of Birdy Credits.</Notice>
      )}
      {side && createPortal(
        <aside
          aria-label="Agent’s part"
          className="fixed z-30 overflow-y-auto overscroll-contain border-l border-by-line bg-by-surface p-4 font-by-body text-by-body text-by-text shadow-by-card motion-safe:animate-[by-panel_var(--by-dur-base)_var(--by-ease-out)]"
          style={dock?.style ?? { top: 0, right: 0, bottom: 0, width: DOCK_WIDTH }}
        >
          <AgentPart route={openRoute} stepId={part.step} onClose={close} />
        </aside>,
        document.body,
      )}
    </div>
  );
}
