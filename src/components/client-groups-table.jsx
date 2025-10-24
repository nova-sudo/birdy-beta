"use client"

import { useState, useMemo } from "react"
import { ChevronDown, GripVertical, Eye, EyeOff, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FaMeta } from "react-icons/fa6";
import { Item } from "@radix-ui/react-dropdown-menu"
import { ImLab } from "react-icons/im";
import { MdDriveFileRenameOutline } from "react-icons/md";
import { FaFire } from "react-icons/fa";
import ghl from "../../public/ghl_icon.png"




const DEFAULT_COLUMNS = [
  { id: "name", label: "Business Name", visible: true, sortable: true, icons: MdDriveFileRenameOutline},
  { id: "ghl_contacts", label: "GHL Leads", visible: true, sortable: true, icons: ghl },
  { id: "meta_campaigns", label: "Meta Campaigns", visible: true, sortable: true , icons: FaMeta},
  { id: "meta_spend", label: "Meta Spend", visible: true, sortable: true , icons: FaMeta},
  { id: "meta_ctr", label: "Meta CTR (%)", visible: true, sortable: true , icons: FaMeta},
  { id: "meta_cpc", label: "Meta CPC", visible: true, sortable: true , icons: FaMeta},
  { id: "meta_leads", label: "Meta Leads", visible: true, sortable: true , icons: FaMeta},
  { id: "hp_leads", label: "HP Leads", visible: true, sortable: true , icons: FaFire},
  { id: "meta_impressions", label: "Meta Impressions", visible: true, sortable: true , icons: FaMeta},
  { id: "meta_clicks", label: "Meta Clicks", visible: true, sortable: true , icons: FaMeta},
  { id: "meta_reach", label: "Meta Reach", visible: true, sortable: true , icons: FaMeta},
  { id: "meta_cpm", label: "Meta CPM", visible: true, sortable: true , icons: FaMeta},
]

