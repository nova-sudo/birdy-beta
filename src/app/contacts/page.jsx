"use client"
import { useClientGroups } from "@/lib/useClientGroups"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { LeadsContent } from "@/components/contacts/LeadsContent"

export default function ContactPage() {
  const {
    clientGroups, loading: groupsLoading,
    datePreset, setDatePreset,
  } = useClientGroups(DEFAULT_DATE_PRESET)

  return (
    <LeadsContent
      clientGroups={clientGroups}
      groupsLoading={groupsLoading}
      datePreset={datePreset}
      setDatePreset={setDatePreset}
      showGroupFilter={true}
      showHeader={true}
    />
  )
}
