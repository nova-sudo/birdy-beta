"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Bot } from "lucide-react";
import { AgentAvatar, AskBar, Button, ChatSender, Notice, Segmented, Skeleton } from "@/components/by";
import { ChatThread } from "@/components/agency/chat/thread";
import { SubAgentProposal } from "@/components/agency/chat/sub-agent-proposal";
import { useAgentChat } from "@/components/agency/chat/use-agent-chat";
import { agentInfo } from "@/lib/agent-route";
import { useSubAgents } from "@/lib/sub-agents";
import { AGENT_NAMES, finishSubAgents } from "@/lib/team-setup";
import { saveError } from "./interview/form-shell";

const PARENTS = ["media_buyer", "sales_coach"];
const ASK = "Which sub-agents would help my agency? Propose the ones worth having.";
const face = <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-by-md bg-by-sunken text-by-text-2 [&>svg]:size-4"><Bot /></span>;

/** A record waiting for approval, shaped as the chat's proposal so the same card draws it. */
const asProposal = (record) => ({ id: record.id, kind: "sub_agent", status: "pending", payload: { sub_agent: record } });

/**
 * The last setup step: the sub-agents Media Buyer and Sales Coach propose,
 * each with its card to approve, and a chat to ask either of them for ideas.
 * Finish (or Skip for now) tells the server the step is done.
 *
 * @param {object} props.team the normalized team state
 * @param {(body: object) => unknown} props.onApply puts the state the server returned into the cache
 * @param {() => void} props.onDone where to go once it is finished
 */
export function SubAgentsStep({ team, onApply, onDone }) {
  const buyer = useSubAgents("media_buyer");
  const coach = useSubAgents("sales_coach");
  const lists = { media_buyer: buyer, sales_coach: coach };
  const [asking, setAsking] = useState("media_buyer");
  const chat = useAgentChat({ sessionKey: `team_setup_subs_${asking}`, page: "team_setup", agent: asking });
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);
  const done = team.agents.sub_agents.status === "done";
  // On a phone the proposal cards drop their step bar for a one-line "Step 2 of 6".
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(max-width: 639px)");
    if (!mq) return undefined;
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  const waiting = PARENTS.flatMap((p) => lists[p].subAgents.filter((s) => s.status === "proposed"));
  const working = PARENTS.reduce((n, p) => n + lists[p].subAgents.filter((s) => s.status === "active").length, 0);
  const loading = buyer.isLoading || coach.isLoading;
  const refresh = () => { buyer.mutate(); coach.mutate(); };

  const finish = async (skipped) => {
    setBusy(skipped ? "skip" : "finish");
    setProblem(null);
    try {
      await onApply(await finishSubAgents(skipped));
      onDone();
    } catch (err) {
      setProblem(saveError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex w-full flex-col gap-5 px-4 py-6 sm:px-7">
          <div className="flex flex-col gap-1.5">
            <ChatSender name="Sub-agents" avatar={face} />
            <div className="flex flex-col gap-3 text-by-body-lg text-by-text sm:pl-10 [&_p]:leading-relaxed">
              <p>
                Sub-agents are small helpers that {AGENT_NAMES.media_buyer} and {AGENT_NAMES.sales_coach} run for you, each with one job.
                Nothing runs until you approve it. {done ? "This step is done; you can still approve the ones waiting." : "You can skip this and add them later from each agent’s Context."}
              </p>
            </div>
          </div>

          <section aria-labelledby="subs-waiting" className="flex flex-col gap-3 sm:pl-10">
            <h2 id="subs-waiting" className="font-by-display text-by-body-lg font-semibold text-by-text">
              Waiting for you{!loading ? ` · ${waiting.length}` : ""}
              {working > 0 && <span className="ml-2 text-by-body-sm font-normal text-by-muted">{working} already working</span>}
            </h2>
            {loading ? (
              <div aria-busy="true" aria-label="Loading sub-agents" className="flex flex-col gap-2"><Skeleton className="h-24 w-full rounded-by-lg" /></div>
            ) : waiting.length ? (
              waiting.map((record) => <SubAgentProposal key={record.id} proposal={asProposal(record)} onUpdate={refresh} compact={narrow} />)
            ) : (
              <p className="text-by-body text-by-muted">Nothing proposed yet. Ask either agent for ideas below.</p>
            )}
            {(buyer.error || coach.error) && <Notice tone="warning">Some sub-agents couldn’t be loaded.</Notice>}
          </section>

          <section aria-label="Ask for ideas" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 sm:pl-10">
              <Segmented
                aria-label="Who to ask"
                items={PARENTS.map((p) => ({ value: p, label: AGENT_NAMES[p] }))}
                value={asking}
                onValueChange={setAsking}
              />
              {chat.messages.length === 0 && (
                <Button size="sm" loading={chat.loading} onClick={() => chat.send(ASK)}>Ask {AGENT_NAMES[asking]} for ideas</Button>
              )}
            </div>
            <ChatThread chat={{ ...chat, updateProposal: (id, patch) => { chat.updateProposal(id, patch); refresh(); } }} name={AGENT_NAMES[asking]} avatar={<AgentAvatar info={agentInfo(asking)} size={32} />} partPlacement="inline" />
          </section>

          {problem && <Notice tone="danger">{problem}</Notice>}
          <div className="flex flex-wrap items-center gap-2 sm:pl-10">
            {done ? (
              <Button kind="primary" onClick={onDone}>Open Birdy<ArrowRight aria-hidden="true" /></Button>
            ) : (
              <>
                <Button kind="primary" loading={busy === "finish"} disabled={Boolean(busy)} onClick={() => finish(false)}>Finish<ArrowRight aria-hidden="true" /></Button>
                <Button kind="ghost" loading={busy === "skip"} disabled={Boolean(busy)} onClick={() => finish(true)}>Skip for now</Button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="shrink-0 px-4 pb-5 sm:px-7">
        <div className="mx-auto w-full max-w-[720px]">
          <AskBar placeholder={`Ask ${AGENT_NAMES[asking]} about sub-agents`} busy={chat.loading} onSubmit={chat.send} />
        </div>
      </div>
    </div>
  );
}
