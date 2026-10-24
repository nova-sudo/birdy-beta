/**
 * Shared ReactMarkdown component overrides for chat messages.
 * Used by MessageBubble so all three chat surfaces render markdown identically.
 */
"use client"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// Heuristic: does a "code block" content actually look like markdown that
// the model accidentally wrapped in triple backticks?  We check for common
// markdown constructs and NO code-like syntax (semicolons, braces, etc.).
function _looksLikeMarkdown(s) {
  if (!s || typeof s !== "string") return false
  const text = s.trim()
  if (!text) return false
  // Obvious markdown signals
  const mdSignal =
    /^#{1,6}\s/m.test(text) ||           // headers
    /^\s*[-*+]\s+\*\*/m.test(text) ||    // bulleted bold items
    /^\s*\d+\.\s+\*\*/m.test(text) ||    // numbered bold items
    /\*\*[^*\n]+\*\*/.test(text)         // inline bold
  if (!mdSignal) return false
  // Code-like signals (skip the heuristic if present)
  const codeSignal =
    /[{};]$/m.test(text) ||
    /=>|==|!=|&&|\|\|/.test(text) ||
    /^\s*(import|const|let|var|function|class|def|return)\b/m.test(text)
  return !codeSignal
}

export const mdComponents = {
  h1: ({ children }) => <h1 className="text-lg font-semibold tracking-[-0.01em] text-foreground mt-4 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-semibold text-foreground mt-4 mb-1.5">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-3 mb-1">{children}</h3>,
  p: ({ children }) => <p className="text-sm leading-relaxed my-1.5">{children}</p>,
  ul: ({ children }) => <ul className="text-sm list-disc ml-5 my-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="text-sm list-decimal ml-5 my-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-3 rounded-surface shadow-surface">
      <table className="min-w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
  tr: ({ children }) => <tr className="border-b border-border last:border-0">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="num px-3 py-2 text-xs">{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary bg-primary-soft pl-4 py-2 my-3 rounded-r-control text-sm text-body">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-border/40" />,
  a: ({ href, children }) => (
    <a href={href} className="text-primary font-medium underline decoration-primary/30 underline-offset-2 hover:decoration-primary transition" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  // Override `pre` so we can detect & rescue markdown-in-fence at the wrapper
  // level. The default react-markdown output for fenced blocks is
  //   <pre><code class="language-xxx">…</code></pre>
  // If that inner content looks like prose-markdown we want to escape the
  // <pre> wrapper entirely (otherwise font-family: monospace + white-space:
  // pre make everything look like a terminal dump).
  pre: ({ children }) => {
    // children is (usually) a single <code> React element
    const child = Array.isArray(children) ? children[0] : children
    const childProps = (child && child.props) || {}
    const className = childProps.className || ""
    const rawChildren = childProps.children
    const raw = Array.isArray(rawChildren) ? rawChildren.join("") : String(rawChildren || "")

    const langMatch = /language-(\w+)/.exec(className)
    const lang = langMatch ? langMatch[1].toLowerCase() : ""
    const isMarkdownLang = lang === "markdown" || lang === "md"

    if (isMarkdownLang || (!lang && _looksLikeMarkdown(raw))) {
      // Render AS markdown, not as a code block
      return (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
          {raw}
        </ReactMarkdown>
      )
    }

    return (
      <pre className="my-3 p-3.5 rounded-surface bg-foreground text-background font-mono text-xs overflow-x-auto">
        {children}
      </pre>
    )
  },
  code: ({ inline, children, className }) => {
    // Inline code (single backticks)
    if (inline) {
      return <code className="px-1 py-0.5 rounded-sm bg-primary-soft text-primary text-[0.85em] font-mono">{children}</code>
    }
    // Fenced code — styling comes from our `pre` override; just render the <code>
    return <code className={className}>{children}</code>
  },
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
}
