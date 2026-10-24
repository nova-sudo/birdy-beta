"use client"

import Link from "next/link"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { Button, EmptyState } from "@/components/ds"
import { cn } from "@/lib/utils"

export default function AiCredentialsEmptyState({ className = "" }) {
  return (
    <div className={cn("flex h-full flex-col items-center justify-center", className)}>
      <BirdyAvatar size={80} state="peek" />
      <EmptyState
        title="Add your own AI agent to use Birdy AI"
        description="Connect an Anthropic or OpenAI API key in Settings to start chatting with Birdy AI."
        action={
          <Button asChild variant="primary">
            <Link href="/settings?tab=integrations">Go to Settings → Integrations</Link>
          </Button>
        }
      />
    </div>
  )
}
