"use client";

import { useState } from "react";
import Link from "next/link";
import { PhoneOff } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button, EmptyState, Surface } from "@/components/ds";
import { LINK_SALES_TOOL_HREF } from "@/lib/call-centre-availability";
import { apiRequest } from "@/lib/api";
import { useHotProspectorConnected } from "@/lib/useHotProspectorConnected";

// ─── "Not available — no call centre" ───────────────────────────────────────
// The one treatment for a call-centre figure that has no source behind it,
// used where such a figure is drawn: the Sales Hub and the Client Detail call
// tab. There are two sizes of the same idea here:
//
//   UnavailableValue    replaces a number inside a tile that another component
//                       owns. Those render their value as a child, so a node
//                       fits where a string went.
//   CallCentreUnavailable
//                       the full panel, for a region whose entire contents are
//                       call-centre data: a chart, a table.
//
// The CTA always points at Settings → Integrations, which already owns the
// HotProspector connect dialog. A second "link a sales tool" flow invented for
// this state would be a second place for it to go wrong.

const CTA_LABEL = "Link a sales tool";

/**
 * The grey placeholder that stands in for a figure.
 *
 * An em dash rather than a "0" or the word "none": the codebase already uses
 * it for ratios with no denominator, so it reads as "not applicable". The
 * reason is carried in the tooltip and the accessible name, and the panel
 * beside it says it in words.
 *
 * @param {string} [reason] overrides the tooltip where a screen can be more
 *   specific than "no call centre"
 */
export function UnavailableValue({ reason = "No call-centre integration", className }) {
  return (
    <span
      className={cn("font-normal text-muted-foreground", className)}
      title={`Not available — ${reason.toLowerCase()}`}
    >
      <span aria-hidden="true">—</span>
      <span className="sr-only">Not available, {reason.toLowerCase()}</span>
    </span>
  );
}

/** The CTA on its own, for a caller that has already said why. */
export function LinkSalesToolLink({ className }) {
  return (
    <Button asChild size="sm" className={className}>
      <Link href={LINK_SALES_TOOL_HREF}>{CTA_LABEL}</Link>
    </Button>
  );
}

/**
 * With HotProspector connected, "link a sales tool" is a dead end: it is
 * linked. What is missing is the client's own setting, chosen once when the
 * client was created — "none" for every client imported before HotProspector
 * was connected. This switches the clients in view over in one step; the
 * hp-tick cron then pulls their call history within minutes.
 */
export function UseHotProspectorButton({ groupIds, onSwitched, className }) {
  const [saving, setSaving] = useState(false);
  const count = groupIds?.length ?? 0;
  if (!count) return null;

  const label = count === 1
    ? "Use HotProspector for this client"
    : `Use HotProspector for these ${count} clients`;

  const switchOver = async () => {
    setSaving(true);
    try {
      const res = await apiRequest("/api/client-groups/call-log-provider", {
        method: "PATCH",
        body: JSON.stringify({ group_ids: groupIds, provider: "hotprospector" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Couldn't switch the call centre");
      }
      toast.success("Switched to HotProspector", {
        description: "Call history is being pulled in now — it can take a few minutes to appear.",
      });
      if (onSwitched) onSwitched();
      else window.location.reload();
    } catch (e) {
      toast.error("Couldn't switch to HotProspector", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button
      type="button"
      variant="primary"
      size="sm"
      onClick={switchOver}
      loading={saving}
      className={className}
    >
      {label}
    </Button>
  );
}

/**
 * The whole region, where every part of it would have been call-centre data.
 *
 * Deliberately quiet: nothing has gone wrong here. The client said they don't
 * call their leads, and Birdy is agreeing with them.
 *
 * @param {string} [title]
 * @param {string} [body]
 */
export function CallCentreUnavailable({
  title = "Call centre not available",
  body = "This client doesn't currently call their leads, so there's no call data to show.",
  groupIds,
  onSwitched,
  className,
}) {
  const hpConnected = useHotProspectorConnected();
  const canSwitch = hpConnected && (groupIds?.length ?? 0) > 0;

  return (
    <Surface className={className}>
      <EmptyState
        icon={PhoneOff}
        title={title}
        description={
          canSwitch ? "HotProspector is connected, but this is still set to no call centre." : body
        }
        action={
          canSwitch ? (
            <UseHotProspectorButton groupIds={groupIds} onSwitched={onSwitched} />
          ) : (
            <LinkSalesToolLink />
          )
        }
      />
    </Surface>
  );
}
