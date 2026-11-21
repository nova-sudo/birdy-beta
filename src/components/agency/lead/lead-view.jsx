"use client";

// One lead: who they are, how they got here, and every message and call.
// The same view is the lead page (/contacts/[contactId], with a back link to the
// client's leads) and the lead modal opened from a Leads table (`embed`, no back link).
//
// Header: name, stage, client, Call and Message. Three tiles. Then Profile ·
// Journey · Calls · Ads on the left and the conversation with its composer on the
// right. On a wide screen the two columns scroll on their own; narrower, they stack.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronLeft, CircleDashed, Link2, MessageSquare, Phone, UserX } from "lucide-react";
import { Button, Card, EmptyState, Notice, Pill, Skeleton, TabPanel, TabPill, Tooltip, cn } from "@/components/by";
import { initials, leadTitle } from "@/lib/lead-detail";
import { clientLeadsHref, funnelStage, leadTiles, stageNote } from "@/lib/lead-view";
import { useLead } from "./use-lead";
import { useLeadSummary } from "./use-lead-summary";
import { COMPOSER_INPUT_ID, LeadComposer } from "./lead-composer";
import { LeadThread } from "./lead-thread";
import { AdsPane, CallsPane, JourneyPane, ProfilePane } from "./lead-tabs";

/** The stage pill, in the Leads table's words and colours. */
const STAGE = {
  crm: { label: "In CRM", tone: "accent", icon: <Link2 /> },
  called: { label: "Called", tone: "warning", icon: <Phone /> },
  closed: { label: "Closed", tone: "success", icon: <Check /> },
  lost: { label: "Lost", tone: "neutral", icon: null },
  new: { label: "Not in CRM", tone: "neutral", icon: <CircleDashed /> },
};

const TABS = [
  { value: "profile", label: "Profile" },
  { value: "journey", label: "Journey" },
  { value: "calls", label: "Calls" },
  { value: "ads", label: "Ads" },
];

const focusComposer = () => {
  const box = document.getElementById(COMPOSER_INPUT_ID);
  box?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  box?.focus({ preventScroll: true });
};

function Tile({ tile, lead }) {
  return (
    <div className="min-w-0 border-by-line-soft px-4 py-2.5 not-last:border-b sm:not-last:border-r sm:not-last:border-b-0">
      <div className="text-by-body-sm font-medium text-by-text-2">
        {tile.tip ? (
          <Tooltip label={tile.tip}>
            <span tabIndex={0} className="cursor-help underline decoration-by-line-strong decoration-dotted underline-offset-2">{tile.label}</span>
          </Tooltip>
        ) : tile.label}
      </div>
      <div className={cn("mt-0.5 truncate font-by-display font-semibold tabular-nums", lead ? "text-by-title" : "text-by-heading", tile.tone === "danger" ? "text-by-muted" : "text-by-text")}>{tile.value}</div>
      <div className="mt-0.5 truncate text-by-caption font-medium text-by-muted">{tile.note}</div>
    </div>
  );
}

function Header({ lead, embed }) {
  const contact = lead.contact || {};
  const name = leadTitle(contact);
  const stage = STAGE[funnelStage(lead)];
  const note = stageNote(lead);
  return (
    <header className={cn("flex shrink-0 flex-wrap items-end gap-x-4 gap-y-3 border-b border-by-line bg-by-surface py-3.5", embed ? "px-4 md:px-5" : "px-4 md:px-7")}>
      {/* Wide enough for the name and stage, else Call and Message wrap under it. */}
      <div className="min-w-0 flex-[1_1_16rem]">
        {!embed && (
          <Link href={clientLeadsHref(contact.group_id)} className="-ml-0.5 mb-1.5 inline-flex items-center gap-1 text-by-caption font-semibold text-by-muted hover:text-by-accent">
            <ChevronLeft aria-hidden="true" className="size-3.5" />
            {contact.group_name ? `${contact.group_name} leads` : "Leads"}
          </Link>
        )}
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-by-sunken font-by-body text-by-body font-semibold text-by-text-2">{initials(name)}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="-m-1 truncate p-1 font-by-display text-by-title leading-[1.2] font-bold tracking-[-0.01em] text-by-text">{name}</h1>
              <span className="flex min-w-0 items-center gap-2">
                <Pill tone={stage.tone} dot={!stage.icon} className="[&_svg]:size-3">{stage.icon}{stage.label}</Pill>
                {note && <span className="truncate text-by-body-sm text-by-muted">{note}</span>}
              </span>
            </div>
            {contact.group_name && <p className="truncate text-by-body text-by-muted">{contact.group_name}</p>}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-by-md border border-by-line bg-by-surface px-3.5 font-by-body text-by-body font-semibold text-by-text shadow-by-raised hover:border-by-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent [&_svg]:size-4">
            <Phone aria-hidden="true" />Call
          </a>
        )}
        <Button kind="primary" onClick={focusComposer}><MessageSquare aria-hidden="true" />Message</Button>
      </div>
    </header>
  );
}

