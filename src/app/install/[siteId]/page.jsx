"use client"

// The forwardable install page.
//
// This is the answer to the thing that makes this whole feature awkward: the
// landing pages belong to our users' clients, and frequently to a web person at
// a third company who will never have a Birdy login. Telling an agency "paste
// this into your code" is useless when they cannot reach the code.
//
// So: no auth, no app chrome, one job. An agency copies this URL, sends it on,
// and whoever receives it gets the snippet, where to put it, and — the part that
// saves a round of emails — live confirmation that it worked, without having to
// ask anyone.
//
// It deliberately shows only the client's name and the snippet. An unknown site
// id renders the same page with a gentle note rather than a 404, so the URL is
// not a way to find out which accounts exist.

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Check, CircleDashed } from "lucide-react"
import { ErrorState, Notice, Skeleton, Surface } from "@/components/ds"

import CodeSnippet from "@/components/attribution/CodeSnippet"
import { publicRequest } from "@/lib/api"
import { cn } from "@/lib/utils"

export default function InstallPage() {
  const { siteId } = useParams()
  const [details, setDetails] = useState(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await publicRequest(`/t/install/${siteId}`)
      // publicRequest does not throw on a non-OK response, unlike apiRequest.
      if (!res.ok) throw new Error(String(res.status))
      setDetails(await res.json())
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [siteId])

  useEffect(() => {
    load()
  }, [load])

  // Poll until the first hit arrives. Whoever just pasted the tag is the person
  // watching this page, and the whole point is that they see it go green
  // themselves instead of emailing to ask whether it worked.
  useEffect(() => {
    if (!details || details.hit_received) return undefined
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [details, load])

  if (failed) {
    return (
      <Shell>
        <ErrorState
          title="We couldn't load these instructions"
          description="Check the link, or ask whoever sent it to you for a fresh one."
          onRetry={load}
        />
      </Shell>
    )
  }

  if (!details) {
    return (
      <Shell>
        <div className="space-y-3" role="status" aria-label="Loading">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-control-lg w-full" />
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-primary">
          Tracking setup
        </span>
        <h1 className="text-xl font-semibold">
          {details.client_name || "Add the tracking snippet"}
        </h1>
        <p className="text-sm text-body">
          One line of code, on every page the ads point at. It measures which ad
          brought each enquiry in. Nothing is shown to visitors and it does not
          slow the page down.
        </p>
      </div>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-base font-semibold">
          1. Add this to the page
        </h2>
        <p className="text-sm text-body">
          Paste it just before the closing{" "}
          <code className="rounded-sm bg-muted px-1 font-mono text-xs">
            &lt;/head&gt;
          </code>{" "}
          tag. On most site builders there is a field for this — in GoHighLevel it
          is <span className="font-medium text-foreground">Settings → Tracking Code</span>;
          in WordPress, Webflow, Wix and Squarespace look for a custom-code or
          header-scripts setting. If the site uses Google Tag Manager, add it there
          as a Custom HTML tag firing on all pages.
        </p>
        <CodeSnippet value={details.snippet} label="Snippet" />
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-base font-semibold">
          2. Check it arrived
        </h2>
        <Notice
          tone={details.hit_received ? "success" : "neutral"}
          className="px-3.5 py-3"
        >
          <div className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                details.hit_received ? "bg-success text-primary-foreground" : "bg-background text-muted-foreground",
              )}
            >
              {details.hit_received ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <CircleDashed className="size-3.5" aria-hidden="true" />
              )}
            </span>
            <p className="text-sm">
              {details.hit_received ? (
                <>
                  <span className="font-medium">It&apos;s working.</span>{" "}
                  We&apos;ve received page views from the site — nothing else is needed
                  from you.
                </>
              ) : (
                <>
                  <span className="font-medium">Waiting for the first page view.</span>{" "}
                  Once the snippet is live, open the page in a browser and this will
                  turn green within a few seconds. You can leave this tab open.
                </>
              )}
            </p>
          </div>
        </Notice>
      </section>

      {!details.known && (
        <p className="text-xs text-muted-foreground">
          Note: we can&apos;t confirm this link against an account. The snippet above
          is still safe to install, but check with whoever sent it that the link is
          current.
        </p>
      )}

      <p className="border-t border-border pt-4 text-xs text-muted-foreground">
        Sent to you by an agency using Birdy. Nothing here collects information
        about you.
      </p>
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div className="flex min-h-svh items-start justify-center bg-muted px-4 py-10">
      <Surface className="flex w-full max-w-[480px] flex-col gap-6 p-6">{children}</Surface>
    </div>
  )
}
