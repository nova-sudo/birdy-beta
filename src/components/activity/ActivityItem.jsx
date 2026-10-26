import { Zap, Check, Trash2, Clock, RotateCcw } from "lucide-react";

// The only kinds any feed surfaces: things that actually changed something.
// Analysis passes, freshly-created suggestions and untyped legacy rows are
// process noise and stay hidden everywhere.
export const FEED_KINDS = ["action_applied", "suggestion_dismissed"];

export const isFeedActivity = (a) => FEED_KINDS.includes(a?.kind);

// Icon + tone per activity kind, falling back to the actor when kind is absent.
function activityVisual(kind, isBirdy) {
  switch (kind) {
    case "analysis_pass":        return { Ico: Clock,  tone: "bg-primary-soft text-primary" };
    case "suggestion_created":   return { Ico: Zap,    tone: "bg-primary-soft text-primary" };
    case "action_applied":       return { Ico: Check,  tone: "bg-success-soft text-success-ink" };
    case "suggestion_dismissed": return { Ico: Trash2, tone: "bg-neutral-soft text-neutral-ink" };
    default:                     return isBirdy
      ? { Ico: Zap,   tone: "bg-primary-soft text-primary" }
      : { Ico: Check, tone: "bg-success-soft text-success-ink" };
  }
}

// This is the "Completed today" surface: applied "Do it for me" actions land here
// with a persistent Undo (the single undo surface, alongside the transient toast).
// `reversible`/`undone`/`onUndo` are only sent for those applied actions; every
// other activity row renders exactly as before.
export function ActivityItem({ actor, kind, title, client, time, label, reversible, undone, onUndo }) {
  const isBirdy = actor === "birdy";
  const caption = label || (isBirdy ? "Auto-run by Birdy" : "Approved by you");
  const { Ico, tone } = activityVisual(kind, isBirdy);
  const canUndo = reversible && kind === "action_applied";

  return (
    <div className="flex items-start gap-3">
      <div className={`size-7 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
        <Ico className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground leading-snug">{title}</p>
        <p className="text-xs text-muted-foreground">{client}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {caption} · {undone ? "undone" : time}
        </p>
      </div>

      {canUndo &&
        (undone ? (
          <span className="shrink-0 mt-0.5 text-xs font-medium text-muted-foreground">Undone</span>
        ) : (
          <button
            onClick={onUndo}
            className="shrink-0 mt-0.5 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary outline-none transition-colors hover:underline focus-visible:shadow-control-focus"
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            Undo
          </button>
        ))}
    </div>
  );
}
