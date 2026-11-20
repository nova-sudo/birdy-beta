"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, MessageSquare, X, Zap } from "lucide-react";
import { AskBar, AskPanel, Button, Card, Notice, Pill, SectionHeader, Skeleton } from "@/components/by";
import { ChatThread } from "@/components/agency/chat/thread";
import { useAgentChat } from "@/components/agency/chat/use-agent-chat";
import { OPS_SECTION, resolveSection, sessionKey } from "@/components/agency/sections";
import { sectionTabHref, useSectionTabs } from "@/components/agency/tabs";
import { SectionMore } from "@/components/agency/section-more";
import { useSuggestions } from "@/components/agency/use-suggestions";
import { forClient, suggestionsHeading } from "@/lib/agency-suggestions";
import { isActive } from "@/lib/client-status";
import { statusOf } from "@/lib/clients-list";
import { DEFAULT_DATE_PRESET } from "@/lib/constants";
import { rememberSectionChat } from "@/lib/section-chats";
import { useClientGroups } from "@/lib/useClientGroups";

const STATUS_WORDS = { danger: "At risk", warning: "At risk", ok: "On track", off: "Inactive" };
// How each kind of history entry is marked.
const MODE = {
  "Auto-run": { icon: <Zap />, tile: "bg-by-accent-soft text-by-accent", pill: "accent" },
  Approved: { icon: <Check />, tile: "bg-by-success-bg text-by-success", pill: "success" },
  Dismissed: { icon: <X />, tile: "bg-by-sunken text-by-muted", pill: "neutral" },
};
const ICON_TONE = { danger: "bg-by-danger-bg text-by-danger", warning: "bg-by-warning-bg text-by-warning", accent: "bg-by-accent-soft text-by-accent" };

/**
 * A section's Suggestions tab: what it suggests doing, most impact first,
 * each with "Do it for me" and Dismiss, and the history of what was done or dismissed.
 * Agency Ops lists every suggestion; Media Buyer and Sales Coach list their own.
 * With `?client=<id>` only that client's suggestions and history show.
 *
 * @param {import("./sections").SectionConfig} [props.section] Agency Ops when left out
 */
