"use client"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { mdComponents } from "@/lib/chat-markdown"

/**
 * dashkit's Markdown slot (used by the text widget), rendered with the same
 * element styling chat messages use so prose looks identical across the app.
 */
export function PdMarkdown({ children }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {children}
    </ReactMarkdown>
  )
}
