import { createHmac } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("@vercel/blob/client", () => ({ upload: vi.fn() }))

import { apiRequest } from "@/lib/api"
import { upload } from "@vercel/blob/client"
import { uploadCreativeMedia } from "@/lib/creative-upload"
import { verifyGrant } from "@/lib/creative-upload-grant"

const SECRET = "s3cret"
const MB = 1024 * 1024
const NOW = new Date("2026-11-03T12:00:00Z")

function sign(data, secret = SECRET) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url")
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`
}
const data = { u: "u1", m: "image/png", s: 1000, exp: Math.floor(NOW.getTime() / 1000) + 600 }

describe("verifyGrant", () => {
  it("accepts a valid grant", () => {
    expect(verifyGrant(sign(data), SECRET, NOW)).toEqual(data)
  })
  it("rejects expired grants", () => {
    const later = new Date(NOW.getTime() + 11 * 60 * 1000)
    expect(verifyGrant(sign(data), SECRET, later)).toBeNull()
  })
  it("rejects wrong secret, tampered payload and malformed input without throwing", () => {
    expect(verifyGrant(sign(data, "other"), SECRET, NOW)).toBeNull()
    const [, sig] = sign(data).split(".")
    const forged = Buffer.from(JSON.stringify({ ...data, u: "evil" })).toString("base64url")
    expect(verifyGrant(`${forged}.${sig}`, SECRET, NOW)).toBeNull()
    for (const bad of [undefined, null, 42, "", "garbage", "a.b.c", "abc.zz", `${"x"}.${"0".repeat(64)}`]) {
      expect(verifyGrant(bad, SECRET, NOW)).toBeNull()
    }
    expect(verifyGrant(sign(data), "", NOW)).toBeNull()
  })
})

describe("uploadCreativeMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  const file = (type, size, name = "a.png") => {
    const f = new File(["x"], name, { type })
    Object.defineProperty(f, "size", { value: size })
    return f
  }

  it("rejects image/gif before any request", async () => {
    await expect(uploadCreativeMedia(file("image/gif", 10, "a.gif"))).rejects.toThrow(/jpeg|png|mp4/i)
    expect(apiRequest).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
  })
  it("rejects oversize files before any request", async () => {
    await expect(uploadCreativeMedia(file("image/png", 31 * MB))).rejects.toThrow(/30 MB/)
    await expect(uploadCreativeMedia(file("video/mp4", 1025 * MB, "a.mp4"))).rejects.toThrow(/1 GB/)
    expect(apiRequest).not.toHaveBeenCalled()
  })
  it("gets a grant, uploads public, and returns the media record", async () => {
    apiRequest.mockResolvedValue({ ok: true, json: async () => ({ grant: "G" }) })
    upload.mockResolvedValue({ url: "https://x.public.blob.vercel-storage.com/creatives/a.png" })
    const onProgress = vi.fn()
    const out = await uploadCreativeMedia(file("image/png", 1000), { onProgress, measure: async () => ({ width: 10, height: 20, duration_s: null }) })
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/creatives/upload-grant",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ mime: "image/png", bytes: 1000 }) }),
    )
    const [path, , opts] = upload.mock.calls[0]
    expect(path).toMatch(/^creatives\/[0-9a-f-]+-a\.png$/)
    expect(opts).toMatchObject({ access: "public", handleUploadUrl: "/api/creatives/upload", clientPayload: "G" })
    expect(out).toEqual({
      blob_url: "https://x.public.blob.vercel-storage.com/creatives/a.png",
      mime: "image/png", bytes: 1000, width: 10, height: 20, duration_s: null,
    })
  })
  it("surfaces a grant error", async () => {
    apiRequest.mockResolvedValue({ ok: false, json: async () => ({ detail: "nope" }) })
    await expect(uploadCreativeMedia(file("image/png", 1000))).rejects.toThrow("nope")
    expect(upload).not.toHaveBeenCalled()
  })
})
