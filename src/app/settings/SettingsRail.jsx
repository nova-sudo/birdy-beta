import { AlertCircle, CreditCard, Plug, Radar, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

// The settings sections, grouped for the rail. `key` is the ?tab= value, so
// every deep link (the sidebar credits indicator points at ?tab=billing, OAuth
// returns land on ?tab=integrations) keeps working.
export const SETTINGS_GROUPS = [
  {
    label: "Workspace",
    items: [
      {
        key: "general",
        label: "General",
        icon: SlidersHorizontal,
        description: "Your account, notifications and what Birdy's agent can do",
      },
      {
        key: "tracking",
        label: "Tracking",
        icon: Radar,
        description: "Where each client's leads come from and whether tracking is live",
      },
    ],
  },
  {
    label: "Connections",
    items: [
      {
        key: "integrations",
        label: "Integrations",
        icon: Plug,
        description: "The services Birdy reads from and posts to",
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        key: "billing",
        label: "Billing",
        icon: CreditCard,
        description: "Your AI credits and your plan",
      },
    ],
  },
]

export const SETTINGS_TABS = SETTINGS_GROUPS.flatMap((group) => group.items)

/**
 * Left rail of grouped section items. Below md it becomes a horizontal
 * scroller above the content.
 *
 * @param {string} value Active section key.
 * @param {(key: string) => void} onChange
 * @param {Record<string, string>} [chips] Section key -> short text for a danger chip, shown only where something needs attention
 */
export function SettingsRail({ value, onChange, chips = {} }) {
  const keys = SETTINGS_TABS.map((tab) => tab.key)

  // Arrow keys move between sections, as a tab strip does.
  const onKeyDown = (event) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const next = keys[(keys.indexOf(value) + step + keys.length) % keys.length]
    onChange(next)
    document.getElementById(`settings-tab-${next}`)?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="Settings section"
      aria-orientation="vertical"
      data-slot="settings-rail"
      onKeyDown={onKeyDown}
      className="flex max-w-full gap-1 overflow-x-auto rounded-frame bg-muted p-2 md:w-62 md:shrink-0 md:flex-col md:overflow-visible md:px-2.5 md:py-3"
    >
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.label} role="presentation" className="flex gap-1 md:flex-col">
          <p role="presentation" className="hidden h-[30px] items-end px-2.5 text-xs text-muted-foreground md:flex">
            {group.label}
          </p>
          {group.items.map(({ key, label, icon: Icon }) => {
            const active = key === value
            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={`settings-tab-${key}`}
                aria-selected={active}
                aria-controls="settings-panel"
                tabIndex={active ? 0 : -1}
                onClick={() => onChange(key)}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2.5 rounded-control pr-1.5 pl-2.5 text-sm whitespace-nowrap outline-none transition-colors focus-visible:shadow-control-focus",
                  active
                    ? "bg-background font-semibold text-foreground shadow-control"
                    : "font-medium text-foreground/80 hover:bg-background/60"
                )}
              >
                <Icon aria-hidden className={cn("size-[18px] shrink-0", active ? "text-foreground" : "text-muted-foreground")} />
                {label}
                {chips[key] && (
                  <span className="ml-auto inline-flex h-6 items-center gap-1 rounded-sm bg-danger-soft px-1.5 text-xs font-medium text-danger-ink">
                    <AlertCircle aria-hidden className="size-4" />
                    {chips[key]}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
