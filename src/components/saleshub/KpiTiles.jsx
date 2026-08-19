import { StatTile } from "@/components/portfolio";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// The six call figures for the window.
//
// The design stacks these two-across in a narrow column beside the trend chart.
// There is no chart here, so they run along the full width instead — six across
// once there is room, folding to three and then two. Stacking them 2×3 in half
// the width would have left the row taller than the card beside it.
//
// No delta pills: comparing against another window means assembling one, and
// every figure on this screen is the sum of what the API returned for the one
// window that was asked for.

const GRID = "grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6";

/**
 * @param {{key, label, icon, tone}[]} tiles from presentation.js
 * @param {Record<string, number>} totals the window's figures, by tile key
 * @param {(key: string, value: number) => string} format
 */
export function KpiTiles({ tiles, totals, loading, format, className }) {
  if (loading) {
    return (
      <div className={cn(GRID, className)}>
        {tiles.map((tile) => (
          <Skeleton key={tile.key} className="h-[52px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(GRID, className)}>
      {tiles.map((tile) => (
        <StatTile
          key={tile.key}
          layout="tile"
          icon={tile.icon}
          tone={tile.tone}
          label={tile.label}
          value={format(tile.key, totals[tile.key] ?? 0)}
        />
      ))}
    </div>
  );
}
