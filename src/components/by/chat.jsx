import { BirdyAvatar } from "./avatar";
import { cn } from "./cn";

/**
 * The line over a reply: Birdy in its frame, who is speaking, and an optional note.
 * @param {string} props.name e.g. "Agency Ops"
 * @param {React.ReactNode} [props.note] e.g. the time, or the tools used
 */
export function ChatSender({ name, note, className, ...props }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 font-by-body", className)} {...props}>
      <BirdyAvatar size={32} />
      <b className="font-by-display text-by-body-lg font-semibold text-by-text">{name}</b>
      {note && <span className="text-by-body-sm text-by-muted">{note}</span>}
    </div>
  );
}

/** What the person wrote: a soft bubble on the right. */
export function UserMessage({ className, children, ...props }) {
  return (
    <div className={cn("flex justify-end motion-safe:animate-[by-enter_var(--by-dur-base)_var(--by-ease-out)]", className)} {...props}>
      <div className="max-w-[85%] whitespace-pre-wrap rounded-by-xl bg-by-sunken px-4 py-2.5 font-by-body text-by-body-lg text-by-text">{children}</div>
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
