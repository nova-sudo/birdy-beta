import { Target, TrendingUp } from "lucide-react"
import { StatsCard } from "@/components/StatsCard"

export function ContactStats({ filteredContacts, loading }) {
  const opportunitiesByStatus = filteredContacts.reduce((acc, c) => {
    if (!c.opportunities || c.opportunities.length === 0) return acc
    c.opportunities.forEach((opp) => {
      const status = opp.status || "open"
      acc[status] = (acc[status] || 0) + 1
    })
    return acc
  }, {})

  const wonCount = opportunitiesByStatus.won || 0
  const lostCount = opportunitiesByStatus.lost || 0
  const openCount = opportunitiesByStatus.open || 0
  const totalOpportunities = wonCount + lostCount + openCount + (opportunitiesByStatus.abandoned || 0)
  const conversionRate = totalOpportunities > 0 ? ((wonCount / totalOpportunities) * 100).toFixed(1) : 0

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
