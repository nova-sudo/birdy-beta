// Server-only: verifies the upload grant signed by the backend
// (services/creatives/upload_grant.py). Lives outside route.js because Next
// route files may only export HTTP handlers.
import { createHmac, timingSafeEqual } from "node:crypto"

/** Returns the grant `{u, m, s, exp}` or null. Never throws. */
export function verifyGrant(grant, secret, now = new Date()) {
  try {
    if (typeof grant !== "string" || !secret) return null
    const parts = grant.split(".")
    if (parts.length !== 2) return null
    const [payload, sig] = parts
    const expected = createHmac("sha256", secret).update(payload).digest("hex")
    const a = Buffer.from(sig, "utf8")
    const b = Buffer.from(expected, "utf8")
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    if (!data || typeof data !== "object") return null
    if (typeof data.exp !== "number" || data.exp < Math.floor(now.getTime() / 1000)) return null
    if (typeof data.u !== "string" || typeof data.m !== "string" || typeof data.s !== "number") return null
    return data
  } catch {
    return null
  }
}
