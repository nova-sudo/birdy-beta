"use client"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react"
import { useColumnViews } from "@/lib/useColumnViews"
import { ViewLoading }    from "@/components/ui/ViewLoading"
import {
  SlidersHorizontal,
  Users,
  Mail,
  Phone,
  Globe,
  ChevronUp,
  ChevronDown,
  User,
  MapPin,
  Calendar,
  Tag,
  Building,
  Search,
  X,
  Megaphone,
  Layers,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Target,
  CalendarIcon,
  ChevronDown as ChevronDownIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { TiTag } from "react-icons/ti";
import { CiCalendar } from "react-icons/ci";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import ghl from "../../../public/ghl_icon.png";
import lab from "../../../public/lab.png";
import { Progress } from "@/components/ui/progress"
import { Loading } from "@/components/ui/loader";
import ColumnVisibilityDropdown from "@/components/ui/Columns-filter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format, subDays } from "date-fns"
import getSymbolFromCurrency from "currency-symbol-map";
import StyledTable from "@/components/ui/table-container"

const userCurrency = localStorage.getItem("user_default_currency");
const buildContactColumns = () => [
  {
    id: "contactName",
    header: "Name",
    label: "Name",
    defaultVisible: true,
    sortable: true,
    icons: ghl,
    cell: (value) =>
      !value || value === "Unknown" ? (
        <span className="text-muted-foreground text-sm px-2">-</span>
      ) : (
        <span className="text-sm text-foreground text-left block">{value}</span>
      ),
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
        <span className="text-muted-foreground font-bold text-sm">-</span>
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
        <span className="text-muted-foreground font-bold text-sm">-</span>
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
        <span className="text-muted-foreground text-sm">-</span>
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
        return <span className="text-muted-foreground text-sm">-</span>
      const tags = value
      const mainTag = tags[0]
      const hasMoreTags = tags.length > 1
      const score = row?.score ? `+${row.score}` : null
      return (
        <div className="flex items-center justify-center gap-2 max-w-xs">
          <Badge variant="secondary" className="flex items-center gap-1 text-xs">
            <TiTag className="w-3 h-3" />
            {mainTag}
          </Badge>
          {score && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {score}
            </span>
          )}
          {hasMoreTags && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs">+{tags.length - 1}</Badge>
              </TooltipTrigger>
              <TooltipContent className="bg-white ring-1 ring-gray-200 shadow-md p-2 max-h-48 overflow-y-auto">
                {tags.slice(1).map((tag, tagIndex) => (
                  <div key={`${tag}-${tagIndex}`} className="flex items-center gap-1 text-sm py-0.5">
                    <TiTag className="w-3 h-3" />{tag}
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
      if (!type) return <span className="text-muted-foreground text-sm">-</span>
      return <Badge variant="secondary" className="capitalize">{type}</Badge>
    },
  },
  {
    id: "opportunities",
    header: "Opportunities",
    label: "Opportunities",
    defaultVisible: true,
    sortable: false,
    icons: ghl,
    cell: (value) => {
      if (!value || value.length === 0)
        return <span className="text-muted-foreground text-sm">No opportunities</span>
      const opportunities = value
      const mainOpp = opportunities[0]
      const hasMoreOpps = opportunities.length > 1
      const oppStatus = mainOpp.status || "unknown"
      const oppValue = mainOpp.monetaryValue || 0
      const statusColors = {
        open:      "bg-[#DBEAFE] text-[#1D4ED8]",
        won:       "bg-[#DCFCE7] text-[#15803D]",
        lost:      "bg-[#FEE2E2] text-[#B91C1C]",
        abandoned: "bg-[#FEF9C3] text-[#A16207]",
      }
      return (
        <div className="flex items-center gap-2">
          <Badge className={`capitalize rounded-full ${statusColors[oppStatus] || "bg-gray-100"}`}>
            {oppStatus}
          </Badge>
          {oppValue > 0 && (
            <span className="text-sm font-semibold text-green-600">
              {getSymbolFromCurrency(userCurrency)}{oppValue.toLocaleString()}
            </span>
          )}
          {hasMoreOpps && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs">+{opportunities.length - 1}</Badge>
              </TooltipTrigger>
              <TooltipContent className="bg-white ring-1 ring-gray-200 shadow-md p-2 max-h-48 overflow-y-auto">
                {opportunities.slice(1).map((opp, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm py-1">
                    <Badge className={`capitalize text-xs ${statusColors[opp.status] || "bg-gray-100"}`}>
                      {opp.status}
                    </Badge>
                    {opp.monetaryValue > 0 && (
                      <span className="text-xs text-green-600">${opp.monetaryValue}</span>
                    )}
                  </div>
                ))}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )
    },
  },
  { id: "firstName",   header: "First Name",   label: "First Name",   defaultVisible: false, sortable: true, icons: ghl, cell: (v) => <span className="text-sm">{v || "-"}</span> },
  { id: "lastName",    header: "Last Name",    label: "Last Name",    defaultVisible: false, sortable: true, icons: ghl, cell: (v) => <span className="text-sm">{v || "-"}</span> },
  {
    id: "companyName",
    header: "Company",
    label: "Company",
    defaultVisible: false,
    sortable: true,
    icons: ghl,
    cell: (v) => !v
      ? <span className="text-muted-foreground text-sm">-</span>
      : <span className="text-sm font-medium text-foreground">{v}</span>,
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
      : <Badge variant="outline" className="capitalize">{v.split(",").map((s) => s.trim()).join(", ")}</Badge>,
  },
  { id: "city",       header: "City",        label: "City",        defaultVisible: false, sortable: true, icons: ghl, cell: (v) => <span className="text-sm">{v || "-"}</span> },
  { id: "state",      header: "State",       label: "State",       defaultVisible: false, sortable: true, icons: ghl, cell: (v) => <span className="text-sm">{v || "-"}</span> },
  { id: "postalCode", header: "Postal Code", label: "Postal Code", defaultVisible: false, sortable: true, icons: ghl, cell: (v) => <span className="text-sm">{v || "-"}</span> },
  {
    id: "country",
    header: "Country",
    label: "Country",
    defaultVisible: true,
    sortable: true,
    icons: ghl,
    cell: (v) => !v
      ? <span className="text-muted-foreground text-sm">-</span>
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
  { id: "assignedTo",  header: "Assigned To",   label: "Assigned To",  defaultVisible: false, sortable: true, icons: ghl, cell: (v) => <span className="text-sm">{v || "-"}</span> },
]

const contactColumns = buildContactColumns()

const DashboardStats = ({ contacts, filteredContacts, metaData }) => {
  const totalContacts = contacts.length
  const filteredTotal = filteredContacts.length
  const contactsWithEmail = filteredContacts.filter((c) => c.email && !c.email.startsWith("no_email_")).length
  const contactsWithPhone = filteredContacts.filter((c) => c.phone).length
  const contactsWithOpportunities = filteredContacts.filter((c) => 
    c.opportunities && c.opportunities.length > 0
  ).length
  const totalLeadValue = filteredContacts.reduce((sum, c) => {
    if (!c.opportunities) return sum
    const oppValue = c.opportunities.reduce((oppSum, opp) => 
      oppSum + (opp.monetaryValue || 0), 0
    )
    return sum + oppValue
  }, 0)
  const stats = [
    { title: "Total Contacts", value: filteredTotal, subtitle: totalContacts !== filteredTotal ? `of ${totalContacts}` : null, icon: Users },
    { title: "With Opportunities", value: contactsWithOpportunities, icon: Target },
    { title: "Total Lead Value", value: `${getSymbolFromCurrency(userCurrency)}${totalLeadValue.toLocaleString()}`, icon: DollarSign },
    { title: "With Email", value: contactsWithEmail, icon: Mail },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className="border shadow-sm rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-normal text-[#71658B] text-muted-foreground">{stat.title}</CardTitle>
            <div className="w-8 h-8 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
              <stat.icon className="h-4 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            {stat.subtitle && <p className="text-xs text-muted-foreground mt-0">{stat.subtitle}</p>}
            <p className="text-xs text-[#71658B] text-muted-foreground">Across all Leads</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function ContactPage() {
  const [contacts, setContacts] = useState([])
  const [metaData, setMetaData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(13)
  const [cursors, setCursors] = useState([null])
  const [currentPage, setCurrentPage] = useState(1)
  const { savedColumns, saveView: saveToDB, viewsLoaded } = useColumnViews("contacts")

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
  const [selectedDateRange, setSelectedDateRange] = useState("all")
  const [selectedOpportunityStatus, setSelectedOpportunityStatus] = useState("all")
  const [selectedTags, setSelectedTags] = useState([])
  const [sortColumn, setSortColumn] = useState("")
  const [sortDirection, setSortDirection] = useState("asc")
  const [clientGroups, setClientGroups] = useState([])
  const [selectedClientGroup, setSelectedClientGroup] = useState("all")
  const [selectedCategory, setSelectedCategory] = useState("columns")
  const [searchTerm, setSearchTerm] = useState("")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [columnVisibility, setColumnVisibility] = useState(
    contactColumns.reduce((acc, col) => {
      acc[col.id] = col.defaultVisible
      return acc
    }, {})
  )
  const columnVisibilityMap = useMemo(
    () => contactColumns.reduce(
      (acc, col) => ({ ...acc, [col.id]: visibleColumns.includes(col.id) }),
      {}
    ),
    [visibleColumns]
  )

  // Date range state - default to last 7 days
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 7),
    to: new Date(),
  })
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [tempDateRange, setTempDateRange] = useState(dateRange)

  // Fetch client groups
  useEffect(() => {
    const fetchClientGroups = async () => {
      try {
        const response = await fetch(`https://birdy-backend.vercel.app/api/client-groups`, { credentials: "include" })
        if (response.ok) {
          const data = await response.json()
          const ghlGroups = (data.client_groups || []).filter(g => g.ghl_location_id)
          setClientGroups(ghlGroups)
        }
      } catch (error) {
        console.error("Error fetching client groups:", error)
      }
    }
    fetchClientGroups()
  }, [])

  const fetchContacts = async (page = 1) => {
    setLoading(true)
    setError(null)
    try {
        if (clientGroups.length === 0) {
            setContacts([])
            setMetaData({ total_contacts: 0, has_next: false, has_prev: false })
            setLoading(false)
            return
        }

        const groupsParam = selectedClientGroup !== "all" ? selectedClientGroup : ""
        
        // Build URL with pagination and date range
        let url = `https://birdy-backend.vercel.app/api/contacts/ghl-paginated?groups=${groupsParam}&page=${page}&limit=100`
        
        // Add date range parameters
        if (dateRange.from) {
            url += `&start_date=${format(dateRange.from, 'yyyy-MM-dd')}`
        }
        if (dateRange.to) {
            url += `&end_date=${format(dateRange.to, 'yyyy-MM-dd')}`
        }

        console.log('🔍 Fetching contacts:', { url, dateRange })

        const response = await fetch(url, { credentials: "include" })
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

  useEffect(() => {
    if (clientGroups.length > 0) {
        fetchContacts(1) // Always start at page 1 when filters change
    }
  }, [selectedClientGroup, clientGroups.length, dateRange])

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
  }    if (selectedTags.length > 0) filtered = filtered.filter(c => c.tags?.some(t => selectedTags.includes(t)))

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
  }, [contacts, searchQuery, selectedSource, selectedType, selectedOpportunityStatus, selectedDateRange, selectedTags, sortColumn, sortDirection])

  const toggleColumn = (id) => setVisibleColumns(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const clearAllFilters = () => {
      setSearchQuery("")
      setSelectedSource("all")
      setSelectedType("all")
      setSelectedOpportunityStatus("all")
      setSelectedDateRange("all")
      setDateRange({
        from: subDays(new Date(), 7),
        to: new Date(),
      })
      setSelectedClientGroup("all")
      setSelectedTags([])
      setSortColumn("")
      setSortDirection("asc")
  }

  const hasActiveFilters = searchQuery || selectedSource !== "all" || selectedType !== "all" ||
    selectedOpportunityStatus !== "all" || selectedClientGroup !== "all" || 
    selectedTags.length > 0

  const categories = [
    { id: "columns", label: "Columns" },
    { id: "sources", label: "Sources" },
    { id: "types", label: "Types" },
    { id: "opportunities", label: "Opportunities" },
    { id: "tags", label: "Tags" },
  ];

  const filteredColumns = useMemo(() => {
    switch (selectedCategory) {
      case "columns":
        return contactColumns.filter(col =>
          col.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
      case "sources":
        return sources
          .filter(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(s => ({ id: s, label: s, visible: selectedSource === s }));
      case "types":
        return types
          .filter(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(t => ({ id: t, label: t, visible: selectedType === t }));
      case "opportunities":
        return opportunityStatuses
          .filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(o => ({ id: o, label: o, visible: selectedOpportunityStatus === o }));
      case "tags":
        return allTags
          .filter(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(t => ({ id: t, label: t, visible: selectedTags.includes(t) }));
      default:
        return [];
    }
  }, [
    selectedCategory,
    searchTerm,
    contactColumns,
    sources,
    types,
    opportunityStatuses,
    allTags,
    selectedSource,
    selectedType,
    selectedOpportunityStatus,
    selectedTags
  ]);

  const toggleColumnVisibility = (id) => {
    switch (selectedCategory) {
      case "columns":
        setVisibleColumns(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        break;
      case "sources":
        setSelectedSource(prev => prev === id ? "all" : id);
        break;
      case "types":
        setSelectedType(prev => prev === id ? "all" : id);
        break;
      case "opportunities":
        setSelectedOpportunityStatus(prev => prev === id ? "all" : id);
        break;
      case "tags":
        setSelectedTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        break;
    }
  }

  const selectAll = () => {
    switch (selectedCategory) {
      case "columns": setVisibleColumns(contactColumns.map(c => c.id)); break;
      case "sources": if (sources.length === 1) setSelectedSource(sources[0]); break;
      case "types": if (types.length === 1) setSelectedType(types[0]); break;
      case "opportunities": if (opportunityStatuses.length === 1) setSelectedOpportunityStatus(opportunityStatuses[0]); break;
      case "tags": setSelectedTags(allTags); break;
    }
  }

  const clearAll = () => {
    switch (selectedCategory) {
      case "columns": setVisibleColumns([]); break;
      case "sources": setSelectedSource("all"); break;
      case "types": setSelectedType("all"); break;
      case "opportunities": setSelectedOpportunityStatus("all"); break;
      case "tags": setSelectedTags([]); break;
    }
  }

  // Date range handlers
  const applyDateRange = () => {
    setDateRange(tempDateRange)
    setDatePickerOpen(false)
  }

  const resetDateRange = () => {
    const defaultRange = {
      from: subDays(new Date(), 7),
      to: new Date(),
    }
    setTempDateRange(defaultRange)
    setDateRange(defaultRange)
    setDatePickerOpen(false)
  }

  if (loading) {
    return (
      <Loading progress={progress}/>
    )
  }

  const handlePreviousPage = () => {
      if (currentPage > 1) {
          fetchContacts(currentPage - 1)
      }
  }  
  const handleNextPage = () => {
      if (metaData?.has_next) {
          fetchContacts(currentPage + 1)
      }
  }
  if (!viewsLoaded) return <ViewLoading />
   
  return (
    <div className="mx-auto w-[calc(100dvw-50px)] md:w-[calc(100dvw-100px)]">
      <div className="flex flex-col gap-8">
        {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-3xl lg:text-4xl font-bold text-foreground text-center md:text-left whitespace-nowrap">Lead Hub</h1>
          </div>

          <div className="flex items-center justify-between gap-2 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border rounded-lg
            py-1 px-1 flex-nowrap overflow-x-auto md:overflow-x-visible md:gap-1 md:py-1 md:px-1 w-fit mx-auto md:mx-1">
              <div className="flex items-center gap-1">
                <Input placeholder="Search contacts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="text-gray-900 bg-white h-10 max-w-[200px]  text-sm font-medium md:text-sm"/>
                  {searchQuery && <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}><X className="h-4 w-4" /></Button>}

            <div className="flex gap-1 md:overflow-x-visible">
              <Select value={selectedClientGroup} onValueChange={setSelectedClientGroup}>
                <SelectTrigger className="h-10 bg-white font-semibold"><Building className="h-4 w-4 hidden lg:inline" /><SelectValue placeholder="All Groups" /></SelectTrigger>
                <SelectContent className="bg-white"><SelectItem value="all">All Groups</SelectItem>{clientGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>

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
              

              {/* Enhanced Date Range Picker */}
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-auto h-10 justify-between font-semibold bg-white gap-2 px-3"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    <span className="hidden md:inline">
                      {dateRange.from && dateRange.to
                        ? `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}`
                        : "Select date range"}
                    </span>
                    <ChevronDownIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white" align="end">
                  <div className="p-3">
                    <CalendarComponent
                      mode="range"
                      defaultMonth={tempDateRange?.from}
                      selected={tempDateRange}
                      onSelect={(range) => {
                        if (range?.from && range?.to) {
                          setTempDateRange({ from: range.from, to: range.to })
                        } else if (range?.from) {
                          setTempDateRange({ from: range.from, to: range.from })
                        }
                      }}
                      numberOfMonths={2}
                      captionLayout="dropdown-buttons"
                      fromYear={2020}
                      toYear={new Date().getFullYear()}
                      disabled={(date) => date > new Date() || date < new Date("2020-01-01")}
                      className="rounded-lg border shadow-sm"
                    />

                    {/* Action buttons */}
                    <div className="flex items-center pt-3 border-t mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetDateRange}
                        className="border border-gray-300 rounded-md mr-2"
                      >
                        Reset
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDatePickerOpen(false)}
                          className="border border-gray-300 rounded-md mr-2"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={applyDateRange}
                          disabled={!tempDateRange.from || !tempDateRange.to}
                          className="rounded-md bg-purple-600 text-white font-semibold"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-10">Clear</Button>}
            </div>
            </div>
              
          </div>
        </div>


        <DashboardStats contacts={contacts} filteredContacts={filteredAndSortedContacts} metaData={metaData} />
        {filteredAndSortedContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center w-full rounded-lg border-2 border-dashed border-border bg-muted/20 py-16">
            <div className="rounded-full bg-muted p-3 mb-4">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No contacts found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Try adjusting your filters or search criteria, or verify your integration settings.
            </p>
          </div>
        ) : (
          <StyledTable
            columns={contactColumns}
            data={filteredAndSortedContacts}
            columnVisibility={columnVisibilityMap}
            searchQuery=""
            clickableFirstColumn={false}
          />
        )}
        <div className="flex justify-center gap-4">
          <Button 
            variant="ghost" 
            onClick={handlePreviousPage} 
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />Previous
          </Button>
          
          <span className="text-sm font-medium py-2">
            Page {currentPage} of {metaData?.total_pages || 1}
          </span>
          
          <Button 
            variant="ghost" 
            onClick={handleNextPage} 
            disabled={!metaData?.has_next}
          >
            Next<ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}