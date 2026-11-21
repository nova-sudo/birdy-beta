"use client";

// The drill-down controls on the Ads tables: the client picker (agency only) and the trail of
// filters, both kept in the address. The rules for what narrows what live in lib/buyer-drill.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { Button, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/by";
import { AGENCY_DRILL, clearDrill, drillQuery, readDrill, stepTo } from "@/lib/buyer-drill";

/**
 * The level and filters in the address, and the ways to change them.
 * Every change is a new history entry, so the back button steps back through a drill.
 * @param {import("@/lib/buyer-drill").DrillScope} [scope] the agency's levels when left out
 */
export function useDrill(scope = AGENCY_DRILL) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { level, drill } = readDrill(search, scope);
  const go = (nextLevel, nextDrill) => {
    const query = drillQuery(search, nextLevel, nextDrill, scope);
    router.push(query ? `${pathname}?${query}` : pathname);
  };
  return {
    scope,
    level,
    drill,
    go,
    /** Change level by hand, keeping every filter: those that don't apply there are only set aside. */
    setLevel: (next) => go(next, drill),
    clear: (key) => go(level, clearDrill(drill, key)),
    step: (key) => { const to = stepTo(drill, key); go(to.level, to.drill); },
    pickClient: (id) => go(level, id ? { group: id } : {}),
  };
}

/**
 * The old Marketing Hub's client picker, in the new kit: every client or one.
 * Picking a client drops the campaign, ad set and ad filters, which belonged to the old one.
 */
export function ClientFilter({ clients, value, onChange }) {
  const current = clients.find((c) => c.id === value);
  const sorted = [...clients].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button aria-label={current ? `Client: ${current.name}` : "Client: all clients"} className="max-w-44">
          <span className="min-w-0 truncate">{current ? current.name : "All clients"}</span>
          <ChevronDown aria-hidden="true" className="text-by-muted" />
        </Button>
      </MenuTrigger>
      <MenuContent align="end" className="max-h-96 w-64 overflow-y-auto">
        <MenuItem selected={!current} onSelect={() => onChange(null)}>
          <span className="min-w-0 flex-1 truncate">All clients</span>
          {!current && <Check aria-hidden="true" />}
        </MenuItem>
        {sorted.length > 0 && <MenuSeparator />}
        {sorted.map((c) => (
          <MenuItem key={c.id} selected={c.id === value} onSelect={() => onChange(c.id)}>
            <span className="min-w-0 flex-1 truncate" title={c.name}>{c.name}</span>
            {c.id === value && <Check aria-hidden="true" />}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

/**
 * The filters a drill has set, outermost first: each one steps back to it, and its × removes it
 * with everything under it. Filters the level doesn't use are shown faded, kept for when you go back down.
 *
 * @param {{key: string, noun: string, name: string|null}[]} props.trail
 * @param {Set<string>} props.applied the filter keys the current level uses
 */
export function DrillTrail({ trail, applied, loading, onStep, onClear, onOpenClient }) {
  if (trail.length === 0) return null;
  return (
    <nav aria-label="Filtered to" className="flex basis-full flex-wrap items-center gap-1.5 pt-0.5">
      <span className="mr-1 text-by-body-sm text-by-muted">Filtered to</span>
      {trail.map((chip, i) => {
        const label = chip.name ?? (loading ? "Loading" : `${chip.noun} not in this range`);
        const faded = !applied.has(chip.key);
        return (
          <span key={chip.key} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-by-line-strong" />}
            <span
              className={`inline-flex h-7 min-w-0 items-center rounded-by-sm bg-by-accent-soft font-by-body text-by-body-sm font-semibold text-by-accent ${faded ? "opacity-60" : ""}`}
              title={faded ? `${chip.noun} filter, not used on this level` : undefined}
            >
              <button
                type="button"
                onClick={() => onStep(chip.key)}
                className="flex h-full min-w-0 cursor-pointer items-center gap-1 rounded-l-by-sm pr-1 pl-2.5 hover:bg-by-accent-soft-hover focus-visible:outline-2 focus-visible:outline-by-accent"
                aria-label={`${chip.noun}: ${label}. Show what is under it`}
              >
                <span className="text-by-caption font-medium opacity-75">{chip.noun}</span>
                <span className="max-w-48 truncate">{label}</span>
              </button>
              {chip.key === "group" && onOpenClient && (
                <button
                  type="button"
                  onClick={() => onOpenClient(chip.id)}
                  className="grid h-full w-6 cursor-pointer place-items-center hover:bg-by-accent-soft-hover focus-visible:outline-2 focus-visible:outline-by-accent"
                  aria-label={`Open ${label}'s own dashboard`}
                  title="Open this client's dashboard"
                >
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onClear(chip.key)}
                className="grid h-full w-7 cursor-pointer place-items-center rounded-r-by-sm hover:bg-by-accent-soft-hover focus-visible:outline-2 focus-visible:outline-by-accent"
                aria-label={`Remove the ${chip.noun.toLowerCase()} filter${i < trail.length - 1 ? " and those under it" : ""}`}
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </span>
          </span>
        );
      })}
    </nav>
  );
}
