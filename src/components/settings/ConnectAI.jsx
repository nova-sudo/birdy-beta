"use client"

// components/settings/ConnectAI.jsx
// The Settings "Connect to AI" tab: Birdy's MCP link, setup steps per AI app,
// the owner's connections (with revoke), developer tokens, and the daily
// check-in prompt. Steps live in connect-ai-steps.js.

import { Fragment, useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { apiRequest, API_BASE_URL } from "@/lib/api"
import { pdFontClass } from "@/lib/pd-fonts"
import AppLogo from "@/components/connect/AppLogo"
import { CONNECT_APPS, CHECK_IN_PROMPT } from "./connect-ai-steps"

const ACCESS_LABEL = { read: "View my data", write: "View and make changes" }
const ACCESS_CHIP = {
  read: "bg-pd-canvas text-pd-muted",
  write: "bg-pd-primary-tint text-pd-primary",
}

function formatDate(iso) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function formatRelative(iso) {
  if (!iso) return "Never"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Never"
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  if (days === 1) return "Yesterday"
  return formatDate(iso)
}

// "**bold**" and "{url}" in step text.
function renderStep(text, url) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") ? (
      <b key={i} className="font-semibold text-pd-ink">{part.slice(2, -2).replace("{url}", url)}</b>
    ) : (
      <Fragment key={i}>{part.replace("{url}", url)}</Fragment>
    ),
  )
}

async function copy(text, message = "Copied") {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(message)
  } catch {
    toast.error("Couldn't copy. Select the text and copy it by hand.")
  }
}

