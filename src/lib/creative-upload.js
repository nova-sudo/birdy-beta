import { upload } from "@vercel/blob/client"

import { apiRequest } from "@/lib/api"

const MB = 1024 * 1024
const IMAGE_TYPES = ["image/jpeg", "image/png"]
const VIDEO_TYPES = ["video/mp4", "video/quicktime"]
/** Value for an <input type="file" accept>. */
export const CREATIVE_ACCEPT = [...IMAGE_TYPES, ...VIDEO_TYPES].join(",")
/** Value for an <input type="file" accept> that takes only video. */
export const VIDEO_ACCEPT = VIDEO_TYPES.join(",")
/** Value for an <input type="file" accept> that takes only images. */
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",")
const MAX_IMAGE = 30 * MB
const MAX_VIDEO = 1024 * MB
const MEASURE_TIMEOUT_MS = 10_000

/** Throws a user-readable Error for a file we will not upload. */
export function validateCreativeFile(file) {
  const isImage = IMAGE_TYPES.includes(file?.type)
  const isVideo = VIDEO_TYPES.includes(file?.type)
  if (!isImage && !isVideo) throw new Error("Use a JPEG or PNG image, or an MP4 or MOV video.")
  if (isImage && file.size > MAX_IMAGE) throw new Error("Images must be 30 MB or smaller.")
  if (isVideo && file.size > MAX_VIDEO) throw new Error("Videos must be 1 GB or smaller.")
  if (!(file.size > 0)) throw new Error("That file is empty.")
  return isVideo ? "video" : "image"
}

/** Reads width/height (and duration for video) from the local file. */
export function measureMedia(file) {
  const url = URL.createObjectURL(file)
  let done = (fn, v) => {
    URL.revokeObjectURL(url)
    fn(v)
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(reject, new Error("Timed out reading the file.")), MEASURE_TIMEOUT_MS)
    const finish = done
    done = (fn, v) => {
      clearTimeout(timer)
      finish(fn, v)
    }
    if (file.type.startsWith("video/")) {
      const el = document.createElement("video")
      el.preload = "metadata"
      el.onloadedmetadata = () =>
        done(resolve, {
          width: el.videoWidth,
          height: el.videoHeight,
          duration_s: Number.isFinite(el.duration) ? Math.round(el.duration * 10) / 10 : null,
        })
      el.onerror = () => done(reject, new Error("Could not read that video."))
      el.src = url
    } else {
      const el = new Image()
      el.onload = () => done(resolve, { width: el.naturalWidth, height: el.naturalHeight, duration_s: null })
      el.onerror = () => done(reject, new Error("Could not read that image."))
      el.src = url
    }
  })
}

/**
 * Uploads straight to Vercel Blob using a backend-signed grant.
 * `measure` is injectable for tests.
 */
export async function uploadCreativeMedia(file, { onProgress, measure = measureMedia } = {}) {
  validateCreativeFile(file)

  // Measure first: a decode problem must not orphan an uploaded blob. Non-fatal.
  let dims = { width: null, height: null, duration_s: null }
  try {
    dims = { ...dims, ...(await measure(file)) }
  } catch {
    // keep nulls
  }

  const res = await apiRequest("/api/creatives/upload-grant", {
    method: "POST",
    body: JSON.stringify({ mime: file.type, bytes: file.size }),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    // non-JSON body
  }
  // Without the prefix the upload would work and then be refused as not this user's, so stop here.
  if (!res.ok || !data?.grant || !data?.path_prefix) {
    throw new Error(
      typeof data?.detail === "string" ? data.detail : "Could not start the upload. Try again.",
    )
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80)
  // The grant's prefix is what lets the backend prove later that this upload is this user's.
  const blob = await upload(`${data.path_prefix}${crypto.randomUUID()}-${safeName}`, file, {
    access: "public",
    handleUploadUrl: "/api/creatives/upload",
    clientPayload: data.grant,
    onUploadProgress: onProgress
      ? (e) => onProgress(typeof e === "number" ? e : e?.percentage ?? 0)
      : undefined,
  })

  return {
    blob_url: blob.url,
    mime: file.type,
    bytes: file.size,
    width: dims.width,
    height: dims.height,
    duration_s: dims.duration_s,
  }
}
