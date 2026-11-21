"use client";

import { useState } from "react";
import { Button, Card, Notice, cn } from "@/components/by";

/** What a refusal says, in words the owner can act on. */
export function saveError(err) {
  if (err?.status === 409) return err.message && !err.message.startsWith("HTTP") ? err.message : "Answer the questions in order: this one comes later.";
  if (err?.message && !err.message.startsWith("HTTP")) return err.message;
  return "Couldn’t save that. Check your connection and try again.";
}

/**
 * Runs a save, keeping its busy state and what went wrong.
 * @param {(body: object) => Promise<unknown>} onSubmit
 */
export function useSave(onSubmit) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = async (body) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(body);
    } catch (err) {
      setError(saveError(err));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

/**
 * The card a step's form sits in, under the agent's question.
 * @param {string} props.label read as the form's name
 * @param {React.ReactNode} [props.actions] the buttons; a single Save when left out
 */
export function FormShell({ label, error, busy, onSave, saveLabel = "Save", actions, className, children }) {
  return (
    <Card
      role="form"
      aria-label={label}
      className={cn("flex flex-col gap-3.5 p-4", className)}
      onKeyDown={(e) => {
        // Enter in a text box saves, like a form.
        if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox" && onSave) {
          e.preventDefault();
          onSave();
        }
      }}
    >
      {children}
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="flex flex-wrap items-center gap-2">
        {actions ?? <Button kind="primary" loading={busy} onClick={onSave}>{saveLabel}</Button>}
      </div>
    </Card>
  );
}
