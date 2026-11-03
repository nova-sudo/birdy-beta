"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  Badge,
  Button,
  Checkbox,
  Frame,
  Label,
  Notice,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Surface,
} from "@/components/ds"
import { useCreativeAdAccounts, useCreativeAdsets, useCreativeLeadForms, useCreativePages } from "@/lib/creatives-api"

const VIDEO_NOTICE = "Upload the video file to post here"

const EMPTY_ENTRY = { client_group_id: null, adset_id: null, adset_name: null, page_id: null, lead_form_id: null }

/** Whether "Continue" is allowed on step 2: every chosen account has a Page, an ad set and, for lead forms, a form. */
export function accountsStepValid(draft, lockedAccountIds = []) {
  const locked = new Set(lockedAccountIds)
  const rows = (draft?.creative?.accounts ?? []).filter((r) => !locked.has(r.ad_account_id))
  if (rows.length === 0) return false
  const needsForm = draft.creative.destination === "lead_form"
  return rows.every((r) => r.adset_id && r.page_id && (!needsForm || r.lead_form_id))
}

/** A revived video lives on its source account until the file is uploaded. */
function videoBlocked(draft, act) {
  const c = draft.creative ?? {}
  if (draft.origin !== "revive" || !c.media?.video_id || c.media?.blob_url) return false
  return act !== draft.source?.ad_account_id
}

