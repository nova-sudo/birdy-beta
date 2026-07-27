"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Target, Sparkles } from "lucide-react"

// ── Changelog entries (newest first) ──────────────────────────────────────────
// To add a release, prepend an entry. `icon` is any lucide icon component.
const CHANGELOG = [
  {
    date: "2026-07-27",
    version: "Alpha 1.0",
    title: "Media Buying Analyst — a new Birdy capability",
    icon: Target,
    tags: ["New", "Ask Birdy", "Capabilities"],
    highlights: [
      "Turn on a senior media-buyer brain for Birdy chat from Settings → Capabilities.",
      "Birdy diagnoses CPL, CTR, CPM and ROAS across campaigns, ad sets and ads, and tells you what to scale, kill, and fix — weighted by spend and anchored to your targets.",
      "Judges lead QUALITY end to end: Meta leads → GoHighLevel opportunities & revenue → HotProspector connect rate, so cheap-but-dead “zombie” leads get caught instead of celebrated.",
      "New call-center insight lets Birdy see connect rate and call coverage per client — a low connect rate flags unreachable, low-intent leads.",
      "Off by default; enable it per account. Applies to the Campaigns, Dashboard, client, and Ask Birdy chats (not the Alerts or Metrics assistants).",
    ],
  },
]

function formatDate(iso) {
  // Stable, locale-independent formatting so the page reads the same everywhere.
  const [y, m, d] = iso.split("-").map(Number)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${months[m - 1]} ${d}, ${y}`
}

export default function ChangelogPage() {
  return (
    <div className="min-h-dvh w-[calc(100dvw-70px)] md:w-[calc(100dvw-130px)] mx-auto max-w-4xl">
      <div className="flex flex-col gap-2 py-2 mb-8">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-purple-600" />
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground">What&apos;s New</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Updates and new features in Birdy AI. Newest first.
        </p>
      </div>

      <div className="relative space-y-6">
        {CHANGELOG.map((entry, i) => {
          const Icon = entry.icon || Sparkles
          return (
            <Card key={`${entry.date}-${i}`} className="border-border/50 overflow-hidden">
              <CardContent className="p-5 md:p-6">
                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                      <h2 className="text-lg font-semibold text-foreground">{entry.title}</h2>
                      {entry.version && (
                        <Badge variant="secondary" className="text-xs">{entry.version}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{formatDate(entry.date)}</p>

                    {entry.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {entry.tags.map((t) => (
                          <Badge key={t} variant="outline" className="text-[11px] font-normal">{t}</Badge>
                        ))}
                      </div>
                    )}

                    <ul className="space-y-2">
                      {entry.highlights.map((h, hi) => (
                        <li key={hi} className="flex gap-2 text-sm text-muted-foreground">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
