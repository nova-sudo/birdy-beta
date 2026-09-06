import Link from "next/link";
import { PhoneOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { LINK_SALES_TOOL_HREF } from "@/lib/call-centre-availability";

// ─── "Not available — no call centre" ───────────────────────────────────────
// The one treatment for a call-centre figure that has no source behind it,
// used everywhere such a figure is drawn: the Sales Hub, the Client Detail
// call tab, the Portfolio Dashboard's call insights and its funnel.
//
// It exists as one file because the alternative — a grey span written out
// wherever it was needed — is how a screen ends up with four different shades
// of "missing" and no way to tell them apart. There are three sizes of the
// same idea here and nothing else:
//
//   UnavailableValue    replaces a number inside a tile, stage or cell that
//                       another component owns. Every one of those renders its
//                       value as a child, so a node fits where a string went.
//   UnavailableNote     one line of explanation plus the CTA, for a card that
//                       still has its own heading above it.
//   CallCentreUnavailable
//                       the full panel, for a region whose entire contents are
//                       call-centre data — a chart, a table.
//
// The CTA always points at Settings → Integrations, which already owns the
// HotProspector connect dialog. A second "link a sales tool" flow invented for
// this state would be a second place for it to go wrong.

const CTA_LABEL = "Link a sales tool";

/**
 * The grey placeholder that stands in for a figure.
 *
 * An em dash rather than a "0" or the word "none": the codebase already uses
 * it for ratios with no denominator (see buildCallInsights), so it reads as
 * "not applicable" to anyone who has looked at this screen before. The reason
 * is not visible at a glance, so it is carried in the tooltip and in the
 * accessible name, and the card around it says it in words.
 *
 * @param {string} [reason] overrides the tooltip where a screen can be more
 *   specific than "no call centre" — a mixed portfolio, say.
 */
export function UnavailableValue({ reason = "No call-centre integration", className }) {
  return (
    <span
      className={cn("font-normal text-pd-chevron", className)}
      title={`Not available — ${reason.toLowerCase()}`}
    >
      <span aria-hidden="true">—</span>
      <span className="sr-only">Not available, {reason.toLowerCase()}</span>
    </span>
  );
}

/**
 * Swap the figure out of the rows a shared component is about to draw.
 *
 * StatTile and FunnelStepper both render their number as a child, so a node
 * goes where a string was and neither of them needs to learn what "no call
 * centre" means — which matters, because they are drawn on four screens and
 * only some of their rows are ever call-centre data.
 *
 * The delta goes with the number, and so does the share. A movement measured
 * against a period that was equally unmeasured is not a movement, and a
 * percentage of a cohort computed from a count nobody has is arithmetic
 * dressed as a fact.
 *
 * The tone goes too. Both components draw a tinted icon chip from it, and a
 * bright purple chip beside a grey dash reads as a live figure that happens to
 * be missing — the row has to dim as one thing. `neutral` is the tone for
 * "there is nothing here to colour-code"; see components/portfolio/tones.js.
 *
 * @param {object[]} rows stats or funnel stages, keyed by `key`
 * @param {object} opts
 * @param {string[]} opts.keys which rows have no source
 * @param {string} [opts.field] the property holding the figure — "value" for
 *   StatTile, "count" for FunnelStepper
 * @param {string} [opts.reason] tooltip wording, where a screen knows better
 * @param {boolean} [opts.when] false leaves every row exactly as it came in,
 *   so callers can pass this unconditionally rather than branching twice
 */
export function withUnavailable(rows, { keys, field = "value", reason, when = true } = {}) {
  if (!when || !keys?.length) return rows ?? [];
  const missing = new Set(keys);

  return (rows ?? []).map((row) => {
    if (!missing.has(row.key)) return row;
    const { share, direction, delta, estimated, ...rest } = row;
    return {
      ...rest,
      [field]: <UnavailableValue reason={reason} />,
      tone: "neutral",
      unavailable: true,
    };
  });
}

/** The CTA on its own, for a caller that has already said why. */
export function LinkSalesToolLink({ className }) {
  return (
    <Link
      href={LINK_SALES_TOOL_HREF}
      className={cn(
        "font-semibold text-pd-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary",
        className
      )}
    >
      {CTA_LABEL}
    </Link>
  );
}

/**
 * One grey line under a heading that is still true — "Call insights" is still
 * what the card is about, even when none of it can be filled in.
 */
export function UnavailableNote({
  body = "This client doesn't use a call centre, so there's nothing behind these figures.",
  className,
}) {
  return (
    <p className={cn("text-[12px] leading-[1.45] text-pd-faint", className)}>
      {body} <LinkSalesToolLink className="text-[12px]" />
    </p>
  );
}

/**
 * The whole region, where every part of it would have been call-centre data.
 *
 * Deliberately quiet — a dashed outline on the canvas rather than a warning
 * surface. Nothing has gone wrong here: the client said they don't call their
 * leads, and Birdy is agreeing with them.
 *
 * @param {string} [title]
 * @param {string} [body]
 */
export function CallCentreUnavailable({
  title = "Call centre not available",
  body = "This client doesn't currently call their leads, so there's no call data to show.",
  className,
}) {
  return (
    <section
      className={cn(
        "flex flex-col items-center justify-center rounded-[16px] border border-dashed border-pd-border-strong bg-pd-canvas px-6 py-10 text-center",
        className
      )}
    >
      <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-pd-neutral-badge text-pd-subtle">
        <PhoneOff className="size-[18px]" aria-hidden="true" />
      </span>
      <p className="font-pd-display text-[15px] font-semibold text-pd-subtle">{title}</p>
      <p className="mt-1.5 max-w-sm text-[12px] leading-[1.45] text-pd-faint">{body}</p>
      <LinkSalesToolLink className="mt-3 text-[12.5px]" />
    </section>
  );
}
