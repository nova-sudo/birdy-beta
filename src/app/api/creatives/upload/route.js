import { handleUpload } from "@vercel/blob/client"
import { NextResponse } from "next/server"

import { verifyGrant } from "@/lib/creative-upload-grant"

class GrantError extends Error {}

// Issues Vercel Blob client tokens, but only for uploads carrying a fresh grant
// signed by the backend (the auth cookie lives on the backend domain).
export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const grant = verifyGrant(clientPayload, process.env.CREATIVE_UPLOAD_SECRET, new Date())
        if (!grant) throw new GrantError("Invalid or expired upload grant")
        if (typeof pathname !== "string" || !pathname.startsWith("creatives/") || pathname.includes("..")) {
          throw new GrantError("Invalid upload path")
        }
        return {
          allowedContentTypes: [grant.m],
          maximumSizeInBytes: grant.s,
          validUntil: grant.exp * 1000,
          tokenPayload: grant.u,
        }
      },
    })
    return NextResponse.json(json)
  } catch (error) {
    if (error instanceof GrantError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