export function SuggestionsTab({ section: which }) {
  const section = resolveSection(which);
  const OPS = section.kit;
  const ops = section === OPS_SECTION;
  const router = useRouter();
  const tabs = useSectionTabs(section);
  const search = useSearchParams();
  const clientId = search.get("client") || null;
  const { clientGroups } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false });
  const client = clientId ? clientGroups.find((g) => g.id === clientId) ?? null : null;

  const data = useSuggestions();
  const suggestions = forClient(ops ? data.suggestions : data.suggestions.filter(section.ownsSuggestion), client?.name);
  const history = section.ownsHistory ? forClient(data.history, client?.name) : [];

  const chat = useAgentChat({
    sessionKey: sessionKey(section, `ask_sugg_${clientId ?? "agency"}`),
    ...(ops ? { page: client ? "client_detail" : "dashboard" } : { page: section.chat.page, agent: section.chat.agent, onSessionId: (id) => rememberSectionChat(section.key, id) }),
    client: client && isActive(client) ? { id: client.id, name: client.name } : null,
  });
  const [asking, setAsking] = useState(false);
  // "Just now" only reads right once the page is live in the browser.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const subtitle = client ? <>Scoped to <b className="font-semibold text-by-text">{client.name}</b> · {STATUS_WORDS[statusOf(client)]}</> : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-by-canvas font-by-body text-by-body text-by-text selection:bg-by-accent-line selection:text-by-text">
      <SectionHeader section={OPS} subtitle={subtitle} tabs={tabs} tab="suggestions" more={<SectionMore section={section} tab="suggestions" />} onTabChange={(value) => value !== "suggestions" && router.push(sectionTabHref(section, value, search))} />

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-6 pb-28">
            <div className={`mx-auto grid max-w-[1040px] items-start gap-5 ${section.ownsHistory ? "lg:grid-cols-[minmax(0,1fr)_300px]" : ""}`}>
              <section aria-labelledby="sugg-heading" className="min-w-0">
                <div className="flex items-baseline gap-3">
                  <h2 id="sugg-heading" className="font-by-display text-by-heading font-semibold text-balance">
                    {data.loading ? "Suggestions" : !ops && !section.ownsHistory && suggestions.length === 0 ? "No suggestions yet" : suggestionsHeading(suggestions.length, client?.name, ops ? null : OPS.name)}
                  </h2>
                  {suggestions.length > 1 && <span className="ml-auto shrink-0 text-by-body-sm text-by-muted">Sorted by impact</span>}
                </div>

                {data.error ? (
                  <Notice className="mt-3" tone="danger" action={<Button size="sm" onClick={data.refresh}>Retry</Button>}>Couldn’t load suggestions. Check your connection and try again.</Notice>
                ) : data.loading ? (
                  <div aria-busy="true" aria-label="Loading suggestions" className="mt-3 flex flex-col gap-3">
                    {[0, 1, 2].map((i) => <Card key={i} className="px-4 py-4"><Skeleton className="w-56" /><Skeleton className="mt-3 w-80 max-w-full" /></Card>)}
                  </div>
                ) : suggestions.length === 0 ? (
                  <p className="mt-2 text-by-body-lg text-by-text-2">
                    {!ops && !section.ownsHistory
                      ? `${OPS.name} has no suggestions yet. Birdy’s suggestions today come from its ad rules, and those are Media Buyer’s. Suggestions about calls will appear here.`
                      : client ? `${OPS.name} has nothing to suggest for ${client.name} right now.` : `${OPS.name} is watching every client and will suggest the next thing here.`}
                  </p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-3">
                    {suggestions.map((s) => (
                      <li key={s.id}>
                        <Card className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 motion-safe:animate-[by-enter_var(--by-dur-base)_var(--by-ease-out)]">
                          <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-by-lg [&_svg]:size-[18px] ${ICON_TONE[s.tone]}`}><Zap /></span>
                          <div className="min-w-0 flex-1 basis-64">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <b className="text-by-body-lg font-semibold text-by-text">{s.title}</b>
                              {s.client && !client && <Pill tone="accent" dot={false}>{s.client}</Pill>}
                            </div>
                            {s.why && <p className="mt-0.5 text-by-body-sm text-by-text-2 text-pretty">{s.why}</p>}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button kind="primary" loading={data.busy === s.id} disabled={data.busy != null} onClick={() => data.apply(s)} aria-label={`Do it for me: ${s.title}`}><Zap aria-hidden="true" />Do it for me</Button>
                            <Button disabled={data.busy != null} onClick={() => data.dismiss(s)} aria-label={`Dismiss: ${s.title}`}>Dismiss</Button>
                          </div>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {section.ownsHistory && <Card aria-labelledby="hist-heading" role="complementary" className="px-4 py-4">
                <div className="flex items-baseline">
                  <h3 id="hist-heading" className="font-by-display text-by-body-lg font-semibold">History</h3>
                  {history.length > 1 && <span className="ml-auto text-by-caption text-by-muted">Newest first</span>}
                </div>
                {data.loading ? (
                  <div aria-hidden="true" className="mt-3 flex flex-col gap-3"><Skeleton className="w-40" /><Skeleton className="w-28" /></div>
                ) : history.length === 0 ? (
                  <p className="mt-2 text-by-body-sm text-by-muted">Nothing done {client ? `for ${client.name} ` : ""}yet.</p>
                ) : (
                  <ol className="mt-1 divide-y divide-by-line-soft">
                    {history.slice(0, 30).map((h) => {
                      const mode = MODE[h.mode] ?? MODE.Approved;
                      return (
                        <li key={h.id} className="flex gap-3 py-3">
                          <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-full [&_svg]:size-3.5 ${mode.tile}`}>{mode.icon}</span>
                          <div className="min-w-0">
                            <b className="block text-by-body font-semibold text-by-text">{h.what}</b>
                            {h.client && <span className="block truncate text-by-body-sm text-by-text-2">{h.client}</span>}
                            <span className="mt-1 flex items-center gap-2 text-by-caption text-by-muted">
                              <Pill tone={mode.pill} dot={false}>{h.mode}</Pill>{ready && h.when}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Card>}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 px-7 pb-5">
            <AskBar
              className="pointer-events-auto mx-auto max-w-[820px]"
              placeholder={`Ask ${OPS.name} about these suggestions`}
              busy={chat.loading}
              onSubmit={(text) => {
                setAsking(true);
                chat.send(text);
              }}
            />
          </div>
        </div>
        {asking && (
          <AskPanel
            title={OPS.name}
            onClose={() => setAsking(false)}
            follow={`${chat.messages.length}-${chat.loading}`}
            actions={chat.sessionId && (
              <Button kind="ghost" size="sm" onClick={() => router.push(ops ? `/dashboard/chat?c=${encodeURIComponent(chat.sessionId)}` : sectionTabHref(section, "chat", search, { c: chat.sessionId }))}><MessageSquare aria-hidden="true" />Open in Chat</Button>
            )}
          >
            <ChatThread chat={chat} name={OPS.name} compact />
          </AskPanel>
        )}
      </div>
    </div>
  );
}
