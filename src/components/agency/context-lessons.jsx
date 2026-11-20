"use client";

import { useState } from "react";
import { GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Card, Notice, Skeleton, TextArea } from "@/components/by";
import { ContextCardHead, SubHeading } from "@/components/agency/context-parts";
import { parseServerDate } from "@/lib/stock-agent-api";
import { LESSON_MAX, LESSON_SOURCES, addLesson, changeLesson, lessonErrorMessage, removeLesson, useTeamLessons } from "@/lib/team-lessons";

/** "12 Aug 2026". */
const dayWords = (iso) => {
  const d = parseServerDate(iso);
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
};

/**
 * One lesson: its text, who it covers, where it came from; Edit turns it into a box with Save, Delete and Cancel.
 * @param {false|"some"|"all"} props.showClient which client names the line under it carries
 */
function LessonRow({ agent, lesson, showClient, onChanged }) {
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
  const edited = lesson.updated_at && lesson.updated_at !== lesson.created_at;
  // "all": name every lesson's client, "All clients" included; "some": only a lesson kept for one client.
  const who = !showClient ? null : lesson.client_group_id ? lesson.client_name ?? "One client" : showClient === "all" ? "All clients" : null;
  const meta = [who, LESSON_SOURCES[lesson.source], dayWords(lesson.created_at), edited && "edited"].filter(Boolean).join(" · ");
  const trimmed = text?.trim() ?? "";
  return (
    <li className="flex items-start gap-3 border-t border-by-line-soft py-2.5 first:border-t-0">
      {text !== null ? (
        <form
          className="flex min-w-0 flex-1 flex-col gap-2"
          onSubmit={(e) => { e.preventDefault(); if (trimmed && trimmed !== lesson.text.trim()) run("save", () => changeLesson(agent, lesson.id, trimmed)); else if (trimmed) setText(null); }}
          onKeyDown={(e) => e.key === "Escape" && setText(null)}
        >
          {failed && <Notice tone="danger">{lessonErrorMessage(failed)}</Notice>}
          <TextArea rows={2} autoFocus maxLength={LESSON_MAX} aria-label="Edit the lesson" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex items-center gap-2">
            <Button kind="primary" size="sm" type="submit" loading={busy === "save"} disabled={!trimmed || busy != null}>Save</Button>
            <Button kind="ghost" size="sm" disabled={busy != null} onClick={() => setText(null)}>Cancel</Button>
            <Button kind="ghost" size="sm" className="ml-auto text-by-danger hover:bg-by-danger-bg hover:text-by-danger" loading={busy === "delete"} disabled={busy != null} onClick={() => run("delete", () => removeLesson(agent, lesson.id))}>
              <Trash2 aria-hidden="true" />Delete
            </Button>
          </div>
        </form>
      ) : (
        <>
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="text-by-body leading-[1.45] font-medium text-by-text [overflow-wrap:anywhere]">{lesson.text}</b>
            {meta && <small className="text-by-caption text-by-muted">{meta}</small>}
          </span>
          <Button kind="ghost" size="sm" className="shrink-0 text-by-accent hover:bg-by-accent-soft hover:text-by-accent" aria-label={`Edit the lesson: ${lesson.text}`} onClick={() => { setFailed(null); setText(lesson.text); }}>
            <Pencil aria-hidden="true" className="size-3.5" />Edit
          </Button>
        </>
      )}
    </li>
  );
}

/**
 * A main agent's lessons on its Context page: what the owner told it to do differently, added,
 * edited and deleted in place. Inside a client, that client's lessons come first and a new one is
 * kept for that client.
 *
 * @param {import("./sections").SectionConfig} props.section Media Buyer or Sales Coach
 * @param {{id: string, name: string}|null} [props.client]
 */
