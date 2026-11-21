"use client";

import { useState } from "react";
import { Button, Notice } from "@/components/by";
import { useClientActions } from "@/components/shell/client-actions";
import { Bubble, Chips, Reply } from "./chat-parts";
import { ClientList } from "./ops-clients";
import { PlanPicker, isSubscribed } from "./plan-picker";

const ANSWERS = ["Yes, show me my sub-accounts", "Just this one for now"];

/**
 * The rest of the clients, from GoHighLevel, with the app's Import dialog.
 * Every client after the first needs a plan, so a plan comes first when there's none.
 */
export function ImportStep({ ctx }) {
  const { facts, steps, actions, agentName, firstClient } = ctx;
  const { openImport } = useClientActions();
  const clients = facts.clients || [];
  const declined = facts.onboarding?.data?.wants_sync === false && clients.length < 2;
  const [phase, setPhase] = useState(null); // null | "checking" | "plan"
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);

  const showAccounts = async () => {
    setPhase("checking");
    if (await isSubscribed()) {
      setPhase(null);
      openImport();
    } else {
      setPhase("plan");
    }
  };

  const pick = async (label) => {
    setProblem(null);
    if (label === ANSWERS[0]) return showAccounts();
    setBusy(label);
    try {
      await actions.saveAnswers({ wants_sync: false });
    } catch (e) {
      setProblem(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Bubble name={agentName} id="step-import">
        <p>{firstClient ? `${firstClient.name} is in.` : "Your first client is in."} Want me to bring in the rest of your clients from GoHighLevel? I’ll suggest which sub-accounts are still active and match their Meta ad accounts.</p>
        {steps.import !== "done" && phase !== "plan" && (
          <Chips label="Bring in the rest" items={ANSWERS} recommended={ANSWERS[0]} onPick={pick} busy={phase === "checking" ? ANSWERS[0] : busy} />
        )}
        {problem && <Notice tone="danger">{problem}</Notice>}
      </Bubble>
      {phase === "plan" && steps.import !== "done" && (
        <>
          <Reply>{ANSWERS[0]}</Reply>
          <Bubble name={agentName}>
            <p>Your first client is free. To bring in more, pick a plan.</p>
            <PlanPicker wanted={Math.max(2, clients.length + 1)} onSubscribed={() => { setPhase(null); openImport(); }} />
            <div><Button kind="ghost" size="sm" onClick={() => setPhase(null)}>Not now</Button></div>
          </Bubble>
        </>
      )}
      {steps.import === "done" && (
        <>
          {(declined || clients.length >= 2) && <Reply>{declined ? ANSWERS[1] : ANSWERS[0]}</Reply>}
          {clients.length >= 2 && <Bubble name={agentName}><ClientList clients={clients} /></Bubble>}
          {declined && <Bubble name={agentName}><p>Fine. You can import the rest any time from the client switcher or the Clients page.</p></Bubble>}
        </>
      )}
    </>
  );
}
