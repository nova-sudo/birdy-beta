"use client"
import { useClientGroups } from "@/lib/useClientGroups"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { MarketingContent } from "@/components/campaigns/MarketingContent"

export default function CampaignsPage() {
  const {
    clientGroups, loading: groupsLoading, error: groupsError,
    datePreset, setDatePreset, invalidate,
  } = useClientGroups(DEFAULT_DATE_PRESET)

  return (
    <MarketingContent
      clientGroups={clientGroups}
      groupsLoading={groupsLoading}
      groupsError={groupsError}
      datePreset={datePreset}
      setDatePreset={setDatePreset}
      showGroupFilter={true}
      showHeader={true}
      onCacheInvalidate={invalidate}
    />
  )
}