export function ConnectAI() {
  const mcpUrl = `${API_BASE_URL}/mcp`
  const [appKey, setAppKey] = useState(CONNECT_APPS[0].key)
  const app = CONNECT_APPS.find((a) => a.key === appKey)

  const [connections, setConnections] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [revoking, setRevoking] = useState(null)
  const [busyRevoke, setBusyRevoke] = useState(false)

  const [tokenOpen, setTokenOpen] = useState(false)
  const [tokenName, setTokenName] = useState("")
  const [tokenAccess, setTokenAccess] = useState("read")
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("/api/mcp/connections")
      if (!res.ok) throw new Error("load failed")
      setConnections(await res.json())
      setLoadError(false)
    } catch {
      setLoadError(true)
      setConnections((c) => c ?? [])
    }
  }, [])

  useEffect(() => { load() }, [load])

  const confirmRevoke = async () => {
    if (!revoking) return
    setBusyRevoke(true)
    try {
      const res = await apiRequest(`/api/mcp/connections/${revoking.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("revoke failed")
      toast.success(`${revoking.name} disconnected`)
      setRevoking(null)
      await load()
    } catch {
      toast.error("Couldn't disconnect. Try again.")
    } finally {
      setBusyRevoke(false)
    }
  }

  const createToken = async (e) => {
    e.preventDefault()
    if (!tokenName.trim()) return
    setCreating(true)
    try {
      const res = await apiRequest("/api/mcp/tokens", {
        method: "POST",
        body: JSON.stringify({ name: tokenName.trim(), access: tokenAccess }),
      })
      if (!res.ok) throw new Error("create failed")
      setNewToken(await res.json())
      setTokenOpen(false)
      setTokenName("")
      setTokenAccess("read")
      load()
    } catch {
      toast.error("Couldn't create the token. Try again.")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={`${pdFontClass} space-y-4`}>
      <Card className="gap-0 py-0">
        <CardContent className="space-y-4 p-5">
          <div>
            <h3 className="font-pd-display text-[15px] font-semibold text-pd-ink">Add Birdy to your AI assistant</h3>
            <p className="mt-1 text-[12.5px] text-pd-subtle">
              Ask about your clients, get alerts explained, and run your media buying agent from Claude, ChatGPT or Cursor.
            </p>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-[10px] border border-pd-border-strong bg-pd-table-head py-1.5 pl-3 pr-1.5">
            <code className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium text-pd-ink">{mcpUrl}</code>
            <Button size="md" onClick={() => copy(mcpUrl, "Link copied")}>Copy link</Button>
          </div>

          <div role="group" aria-label="AI app" className="inline-flex flex-wrap gap-0.5 rounded-[10px] border border-pd-border bg-pd-table-head p-[3px]">
            {CONNECT_APPS.map((a) => (
              <button
                key={a.key}
                type="button"
                aria-pressed={a.key === appKey}
                onClick={() => setAppKey(a.key)}
                className={`rounded-[7px] px-[11px] py-[5px] text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pd-primary ${
                  a.key === appKey ? "bg-white text-pd-ink shadow-sm" : "text-pd-muted hover:text-pd-ink"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>

          <ol className="space-y-0">
            {app.steps.map((s, i) => (
              <li key={i} className="flex gap-3 py-2 text-[13.5px] text-pd-body">
                <span className="grid size-[22px] flex-none place-items-center rounded-full bg-pd-primary-tint text-[12px] font-semibold text-pd-primary">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  {renderStep(s.text, mcpUrl)}
                  {s.code && (
                    <code className="mt-2 block overflow-x-auto rounded-[8px] border border-pd-border bg-pd-table-head px-3 py-2 font-mono text-[12.5px] text-pd-ink">
                      {s.code.replace("{url}", mcpUrl)}
                    </code>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-pd-display text-[15px] font-semibold text-pd-ink">Your connections</h3>
            <Button variant="ghost" size="md" className="text-pd-muted" onClick={() => { setNewToken(null); setTokenOpen((o) => !o) }}>
              Create token for developers
            </Button>
          </div>

          {tokenOpen && (
            <form onSubmit={createToken} className="space-y-3 rounded-[12px] border border-pd-border bg-pd-table-head p-4">
              <div className="space-y-1.5">
                <Label htmlFor="mcp-token-name" className="text-[12.5px] text-pd-muted">Token name</Label>
                <Input id="mcp-token-name" value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="e.g. My script" maxLength={80} />
              </div>
              <fieldset className="space-y-1.5">
                <legend className="text-[12.5px] font-medium text-pd-muted">Access</legend>
                {["read", "write"].map((v) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 text-[13px] text-pd-body">
                    <input type="radio" name="mcp-token-access" value={v} checked={tokenAccess === v} onChange={() => setTokenAccess(v)} className="accent-pd-primary" />
                    {ACCESS_LABEL[v]}
                  </label>
                ))}
              </fieldset>
              <div className="flex gap-2">
                <Button type="submit" size="md" disabled={creating || !tokenName.trim()}>Create token</Button>
                <Button type="button" variant="ghost" size="md" onClick={() => setTokenOpen(false)}>Cancel</Button>
              </div>
            </form>
          )}

          {newToken && (
            <div className="space-y-2 rounded-[12px] border border-pd-primary-pale bg-pd-primary-tint p-4">
              <p className="text-[13px] font-medium text-pd-ink">
                Token for {newToken.name}. This is the only time you'll see it, so copy it now.
              </p>
              <div className="flex min-w-0 items-center gap-2 rounded-[10px] border border-pd-border-strong bg-white py-1.5 pl-3 pr-1.5">
                <code className="min-w-0 flex-1 break-all font-mono text-[12.5px] text-pd-ink">{newToken.token}</code>
                <Button size="md" variant="outline" onClick={() => copy(newToken.token, "Token copied")}>Copy token</Button>
              </div>
              <Button size="md" variant="ghost" onClick={() => setNewToken(null)}>Done</Button>
            </div>
          )}

          {connections === null ? (
            <p className="text-[13px] text-pd-subtle">Loading…</p>
          ) : loadError ? (
            <p className="text-[13px] text-pd-danger">Couldn't load your connections. Refresh to try again.</p>
          ) : connections.length === 0 ? (
            <p className="text-[13px] text-pd-subtle">Nothing connected yet. Add Birdy to an AI app above and it will show up here.</p>
          ) : (
            <>
            <ul className="divide-y divide-pd-row-border rounded-[12px] border border-pd-border sm:hidden" aria-label="Connections">
              {connections.map((c) => (
                <li key={c.id} className="space-y-2.5 p-3.5">
                  <div className="flex items-center gap-2.5 font-medium text-pd-ink"><AppLogo name={c.name} />{c.name}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-pd-body">
                    <span className={`inline-flex whitespace-nowrap rounded-full px-[9px] py-0.5 text-[12px] font-medium ${ACCESS_CHIP[c.access] || ACCESS_CHIP.read}`}>
                      {ACCESS_LABEL[c.access] || ACCESS_LABEL.read}
                    </span>
                    <span>Last used {formatRelative(c.last_used_at)}</span>
                  </div>
                  <Button variant="outline" size="md" className="w-full text-pd-danger hover:text-pd-danger" onClick={() => setRevoking(c)}>
                    Disconnect
                  </Button>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-hidden rounded-[12px] border border-pd-border sm:block">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-pd-table-head text-left text-pd-subtle">
                      {["App", "Access", "Connected", "Last used"].map((h) => (
                        <th key={h} className="border-b border-pd-border px-2.5 py-2 font-medium">{h}</th>
                      ))}
                      <th className="border-b border-pd-border px-2.5 py-2"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {connections.map((c) => (
                      <tr key={c.id} className="border-b border-pd-row-border last:border-b-0">
                        <td className="px-2.5 py-2.5 font-medium text-pd-ink"><div className="flex items-center gap-2.5"><AppLogo name={c.name} />{c.name}</div></td>
                        <td className="px-2.5 py-2.5">
                          <span className={`inline-flex whitespace-nowrap rounded-full px-[9px] py-0.5 text-[12px] font-medium ${ACCESS_CHIP[c.access] || ACCESS_CHIP.read}`}>
                            {ACCESS_LABEL[c.access] || ACCESS_LABEL.read}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 text-pd-body">{formatDate(c.created_at)}</td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 text-pd-body">{formatRelative(c.last_used_at)}</td>
                        <td className="px-2.5 py-2.5 text-right">
                          <Button variant="ghost" size="md" className="text-pd-danger hover:text-pd-danger" onClick={() => setRevoking(c)}>
                            Disconnect
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardContent className="space-y-2 p-5">
          <h3 className="font-pd-display text-[15px] font-semibold text-pd-ink">Daily check-in (optional)</h3>
          <p className="text-[12.5px] text-pd-subtle">
            In Claude, create a scheduled task with this prompt to get a morning summary of what needs your attention.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 rounded-[10px] border border-dashed border-pd-border-strong bg-pd-table-head px-3 py-2.5 text-[13px] text-pd-body">
              {CHECK_IN_PROMPT}
            </div>
            <Button variant="outline" size="md" onClick={() => copy(CHECK_IN_PROMPT, "Prompt copied")}>Copy</Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(revoking)} onOpenChange={(o) => { if (!o && !busyRevoke) setRevoking(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {revoking?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {revoking?.name} will lose access to Birdy straight away. You can connect it again whenever you like.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyRevoke}>Keep connected</AlertDialogCancel>
            <AlertDialogAction
              disabled={busyRevoke}
              onClick={(e) => { e.preventDefault(); confirmRevoke() }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
