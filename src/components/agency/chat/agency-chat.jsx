"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AskBar, Button, EmptyState, Notice, SectionHeader, Skeleton } from "@/components/by";
import { useStoredUser } from "@/components/shell/account-menu";
import { OPS_SECTION, resolveSection, sessionKey } from "@/components/agency/sections";
import { sectionTabHref, useSectionTabs } from "@/components/agency/tabs";
import { SectionMore } from "@/components/agency/section-more";
import { groupConversations, scopeLine } from "@/lib/agent-chat";
import { apiRequest } from "@/lib/api";
import { greeting } from "@/lib/birds-eye";
import { hydrateChat, resetChat, syncProposals } from "@/lib/chat-store";
import { startersFor } from "@/lib/chat-starters";
import { isActive } from "@/lib/client-status";
import { statusOf } from "@/lib/clients-list";
import { DEFAULT_DATE_PRESET } from "@/lib/constants";
import { conversationsFor, rememberSectionChat, sectionChatIds } from "@/lib/section-chats";
import { useClientGroups } from "@/lib/useClientGroups";
import { ChatThread } from "./thread";
import { useAgentChat } from "./use-agent-chat";

const STATUS_WORDS = { danger: "At risk", warning: "At risk", ok: "On track", off: "Inactive" };

/**
 * A section's Chat: saved conversations on the left, the open one on the right.
 * It talks to the same backend as the older Ask Birdy page, so the history is shared.
 * Each lists the conversations with its own agent (Agency Ops: Birdy, and older rows that name no agent),
 * and each asks its own agent with that section’s tools.
 *
 * @param {import("../sections").SectionConfig} [props.section] Agency Ops when left out
 */
