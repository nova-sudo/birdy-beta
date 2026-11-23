"use client";

import { Ellipsis, Lock, SlidersHorizontal } from "lucide-react";
import { cn } from "../cn";
import { FOCUS_RING, LIFT, SELECTION } from "../motion";
import { Tooltip } from "../tooltip";
import { Menu, MenuContent, MenuLabel, MenuTrigger } from "../popover-menu";
import { BirdyAvatar, UserAvatar } from "../avatar";
import { useBirdy } from "@/components/birdy/use-birdy";
import { CreditsRing } from "./credits-ring";
import { SECTIONS, visibleSections } from "./sections";

const TILE = cn("relative grid size-10 cursor-pointer place-items-center rounded-by-lg [&_svg]:size-[19px]", LIFT, FOCUS_RING);

function SectionButton({ section, active, count, locked, onSelect }) {
  const waiting = locked ? "locked" : count > 0 ? `${count} waiting` : null;
  const Icon = section.icon;
  return (
    <Tooltip side="right" label={waiting ? `${section.name} · ${locked ? "Locked until set up" : waiting}` : section.name}>
      <button
        type="button"
        aria-label={waiting ? `${section.name}, ${waiting}` : section.name}
        aria-current={active ? "page" : undefined}
        onClick={() => onSelect?.(section.id)}
        className={cn(TILE, active ? cn(section.solid, "shadow-by-raised") : section.tile)}
      >
        <Icon aria-hidden="true" />
        {locked ? (
          <span aria-hidden="true" data-lock="" className="absolute -right-1 -bottom-1 grid size-4.5 place-items-center rounded-full bg-by-surface text-by-muted shadow-by-card ring-1 ring-by-line [&>svg]:size-2.5">
            <Lock strokeWidth={2.6} />
          </span>
        ) : count > 0 && <span aria-hidden="true" className="absolute -top-1 -right-1 size-2.5 rounded-full bg-by-accent ring-2 ring-by-rail" />}
      </button>
    </Tooltip>
  );
}

/**
 * Birdy's brand mark at the top of the rail: the animated mascot in its round
 * frame, following the cursor and reacting to the app like the old sidebar's.
 * It is not a section, so it never shows an active ring or a count.
 *
 * @param {() => void} [props.onHome] given: the mark is a button that opens the home section
 */
export function RailBrand({ onHome }) {
  const { state } = useBirdy();
  const mark = <BirdyAvatar size={40} state={state} speedK={1.15} />;
  if (!onHome) return <span className="grid size-10 place-items-center">{mark}</span>;
  return (
    <button type="button" aria-label="Birdy home" onClick={onHome} className={cn("grid size-10 cursor-pointer place-items-center rounded-full", LIFT, FOCUS_RING)}>
      {mark}
    </button>
  );
}

/**
 * The app's left rail: Birdy's mark, the client switcher, sections, then settings, credits and the user.
 *
 * @param {() => void} [props.onHome] makes Birdy's mark at the top a button, e.g. to open the home section
 * @param {string} props.activeId the open section's id, or "settings"
 * @param {(id: string) => void} [props.onSelect]
 * @param {Record<string, number>} [props.counts] open suggestions per section id; a dot shows when above zero
 * @param {Record<string, boolean>} [props.locks] sections whose agent isn't set up yet; a lock shows instead of the dot
 * @param {React.ReactNode} [props.switcher] the ClientSwitcher
 * @param {{left: number, percent: number}} [props.credits]
 * @param {{name: string}} [props.user] shown as a plain avatar; ignored when `account` is given
 * @param {React.ReactNode} [props.extra] sits under the sections, e.g. a RailMenuTile for pages without a tile
 * @param {React.ReactNode} [props.account] replaces the plain avatar, e.g. a RailAccount
 * @param {object[]} [props.sections] defaults to SECTIONS; disabled ones are skipped
 * @param {React.ReactNode} [props.setup] sits under the switcher while setup isn't finished: a SetupRing
 */
