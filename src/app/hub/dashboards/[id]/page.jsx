"use client"

import { Suspense } from "react"
import { useParams } from "next/navigation"
import DashboardWorkspace from "./DashboardWorkspace"

// ─── /dashboards/<id> ───────────────────────────────────────────────────────
// Keyed on the id so moving between dashboards starts a fresh workspace (live
// doc, editor history, mode) instead of carrying one dashboard's into the
// next. Suspense because the workspace reads ?brief with useSearchParams.

export default function DashboardPage() {
  const { id } = useParams()
  return (
    <Suspense fallback={null}>
      <DashboardWorkspace key={id} id={id} />
    </Suspense>
  )
}