export function AgencyChat({ section: which }) {
  const section = resolveSection(which);
  const OPS = section.kit;
  const ops = section === OPS_SECTION;
  const router = useRouter();
  const tabs = useSectionTabs(section);
  const pathname = usePathname();
  const search = useSearchParams();
  const clientId = search.get("client") || null;
  const wanted = search.get("c") || null;
  // Each client has its own thread, so one client's conversation never shows under another.
  const SESSION_KEY = sessionKey(section, `chat_${clientId ?? "agency"}`);

  const { clientGroups } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false });
  const client = useMemo(() => (clientId ? clientGroups.find((g) => g.id === clientId) ?? null : null), [clientGroups, clientId]);
  const user = useStoredUser();
  const [hour, setHour] = useState(null);
  useEffect(() => setHour(new Date().getHours()), []);

  const [conversations, setConversations] = useState([]);
  const [listState, setListState] = useState("loading"); // "loading" | "ready" | "error"
  const [activeId, setActiveId] = useState(null);
  const [opening, setOpening] = useState(false);
  const [deleting, setDeleting] = useState(null);
  // How the thread column moved to make room for an agent's part docked on the right; the composer follows.
  const [room, setRoom] = useState(null);

  const loadList = useCallback(async () => {
    try {
      const res = await apiRequest("/api/chat/conversations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConversations(data.conversations || []);
      setListState("ready");
    } catch {
      setListState((s) => (s === "ready" ? s : "error"));
    }
  }, []);
  useEffect(() => { loadList(); }, [loadList]);

  // Titles and ordering are worked out on the server, so the list is re-read after each reply.
  // A section's own conversations are remembered as they start, so its list can show them.
  const onSessionId = useCallback((id) => {
    if (!ops) rememberSectionChat(section.key, id);
    setActiveId(id);
  }, [ops, section.key]);
  const chat = useAgentChat({
    sessionKey: SESSION_KEY,
    // Agency Ops sends no page (Birdy with every tool) and agent "birdy"; the other sections send theirs, and their agent.
    page: section.chat.page,
    agent: section.chat.agent,
    client: client && isActive(client) ? { id: client.id, name: client.name } : null,
    onSessionId,
    onSettled: loadList,
  });

  const newChat = useCallback(() => {
    resetChat(SESSION_KEY);
    setActiveId(null);
  }, [SESSION_KEY]);

  const open = useCallback(async (sessionId) => {
    setOpening(true);
    try {
      const res = await apiRequest(`/api/chat/conversations/${encodeURIComponent(sessionId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      resetChat(SESSION_KEY);
      hydrateChat(SESSION_KEY, { sessionId, messages: data.messages || [] });
      setActiveId(sessionId);
    } catch {
      toast.error("Couldn’t open that conversation");
    } finally {
      setOpening(false);
    }
  }, [SESSION_KEY]);

  // Quietly re-read a conversation's proposals from the server; the transcript on screen stays as it is.
  const syncSaved = useCallback(async (sessionId) => {
    try {
      const res = await apiRequest(`/api/chat/conversations/${encodeURIComponent(sessionId)}`);
      if (!res.ok) return;
      const data = await res.json();
      syncProposals(SESSION_KEY, data.messages || []);
    } catch {
      // The chat still works; its proposals show what this browser last knew.
    }
  }, [SESSION_KEY]);

  // Arriving with ?c=<id> (from a page's conversation column) opens that conversation; otherwise a fresh chat.
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;
    if (wanted) open(wanted);
    else if (!chat.sessionId) newChat();
    else {
      setActiveId(chat.sessionId);
      // The chat kept in this browser may predate a decision made elsewhere: the saved conversation says.
      syncSaved(chat.sessionId);
    }
    // Runs once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async (sessionId) => {
    setDeleting(sessionId);
    try {
      const res = await apiRequest(`/api/chat/conversations/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setConversations((prev) => prev.filter((c) => c.session_id !== sessionId));
      if (activeId === sessionId) newChat();
    } catch {
      toast.error("Couldn’t delete that conversation");
    } finally {
      setDeleting(null);
    }
  };

  // Inside a client only that client's saved conversations are listed; in a section only that section's.
  const groups = useMemo(() => {
    // Matched on each row's agent; rows without one fall back to what this browser remembers (Agency Ops keeps them all).
    const mine = conversationsFor(conversations, section.chat.agent, sectionChatIds(section.key));
    return groupConversations(clientId ? mine.filter((c) => c.scope === "client" && c.client_group_id === clientId) : mine);
    // activeId: a conversation that just started is remembered then, and listed on the next read.
  }, [conversations, clientId, ops, section, activeId]); // eslint-disable-line react-hooks/exhaustive-deps
  const empty = chat.messages.length === 0 && !chat.loading;
  const starters = startersFor(ops ? (client ? "client_detail" : "dashboard") : section.chat.starters).slice(0, 3);
  const subtitle = client ? <>Scoped to <b className="font-semibold text-by-text">{client.name}</b> · {STATUS_WORDS[statusOf(client)]}</> : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-by-canvas font-by-body text-by-body text-by-text selection:bg-by-accent-line selection:text-by-text">
      <SectionHeader
        section={OPS}
        subtitle={subtitle}
        tabs={tabs}
        tab="chat"
        more={<SectionMore section={section} tab="chat" />}
        onTabChange={(value) => value !== "chat" && router.push(sectionTabHref(section, value, search))}
      />

      <div className="flex min-h-0 flex-1">
        <nav aria-label="Conversations" className="flex w-60 shrink-0 flex-col border-r border-by-line bg-by-surface max-md:hidden">
          <div className="shrink-0 p-3">
            <Button kind="primary" className="w-full" onClick={newChat}><Plus aria-hidden="true" />New chat</Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
            {listState === "loading" ? (
              <div aria-busy="true" aria-label="Loading conversations" className="flex flex-col gap-4 px-2.5 pt-2">
                {[0, 1, 2].map((i) => <div key={i}><Skeleton className="w-36" /><Skeleton className="mt-2 w-24" /></div>)}
              </div>
            ) : listState === "error" ? (
              <Notice tone="danger" action={<Button size="sm" onClick={loadList}>Retry</Button>}>Couldn’t load your conversations.</Notice>
            ) : groups.length === 0 ? (
              <p className="px-2.5 pt-2 text-by-body-sm text-by-muted">{client ? `Conversations ${ops ? "" : `with ${OPS.name} `}about ${client.name} are saved here.` : ops ? "Your conversations are saved here." : `Your conversations with ${OPS.name} are saved here.`}</p>
            ) : groups.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <h3 className="px-2.5 pt-3 pb-1.5 text-by-label font-semibold uppercase tracking-[0.07em] text-by-muted">{group.label}</h3>
                <ul>
                  {group.items.map((c) => {
                    const selected = c.session_id === activeId;
                    return (
                      <li key={c.session_id} className="group relative">
                        <button
                          type="button"
                          aria-current={selected ? "true" : undefined}
                          onClick={() => !selected && open(c.session_id)}
                          className={`block w-full cursor-pointer rounded-by-md px-2.5 py-2 pr-9 text-left transition-colors duration-(--by-dur-fast) ease-by-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent ${selected ? "bg-by-accent-soft" : "hover:bg-by-canvas"}`}
                        >
                          <span className={`block truncate text-by-body font-semibold ${selected ? "text-by-accent" : "text-by-text"}`} title={c.title}>{c.title || "Untitled"}</span>
                          <span className="block truncate text-by-caption text-by-muted">{scopeLine(c)}</span>
                        </button>
                        <Button
                          kind="ghost" size="sm" iconOnly
                          aria-label={`Delete conversation: ${c.title || "Untitled"}`}
                          loading={deleting === c.session_id}
                          onClick={() => remove(c.session_id)}
                          className="absolute top-1.5 right-1 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <ChatScroll follow={`${chat.messages.length}-${chat.loading}`}>
            <div className="mx-auto w-full max-w-[800px] px-7 py-6">
              {opening ? (
                <div aria-busy="true" aria-label="Opening conversation" className="flex flex-col gap-3"><Skeleton className="w-40" /><Skeleton className="w-full" /><Skeleton className="w-3/4" /></div>
              ) : empty ? (
                <EmptyState icon={<MessageSquare />} title={`${hour == null ? "Hello" : greeting(hour)}${user.name ? `, ${user.name.split(" ")[0]}` : ""}.`} className="pt-16">
                  {client ? (ops ? `Ask anything about ${client.name}.` : `Ask about ${client.name}’s ${section.askAbout.replace(/^your /, "")}.`) : section.hello}
                </EmptyState>
              ) : null}
              {!opening && <ChatThread chat={chat} name={OPS.name} onDock={setRoom} />}
            </div>
          </ChatScroll>

          {/* Built like the thread's box above it (same width and padding), so the composer moves with
              the thread when an agent's part is docked on the right. */}
          <div data-composer className="shrink-0 pb-5" style={room?.gutter ? { paddingRight: room.gutter } : undefined}>
            <div className="mx-auto w-full max-w-[800px] px-7">
              <div style={room ? { marginLeft: -room.shift, paddingRight: room.pad } : undefined}>
              {empty && !opening && (
                <div className="mb-2.5 flex flex-wrap gap-2">
                  {starters.map((s) => (
                    <Button key={s.label} size="sm" className="rounded-full font-medium" onClick={() => chat.send(s.prompt)}>{s.label}</Button>
                  ))}
                </div>
              )}
              <AskBar placeholder={`Message ${OPS.name}`} busy={chat.loading} onSubmit={chat.send} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The scrolling message area. It follows the newest message. */
function ChatScroll({ follow, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo?.({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, [follow]);
  return <div ref={ref} aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>;
}
