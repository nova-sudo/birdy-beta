import { TagIcon } from "lucide-react"
import { Badge, Tooltip, TooltipContent, TooltipTrigger, DataTableColumnHeader, StateBadge } from "@/components/ds"
import { ghlIcon as ghl, metaIcon as meta, hpIcon as hp, labIcon as lab } from "@/lib/icons"
import Image from "next/image"
import { SourceIcon } from "@/components/source-icon"
import getSymbolFromCurrency from "currency-symbol-map"
import { STORAGE_KEYS } from "@/lib/constants"

function toTitleCase(str) {
  if (!str) return str
  return String(str)
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

// Opportunity statuses and the shared states that draw them.
const OPPORTUNITY_STATE = { open: "in_progress", won: "won", lost: "lost", abandoned: "skipped" }

const getCurrency = () =>
  typeof window !== "undefined"
    ? localStorage.getItem(STORAGE_KEYS.DEFAULT_CURRENCY) ?? "USD"
    : "USD"

export const buildContactColumns = () => [
  {
    id: "contactName",
    header: "Name",
    label: "Name",
    defaultVisible: true,
    sortable: true,
    icons: ghl,
    // Falls back to the phone number when no name was captured — a third of
    // rows are Contacts (usually an inbound call with no form fill), and the
    // design asks for the local-format number to stand in for the name
    // rather than leaving the cell to fall through to the phone column's
    // own placeholder.
    cell: (value, row) =>
      value && value !== "Unknown" ? (
        <span className="text-sm text-foreground text-left block">{toTitleCase(value)}</span>
      ) : row?.phone ? (
        <span className="text-sm text-foreground text-left block">{row.phone}</span>
      ) : (
        <span className="text-muted-foreground text-sm px-2">–</span>
      ),
    // The line under the name: where the lead came from and where its
    // opportunity stands — the two facts a reader scans the row for, and the
    // first of which is hidden by default as a column of its own.
    sub: (row) => {
      const source = row?.source
        ? row.source.split(",").map((s) => s.trim()).filter(Boolean).map(toTitleCase).join(", ")
        : null
      const status = row?.opportunities?.[0]?.status
      const bits = [source, status ? toTitleCase(status) : null].filter(Boolean)
      return bits.length > 0 ? bits.join(" · ") : null
    },
  },
  {
    id: "groupName",
    header: "Client Group",
    label: "Group",
    defaultVisible: true,
    sortable: true,
    icons: lab,
    cell: (value) =>
      !value ? (
        <span className="text-muted-foreground text-sm">-</span>
      ) : (
        <div className="truncate px-2" title={value}>
          <span className="text-sm font-medium text-foreground">{value}</span>
        </div>
      ),
  },
  {
    id: "email",
    header: "Email",
    label: "Email",
    defaultVisible: true,
    sortable: true,
    icons: ghl,
    cell: (value) =>
      !value || value.startsWith("no_email_") ? (
        <span className="text-muted-foreground font-bold text-sm">–</span>
      ) : (
        <a
          href={`mailto:${value}`}
          className="text-sm text-foreground hover:text-primary font-bold hover:underline transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </a>
      ),
  },
  {
    id: "phone",
    header: "Phone",
    label: "Phone",
    defaultVisible: true,
    sortable: true,
    icons: ghl,
    cell: (value) =>
      !value ? (
        <span className="text-muted-foreground font-bold text-sm">–</span>
      ) : (
        <a
          href={`tel:${value}`}
          className="text-sm text-foreground hover:text-primary hover:underline transition-colors font-mono"
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </a>
      ),
  },
  {
    id: "dateAdded",
    header: "Date Added",
    label: "Date Added",
    defaultVisible: true,
    sortable: true,
    icons: ghl,
    cell: (value) =>
      !value ? (
        <span className="text-muted-foreground text-sm">–</span>
      ) : (
        <span className="text-sm text-foreground">
          {new Date(value).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      ),
  },
  {
    id: "tags",
    header: "Tags",
    label: "Tags",
    defaultVisible: true,
    icons: ghl,
    cell: (value, row) => {
      if (!value || value.length === 0)
        return <span className="text-muted-foreground text-sm">–</span>
      const tags = value
      const mainTag = tags[0]
      const hasMoreTags = tags.length > 1
      const score = row?.score ? `+${row.score}` : null
      return (
        <div className="flex items-center gap-2 max-w-xs">
          <Badge className="max-w-[150px] truncate">{mainTag}</Badge>
          {score && <Badge tone="primary">{score}</Badge>}
          {hasMoreTags && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge tone="primary">+{tags.length - 1}</Badge>
              </TooltipTrigger>
              <TooltipContent className="max-h-48 overflow-y-auto">
                {tags.slice(1).map((tag, tagIndex) => (
                  <div key={`${tag}-${tagIndex}`} className="flex items-center gap-1 text-sm py-0.5">
                    <TagIcon aria-hidden className="size-3" />{tag}
                  </div>
                ))}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )
    },
  },
  {
    id: "type",
    header: "Type",
    label: "Type",
    defaultVisible: true,
    sortable: true,
    icons: ghl,
    cell: (value, row) => {
      const type = value || row?.contactType
      if (!type) return <span className="text-muted-foreground text-sm">–</span>
      const isLead = type === "lead"
      return (
        <Badge tone={isLead ? "primary" : "neutral"} className="capitalize">
          {type}
        </Badge>
      )
    },
  },
  {
    id: "opportunityStatus",
    header: "Opportunity Status",
    label: "Opportunity Status",
    defaultVisible: true,
    sortable: false,
    icons: ghl,
    cell: (value, row) => {
      const opportunities = row?.opportunities || []
      if (!opportunities || opportunities.length === 0)
        return <span className="text-muted-foreground text-sm">—</span>
      const mainOpp = opportunities[0]
      const hasMoreOpps = opportunities.length > 1
      const oppStatus = mainOpp.status || "unknown"
      return (
        <div className="flex items-center gap-2">
          <StateBadge state={OPPORTUNITY_STATE[oppStatus] ?? "unknown"} className="capitalize">
            {oppStatus}
          </StateBadge>
          {hasMoreOpps && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge tone="primary">+{opportunities.length - 1}</Badge>
              </TooltipTrigger>
              <TooltipContent className="max-h-48 overflow-y-auto">
                {opportunities.slice(1).map((opp, idx) => (
                  <div key={idx} className="py-0.5 text-xs capitalize">
                    {opp.status}
                  </div>
                ))}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )
    },
  },
  {
    id: "opportunityValue",
    header: "Opportunity Value",
    label: "Opportunity Value",
    defaultVisible: true,
    sortable: false,
    icons: ghl,
    cell: (value, row) => {
      const opportunities = row?.opportunities || []
      if (!opportunities || opportunities.length === 0)
        return <span className="text-muted-foreground text-sm">—</span>
      const mainOpp = opportunities[0]
      const hasMoreOpps = opportunities.length > 1
      const oppValue = mainOpp.monetaryValue || 0
      const sym = getSymbolFromCurrency(getCurrency()) || "$"
      return (
        <div className="flex items-center gap-2">
          {oppValue > 0 ? (
            <span className="text-sm text-foreground">
              {sym}{oppValue.toLocaleString()}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
          {hasMoreOpps && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge>+{opportunities.length - 1}</Badge>
              </TooltipTrigger>
              <TooltipContent className="max-h-48 overflow-y-auto">
                {opportunities.slice(1).map((opp, idx) => (
                  <div key={idx} className="flex items-center gap-2 py-0.5 text-xs">
                    {opp.monetaryValue > 0 && <span>{sym}{opp.monetaryValue.toLocaleString()}</span>}
                    {opp.monetaryValue === 0 && <span>—</span>}
                  </div>
                ))}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )
    },
  },
  { id: "firstName", header: "First Name", label: "First Name", defaultVisible: false, sortable: true, icons: ghl, cell: (v) => <span className="text-sm">{toTitleCase(v) || "-"}</span> },
  { id: "lastName", header: "Last Name", label: "Last Name", defaultVisible: false, sortable: true, icons: ghl, cell: (v) => <span className="text-sm">{toTitleCase(v) || "-"}</span> },
  {
    id: "companyName",
    header: "Company",
    label: "Company",
    defaultVisible: false,
    sortable: true,
    icons: ghl,
    cell: (v) => !v
      ? <span className="text-muted-foreground text-sm">-</span>
      : <span className="text-sm font-medium text-foreground">{toTitleCase(v)}</span>,
  },
  {
    id: "source",
    header: "Source",
    label: "Source",
    defaultVisible: false,
    sortable: true,
    icons: ghl,
    cell: (v) => !v
      ? <span className="text-muted-foreground text-sm">-</span>
      : <Badge className="capitalize">{v.split(",").map((s) => s.trim()).join(", ")}</Badge>,
  },
  { id: "city", header: "City", label: "City", defaultVisible: false, sortable: true, icons: ghl, cell: (v) => <span className="text-sm">{v || "-"}</span> },
  { id: "state", header: "State", label: "State", defaultVisible: false, sortable: true, icons: ghl, cell: (v) => <span className="text-sm">{v || "-"}</span> },
  { id: "postalCode", header: "Postal Code", label: "Postal Code", defaultVisible: false, sortable: true, icons: ghl, cell: (v) => <span className="text-sm">{v || "-"}</span> },
  {
    id: "country",
    header: "Country",
    label: "Country",
    // Not one of the design's default-visible columns — still available via
    // the Columns picker.
    defaultVisible: false,
    sortable: true,
    icons: ghl,
    cell: (v) => !v
      ? <span className="text-muted-foreground text-sm">–</span>
      : <div className="truncate px-2" title={v}><span className="text-sm font-medium text-foreground">{v}</span></div>,
  },
  {
    id: "website",
    header: "Website",
    label: "Website",
    defaultVisible: false,
    sortable: true,
    icons: ghl,
    cell: (v) => {
      if (!v) return <span className="text-muted-foreground text-sm">-</span>
      const url = v.startsWith("http") ? v : `https://${v}`
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-foreground hover:text-primary hover:underline transition-colors max-w-xs truncate inline-block"
          title={v}
          onClick={(e) => e.stopPropagation()}
        >
          {v}
        </a>
      )
    },
  },
  {
    id: "address1",
    header: "Address",
    label: "Address",
    defaultVisible: false,
    sortable: true,
    icons: ghl,
    cell: (v, row) => {
      const addr = v || row?.address
      if (!addr) return <span className="text-muted-foreground text-sm">-</span>
      return (
        <span className="text-sm text-foreground max-w-xs truncate block" title={addr}>
          {addr}
        </span>
      )
    },
  },
  { id: "dateOfBirth", header: "Date of Birth", label: "Date of Birth", defaultVisible: false, sortable: true, icons: ghl, cell: (v) => <span className="text-sm">{v || "-"}</span> },
  { id: "assignedTo", header: "Assigned To", label: "Assigned To", defaultVisible: false, sortable: true, icons: ghl, cell: (v) => <span className="text-sm">{v || "-"}</span> },

  // Cross-source matching columns
  {
    id: "sources",
    header: "Sources",
    label: "Sources",
    defaultVisible: true,
    sortable: false,
    icons: lab,
    category: "sources",
    cell: (_, row) => {
      const s = row?.sources || {}
      return (
        <div className="flex items-center gap-2">
          {s.ghl ? <Image src={ghl} alt="GHL" width={16} height={16} title="GHL" /> : <span className="w-4 h-4 text-xs text-muted-foreground">–</span>}
          {s.meta ? <Image src={meta} alt="Meta" width={16} height={16} title="Meta" /> : <span className="w-4 h-4 text-xs text-muted-foreground">–</span>}
          {s.hp ? <Image src={hp} alt="HP" width={16} height={16} title="HotProspector" /> : <span className="w-4 h-4 text-xs text-muted-foreground">–</span>}
        </div>
      )
    },
  },
  {
    id: "metaCampaign",
    header: "Meta Campaign",
    label: "Meta Campaign",
    defaultVisible: true,
    sortable: true,
    icons: meta,
    category: "sources",
    cell: (_, row) => <span className="text-sm truncate max-w-[200px]" title={row?.meta_enrichment?.campaign_name || ""}>{row?.meta_enrichment?.campaign_name || "–"}</span>,
  },
  {
    id: "metaAdName",
    header: "Meta Ad",
    label: "Meta Ad",
    defaultVisible: true,
    sortable: true,
    icons: meta,
    category: "sources",
    cell: (_, row) => <span className="text-sm truncate max-w-[200px]" title={row?.meta_enrichment?.ad_name || ""}>{row?.meta_enrichment?.ad_name || "–"}</span>,
  },
  {
    id: "metaAdsetName",
    header: "Meta Ad Set",
    label: "Meta Ad Set",
    defaultVisible: false,
    sortable: true,
    icons: meta,
    category: "sources",
    cell: (_, row) => <span className="text-sm truncate max-w-[200px]" title={row?.meta_enrichment?.adset_name || ""}>{row?.meta_enrichment?.adset_name || "–"}</span>,
  },
  {
    id: "hpCallCount",
    header: "HP Calls",
    label: "HP Calls",
    defaultVisible: false,
    sortable: true,
    icons: hp,
    category: "sources",
    cell: (_, row) => <span className="text-sm">{row?.hp_enrichment?.call_logs_count ?? "–"}</span>,
  },
]

/**
 * The column set above, as ds DataTable column defs.
 *
 * Cells keep their `(value, row)` shape, so the same definitions render the
 * same thing they did in the old table. A column's source icon (`icons`) leads
 * its header, and the name column carries its `sub` line (source, stage)
 * beneath it. Hiding is left to the page's Columns menu, so the table's own
 * View picker stays out of the way.
 *
 * @param {object[]} columns buildContactColumns() plus any custom/tag columns
 */
export function toTableColumns(columns) {
  return columns.map((col, index) => ({
    id: col.id,
    accessorFn: (row) => row?.[col.id],
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={col.header} icon={col.icons ? <SourceIcon src={col.icons} /> : null} />
    ),
    enableSorting: Boolean(col.sortable),
    enableHiding: false,
    meta: { label: col.label ?? col.header, minWidth: index === 0 ? 220 : 140 },
    cell: ({ getValue, row }) => {
      const content = col.cell ? col.cell(getValue(), row.original) : getValue()
      const sub = index === 0 && col.sub ? col.sub(row.original) : null
      return sub ? (
        <div className="flex min-w-0 flex-col gap-0.5">
          {content}
          <span className="truncate text-xs text-muted-foreground">{sub}</span>
        </div>
      ) : (
        content
      )
    },
  }))
}
