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

import CodeSnippet from "@/components/attribution/CodeSnippet"
import { publicRequest } from "@/lib/api"
import { pdFontClass } from "@/lib/pd-fonts"
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
        <p className="text-[13px] text-pd-body">
          We couldn&apos;t load these instructions. Check the link, or ask whoever
          sent it to you for a fresh one.
        </p>
      </Shell>
    )
  }

  if (!details) {
    return (
      <Shell>
        <p className="text-[13px] text-pd-faint">Loading…</p>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="flex flex-col gap-1">
        <span className="text-[11.5px] font-medium uppercase tracking-wide text-pd-primary">
          Tracking setup
        </span>
        <h1 className="font-pd-display text-[22px] font-semibold text-pd-ink">
          {details.client_name || "Add the tracking snippet"}
        </h1>
        <p className="text-[13px] leading-[1.55] text-pd-body">
          One line of code, on every page the ads point at. It measures which ad
          brought each enquiry in. Nothing is shown to visitors and it does not
          slow the page down.
        </p>
      </div>

      <section className="flex flex-col gap-2.5">
        <h2 className="font-pd-display text-[14px] font-semibold text-pd-ink">
          1. Add this to the page
        </h2>
        <p className="text-[12.5px] leading-[1.5] text-pd-body">
          Paste it just before the closing{" "}
          <code className="rounded bg-pd-divider px-1 font-mono text-[11px]">
            &lt;/head&gt;
          </code>{" "}
          tag. On most site builders there is a field for this — in GoHighLevel it
          is <span className="font-medium text-pd-ink">Settings → Tracking Code</span>;
          in WordPress, Webflow, Wix and Squarespace look for a custom-code or
          header-scripts setting. If the site uses Google Tag Manager, add it there
          as a Custom HTML tag firing on all pages.
        </p>
        <CodeSnippet value={details.snippet} label="Snippet" />
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="font-pd-display text-[14px] font-semibold text-pd-ink">
          2. Check it arrived
        </h2>
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-[12px] border px-3.5 py-3",
            details.hit_received
              ? "border-pd-healthy-border bg-pd-healthy-surface"
              : "border-pd-border bg-pd-canvas",
          )}
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full",
              details.hit_received
                ? "bg-pd-success-bg text-pd-success"
                : "bg-pd-divider text-pd-faint",
            )}
          >
            {details.hit_received ? (
              <Check className="size-[13px]" aria-hidden="true" />
            ) : (
              <CircleDashed className="size-[13px]" aria-hidden="true" />
            )}
          </span>
          <p className="text-[12.5px] leading-[1.5] text-pd-body">
            {details.hit_received ? (
              <>
                <span className="font-medium text-pd-ink">It&apos;s working.</span>{" "}
                We&apos;ve received page views from the site — nothing else is needed
                from you.
              </>
            ) : (
              <>
                <span className="font-medium text-pd-ink">Waiting for the first page view.</span>{" "}
                Once the snippet is live, open the page in a browser and this will
                turn green within a few seconds. You can leave this tab open.
              </>
            )}
          </p>
        </div>
      </section>

      {!details.known && (
        <p className="text-[12px] leading-[1.5] text-pd-faint">
          Note: we can&apos;t confirm this link against an account. The snippet above
          is still safe to install, but check with whoever sent it that the link is
          current.
        </p>
      )}

      <p className="border-t border-pd-border pt-4 text-[11.5px] text-pd-faint">
        Sent to you by an agency using Birdy. Nothing here collects information
        about you.
      </p>
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div className={cn(pdFontClass, "min-h-screen bg-pd-canvas")}>
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 py-10">
        {children}
      </div>
    </div>
  )
}
