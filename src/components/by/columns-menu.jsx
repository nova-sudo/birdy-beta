"use client";

import { useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Columns3 } from "lucide-react";
import { cn } from "./cn";
import { Button } from "./button";
import { Checkbox } from "./choice";
import { SearchField } from "./field";

/**
 * A button that opens a searchable checklist of table columns.
 *
 * @param {{id: string, label: string, group?: string}[]} props.columns every column that can be shown; `group` adds a heading
 * @param {string[]} props.value ids of the columns shown, in order
 * @param {(ids: string[]) => void} props.onChange
 * @param {React.ReactNode} [props.footer] actions under the list, e.g. Save and Reset
 */
export function ColumnsMenu({ columns, value, onChange, footer, className }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? columns.filter((c) => c.label.toLowerCase().includes(q)) : columns;
  const groups = [...new Set(shown.map((c) => c.group ?? ""))];
  const on = new Set(value);
  // Ticking adds to the end; unticking removes. The order of what is shown is kept.
  const toggle = (id, checked) => onChange(checked ? [...value, id] : value.filter((v) => v !== id));

  return (
    <PopoverPrimitive.Root onOpenChange={(open) => !open && setQuery("")}>
      <PopoverPrimitive.Trigger asChild>
        <Button className={className}><Columns3 aria-hidden="true" />Columns</Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          className="z-50 flex max-h-[min(30rem,var(--radix-popover-content-available-height))] w-72 origin-(--radix-popover-content-transform-origin) flex-col rounded-by-lg bg-by-surface p-2 font-by-body text-by-body text-by-text shadow-by-floating outline-none motion-safe:animate-[by-menu_var(--by-dur-base)_var(--by-ease-spring)]"
        >
          <SearchField placeholder="Search columns" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto" role="group" aria-label="Columns">
            {groups.map((group) => (
              <div key={group || "all"}>
                {group && <div className="px-2 pt-2.5 pb-1 text-by-caption font-semibold text-by-muted">{group}</div>}
                {shown.filter((c) => (c.group ?? "") === group).map((c) => (
                  <Checkbox
                    key={c.id}
                    label={c.label}
                    checked={on.has(c.id)}
                    onCheckedChange={(checked) => toggle(c.id, checked === true)}
                    className={cn("flex h-8 w-full rounded-by-md px-2 hover:bg-by-sunken")}
                  />
                ))}
              </div>
            ))}
            {shown.length === 0 && <p className="px-2 py-3 text-by-body-sm text-by-muted">No column matches “{query.trim()}”.</p>}
          </div>
          {footer && <div className="mt-1.5 flex items-center gap-2 border-t border-by-line pt-2">{footer}</div>}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
