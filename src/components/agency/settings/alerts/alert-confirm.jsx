"use client";

// The three small dialogs: delete a rule, clear one client's fired entry, and
// snooze a rule or one client. Each writes only on its confirm button.

import { useState } from "react";
import { BellOff, Trash2 } from "lucide-react";
import { Button, Dialog, DialogBody, DialogContent, DialogFooter, SelectField } from "@/components/by";
import { SNOOZE_OPTIONS } from "@/lib/alert-helpers";

/**
 * @param {string} props.title
 * @param {React.ReactNode} props.children what will happen
 * @param {string} props.confirm the button's words
 * @param {() => Promise<boolean>} props.onConfirm
 * @param {() => void} props.onClose
 */
export function ConfirmDialog({ title, children, confirm, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const ok = await onConfirm();
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent title={title}>
        <DialogBody><p className="text-by-body text-by-text-2">{children}</p></DialogBody>
        <DialogFooter className="justify-end">
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button kind="danger" loading={busy} onClick={go}><Trash2 aria-hidden="true" />{confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * @param {object} props.target a rule, or a fanned-out client row (`_virtual`)
 * @param {(target: object, hours: number) => Promise<boolean>} props.onSnooze
 * @param {() => void} props.onClose
 */
export function SnoozeDialog({ target, onSnooze, onClose }) {
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const client = !!target._virtual;
  const go = async () => {
    setBusy(true);
    const ok = await onSnooze(target, hours);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent title={client ? "Snooze this client" : "Snooze alert"} description={client ? `Birdy stops telling you about ${target._client_name} for this alert.` : `Birdy stops checking “${target.name}” for a while.`}>
        <DialogBody>
          <SelectField label="Snooze for" value={String(hours)} onValueChange={(v) => setHours(Number(v))} options={SNOOZE_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))} />
        </DialogBody>
        <DialogFooter className="justify-end">
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button kind="primary" loading={busy} onClick={go}><BellOff aria-hidden="true" />Snooze</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
