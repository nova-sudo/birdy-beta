"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { registry } from "@/lib/dashkit/registry"
import { PdIcon } from "@/lib/dashkit/primitives"

// The editor palette's order; anything else follows, as the palette does.
const CATEGORY_ORDER = ["metrics", "charts", "tables", "content"]
const rank = (category) => {
  const i = CATEGORY_ORDER.indexOf(category)
  return i === -1 ? CATEGORY_ORDER.length : i
}
const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * View mode's "Add widget": the editor palette's icon grid in a dialog, so a
 * widget can be added without first knowing the editor is where that lives.
 * `onPick(type)` does the adding; the dialog closes itself on a pick.
 */
export function WidgetPicker({ open, onOpenChange, onPick }) {
  const groups = Object.entries(registry.listByCategory()).sort(([a], [b]) => rank(a) - rank(b))

  const pick = (type) => {
    onOpenChange(false)
    onPick(type)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Add a widget</DialogTitle>
          <DialogDescription>It goes at the end of the dashboard, ready to set up in the editor.</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-5 overflow-y-auto">
          {groups.map(([category, defs]) => (
            <div key={category}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-pd-faint">
                {titleCase(category)}
              </h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {defs.map((def) => (
                  <button
                    key={def.type}
                    type="button"
                    aria-label={`Add ${def.label}`}
                    title={def.description || undefined}
                    onClick={() => pick(def.type)}
                    className="flex h-[72px] min-w-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-pd-border bg-pd-surface px-1.5 text-center transition-colors hover:bg-pd-divider focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary"
                  >
                    <PdIcon name={def.icon} className="size-[18px] text-pd-muted" />
                    <span className="max-w-full truncate text-[12px] font-medium text-pd-ink">{def.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
