import { Zap, Check, Trash2, Clock, RotateCcw } from "lucide-react";

// Icon + tone per activity kind, falling back to the actor when kind is absent
// (the bundled mock activity has only actor/title/client/time).
function activityVisual(kind, isBirdy) {
  switch (kind) {
    case "analysis_pass":        return { Ico: Clock,  tone: "bg-purple-100 text-purple-600" };
    case "suggestion_created":   return { Ico: Zap,    tone: "bg-purple-100 text-purple-600" };
    case "action_applied":       return { Ico: Check,  tone: "bg-green-100 text-green-600" };
    case "suggestion_dismissed": return { Ico: Trash2, tone: "bg-muted text-muted-foreground" };
    default:                     return isBirdy
      ? { Ico: Zap,   tone: "bg-purple-100 text-purple-600" }
      : { Ico: Check, tone: "bg-green-100 text-green-600" };
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
        <p className="text-xs font-semibold text-foreground leading-snug">{title}</p>
        <p className="text-xs text-muted-foreground">{client}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
          {caption} · {undone ? "undone" : time}
        </p>
      </div>

      {canUndo &&
        (undone ? (
          <span className="shrink-0 mt-0.5 text-[10px] font-medium text-muted-foreground/70">Undone</span>
        ) : (
          <button
            onClick={onUndo}
            className="shrink-0 mt-0.5 inline-flex items-center gap-1 rounded text-[11px] font-semibold text-purple-600 transition-colors hover:text-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            Undo
          </button>
        ))}
    </div>
  );
}
