import { cn } from "@/components/by";

// An AI app's small tile (Claude, ChatGPT, Cursor...), in the kit's tones
// rather than the apps' brand colours.
const APPS = [
  { match: /claude/i, text: "C", tone: "bg-by-warning-bg text-by-warning" },
  { match: /chatgpt|openai/i, text: "G", tone: "bg-by-success-bg text-by-success" },
  { match: /cursor/i, text: "Cu", tone: "bg-by-text text-by-surface" },
];

/** @param {string} props.name the app's name */
export function AppTile({ name, className }) {
  const known = APPS.find((a) => a.match.test(name || ""));
  const text = known?.text || (name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span aria-hidden="true" className={cn("grid size-6.5 flex-none place-items-center rounded-by-sm font-by-body text-by-caption font-bold", known?.tone || "bg-by-accent-soft text-by-accent", className)}>
      {text}
    </span>
  );
}
