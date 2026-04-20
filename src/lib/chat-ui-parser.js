/**
 * Parses AI message content to extract structured fenced blocks.
 *
 * Recognised block types:
 *   :::ui       — interactive form fields  (payload: array of field specs)
 *   :::metric   — single headline KPI card
 *   :::chart    — inline bar/line/donut chart
 *   :::status   — colored status badge
 *   :::stats    — compact multi-KPI grid
 *
 * Everything else is returned as {type: "text"} segments so plain markdown
 * keeps rendering exactly as before. Unknown block types are rendered
 * as their raw text to stay forward-compatible.
 */

const BLOCK_TYPES = ["ui", "metric", "chart", "status", "stats"]
const BLOCK_REGEX = new RegExp(`:::(${BLOCK_TYPES.join("|")})\\s*\\n([\\s\\S]*?)\\n:::`, "g")


export function parseChatUI(content) {
  if (!content || !BLOCK_TYPES.some(t => content.includes(`:::${t}`))) {
    return { segments: [{ type: "text", content }] }
  }

  const segments = []
  let lastIndex = 0
  let match

  // Reset lastIndex because we use the global regex
  BLOCK_REGEX.lastIndex = 0

  while ((match = BLOCK_REGEX.exec(content)) !== null) {
    // Text before this block
    const textBefore = content.slice(lastIndex, match.index).trim()
    if (textBefore) {
      segments.push({ type: "text", content: textBefore })
    }

    const blockType = match[1]
    const rawPayload = match[2]

    try {
      const parsed = JSON.parse(rawPayload)
      if (blockType === "ui") {
        segments.push({ type: "ui", fields: Array.isArray(parsed) ? parsed : [parsed] })
      } else {
        segments.push({ type: blockType, payload: parsed })
      }
    } catch (e) {
      // Malformed JSON — fall back to showing the raw block as text
      segments.push({ type: "text", content: match[0] })
    }

    lastIndex = match.index + match[0].length
  }

  // Text after the last block
  const textAfter = content.slice(lastIndex).trim()
  if (textAfter) {
    segments.push({ type: "text", content: textAfter })
  }

  return { segments }
}
