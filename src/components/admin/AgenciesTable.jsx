"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { UserRoundCog, MessagesSquare, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { startImpersonation, fetchMe } from "@/lib/admin-api"

function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"
}

function relative(ts) {
  if (!ts) return "—"
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true })
  } catch {
    return "—"
  }
}

const PLAN_STYLES = {
  Scale: "bg-purple-50 text-purple-700 border-purple-200",
  Growth: "bg-blue-50 text-blue-700 border-blue-200",
  Starter: "bg-amber-50 text-amber-700 border-amber-200",
  Free: "bg-gray-50 text-gray-600 border-gray-200",
}

export default function AgenciesTable({ agencies, loading, onViewChats }) {
  const [target, setTarget] = useState(null) // agency pending impersonation confirm
  const [busy, setBusy] = useState(false)

  const confirmImpersonate = async () => {
    if (!target) return
    setBusy(true)
    try {
      await startImpersonation(target.email)
      // Sync local identity to the impersonated user before the reload so the
      // admin-only chrome (sidebar item, /admin guard) flips immediately.
      const me = await fetchMe()
      if (me) {
        localStorage.setItem("user", JSON.stringify({
          email: me.email, name: me.name, role: me.role,
          default_currency: me.default_currency,
        }))
        window.dispatchEvent(new Event("userUpdated"))
      }
      // Full reload into the app, now scoped to the impersonated account.
      window.location.href = "/dashboard"
    } catch (e) {
      toast.error("Couldn't start impersonation", { description: e.message })
      setBusy(false)
      setTarget(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 rounded-xl border bg-white p-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    )
  }

  const rows = agencies || []

  return (
    <>
      <div className="rounded-xl border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B]">Owner / Agency</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B]">Plan</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B] text-right">Sub-accounts</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B] text-right">Leads</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B] text-right">AI queries</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B]">Last active</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                  No agencies found.
                </TableCell>
              </TableRow>
            )}
            {rows.map((a) => (
              <TableRow key={a.email} className="group">
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-purple-100 text-purple-700 text-[11px] font-bold flex items-center justify-center">
                      {initials(a.owner)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {a.owner}
                        {a.role === "admin" && (
                          <span className="ml-1.5 text-[10px] font-semibold text-purple-600">ADMIN</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={PLAN_STYLES[a.plan] || PLAN_STYLES.Free}>{a.plan}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">{a.sub_accounts.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{a.leads.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{a.ai_queries.toLocaleString()}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{relative(a.last_active)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => onViewChats?.(a)}
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-muted transition-colors"
                    >
                      <MessagesSquare className="h-3.5 w-3.5" /> Chats
                    </button>
                    <button
                      onClick={() => setTarget(a)}
                      disabled={a.role === "admin"}
                      className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <UserRoundCog className="h-3.5 w-3.5" /> Impersonate
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && !busy && setTarget(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Impersonate {target?.owner}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll access <span className="font-medium">{target?.email}</span>'s account with full
              read &amp; write access for up to 45 minutes. A banner will show you're impersonating,
              and this action is recorded to the admin audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmImpersonate() }}
              disabled={busy}
              className="bg-purple-600 text-white hover:bg-purple-700"
            >
              {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Starting…</> : "Impersonate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
