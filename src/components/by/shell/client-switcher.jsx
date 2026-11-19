"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronsUpDown, LayoutGrid, Plus, Search } from "lucide-react";
import { cn } from "../cn";
import { FOCUS_RING, LIFT } from "../motion";
import { Button } from "../button";

const DOT = { danger: "bg-by-danger-solid", warning: "bg-by-warning-solid", success: "bg-by-success-solid" };
const ROW = "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-by-md px-2.5 text-left font-medium [&_svg]:size-4 [&_svg]:shrink-0";

/**
 * Scopes the whole app to one client, or back to the agency.
 *
 * Opens from the dark tile at the top of the rail or with ⌘K. Typing filters,
 * arrow keys move, Enter picks, Escape closes.
 *
 * @param {{id: string, name: string, status?: "danger"|"warning"|"success"}[]} props.clients
 * @param {string|null} props.value the scoped client's id, or null for the agency view
 * @param {(id: string|null) => void} props.onChange
 * @param {"ready"|"loading"|"error"} [props.status] state of the client list
 * @param {() => void} [props.onRetry] shown as a Retry button when the list failed to load
 * @param {(typed: string) => void} [props.onAddClient]
 */
export function ClientSwitcher({ clients, value, onChange, status = "ready", onRetry, onAddClient, className }) {
  const [open, setOpenState] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // Every way of opening starts from a clean search with the first row active.
  const setOpen = (next) => {
    if (next) { setQuery(""); setActive(0); }
    setOpenState(next);
  };
  const listRef = useRef(null);
  const listId = useId();
  const current = clients.find((c) => c.id === value) ?? null;

  // ⌘K / Ctrl+K opens the switcher from anywhere, and closes it again.
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!openRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sorted = useMemo(() => [...clients].sort((a, b) => a.name.localeCompare(b.name)), [clients]);
  const typed = query.trim();
  const matches = typed ? sorted.filter((c) => c.name.toLowerCase().includes(typed.toLowerCase())) : sorted;

  // One flat list for the keyboard: the two actions, then the clients.
  const rows = [
    { key: "add", kind: "add" },
    { key: "agency", kind: "agency" },
    ...(status === "ready" ? matches.map((client) => ({ key: client.id, kind: "client", client })) : []),
  ];
  const index = Math.min(active, rows.length - 1);

  const pick = (row) => {
    if (row.kind === "add") onAddClient?.(typed);
    else onChange(row.kind === "agency" ? null : row.client.id);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (index + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
      setActive(next);
      listRef.current?.querySelector(`[data-row="${next}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(rows[index]);
    }
  };

  const option = (row, i, children, extra) => (
    <div
      key={row.key}
      id={`${listId}-${i}`}
      role="option"
      aria-selected={i === index}
      data-row={i}
      onMouseMove={() => setActive(i)}
      onClick={() => pick(row)}
      className={cn(ROW, i === index && "bg-by-sunken", extra)}
    >
      {children}
    </div>
  );

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={current ? `Switch client, showing ${current.name}` : "Switch client, showing all clients"}
          className={cn("relative grid size-10 cursor-pointer place-items-center rounded-by-lg bg-by-text font-by-body text-by-body font-semibold text-by-on-accent [&_svg]:size-[19px]", LIFT, FOCUS_RING, className)}
        >
          {current ? current.name.trim().charAt(0).toUpperCase() : <LayoutGrid aria-hidden="true" />}
          <span aria-hidden="true" className="absolute -right-1.5 -bottom-1.5 grid size-4 place-items-center rounded-full border border-by-line bg-by-surface text-by-text">
            <ChevronsUpDown className="size-2.5!" strokeWidth={3} />
          </span>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="right"
          align="start"
          sideOffset={12}
          className="z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-by-lg bg-by-surface p-2 font-by-body text-by-body text-by-text shadow-by-floating outline-none motion-safe:animate-[by-menu_var(--by-dur-base)_var(--by-ease-spring)]"
        >
          <div className="flex h-9 items-center gap-2 rounded-by-md border border-by-line bg-by-surface px-3 shadow-by-field focus-within:border-by-accent focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-by-accent">
            <Search aria-hidden="true" className="size-4 shrink-0 text-by-muted" />
            <input
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={`${listId}-${index}`}
              aria-label="Search clients"
              placeholder="Search clients"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(e.target.value.trim() ? 2 : 0); }}
              onKeyDown={onKeyDown}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-by-muted"
            />
          </div>

          <div ref={listRef} id={listId} role="listbox" aria-label="Clients" className="mt-1.5 max-h-80 overflow-y-auto">
            {option(rows[0], 0, <><Plus aria-hidden="true" />{typed && status === "ready" && matches.length === 0 ? `Add “${typed}” as a new client` : "Add new client"}</>, "text-by-accent")}
            {option(rows[1], 1, <>
              <LayoutGrid aria-hidden="true" />
              <span className="flex-1">Agency view</span>
              <span className="text-by-body-sm font-normal text-by-muted">{clients.length} clients</span>
            </>, !current && "font-semibold")}
            <div aria-hidden="true" className="mx-1 my-1.5 h-px bg-by-line" />

            {status === "loading" && (
              <div role="status" aria-label="Loading clients" className="flex flex-col gap-1 px-1 py-1">
                {[70, 55, 80, 62, 48].map((w) => (
                  <div key={w} className="flex h-8 items-center gap-2.5 px-1.5">
                    <span className="size-1.5 rounded-full bg-by-line-strong" />
                    <span className="h-2.5 rounded-full bg-by-sunken motion-safe:animate-pulse" style={{ width: `${w}%` }} />
                  </div>
                ))}
              </div>
            )}

            {status === "error" && (
              <div role="alert" className="flex items-center justify-between gap-3 px-2.5 py-2">
                <span className="text-by-body-sm text-by-text-2">Couldn’t load your clients.</span>
                <Button size="sm" onClick={onRetry}>Retry</Button>
              </div>
            )}

            {status === "ready" && matches.length === 0 && (
              <p className="px-2.5 py-2 text-by-body-sm text-by-text-2">No client called “{typed}”.</p>
            )}

            {status === "ready" && matches.map((client, i) =>
              option(rows[i + 2], i + 2, <>
                <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", DOT[client.status] ?? "bg-by-line-strong")} />
                <span className="min-w-0 flex-1 truncate" title={client.name}>{client.name}</span>
              </>, client.id === value && "font-semibold text-by-accent"),
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