function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading this lead" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-col gap-2"><Skeleton className="h-4 w-48" /><Skeleton className="w-28" /></div>
      </div>
      <Skeleton className="h-16 w-full rounded-by-lg" />
      <div className="grid gap-3.5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Skeleton className="h-80 rounded-by-lg" />
        <Skeleton className="h-80 rounded-by-lg" />
      </div>
    </div>
  );
}

/**
 * @param {string} props.contactId the CRM contact
 * @param {boolean} [props.embed] inside the lead modal: no back link, and the modal sets the height
 */
export function LeadView({ contactId, embed = false }) {
  const data = useLead(contactId);
  const { lead, items, messagesStatus } = data;
  const [tab, setTab] = useState("profile");
  // A call picked on the Calls tab; it stays marked until another is picked or the tab is left.
  const [jump, setJump] = useState(null);
  const summary = useLeadSummary(contactId, data.state === "ready" && String(lead?.contact?.id) === contactId);
  const itemsReady = messagesStatus !== "loading";
  const tiles = useMemo(() => (lead ? leadTiles(lead, itemsReady ? items : []) : []), [lead, items, itemsReady]);

  const changeTab = (value) => {
    setTab(value);
    if (value !== "calls") setJump(null);
    if (value === "journey") data.openJourney();
  };

  if (data.state === "loading") return <div className={cn(!embed && "px-4 py-5 md:px-7")}><Loading /></div>;
  if (data.state === "error") {
    return (
      <div className={cn("mx-auto w-full max-w-xl", !embed && "px-4 py-8")}>
        <Notice tone="danger" action={<Button size="sm" onClick={data.retry}>Retry</Button>}>Couldn’t load this lead. {data.error}</Notice>
      </div>
    );
  }
  if (data.state === "not-found") {
    return (
      <Card className="mx-auto my-8 w-full max-w-md">
        <EmptyState
          icon={<UserX />}
          title="This lead isn’t in Birdy anymore"
          action={!embed && <Link href={clientLeadsHref(null)} className="inline-flex items-center gap-1.5 text-by-body-sm font-semibold text-by-accent hover:underline"><ArrowLeft aria-hidden="true" className="size-3.5" />Back to Leads</Link>}
        >
          It may have been deleted or merged in GoHighLevel.
        </EmptyState>
      </Card>
    );
  }

  const contact = lead.contact || {};
  const firstName = contact.first_name || leadTitle(contact).split(" ")[0];

  return (
    <div className="flex flex-1 flex-col lg:min-h-[44rem]">
      <Header lead={lead} embed={embed} />
      <div className={cn("flex flex-1 flex-col gap-3.5 lg:min-h-0", embed ? "p-4 md:p-5" : "px-4 py-4 md:px-7 md:py-5")}>
        <Card className="grid shrink-0 sm:grid-cols-3" aria-label="Lead figures" role="group">
          {tiles.map((t, i) => <Tile key={t.key} tile={t} lead={i === 0} />)}
        </Card>

        <div className="grid gap-3.5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(18.75rem,22.5rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
          <Card className="flex min-h-0 flex-col overflow-hidden">
            <TabPill
              aria-label="Lead details"
              items={TABS}
              value={tab}
              onValueChange={changeTab}
              fill
              className="m-3 mb-0 flex [&>[role=tab]]:flex-1 [&>[role=tab]]:justify-center [&>[role=tab]]:px-2"
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
                <TabPanel value="profile"><ProfilePane lead={lead} items={items} itemsReady={itemsReady} summary={summary} /></TabPanel>
                <TabPanel value="journey"><JourneyPane journey={data.journey} status={data.journeyStatus} onRetry={data.retryJourney} /></TabPanel>
                <TabPanel value="calls"><CallsPane calls={lead.calls} items={items} selectedKey={tab === "calls" ? jump?.key ?? null : null} onJump={(key) => setJump((j) => ({ key, n: (j?.n ?? 0) + 1 }))} /></TabPanel>
                <TabPanel value="ads"><AdsPane attribution={lead.attribution} groupId={contact.group_id} /></TabPanel>
              </div>
            </TabPill>
          </Card>

          <LeadThread
            className="h-[40rem] lg:h-auto"
            items={items}
            firstName={firstName}
            messagesStatus={messagesStatus}
            messagesNote={data.messagesNote}
            onRetry={data.reloadMessages}
            jump={jump}
            selectedKey={tab === "calls" ? jump?.key ?? null : null}
            composer={
              <LeadComposer
                contact={contact}
                contactId={contactId}
                status={messagesStatus}
                onSent={data.addMessage}
                onUnconfirmed={data.reloadMessages}
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
