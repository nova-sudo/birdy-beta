import { handleUpload } from "@vercel/blob/client"
import { NextResponse } from "next/server"

import { verifyGrant } from "@/lib/creative-upload-grant"

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
        if (!grant) throw new Error("Invalid or expired upload grant")
        if (typeof pathname !== "string" || !pathname.startsWith("creatives/") || pathname.includes("..")) {
          throw new Error("Invalid upload path")
        }
        return {
          allowedContentTypes: [grant.m],
          maximumSizeInBytes: grant.s,
          tokenPayload: grant.u,
        }
      },
      onUploadCompleted: async () => {},
    })
    return NextResponse.json(json)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
