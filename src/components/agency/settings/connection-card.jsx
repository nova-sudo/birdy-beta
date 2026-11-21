"use client";

// One connection on Settings › Connections: its mark, name and state, a few
// key/value lines, and its actions. Plus the confirm-before-removing dialog
// every card shares.

import { useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { Button, Card, Dialog, DialogBody, DialogContent, DialogFooter, Pill, cn } from "@/components/by";

const STATE_PILL = {
  checking: ["neutral", "Checking…"],
  connected: ["success", "Connected"],
  expired: ["warning", "Expired"],
  disconnected: ["neutral", "Not connected"],
};

/**
 * @param {string} props.name
 * @param {string} props.mark one or two letters in the coloured tile
 * @param {string} props.markClass the tile's colour pair, e.g. "bg-by-buyer-bg text-by-buyer"
 * @param {string} props.what what the connection brings in, one line
 * @param {"checking"|"connected"|"expired"|"disconnected"} props.state
 * @param {[string, React.ReactNode][]} [props.meta] key/value lines under the name
 * @param {React.ReactNode} [props.warning] a line in the warning colour, e.g. why it needs reconnecting
 * @param {React.ReactNode} [props.children] extra controls above the actions (Slack's channel)
 * @param {React.ReactNode} [props.actions] the buttons on the left of the action row
 * @param {React.ReactNode} [props.remove] the Remove control, pushed to the right
 * @param {{href: string, label: string}} [props.site] the provider's own site
 */
export function ConnectionCard({ name, mark, markClass, what, state, meta = [], warning, children, actions, remove, site }) {
  const [tone, word] = STATE_PILL[state] ?? STATE_PILL.disconnected;
  return (
    <Card padded className={cn("flex min-w-0 flex-col gap-3.5", state === "expired" && "border-by-warning-solid/50")}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={cn("grid size-10 shrink-0 place-items-center rounded-by-lg font-by-display text-by-body-lg font-extrabold", markClass)}>{mark}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-by-display text-by-body font-bold">{name}</h3>
            <Pill tone={tone}>{word}</Pill>
          </div>
          <p className="truncate text-by-caption text-by-muted">{what}</p>
        </div>
      </div>
      {meta.length > 0 && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-1 text-by-caption text-by-text-2">
          {meta.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-by-muted">{k}</dt>
              <dd className="min-w-0 truncate">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {warning && <p className="text-by-caption font-semibold text-by-warning">{warning}</p>}
      {children}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        {actions}
        {site && (
          <a href={site.href} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-by-md px-1.5 text-by-body-sm font-semibold text-by-text-2 hover:text-by-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent [&_svg]:size-3.5">
            {site.label}
            <ExternalLink aria-hidden="true" />
          </a>
        )}
        {remove && <span className="ml-auto">{remove}</span>}
      </div>
    </Card>
  );
}

/**
 * Remove, behind a confirmation: removing deletes the stored credentials.
 * @param {string} props.label the connection's name in the dialog
 * @param {boolean} props.removing
 * @param {() => void} props.onConfirm
 */
export function RemoveConnection({ label, removing, onConfirm }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button kind="ghost" size="sm" loading={removing} onClick={() => setOpen(true)} aria-label={`Remove ${label}`}>
        {!removing && <Trash2 aria-hidden="true" />}
        {removing ? "Removing…" : "Remove"}
      </Button>
      <DialogContent title={`Remove ${label}?`}>
        <DialogBody>
          <p className="text-by-body text-by-text-2">
            This will permanently delete your {label} credentials from Birdy. You will need to reconnect if you want to use this integration again. Client groups linked to this integration will lose their data source.
          </p>
        </DialogBody>
        <DialogFooter className="justify-end">
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            kind="danger"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Yes, remove it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
