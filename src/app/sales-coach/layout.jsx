"use client";

import { AgentGate } from "@/components/agency/agent-locked";

// Every page under Sales Coach waits for its setup interview to be done.
export default function SalesCoachLayout({ children }) {
  return <AgentGate agent="sales_coach">{children}</AgentGate>;
}