export function Rail({ activeId, onSelect, onHome, counts = {}, locks = {}, switcher, credits, user, extra, account, sections = SECTIONS, setup, className, ...props }) {
  return (
    <aside className={cn("flex w-17 shrink-0 flex-col items-center gap-3 border-r border-by-line bg-by-rail pt-4 pb-3.5", SELECTION, className)} {...props}>
      <RailBrand onHome={onHome} />
      {switcher}
      {setup}
      <span aria-hidden="true" className="my-0.5 h-px w-8 bg-by-line" />
      <nav aria-label="Sections" className="flex flex-col items-center gap-3">
        {visibleSections(sections).map((section) => (
          <SectionButton key={section.id} section={section} active={section.id === activeId} count={counts[section.id] ?? 0} locked={Boolean(locks[section.id])} onSelect={onSelect} />
        ))}
      </nav>
      {extra}
      <span className="flex-1" />
      <Tooltip side="right" label="Settings">
        <button
          type="button"
          aria-label="Settings"
          aria-current={activeId === "settings" ? "page" : undefined}
          onClick={() => onSelect?.("settings")}
          className={cn(TILE, "text-by-text-2 hover:bg-by-sunken hover:text-by-text", activeId === "settings" && "bg-by-sunken text-by-text")}
        >
          <SlidersHorizontal aria-hidden="true" />
        </button>
      </Tooltip>
      {credits && (
        <Tooltip side="right" label={`${credits.left.toLocaleString("en-GB")} credits left · ${Math.round(credits.percent)}%`}>
          <span tabIndex={0} className={cn("grid size-10 place-items-center rounded-by-lg", FOCUS_RING)}>
            <CreditsRing left={credits.left} percent={credits.percent} />
          </span>
        </Tooltip>
      )}
      {account ?? (user && <UserAvatar name={user.name} />)}
    </aside>
  );
}

/**
 * A dashed tile that opens a menu, for destinations that have no tile of
 * their own. Give it MenuItem children.
 *
 * @param {string} props.label the menu's heading, tooltip and accessible name
 * @param {boolean} [props.active] one of its destinations is the current page
 */
export function RailMenuTile({ label, active = false, children }) {
  return (
    <Menu>
      <Tooltip side="right" label={label}>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className={cn(
              TILE,
              "border-[1.5px] border-dashed border-by-line-strong text-by-text-2 hover:text-by-text data-[state=open]:border-solid data-[state=open]:border-by-line data-[state=open]:bg-by-sunken",
              active && "border-solid border-by-line bg-by-sunken text-by-text",
            )}
          >
            <Ellipsis aria-hidden="true" />
          </button>
        </MenuTrigger>
      </Tooltip>
      <MenuContent side="right" align="start" sideOffset={12}>
        <MenuLabel>{label}</MenuLabel>
        {children}
      </MenuContent>
    </Menu>
  );
}

/**
 * The signed-in person's avatar as the trigger of their account menu. Give it
 * MenuItem children.
 *
 * @param {string} props.name
 * @param {string} [props.detail] a quieter second line, such as their email
 */
export function RailAccount({ name, detail, children }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button type="button" aria-label={`Account menu, ${name}`} className={cn("cursor-pointer rounded-full data-[state=open]:outline-2 data-[state=open]:outline-offset-2 data-[state=open]:outline-by-accent", LIFT, FOCUS_RING)}>
          <UserAvatar name={name} role={undefined} aria-label={undefined} aria-hidden="true" />
        </button>
      </MenuTrigger>
      <MenuContent side="right" align="end" sideOffset={12} className="min-w-56">
        <div className="px-2.5 pt-2 pb-1.5">
          <div className="truncate font-semibold">{name}</div>
          {detail && <div className="truncate text-by-body-sm text-by-muted">{detail}</div>}
        </div>
        {children}
      </MenuContent>
    </Menu>
  );
}
