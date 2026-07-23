"use client"

import { useClientGroups } from "@/lib/useClientGroups"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { CallCentreContent } from "@/components/callcenter/CallCentreContent"

export default function CallCenterPage() {
  const { clientGroups, loading: groupsLoading, datePreset, setDatePreset } = useClientGroups(DEFAULT_DATE_PRESET)

  return (
    <CallCentreContent
      clientGroups={clientGroups}
      groupsLoading={groupsLoading}
      datePreset={datePreset}
      setDatePreset={setDatePreset}
      showGroupFilter={true}
      showHeader={true}
    />
  )
}
