import Image from "next/image"
import { ghlIcon, metaIcon, hpIcon, flaskIcon } from "@/lib/icons"

// The logo a column head leads with, by the source its figures come from
// (COLUMN_MENU_SOURCES ids). Birdy's own columns have none.
export const SOURCE_ICONS = {
  meta: metaIcon,
  ghl: ghlIcon,
  tags: ghlIcon,
  hotprospector: hpIcon,
  custom: flaskIcon,
}

/** A 14px source logo for a column head, or null when there is none. */
export function SourceIcon({ src }) {
  if (!src) return null
  return <Image src={src} alt="" width={14} height={14} className="shrink-0" />
}
