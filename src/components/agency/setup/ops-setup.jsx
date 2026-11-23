"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/by";
import { Bubble, Lead, Say } from "./chat-parts";
import { BasicsStep } from "./ops-basics";
import { ClientStep, TargetsStep } from "./ops-clients";
import { ImportStep } from "./ops-import";
import { SlackStep } from "./ops-slack";
import { CallingStep, ToolsStep } from "./ops-tools";
import { PlanStep } from "./plan-step";

/**
 * Birdy's setup chat, in order: the basics, Meta and GoHighLevel, calling,
 * the plan, the first client, its targets, Slack, the rest of the clients.
 * Each part appears once the one before it is done, so coming back shows the
 * answers so far and the next question. The plan is required: nothing after
 * it shows until it's on. An account that finished setup before plans were
 * required sees the plan straight away.
 *
 * @param {() => void | Promise<void>} props.onPlanActive the plan's subscription is on
 */
export function OpsSetup({ ctx, onFinish, onPlanActive, finishing, completed = false, withTeam = true }) {
  const { steps, names } = ctx;
  const done = (id) => steps[id] === "done";
  const tools = done("basics");
  const connected = tools && done("meta") && done("ghl");
  const calling = connected && done("calling");
  const planOpen = calling || (completed && steps.plan !== "done");
  const plan = calling && done("plan");
  const client = plan && steps.client !== "todo";
  const targets = client && done("targets");
  const slack = targets && done("slack");
  const all = slack && done("import");
  return (
    <>
      <BasicsStep ctx={ctx} />
      {tools && <ToolsStep ctx={ctx} />}
      {connected && <CallingStep ctx={ctx} />}
      {planOpen && <PlanStep facts={ctx.facts} steps={steps} agentName={ctx.agentName} completed={completed} onActive={onPlanActive} />}
      {plan && <ClientStep ctx={ctx} />}
      {client && <TargetsStep ctx={ctx} />}
      {targets && <SlackStep ctx={ctx} />}
      {slack && <ImportStep ctx={ctx} />}
      {all && (
        <Bubble name={ctx.agentName} id="step-ops-done">
          {withTeam ? (
            <Say><Lead>{names.ops} is set up.</Lead>{names.buyer} is next. It already knows your clients, tools and targets, and it will ask you a few questions of its own before it starts.</Say>
          ) : (
            <Say><Lead>{names.ops} is set up.</Lead>Your clients, tools and targets are in. Your clients’ history keeps loading in the background.</Say>
          )}
          <div className="flex flex-wrap gap-2">
            {withTeam && <Button kind="primary" loading={finishing === "buyer"} disabled={Boolean(finishing)} onClick={() => onFinish("buyer")}>Set up {names.buyer}<ArrowRight aria-hidden="true" /></Button>}
            <Button kind={withTeam ? "secondary" : "primary"} loading={finishing === "app"} disabled={Boolean(finishing)} onClick={() => onFinish("app")}>Open {names.ops}</Button>
          </div>
        </Bubble>
      )}
    </>
  );
}
