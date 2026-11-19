"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "../cn";
import { FOCUS_RING, LIFT } from "../motion";
import { Tooltip } from "../tooltip";
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
            ? // The mascot keeps its round frame, a little larger than the icon tiles so the
              // bird reads at rail size; when open, an accent ring marks it.
              cn("size-12 rounded-full", active && "outline-2 outline-offset-2 outline-by-accent")
            : active ? cn(section.solid, "shadow-by-raised") : section.tile,
        )}
      >
        {section.mascot ? <BirdyAvatar size={48} /> : <Icon aria-hidden="true" />}
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
 * @param {{name: string}} [props.user]
 * @param {object[]} [props.sections] defaults to SECTIONS; disabled ones are skipped
 */
export function Rail({ activeId, onSelect, counts = {}, switcher, credits, user, sections = SECTIONS, className, ...props }) {
  return (
    <aside className={cn("flex w-17 shrink-0 flex-col items-center gap-3 border-r border-by-line bg-by-rail pt-4 pb-3.5", className)} {...props}>
      {switcher}
      <span aria-hidden="true" className="my-0.5 h-px w-8 bg-by-line" />
      <nav aria-label="Sections" className="flex flex-col items-center gap-3">
        {visibleSections(sections).map((section) => (
          <SectionButton key={section.id} section={section} active={section.id === activeId} count={counts[section.id] ?? 0} onSelect={onSelect} />
        ))}
      </nav>
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
      {user && <UserAvatar name={user.name} />}
    </aside>
  );
}
