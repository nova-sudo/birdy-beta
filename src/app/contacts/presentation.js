import { Target, TrendingDown, TrendingUp, UserCheck, Users, XCircle } from "lucide-react";

import { HIGHER_IS_BETTER, LOWER_IS_BETTER } from "@/lib/portfolio-metrics";

// Which icon, colour family and polarity each Lead Hub KPI tile wears — the
// Lead Hub sibling of Sales-Hub/presentation.js. Kept apart from the data so
// the totals hook stays about numbers and this stays about how they read.
//
// Unlike Sales-Hub's tiles (all volumes, all "more is better"), two of these
// invert: *lost leads* rising is bad news, and *conversion rate* falling is
// bad news even though it isn't a volume at all. Polarity travels with the
// tile definition so leadhub-totals.js's delta builder and KpiTiles' StatTile
// pills agree on which direction is good without either having to know why.

/** The six tiles, in the design's order: left column top-to-bottom, then right. */
export const KPI_PRESENTATION = [
  { key: "lead_count", label: "Total leads", icon: UserCheck, tone: "primary", polarity: HIGHER_IS_BETTER },
  { key: "contact_count", label: "Total contacts", icon: Users, tone: "info", polarity: HIGHER_IS_BETTER },
  { key: "total_opportunities", label: "Opportunities", icon: Target, tone: "success", polarity: HIGHER_IS_BETTER },
  { key: "open", label: "Open leads", icon: TrendingUp, tone: "primary", polarity: HIGHER_IS_BETTER },
  { key: "lost", label: "Lost leads", icon: XCircle, tone: "danger", polarity: LOWER_IS_BETTER },
  { key: "conversion_rate", label: "Conversion rate", icon: TrendingDown, tone: "amber", polarity: HIGHER_IS_BETTER },
];
