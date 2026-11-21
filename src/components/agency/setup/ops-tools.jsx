"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button, Notice, TextField } from "@/components/by";
import { callingTool } from "@/lib/setup-steps";
import { Bubble, Chips, ConnectCard, Reply } from "./chat-parts";

/** A connection's card state: what the account says, unless a hop is in flight or just failed. */
const cardState = (step, pending) => (pending === "connecting" || pending === "error" ? pending : step === "issue" ? "issue" : step === "done" ? "done" : "todo");

/** Meta and GoHighLevel, each connected with its own login (an OAuth hop that comes back here). */
export function ToolsStep({ ctx }) {
  const { steps, actions, agentName } = ctx;
  return (
    <Bubble name={agentName} id="step-meta">
      <p>Got it. Now your tools: I read your ads from Meta and your leads from GoHighLevel.</p>
      <div className="flex max-w-xl flex-col gap-2.5">
        <ConnectCard
          name="Meta"
          what="Ads, spend and leads. I can’t post or spend for you."
          state={cardState(steps.meta, actions.pending.meta)}
          problem={actions.pending.meta === "error" ? actions.errors.meta : "Your Meta login has expired. Connect it again."}
          onConnect={() => actions.startOAuth("meta")}
        />
        <span id="step-ghl" className="scroll-mt-24" />
        <ConnectCard
          name="GoHighLevel"
          what="Sub-accounts, contacts and pipelines. I never change your data."
          state={cardState(steps.ghl, actions.pending.ghl)}
          problem={actions.errors.ghl}
          onConnect={() => actions.startOAuth("ghl")}
        />
      </div>
    </Bubble>
  );
}

const TOOLS = { "GoHighLevel calling": "ghl", "Hot Prospector": "hp", "We don’t call our leads": "none" };
const ANSWER = { ghl: "GoHighLevel calling", hp: "Hot Prospector", none: "We don’t call our leads" };

/** Where calls come from: GoHighLevel, Hot Prospector (an API key), or nowhere yet. */
export function CallingStep({ ctx }) {
  const { facts, steps, actions, agentName } = ctx;
  const tool = callingTool(facts);
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);

  const pick = async (label) => {
    setBusy(label);
    setProblem(null);
    try {
      await actions.saveAnswers({ sales_tool: TOOLS[label] });
    } catch (e) {
      setProblem(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Bubble name={agentName} id="step-calling">
        <p>Both connected. How does your team call leads?</p>
        {!tool && steps.calling !== "done" && (
          <>
            <Chips label="How your team calls leads" items={Object.keys(TOOLS)} onPick={pick} busy={busy} />
            {problem && <Notice tone="danger">{problem}</Notice>}
          </>
        )}
      </Bubble>
      {tool && <Reply>{ANSWER[tool]}</Reply>}
      {tool === "hp" && <HotProspector ctx={ctx} onChange={() => pick("GoHighLevel calling")} />}
      {tool === "ghl" && <Bubble name={agentName}><p>Good: I’ll read calls from GoHighLevel, so there’s nothing else to connect.</p></Bubble>}
      {tool === "none" && <Bubble name={agentName}><p>Fine. I’ll leave calls out for now; connect a dialler from Settings whenever you start calling.</p></Bubble>}
      {!tool && steps.calling === "done" && <Bubble name={agentName}><p>Your clients already say where their calls come from, so there’s nothing to connect here.</p></Bubble>}
    </>
  );
}

/** Hot Prospector's API UID and key. The form waits until we know no key is on file. */
function HotProspector({ ctx, onChange }) {
  const { steps, actions, agentName } = ctx;
  const [uid, setUid] = useState("");
  const [key, setKey] = useState("");
  const [visible, setVisible] = useState(false);
  const connected = steps.calling === "done";
  const state = connected ? "done" : actions.pending.hp === "connecting" ? "connecting" : actions.pending.hp === "error" ? "error" : "todo";
  const submit = (e) => {
    e.preventDefault();
    actions.connectHp(uid, key);
  };
  return (
    <Bubble name={agentName}>
      <div className="flex max-w-xl flex-col gap-2.5">
        <ConnectCard name="Hot Prospector" what="Calls, recordings and outcomes" state={state === "error" ? "todo" : state}>
          {!connected && (
            <form onSubmit={submit} className="mt-3 flex flex-col gap-2.5 border-t border-by-line-soft pt-3">
              <p className="text-by-body-sm text-by-text-2">Paste your API UID and key. Both are in your Hot Prospector settings.</p>
              <TextField aria-label="API UID" placeholder="API UID" value={uid} onChange={(e) => setUid(e.target.value)} autoComplete="off" spellCheck={false} />
              <TextField
                aria-label="API key"
                placeholder="API key"
                type={visible ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-by-sm text-by-body-sm text-by-text-2 hover:text-by-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent" onClick={() => setVisible((v) => !v)}>
                {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                {visible ? "Hide the key" : "Show the key"}
              </button>
              {state === "error" && <Notice tone="danger"><b>That key was rejected.</b> {actions.errors.hp}</Notice>}
              <div className="flex flex-wrap gap-2">
                <Button kind="primary" type="submit" loading={state === "connecting"} disabled={!uid.trim() || !key.trim()}>
                  {state === "error" ? "Try again" : "Connect Hot Prospector"}
                </Button>
                <Button kind="ghost" onClick={onChange}>Use GoHighLevel calling instead</Button>
              </div>
            </form>
          )}
        </ConnectCard>
      </div>
    </Bubble>
  );
}
