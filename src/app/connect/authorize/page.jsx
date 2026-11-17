"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import ConsentCard from "@/components/connect/ConsentCard"

function Inner() {
  const params = useSearchParams()
  return <ConsentCard requestId={params.get("request")} />
}

export default function AuthorizePage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  )
}
