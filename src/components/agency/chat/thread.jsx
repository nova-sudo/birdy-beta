"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatSender, ChatTyping, Notice, UserMessage } from "@/components/by";
// What a reply can carry (forms, metric cards, charts) is drawn by the app's existing chat blocks.
import ChatUIBlock from "@/components/chat/ChatUIBlock";
import CreativeTestCard from "@/components/chat/blocks/CreativeTestCard";
import InlineChart from "@/components/chat/blocks/InlineChart";
import MetricCard from "@/components/chat/blocks/MetricCard";
import StatsGrid from "@/components/chat/blocks/StatsGrid";
import StatusBadge from "@/components/chat/blocks/StatusBadge";
import { mdComponents } from "@/lib/chat-markdown";
import { delatex } from "@/lib/chat-math";
import { parseChatUI } from "@/lib/chat-ui-parser";

const PROSE =
  "prose prose-sm max-w-none font-by-body text-by-text prose-headings:font-by-display prose-headings:font-semibold prose-headings:text-by-text " +
  "prose-p:my-1.5 prose-p:text-by-body-lg prose-p:text-by-text prose-strong:text-by-text prose-a:text-by-accent prose-ul:my-1.5 prose-li:my-0.5 prose-li:text-by-body-lg " +
  "prose-code:rounded-by-sm prose-code:bg-by-accent-soft prose-code:px-1 prose-code:text-by-accent";

/** One reply's body: its text, and any form, figure or chart it carries. */
function ReplyBody({ message, index, onUISubmit, onSend, submittedUIs }) {
  const { segments } = parseChatUI(message.content);
  return (
    <div className={PROSE}>
      {segments.map((seg, i) => {
        const key = `${index}-${i}`;
        switch (seg.type) {
          case "text": return <ReactMarkdown key={key} remarkPlugins={[remarkGfm]} components={mdComponents}>{delatex(seg.content)}</ReactMarkdown>;
          case "ui": return <ChatUIBlock key={key} fields={seg.fields} disabled={submittedUIs?.includes(key)} onSubmit={(values) => onUISubmit?.(key, values)} />;
          case "metric": return <MetricCard key={key} payload={seg.payload} />;
          case "chart": return <InlineChart key={key} payload={seg.payload} />;
          case "status": return <StatusBadge key={key} payload={seg.payload} />;
          case "stats": return <StatsGrid key={key} payload={seg.payload} />;
          case "creative": return <CreativeTestCard key={key} data={seg.payload} onSend={onSend} />;
          default: return null;
        }
      })}
    </div>
  );
}

/**
 * A conversation's messages, in order, with the reply in flight at the end.
 *
 * @param {object} props.chat what useAgentChat returns
 * @param {string} props.name who is answering, shown over each reply
 * @param {boolean} [props.compact] the narrow column beside a page: replies are not indented under the sender
 */
export function ChatThread({ chat, name, compact = false }) {
  const { messages, loading, send, submitUI, submittedUIs, configured, outOfCredits } = chat;
  const shown = messages.filter((m) => !(m.role === "user" && m.content?.startsWith("[UI_RESPONSE]")));
  const indent = compact ? "" : "pl-10";

  return (
    <div className="flex flex-col gap-5">
      {shown.map((message, i) => message.role === "user" ? (
        <UserMessage key={i}>{message.content}</UserMessage>
      ) : (
        <div key={i} className="flex flex-col gap-1.5 motion-safe:animate-[by-enter_var(--by-dur-base)_var(--by-ease-out)]">
          {/* The face shows once per run of replies. */}
          {shown[i - 1]?.role !== "assistant" && <ChatSender name={name} />}
          <div className={indent}>
            <ReplyBody message={message} index={i} onUISubmit={submitUI} onSend={send} submittedUIs={submittedUIs} />
          </div>
        </div>
      ))}
      {loading && (
        <div className="flex flex-col gap-1.5">
          {shown[shown.length - 1]?.role !== "assistant" && <ChatSender name={name} />}
          <div className={indent}><ChatTyping label={`${name} is replying`} /></div>
        </div>
      )}
      {!configured && (
        <Notice tone="warning" action={<Link href="/settings" className="font-semibold underline">Open Settings</Link>}>Add your AI key in Settings to chat.</Notice>
      )}
      {configured && outOfCredits && (
        <Notice tone="warning" action={<Link href="/credits" className="font-semibold underline">Top up</Link>}>You’re out of Birdy Credits.</Notice>
      )}
    </div>
  );
}
