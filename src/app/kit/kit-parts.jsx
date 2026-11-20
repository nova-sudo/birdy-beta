// Layout pieces shared by the /kit preview pages. Preview-only: not part of the kit.

/** A titled block of the preview page. */
export function Section({ title, children }) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 border-b border-by-line pb-2 font-by-display text-by-title font-semibold tracking-[-0.01em]">{title}</h2>
      {children}
    </section>
  );
}

/** A labelled group inside a Section. */
export function Sub({ title, children }) {
  return (
    <div className="mt-5 first:mt-0">
      <h3 className="mb-2 text-by-body-sm font-semibold text-by-text-2">{title}</h3>
      {children}
    </div>
  );
}

/** One labelled row of examples, such as a component's states. */
export function Row({ label, children }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-24 shrink-0 text-by-caption text-by-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
