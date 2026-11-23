"use client";

import { useState } from "react";
import { Notice } from "@/components/by";
import { useClientActions } from "@/components/shell/client-actions";
import { Bubble, Chips, Reply, Say } from "./chat-parts";
import { ClientList } from "./ops-clients";

const ANSWERS = ["Yes, show me my sub-accounts", "Just this one for now"];

/**
 * The rest of the clients, from GoHighLevel, with the app's Import dialog.
 * The plan was picked before the first client, so the dialog opens straight
 * away; a plan that's too small is the dialog's to say.
 */
export function ImportStep({ ctx }) {
  const { facts, steps, actions, agentName, firstClient } = ctx;
  const { openImport } = useClientActions();
  const clients = facts.clients || [];
  const declined = facts.onboarding?.data?.wants_sync === false && clients.length < 2;
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);

  const pick = async (label) => {
    setProblem(null);
    if (label === ANSWERS[0]) return openImport();
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
        <Say>{firstClient ? `${firstClient.name} is in.` : "Your first client is in."} Want me to bring in the rest of your clients from GoHighLevel? I’ll suggest which sub-accounts are still active and match their Meta ad accounts.</Say>
        {steps.import !== "done" && (
          <Chips label="Bring in the rest" items={ANSWERS} recommended={ANSWERS[0]} onPick={pick} busy={busy} />
        )}
        {problem && <Notice tone="danger">{problem}</Notice>}
      </Bubble>
      {steps.import === "done" && (
        <>
          {(declined || clients.length >= 2) && <Reply>{declined ? ANSWERS[1] : ANSWERS[0]}</Reply>}
          {clients.length >= 2 && <Bubble name={agentName}><ClientList clients={clients} /></Bubble>}
          {declined && <Bubble name={agentName}><Say>Fine. You can import the rest any time from the client switcher or the Clients page.</Say></Bubble>}
        </>
      )}
    </>
  );
}
