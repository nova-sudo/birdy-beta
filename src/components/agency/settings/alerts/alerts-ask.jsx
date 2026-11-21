"use client";

// Alerts' Ask bar: tell Birdy what to watch and it sets the alert up. The
// same chat backend and page ("alerts") the old /alerts page's "Ask Birdy"
// mode used. Nothing is sent until the owner types and presses send; when a
// reply comes back the rules are read again, so one Birdy made shows up.

import { AskBar, AskPanel } from "@/components/by";
import { ChatThread } from "@/components/agency/chat/thread";

export function AlertsAskBar({ chat, onOpenChange }) {
  return (
    <AskBar
      className="w-full"
      placeholder="Ask Birdy to set up an alert, e.g. tell me when CPL goes over $40"
      busy={chat.loading}
      onSubmit={async (text) => {
        if (await chat.send(text)) onOpenChange(true);
      }}
    />
  );
}

export function AlertsAskPanel({ chat, onOpenChange }) {
  return (
    <AskPanel title="Ask Birdy about alerts" onClose={() => onOpenChange(false)} follow={`${chat.messages.length}-${chat.loading}`} className="max-h-[28rem]">
      <ChatThread chat={chat} name="Birdy" compact />
    </AskPanel>
  );
}
