"use client"

import Link from "next/link"
import { Bird } from "lucide-react"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { Button } from "@/components/ui/button"

export default function AiCredentialsEmptyState({ className = "" }) {
  return (
    <Empty className={`h-full ${className}`}>
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="size-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/20"
        >
          <Bird className="h-6 w-6" />
        </EmptyMedia>
        <EmptyTitle>Add your own AI agent to use Birdy AI</EmptyTitle>
        <EmptyDescription>
          Connect an Anthropic or OpenAI API key in Settings to start chatting with Birdy AI.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white">
          <Link href="/settings?tab=integrations">Go to Settings → Integrations</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
