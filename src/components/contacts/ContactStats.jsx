import { Target, TrendingUp } from "lucide-react"
import { StatsCard } from "@/components/StatsCard"

export function ContactStats({ metaStats, loading }) {
  const totalOpportunities = metaStats?.total_opportunities || 0
  const wonCount = metaStats?.won || 0
  const lostCount = metaStats?.lost || 0
  const openCount = metaStats?.open || 0
  const conversionRate = metaStats?.conversion_rate || 0

  const stats = [
    { title: "Total Leads", value: totalOpportunities, icon: Target, subtitle: "Across all Leads" },
    { title: "Lost Leads", value: lostCount, icon: Target, subtitle: "Across all Leads" },
    { title: "Open Leads", value: openCount, icon: Target, subtitle: "Across all Leads" },
    { title: "Conversion Rate", value: `${conversionRate}%`, icon: TrendingUp, subtitle: "Across all Leads" },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <StatsCard key={index} {...stat} loading={loading} />
      ))}
    </div>
  )
}
