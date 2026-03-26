import { X, LayoutGrid, Grid3X3, FileBarChart, ChevronRight } from "lucide-react"

const Pill = ({ color, icon: Icon, label, onClick, onClear }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
    <button onClick={onClick} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
      <Icon className="h-3 w-3" />
      <span className="max-w-[160px] truncate">{label}</span>
    </button>
    <button onClick={onClear} className="ml-0.5 hover:opacity-60 transition-opacity">
      <X className="h-3 w-3" />
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
    <div className="flex items-center flex-wrap gap-1.5 mb-3 px-1 py-2 bg-muted/40 rounded-lg border border-border/30">
      <span className="text-xs font-medium text-muted-foreground mr-1">Filtering by:</span>

      <Pill
        color="bg-purple-100 text-purple-800"
        icon={LayoutGrid}
        label={selectedCampaign.name}
        onClick={() => onTabChange("campaigns")}
        onClear={onClearCampaign}
      />

      {selectedAdSet && (
        <>
          <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <Pill
            color="bg-blue-100 text-blue-800"
            icon={Grid3X3}
            label={selectedAdSet.name}
            onClick={() => onTabChange("adsets")}
            onClear={onClearAdSet}
          />
        </>
      )}

      {selectedAd && (
        <>
          <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <Pill
            color="bg-emerald-100 text-emerald-800"
            icon={FileBarChart}
            label={selectedAd.name}
            onClick={() => onTabChange("ads")}
            onClear={onClearAd}
          />
        </>
      )}
    </div>
  )
}
