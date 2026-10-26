import { X, LayoutGrid, Grid3X3, FileBarChart, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

// One chip per drilled level: the button jumps back to that level's tab, the
// X clears the level and everything below it.
const Pill = ({ tone, icon: Icon, label, level, onClick, onClear }) => (
  <span className={cn("inline-flex items-center gap-1 rounded-sm py-0.5 pl-2 pr-1 text-xs font-medium", tone)}>
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-sm outline-none transition-opacity hover:opacity-80 focus-visible:shadow-control-focus"
    >
      <Icon className="size-3" aria-hidden="true" />
      <span className="max-w-40 truncate">{label}</span>
    </button>
    <button
      type="button"
      aria-label={`Clear ${level} filter`}
      onClick={onClear}
      className="flex size-4 items-center justify-center rounded-sm outline-none transition-opacity hover:opacity-70 focus-visible:shadow-control-focus"
    >
      <X className="size-3" aria-hidden="true" />
    </button>
  </span>
)

export function DrillDownBreadcrumb({
  selectedCampaign, selectedAdSet, selectedAd,
  onClearCampaign, onClearAdSet, onClearAd,
  onTabChange,
}) {
  if (!selectedCampaign) return null

  return (
    <div
      data-slot="drill-down-breadcrumb"
      className="flex flex-wrap items-center gap-1.5 rounded-control bg-muted px-3 py-2"
    >
      <span className="mr-1 text-xs font-medium text-muted-foreground">Filtering by:</span>

      <Pill
        tone="bg-primary-soft text-primary"
        icon={LayoutGrid}
        level="campaign"
        label={selectedCampaign.name}
        onClick={() => onTabChange("campaigns")}
        onClear={onClearCampaign}
      />

      {selectedAdSet && (
        <>
          <ChevronRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Pill
            tone="bg-info-soft text-info-ink"
            icon={Grid3X3}
            level="ad set"
            label={selectedAdSet.name}
            onClick={() => onTabChange("adsets")}
            onClear={onClearAdSet}
          />
        </>
      )}

      {selectedAd && (
        <>
          <ChevronRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Pill
            tone="bg-success-soft text-success-ink"
            icon={FileBarChart}
            level="ad"
            label={selectedAd.name}
            onClick={() => onTabChange("ads")}
            onClear={onClearAd}
          />
        </>
      )}
    </div>
  )
}
