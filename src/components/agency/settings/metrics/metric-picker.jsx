"use client";

// The formula dialog's metric list: type to find, arrow keys to move, Enter
// to add, Escape to close.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SearchField, cn } from "@/components/by";
import { sourceForCategory } from "@/lib/metric-sources";
import { SOURCE_NAME } from "@/lib/metrics-catalog";
import { SourceMark } from "./source-mark";

/**
 * @param {{id: string, label: string, category: string}[]} props.metrics what can go in a formula
 * @param {(id: string) => void} props.onPick
 * @param {() => void} props.onClose
 */
export function MetricPicker({ metrics, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(0);
  const listId = useId();
  const list = useRef(null);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hits = useMemo(
    () => metrics.filter((m) => {
      const hay = `${m.label} ${m.category} ${SOURCE_NAME[sourceForCategory(m.category)]}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    }),
    [metrics, query], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const i = Math.min(at, Math.max(0, hits.length - 1));

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [i]);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (hits.length) setAt((i + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (hits[i]) onPick(hits[i].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div className="rounded-by-lg border border-by-line bg-by-surface p-2 shadow-by-floating">
      <SearchField
        autoFocus
        placeholder={`Search ${metrics.length} metrics`}
        aria-label="Search metrics"
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={hits[i] ? `${listId}-${i}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setAt(0);
        }}
        onKeyDown={onKeyDown}
      />
      {hits.length === 0 ? (
        <p className="px-2 pt-2.5 pb-1 text-by-body-sm text-by-muted">No metric matches “{query.trim()}”. Try another name.</p>
      ) : (
        <div ref={list} id={listId} role="listbox" aria-label="Metrics" className="mt-1.5 max-h-56 overflow-y-auto overscroll-contain">
          {hits.map((m, n) => {
            const source = sourceForCategory(m.category);
            return (
              <button
                key={m.id}
                id={`${listId}-${n}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={n === i}
                onMouseMove={() => n !== at && setAt(n)}
                onClick={() => onPick(m.id)}
                className={cn("flex h-8 w-full cursor-pointer items-center gap-2 rounded-by-md px-2 text-left text-by-body-sm", n === i ? "bg-by-sunken" : "hover:bg-by-sunken")}
              >
                <SourceMark source={source} />
                <span className="min-w-0 flex-1 truncate font-medium">{m.label}</span>
                <span className="shrink-0 text-by-caption text-by-muted">{SOURCE_NAME[source]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
