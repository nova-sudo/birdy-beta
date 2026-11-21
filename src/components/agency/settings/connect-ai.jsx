"use client";

// Settings › Connections: Birdy in an AI app (the MCP connector). The link and
// setup steps per app, the apps and developer tokens connected (with
// Disconnect), and the log of what they did.

import { API_BASE_URL } from "@/lib/api";
import { ActivityCard } from "./connect-ai/activity-card";
import { ConnectionsCard, useMcpConnections } from "./connect-ai/connections-card";
import { SetupCard } from "./connect-ai/setup-card";

export function ConnectAI() {
  const mcpUrl = `${API_BASE_URL}/mcp`;
  const state = useMcpConnections();
  const connected = state.connections && !state.loadError ? state.connections.length : null;
  return (
    <section aria-labelledby="connect-ai-h" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-2">
        <h3 id="connect-ai-h" className="font-by-display text-by-heading font-bold tracking-[-0.01em]">Birdy in your AI app</h3>
        <p className="text-by-body-sm text-by-muted">Claude, ChatGPT and Cursor can read and run Birdy</p>
      </div>
      <div className="grid gap-3 min-[1000px]:grid-cols-2">
        <SetupCard mcpUrl={mcpUrl} connected={connected} />
        <ConnectionsCard state={state} />
      </div>
      <ActivityCard />
    </section>
  );
}
