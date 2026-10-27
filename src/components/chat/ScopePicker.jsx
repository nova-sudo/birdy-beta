"use client"

import { useMemo, useState } from "react"
import { Check, ChevronDown, Globe, UserRound } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

// ─── Asking about ───────────────────────────────────────────────────────────
// Which client a question is about, chosen rather than typed. Birdy used to
// infer the client from the wording ("how is Aura doing?"), which works until
// two clients share a word. Picking it here sends client_group_id with the
// message, the same thing the client detail page's chat has always done.
//
// Sits in the composer's foot so it reads as part of the question, and opens
// upward because the composer is at the bottom of every surface it lives on.

export const ALL_CLIENTS = { id: null, name: "All clients" }

/**
 * @param {{id: string|null, name: string}} value the current scope
 * @param {{id, name}[]} clients the groups to offer
 * @param {(scope: {id, name}) => void} onChange
 * @param {boolean} [locked] the surface is pinned to one client (client detail)
 */
export default function ScopePicker({ value, clients = [], onChange, locked = false, className }) {
  const [open, setOpen] = useState(false)
  const isAll = !value?.id
  const options = useMemo(
    () => (clients ?? []).map((g) => ({ id: g.id, name: g.name || "Unnamed client" })),
    [clients]
  )

  const trigger = (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-pd-subtle">
      Asking about
      <span
        className={cn(
          "inline-flex max-w-[180px] items-center gap-1 rounded-full px-2 py-[2px] font-semibold",
          isAll ? "bg-pd-divider text-pd-ink" : "bg-pd-primary-tint text-pd-primary"
        )}
      >
        {isAll
          ? <Globe className="size-3 shrink-0" aria-hidden="true" />
          : <UserRound className="size-3 shrink-0" aria-hidden="true" />}
        <span className="truncate">{value?.name ?? ALL_CLIENTS.name}</span>
        {!locked && <ChevronDown className="size-3 shrink-0 opacity-70" aria-hidden="true" />}
      </span>
    </span>
  )

  if (locked) {
    return <span className={className}>{trigger}</span>
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Asking about: ${value?.name ?? ALL_CLIENTS.name}`}
          className={cn(
            "cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary",
            className
          )}
        >
          {trigger}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-[260px] p-0">
        <Command>
          <CommandInput placeholder="Find a client…" />
          <CommandList className="max-h-[260px]">
            <CommandEmpty>No client matches.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => { onChange(ALL_CLIENTS); setOpen(false) }}
              >
                <Globe className="size-3.5 text-pd-subtle" aria-hidden="true" />
                All clients
                {isAll && <Check className="ml-auto size-3.5 text-pd-primary" aria-hidden="true" />}
              </CommandItem>
            </CommandGroup>
            {options.length > 0 && (
              <CommandGroup heading="Clients">
                {options.map((g) => (
                  <CommandItem
                    key={g.id}
                    value={`${g.name} ${g.id}`}
                    onSelect={() => { onChange(g); setOpen(false) }}
                  >
                    <UserRound className="size-3.5 text-pd-subtle" aria-hidden="true" />
                    <span className="truncate">{g.name}</span>
                    {value?.id === g.id && (
                      <Check className="ml-auto size-3.5 text-pd-primary" aria-hidden="true" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
