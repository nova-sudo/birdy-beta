"use client"

import { useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { usePageHeader } from "@/components/page-header"
import { SalesHubHeaderTitle, SalesHubShell } from "@/components/hub/HubShell"
import { Button } from "@/components/ds"
import { DashboardList } from "@/components/dashboards/DashboardList"

// ─── My dashboards ──────────────────────────────────────────────────────────
// The user's saved, AI-assisted dashboards (the full list; BirdyHub shows the
// same list under its Dashboards section). Opening one goes to
// /hub/dashboards/<id>.

export default function DashboardsPage() {
  const [creating, setCreating] = useState(false)

  // Memoised because publishing sets state on the provider above: a fresh
  // object every render would republish every render. See usePageHeader.
  const header = useMemo(
    () => ({
      title: (
        <SalesHubHeaderTitle title="My dashboards" subtitle="Dashboards you and Birdy have built" />
      ),
      controls: (
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" />
          New dashboard
        </Button>
      ),
    }),
    [],
  )
  usePageHeader(header)

  return (
    <SalesHubShell>
      <DashboardList creating={creating} onCreatingChange={setCreating} />
    </SalesHubShell>
  )
}
