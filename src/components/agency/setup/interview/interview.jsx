"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AgentAvatar, AskBar, Button, ChatSender, Dialog, DialogBody, DialogContent } from "@/components/by";
import { ChatThread } from "@/components/agency/chat/thread";
import { useAgentChat } from "@/components/agency/chat/use-agent-chat";
import { agentInfo } from "@/lib/agent-route";
import { AGENT_NAMES, answerMessage, answered, knownLines, normalizeTeam, replyBlock, saveStep } from "@/lib/team-setup";
import { KnowsPanel } from "./knows-panel";
import { StepForm, hasForm } from "./step-form";

const INTROS = {
  media_buyer: "I watch your clients’ ads every day and propose changes for you to approve.",
  sales_coach: "I watch how fast new leads get called and how many of them close.",
};
const NEXT = { media_buyer: "Sales Coach", sales_coach: "sub-agents" };

/** The session key of an agent's setup chat. */
export const interviewKey = (agent) => `team_setup_${agent}`;

/** The form data the newest reply asking for `step` carried (the playbook's rules), for editing it later. */
function lastBlockData(messages, step) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const block = replyBlock(messages[i]);
    if (block?.type === step) return block.data;
  }
  return undefined;
}

/**
 * Option C: the agent interviews the owner in a real chat (page "team_setup").
 * The form for the step it is asking sits under its reply; saving it PUTs the
 * answer, takes the server's new state, then tells the agent in a short
 * message so it moves on. "What it knows" on the right edits any answer.
 *
 * @param {"media_buyer"|"sales_coach"} props.agent
 * @param {object} props.team the normalized team state
 * @param {(body: object) => unknown} props.onApply puts the state a save returned into the cache
 * @param {() => void} props.onNext opens the next agent once this one is done
 * @param {{clients: object[], clientsLoading: boolean, currency: string}} props.ctx the account's active clients and currency
 */
export function AgentInterview({ agent, team, onApply, onNext, ctx }) {
  const a = team.agents[agent];
  const name = AGENT_NAMES[agent];
  const avatar = <AgentAvatar info={agentInfo(agent)} size={32} />;
  const chat = useAgentChat({ sessionKey: interviewKey(agent), page: "team_setup", agent });
  const [answeredAt, setAnsweredAt] = useState([]);
  const [editing, setEditing] = useState(null);
  const lines = knownLines(team, agent);
  const count = answered(team, agent);

  // The clients this agent works on: the ones Media Buyer was given, or every active one.
  const watchedIds = team.agents.media_buyer?.values?.clients?.client_group_ids;
  const formCtx = useMemo(() => ({
    ...ctx,
    watched: Array.isArray(watchedIds) ? ctx.clients.filter((g) => watchedIds.includes(g.id)) : ctx.clients,
    onSend: chat.send,
  }), [ctx, watchedIds, chat.send]);

  const save = async (step, body) => {
    const next = await saveStep(agent, step, body);
    await onApply(next);
    return normalizeTeam(next) ?? team;
  };

  const answerFrom = (index, step) => async (body) => {
    const after = await save(step, body);
    setAnsweredAt((list) => [...list, index]);
    chat.send(answerMessage(after, agent, step));
  };

  const renderAfter = (message, index, { last }) => {
    const block = replyBlock(message);
    if (!last || !block || !hasForm(block.type) || !a.order.includes(block.type) || answeredAt.includes(index)) return null;
    return (
      <div className="mt-3">
        <StepForm key={index} step={block.type} initial={a.values[block.type]} data={block.data} ctx={formCtx} onSubmit={answerFrom(index, block.type)} />
      </div>
    );
  };

  // Each new message scrolls into view.
  const scroller = useRef(null);
  useEffect(() => {
    scroller.current?.scrollTo?.({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages.length, chat.loading, a.status]);

  const started = chat.messages.length > 0;
  const editLine = lines.find((l) => l.step === editing);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
      <KnowsPanel name={name} lines={lines} onEdit={setEditing} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div ref={scroller} aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-4 py-6 sm:px-7">
            <div className="flex flex-col gap-1.5">
              <ChatSender name={name} avatar={avatar} />
              <div className="flex flex-col gap-3 text-by-body-lg text-by-text sm:pl-10 [&_p]:leading-relaxed">
                <p>
                  I’m {name}. {INTROS[agent]}{" "}
                  {a.status === "done"
                    ? "I’m set up. You can change any answer on the right."
                    : count.done
                      ? `We’ve done ${count.done} of ${count.total} questions. Let’s carry on.`
                      : `I have ${count.total} questions for you. What I learn shows on the right.`}
                </p>
                {!started && a.status !== "done" && (
                  <div>
                    <Button kind="primary" loading={chat.loading} onClick={() => chat.send(count.done ? "Let’s carry on." : "Hi, let’s get you set up.")}>
                      {count.done ? "Carry on" : "Start"}<ArrowRight aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <ChatThread chat={chat} name={name} avatar={avatar} renderAfter={renderAfter} partPlacement="inline" />
            {a.status === "done" && !chat.loading && (
              <div className="flex flex-col gap-1.5">
                <ChatSender name={name} avatar={avatar} />
                <div className="flex flex-col gap-3 text-by-body-lg text-by-text sm:pl-10">
                  <p><b className="font-semibold">{name} is ready.</b> {NEXT[agent] === "sub-agents" ? "One last step: sub-agents." : `${NEXT[agent]} is unlocked next.`}</p>
                  <div><Button kind="primary" onClick={onNext}>Set up {NEXT[agent]}<ArrowRight aria-hidden="true" /></Button></div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="shrink-0 px-4 pb-5 sm:px-7">
          <div className="mx-auto w-full max-w-[720px]">
            <AskBar placeholder={`Answer ${name}`} busy={chat.loading} onSubmit={chat.send} />
          </div>
        </div>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <DialogContent title={`Change ${editLine?.label ?? "this answer"}`} description={`What ${name} knows now: ${editLine?.value ?? "answered"}`}>
            <DialogBody>
              <StepForm
                step={editing}
                initial={a.values[editing]}
                data={lastBlockData(chat.messages, editing)}
                ctx={{ ...formCtx, onSend: null }}
                saveLabel="Save"
                onSubmit={async (body) => {
                  await save(editing, body);
                  setEditing(null);
                  toast.success(`${editLine?.label ?? "Answer"} saved`);
                }}
              />
            </DialogBody>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