export function ClientGroupsTable({ data, onRowClick }) {
  const [columns, setColumns] = useState(DEFAULT_COLUMNS)
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" })
  const [searchQuery, setSearchQuery] = useState("")
  const [draggedColumn, setDraggedColumn] = useState(null)

  const flattenedData = useMemo(() => {
    return data.map((group) => ({
      id: group.id,
      name: group.name || "Unnamed Group",
      ghl_contacts: group.gohighlevel?.metrics?.total_contacts || 0,
      meta_campaigns: group.facebook?.metrics?.total_campaigns || 0,
      meta_adsets: group.facebook?.metrics?.total_adsets || 0,
      meta_ads: group.facebook?.metrics?.total_ads || 0,
      meta_spend: group.facebook?.metrics?.insights?.spend || 0,
      meta_impressions: group.facebook?.metrics?.insights?.impressions || 0,
      meta_clicks: group.facebook?.metrics?.insights?.clicks || 0,
      meta_reach: group.facebook?.metrics?.insights?.reach || 0,
      meta_results: group.facebook?.metrics?.insights?.results || 0,
      meta_cpm: group.facebook?.metrics?.insights?.cpm || 0,
      meta_cpc: group.facebook?.metrics?.insights?.cpc || 0,
      meta_ctr: group.facebook?.metrics?.insights?.ctr || 0,
      meta_cost_per_result: group.facebook?.metrics?.insights?.cost_per_result || 0,
      meta_leads: group.facebook?.metrics?.total_leads || 0,
      hp_leads: group.hotprospector?.metrics?.total_leads || 0,
      original: group,
    }))
  }, [data])

  const filteredData = useMemo(() => {
    if (!searchQuery) return flattenedData
    const query = searchQuery.toLowerCase()
    return flattenedData.filter((row) => row.name.toLowerCase().includes(query))
  }, [flattenedData, searchQuery])

  const sortedData = useMemo(() => {
    const sorted = [...filteredData]
    sorted.sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]

      if (typeof aValue === "string") {
        return sortConfig.direction === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      }

      return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue
    })
    return sorted
  }, [filteredData, sortConfig])

  const toggleColumnVisibility = (columnId) => {
    setColumns((prev) => prev.map((col) => (col.id === columnId ? { ...col, visible: !col.visible } : col)))
  }

  const handleSort = (columnId) => {
    setSortConfig((prev) => ({
      key: columnId,
      direction: prev.key === columnId && prev.direction === "asc" ? "desc" : "asc",
    }))
  }

  const handleDragStart = (e, columnId) => {
    setDraggedColumn(columnId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e, targetColumnId) => {
    e.preventDefault()
    if (!draggedColumn || draggedColumn === targetColumnId) {
      setDraggedColumn(null)
      return
    }

    const draggedIndex = columns.findIndex((col) => col.id === draggedColumn)
    const targetIndex = columns.findIndex((col) => col.id === targetColumnId)

    const newColumns = [...columns]
    const [draggedCol] = newColumns.splice(draggedIndex, 1)
    newColumns.splice(targetIndex, 0, draggedCol)

    setColumns(newColumns)
    setDraggedColumn(null)
  }

  const visibleColumns = columns.filter((col) => col.visible)

  const formatCurrency = (value) => {
    if (typeof value !== "number") return "$0.00"
    return `$${value.toFixed(2)}`
  }

  const formatPercentage = (value) => {
    if (typeof value !== "number") return "0%"
    return `${value.toFixed(2)}%`
  }

  const formatNumber = (value) => {
    if (typeof value !== "number") return "0"
    return value.toLocaleString()
  }

  const getCellValue = (row, columnId) => {
    const value = row[columnId]

    if (
      columnId.includes("spend") ||
      columnId.includes("cpc") ||
      columnId.includes("cpm") ||
      columnId.includes("cost_per_result")
    ) {
      return formatCurrency(value)
    }

    if (columnId.includes("ctr")) {
      return formatPercentage(value)
    }

    if (typeof value === "number") {
      return formatNumber(value)
    }

    return value
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white pl-10"
              />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
              <Eye className="h-4 w-4" />
              Columns
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white">
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={column.visible}
                onCheckedChange={() => toggleColumnVisibility(column.id)}
              >
                {column.visible ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                {column.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex bg-purple-100 rounded border h-auto item-center justify-between mx-auto  p-2 overflow-x-auto">
        <button
        data-filter="all"
        className="tab justify-center flex items-center h-full px-4 rounded bg-purple-100 text-purple-900 font-medium"
        >All Clients
        </button>
        <button 
        data-filter="healthy" 
        className="tab justify-center flex items-center h-full px-4 rounded bg-purple-100 text-purple-900 font-medium">
        Healthy
        </button>
        <button 
        data-filter="warning"
        className=" tab justify-center flex items-center h-full px-4 rounded bg-purple-100 text-purple-900 font-medium" >
        Warning
        </button>
        <button
        data-filter="critical"
        className="tab justify-center flex items-center h-full px-4 rounded bg-purple-100 text-purple-900 font-medium"
        >Critical</button>
        <button  
        data-filter="active" 
        className="tab justify-center flex items-center h-full px-4 rounded bg-purple-100 text-purple-900 font-medium"
        >Active</button>
        <button  
        data-filter="inactive"
        className="tab justify-center flex items-center h-full px-4 rounded bg-purple-100 text-purple-900 font-medium"
        >Inactive</button>
      </div>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="border-b top-0 z-20">
            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted h-12 bg-muted/50">
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, column.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column.id)}
                  className={`  [&:has([role=checkbox])]:pr-2 border-r-muted/20 border-1 h-12    font-medium 
                    text-muted-foreground  min-w-[200px] px-4 select-none   
                     left-0    cursor-default`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => column.sortable && handleSort(column.id)}
                        className={`flex align-middle text-left items-center gap-1 ${
                          column.sortable ? "hover:text-foreground cursor-pointer" : "cursor-default"
                        }`}
                      >
                        {column.label}
                        {column.sortable && sortConfig.key === column.id && (
                          <span className="text-xs">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                        )}
                      </button>
                    </div>
                    <div>
                      {column.icons ? (
                        typeof column.icons === "function" ? (
                          (() => {
                            const Icon = column.icons;
                            return <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
                          })()
                        ) : (
                          <img
                            src={column.icons.src ? column.icons.src : column.icons}
                            alt={`${column.label} icon`}
                            className="h-4 w-4 text-muted-foreground flex-shrink-0 object-contain"
                          />
                        )
                      ) : (
                        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-center ">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-8  text-muted-foreground">
                  No client groups found
                </td>
              </tr>
            ) : (
              sortedData.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick(row.original)}
                  className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  {visibleColumns.map((column) => (
                    <td key={`${row.id}-${column.id}`} className="px-4 py-3 text-foreground">
                      {getCellValue(row, column.id)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {sortedData.length} of {flattenedData.length} client groups
      </div>
    </div>
  )
}
