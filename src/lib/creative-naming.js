// Meta ad naming for creative tests. Mirrors the backend rules in
// services/creatives/naming.py; used only for the live name preview.

const SLUG_MAX = 40
const SEPARATOR = " | "

/** Lowercase `[a-z0-9-]` slug, dashes collapsed, max 40 chars. May return "". */
export function slugify(name) {
  const text = String(name ?? "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return text.slice(0, SLUG_MAX).replace(/-+$/, "")
}

/** "CT-0048 | slug"; an empty slug reads "untitled". */
export function metaAdName(code, slug) {
  return `${code}${SEPARATOR}${slug || "untitled"}`
}
