// Helpers for the Slack report copilot (components/report-designer). The
// template itself is designed and validated server-side
// (birdy-backend/services/report_template.py); the UI only shows it.

import { apiRequest } from "@/lib/api"

export const REPORT_PAGE = "report_designer"

// Sent on the user's behalf to start the conversation; hidden in the transcript.
export const REPORT_OPENER = "Help me design my Slack report."

/** "Daily at 9:00 AM · covers yesterday" */
export function scheduleLabel(template) {
  if (!template?.frequency) return ""
  if (template.frequency === "weekly") {
    return `Every ${template.day || "Monday"} at ${template.time} · covers the last 7 days`
  }
  return `Daily at ${template.time} · covers yesterday`
}

const decode = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")

/**
 * Slack mrkdwn → segments React can render without innerHTML.
 * Handles what Slack does: *bold*, _italic_, ~strike~, `code`, <url|text>
 * links, and "> " quotes, line by line. Returns lines, each
 * { quote: bool, segs: [{ text, bold?, italic?, strike?, code?, href? }] }.
 */
export function parseMrkdwn(text) {
  return String(text ?? "").split("\n").map((raw) => {
    let line = raw
    let quote = false
    if (/^(>|&gt;)\s?/.test(line)) {
      quote = true
      line = line.replace(/^(>|&gt;)\s?/, "")
    }
    const segs = []
    const re = /\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~|`([^`\n]+)`|<((?:https?:\/\/|mailto:)[^|>]+)(?:\|([^>]+))?>/g
    let last = 0
    let m
    while ((m = re.exec(line))) {
      if (m.index > last) segs.push({ text: decode(line.slice(last, m.index)) })
      if (m[1] !== undefined) segs.push({ text: decode(m[1]), bold: true })
      else if (m[2] !== undefined) segs.push({ text: decode(m[2]), italic: true })
      else if (m[3] !== undefined) segs.push({ text: decode(m[3]), strike: true })
      else if (m[4] !== undefined) segs.push({ text: decode(m[4]), code: true })
      else segs.push({ text: decode(m[6] || m[5]), href: m[5] })
      last = m.index + m[0].length
    }
    if (last < line.length) segs.push({ text: decode(line.slice(last)) })
    return { quote, segs }
  })
}

async function json(res) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export const reportApi = {
  state: () => apiRequest("/api/report-designer/state").then(json),
  /** template=null seeds the draft from the saved report (or the default). */
  seedDraft: (template = null) =>
    apiRequest("/api/report-designer/draft", { method: "PUT", body: JSON.stringify({ template }) }).then(json),
  /** source: "draft" (the copilot's working copy) or "saved" (the live report). */
  preview: (template = null, source = "draft") =>
    apiRequest("/api/report-designer/preview", { method: "POST", body: JSON.stringify({ template, source }) }).then(json),
  /** The raw response, so the editor can show a 400's validation errors. */
  previewRaw: (template) =>
    apiRequest("/api/report-designer/preview", { method: "POST", body: JSON.stringify({ template }) }),
  save: (template) =>
    apiRequest("/api/integrations/slack/brief", { method: "PUT", body: JSON.stringify({ template }) }).then(json),
}
