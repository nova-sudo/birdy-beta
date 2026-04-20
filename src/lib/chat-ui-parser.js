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
 * Robust against the AI emitting malformed blocks. It handles all of:
 *   :::chart\n{...}\n:::          (canonical multi-line)
 *   :::chart {...}:::             (inline)
 *   :::chart {...}                (NO closing fence — AI forgets it sometimes)
 *   :::chart\n[...]\n             (no closing fence, array payload)
 *
 * The parser walks each `:::<type>` occurrence and finds the end of the
 * block by JSON-aware balanced-brace scanning, not by requiring a `:::`
 * terminator. This means a chart block still renders even if the model
 * dropped the closing fence.
 */

const BLOCK_TYPES = ["ui", "metric", "chart", "status", "stats"]

/**
 * Starting at `str[from]`, advance past whitespace. Return the new index.
 */
function _skipWhitespace(str, from) {
  while (from < str.length && /\s/.test(str[from])) from++
  return from
}

/**
 * JSON-aware matching: find the index of the character AFTER the balanced
 * JSON value that starts at `str[start]` (which must be `{` or `[`).
 * Respects string literals including escaped quotes.
 * Returns -1 if no balanced close is found.
 */
function _findJsonEnd(str, start) {
  const openCh = str[start]
  if (openCh !== "{" && openCh !== "[") return -1
  const closeCh = openCh === "{" ? "}" : "]"
  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < str.length; i++) {
    const ch = str[i]
    if (escape) { escape = false; continue }
    if (inString) {
      if (ch === "\\") { escape = true; continue }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === openCh) depth++
    else if (ch === closeCh) {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return -1
}

/**
 * Try to extract a block starting at the index of `:::`.
 * Returns {type, payload, endIdx} on success, or null.
 */
function _tryExtractBlock(content, fenceIdx) {
  // Match `:::<type>\b`
  const remaining = content.slice(fenceIdx + 3)
  const typeMatch = /^(ui|metric|chart|status|stats)\b/.exec(remaining)
  if (!typeMatch) return null
  const blockType = typeMatch[1]

  // Skip whitespace after the type
  let i = fenceIdx + 3 + typeMatch[0].length
  i = _skipWhitespace(content, i)

  // Payload must start with `{` or `[`
  if (content[i] !== "{" && content[i] !== "[") return null

  const jsonEnd = _findJsonEnd(content, i)
  if (jsonEnd === -1) return null

  const rawPayload = content.slice(i, jsonEnd)

  let parsed
  try {
    parsed = JSON.parse(rawPayload)
  } catch {
    return null
  }

  // Consume an optional trailing `:::` fence (with optional whitespace before it)
  let after = _skipWhitespace(content, jsonEnd)
  if (content.slice(after, after + 3) === ":::") after += 3

  return { type: blockType, payload: parsed, endIdx: after }
}

export function parseChatUI(content) {
  if (!content || typeof content !== "string") {
    return { segments: [{ type: "text", content: content || "" }] }
  }
  if (!BLOCK_TYPES.some(t => content.includes(`:::${t}`))) {
    return { segments: [{ type: "text", content }] }
  }

  const segments = []
  let cursor = 0

  while (cursor < content.length) {
    const fenceIdx = content.indexOf(":::", cursor)
    if (fenceIdx === -1) break

    const block = _tryExtractBlock(content, fenceIdx)
    if (!block) {
      // Not a recognised block at this `:::` — skip past it and keep looking
      cursor = fenceIdx + 3
      continue
    }

    // Emit any text between the last cursor and this block
    const textBefore = content.slice(cursor, fenceIdx).trim()
    if (textBefore) segments.push({ type: "text", content: textBefore })

    if (block.type === "ui") {
      segments.push({
        type: "ui",
        fields: Array.isArray(block.payload) ? block.payload : [block.payload],
      })
    } else {
      segments.push({ type: block.type, payload: block.payload })
    }

    cursor = block.endIdx
  }

  // Trailing text
  const trailing = content.slice(cursor).trim()
  if (trailing) segments.push({ type: "text", content: trailing })

  // If we found no blocks, just return the original content as a single text segment
  if (segments.length === 0) {
    return { segments: [{ type: "text", content }] }
  }

  return { segments }
}
