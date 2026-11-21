"use client";

// Metrics' Ask bar: ask Birdy to add or change a metric. The conversation
// opens in the column beside the table, on the same chat backend and page
// ("custom_metrics") the old /metrics page's "Ask Birdy" mode used. When a
// reply comes back the formulas are read again, so one Birdy made shows up.

import { AskBar, AskPanel } from "@/components/by";
import { ChatThread } from "@/components/agency/chat/thread";

// In Settings the conversation is a card of its own beside the list, inside
// the page padding. Under lg there is no room beside it, so it sits below.
export const SETTINGS_ASK_PANEL = "w-full overflow-hidden rounded-by-lg border border-by-line shadow-by-card lg:w-[min(400px,36vw)]";

/**
 * @param {object} props.chat what useAgentChat returns
 * @param {(open: boolean) => void} props.onOpenChange
 */
export function MetricsAskBar({ chat, onOpenChange }) {
  return (
    <AskBar
      className="mx-auto w-full max-w-[820px] shrink-0"
      placeholder="Ask Birdy to add or change a metric, e.g. cost per booked call"
      busy={chat.loading}
      onSubmit={(text) => {
        onOpenChange(true);
        chat.send(text);
      }}
    />
  );
}

export function MetricsAskPanel({ chat, onOpenChange }) {
  return (
    <AskPanel className={`${SETTINGS_ASK_PANEL} max-lg:h-[24rem]`} title="Ask Birdy about metrics" onClose={() => onOpenChange(false)} follow={`${chat.messages.length}-${chat.loading}`}>
      <ChatThread chat={chat} name="Birdy" compact />
    </AskPanel>
  );
}
