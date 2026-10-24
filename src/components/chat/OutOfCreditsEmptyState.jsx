"use client"

import Link from "next/link"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { Button, EmptyState } from "@/components/ds"
import { cn } from "@/lib/utils"

export default function OutOfCreditsEmptyState({ className = "" }) {
  return (
    <div className={cn("flex h-full flex-col items-center justify-center", className)}>
      <BirdyAvatar size={80} state="no" />
      <EmptyState
        title="You're out of Birdy Credits"
        description="Top up to keep using Ask Birdy — or switch to your own AI key for a lower rate."
        action={
          <Button asChild variant="primary">
            <Link href="/billing">Buy credits</Link>
          </Button>
        }
      />
    </div>
  )
}
