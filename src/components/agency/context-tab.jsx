"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, LayoutGrid, Link2, Pencil, Plus, SlidersHorizontal, Sparkles, Target, Trash2, Users, X } from "lucide-react";
import { Button, Card, Notice, SectionHeader, Skeleton, TextArea, cn } from "@/components/by";
import { AskDock, PAGE, scopedSubtitle, useSectionChat } from "@/components/agency/section-parts";
import { resolveSection } from "@/components/agency/sections";
import { SectionMore } from "@/components/agency/section-more";
import { sectionTabHref, useSectionTabs } from "@/components/agency/tabs";
import { SubAgentsCard } from "@/components/agency/sub-agents-card";
import { LessonsSection } from "@/components/agency/context-lessons";
import { ContextCardHead, SubHeading } from "@/components/agency/context-parts";
import { CLIENT_CARD, addNote, cardChanges, changeNote, contextErrorMessage, removeNote, saveCard, useContext, usedWhenLine } from "@/lib/context-api";
import { parseServerDate } from "@/lib/stock-agent-api";
import { DEFAULT_DATE_PRESET } from "@/lib/constants";
import { useClientGroups } from "@/lib/useClientGroups";

const ICONS = { agency: LayoutGrid, targets: Target, how_we_work: Link2, rules: SlidersHorizontal };
const SOURCE_WORDS = { setup: "From setup", derived: "From your data" };

/** "12 Aug 2026". */
const dayWords = (iso) => {
  const d = parseServerDate(iso);
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
};

/** The quiet "Edit" at a card's top right. */
function EditButton({ label, onClick }) {
  return (
    <Button kind="ghost" size="sm" className="text-by-accent opacity-85 hover:bg-by-accent-soft hover:text-by-accent group-hover/card:opacity-100 focus-visible:opacity-100" aria-label={label} onClick={onClick}>
      <Pencil aria-hidden="true" className="size-3.5" />Edit
    </Button>
  );
}

/**
 * One card of what Birdy knows: its lines, and Edit to change, add or take lines away.
 * Lines Birdy works out itself, or that the owner can't change here, stay as they are while editing.
 *
 * @param {{key: string, title: string, used_when: string, items: object[]}} props.card
 * @param {string} props.writeAs the card key a new line is sent with
 * @param {string|null} [props.clientId] a client's own card
 */
