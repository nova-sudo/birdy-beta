"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"

import { askBirdy } from "@/lib/ask-birdy"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../overlays/command"
import { NAV_ITEMS } from "./nav-config"

/**
 * ⌘K palette: jump to a page, or send what was typed to Birdy (what the old
 * header search bar did).
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {typeof NAV_ITEMS} [props.items=NAV_ITEMS]
 */
function CommandSearch({ open, onOpenChange, items = NAV_ITEMS }) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const text = query.trim()

  const handleOpenChange = (next) => {
    if (!next) setQuery("")
    onOpenChange(next)
  }

  const go = (href) => {
    handleOpenChange(false)
    router.push(href)
  }

  const ask = () => {
    handleOpenChange(false)
    askBirdy(text)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search"
      description="Jump to a page or ask Birdy a question"
    >
      <CommandInput value={query} onValueChange={setQuery} placeholder="Search pages or ask Birdy..." />
      <CommandList data-ds="command-search">
        <CommandEmpty>No matching pages.</CommandEmpty>
        {text && (
          // forceMount keeps the row visible whatever cmdk's filter thinks of the text.
          <CommandGroup heading="Ask">
            <CommandItem forceMount value={`ask-birdy ${text}`} onSelect={ask}>
              <Sparkles className="text-primary" />
              <span className="min-w-0 truncate">Ask Birdy: {text}</span>
            </CommandItem>
          </CommandGroup>
        )}
        <CommandGroup heading="Pages">
          {items.map((item) => (
            <CommandItem key={item.key} value={item.label} onSelect={() => go(item.href)}>
              <item.icon />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

export { CommandSearch }
