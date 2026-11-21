"use client"

import { useParams } from "next/navigation"
import { LeadView } from "@/components/agency/lead/lead-view"

// ─── Lead page ──────────────────────────────────────────────────────────────
// One lead at its own address: the deep link to what a Leads table opens as a
// modal. The page draws its own header (back to the client's leads, name, stage,
// Call and Message). On a wide screen it is one screen tall and each column
// scrolls on its own; when the screen is too short, or narrow, the page scrolls.

export default function LeadPage() {
  const params = useParams()
  const contactId = decodeURIComponent(params?.contactId || "")
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-by-canvas font-by-body text-by-text">
      <LeadView key={contactId} contactId={contactId} />
    </div>
  )
}
