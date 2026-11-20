"use client";

import { useEffect, useState } from "react";
import { AgentPart, RouteMap } from "@/components/by";
import { Section, Sub } from "../kit-parts";

// Made-up routes in the server's shape. Same story as the design mock: the
// Sales Coach chat for Aura asks a question that also needs ad data.
const SALES_COACH = {
  id: "s1", agent: "sales_coach", name: "Sales Coach", kind: "main", status: "done", summary: "212 calls checked",
  question: "Why did booked calls drop this week?", asked_by: null,
  tools: [{ name: "call_stats", label: "Call stats, 7 days", detail: "212 calls" }, { name: "recordings", label: "Call recordings", detail: "18 listened" }],
  answer: "Answer rate held at 61%. Booked calls fell from 38 to 21, so the calls look fine. The ads part went up to Birdy.",
  credits: 7, seconds: 11,
};
const BIRDY = {
  id: "s2", agent: "birdy", name: "Birdy", kind: "orchestrator", status: "done", summary: "Chose Media Buyer",
  question: "Did the leads coming in for Aura change this week?", asked_by: "s1",
  tools: [{ name: "ask_agent", label: "Asked Media Buyer", detail: null }], answer: "Passed the question to Media Buyer.", credits: 2, seconds: 3,
};
const MEDIA_BUYER = {
  id: "s3", agent: "media_buyer", name: "Media Buyer", kind: "main", status: "done", summary: "6 campaigns checked",
  question: "Did the leads coming in for Aura change this week?", asked_by: "s2",
  tools: [
    { name: "campaign_insights", label: "Campaign results, 7 days", detail: "6 campaigns" },
    { name: "leads_by_ad", label: "Leads by ad", detail: "84 leads" },
    { name: "form_history", label: "Lead form history", detail: "1 change" },
  ],
  answer: "The “Spring Promo” lead form was swapped on Tuesday and no longer asks for a phone time. Leads from it book at 9%, against 27% before.",
  credits: 9, seconds: 20,
};
const SUB = {
  id: "s4", agent: "sub:form-audit", name: "Form checker", kind: "sub", status: "done", summary: "1 form changed",
  question: "Which of Aura’s lead forms changed this week?", asked_by: "s3",
  tools: [{ name: "form_history", label: "Lead form history", detail: "4 forms" }], answer: "Only “Spring Promo”, on Tuesday at 10:12.", credits: 3, seconds: 6,
};

const DONE = { status: "done", seconds: 34, credits: 18, limit_hit: null, steps: [SALES_COACH, BIRDY, MEDIA_BUYER] };
const LONG = { status: "done", seconds: 41, credits: 21, limit_hit: null, steps: [SALES_COACH, BIRDY, MEDIA_BUYER, SUB] };
const FAILED = {
  status: "failed", seconds: 52, credits: 14, limit_hit: "asks",
  steps: [
    SALES_COACH,
    BIRDY,
    { ...MEDIA_BUYER, status: "failed", summary: "Ad account timed out", answer: null, tools: MEDIA_BUYER.tools.slice(0, 1) },
    { ...SUB, status: "skipped", summary: "Not asked" },
  ],
};

// The working map, replayed: each frame is what one `route` event would carry.
const FRAMES = [
  { status: "working", seconds: 2, credits: 0, steps: [{ ...SALES_COACH, status: "working", summary: "Checking calls…", answer: null, tools: [] }] },
  { status: "working", seconds: 9, credits: 0, steps: [{ ...SALES_COACH, status: "working", summary: "Checking calls…", answer: null }] },
  { status: "working", seconds: 12, credits: 0, steps: [SALES_COACH, { ...BIRDY, status: "working", summary: "Choosing an agent…", answer: null }] },
  { status: "working", seconds: 16, credits: 0, steps: [SALES_COACH, BIRDY, { ...MEDIA_BUYER, status: "working", summary: "Checking lead forms…", answer: null, tools: MEDIA_BUYER.tools.slice(0, 2) }] },
  DONE,
];

function LiveMap() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 1600);
    return () => clearInterval(id);
  }, []);
  return <RouteMap route={FRAMES[frame]} />;
}

export function AgentsSection() {
  const [picked, setPicked] = useState("s3");
  const [narrow, setNarrow] = useState("s3");
  return (
    <Section title="Agents working together">
      <p className="mb-4 max-w-[720px] text-by-body-sm text-by-text-2">
        The route map sits on top of a reply that other agents helped with. Press an agent to open its part.
        It switches to the stacked layout by itself when its container is too narrow for a row.
      </p>

      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-5">
        <div className="flex flex-col gap-5">
          <Sub title="Finished, Media Buyer’s part open">
            <RouteMap route={DONE} selected={picked} onSelect={setPicked} />
          </Sub>
          <Sub title="While working (replays every few seconds)">
            <LiveMap />
          </Sub>
          <Sub title="Four agents, with a sub-agent under Media Buyer">
            <RouteMap route={LONG} />
          </Sub>
          <Sub title="An agent couldn’t finish, one was skipped, and the ask limit was hit">
            <RouteMap route={FAILED} />
          </Sub>
        </div>
        <Sub title="Agent’s part (side panel)">
          <div className="rounded-by-lg border border-by-line bg-by-surface p-4 shadow-by-card">
            {picked ? <AgentPart route={DONE} stepId={picked} onClose={() => setPicked(null)} /> : <p className="text-by-body-sm text-by-muted">Press an agent on the first map.</p>}
          </div>
        </Sub>
      </div>

      <Sub title="Stacked, in a narrow column, with the part opened inline">
        <div className="w-[380px]">
          <RouteMap route={LONG} selected={narrow} onSelect={setNarrow}>
            {narrow && <AgentPart route={LONG} stepId={narrow} variant="inline" onClose={() => setNarrow(null)} />}
          </RouteMap>
        </div>
      </Sub>
    </Section>
  );
}
