"use client"

import Link from "next/link"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { Button } from "@/components/ui/button"

export default function AiCredentialsEmptyState({ className = "" }) {
  return (
    <Empty className={`h-full ${className}`}>
      <EmptyHeader>
        <EmptyMedia>
          <BirdyAvatar size={80} state="peek" />
        </EmptyMedia>
        <EmptyTitle>Add your own AI agent to use Birdy AI</EmptyTitle>
        <EmptyDescription>
          Connect an Anthropic or OpenAI API key in Settings to start chatting with Birdy AI.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/settings?tab=integrations">Go to Settings → Integrations</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
