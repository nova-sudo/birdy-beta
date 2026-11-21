"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { BirdyAvatar } from "./avatar";
import { Button } from "./button";
import { cn } from "./cn";

/**
 * The conversation column that opens beside a page once a question is sent
 * from its ask bar. The page narrows to make room; closing gives the room back.
 * It follows the newest message.
 *
 * @param {string} props.title who is answering, e.g. "Birdy"
 * @param {() => void} props.onClose
 * @param {React.ReactNode} [props.actions] sits before the close button, e.g. "Open in Chat"
 * @param {number|string} [props.follow] changes whenever a message arrives, so the column scrolls to it
 * @param {React.ReactNode} [props.footer] pinned under the messages
 */
export function AskPanel({ title, onClose, actions, follow, footer, className, children, ...props }) {
  const body = useRef(null);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo?.({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, [follow]);

  return (
    <section
      role="complementary"
      aria-label={`${title} conversation`}
      className={cn(
        "flex w-[min(420px,42vw)] shrink-0 flex-col border-l border-by-line bg-by-surface font-by-body text-by-body text-by-text",
        "motion-safe:animate-[by-panel_var(--by-dur-base)_var(--by-ease-out)]",
        className,
      )}
      {...props}
    >
      <header className="flex shrink-0 items-center gap-2.5 border-b border-by-line px-4 py-3">
        <BirdyAvatar size={32} />
        <h2 className="min-w-0 flex-1 truncate font-by-display text-by-body-lg font-semibold">{title}</h2>
        {actions}
        <Button kind="ghost" size="sm" iconOnly aria-label="Close conversation" onClick={onClose}><X aria-hidden="true" /></Button>
      </header>
      <div ref={body} aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
      {footer && <div className="shrink-0 border-t border-by-line px-4 py-3">{footer}</div>}
    </section>
  );
}
