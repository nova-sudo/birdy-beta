"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, Columns3, Plus } from "lucide-react";
import { cn } from "./cn";
import { Button } from "./button";
import { Checkbox } from "./choice";
import { FOCUS_RING } from "./motion";

const sameSet = (a, b) => a.length === b.length && a.every((id) => b.includes(id));
const ROW = "flex h-8 w-full cursor-pointer items-center gap-2 rounded-by-md px-2 text-left transition-colors duration-(--by-dur-fast) ease-by-out hover:bg-by-sunken";

/**
 * The Views button and its panel: saved views first (one click to a set of
 * columns), then the columns in the view, by group. Named "Views" rather than
 * "Columns" so people find the saved views at all.
 *
 * @param {{id: string, label: string, group?: string, icon?: React.ReactNode}[]} props.columns every column that can be shown, in the order they appear in the table; `group` adds a heading, `icon` sits before the label
 * @param {string[]} props.value ids of the columns shown
 * @param {(ids: string[]) => void} props.onChange
 * @param {{name: string, ids: string[]}[]} [props.views] saved views; the one matching `value` is marked
 * @param {() => void} [props.onSaveView] adds a "Save as new view" action
 * @param {() => void} [props.onUpdateView] adds an "Update view" action, for writing the shown columns over the current view
 * @param {(open: boolean) => void} [props.onOpenChange] lets the page make room beside the panel
 */
export function ColumnsMenu({ columns, value, onChange, views = [], onSaveView, onUpdateView, onOpenChange, className }) {
  const on = new Set(value);
  const groups = [...new Set(columns.map((c) => c.group ?? ""))];
  const current = views.find((v) => sameSet(v.ids, value))?.name ?? (views.length ? "Custom" : null);
  // Columns keep the table's order however they are ticked: adding one puts it
  // where it belongs, not at the end.
  const order = (ids) => [...columns.filter((c) => ids.has(c.id)).map((c) => c.id), ...value.filter((id) => ids.has(id) && !columns.some((c) => c.id === id))];
  const toggle = (id, checked) => {
    const next = new Set(on);
    if (checked) next.add(id);
    else next.delete(id);
    onChange(order(next));
  };

  return (
    <PopoverPrimitive.Root onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <Button className={cn("data-[state=open]:border-by-accent data-[state=open]:text-by-accent", className)}>
          <Columns3 aria-hidden="true" />
          <span>
            Views
            {/* The button names the view on screen, unless it is the default one. */}
            {current && current !== views[0]?.name && <span className="font-medium text-by-muted"> · {current}</span>}
          </span>
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          aria-label="Views and columns"
          className="z-50 max-h-(--radix-popover-content-available-height) w-56 origin-(--radix-popover-content-transform-origin) overflow-y-auto overscroll-contain rounded-by-lg bg-by-surface px-2 pt-1.5 pb-2.5 font-by-body text-by-body text-by-text shadow-by-floating outline-none motion-safe:animate-[by-menu_var(--by-dur-base)_var(--by-ease-spring)]"
        >
          {(views.length > 0 || onSaveView || onUpdateView) && (
            <div role="group" aria-label="Views">
              <div className="px-2 pt-1.5 pb-1 text-by-caption font-semibold text-by-muted">Views</div>
              {views.map((view) => {
                const active = view.name === current;
                return (
                  <button key={view.name} type="button" aria-pressed={active} onClick={() => onChange(view.ids)} className={cn(ROW, "justify-between", active && "font-semibold text-by-accent", FOCUS_RING)}>
                    {view.name}
                    {active && <Check aria-hidden="true" className="size-3.5" />}
                  </button>
                );
              })}
              {onUpdateView && (
                <button type="button" onClick={onUpdateView} className={cn(ROW, "font-semibold text-by-accent", FOCUS_RING)}>
                  <Check aria-hidden="true" className="size-3.5" />
                  Update view
                </button>
              )}
              {onSaveView && (
                <button type="button" onClick={onSaveView} className={cn(ROW, "font-semibold text-by-accent", FOCUS_RING)}>
                  <Plus aria-hidden="true" className="size-3.5" />
                  Save as new view
                </button>
              )}
            </div>
          )}
          <div className={cn("px-2 pt-1.5 pb-1 text-by-caption font-semibold text-by-muted", (views.length > 0 || onSaveView || onUpdateView) && "mt-1.5 border-t border-by-line pt-3")}>
            Columns in this view
          </div>
          {groups.map((group, i) => (
            <div key={group || "all"} role="group" aria-label={group || "Columns"} className={cn(i > 0 && "mt-1.5 border-t border-by-line pt-1.5")}>
              {group && <div className="px-2 pt-1.5 pb-1 text-by-caption font-semibold text-by-muted">{group}</div>}
              {columns.filter((c) => (c.group ?? "") === group).map((c) => (
                <Checkbox
                  key={c.id}
                  aria-label={c.label}
                  // One line per column: a long name shortens with an ellipsis and shows in full on hover.
                  label={
                    <span className="flex min-w-0 items-center gap-1.5 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-by-muted" title={c.label}>
                      {c.icon}
                      <span className="truncate">{c.label}</span>
                    </span>
                  }
                  checked={on.has(c.id)}
                  onCheckedChange={(checked) => toggle(c.id, checked === true)}
                  className={ROW}
                />
              ))}
            </div>
          ))}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
