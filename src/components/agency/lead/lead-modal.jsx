"use client";

// A lead opened from a Leads table: centred over the table, the page dimmed
// behind it. The same view as the lead's own page (header, Call / Message, the
// tiles, Profile / Journey / Calls / Ads, the conversation), with "Open full page"
// and × in its top strip. Radix keeps focus inside, closes it on Escape and the
// backdrop, and gives focus back to the row that opened it. Its body scrolls,
// never the page. On a phone it is a full-screen sheet.

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ExternalLink, X } from "lucide-react";
import { Button, cn } from "@/components/by";
import { LeadView } from "./lead-view";

export const leadHref = (contactId) => `/contacts/${encodeURIComponent(contactId)}`;

/**
 * @param {string|null} props.contactId the lead to show; null keeps the modal shut
 * @param {string} [props.name] the lead's name as the row shows it, for the dialog's accessible name
 * @param {() => void} props.onClose
 */
export function LeadModal({ contactId, name, onClose }) {
  // Radix only hands focus back to its own Trigger; a row or a name opens this, so remember it here.
  const opener = useRef(null);
  const isOpen = Boolean(contactId);
  useLayoutEffect(() => {
    if (isOpen) opener.current = document.activeElement;
  }, [isOpen]);
  const giveFocusBack = (e) => {
    e.preventDefault();
    const el = opener.current;
    opener.current = null;
    if (el?.isConnected) el.focus({ preventScroll: true });
  };
  return (
    <DialogPrimitive.Root open={Boolean(contactId)} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-by-text/30 backdrop-blur-[6px] motion-safe:animate-[by-fade_var(--by-dur-fast)_var(--by-ease-out)]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={giveFocusBack}
          className={cn(
            "fixed inset-0 z-50 flex flex-col overflow-hidden bg-by-canvas font-by-body text-by-body text-by-text outline-none",
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(88vh,56rem)] sm:w-[min(70rem,94vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-by-xl sm:border sm:border-by-line sm:shadow-by-dialog",
            "motion-safe:animate-[by-dialog_var(--by-dur-base)_var(--by-ease-spring)]",
          )}
        >
          <DialogPrimitive.Title className="sr-only">{name ? `Lead: ${name}` : "Lead"}</DialogPrimitive.Title>
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-by-line bg-by-surface pr-2.5 pl-5">
            {contactId && (
              <Link href={leadHref(contactId)} onClick={onClose} className="mr-auto inline-flex items-center gap-1.5 text-by-body-sm font-semibold text-by-accent hover:underline">
                Open full page<ExternalLink aria-hidden="true" className="size-3.5" />
              </Link>
            )}
            <DialogPrimitive.Close asChild>
              <Button kind="ghost" size="sm" iconOnly aria-label="Close" title="Close (Esc)"><X aria-hidden="true" /></Button>
            </DialogPrimitive.Close>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {contactId && <LeadView key={contactId} contactId={contactId} embed />}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
