"use client"

import * as React from "react"
import { CheckIcon, Settings2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "../../primitives/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../overlays/command"
import { Popover, PopoverContent, PopoverTrigger } from "../../overlays/popover"

/**
 * Column visibility picker. Renders nothing when no column can be hidden.
 *
 * @param {object} props
 * @param {import("@tanstack/react-table").Table} props.table
 */
function DataTableViewOptions({ table }) {
  const columns = table.getAllColumns().filter((c) => typeof c.accessorFn !== "undefined" && c.getCanHide())
  if (columns.length === 0) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button data-ds="view-options" aria-label="Toggle columns" variant="outline" size="sm" className="ml-auto max-md:hidden">
          <Settings2Icon aria-hidden />
          View
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-0">
        <Command>
          <CommandInput placeholder="Search columns..." />
          <CommandList>
            <CommandEmpty>No columns found.</CommandEmpty>
            <CommandGroup>
              {columns.map((column) => (
                <CommandItem key={column.id} onSelect={() => column.toggleVisibility(!column.getIsVisible())}>
                  <span className="truncate">{column.columnDef.meta?.label ?? column.id}</span>
                  <CheckIcon
                    aria-hidden
                    className={cn("ml-auto size-4 shrink-0", column.getIsVisible() ? "opacity-100" : "opacity-0")}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { DataTableViewOptions }
