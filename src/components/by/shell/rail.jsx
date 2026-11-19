"use client";

import { Ellipsis, SlidersHorizontal } from "lucide-react";
import { cn } from "../cn";
import { FOCUS_RING, LIFT, SELECTION } from "../motion";
import { Tooltip } from "../tooltip";
import { Menu, MenuContent, MenuLabel, MenuTrigger } from "../popover-menu";
import { BirdyAvatar, UserAvatar } from "../avatar";
import { CreditsRing } from "./credits-ring";
import { SECTIONS, visibleSections } from "./sections";

const TILE = cn("relative grid size-10 cursor-pointer place-items-center rounded-by-lg [&_svg]:size-[19px]", LIFT, FOCUS_RING);

function SectionButton({ section, active, count, onSelect }) {
  const waiting = count > 0 ? `${count} waiting` : null;
  const Icon = section.icon;
  return (
    <Tooltip side="right" label={waiting ? `${section.name} · ${waiting}` : section.name}>
      <button
        type="button"
        aria-label={waiting ? `${section.name}, ${waiting}` : section.name}
        aria-current={active ? "page" : undefined}
        onClick={() => onSelect?.(section.id)}
        className={cn(
          TILE,
          section.mascot
            ? // The mascot keeps its round frame at the tiles' size. The bird inside is
              // scaled up from its feet so it reads at rail size, cropped by the circle.
              // When the section is open, an accent ring marks it.
              cn("rounded-full", active && "outline-2 outline-offset-2 outline-by-accent")
            : active ? cn(section.solid, "shadow-by-raised") : section.tile,
        )}
      >
        {section.mascot ? <BirdyAvatar size={40} className="[&>svg]:origin-bottom [&>svg]:scale-[1.18]" /> : <Icon aria-hidden="true" />}
        {count > 0 && <span aria-hidden="true" className="absolute -top-1 -right-1 size-2.5 rounded-full bg-by-accent ring-2 ring-by-rail" />}
      </button>
    </Tooltip>
  );
}

/**
 * The app's left rail: client switcher, sections, then settings, credits and the user.
 *
 * @param {string} props.activeId the open section's id, or "settings"
 * @param {(id: string) => void} [props.onSelect]
 * @param {Record<string, number>} [props.counts] open suggestions per section id; a dot shows when above zero
 * @param {React.ReactNode} [props.switcher] the ClientSwitcher
 * @param {{left: number, percent: number}} [props.credits]
 * @param {{name: string}} [props.user] shown as a plain avatar; ignored when `account` is given
 * @param {React.ReactNode} [props.extra] sits under the sections, e.g. a RailMenuTile for pages without a tile
 * @param {React.ReactNode} [props.account] replaces the plain avatar, e.g. a RailAccount
 * @param {object[]} [props.sections] defaults to SECTIONS; disabled ones are skipped
 */
export function Rail({ activeId, onSelect, counts = {}, switcher, credits, user, extra, account, sections = SECTIONS, className, ...props }) {
  return (
    <aside className={cn("flex w-17 shrink-0 flex-col items-center gap-3 border-r border-by-line bg-by-rail pt-4 pb-3.5", SELECTION, className)} {...props}>
      {switcher}
      <span aria-hidden="true" className="my-0.5 h-px w-8 bg-by-line" />
      <nav aria-label="Sections" className="flex flex-col items-center gap-3">
        {visibleSections(sections).map((section) => (
          <SectionButton key={section.id} section={section} active={section.id === activeId} count={counts[section.id] ?? 0} onSelect={onSelect} />
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
