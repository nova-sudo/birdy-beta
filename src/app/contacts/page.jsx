"use client"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react"
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

const contactColumns = [
  { id: "contactName", label: "Name", defaultVisible: true, sortable: true, width: "min-w-[200px]" },
  { id: "groupName", label: "Group", defaultVisible: true, sortable: true, width: "min-w-[200px]", icons: ghl },
  { id: "email", label: "Email", defaultVisible: true, sortable: true, width: "min-w-[250px]", icons: ghl },
  { id: "phone", label: "Phone", defaultVisible: true, sortable: true, width: "min-w-[150px]", icons: ghl },
  { id: "source", label: "Source", defaultVisible: true, sortable: true, width: "min-w-[120px]", icons: lab },
  { id: "dateAdded", label: "Date Added", defaultVisible: true, sortable: true, width: "min-w-[130px]", icons: ghl},
  { id: "tags", label: "Tags", defaultVisible: true, width: "min-w-[150px]", icons: ghl },
  { id: "contactType", label: "Type", defaultVisible: true, sortable: true, width: "min-w-[120px]" , icons: ghl},
  { id: "opportunityStatus", label: "Opportunity", defaultVisible: true, sortable: true, width: "min-w-[150px]", icons: ghl },
  { id: "pipelineStage", label: "Stage", defaultVisible: true, sortable: true, width: "min-w-[180px]", icons: ghl },
  { id: "leadValue", label: "Value", defaultVisible: true, sortable: true, width: "min-w-[120px]", icons: ghl },
  { id: "website", label: "Website", defaultVisible: false, sortable: true, width: "min-w-[200px]" , icons: ghl},
  { id: "address1", label: "Address", defaultVisible: false, sortable: true, width: "min-w-[200px]" , icons: ghl},
  { id: "country", label: "Country", defaultVisible: true, sortable: true, width: "min-w-[120px]", icons: ghl },
]

