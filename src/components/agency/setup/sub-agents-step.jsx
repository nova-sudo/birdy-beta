"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bot, Plus } from "lucide-react";
import { AgentAvatar, AskBar, BirdyAvatar, Button, ChatSender, Notice, Skeleton, UserMessage } from "@/components/by";
import { AGENT_BUBBLE, ChatThread } from "@/components/agency/chat/thread";
import { useAgentChat } from "@/components/agency/chat/use-agent-chat";
import { agentInfo } from "@/lib/agent-route";
import { SUB_AGENT_KIND } from "@/lib/proposals-api";
import { celebrateOnce, teamLines } from "@/lib/setup-celebrations";
import { shortReply, withoutToolNames } from "@/lib/sub-agent-card";
import { approveSubAgent, normalizeSubAgent, rejectSubAgent, useSubAgents } from "@/lib/sub-agents";
import { AGENT_NAMES, finishSubAgents } from "@/lib/team-setup";
import { SetupCelebration } from "./celebration";
import { saveError } from "./interview/form-shell";
import { SubAgentIdea } from "./sub-agent-idea";

const PARENTS = ["media_buyer", "sales_coach"];
export const ASK = "Which sub-agents would help my agency? Propose the ones worth having.";
export const ASK_MORE = "Suggest one more sub-agent that would help my agency.";
const face = <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-by-md bg-by-sunken text-by-text-2 [&>svg]:size-4"><Bot /></span>;
const avatarOf = (parent) => <AgentAvatar info={agentInfo(parent)} size={32} />;
// A reply that lays its ideas out field by field ("Purpose:", "Tools:") repeats what the cards show.
const LISTS_IDEAS = /(?:^|\n)\s*(?:[-*+]\s*)?\**\s*(?:purpose|instructions|tools|schedule|clients)\s*\**\s*:/i;

/** The sub-agents a chat reply proposed, still waiting, as records. */
function chatProposals(messages) {
  const out = [];
  for (const m of messages) {
    for (const p of m.proposals ?? []) {
      if (p?.kind !== SUB_AGENT_KIND || (p.status && p.status !== "pending")) continue;
      const record = normalizeSubAgent(p.payload?.sub_agent);
      if (record?.status === "proposed") out.push({ record, proposalId: p.id });
    }
  }
  return out;
}

/**
 * The last setup step, chat first like the interviews: a short intro and two
 * ways to start (ask Media Buyer or Sales Coach for ideas), then the ideas
 * arrive in the conversation one at a time, each as one card to add, leave
 * out, or change first. What the owner chose shows as their reply. Finish
 * (or Skip for now) tells the server the step is done.
 *
 * @param {object} props.team the normalized team state
 * @param {(body: object) => unknown} props.onApply puts the state the server returned into the cache
 * @param {() => void} props.onDone where to go once it is finished
 */
