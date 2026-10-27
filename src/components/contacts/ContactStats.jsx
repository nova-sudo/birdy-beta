import { Target, TrendingUp, UserPlus, Users } from "lucide-react"
import { StatsCard } from "@/components/StatsCard"

/**
 * Stats cards for the Leads page.
 *
 * Two rows:
 *   1. Lead vs Contact counts (top). A contact is a "Lead" iff its first-
 *      touch attribution is Facebook paid social — see
 *      services/contact_classifier.py on the backend.
 *   2. Opportunity stats (bottom), now scoped to lead-classified contacts
 *      only. Same numbers and labels as before, but the underlying query
 *      drops opportunities whose parent contact is a plain "contact".
 */
export function ContactStats({ metaStats, loading }) {
  const leadCount = metaStats?.lead_count || 0
  const contactCount = metaStats?.contact_count || 0

  const totalOpportunities = metaStats?.total_opportunities || 0
  const lostCount = metaStats?.lost || 0
  const openCount = metaStats?.open || 0
  const conversionRate = metaStats?.conversion_rate || 0

  // ── Row 1 — contact classification counts ────────────────────────────────
  const countStats = [
    {
      title: "Total Leads",
      value: leadCount,
      icon: UserPlus,
      subtitle: "From Facebook paid social",
    },
    {
      title: "Total Contacts",
      value: contactCount,
      icon: Users,
      subtitle: "All other sources",
    },
  ]

  // ── Row 2 — opportunity stats (lead-classified contacts only) ────────────
  const opportunityStats = [
    {
      title: "Total Opportunities",
      value: totalOpportunities,
      icon: Target,
      subtitle: "Across lead-classified contacts",
    },
    {
      title: "Lost Leads",
      value: lostCount,
      icon: Target,
      subtitle: "Across lead-classified contacts",
    },
    {
      title: "Open Leads",
      value: openCount,
      icon: Target,
      subtitle: "Across lead-classified contacts",
    },
    {
      title: "Conversion Rate",
      value: `${conversionRate}%`,
      icon: TrendingUp,
      subtitle: "Across lead-classified contacts",
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {[...countStats, ...opportunityStats].map((stat, index) => (
        <StatsCard key={index} {...stat} loading={loading} />
      ))}
    </div>
  )
}
