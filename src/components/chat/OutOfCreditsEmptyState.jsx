"use client"

import Link from "next/link"
import { Coins } from "lucide-react"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { Button } from "@/components/ui/button"

export default function OutOfCreditsEmptyState({ className = "" }) {
  return (
    <Empty className={`h-full ${className}`}>
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="size-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20"
        >
          <Coins className="h-6 w-6" />
        </EmptyMedia>
        <EmptyTitle>You&apos;re out of Birdy Credits</EmptyTitle>
        <EmptyDescription>
          Top up to keep using Ask Birdy — or switch to your own AI key for a lower rate.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white">
          <Link href="/credits">Buy credits</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
