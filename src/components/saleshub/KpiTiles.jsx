import { StatTile } from "@/components/portfolio";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// The six call figures for the window, two across, beneath the insight card.
//
// A 1fr 1fr grid is what makes the right column finish level with the chart
// beside it — six tiles in one column would run well past it, and six across
// the full width would push the chart off the fold.

/**
 * @param {{key, label, icon, tone}[]} tiles from presentation.js
 * @param {Record<string, number>} totals the window's figures, by tile key
 * @param {Record<string, {direction, delta}>} [deltas] omitted where no
 *   comparable previous period exists — each tile then renders without a pill
 */
export function KpiTiles({ tiles, totals, deltas, loading, format, className }) {
  if (loading) {
    return (
      <div className={cn("grid grid-cols-2 gap-2.5", className)}>
        {tiles.map((tile) => (
          <Skeleton key={tile.key} className="h-[52px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 gap-2.5", className)}>
      {tiles.map((tile) => (
        <StatTile
          key={tile.key}
          layout="tile"
          icon={tile.icon}
          tone={tile.tone}
          label={tile.label}
          value={format(tile.key, totals[tile.key] ?? 0)}
          direction={deltas?.[tile.key]?.direction}
          delta={deltas?.[tile.key]?.delta}
        />
      ))}
    </div>
  );
}