function ContextCard({ card, writeAs, clientId = null, icon, accent = false, onSaved }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(null);
  const headId = `cx-${card.key}`;
  const editable = card.items.filter((i) => i.editable);
  const fixed = card.items.filter((i) => !i.editable);

  const start = () => {
    setFailed(null);
    setDraft([...editable.map((i) => ({ key: i.id, id: i.id, text: i.text })), ...(editable.length ? [] : [{ key: "new-0", id: null, text: "" }])]);
  };
  const set = (key, text) => setDraft((d) => d.map((l) => (l.key === key ? { ...l, text } : l)));
  const drop = (key) => setDraft((d) => d.filter((l) => l.key !== key));
  const add = () => setDraft((d) => [...d, { key: `new-${d.length}-${Date.now()}`, id: null, text: "" }]);

  const save = async (e) => {
    e.preventDefault();
    // A line taken away with × is a removal too.
    const kept = new Set(draft.map((l) => l.id).filter(Boolean));
    const lines = [...draft, ...editable.filter((i) => !kept.has(i.id)).map((i) => ({ id: i.id, text: i.text, removed: true }))];
    const changes = cardChanges(card.items, lines);
    if (!changes.add.length && !changes.change.length && !changes.remove.length) return setDraft(null);
    setSaving(true);
    setFailed(null);
    try {
      await saveCard({ card: writeAs, clientId, changes });
      setDraft(null);
    } catch (err) {
      setFailed(err);
    } finally {
      setSaving(false);
      onSaved?.();
    }
  };

  return (
    <Card className={cn("group/card flex flex-col px-5 pt-[18px] pb-4 transition-shadow duration-(--by-dur-fast) ease-by-out", draft && "border-by-accent-line")}>
      <section aria-labelledby={headId} className="contents">
        <ContextCardHead icon={icon} title={card.title} id={headId} accent={accent} action={!draft && <EditButton label={`Edit ${card.title}`} onClick={start} />} />
        {draft ? (
          <form onSubmit={save} onKeyDown={(e) => e.key === "Escape" && setDraft(null)} className="flex flex-col gap-2.5">
            {failed && <Notice tone="danger">{contextErrorMessage(failed)}</Notice>}
            {draft.map((line, i) => (
              <div key={line.key} className="flex items-start gap-1.5">
                <TextArea
                  className="min-w-0 flex-1"
                  rows={1}
                  aria-label={`${card.title}, line ${i + 1}`}
                  autoFocus={i === 0}
                  value={line.text}
                  onChange={(e) => set(line.key, e.target.value)}
                />
                <Button kind="ghost" size="md" iconOnly aria-label={`Remove line ${i + 1}`} onClick={() => drop(line.key)}><X aria-hidden="true" /></Button>
              </div>
            ))}
            {fixed.map((i) => (
              <p key={i.id} className="flex items-baseline gap-2 px-3 text-by-body text-by-text-2">
                <span className="min-w-0 flex-1">{i.text}</span>
                <span className="shrink-0 text-by-caption text-by-muted">{SOURCE_WORDS[i.source] ?? "Set elsewhere"}</span>
              </p>
            ))}
            <div className="mt-1 flex items-center gap-2">
              <Button kind="primary" type="submit" loading={saving}>Save</Button>
              <Button kind="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              <Button kind="ghost" className="ml-auto" onClick={add}><Plus aria-hidden="true" />Add a line</Button>
            </div>
          </form>
        ) : card.items.length === 0 ? (
          <p className="py-2 text-by-body text-by-muted">Nothing here yet. Use Edit to add what Birdy should know.</p>
        ) : (
          <ul className="flex flex-col">
            {card.items.map((i) => (
              <li key={i.id} className="flex items-baseline gap-3 border-t border-by-line-soft py-[9px] first:border-t-0">
                <span className="min-w-0 flex-1 text-by-body font-medium text-by-text text-pretty">{i.text}</span>
                {SOURCE_WORDS[i.source] && <span className="shrink-0 text-by-caption text-by-muted">{SOURCE_WORDS[i.source]}</span>}
              </li>
            ))}
          </ul>
        )}
        {card.used_when && (
          <p className="mt-auto flex items-center gap-[7px] pt-3 text-by-caption text-by-muted">
            <Sparkles aria-hidden="true" className="size-[13px] shrink-0 text-by-accent-line" />
            {usedWhenLine(card.used_when)}
          </p>
        )}
      </section>
    </Card>
  );
}

/** One note: its text, who it's about and when; Edit turns it into a box with Save, Delete and Cancel. */
function NoteRow({ note, showClient, onChanged }) {
  const [text, setText] = useState(null);
  const [busy, setBusy] = useState(null);
  const [failed, setFailed] = useState(null);
  const run = async (what, fn) => {
    setBusy(what);
    setFailed(null);
    try {
      await fn();
      setText(null);
    } catch (err) {
      setFailed(err);
    } finally {
      setBusy(null);
      onChanged?.();
    }
  };
  const edited = note.updated_at && note.updated_at !== note.created_at;
  const meta = [showClient && note.client_name, note.author, dayWords(note.created_at), edited && "edited"].filter(Boolean).join(" · ");
  return (
    <li className="flex items-start gap-3 border-t border-by-line-soft py-2.5 first:border-t-0">
      <span aria-hidden="true" className="mt-0.5 grid h-[30px] w-10 shrink-0 place-items-center rounded-[7px] bg-by-warning-bg text-[length:0.65625rem] font-bold tracking-[0.04em] text-by-warning">NOTE</span>
      {text !== null ? (
        <form className="flex min-w-0 flex-1 flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) run("save", () => changeNote(note.id, text.trim())); }} onKeyDown={(e) => e.key === "Escape" && setText(null)}>
          {failed && <Notice tone="danger">{contextErrorMessage(failed)}</Notice>}
          <TextArea rows={2} autoFocus aria-label="Edit the note" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex items-center gap-2">
            <Button kind="primary" size="sm" type="submit" loading={busy === "save"} disabled={!text.trim() || busy != null}>Save</Button>
            <Button kind="ghost" size="sm" onClick={() => setText(null)}>Cancel</Button>
            <Button kind="ghost" size="sm" className="ml-auto text-by-danger hover:bg-by-danger-bg hover:text-by-danger" loading={busy === "delete"} disabled={busy != null} onClick={() => run("delete", () => removeNote(note.id))}>
              <Trash2 aria-hidden="true" />Delete
            </Button>
          </div>
        </form>
      ) : (
        <>
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="text-by-body leading-[1.45] font-medium text-by-text [overflow-wrap:anywhere]">{note.text}</b>
            {meta && <small className="text-by-caption text-by-muted">{meta}</small>}
          </span>
          <Button kind="ghost" size="sm" className="shrink-0 text-by-accent hover:bg-by-accent-soft hover:text-by-accent" aria-label={`Edit the note: ${note.text}`} onClick={() => setText(note.text)}>
            <Pencil aria-hidden="true" className="size-3.5" />Edit
          </Button>
        </>
      )}
    </li>
  );
}

