"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { UserRoundCog, MessagesSquare, Loader2, Trash2, Gauge } from "lucide-react"
import { toast } from "sonner"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { startImpersonation, fetchMe, deleteUserAccount } from "@/lib/admin-api"
import { rewriteSessionRole } from "@/lib/session"
import ClientLimitDialog from "@/components/admin/ClientLimitDialog"

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
  Scale: "bg-pd-primary-tint text-pd-primary",
  Growth: "bg-pd-info-bg text-pd-info",
  Starter: "bg-pd-warning-bg text-pd-amber",
  Free: "bg-pd-divider text-pd-body",
}

const TH = "bg-pd-table-head text-[11.5px] font-bold uppercase tracking-[.04em] text-pd-faint"
const TR = "border-b border-pd-row-border hover:bg-pd-table-head"

export default function AgenciesTable({ agencies, loading, onViewChats, onDeleted }) {
  const [target, setTarget] = useState(null) // agency pending impersonation confirm
  const [busy, setBusy] = useState(false)

  // Deletion is the only way an account leaves Birdy now that Settings no
  // longer offers it, so this table is the whole process: the row being
  // deleted, the typed-email confirmation, and the in-flight flag.
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [confirmEmail, setConfirmEmail] = useState("")
  const [deleting, setDeleting] = useState(false)
  // Account whose client limit is being edited.
  const [limitTarget, setLimitTarget] = useState(null)

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
        // The proxy routes the reload on this cookie; still saying "admin",
        // it would send the admin straight back to the console.
        rewriteSessionRole(me.role)
      }
      // Full reload into the app, now scoped to the impersonated account.
      window.location.href = "/dashboard"
    } catch (e) {
      toast.error("Couldn't start impersonation", { description: e.message })
      setBusy(false)
      setTarget(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteUserAccount(deleteTarget.email)
      toast.success(`Deleted ${deleteTarget.email}`)
      setDeleteTarget(null)
      // The row is gone server-side; refetch rather than splice it out locally
      // so the stat strip's counts move with the table.
      onDeleted?.()
    } catch (e) {
      // The refusals (live subscription, admin account) are all actionable, so
      // keep the dialog open with the message rather than dismissing it.
      toast.error("Couldn't delete the account", { description: e.message })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-pd-border bg-pd-surface shadow-sm">
        <Skeleton className="h-11 w-full rounded-none" />
        <div className="divide-y divide-pd-row-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="h-7 w-44 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const rows = agencies || []

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-pd-border bg-pd-surface shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-pd-border hover:bg-pd-table-head">
              <TableHead className={TH}>Owner / Agency</TableHead>
              <TableHead className={TH}>Plan</TableHead>
              <TableHead className={`${TH} text-right`}>Clients</TableHead>
              <TableHead className={`${TH} text-right`}>Leads</TableHead>
              <TableHead className={`${TH} text-right`}>AI queries</TableHead>
              <TableHead className={TH}>Last active</TableHead>
              <TableHead className={`${TH} text-right`}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow className={TR}>
                <TableCell colSpan={7} className="text-center text-sm text-pd-subtle py-10">
                  No agencies found.
                </TableCell>
              </TableRow>
            )}
            {rows.map((a) => (
              <TableRow key={a.email} className={`group ${TR}`}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-pd-primary-tint text-pd-primary text-[11px] font-bold flex items-center justify-center">
                      {initials(a.owner)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-pd-ink truncate">
                        {a.owner}
                        {a.role === "admin" && (
                          <span className="ml-1.5 text-[10px] font-bold text-pd-primary">ADMIN</span>
                        )}
                      </div>
                      <div className="text-xs text-pd-subtle truncate">{a.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`text-[11px] font-bold ${PLAN_STYLES[a.plan] || PLAN_STYLES.Free}`}>{a.plan}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-pd-body">
                  {/* Used / allowed. The allowance is the override when an admin
                      has set one, otherwise what the plan gives. */}
                  <span>{a.sub_accounts.toLocaleString()}</span>
                  <span className="text-pd-faint"> / {(a.client_limit ?? 0).toLocaleString()}</span>
                  {a.client_limit_override != null && (
                    <span
                      className="ml-1.5 rounded-full bg-pd-primary-tint px-1.5 py-px text-[10px] font-semibold text-pd-primary"
                      title={`Admin override (plan allows ${a.plan_client_limit})${a.client_limit_override_note ? ` — ${a.client_limit_override_note}` : ""}`}
                    >
                      override
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-pd-body">{a.leads.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums text-sm text-pd-body">{a.ai_queries.toLocaleString()}</TableCell>
                <TableCell className="text-xs text-pd-subtle">{relative(a.last_active)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => onViewChats?.(a)}
                    >
                      <MessagesSquare className="h-3.5 w-3.5" /> Chats
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setLimitTarget(a)}
                      disabled={a.role === "admin"}
                      aria-label={`Set the client limit for ${a.email}`}
                    >
                      <Gauge className="h-3.5 w-3.5" /> Limit
                    </Button>
                    <Button
                      size="xs"
                      onClick={() => setTarget(a)}
                      disabled={a.role === "admin"}
                    >
                      <UserRoundCog className="h-3.5 w-3.5" /> Impersonate
                    </Button>
                    {/* Disabled on admin rows for the same reason Impersonate
                        is — and the server refuses them outright, including
                        the acting admin's own row, so this is purely a hint
                        that the click would bounce. */}
                    <Button
                      variant="destructive-outline"
                      size="xs"
                      onClick={() => { setConfirmEmail(""); setDeleteTarget(a) }}
                      disabled={a.role === "admin"}
                      aria-label={`Delete ${a.email}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ClientLimitDialog
        agency={limitTarget}
        onClose={() => setLimitTarget(null)}
        onSaved={() => { setLimitTarget(null); onDeleted?.() }}
      />

      <AlertDialog open={!!target} onOpenChange={(o) => !o && !busy && setTarget(null)}>
        <AlertDialogContent className="bg-pd-surface rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-pd-display">Impersonate {target?.owner}?</AlertDialogTitle>
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
            >
              {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Starting…</> : "Impersonate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Nothing about this is recoverable and there is no soft-delete behind
          it, so a confirm click on its own is not enough: the admin has to
          type the account's own email, which forces them to read the row they
          are about to destroy. Same bar the Settings flow used before account
          deletion moved in here. */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o && !deleting) { setDeleteTarget(null); setConfirmEmail("") } }}
      >
        <AlertDialogContent className="bg-pd-surface rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-pd-display">Delete {deleteTarget?.owner}'s account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <span className="font-medium">{deleteTarget?.email}</span> and
              everything Birdy stored for them — {deleteTarget?.sub_accounts ?? 0} client group(s),
              {" "}{(deleteTarget?.leads ?? 0).toLocaleString()} lead(s), all connected integrations,
              call logs, alerts and chat history. There is no backup and no undo. Type the account's
              email below to confirm.
            </AlertDialogDescription>
            {/* Cancellation is now part of the delete, not a chore the admin
                does first in Whop. Saying so matters: an admin who assumes it
                is still manual will go and cancel by hand, and one who assumes
                nothing happens will leave a live subscription behind. */}
            {deleteTarget?.plan && deleteTarget.plan !== "Free" && (
              <AlertDialogDescription className="mt-2 font-medium text-pd-ink">
                Their {deleteTarget.plan} subscription will be cancelled in Whop immediately as part
                of this. If Whop refuses the cancellation, nothing is deleted.
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <Input
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={deleteTarget?.email}
            aria-label="Type the account email to confirm deletion"
            autoComplete="off"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => { e.preventDefault(); confirmDelete() }}
              disabled={deleting || confirmEmail.trim().toLowerCase() !== (deleteTarget?.email || "")}
            >
              {deleting
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Deleting…</>
                : "Delete this account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
