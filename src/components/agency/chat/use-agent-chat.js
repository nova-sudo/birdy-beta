"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useAiCredentials } from "@/hooks/useAiCredentials";
import { useCredits } from "@/hooks/useCredits";
import { markUISubmitted, sendChatMessage, useChat } from "@/lib/chat-store";

/**
 * One conversation with Birdy, on the app's existing chat backend.
 *
 * The transcript lives in the shared chat store under `sessionKey`, so it
 * survives the page that started it being closed and reopened.
 *
 * @param {string} options.sessionKey which conversation this is
 * @param {string|null} [options.page] the page slug the backend uses for context
 * @param {"birdy"|"media_buyer"|"sales_coach"|null} [options.agent] which agent is being talked to. Sent as `agent`;
 *   left out, the server answers as it always has.
 * @param {{id: string, name: string}|null} [options.client] limits the conversation to one client. The backend then
 *   answers only about that client and pins every data request to it, whatever the question asks for.
 * @param {(sessionId: string) => void} [options.onSessionId] a new conversation learned its id
 * @param {() => void} [options.onSettled] a reply (or a failure) came back
 *
 * Messages go out through the streaming endpoint, so while other agents help
 * with a reply `route` holds their live route (null otherwise). The finished
 * reply keeps its route on the message for the thread's route map.
 */
export function useAgentChat({ sessionKey, page = null, agent = null, client = null, onSessionId, onSettled }) {
  const chat = useChat(sessionKey);
  const { configured: hasKey, loading: checkingKey, refresh: refreshCreds, markUnconfigured } = useAiCredentials();
  // Until the check comes back, assume a key is there: the server still refuses a message sent without one.
  const configured = hasKey || checkingKey;
  const { blocked: outOfCredits, refresh: refreshCredits } = useCredits();

  const send = useCallback(async (text) => {
    if (!text?.trim() || chat.loading) return false;
    if (!configured) {
      toast.error("AI not configured", { description: "Add your AI key in Settings to chat." });
      return false;
    }
    if (outOfCredits) {
      toast.error("You're out of Birdy Credits", { description: "Top up to keep using Birdy AI." });
      return false;
    }
    await sendChatMessage(
      sessionKey,
      // "client_detail" is the page the backend treats as one client only: its prompt refuses other clients and
      // the server pins each tool call to this client's id. So a client always wins over the tab's own page name.
      { text: text.trim(), page: client ? "client_detail" : page, agent: agent || undefined, stream: true, clientGroupId: client?.id ?? null, clientName: client?.name ?? null },
      {
        onSessionId,
        on412: () => {
          markUnconfigured();
          refreshCreds();
          toast.error("AI not configured", { description: "Add your AI key in Settings to chat." });
        },
        on402: () => {
          refreshCredits?.();
          toast.error("You're out of Birdy Credits", { description: "Top up to keep using Birdy AI." });
        },
        onSettled: () => {
          refreshCredits?.();
          onSettled?.();
        },
      },
    );
    return true;
  }, [chat.loading, configured, outOfCredits, sessionKey, page, agent, client?.id, client?.name, onSessionId, onSettled, markUnconfigured, refreshCreds, refreshCredits]);

  // A form inside a reply answers as a hidden message, the way the existing chat does.
  const submitUI = useCallback((uiKey, values) => {
    markUISubmitted(sessionKey, uiKey);
    send(`[UI_RESPONSE] ${JSON.stringify(values)}`);
  }, [sessionKey, send]);

  return {
    messages: chat.messages, loading: chat.loading, sessionId: chat.sessionId, submittedUIs: chat.submittedUIs, route: chat.route ?? null,
    send, submitUI, configured, outOfCredits,
  };
}
