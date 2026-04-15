/**
 * Parses AI message content to extract :::ui blocks.
 *
 * Input:  "Some text\n\n:::ui\n[{...}]\n:::\n\nMore text"
 * Output: { segments: [ {type:"text", content:"Some text"}, {type:"ui", fields:[...]}, {type:"text", content:"More text"} ] }
 */
export function parseChatUI(content) {
  if (!content || !content.includes(":::ui")) {
    return { segments: [{ type: "text", content }] }
  }

  const segments = []
  const regex = /:::ui\s*\n([\s\S]*?)\n:::/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    // Text before this UI block
    const textBefore = content.slice(lastIndex, match.index).trim()
    if (textBefore) {
      segments.push({ type: "text", content: textBefore })
    }

    // Parse the JSON inside the :::ui block
    try {
      const fields = JSON.parse(match[1])
      segments.push({ type: "ui", fields: Array.isArray(fields) ? fields : [fields] })
    } catch (e) {
      // If JSON parsing fails, treat it as text
      segments.push({ type: "text", content: match[0] })
    }

    lastIndex = match.index + match[0].length
  }

  // Text after the last UI block
  const textAfter = content.slice(lastIndex).trim()
  if (textAfter) {
    segments.push({ type: "text", content: textAfter })
  }

  return { segments }
}
