"use client";

import { AgentGate } from "@/components/agency/agent-locked";

// Every page under Marketing Guru waits for its setup interview to be done.
export default function MediaBuyerLayout({ children }) {
  return <AgentGate agent="media_buyer">{children}</AgentGate>;
}