/** Documents & notes: the owner's notes (inside a client, that client's first) and "+ Add context". */
function NotesCard({ notes, client, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(null);
  const own = client ? notes.filter((n) => n.client_group_id === client.id) : [];
  const agency = client ? notes.filter((n) => !n.client_group_id) : notes;

  const add = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setSaving(true);
    setFailed(null);
    try {
      await addNote({ text: t, clientId: client?.id ?? null });
      setText("");
      setAdding(false);
    } catch (err) {
      setFailed(err);
    } finally {
      setSaving(false);
      onChanged?.();
    }
  };

  const list = (items, label, showClient) => (
    <ul aria-label={label} className="flex flex-col">
      {items.map((n) => <NoteRow key={n.id} note={n} showClient={showClient} onChanged={onChanged} />)}
    </ul>
  );

  return (
    <Card role="region" aria-labelledby="cx-docs" className="px-5 py-[18px]">
      <div className="mb-3 flex items-center gap-2.5">
        <h3 id="cx-docs" className="min-w-0 flex-1 font-by-display text-by-body-lg font-semibold">Documents &amp; notes</h3>
        {!adding && <Button kind="primary" onClick={() => setAdding(true)}><Plus aria-hidden="true" />{client ? "Add a note" : "Add context"}</Button>}
      </div>
      {adding && (
        <form className="mb-3 flex flex-col gap-2" onSubmit={add} onKeyDown={(e) => e.key === "Escape" && setAdding(false)}>
          {failed && <Notice tone="danger">{contextErrorMessage(failed)}</Notice>}
          <TextArea
            rows={3}
            autoFocus
            aria-label={client ? `A note about ${client.name}` : "A note for Birdy"}
            placeholder={client ? `Something Birdy should know about ${client.name}, such as when not to change budgets` : "Something Birdy should know, such as a budget freeze or a client’s busy season"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button kind="primary" type="submit" loading={saving} disabled={!text.trim()}>Add note</Button>
            <Button kind="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      )}
      {client && (
        <>
          <SubHeading className="mt-1 mb-0.5">Notes about {client.name}</SubHeading>
          {own.length ? list(own, `Notes about ${client.name}`, false) : <p className="my-1.5 text-by-body text-by-muted">No notes about {client.name} yet.</p>}
          <SubHeading className="mt-3.5 mb-0.5">Your agency’s notes</SubHeading>
        </>
      )}
      {agency.length ? list(agency, client ? "Your agency’s notes" : "Notes", !client) : (
        <p className="my-1.5 text-by-body text-by-muted">{client ? "No agency notes yet." : "No notes yet. Add what Birdy should keep in mind, and it uses it from the next answer."}</p>
      )}
    </Card>
  );
}

function LoadingCards() {
  return (
    <div aria-busy="true" aria-label="Loading what Birdy knows" className="grid gap-[18px] md:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="px-5 pt-[18px] pb-4">
          <Skeleton className="w-32" />
          {[0, 1, 2].map((r) => <Skeleton key={r} className="mt-5 w-4/5" />)}
        </Card>
      ))}
    </div>
  );
}

