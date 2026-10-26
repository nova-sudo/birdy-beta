"use client"

import { useMemo, useState } from "react"
import { CheckIcon } from "lucide-react"

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  TriggerButton,
} from "@/components/ds"
import { cn } from "@/lib/utils"

/**
 * Scopes the Lead Hub to one client group, or to all of them: a searchable
 * list in a popover. The Lead Hub's own control — the design's header carries
 * only a date range — and the hub is an all-clients view whose first move is
 * usually "which client is this?".
 *
 * @param {object} props
 * @param {{id: string, name?: string}[]} props.clientGroups
 * @param {string} props.value A group id, or "all"
 * @param {(id: string) => void} props.onChange
 */
export function ClientGroupSelect({ clientGroups, value, onChange }) {
  const [open, setOpen] = useState(false)

  const items = useMemo(
    () => [
      { id: "all", name: "All Clients" },
      ...(clientGroups || []).map((g) => ({ id: g.id, name: g.name || "Unnamed Client" })),
    ],
    [clientGroups]
  )
  const label = items.find((it) => it.id === value)?.name ?? "All Clients"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <TriggerButton role="combobox" aria-label="Client group" aria-expanded={open} className="max-w-52">
          <span className="truncate">{label}</span>
        </TriggerButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search clients…" />
          <CommandList>
            <CommandEmpty>No clients found</CommandEmpty>
            {items.map((item) => (
              <CommandItem
                key={item.id}
                value={item.id === "all" ? "__all__" : item.id}
                keywords={[item.name]}
                onSelect={() => {
                  onChange(item.id)
                  setOpen(false)
                }}
              >
                <span className="truncate">{item.name}</span>
                <CheckIcon
                  aria-hidden
                  className={cn("ml-auto size-4 shrink-0", item.id === value ? "opacity-100" : "opacity-0")}
                />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
