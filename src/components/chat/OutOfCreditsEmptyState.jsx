"use client"

import Link from "next/link"
import Birdy from "@/components/birdy/Birdy"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { Button } from "@/components/ui/button"

export default function OutOfCreditsEmptyState({ className = "" }) {
  return (
    <Empty className={`h-full ${className}`}>
      <EmptyHeader>
        <EmptyMedia>
          <Birdy size={72} state="no" />
        </EmptyMedia>
        <EmptyTitle>You&apos;re out of Birdy Credits</EmptyTitle>
        <EmptyDescription>
          Top up to keep using Ask Birdy — or switch to your own AI key for a lower rate.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/billing">Buy credits</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
