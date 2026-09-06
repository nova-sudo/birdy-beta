import { StatTile } from "@/components/portfolio";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { UnavailableValue } from "@/components/callcenter/CallCentreUnavailable";

// The six figures for the window, two across, beneath the insight card.
//
// A 1fr 1fr grid is what makes the right column finish level with the chart
// beside it — six tiles in one column would run well past it, and six across
// the full width would push the chart off the fold.
//
// Deltas are opt-in via the `deltas` prop. Sales-Hub doesn't pass one — every
// figure there is the sum of what the API returned for the one window that
// was asked for, and assembling a comparison window was real complexity for
// what it added. The Lead Hub's totals are summed client-side from a
// retained daily series (leadhub-totals.js), so a previous window is just a
// second filter over data already on the page — cheap enough to pass here.

const GRID = "grid grid-cols-2 gap-2.5";

/**
 * @param {{key, label, icon, tone, polarity}[]} tiles from presentation.js
 * @param {Record<string, number>} totals the window's figures, by tile key
 * @param {(key: string, value: number) => string} format
 * @param {Record<string, {direction: "up"|"down", delta: string}>} [deltas] per tile key, omit for no pills
 * @param {boolean} [unavailable] the client in view has no call centre, so
 *   every figure here would be a sum over a cache that does not exist. The
 *   tiles stay — the reader still needs to know which six figures Birdy would
 *   be showing them — but each number becomes the placeholder. Blanking the
 *   grid instead would answer a question nobody asked ("what would I get?")
 *   with silence.
 */
export function KpiTiles({ tiles, totals, loading, format, deltas, unavailable, className }) {
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
          // The icon chip dims with the figure. A metric's tone is what says
          // "this is the calls one, this is the talk-time one"; keeping it lit
          // beside a grey dash makes the tile read as a live figure that has
          // gone momentarily missing, which is the opposite of the truth.
          tone={unavailable ? "neutral" : tile.tone}
          label={tile.label}
          value={
            unavailable ? (
              <UnavailableValue />
            ) : (
              format(tile.key, totals[tile.key] ?? 0)
            )
          }
          // A comparison against a period that was also unmeasured is not a
          // comparison; the pills go with the numbers.
          direction={unavailable ? undefined : deltas?.[tile.key]?.direction}
          delta={deltas?.[tile.key]?.delta}
          polarity={tile.polarity}
        />
      ))}
    </div>
  );
}
