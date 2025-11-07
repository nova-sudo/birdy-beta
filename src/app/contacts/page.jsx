"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Loader2,
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
  icons,
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

const contactColumns = [
  { id: "contactName", label: "Name", defaultVisible: true, sortable: true, width: "min-w-[200px] " },
  { id: "email", label: "Email", defaultVisible: true, sortable: true, width: "min-w-[250px]", icons: ghl },
  { id: "phone", label: "Phone", defaultVisible: true, sortable: true, width: "min-w-[150px]", icons: ghl },
  { id: "source", label: "Source", defaultVisible: true, sortable: true, width: "min-w-[120px]", icons: lab },
  { id: "dateAdded", label: "Date Added", defaultVisible: true, sortable: true, width: "min-w-[130px]", icons: ghl},
  { id: "tags", label: "Tags", defaultVisible: true, width: "min-w-[150px]", icons: ghl },
  { id: "contactType", label: "Type", defaultVisible: true, sortable: true, width: "min-w-[120px]" , icons: ghl},
  { id: "website", label: "Website", defaultVisible: false, sortable: true, width: "min-w-[200px]" , icons: ghl},
  { id: "address1", label: "Address", defaultVisible: false, sortable: true, width: "min-w-[200px]" , icons: ghl},
  { id: "country", label: "Country", defaultVisible: true, sortable: true, width: "min-w-[120px]", icons: ghl },
  { id: "campaignName", label: "Campaign", defaultVisible: true, sortable: true, width: "min-w-[200px]", icons: ghl },
  { id: "adName", label: "Ad Name", defaultVisible: true, sortable: true, width: "min-w-[200px]" , icons: ghl},
  { id: "platform", label: "Platform", defaultVisible: true, sortable: true, width: "min-w-[120px]" , icons: ghl},
  { id: "groupName", label: "Group", defaultVisible: true, sortable: true, width: "min-w-[200px]", icons: ghl },
]

