"use client"

import * as React from "react"

import { Tabs, TabsList, TabsTrigger } from "./tabs"

/**
 * The framed rail with a sliding thumb, driven by an items array. A thin wrapper over `Tabs`.
 *
 * @param {object} props
 * @param {string} props.value Active item value.
 * @param {(value: string) => void} props.onValueChange
 * @param {{ value: string, label: React.ReactNode, count?: React.ReactNode, attention?: boolean|"danger", tooltip?: React.ReactNode }[]} props.items
 * @param {"sm"|"md"} [props.size="md"]
 * @param {"surface"|"frame"} [props.surface="surface"] What the rail sits on
 * @param {boolean} [props.fill=false] The rail takes the full width, tabs share it equally
 * @param {string} [props.ariaLabel]
 * @param {string} [props.panelId] Id of the panel the tabs swap; tabs get `aria-controls` and an id of `${panelId}-tab-${value}` for the panel's `aria-labelledby`
 */
function SegmentedTabs({ value, onValueChange, items, size = "md", surface, fill, ariaLabel, panelId, className }) {
  return (
    <Tabs value={value} onValueChange={onValueChange} data-ds="segmented-tabs" className={fill ? "gap-0" : "w-fit gap-0"}>
      <TabsList aria-label={ariaLabel} size={size} surface={surface} fill={fill} className={className}>
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            count={item.count}
            attention={item.attention}
            tooltip={item.tooltip}
            {...(panelId ? { id: `${panelId}-tab-${item.value}`, "aria-controls": panelId } : {})}
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

export { SegmentedTabs }
