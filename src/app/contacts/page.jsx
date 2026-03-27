"use client"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { useColumnViews } from "@/lib/useColumnViews"
import { useClientGroups } from "@/lib/useClientGroups"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import ColumnVisibilityDropdown from "@/components/ui/Columns-filter"
import StyledTable from "@/components/ui/table-container"
import { presetToDateRange } from "@/lib/date-utils"
import { apiRequest } from "@/lib/api"
import { buildContactColumns } from "@/lib/contact-columns"
import { ContactStats } from "@/components/contacts/ContactStats"
import { DateRangeSelect } from "@/components/DateRangeSelect"
import { ErrorBanner } from "@/components/ErrorBanner"

const contactColumns = buildContactColumns()

export default function ContactPage() {
  const [contacts, setContacts] = useState([])
  const [metaData, setMetaData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(13)
  const [currentPage, setCurrentPage] = useState(1)
  const { savedColumns, saveView: saveToDB, viewsLoaded } = useColumnViews("contacts")

  const {
    clientGroups: allClientGroups,
    loading: groupsLoading,
    datePreset: selectedDateRange,
    setDatePreset: setSelectedDateRange,
  } = useClientGroups(DEFAULT_DATE_PRESET)

  // Filter to GHL groups only (contacts page only shows GHL contacts)
  const ghlClientGroups = useMemo(
    () => allClientGroups.filter(g => g.ghl_location_id),
    [allClientGroups]
  )

  const [visibleColumns, setVisibleColumns] = useState(
    contactColumns.filter((col) => col.defaultVisible).map((col) => col.id)
  )
  useEffect(() => {
    if (!viewsLoaded || !savedColumns) return
    setVisibleColumns(savedColumns)
  }, [viewsLoaded, savedColumns])

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSource, setSelectedSource] = useState("all")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedOpportunityStatus, setSelectedOpportunityStatus] = useState("all")
  const [selectedTags, setSelectedTags] = useState([])
  const [sortColumn, setSortColumn] = useState("")
  const [sortDirection, setSortDirection] = useState("asc")
  const [selectedClientGroup, setSelectedClientGroup] = useState("all")
  const [selectedCategory, setSelectedCategory] = useState("columns")
  const [searchTerm, setSearchTerm] = useState("")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const columnVisibilityMap = useMemo(
    () => contactColumns.reduce(
      (acc, col) => ({ ...acc, [col.id]: visibleColumns.includes(col.id) }),
      {}
    ),
    [visibleColumns]
  )


  const fetchContacts = async (page = 1) => {
    setLoading(true)
    setError(null)
    try {
      if (ghlClientGroups.length === 0) {
        setContacts([])
        setMetaData({ total_contacts: 0, has_next: false, has_prev: false })
        setLoading(false)
        return
      }

      const groupsParam = selectedClientGroup !== "all" ? selectedClientGroup : ""

      // Convert preset to concrete date strings
      const { start_date, end_date } = presetToDateRange(selectedDateRange)

      let endpoint = `/api/contacts/ghl-paginated?groups=${groupsParam}&page=${page}&limit=15`

      if (start_date) endpoint += `&start_date=${start_date}`
      if (end_date) endpoint += `&end_date=${end_date}`

      const response = await apiRequest(endpoint)
      if (!response.ok) throw new Error(`Failed: ${response.status}`)

      const data = await response.json()
      setContacts(data.contacts || [])
      setMetaData(data.meta || { total_contacts: 0, has_next: false, has_prev: false })
      setCurrentPage(page)

    } catch (err) {
      setError(err.message)
      setContacts([])
      setMetaData(null)
    } finally {
      setLoading(false)
    }
  }

  // Re-fetch whenever the preset, group filter, or group list changes
  useEffect(() => {
    if (ghlClientGroups.length > 0) {
      fetchContacts(1)
    }
  }, [selectedClientGroup, ghlClientGroups.length, selectedDateRange])

  useEffect(() => {
    const intervals = [33, 50, 66, 80, 90]
    let step = 0
    const timer = setInterval(() => {
      setProgress(intervals[step])
      step++
      if (step >= intervals.length) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const sources = useMemo(() => {
    const set = new Set()
    contacts.forEach(c => c.source?.split(",").forEach(s => set.add(s.trim())))
    return [...set].sort()
  }, [contacts])

  const types = useMemo(() => [...new Set(contacts.map(c => c.contactType || c.type).filter(Boolean))].sort(), [contacts])
  const opportunityStatuses = useMemo(() => [...new Set(contacts.map(c => c.opportunityStatus).filter(Boolean))].sort(), [contacts])
  const allTags = useMemo(() => {
    const set = new Set()
    contacts.forEach(c => c.tags?.forEach(t => set.add(t.trim())))
    return [...set].sort()
  }, [contacts])

  const filteredAndSortedContacts = useMemo(() => {
    let filtered = [...contacts]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(c =>
        c.contactName?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.website?.toLowerCase().includes(q) ||
        c.address1?.toLowerCase().includes(q) ||
        c.country?.toLowerCase().includes(q) ||
        c.groupName?.toLowerCase().includes(q) ||
        c.tags?.some(t => t.toLowerCase().includes(q))
      )
    }

    if (selectedSource !== "all") filtered = filtered.filter(c => c.source?.includes(selectedSource))
    if (selectedType !== "all") filtered = filtered.filter(c => (c.contactType || c.type) === selectedType)
    if (selectedOpportunityStatus !== "all") {
      filtered = filtered.filter(c =>
        c.opportunities?.some(opp => opp.status === selectedOpportunityStatus)
      )
    }
    if (selectedTags.length > 0) filtered = filtered.filter(c => c.tags?.some(t => selectedTags.includes(t)))

    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal = a[sortColumn] ?? ""
        let bVal = b[sortColumn] ?? ""
        if (sortColumn === "dateAdded") { aVal = aVal ? new Date(aVal).getTime() : 0; bVal = bVal ? new Date(bVal).getTime() : 0 }
        if (sortColumn === "leadValue") { aVal = aVal || 0; bVal = bVal || 0 }
        if (typeof aVal === "string") { aVal = aVal.toLowerCase(); bVal = bVal.toLowerCase() }
        return (aVal < bVal ? -1 : 1) * (sortDirection === "asc" ? 1 : -1)
      })
    }

    return filtered
  }, [contacts, searchQuery, selectedSource, selectedType, selectedOpportunityStatus, selectedTags, sortColumn, sortDirection])

  const clearAllFilters = () => {
    setSearchQuery("")
    setSelectedSource("all")
    setSelectedType("all")
    setSelectedOpportunityStatus("all")
    setSelectedDateRange("last_7d")
    setSelectedClientGroup("all")
    setSelectedTags([])
    setSortColumn("")
    setSortDirection("asc")
  }

  const hasActiveFilters = searchQuery || selectedSource !== "all" || selectedType !== "all" ||
    selectedOpportunityStatus !== "all" || selectedClientGroup !== "all" ||
    selectedTags.length > 0 || selectedDateRange !== "last_7d"

  const categories = [
    { id: "columns", label: "Columns" },
    { id: "sources", label: "Sources" },
    { id: "types", label: "Types" },
    { id: "opportunities", label: "Opportunities" },
    { id: "tags", label: "Tags" },
  ]

  const filteredColumns = useMemo(() => {
    switch (selectedCategory) {
      case "columns":
        return contactColumns.filter(col =>
          col.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
      case "sources":
        return sources
          .filter(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(s => ({ id: s, label: s, visible: selectedSource === s }))
      case "types":
        return types
          .filter(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(t => ({ id: t, label: t, visible: selectedType === t }))
      case "opportunities":
        return opportunityStatuses
          .filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(o => ({ id: o, label: o, visible: selectedOpportunityStatus === o }))
      case "tags":
        return allTags
          .filter(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(t => ({ id: t, label: t, visible: selectedTags.includes(t) }))
      default:
        return []
    }
  }, [selectedCategory, searchTerm, sources, types, opportunityStatuses, allTags, selectedSource, selectedType, selectedOpportunityStatus, selectedTags])

  const toggleColumnVisibility = (id) => {
    switch (selectedCategory) {
      case "columns":
        setVisibleColumns(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
        break
      case "sources":
        setSelectedSource(prev => prev === id ? "all" : id)
        break
      case "types":
        setSelectedType(prev => prev === id ? "all" : id)
        break
      case "opportunities":
        setSelectedOpportunityStatus(prev => prev === id ? "all" : id)
        break
      case "tags":
        setSelectedTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
        break
    }
  }

  const selectAll = () => {
    switch (selectedCategory) {
      case "columns": setVisibleColumns(contactColumns.map(c => c.id)); break
      case "tags": setSelectedTags(allTags); break
      default: break
    }
  }

  const clearAll = () => {
    switch (selectedCategory) {
      case "columns": setVisibleColumns([]); break
      case "sources": setSelectedSource("all"); break
      case "types": setSelectedType("all"); break
      case "opportunities": setSelectedOpportunityStatus("all"); break
      case "tags": setSelectedTags([]); break
    }
  }

  // if (loading) {
  //   return (
  //     <Loading progress={progress} />
  //   )
  // }

  const handlePreviousPage = () => {
    if (currentPage > 1) fetchContacts(currentPage - 1)
  }
  const handleNextPage = () => {
    if (metaData?.has_next) fetchContacts(currentPage + 1)
  }


  return (
    <div className="mx-auto w-[calc(100dvw-70px)] md:w-[calc(100dvw-130px)]">
      <div className="flex flex-col gap-6">
        <ErrorBanner error={error} />

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-3xl lg:text-4xl font-bold text-foreground text-center md:text-left whitespace-nowrap">Lead Hub</h1>
          </div>

          <div className="flex items-center justify-between gap-2 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border rounded-lg
            py-1 px-1 flex-nowrap overflow-x-auto md:overflow-x-visible md:gap-1 md:py-1 md:px-1 w-fit mx-auto md:mx-0">
            <div className="flex items-center gap-1">
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="text-gray-900 bg-white h-10 w-fit md:w-55 text-sm font-medium md:text-sm"
              />
              {searchQuery && (
                <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
                  <X className="h-4 w-4" />
                </Button>
              )}

              <div className="flex gap-1 md:overflow-x-visible">
                <DateRangeSelect value={selectedDateRange} onChange={setSelectedDateRange} />

                <ColumnVisibilityDropdown
                  isOpen={isDropdownOpen}
                  setIsOpen={setIsDropdownOpen}
                  categories={categories}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  categoryCounts={{
                    columns: contactColumns.length,
                    sources: sources.length,
                    types: types.length,
                    opportunities: opportunityStatuses.length,
                    tags: allTags.length,
                  }}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  filteredColumns={filteredColumns}
                  columnVisibility={contactColumns.reduce((acc, c) => ({ ...acc, [c.id]: visibleColumns.includes(c.id) }), {})}
                  toggleColumnVisibility={toggleColumnVisibility}
                  selectAll={selectAll}
                  clearAll={clearAll}
                  save={async () => {
                    await saveToDB(visibleColumns)
                    setIsDropdownOpen(false)
                  }}
                />
                <Select value={selectedClientGroup} onValueChange={setSelectedClientGroup}>
                  <SelectTrigger className="h-10 bg-white font-semibold">
                    <SelectValue placeholder="All Groups" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Groups</SelectItem>
                    {ghlClientGroups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-10">
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <ContactStats metaStats={metaData?.stats} loading={loading} />

        {/* Opportunity Status Filter Tabs */}
        <Tabs value={selectedOpportunityStatus} onValueChange={setSelectedOpportunityStatus} className="w-full">
          <TabsList className="inline-flex h-auto items-center rounded-lg bg-muted/60 p-1 text-muted-foreground overflow-x-auto border border-border/50 shadow-sm w-full justify-start">
            <TabsTrigger
              value="all"
              className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-r last:border-r-0 border-b-2 border-transparent hover:bg-background/80 hover:text-foreground/90 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-r-0 data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-primary relative box-border"
            >
              All Leads
            </TabsTrigger>
            <TabsTrigger
              value="open"
              className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-r last:border-r-0 border-b-2 border-transparent hover:bg-background/80 hover:text-foreground/90 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-r-0 data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-primary relative box-border"
            >
              Open
            </TabsTrigger>
            <TabsTrigger
              value="won"
              className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-r last:border-r-0 border-b-2 border-transparent hover:bg-background/80 hover:text-foreground/90 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-r-0 data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-primary relative box-border"
            >
              Won
            </TabsTrigger>
            <TabsTrigger
              value="abandoned"
              className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-r last:border-r-0 border-b-2 border-transparent hover:bg-background/80 hover:text-foreground/90 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-r-0 data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-primary relative box-border"
            >
              Abandoned
            </TabsTrigger>
            <TabsTrigger
              value="lost"
              className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-r last:border-r-0 border-b-2 border-transparent hover:bg-background/80 hover:text-foreground/90 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-r-0 data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-primary relative box-border"
            >
              Lost
            </TabsTrigger>
          </TabsList>
        </Tabs>


          <StyledTable
            columns={contactColumns}
            data={filteredAndSortedContacts}
            columnVisibility={columnVisibilityMap}
            searchQuery=""
            clickableFirstColumn={false}
            isLoading={loading}
          />

        <div className="flex justify-center gap-4">
          <Button variant="ghost" onClick={handlePreviousPage} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4" />Previous
          </Button>
          <span className="text-sm font-medium py-2">
            Page {currentPage} of {metaData?.total_pages || 1}
          </span>
          <Button variant="ghost" onClick={handleNextPage} disabled={!metaData?.has_next}>
            Next<ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
