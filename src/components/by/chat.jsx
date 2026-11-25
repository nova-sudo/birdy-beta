import { BirdyAvatar } from "./avatar";
import { cn } from "./cn";

/** How an agent is titled over its replies: "Birdy | Agency Ops". Birdy itself stays "Birdy". */
export const agentTitle = (name) => (!name || /^Birdy\b/.test(name) ? name : `Birdy | ${name}`);

/**
 * The line over a reply: Birdy in its frame, who is speaking, and an optional note.
 * Every agent is Birdy, so the line reads "Birdy | <agent>".
 * @param {string} props.name the agent, e.g. "Agency Ops"; shown as "Birdy | Agency Ops"
 * @param {React.ReactNode} [props.note] e.g. the time, or the tools used
 * @param {React.ReactNode} [props.avatar] another agent's face (32px); Birdy in its frame when left out
 */
export function ChatSender({ name, note, avatar, className, ...props }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 font-by-body", className)} {...props}>
      {avatar ?? <BirdyAvatar size={32} />}
      <b className="font-by-display text-by-body-lg font-semibold text-by-text">{agentTitle(name)}</b>
      {note && <span className="text-by-body-sm text-by-muted">{note}</span>}
    </div>
  );
}

/** What the person wrote: a purple bubble on the right, so it never blends into the page. */
export function UserMessage({ className, children, ...props }) {
  return (
    <div className={cn("flex justify-end motion-safe:animate-[by-enter_var(--by-dur-base)_var(--by-ease-out)]", className)} {...props}>
      <div className="max-w-[85%] whitespace-pre-wrap rounded-by-xl bg-by-accent px-4 py-2.5 font-by-body text-by-body-lg text-by-on-accent shadow-by-card selection:bg-by-on-accent selection:text-by-accent">{children}</div>
    </div>
  );
}

/** Three dots while a reply is being written. */
export function ChatTyping({ label = "Replying", className, ...props }) {
  return (
    <span role="status" aria-label={label} className={cn("inline-flex h-6 items-center gap-1", className)} {...props}>
      {[0, 1, 2].map((i) => (
        <i key={i} aria-hidden="true" className="size-1.5 rounded-full bg-by-muted motion-safe:animate-[by-typing_1.2s_ease-in-out_infinite]" style={{ animationDelay: `${i * 160}ms` }} />
      ))}
    </span>
  );
}