export function SubAgentsStep({ team, onApply, onDone }) {
  const buyer = useSubAgents("media_buyer");
  const coach = useSubAgents("sales_coach");
  const refresh = () => { buyer.mutate(); coach.mutate(); };
  const chats = {
    media_buyer: useAgentChat({ sessionKey: "team_setup_subs_media_buyer", page: "team_setup", agent: "media_buyer", onSettled: refresh }),
    sales_coach: useAgentChat({ sessionKey: "team_setup_subs_sales_coach", page: "team_setup", agent: "sales_coach", onSettled: refresh }),
  };
  // The conversations in the order they were started; the newest asked is the one the box talks to.
  const [order, setOrder] = useState(() => PARENTS.filter((p) => chats[p].messages.length));
  const [asking, setAsking] = useState(() => order.at(-1) ?? "media_buyer");
  const chat = chats[asking];
  const [decided, setDecided] = useState([]);
  const [deciding, setDeciding] = useState(null);
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);
  const [celebrating, setCelebrating] = useState(false);
  const done = team.agents.sub_agents.status === "done";
  const loading = buyer.isLoading || coach.isLoading;

  const ask = (parent, text = ASK) => {
    setAsking(parent);
    setOrder((list) => (list.includes(parent) ? list : [...list, parent]));
    return chats[parent].send(text);
  };

  // Waiting: the server's proposed records, plus any a reply just proposed that the list hasn't caught up with.
  const waiting = useMemo(() => {
    const server = [...buyer.subAgents, ...coach.subAgents];
    const known = new Set(server.map((s) => s.id));
    const fromChat = PARENTS.flatMap((p) => chatProposals(chats[p].messages)).filter((c) => !known.has(c.record.id)).map((c) => c.record);
    const gone = new Set(decided.map((d) => d.id));
    return [...server.filter((s) => s.status === "proposed"), ...fromChat]
      .filter((s, i, list) => !gone.has(s.id) && list.findIndex((x) => x.id === s.id) === i)
      .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
  }, [buyer.subAgents, coach.subAgents, chats.media_buyer.messages, chats.sales_coach.messages, decided]); // eslint-disable-line react-hooks/exhaustive-deps
  const working = [...buyer.subAgents, ...coach.subAgents].filter((s) => s.status === "active").length;

  // "1 of 2": counted from the last time nothing was waiting.
  const batchFrom = useRef(0);
  const wasEmpty = useRef(true);
  useEffect(() => {
    if (waiting.length && wasEmpty.current) batchFrom.current = decided.length;
    wasEmpty.current = waiting.length === 0;
  }, [waiting.length, decided.length]);
  const inBatch = decided.length - batchFrom.current;
  const current = waiting[0] ?? null;

  // Where the next card goes: after the newest message of the conversation being had, or under the intro.
  const started = order.length > 0;
  const host = chat.loading ? null : chat.messages.length ? `${asking}:${chat.messages.length - 1}` : "intro";

  const decide = async (record, choice) => {
    setDeciding({ id: record.id, choice, failure: null });
    try {
      await (choice === "add" ? approveSubAgent(record.id) : rejectSubAgent(record.id));
      // The reply that proposed it keeps the outcome too.
      for (const p of PARENTS) {
        const hit = chatProposals(chats[p].messages).find((c) => c.record.id === record.id);
        if (hit) chats[p].updateProposal(hit.proposalId, { status: choice === "add" ? "approved" : "dismissed" });
      }
      setDecided((list) => [...list, { id: record.id, name: record.name, choice, at: host ?? "intro" }]);
      setDeciding(null);
      refresh();
    } catch (err) {
      setDeciding({ id: record.id, choice: null, failure: err });
    }
  };

  const finish = async (skipped) => {
    setBusy(skipped ? "skip" : "finish");
    setProblem(null);
    try {
      await onApply(await finishSubAgents(skipped));
      if (celebrateOnce("sub_agents")) setCelebrating(true);
      else onDone();
    } catch (err) {
      setProblem(saveError(err));
    } finally {
      setBusy(null);
    }
  };

  const others = PARENTS.filter((p) => !order.includes(p));
  const added = decided.filter((d) => d.choice === "add").length;

  /** The owner's choices made at `anchor`, and the next card (or the way on) when this is where it goes. */
  const below = (anchor, lastRole) => {
    const answers = decided.filter((d) => d.at === anchor);
    const here = host === anchor;
    if (!answers.length && !here) return null;
    // Straight under the agent's own reply, the card or the way on belongs to it: no second sender line, and 12px from its text.
    const own = !answers.length && lastRole === "assistant";
    return (
      <>
        {answers.map((d) => <UserMessage key={d.id}>{d.choice === "add" ? `Added ${d.name}` : `Not now: ${d.name}`}</UserMessage>)}
        {here && current ? (
          <div className={own ? "-mt-2 flex flex-col" : "flex flex-col gap-1.5"}>
            {!own && <ChatSender name={AGENT_NAMES[current.parent] ?? "Sub-agents"} avatar={current.parent in chats ? avatarOf(current.parent) : face} />}
            <div className="sm:pl-10">
              <SubAgentIdea
                key={current.id}
                record={current}
                position={{ n: inBatch + 1, of: inBatch + waiting.length }}
                busy={deciding?.id === current.id && !deciding.failure ? deciding.choice : null}
                failure={deciding?.id === current.id ? deciding.failure : null}
                onAdd={() => decide(current, "add")}
                onSkip={() => decide(current, "skip")}
                onChanged={refresh}
              />
            </div>
          </div>
        ) : here && (started || decided.length > 0) && !done ? (
          <div className={own ? "-mt-2 flex flex-col" : "flex flex-col gap-1.5"}>
            {!own && <ChatSender name={AGENT_NAMES[asking]} avatar={avatarOf(asking)} />}
            <div className="flex flex-col gap-3 sm:pl-10">
              {inBatch > 0 && (
                <p className={`${AGENT_BUBBLE} text-by-body-lg text-by-text`}>
                  That’s all of them for now.{added ? ` You added ${added}. ${added === 1 ? "It starts" : "They start"} on ${added === 1 ? "its" : "their"} next run.` : ""}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button kind="primary" loading={busy === "finish"} disabled={Boolean(busy)} onClick={() => finish(false)}>Finish<ArrowRight aria-hidden="true" /></Button>
                <Button disabled={chat.loading || Boolean(busy)} onClick={() => ask(asking, ASK_MORE)}><Plus aria-hidden="true" />Suggest another</Button>
                {others.map((p) => <Button key={p} kind="ghost" disabled={Boolean(busy)} onClick={() => ask(p)}>Ask {AGENT_NAMES[p]} for ideas</Button>)}
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  };

  const contentOf = (parent) => (message) => {
    const text = withoutToolNames(message.content, parent);
    const hasCards = (message.proposals ?? []).some((p) => p?.kind === SUB_AGENT_KIND) || LISTS_IDEAS.test(text);
    return hasCards ? shortReply(text) : text;
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex w-full flex-col gap-5 px-4 py-6 sm:px-7">
          <div className="flex flex-col gap-1.5">
            <ChatSender name="Sub-agents" avatar={face} />
            <div className="flex flex-col gap-3 text-by-body-lg text-by-text sm:pl-10 [&_p]:leading-relaxed">
              <p className={AGENT_BUBBLE}>
                Sub-agents are small helpers that {AGENT_NAMES.media_buyer} and {AGENT_NAMES.sales_coach} run for you, each with one job.
                {" "}Nothing runs until you add it.{" "}
                {done ? "This step is done; you can still add more." : working > 0 ? `${working} already working for you.` : "Ask either agent for ideas, or skip this and add them later."}
              </p>
              {!started && !done && (
                <div className="flex flex-wrap items-center gap-2">
                  {PARENTS.map((p, i) => (
                    <Button key={p} kind={i === 0 ? "primary" : "secondary"} onClick={() => ask(p)}>
                      <AgentAvatar info={agentInfo(p)} />Ask {AGENT_NAMES[p]} for ideas
                    </Button>
                  ))}
                </div>
              )}
              {loading && <div aria-busy="true" aria-label="Loading sub-agents"><Skeleton className="h-24 w-full max-w-xl rounded-by-lg" /></div>}
              {(buyer.error || coach.error) && <Notice tone="warning">Some sub-agents couldn’t be loaded.</Notice>}
            </div>
          </div>
          {!loading && below("intro", "assistant")}

          {order.map((p) => (
            <ChatThread
              key={p}
              chat={chats[p]}
              name={AGENT_NAMES[p]}
              avatar={avatarOf(p)}
              partPlacement="inline"
              routeMap={false}
              bubbles
              proposals={false}
              contentOf={contentOf(p)}
              renderBelow={(message, index) => below(`${p}:${index}`, message.role)}
            />
          ))}

          {problem && <Notice tone="danger">{problem}</Notice>}
          <div className="flex flex-wrap items-center gap-2 sm:pl-10">
            {done ? (
              <Button kind="primary" onClick={onDone}>Open Birdy<ArrowRight aria-hidden="true" /></Button>
            ) : (
              <>
                {!started && !decided.length && working > 0 && <Button kind="primary" loading={busy === "finish"} disabled={Boolean(busy)} onClick={() => finish(false)}>Finish<ArrowRight aria-hidden="true" /></Button>}
                <Button kind="ghost" loading={busy === "skip"} disabled={Boolean(busy)} onClick={() => finish(true)}>Skip for now</Button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="shrink-0 px-4 pb-5 sm:px-7">
        <div className="w-full">
          <AskBar placeholder={`Ask ${AGENT_NAMES[asking]} about sub-agents`} busy={chat.loading} onSubmit={(text) => ask(asking, text)} />
        </div>
      </div>

      <SetupCelebration
        open={celebrating}
        onOpenChange={setCelebrating}
        icon={
          <span aria-hidden="true" className="flex items-center -space-x-2">
            <BirdyAvatar size={56} className="ring-4 ring-by-surface" />
            {PARENTS.map((k) => <AgentAvatar key={k} info={agentInfo(k)} size={32} className="size-14 rounded-by-lg ring-4 ring-by-surface [&>svg]:size-7" />)}
          </span>
        }
        title="Your team is set up"
        done={teamLines(team, working)}
        primary={{ label: <>Open Birdy<ArrowRight aria-hidden="true" /></>, onClick: () => { setCelebrating(false); onDone(); } }}
      >
        <p>{AGENT_NAMES.birdy}, {AGENT_NAMES.media_buyer} and {AGENT_NAMES.sales_coach} now work on your clients every day. You approve what they bring you.</p>
      </SetupCelebration>
    </div>
  );
}
