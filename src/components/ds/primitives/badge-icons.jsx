import * as React from "react"
import { Ban, CircleAlert, Info, CircleCheck, CircleHelp, CircleMinus, CirclePause, CircleX, Clock } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Lucide is stroke-only. Bytes draws status marks as a solid disc with a white glyph, so wrap
 * the circled icons: the whole svg fills with the tone colour, the glyph strokes in the
 * background colour, and the circle strokes back in the tone colour to keep the full disc.
 */
function disc(Icon, name) {
  const Disc = ({ className, ...props }) => (
    <Icon
      data-ds="badge-icons"
      {...props}
      fill="currentColor"
      className={cn("stroke-background [&>circle]:stroke-current", className)}
    />
  )
  Disc.displayName = name
  return Disc
}

export const CheckDiscIcon = disc(CircleCheck, "CheckDiscIcon")
export const PauseDiscIcon = disc(CirclePause, "PauseDiscIcon")
export const CrossDiscIcon = disc(CircleX, "CrossDiscIcon")
export const MinusDiscIcon = disc(CircleMinus, "MinusDiscIcon")
export const AlertDiscIcon = disc(CircleAlert, "AlertDiscIcon")
export const ClockDiscIcon = disc(Clock, "ClockDiscIcon")
export const HelpDiscIcon = disc(CircleHelp, "HelpDiscIcon")
export const InfoDiscIcon = disc(Info, "InfoDiscIcon")
export const BanDiscIcon = disc(Ban, "BanDiscIcon")
