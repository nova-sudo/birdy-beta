"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/by";
import { cplOf } from "@/lib/setup-steps";
import { isActive } from "@/lib/client-status";
import { Bubble, Known, Lead } from "./chat-parts";
import { knownFromOps } from "./buyer-setup";

/**
 * Sales Coach: says back what it starts from. It has no setting of its own to
 * ask for yet (the backend stores no "call centre is behind" rule), so this is
 * where setup ends.
 */
export function CoachSetup({ ctx, onDone, finishing }) {
  const { facts, names } = ctx;
  const clients = facts.clients || [];
  const calling = clients.filter((g) => g.call_log_provider && g.call_log_provider !== "none").length;
  const limits = clients.filter(isActive).filter((g) => cplOf(g) !== null).length;
  return (
    <>
      <Bubble name={names.coach} first id="step-coach">
        <p><Lead>I’m {names.coach}.</Lead>From {names.ops} and {names.buyer} I already know:</p>
        <Known
          items={[
            ...knownFromOps(facts, names).filter((line) => line.startsWith("Calls") || line.startsWith("Your team")),
            calling ? `${calling} of your clients have their calls tracked` : null,
            limits ? `${limits} client${limits === 1 ? " has" : "s have"} a CPL limit` : null,
          ]}
        />
        <p>There’s nothing else I need from you. I’ll watch how fast new leads get called and how many close.</p>
      </Bubble>
      <Bubble name={names.coach}>
        <p><Lead>You’re all set.</Lead>{names.ops}, {names.buyer} and {names.coach} are working from the same context. Your clients’ history keeps loading in the background.</p>
        <div><Button kind="primary" loading={finishing === "app"} onClick={onDone}>Open {names.ops}<ArrowRight aria-hidden="true" /></Button></div>
      </Bubble>
    </>
  );
}
