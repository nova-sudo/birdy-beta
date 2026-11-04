"use client"

import { TriangleAlert } from "lucide-react"

import { Frame, Notice, SegmentedTabs, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ds"

export const MODE_LABELS = { flag: "Flag", ask: "Ask me", auto: "Auto" }
const MODE_HELP = {
  flag: "Birdy points it out. You make the change in Meta.",
  ask: "Birdy drafts the change on a card. Nothing happens until you approve it.",
  auto: "Birdy makes the change in Meta by itself, then tells you. Use it only for changes you trust.",
}

/** The change types a mode applies to. Alerts are always Flag, so they are not here. */
export const CHANGE_TYPES = [
  { kind: "remove", label: "Remove", help: "Pause an ad that is losing." },
  { kind: "add", label: "Add", help: "Post a proven ad to another client's account." },
  { kind: "revive", label: "Revive", help: "Turn a paused winner back on." },
]

const DEFAULT = "__default"

/**
 * The settings patches that turn `before` into `next`, in order. A client's mode override can only be
 * cleared by sending `modes: null` (the server merges objects), so a client that lost an override gets
 * that first and its remaining overrides after.
 * @param {{modes: object, clientModes: Record<string, object>}} before
 * @param {{modes: object, clientModes: Record<string, object>}} next
 */
export function modesPatches(before, next) {
  const patches = []
  const cleared = Object.keys(before.clientModes ?? {}).filter((gid) =>
    Object.keys(before.clientModes[gid] ?? {}).some((k) => !(k in (next.clientModes?.[gid] ?? {})))
  )
  if (cleared.length) patches.push({ clients: Object.fromEntries(cleared.map((gid) => [gid, { modes: null }])) })
  const clients = {}
  for (const [gid, modes] of Object.entries(next.clientModes ?? {})) {
    if (Object.keys(modes).length) clients[gid] = { modes }
  }
  patches.push({ modes: next.modes, ...(Object.keys(clients).length ? { clients } : {}) })
  return patches
}

/** What a settings object holds that ModesTable edits. */
export function modesOf(settings) {
  return {
    modes: { remove: "ask", add: "ask", revive: "ask", ...settings?.modes },
    clientModes: Object.fromEntries(
      Object.entries(settings?.clients ?? {})
        .filter(([, c]) => c?.modes && Object.keys(c.modes).length)
        .map(([gid, c]) => [gid, c.modes])
    ),
  }
}

/**
 * Flag, Ask me or Auto for each change type, for every client, with an override per client.
 * Add can only be Flag while the server has posting new ads switched off (`settings.add_writes_enabled`).
 *
 * @param {object} props
 * @param {object} props.settings The agent's settings, with `modes`, `clients` and `add_writes_enabled`
 * @param {{id: string, name: string}[]} props.clients The watched clients
 * @param {(next: {modes: object, clientModes: Record<string, object>}) => void} props.onChange The whole new state
 * @param {Record<string, string>} [props.errors] The server's refusal for a client, by client id, shown on its row
 */
export function ModesTable({ settings, clients, onChange, errors = {} }) {
  const { modes, clientModes } = modesOf(settings)
  const addOn = settings?.add_writes_enabled === true
  const shown = (kind, mode) => (kind === "add" && !addOn ? "flag" : mode)
  const anyAuto = [...Object.values(modes), ...Object.values(clientModes).flatMap((m) => Object.values(m))].some((m) => m === "auto")

  const setDefault = (kind, mode) => onChange({ modes: { ...modes, [kind]: mode }, clientModes })
  const setClient = (gid, kind, mode) => {
    const mine = { ...(clientModes[gid] ?? {}) }
    if (mode === DEFAULT) delete mine[kind]
    else mine[kind] = mode
    const next = { ...clientModes }
    if (Object.keys(mine).length) next[gid] = mine
    else delete next[gid]
    onChange({ modes, clientModes: next })
  }

  return (
    <div className="flex flex-col gap-6">
      <Frame title="For every client" description="Each change type starts on Ask me. Alerts are always Flag." padded contentClassName="flex flex-col gap-5">
        {CHANGE_TYPES.map(({ kind, label, help }) => {
          const locked = kind === "add" && !addOn
          return (
            <div key={kind} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 basis-64">
                <div className="text-sm font-medium text-foreground">{label}</div>
                <p className="text-xs text-muted-foreground">{help}</p>
                {locked && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Posting new ads is switched off for now, so Add can only Flag.
                  </p>
                )}
              </div>
              <SegmentedTabs
                size="sm"
                ariaLabel={`${label} mode`}
                value={shown(kind, modes[kind])}
                onValueChange={(m) => setDefault(kind, m)}
                items={Object.entries(MODE_LABELS).map(([value, text]) => ({ value, label: text, disabled: locked && value !== "flag" }))}
              />
            </div>
          )
        })}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div>
            <div className="text-sm font-medium text-foreground">Alerts</div>
            <p className="text-xs text-muted-foreground">Payment trouble, rejections and zero spend. Birdy only tells you.</p>
          </div>
          <span className="text-sm text-muted-foreground">Always Flag</span>
        </div>
        <dl className="grid gap-2 border-t pt-4 text-xs text-muted-foreground sm:grid-cols-3">
          {Object.entries(MODE_LABELS).map(([mode, text]) => (
            <div key={mode}>
              <dt className="font-medium text-foreground">{text}</dt>
              <dd>{MODE_HELP[mode]}</dd>
            </div>
          ))}
        </dl>
      </Frame>

      {anyAuto && (
        <Notice tone="warning" icon={TriangleAlert} title="Auto changes live Meta ads">
          Birdy will pause, add or turn on ads without asking first. Nothing is ever deleted in Meta, and you can undo a change for 24 hours.
        </Notice>
      )}

      {clients.length > 0 && (
        <Frame title="Different for one client" description="Leave a client on Default to follow the choices above." className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Client</th>
                {CHANGE_TYPES.map((t) => (
                  <th key={t.kind} className="px-3 py-2 font-medium">{t.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2 font-medium text-foreground">
                    {c.name}
                    {errors[c.id] && (
                      <p role="alert" className="mt-1 text-xs font-normal text-danger-ink">
                        {errors[c.id]}
                      </p>
                    )}
                  </td>
                  {CHANGE_TYPES.map(({ kind, label }) => {
                    const locked = kind === "add" && !addOn
                    const own = clientModes[c.id]?.[kind]
                    return (
                      <td key={kind} className="px-3 py-2">
                        <Select value={locked && own ? "flag" : (own ?? DEFAULT)} onValueChange={(m) => setClient(c.id, kind, m)}>
                          <SelectTrigger size="sm" aria-label={`${label} for ${c.name}`} className="w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={DEFAULT}>Default ({MODE_LABELS[shown(kind, modes[kind])]})</SelectItem>
                            {Object.entries(MODE_LABELS).map(([m, text]) => (
                              <SelectItem key={m} value={m} disabled={locked && m !== "flag"}>
                                {text}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Frame>
      )}
    </div>
  )
}
