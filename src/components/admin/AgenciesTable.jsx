"use client"

import { useMemo, useState } from "react"
import { MessagesSquare, MoreHorizontal, Gauge, Trash2, UserRoundCog } from "lucide-react"
import { toast } from "sonner"
import {
  Badge,
  Button,
  DataTable,
  DataTableColumnHeader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  TwoLineCell,
} from "@/components/ds"
import { startImpersonation, fetchMe, deleteUserAccount } from "@/lib/admin-api"
import { rewriteSessionRole } from "@/lib/session"
import ClientLimitDialog from "@/components/admin/ClientLimitDialog"
import { planTone, relative } from "@/components/admin/format"

// Right-aligned, sortable header for a number column.
const numHeader = (title) =>
  function NumHeader({ column }) {
    return (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} title={title} className="ml-0 -mr-2" />
      </div>
    )
  }

const numCell = (value) => <div className="num text-right text-sm text-body">{value}</div>

/**
 * The agency list. Owner / Agency, plan, usage figures, and per-row actions:
 * Impersonate stays one click away, everything else (chats, client limit,
 * delete) sits in the ⋯ menu so the destructive one is never next to the
 * common one.
 *
 * @param {object} props
 * @param {object[]} [props.agencies]
 * @param {boolean} [props.loading]
 * @param {(agency: object) => void} [props.onViewChats]
 * @param {() => void} [props.onDeleted] Refetch after a delete or a client-limit change
 * @param {React.ReactNode} [props.toolbar] Extra toolbar controls (the page's debounced search)
 */
export default function AgenciesTable({ agencies, loading, onViewChats, onDeleted, toolbar }) {
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

  const columns = useMemo(
    () => [
      {
        id: "owner",
        accessorFn: (a) => a.owner,
        header: "Owner / Agency",
        meta: { label: "Owner / Agency", minWidth: 220 },
        cell: ({ row }) => {
          const a = row.original
          return (
            <TwoLineCell
              primary={
                <>
                  {a.owner}
                  {a.role === "admin" && (
                    <Badge tone="primary" className="ml-1.5 align-middle">Admin</Badge>
                  )}
                </>
              }
              secondary={a.email}
            />
          )
        },
      },
      {
        accessorKey: "plan",
        header: "Plan",
        meta: { label: "Plan" },
        cell: ({ row }) => <Badge tone={planTone(row.original.plan)}>{row.original.plan}</Badge>,
      },
      {
        id: "clients",
        accessorFn: (a) => a.sub_accounts,
        header: numHeader("Clients"),
        meta: { label: "Clients" },
        cell: ({ row }) => {
          const a = row.original
          // Used / allowed. The allowance is the override when an admin has set
          // one, otherwise what the plan gives.
          return numCell(
            <>
              <span>{a.sub_accounts.toLocaleString()}</span>
              <span className="text-muted-foreground"> / {(a.client_limit ?? 0).toLocaleString()}</span>
              {a.client_limit_override != null && (
                <Badge
                  className="ml-1.5 align-middle"
                  title={`Admin override (plan allows ${a.plan_client_limit})${a.client_limit_override_note ? ` — ${a.client_limit_override_note}` : ""}`}
                >
                  override
                </Badge>
              )}
            </>
          )
        },
      },
      {
        id: "leads",
        accessorFn: (a) => a.leads,
        header: numHeader("Leads"),
        meta: { label: "Leads" },
        cell: ({ row }) => numCell(row.original.leads.toLocaleString()),
      },
      {
        id: "ai_queries",
        accessorFn: (a) => a.ai_queries,
        header: numHeader("AI queries"),
        meta: { label: "AI queries" },
        cell: ({ row }) => numCell(row.original.ai_queries.toLocaleString()),
      },
      {
        id: "last_active",
        accessorFn: (a) => (a.last_active ? new Date(a.last_active).getTime() : 0),
        header: "Last active",
        meta: { label: "Last active" },
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{relative(row.original.last_active)}</span>,
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        enableSorting: false,
        enableHiding: false,
        meta: { label: "Actions" },
        cell: ({ row }) => {
          const a = row.original
          // Disabled on admin rows: the server refuses them outright, including
          // the acting admin's own row, so this is purely a hint that the click
          // would bounce.
          const isAdmin = a.role === "admin"
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button size="sm" onClick={() => setTarget(a)} disabled={isAdmin}>
                <UserRoundCog aria-hidden /> Impersonate
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon-sm" disabled={isAdmin} aria-label={`More actions for ${a.email}`}>
                    <MoreHorizontal aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onSelect={() => onViewChats?.(a)}>
                    <MessagesSquare aria-hidden /> View chats
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setLimitTarget(a)}>
                    <Gauge aria-hidden /> Set client limit…
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => { setConfirmEmail(""); setDeleteTarget(a) }}
                  >
                    <Trash2 aria-hidden /> Delete account…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [onViewChats]
  )

  return (
    <>
      <DataTable
        columns={columns}
        data={agencies || []}
        loading={loading}
        toolbar={toolbar}
        getRowId={(a) => a.email}
        empty={<EmptyState title="No agencies found." />}
      />

      <ClientLimitDialog
        agency={limitTarget}
        onClose={() => setLimitTarget(null)}
        onSaved={() => { setLimitTarget(null); onDeleted?.() }}
      />

      <Dialog open={!!target} onOpenChange={(o) => !o && !busy && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impersonate {target?.owner}?</DialogTitle>
            <DialogDescription>
              You'll access <span className="font-medium">{target?.email}</span>'s account with full
              read &amp; write access for up to 45 minutes. A banner will show you're impersonating,
              and this action is recorded to the admin audit log.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setTarget(null)} disabled={busy}>Cancel</Button>
            <Button variant="primary" onClick={confirmImpersonate} loading={busy}>
              {busy ? "Starting…" : "Impersonate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nothing about this is recoverable and there is no soft-delete behind
          it, so a confirm click on its own is not enough: the admin has to
          type the account's own email, which forces them to read the row they
          are about to destroy. Same bar the Settings flow used before account
          deletion moved in here. */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o && !deleting) { setDeleteTarget(null); setConfirmEmail("") } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.owner}'s account?</DialogTitle>
            <DialogDescription>
              This permanently deletes <span className="font-medium">{deleteTarget?.email}</span> and
              everything Birdy stored for them — {deleteTarget?.sub_accounts ?? 0} client group(s),
              {" "}{(deleteTarget?.leads ?? 0).toLocaleString()} lead(s), all connected integrations,
              call logs, alerts and chat history. There is no backup and no undo. Type the account's
              email below to confirm.
            </DialogDescription>
            {/* Cancellation is now part of the delete, not a chore the admin
                does first in Whop. Saying so matters: an admin who assumes it
                is still manual will go and cancel by hand, and one who assumes
                nothing happens will leave a live subscription behind. */}
            {deleteTarget?.plan && deleteTarget.plan !== "Free" && (
              <DialogDescription className="font-medium text-foreground">
                Their {deleteTarget.plan} subscription will be cancelled in Whop immediately as part
                of this. If Whop refuses the cancellation, nothing is deleted.
              </DialogDescription>
            )}
          </DialogHeader>
          <Input
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={deleteTarget?.email}
            aria-label="Type the account email to confirm deletion"
            autoComplete="off"
          />
          <DialogFooter>
            <Button onClick={() => { setDeleteTarget(null); setConfirmEmail("") }} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              loading={deleting}
              disabled={confirmEmail.trim().toLowerCase() !== (deleteTarget?.email || "")}
            >
              {deleting ? "Deleting…" : "Delete this account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