const ContactsTable = ({ contacts, visibleColumns, sortColumn, sortDirection, onSort }) => {
  const handleSort = (columnId) => {
    const newDirection = sortColumn === columnId && sortDirection === "asc" ? "desc" : "asc"
    onSort(columnId, newDirection)
  }

  const renderCellContent = (contact, col) => {
    switch (col.id) {
     case "tags":
  if (!contact[col.id] || contact[col.id].length === 0) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  const tags = contact[col.id];
  const mainTag = tags[0];
  const hasMoreTags = tags.length > 1;
  const score = contact.score ? `+${contact.score}` : null;

  return (
    <div className="flex items-center justify-center gap-2 max-w-xs">
      {/* Main Tag */}
      <Badge variant="secondary" className="flex items-center gap-1 text-xs">
        <TiTag className="w-3 h-3" />
        {mainTag}
      </Badge>

      {/* Score Badge */}
      {score && (
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
          {score}
        </span>
      )}

      {/* Hidden Tags Tooltip (+N) */}
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
  );
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
          return <span className=" ">-</span>
        }
        return (
          <Badge variant="secondary" className="capitalize">
            {type}
          </Badge>
        )

      case "address1":
        const address = contact.address1 || contact.address
        if (!address) {
          return <span className="text-muted-foreground text-sm">-</span>
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
            className="text-sm text-foreground hover:text-primary  font-bold hover:underline transition-colors font-medium"
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
          return <span className="text-muted-foreground text-sm">-</span>
        }
        return (
          <span className="text-sm text-foreground text-left block">
        {contact[col.id]}
          </span>
        )

      case "website":
        if (!contact[col.id]) {
          return <span className="text-muted-foreground text-sm">-</span>
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
          return <span className="text-muted-foreground text-sm">-</span>
        }
        return (
          <Badge variant="outline" className="capitalize">
            {contact[col.id]}
          </Badge>
        )

      case "country":
      case "campaignName":
      case "adName":
      case "platform":
      case "groupName":
        if (!contact[col.id]) {
          return <span className="text-muted-foreground font-bold text-sm">-</span>
        }
        return <span className="text-sm font-medium text-foreground">{contact[col.id]}</span>

      default:
        return (
          <span className="text-sm text-foreground">
            {contact[col.id] || <span className="text-muted-foreground">-</span>}
          </span>
        )
    }
  }

  const visibleColumnsData = contactColumns.filter((col) => visibleColumns.includes(col.id))

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-full rounded-lg border-2 border-dashed border-border bg-muted/20">
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
    <div className=" border bg-card overflow-hidden">
      <style jsx>{`

        .fixed-column-even {
          position: sticky;
          left: 0;
          background: white;
          z-index: 20;
          min-width: 243px;
          font-weight: 600;
        }
        .fixed-column-odd {
          position: sticky;
          left: 0;
          background: #F4F3F9;
          z-index: 20;
          min-width: 243px;
          font-weight: 600;
        }
        .fixed-header {
          position: sticky;
          left: 0;
          z-index: 30;
          background: white;
          min-width: 150px;
          width: full;
        }
        .table-container {
          position: relative;
          overflow: auto
      }
          `}</style>
      <div className="overflow-x-auto">
        <table className="text-sm w-full table-auto">
          <thead className="  top-0 z-40">
            <tr className=" transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted h-12 bg-muted/50">
              {visibleColumnsData.map((col) => (
                <th
                  key={col.id}
                  className={`h-12 font-semibold bg-white text-gray-900/78   select-none cursor-default ${
                    col.id === "contactName"
                      ? "fixed-header"
                      : "min-w-[135px]  whitespace-nowrap "
                  }`}
                  onClick={() => col.sortable && handleSort(col.id)}
                >           

                  <div className="flex items-center border border-2 border-l-0 border-t-0 border-b-0 px-2 border-[#e4e4e7] h-full  justify-between gap-2">
                    
                    <span className=" px-1 ">{col.label}</span>
                    {col.icons && <img src={col.icons.src} alt="" className="w-4   h-4 text-muted-foreground" />}
                    {col.sortable && sortColumn === col.id && (
                      <div className="flex item-center gap-1">
                        {sortDirection === "asc" ? (
                          <ChevronUp size={14} className="text-foreground" />
                        ) : (
                          <ChevronDown size={14} className="text-foreground" />
                        )}
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y text-center">
            {contacts.map((contact, index) => (
              <tr
                key={contact.contactId || index}
                className={` hover:bg-muted/50 cursor-pointer transition-colors ${
                    index % 2 === 0 ? "bg-[#F4F3F9]" : "bg-white"
                  }`}
              >
                {visibleColumnsData.map((col) => (
                  <td 
                  key={col.id} 
                  className={` text-foreground  truncate ${
                          col.id === "contactName"
                            ? index % 2 === 0
                              ? "fixed-column-odd"
                              : "fixed-column-even"
                            : ""
                        }`}
                  title={renderCellContent(contact, col).props.children}>
                    <div 
                     key={col.id}    
                     className={
                        col.id === "contactName" ? " py-3 px-4  border border-2 border-l-0 border-t-0 border-b-0 px-2 border-[#e4e4e7]" :
                           ""
                        }>
                      <span
                      
                       >
                      {renderCellContent(contact, col)}
                    </span>
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
  const contactsWithCountry = filteredContacts.filter((c) => c.country).length

  const stats = [
    {
      title: "Total Contacts",
      value: filteredTotal,
      subtitle: totalContacts !== filteredTotal ? `of ${totalContacts}` : null,
      icon: Users,
    },
    {
      title: "With Email",
      value: contactsWithEmail,
      icon: Mail,
    },
    {
      title: "With Phone",
      value: contactsWithPhone,
      icon: Phone,
    },
    {
      title: "With Country",
      value: contactsWithCountry,
      icon: Globe,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between  ">
            <CardTitle className="text-sm font-medium ">{stat.title}</CardTitle>
            <div className="p-2 bg-purple-100 rounded-md">
            <stat.icon className="h-5 w-5 text-purple-500 " />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function ContactPage() {
  const router = useRouter()

  const [contacts, setContacts] = useState([])
  const [metaData, setMetaData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [visibleColumns, setVisibleColumns] = useState(
    contactColumns.filter((col) => col.defaultVisible).map((col) => col.id),
  )

  // Filter states
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSource, setSelectedSource] = useState("all")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedDateRange, setSelectedDateRange] = useState("all")
  const [sortColumn, setSortColumn] = useState("")
  const [sortDirection, setSortDirection] = useState("asc")

  const fetchContacts = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`https://birdy-backend.vercel.app/api/contacts/all`, {
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch contacts: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      setContacts(data.contacts || [])
      setMetaData(data.meta || null)
    } catch (error) {
      console.error("Error fetching contacts:", error)
      setError(error.message)
      setContacts([])
      setMetaData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContacts()
  }, [])

  // Get unique sources and types for filters
  const sources = useMemo(() => {
    const uniqueSources = new Set()
    contacts.forEach(c => {
      if (c.source) {
        c.source.split(",").forEach(s => uniqueSources.add(s.trim()))
      }
    })
    return [...uniqueSources].sort()
  }, [contacts])

  const types = useMemo(() => {
    const uniqueTypes = [...new Set(contacts.map(c => c.contactType || c.type).filter(Boolean))]
    return uniqueTypes.sort()
  }, [contacts])

  // Check if only one source or no sources are present
  const isSingleSource = sources.length === 1
  const noSources = sources.length === 0 && metaData && metaData.total_contacts === 0

  // Apply filters and sorting
  const filteredAndSortedContacts = useMemo(() => {
    let filtered = [...contacts]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(contact => {
        return (
          contact.contactName?.toLowerCase().includes(query) ||
          contact.email?.toLowerCase().includes(query) ||
          contact.phone?.toLowerCase().includes(query) ||
          contact.website?.toLowerCase().includes(query) ||
          contact.address1?.toLowerCase().includes(query) ||
          contact.country?.toLowerCase().includes(query) ||
          contact.campaignName?.toLowerCase().includes(query) ||
          contact.adName?.toLowerCase().includes(query) ||
          contact.platform?.toLowerCase().includes(query) ||
          contact.groupName?.toLowerCase().includes(query) ||
          contact.tags?.some(tag => tag.toLowerCase().includes(query))
        )
      })
    }

    // Source filter
    if (selectedSource !== "all") {
      filtered = filtered.filter(contact => contact.source?.includes(selectedSource))
    }

    // Type filter
    if (selectedType !== "all") {
      filtered = filtered.filter(contact => {
        const type = contact.contactType || contact.type
        return type === selectedType
      })
    }

    // Date range filter
    if (selectedDateRange !== "all") {
      const now = new Date()
      filtered = filtered.filter(contact => {
        if (!contact.dateAdded) return false
        const contactDate = new Date(contact.dateAdded)
        
        switch (selectedDateRange) {
          case "today":
            return contactDate.toDateString() === now.toDateString()
          case "week":
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            return contactDate >= weekAgo
          case "month":
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            return contactDate >= monthAgo
          case "year":
            const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
            return contactDate >= yearAgo
          default:
            return true
        }
      })
    }

    // Sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal = a[sortColumn]
        let bVal = b[sortColumn]

        if (sortColumn === "dateAdded") {
          aVal = aVal ? new Date(aVal).getTime() : 0
          bVal = bVal ? new Date(bVal).getTime() : 0
        } else if (sortColumn === "contactType") {
          aVal = a.contactType || a.type || ""
          bVal = b.contactType || b.type || ""
        } else {
          aVal = aVal || ""
          bVal = bVal || ""
        }

        if (typeof aVal === "string") {
          aVal = aVal.toLowerCase()
          bVal = bVal.toLowerCase()
        }

        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [contacts, searchQuery, selectedSource, selectedType, selectedDateRange, sortColumn, sortDirection])

  const toggleColumn = (columnId) => {
    setVisibleColumns((current) =>
      current.includes(columnId) ? current.filter((id) => id !== columnId) : [...current, columnId],
    )
  }

  const clearAllFilters = () => {
    setSearchQuery("")
    setSelectedSource("all")
    setSelectedType("all")
    setSelectedDateRange("all")
    setSortColumn("")
    setSortDirection("asc")
  }

  const hasActiveFilters = searchQuery || selectedSource !== "all" || selectedType !== "all" || selectedDateRange !== "all"

  if (loading) {
    return (
      <div className="min-h-dvh w-full flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-semibold text-muted-foreground">Loading contacts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto   w-full">
      <div className="flex flex-col gap-8 ">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {noSources && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No Contacts Available</AlertTitle>
            <AlertDescription>
              No contacts were retrieved from GHL, Meta, or Hot Prospector. Please verify your integration settings (GHL: {metaData.ghl_contacts_count}, Meta: {metaData.meta_leads_count}, Hot Prospector: {metaData.hotprospector_leads_count}).
            </AlertDescription>
          </Alert>
        )}
        {isSingleSource && !noSources && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Single Source Detected</AlertTitle>
            <AlertDescription>
              All contacts are sourced from {sources[0]}. Please verify Meta and Hot Prospector integrations in your account settings.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Lead Hub</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-200/37 ring-1 ring-inset ring-gray-100 border padding-4px rounded-lg py-1 px-1">
                  <Input
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-white rounded-lg "
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  {/* Source Filter */}
                <Select value={selectedSource} onValueChange={setSelectedSource}>
                  <SelectTrigger className="bg-white font-semibold">
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent >
                    <SelectItem value="all">All Sources</SelectItem>
                    {sources.map(source => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Type Filter */}
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="bg-white font-semibold hover:bg-purble-200">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all" >All Types</SelectItem>
                    {types.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                  <DropdownMenu >
                  <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 bg-white hover:bg-purble-100/75 font-semibold">
                  <SlidersHorizontal className="h-4 w-4" />
                  Columns
                  </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-white">
                  <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {contactColumns.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={visibleColumns.includes(col.id)}
                    onCheckedChange={() => toggleColumn(col.id)}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                  ))}
                  </DropdownMenuContent>
                  </DropdownMenu>

                   {/* Date Range Filter */}
                <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                  <SelectTrigger className="bg-white font-semibold hover:bg-purble-100/75">
                    <CiCalendar/>
                    <SelectValue placeholder="All Time" />
                  </SelectTrigger>
                <SelectContent className="bg-white">
                    <SelectItem value="all" className="hover:bg-[#E8DFFB]">All Time</SelectItem> 
                    <SelectItem value="today" className="hover:bg-[#E8DFFB]">Today</SelectItem>
                    <SelectItem value="week" className="hover:bg-[#E8DFFB]">Last 7 Days</SelectItem>
                    <SelectItem value="month" className="hover:bg-[#E8DFFB]">Last 30 Days</SelectItem>
                    <SelectItem value="year" className="hover:bg-[#E8DFFB]">Last Year</SelectItem>
                  </SelectContent>
                </Select>
          </div>
        </div> 

        {/*cards row */}
        <DashboardStats
        className="bg-white"
        contacts={contacts} 
        filteredContacts={filteredAndSortedContacts} 
        metaData={metaData} 
        /> 
        
        {/*table */}
        <ContactsTable 
          
          contacts={filteredAndSortedContacts} 
          visibleColumns={visibleColumns}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={(col, dir) => {
            setSortColumn(col)
            setSortDirection(dir)
          }}
        />
      </div>
    </div>
  )
}