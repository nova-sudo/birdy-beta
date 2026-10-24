import { MetricGroup, Skeleton } from "@/components/ds"

/**
 * Stats cards for the Leads page.
 *
 * Two kinds of figure, in one group:
 *   1. Lead vs Contact counts. A contact is a "Lead" iff its first-touch
 *      attribution is Facebook paid social — see services/contact_classifier.py
 *      on the backend.
 *   2. Opportunity stats, scoped to lead-classified contacts only (the
 *      underlying query drops opportunities whose parent contact is a plain
 *      "contact").
 */
export function ContactStats({ metaStats, loading }) {
  const count = (n) => (loading ? <Skeleton className="h-7 w-16 rounded-sm" /> : (n || 0).toLocaleString())
  const opportunityCaption = "Across lead-classified contacts"

  return (
    <MetricGroup
      title="Leads and contacts"
      items={[
        { key: "leads", label: "Total Leads", value: count(metaStats?.lead_count), caption: "From Facebook paid social" },
        { key: "contacts", label: "Total Contacts", value: count(metaStats?.contact_count), caption: "All other sources" },
        { key: "opportunities", label: "Total Opportunities", value: count(metaStats?.total_opportunities), caption: opportunityCaption },
        { key: "lost", label: "Lost Leads", value: count(metaStats?.lost), caption: opportunityCaption },
        { key: "open", label: "Open Leads", value: count(metaStats?.open), caption: opportunityCaption },
        {
          key: "conversion",
          label: "Conversion Rate",
          value: loading ? <Skeleton className="h-7 w-16 rounded-sm" /> : `${metaStats?.conversion_rate || 0}%`,
          caption: opportunityCaption,
        },
      ]}
    />
  )
}
