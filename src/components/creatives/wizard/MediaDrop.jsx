"use client"

import { useRef, useState } from "react"
import { Upload } from "lucide-react"

import { Button, Label, Notice, ProgressBar } from "@/components/ds"
import { cn } from "@/lib/utils"
import { uploadCreativeMedia } from "@/lib/creative-upload"

const MB = 1024 * 1024

function summary(media) {
  const bits = []
  if (media.width && media.height) bits.push(`${media.width}×${media.height}`)
  if (media.duration_s) bits.push(`${media.duration_s}s`)
  if (media.bytes) bits.push(`${(media.bytes / MB).toFixed(1)} MB`)
  return bits.join(" · ")
}

/**
 * Drop zone that uploads straight to Blob and reports the stored media.
 *
 * @param {object} props
 * @param {object|null} props.media Current `creative.media`
 * @param {(media: object, format: "image"|"video") => void} props.onChange
 */
export function MediaDrop({ media, onChange }) {
  const input = useRef(null)
  const [progress, setProgress] = useState(null) // null = idle
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [over, setOver] = useState(false)

  async function take(file) {
    if (!file) return
    setError("")
    setName(file.name)
    setProgress(0)
    try {
      const result = await uploadCreativeMedia(file, { onProgress: setProgress })
      onChange(result, result.mime.startsWith("video/") ? "video" : "image")
    } catch (e) {
      setError(e?.message || "The upload failed. Try again.")
    } finally {
      setProgress(null)
      if (input.current) input.current.value = ""
    }
  }

  const uploading = progress !== null
  const hasMedia = !!media?.blob_url

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="creative-media">Media</Label>
      <input
        ref={input}
        id="creative-media"
        type="file"
        className="sr-only"
        accept="image/jpeg,image/png,video/mp4,video/quicktime"
        disabled={uploading}
        onChange={(e) => take(e.target.files?.[0])}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          take(e.dataTransfer.files?.[0])
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-control border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm",
          over && "border-primary bg-primary/5"
        )}
      >
        {uploading ? (
          <div className="flex w-full max-w-xs flex-col gap-2">
            <span className="truncate font-medium">{name}</span>
            <ProgressBar value={progress} tone="primary" label="Upload progress" />
            <span className="text-muted-foreground tabular-nums">{Math.round(progress)}%</span>
          </div>
        ) : (
          <>
            {hasMedia ? (
              <p>
                <span className="font-medium">{name || media.mime}</span>
                {summary(media) && <span className="text-muted-foreground"> · {summary(media)}</span>}
              </p>
            ) : (
              <p className="text-muted-foreground">Drop an image or video here. JPEG or PNG up to 30 MB, MP4 or MOV up to 1 GB.</p>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
              <Upload />
              {hasMedia ? "Replace file" : "Choose file"}
            </Button>
          </>
        )}
      </div>
      {error && (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      )}
    </div>
  )
}
