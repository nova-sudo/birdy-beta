"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { MetricGroupCell } from "./metric-group"

/**
 * One free-standing figure: a single MetricGroup cell on its own white surface.
 * Peer figures belong in one `MetricGroup`, not a row of these.
 *
 * @param {object} props Every `MetricGroupItem` field (`label`, `value`, `delta`, `goodWhen`, `caption`, ...)
 * @param {boolean} [props.loading]
 */
function MetricCard({ className, loading = false, ...item }) {
  return (
    <div
      data-ds="metric-card"
      className={cn("min-w-0 overflow-clip rounded-frame bg-background text-foreground shadow-surface", className)}
    >
      <MetricGroupCell item={item} loading={loading} />
    </div>
  )
}

export { MetricCard }