/**
 * A section's Context page (under "More"): what it knows, which Birdy uses in every answer and
 * suggestion. The four cards with inline edit, Documents & notes; inside a client that client's own
 * card and notes come first. Media Buyer and Sales Coach list their sub-agents and keep their lessons.
 *
 * @param {import("./sections").SectionConfig|string} props.section
 */
export function ContextTab({ section: which }) {
  const section = resolveSection(which);
  const name = section.kit.name;
  const router = useRouter();
  const search = useSearchParams();
  const tabs = useSectionTabs(section);
  const clientId = search.get("client") || null;
  const { clientGroups } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false });
  const group = clientId ? clientGroups.find((g) => g.id === clientId) ?? null : null;
  const { context, unavailable, error, isLoading, mutate } = useContext(clientId);
  const chat = useSectionChat(section, "ask_context", group);
  const refresh = () => mutate();

  // The client's own card, from the server; named from the client list until it arrives.
  const client = clientId ? context?.client ?? (group ? { id: group.id, name: group.name, items: [] } : null) : null;
  const clientCard = useMemo(() => client && context?.client ? {
    key: `client-${client.id}`, title: client.name, items: context.client.items,
    used_when: context.client.used_when || `it answers about ${client.name} or suggests a change for it`,
  } : null, [client, context]);

  // A sub-agent waiting for approval is easy to miss at the foot of the page: say so at the top.
  const [waiting, setWaiting] = useState(0);

  return (
    <div className={PAGE}>
      <SectionHeader
        section={section.kit}
        subtitle={scopedSubtitle(group)}
        tabs={tabs}
        tab="context"
        more={<SectionMore section={section} tab="context" />}
        onTabChange={(value) => router.push(sectionTabHref(section, value, search))}
      />
      <AskDock section={section} chat={chat} placeholder={`Tell ${name} something new about ${client ? client.name : "your agency"}`}>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-8 pb-28">
          <div className="flex flex-col gap-[18px]">
            <div>
              <h2 className="font-by-display text-[length:1.1875rem] leading-[1.25] font-bold">What {name} knows</h2>
              <p className="mt-1 text-by-body text-by-text-2 text-pretty">Birdy uses this in every answer and suggestion. Keep it up to date, or tell {name} below and it updates it for you.</p>
            </div>

            {waiting > 0 && (
              <Notice tone="warning" icon={<CircleAlert aria-hidden="true" />} action={<a href="#sub-agents" className="font-semibold underline">Review</a>}>
                {waiting === 1 ? "1 sub-agent is waiting for your approval." : `${waiting} sub-agents are waiting for your approval.`}
              </Notice>
            )}

            {unavailable ? (
              <Card className="px-5 py-5">
                <h3 className="font-by-display text-by-body-lg font-semibold">Context is not available yet</h3>
                <p className="mt-1 text-by-body text-by-text-2">What {name} knows will show here once it is switched on for your account.</p>
              </Card>
            ) : error ? (
              <Notice tone="danger" action={<Button size="sm" onClick={refresh}>Retry</Button>}>Couldn’t load what {name} knows. Check your connection and try again.</Notice>
            ) : isLoading || !context ? (
              <LoadingCards />
            ) : (
              <>
                {clientCard && (
                  <ContextCard key={clientCard.key} card={clientCard} writeAs={CLIENT_CARD} clientId={client.id} icon={Users} accent onSaved={refresh} />
                )}
                {clientCard && <SubHeading className="-mb-1.5 mt-1">Your agency</SubHeading>}
                <div className="grid gap-[18px] md:grid-cols-2">
                  {context.cards.map((card) => <ContextCard key={card.key} card={card} writeAs={card.key} icon={ICONS[card.key] ?? LayoutGrid} onSaved={refresh} />)}
                </div>
                <NotesCard key={client?.id ?? "agency"} notes={context.notes} client={client} onChanged={refresh} />
              </>
            )}

            {section.subAgents && <SubAgentsCard section={section} clientId={clientId} onWaiting={setWaiting} />}
            {section.lessons && <LessonsSection section={section} client={client ? { id: client.id, name: client.name } : null} />}
          </div>
        </div>
      </AskDock>
    </div>
  );
}
