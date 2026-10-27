import { Zap, Check, Trash2, Clock, RotateCcw } from "lucide-react";

// The only kinds any feed surfaces: things that actually changed something.
// Analysis passes, freshly-created suggestions and untyped legacy rows are
// process noise and stay hidden everywhere.
export const FEED_KINDS = ["action_applied", "suggestion_dismissed"];

export const isFeedActivity = (a) => FEED_KINDS.includes(a?.kind);

// Icon + tone per activity kind, falling back to the actor when kind is absent.
function activityVisual(kind, isBirdy) {
  switch (kind) {
    case "analysis_pass":        return { Ico: Clock,  tone: "bg-pd-primary-tint text-pd-primary" };
    case "suggestion_created":   return { Ico: Zap,    tone: "bg-pd-primary-tint text-pd-primary" };
    case "action_applied":       return { Ico: Check,  tone: "bg-pd-success-bg text-pd-success" };
    case "suggestion_dismissed": return { Ico: Trash2, tone: "bg-pd-divider text-pd-subtle" };
    default:                     return isBirdy
      ? { Ico: Zap,   tone: "bg-pd-primary-tint text-pd-primary" }
      : { Ico: Check, tone: "bg-pd-success-bg text-pd-success" };
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
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
        <Ico className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-pd-ink leading-snug">{title}</p>
        <p className="text-xs text-pd-subtle">{client}</p>
        <p className="text-[10px] text-pd-faint mt-0.5">
          {caption} · {undone ? "undone" : time}
        </p>
      </div>

      {canUndo &&
        (undone ? (
          <span className="shrink-0 mt-0.5 text-[10px] font-medium text-pd-faint">Undone</span>
        ) : (
          <button
            onClick={onUndo}
            className="shrink-0 mt-0.5 inline-flex items-center gap-1 rounded-full text-[11px] font-semibold text-pd-primary transition-colors hover:text-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-pd-primary/40"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            Undo
          </button>
        ))}
    </div>
  );
}
