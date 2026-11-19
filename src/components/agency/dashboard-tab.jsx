"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { AskBar, AskPanel, Button, SECTIONS, SectionHeader } from "@/components/by";
import { ChatThread } from "@/components/agency/chat/thread";
import { useAgentChat } from "@/components/agency/chat/use-agent-chat";
import { OPS_TABS, opsTabHref } from "@/components/agency/tabs";
import { ClientsList } from "@/components/clients/list/clients-list";

const OPS = SECTIONS.find((s) => s.id === "ops");

/**
 * Agency Ops' Dashboard tab: the Clients table, with the ask bar under it.
 * A question opens the conversation in a column beside the table.
 */
export function DashboardTab() {
  const router = useRouter();
  const search = useSearchParams();
  const chat = useAgentChat({ sessionKey: "by_ops_ask_table", page: "clients" });
  const [asking, setAsking] = useState(false);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <ClientsList
          viewKey="clients"
          header={({ dateMenu }) => (
            <SectionHeader
              section={OPS}
              tabs={OPS_TABS}
              tab="dashboard"
              onTabChange={(value) => value !== "dashboard" && router.push(opsTabHref(value, search))}
              dateRange={dateMenu}
            />
          )}
          footer={
            <AskBar
              className="mx-auto max-w-[820px]"
              placeholder={`Ask ${OPS.name}, or tell it what to change on this dashboard`}
              busy={chat.loading}
              onSubmit={(text) => {
                setAsking(true);
                chat.send(text);
              }}
            />
          }
        />
      </div>
      {asking && (
        <AskPanel
          title={OPS.name}
          onClose={() => setAsking(false)}
          follow={`${chat.messages.length}-${chat.loading}`}
          actions={chat.sessionId && (
            <Button kind="ghost" size="sm" onClick={() => router.push(`/dashboard/chat?c=${encodeURIComponent(chat.sessionId)}`)}>
              <MessageSquare aria-hidden="true" />Open in Chat
            </Button>
          )}
        >
          <ChatThread chat={chat} name={OPS.name} compact />
        </AskPanel>
      )}
    </div>
  );
}