const ContactsTable = ({ contacts, visibleColumns, sortColumn, sortDirection, onSort }) => {
  const handleSort = (columnId) => {
    const newDirection = sortColumn === columnId && sortDirection === "asc" ? "desc" : "asc"
    onSort(columnId, newDirection)
  }

  const renderCellContent = (contact, col) => {
    switch (col.id) {
      case "opportunityStatus":
        if (!contact.opportunityStatus) {
          return <span className="text-muted-foreground text-sm">-</span>
        }
        const statusColors = {
          open: "bg-[#DBEAFE] text-[#1D4ED8] rounded-full",
          won: "bg-[#DCFCE7] text-[#15803D] rounded-full",
          lost: "bg-[#FEE2E2] text-[#B91C1C] rounded-full",
          abandoned: "bg-[#FEF9C3] text-[#A16207] rounded-full"
        }
        return (
          <Badge className={`capitalize ${statusColors[contact.opportunityStatus] || "bg-gray-100"}`}>
            {contact.opportunityStatus}
          </Badge>
        )

      case "pipelineStage":
        if (!contact.pipelineStage) {
          return <span className="text-muted-foreground justify-center text-gray-600 px-20 text-sm">-</span> 
        }
        return (
          <span className="text-sm font-medium text-foreground">{contact.pipelineStage}</span>
        )

      case "leadValue":
        if (!contact.leadValue) {
          return <span className="text-muted-foreground justify-center text-gray-600 px-20 text-sm">-</span>
        }
        return (
          <span className="text-sm font-semibold text-green-600 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> 
            {contact.leadValue}
          </span>
        )

      case "tags":
        if (!contact[col.id] || contact[col.id].length === 0) {
          return <span className="text-muted-foreground text-sm">-</span>
        }

        const tags = contact[col.id];
        const mainTag = tags[0];
        const hasMoreTags = tags.length > 1;
        const score = contact.score ? `+${contact.score}` : null;

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
                  <Badge variant="outline" className="text-xs">
                    +{tags.length - 1}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="bg-white ring-1 ring-gray-200 shadow-md gap-1 p-2 max-h-48 overflow-y-auto">
                  {tags.slice(1).map((tag, tagIndex) => (
                    <div key={`${tag}-${tagIndex}`} className="flex items-center gap-1 text-sm py-0.5">
                      <TiTag className="w-3 h-3" />
                      {tag}
                    </div>
                  ))}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )

      case "dateAdded":
        if (!contact[col.id]) {
          return <span className="text-muted-foreground text-sm">-</span>
        }
        return (
          <span className="text-sm text-foreground">
            {new Date(contact[col.id]).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        )

      case "contactType":
        const type = contact.contactType || contact.type
        if (!type) {
          return <span className="">-</span>
        }
        return (
          <Badge variant="secondary" className="capitalize">
            {type}
          </Badge>
        )

      case "address1":
        const address = contact.address1 || contact.address
        if (!address) {
          return <span className="text-muted-foreground justify-center text-gray-600 px-20 text-sm">-</span>
        }
        return (
          <span className="text-sm text-foreground max-w-xs truncate block" title={address}>
            {address}
          </span>
        )

      case "email":
        if (!contact[col.id] || contact[col.id].startsWith("no_email_")) {
          return <span className="text-muted-foreground font-bold text-sm">-</span>
        }
        return (
          <a
            href={`mailto:${contact[col.id]}`}
            className="text-sm text-foreground hover:text-primary font-bold hover:underline transition-colors font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            {contact[col.id]}
          </a>
        )

      case "phone":
        if (!contact[col.id]) {
          return <span className="text-muted-foreground font-bold text-sm">-</span>
        }
        return (
          <a
            href={`tel:${contact[col.id]}`}
            className="text-sm text-foreground hover:text-primary hover:underline transition-colors font-mono"
            onClick={(e) => e.stopPropagation()}
          >
            {contact[col.id]}
          </a>
        )

      case "contactName":
        if (!contact[col.id] || contact[col.id] === "Unknown") {
          return <span className="text-muted-foreground justify-center text-gray-600 px-20 text-sm">-</span>
        }
        return (
          <span className="text-sm text-foreground text-left block">
            {contact[col.id]}
          </span>
        )

      case "website":
        if (!contact[col.id]) {
          return <span className="text-muted-foreground justify-center text-gray-600 px-20 text-sm">-</span>
        }
        const websiteUrl = contact[col.id].startsWith("http") ? contact[col.id] : `https://${contact[col.id]}`
        return (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-foreground hover:text-primary hover:underline transition-colors max-w-xs truncate inline-block"
            title={contact[col.id]}
            onClick={(e) => e.stopPropagation()}
          >
            {contact[col.id]}
          </a>
        )

      case "source":
        if (!contact[col.id]) {
          return <span className="text-muted-foreground justify-center text-gray-600 px-20 text-sm">-</span>
        }
        return (
          <Badge variant="outline" className="capitalize">
            {contact[col.id]
              .split(",")
              .map((s) => s.trim())
              .join(", ")}
          </Badge>
        )

      case "country":
      case "campaignName":
      case "adName":
      case "platform":
      case "groupName":
        if (!contact[col.id]) {
          return <span className="text-muted-foreground text-sm">-</span>
        }
        return (
          <div className="truncate px-2" title={contact[col.id]}>
            <span className="text-sm font-medium text-foreground">
              {contact[col.id]}
            </span>
          </div>
        )
      default:
        return <span>{contact[col.id] || "-"}</span>
    }
  }

  const visibleColumnsData = contactColumns.filter((col) => visibleColumns.includes(col.id))

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-[calc(100dvw-100px)] rounded-lg border-2 border-dashed border-border bg-muted/20">
        <div className="rounded-full bg-muted p-3 mb-4">
          <Users className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No contacts found</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Try adjusting your filters or search criteria, or verify your integration settings.
        </p>
      </div>
    )
  }

  return (
    <div className="border bg-card overflow-hidden rounded-md w-full">
      <style jsx>{`
        @media (min-width: 768px) {
          .fixed-column-even { position: sticky; left: 0; background: white; z-index: 50; min-width: 243px; font-weight: 600; }
          .fixed-column-odd { position: sticky; left: 0; background: #f4f3f9; z-index: 50; min-width: 243px; font-weight: 600; }
          .fixed-header { position: sticky; left: 0; z-index: 50; background: white; min-width: 150px; }
        }
        @media (max-width: 767px) {
          .fixed-column-even, .fixed-column-odd { background: white; min-width: 200px; font-weight: 600; }
          .fixed-column-odd { background: #f4f3f9; }
          .fixed-header { background: white; min-width: 150px; }
        }
      `}</style>
      <div className="overflow-x-auto">
        <table className="text-sm w-full table-auto">
          <thead>
            <tr className="h-12 bg-muted/50">
              {visibleColumnsData.map((col) => (
                <th
                  key={col.id}
                  className={`font-semibold bg-white text-gray-900/78 select-none cursor-default ${
                    col.id === "contactName" ? "fixed-header" : "min-w-[135px] whitespace-nowrap"
                  }`}
                  onClick={() => col.sortable && handleSort(col.id)}
                >
                  <div className="flex items-center justify-between gap-2 px-2 h-full border border-2 border-l-0 border-t-0 border-b-0 border-[#e4e4e7]">
                    <div className="flex items-center gap-2">
                      <span className="px-1">{col.label}</span>
                      {col.sortable && sortColumn === col.id && (
                        sortDirection === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </div>
                    {col.icons && <img src={col.icons.src} alt="" className="w-4 h-4" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y text-center">
            {contacts.map((contact, index) => (
              <tr
                key={contact.contactId || index}
                className={`hover:bg-muted/50 cursor-pointer transition-colors ${index % 2 === 0 ? "bg-[#F4F3F9]" : "bg-white"}`}
              >
                {visibleColumnsData.map((col) => (
                  <td
                    key={col.id}
                    className={`text-foreground truncate ${
                      col.id === "contactName"
                        ? index % 2 === 0 ? "fixed-column-odd" : "fixed-column-even"
                        : ""
                    }`}
                  >
                    <div className={col.id === "contactName" ? "py-5 px-4 border border-2 border-l-0 border-t-0 border-b-0 border-[#e4e4e7]" : ""}>
                      {renderCellContent(contact, col)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const DashboardStats = ({ contacts, filteredContacts, metaData }) => {
  const totalContacts = contacts.length
  const filteredTotal = filteredContacts.length
  const contactsWithEmail = filteredContacts.filter((c) => c.email && !c.email.startsWith("no_email_")).length
  const contactsWithPhone = filteredContacts.filter((c) => c.phone).length
  const contactsWithOpportunities = filteredContacts.filter((c) => c.opportunityStatus).length
  const totalLeadValue = filteredContacts.reduce((sum, c) => sum + (c.leadValue || 0), 0)

  const stats = [
    { title: "Total Contacts", value: filteredTotal, subtitle: totalContacts !== filteredTotal ? `of ${totalContacts}` : null, icon: Users },
    { title: "With Opportunities", value: contactsWithOpportunities, icon: Target },
    { title: "Total Lead Value", value: `$${totalLeadValue.toLocaleString()}`, icon: DollarSign },
    { title: "With Email", value: contactsWithEmail, icon: Mail },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <div className="p-2 bg-purple-100 rounded-md">
              <stat.icon className="h-5 w-5 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            {stat.subtitle && <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function ContactPage() {
  const [contacts, setContacts] = useState([])
  const [webhookData, setWebhookData] = useState([])
  const [webhookLoading, setWebhookLoading] = useState(true)
  const [metaData, setMetaData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(13)
  const [cursors, setCursors] = useState([null])
  const [currentPage, setCurrentPage] = useState(1)

  const [visibleColumns, setVisibleColumns] = useState(
    contactColumns.filter((col) => col.defaultVisible).map((col) => col.id)
  )

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
        const response = await fetch(`http://localhost:3005/api/client-groups`, { credentials: "include" })
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

  // Fetch webhook data (non-blocking)
  useEffect(() => {
    const fetchWebhooks = async () => {
      setWebhookLoading(true)
      try {
        const response = await fetch(`http://localhost:3005/api/webhook-data?limit=10000`, { credentials: "include" })
        if (response.ok) {
          const data = await response.json()
          setWebhookData(data.data || [])
        } else {
          setWebhookData([])
        }
      } catch (error) {
        console.error("Error fetching webhooks:", error)
        setWebhookData([])
      } finally {
        setWebhookLoading(false)
      }
    }
    fetchWebhooks()
  }, [])

  // Enrich contacts when webhook data arrives
  useEffect(() => {
    if (contacts.length > 0 && webhookData.length > 0) {
      const webhookByContactId = new Map()
      const webhookByEmail = new Map()

      webhookData.forEach(webhook => {
        const contactId = webhook.contact_id
        const email = webhook.data?.email
        if (contactId) webhookByContactId.set(contactId, webhook.data)
        if (email && typeof email === 'string' && email.trim() && !email.startsWith('no_email_')) {
          webhookByEmail.set(email.trim().toLowerCase(), webhook.data)
        }
      })

      const enriched = contacts.map(contact => {
        let info = webhookByContactId.get(contact.contactId)
        if (!info && contact.email) {
          const normEmail = contact.email.trim().toLowerCase()
          if (normEmail && !normEmail.startsWith('no_email_')) {
            info = webhookByEmail.get(normEmail)
          }
        }
        if (info) {
          return {
            ...contact,
            opportunityStatus: info.status,
            pipelineStage: info.pipleline_stage || info.pipeline_stage,
            leadValue: info.lead_value,
            opportunityName: info.opportunity_name,
            opportunitySource: info.opportunity_source || info.source,
          }
        }
        return contact
      })

      setContacts(enriched)
    }
  }, [webhookData])

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
        let url = `http://localhost:3005/api/contacts/ghl-paginated?groups=${groupsParam}&page=${page}&limit=100`
        
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
    if (selectedOpportunityStatus !== "all") filtered = filtered.filter(c => c.opportunityStatus === selectedOpportunityStatus)
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

  return (
    <div className="mx-auto w-[calc(100dvw-30px)] md:w-[calc(100dvw-100px)]">
      <div className="flex flex-col gap-8">
        {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground text-center md:text-left">Lead Hub</h1>
          </div>

          <div className="flex items-center gap-2 bg-[#F3F1F9] ring-1 ring-gray-100 border rounded-lg p-1 overflow-x-auto">
            <Input placeholder="Search contacts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
             className="bg-white h-10 min-w-[150px] w-fit" />
            {searchQuery && <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}><X className="h-4 w-4" /></Button>}

            <div className="flex gap-1 overflow-x-auto">
              <Select value={selectedClientGroup} onValueChange={setSelectedClientGroup}>
                <SelectTrigger className="h-10 bg-white"><Building className="h-4 w-4 hidden lg:inline" /><SelectValue placeholder="All Groups" /></SelectTrigger>
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
                save={() => console.log("Save view clicked")}
              />

              {/* Enhanced Date Range Picker */}
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-auto justify-between font-semibold bg-white gap-2 px-3"
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
                    <div className="flex items-center justify-between pt-3 border-t mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetDateRange}
                      >
                        Reset
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDatePickerOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={applyDateRange}
                          disabled={!tempDateRange.from || !tempDateRange.to}
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

        {/* Date Range Indicator */}
        {dateRange.from && dateRange.to && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            <span>
              Showing data from {format(dateRange.from, "MMM dd, yyyy")} to {format(dateRange.to, "MMM dd, yyyy")}
              ({Math.ceil((dateRange.to - dateRange.from) / (1000 * 60 * 60 * 24))} days)
            </span>
          </div>
        )}

        <DashboardStats contacts={contacts} filteredContacts={filteredAndSortedContacts} metaData={metaData} />
        <ContactsTable contacts={filteredAndSortedContacts} visibleColumns={visibleColumns} sortColumn={sortColumn} sortDirection={sortDirection} onSort={(col, dir) => { setSortColumn(col); setSortDirection(dir) }} />

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