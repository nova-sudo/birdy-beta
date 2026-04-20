/**
 * Shared ReactMarkdown component overrides for chat messages.
 * Used by MessageBubble so all three chat surfaces render markdown identically.
 */
"use client"

export const mdComponents = {
  h1: ({ children }) => <h1 className="text-base font-semibold mt-3 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-semibold mt-3 mb-1.5 text-foreground/90">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-medium mt-2 mb-1 text-foreground/80">{children}</h3>,
  p: ({ children }) => <p className="text-sm leading-relaxed my-1.5">{children}</p>,
  ul: ({ children }) => <ul className="text-sm list-disc ml-5 my-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="text-sm list-decimal ml-5 my-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-3 rounded-lg border border-border/40">
      <table className="min-w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/40">{children}</thead>,
  tr: ({ children }) => <tr className="border-b border-border/30 last:border-0">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-3 py-2 text-xs tabular-nums">{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-purple-400 bg-purple-50/50 pl-4 py-2 my-3 rounded-r-md text-sm italic text-foreground/80">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-border/40" />,
  a: ({ href, children }) => (
    <a href={href} className="text-purple-600 underline decoration-purple-300 hover:decoration-purple-600 transition" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="px-1 py-0.5 rounded bg-muted/60 text-[0.85em] font-mono">{children}</code>
    ) : (
      <pre className="my-3 p-3 rounded-lg bg-slate-900 text-slate-100 text-xs overflow-x-auto">
        <code>{children}</code>
      </pre>
    ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
}