function Field({ id, label, children }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function AccountPanel({ account, entry, draft, update, onAdsets, canApply, applyBusy, onApply }) {
  const act = account.ad_account_id
  const destination = draft.creative.destination
  const { adsets, error: adsetError, isLoading: adsetsLoading } = useCreativeAdsets(act, destination)
  const { pages, error: pageError, isLoading: pagesLoading } = useCreativePages(act)
  const { forms, error: formError, isLoading: formsLoading } = useCreativeLeadForms(destination === "lead_form" ? entry.page_id : null)
  const name = accountLabel(account)

  useEffect(() => {
    onAdsets(act, adsets, adsetsLoading)
  }, [act, adsets, adsetsLoading, onAdsets])

  // A changed destination can leave a choice that no longer fits: clear it once the ad sets are known.
  useEffect(() => {
    if (adsetsLoading || adsetError || !destination) return
    const patch = {}
    if (entry.adset_id) {
      const chosen = adsets.find((a) => a.id === entry.adset_id)
      if (!chosen || !chosen.compatible) Object.assign(patch, { adset_id: null, adset_name: null, client_group_id: null })
    }
    if (destination !== "lead_form" && entry.lead_form_id) patch.lead_form_id = null
    if (Object.keys(patch).length) update(act, patch)
  }, [act, adsets, adsetsLoading, adsetError, destination, entry.adset_id, entry.lead_form_id, update])

  // Default Page: the revived ad's, else the first promote page.
  useEffect(() => {
    if (entry.page_id || pages.length === 0) return
    const source = draft.source?.page_id
    update(act, { page_id: pages.some((p) => p.id === source) ? source : pages[0].id })
  }, [act, entry.page_id, pages, draft.source?.page_id, update])

  const errors = [adsetError, pageError, formError].filter(Boolean)

  return (
    <div className="flex flex-col gap-3 border-t border-border/60 pt-3">
      {errors.map((e, i) => (
        <Notice key={i} tone="danger">
          Couldn't load this account from Meta: {e.message}
        </Notice>
      ))}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Field id={`page-${act}`} label="Page">
          {pagesLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select value={entry.page_id ?? ""} onValueChange={(v) => update(act, { page_id: v, lead_form_id: null })}>
              <SelectTrigger id={`page-${act}`} aria-label={`Page for ${name}`}>
                <SelectValue placeholder="Choose a Page" />
              </SelectTrigger>
              <SelectContent>
                {pages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field id={`adset-${act}`} label="Ad set">
          {adsetsLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <div className="flex items-center gap-2">
              <Select
                value={entry.adset_id ?? ""}
                onValueChange={(v) => {
                  const a = adsets.find((x) => x.id === v)
                  update(act, { adset_id: v, adset_name: a?.name ?? null, client_group_id: a?.owning_client_group_id ?? null })
                }}
              >
                <SelectTrigger id={`adset-${act}`} aria-label={`Ad set for ${name}`} className="min-w-0 flex-1">
                  <SelectValue placeholder="Choose an ad set" />
                </SelectTrigger>
                <SelectContent>
                  {adsets.map((a) => (
                    <SelectItem key={a.id} value={a.id} disabled={!a.compatible}>
                      <span className="flex flex-col">
                        <span>{a.name}</span>
                        {!a.compatible && a.reason && <span className="text-xs text-muted-foreground">{a.reason}</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canApply && entry.adset_id && (
                <Button type="button" variant="ghost" size="sm" disabled={applyBusy} onClick={() => onApply(act)}>
                  Apply ad set to all
                </Button>
              )}
            </div>
          )}
        </Field>
        {destination === "lead_form" && (
          <Field id={`form-${act}`} label="Lead form">
            {formsLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={entry.lead_form_id ?? ""} onValueChange={(v) => update(act, { lead_form_id: v })} disabled={!entry.page_id}>
                <SelectTrigger id={`form-${act}`} aria-label={`Lead form for ${name}`}>
                  <SelectValue placeholder={forms.length === 0 && entry.page_id ? "No lead forms on this Page" : "Choose a form"} />
                </SelectTrigger>
                <SelectContent>
                  {forms.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        )}
      </div>
    </div>
  )
}

function accountLabel(account) {
  const names = (account.clients ?? []).map((c) => c.name).filter(Boolean)
  return names.length ? names.join(", ") : account.name || account.ad_account_id
}

/**
 * Wizard step 2: choose the ad accounts, then a Page, ad set and (for lead forms) a form for each.
 * Selections are written to `creative.accounts`.
 *
 * @param {object} props
 * @param {object} props.draft From `useCreativeDraft`
 * @param {(path: string, value: any) => void} props.setField
 * @param {string[]} [props.lockedAccountIds] Accounts the test already runs in (add-accounts mode)
 */
export function StepAccounts({ draft, setField, lockedAccountIds = [] }) {
  const { accounts, error, isLoading } = useCreativeAdAccounts()
  const locked = new Set(lockedAccountIds)
  const rows = (draft.creative.accounts ?? []).filter((r) => !locked.has(r.ad_account_id))
  // Latest list, so several effects firing in one render don't overwrite each other.
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const [adsetsByAccount, setAdsetsByAccount] = useState({})

  const write = useCallback(
    (next) => {
      rowsRef.current = next
      setField("creative.accounts", next)
    },
    [setField]
  )
  const update = useCallback(
    (act, patch) => write(rowsRef.current.map((r) => (r.ad_account_id === act ? { ...r, ...patch } : r))),
    [write]
  )
  const onAdsets = useCallback(
    (act, adsets, loading) =>
      setAdsetsByAccount((m) => (m[act]?.adsets === adsets && m[act]?.loading === loading ? m : { ...m, [act]: { adsets, loading } })),
    []
  )
  const [missed, setMissed] = useState(null)
  const selectable = accounts.filter((a) => !locked.has(a.ad_account_id) && !videoBlocked(draft, a.ad_account_id))
  const chosen = new Set(rows.map((r) => r.ad_account_id))
  const allSelected = selectable.length > 0 && selectable.every((a) => chosen.has(a.ad_account_id))

  function toggle(act, on) {
    if (on) write([...rowsRef.current.filter((r) => r.ad_account_id !== act), { ad_account_id: act, ...EMPTY_ENTRY }])
    else write(rowsRef.current.filter((r) => r.ad_account_id !== act))
  }

  function toggleAll(on) {
    const keep = rowsRef.current.filter((r) => !selectable.some((a) => a.ad_account_id === r.ad_account_id))
    write(on ? [...keep, ...selectable.map((a) => rowsRef.current.find((r) => r.ad_account_id === a.ad_account_id) ?? { ad_account_id: a.ad_account_id, ...EMPTY_ENTRY })] : keep)
  }

  function applyToAll(fromAct) {
    const from = rowsRef.current.find((r) => r.ad_account_id === fromAct)
    if (!from?.adset_name) return
    let misses = 0
    write(
      rowsRef.current.map((r) => {
        if (r.ad_account_id === fromAct) return r
        const match = (adsetsByAccount[r.ad_account_id]?.adsets ?? []).find((a) => a.name === from.adset_name && a.compatible)
        if (!match) misses += 1
        return match ? { ...r, adset_id: match.id, adset_name: match.name, client_group_id: match.owning_client_group_id ?? null } : r
      })
    )
    setMissed(misses)
  }

  const applyBusy = rows.some((r) => adsetsByAccount[r.ad_account_id]?.loading !== false)

  return (
    <Frame title="Accounts" description="Choose where this creative runs, then set the Page and ad set for each." padded>
      {error ? (
        <Notice tone="danger">Couldn't load your ad accounts: {error.message}</Notice>
      ) : isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ad accounts are connected to your clients yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(v === true)} aria-label="Select all accounts" />
            Select all
          </label>
          {rows.length > 1 && applyBusy && <p className="text-xs text-muted-foreground">Waiting for every ad set list to load before ad sets can be applied to all.</p>}
          {missed > 0 && (
            <p className="text-xs text-muted-foreground">
              No matching ad set in {missed} {missed === 1 ? "account" : "accounts"}
            </p>
          )}
          {accounts.map((a) => {
            const act = a.ad_account_id
            const isLocked = locked.has(act)
            const blocked = !isLocked && videoBlocked(draft, act)
            const entry = rows.find((r) => r.ad_account_id === act)
            const label = accountLabel(a)
            return (
              <Surface key={act} className="flex flex-col gap-3 p-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={isLocked || !!entry}
                    disabled={isLocked || blocked}
                    onCheckedChange={(v) => toggle(act, v === true)}
                    aria-label={`Select ${label}`}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground">{act}</span>
                  </div>
                  {isLocked && <Badge tone="neutral">Already posted</Badge>}
                  <Badge tone="neutral">{a.currency ?? "—"}</Badge>
                </div>
                {blocked && <p className="text-xs text-muted-foreground">{VIDEO_NOTICE}</p>}
                {entry && (
                  <AccountPanel
                    account={a}
                    entry={entry}
                    draft={draft}
                    update={update}
                    onAdsets={onAdsets}
                    canApply={rows.length > 1}
                    applyBusy={applyBusy}
                    onApply={applyToAll}
                  />
                )}
              </Surface>
            )
          })}
        </div>
      )}
    </Frame>
  )
}
