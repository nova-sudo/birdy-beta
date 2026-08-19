"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// The client filter that scopes the whole Sales Hub to one client group, or to
// all of them. Lifted out of CallCentreContent so the page's shell can own the
// header row while the table below stays the thing that reads the selection.
//
// The design has no such control — its header carries only a date range. This
// is Birdy's own, and it stays: the hub is an all-clients view whose first move
// is usually "which client is this?".

export function ClientGroupPicker({ clientGroups, value, onChange, className }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  const items = useMemo(
    () => [
      { id: "all", name: "All Clients" },
      ...(clientGroups || []).map((g) => ({ id: g.id, name: g.name || "Unnamed Client" })),
    ],
    [clientGroups]
  );

  const filtered = useMemo(
    () => items.filter((it) => it.name.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );

  const label = useMemo(() => {
    if (value === "all") return "All Clients";
    return (clientGroups || []).find((g) => g.id === value)?.name || "All Clients";
  }, [value, clientGroups]);

  // Close on outside click and on Escape — the design asks for both on every
  // menu, and the prototype only ever closed on selection.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (id) => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className={`relative ${className ?? ""}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-[38px] min-w-[130px] max-w-[200px] cursor-pointer items-center gap-2 rounded-[10px] border border-pd-border bg-pd-surface px-[13px] text-[13px] font-semibold text-pd-body transition-colors hover:bg-pd-divider focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary"
      >
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronDown
          className={`size-3 shrink-0 text-pd-chevron transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-[320px] max-w-[90vw] rounded-xl border border-pd-border bg-pd-surface p-1.5 shadow-pd-popover">
          <input
            type="text"
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search clients"
            className="mb-1.5 h-9 w-full rounded-lg border border-pd-border bg-pd-surface px-3 text-[13px] text-pd-body placeholder:text-pd-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary"
          />
          {filtered.length > 0 ? (
            <div role="listbox" className="grid max-h-72 grid-cols-2 gap-1 overflow-y-auto">
              {filtered.map((item) => {
                const selected = item.id === value;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => pick(item.id)}
                    title={item.name}
                    className={`truncate rounded-lg px-2.5 py-2 text-left text-[12px] transition-colors ${
                      selected
                        ? "bg-pd-primary-tint font-semibold text-pd-primary"
                        : "text-pd-body hover:bg-pd-divider"
                    }`}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="px-6 py-3 text-center text-[12px] text-pd-faint">No clients found</p>
          )}
        </div>
      )}
    </div>
  );
}
