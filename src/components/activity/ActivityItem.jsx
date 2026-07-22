import { Zap, Check, Trash2, Clock } from "lucide-react";

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

export function ActivityItem({ actor, kind, title, client, time, label }) {
  const isBirdy = actor === "birdy";
  const caption = label || (isBirdy ? "Auto-run by Birdy" : "Approved by you");
  const { Ico, tone } = activityVisual(kind, isBirdy);
  return (
    <div className="flex items-start gap-3">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
        <Ico className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground leading-snug">{title}</p>
        <p className="text-xs text-muted-foreground">{client}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
          {caption} · {time}
        </p>
      </div>
    </div>
  );
}
