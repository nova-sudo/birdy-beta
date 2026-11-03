"use client"

import { use } from "react"

import { CreativeWizard } from "@/components/creatives/wizard/CreativeWizard"

export default function EditCreativeTestPage({ params }) {
  const { id } = use(params)
  return <CreativeWizard key={id} testId={id} />
}