export function LessonsSection({ section, client = null }) {
  const agent = section.chat.agent;
  const name = section.kit.name;
  const { lessons, unavailable, error, isLoading, mutate } = useTeamLessons(agent, client?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(null);
  const refresh = () => mutate();

  const own = client ? lessons.filter((l) => l.client_group_id === client.id) : [];
  const rest = client ? lessons.filter((l) => l.client_group_id !== client.id) : lessons;

  const add = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setSaving(true);
    setFailed(null);
    try {
      await addLesson(agent, { text: t, clientId: client?.id ?? null });
      setText("");
      setAdding(false);
    } catch (err) {
      setFailed(err);
    } finally {
      setSaving(false);
      refresh();
    }
  };

  const list = (items, label, showClient) => (
    <ul aria-label={label} className="flex flex-col">
      {items.map((l) => <LessonRow key={l.id} agent={agent} lesson={l} showClient={showClient} onChanged={refresh} />)}
    </ul>
  );

  const count = lessons.length;
  const ready = !unavailable && !error && !isLoading;

  return (
    <Card role="region" aria-labelledby="cx-lessons" className="px-5 pt-[18px] pb-4">
      <ContextCardHead
        icon={GraduationCap}
        title="Lessons"
        id="cx-lessons"
        action={ready && !adding && (
          <>
            {count > 0 && <span className="text-by-caption text-by-muted tabular-nums">{count === 1 ? "1 lesson" : `${count} lessons`}</span>}
            <Button kind="ghost" size="sm" className="text-by-accent hover:bg-by-accent-soft hover:text-by-accent" onClick={() => { setFailed(null); setAdding(true); }}>
              <Plus aria-hidden="true" className="size-3.5" />Add a lesson
            </Button>
          </>
        )}
      />
      {adding && (
        <form className="mb-3 flex flex-col gap-2" onSubmit={add} onKeyDown={(e) => e.key === "Escape" && setAdding(false)}>
          {failed && <Notice tone="danger">{lessonErrorMessage(failed)}</Notice>}
          <TextArea
            rows={2}
            autoFocus
            maxLength={LESSON_MAX}
            aria-label={client ? `A lesson for ${name} about ${client.name}` : `A lesson for ${name}`}
            placeholder={client ? `What ${name} should do differently for ${client.name}` : `What ${name} should do differently, such as never pausing an ad in its first 3 days`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button kind="primary" size="sm" type="submit" loading={saving} disabled={!text.trim()}>Add lesson</Button>
            <Button kind="ghost" size="sm" disabled={saving} onClick={() => setAdding(false)}>Cancel</Button>
            <span className="ml-auto text-by-caption text-by-muted">{client ? `Kept for ${client.name} only` : "Kept for all clients"}</span>
          </div>
        </form>
      )}
      {unavailable ? (
        <p className="py-1 text-by-body text-by-text-2">Lessons are not available yet. They will show here once they are switched on for your account.</p>
      ) : error ? (
        <Notice tone="danger" action={<Button size="sm" onClick={refresh}>Retry</Button>}>Couldn’t load {name}’s lessons. Check your connection and try again.</Notice>
      ) : isLoading ? (
        <div aria-busy="true" aria-label="Loading lessons" className="flex flex-col gap-3 py-1"><Skeleton className="w-56" /><Skeleton className="w-80 max-w-full" /></div>
      ) : client ? (
        <>
          <SubHeading className="mt-1 mb-0.5">For {client.name}</SubHeading>
          {own.length ? list(own, `Lessons for ${client.name}`, false) : <p className="my-1.5 text-by-body text-by-muted">No lessons for {client.name} yet.</p>}
          <SubHeading className="mt-3.5 mb-0.5">For every client</SubHeading>
          {rest.length ? list(rest, "Lessons for every client", "some") : <p className="my-1.5 text-by-body text-by-muted">No lessons for every client yet.</p>}
        </>
      ) : count === 0 ? (
        !adding && <p className="py-1 text-by-body text-by-text-2 text-pretty">No lessons yet. Tell {name} what to do differently, here or in Chat, and it keeps it as a lesson.</p>
      ) : (
        list(rest, "Lessons", "all")
      )}
      {ready && count > 0 && (
        <p className="mt-auto flex items-center gap-[7px] pt-3 text-by-caption text-by-muted">
          <GraduationCap aria-hidden="true" className="size-[13px] shrink-0 text-by-accent-line" />
          {name} follows these every time it works.
        </p>
      )}
    </Card>
  );
}
