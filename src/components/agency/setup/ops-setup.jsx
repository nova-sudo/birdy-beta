"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/by";
import { Bubble, Lead } from "./chat-parts";
import { BasicsStep } from "./ops-basics";
import { ClientStep, TargetsStep } from "./ops-clients";
import { ImportStep } from "./ops-import";
import { SlackStep } from "./ops-slack";
import { CallingStep, ToolsStep } from "./ops-tools";

/**
 * Agency Ops' setup chat, in order: the basics, Meta and GoHighLevel, calling,
 * the first client, its targets, Slack, the rest of the clients. Each part
 * appears once the one before it is done, so coming back shows the answers
 * so far and the next question.
 */
export function OpsSetup({ ctx, onFinish, finishing }) {
  const { steps, names } = ctx;
  const done = (id) => steps[id] === "done";
  const tools = done("basics");
  const connected = tools && done("meta") && done("ghl");
  const calling = connected && done("calling");
  const client = calling && steps.client !== "todo";
  const targets = client && done("targets");
  const slack = targets && done("slack");
  const all = slack && done("import");
  return (
    <>
      <BasicsStep ctx={ctx} />
      {tools && <ToolsStep ctx={ctx} />}
      {connected && <CallingStep ctx={ctx} />}
      {calling && <ClientStep ctx={ctx} />}
      {client && <TargetsStep ctx={ctx} />}
      {targets && <SlackStep ctx={ctx} />}
      {slack && <ImportStep ctx={ctx} />}
      {all && (
        <Bubble name={ctx.agentName} id="step-ops-done">
          <p><Lead>{names.ops} is set up.</Lead>{names.buyer} is unlocked: it already knows your clients, tools and targets, so it only needs one thing from you.</p>
          <div className="flex flex-wrap gap-2">
            <Button kind="primary" loading={finishing === "buyer"} disabled={Boolean(finishing)} onClick={() => onFinish("buyer")}>Set up {names.buyer}<ArrowRight aria-hidden="true" /></Button>
            <Button loading={finishing === "app"} disabled={Boolean(finishing)} onClick={() => onFinish("app")}>Open {names.ops}</Button>
          </div>
        </Bubble>
      )}
    </>
  );
}
