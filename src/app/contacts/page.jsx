"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Loader2,
  ArrowLeft,
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
  Filter,
  Megaphone,
  Layers,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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

const contactColumns = [
  { id: "contactName", label: "Name", defaultVisible: true, icon: User, sortable: true, width: "min-w-[200px]" },
  { id: "email", label: "Email", defaultVisible: true, icon: Mail, sortable: true, width: "min-w-[250px]" },
  { id: "phone", label: "Phone", defaultVisible: true, icon: Phone, sortable: true, width: "min-w-[150px]" },
  { id: "source", label: "Source", defaultVisible: true, icon: Building, sortable: true, width: "min-w-[120px]" },
  {
    id: "dateAdded",
    label: "Date Added",
    defaultVisible: true,
    icon: Calendar,
    sortable: true,
    width: "min-w-[130px]",
  },
  { id: "tags", label: "Tags", defaultVisible: true, icon: Tag, width: "min-w-[150px]" },
  { id: "contactType", label: "Type", defaultVisible: true, sortable: true, width: "min-w-[120px]" },
  { id: "website", label: "Website", defaultVisible: false, icon: Globe, sortable: true, width: "min-w-[200px]" },
  { id: "address1", label: "Address", defaultVisible: false, icon: MapPin, sortable: true, width: "min-w-[200px]" },
  { id: "country", label: "Country", defaultVisible: true, sortable: true, width: "min-w-[120px]" },
  { id: "campaignName", label: "Campaign", defaultVisible: true, icon: Megaphone, sortable: true, width: "min-w-[200px]" },
  { id: "adName", label: "Ad Name", defaultVisible: true, icon: Megaphone, sortable: true, width: "min-w-[200px]" },
  { id: "platform", label: "Platform", defaultVisible: true, icon: Layers, sortable: true, width: "min-w-[120px]" },
  { id: "groupName", label: "Group", defaultVisible: true, icon: Users, sortable: true, width: "min-w-[200px]" },
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
          return <span className="text-muted-foreground text-sm">-</span>
        }
        return (
          <div className="flex flex-wrap gap-1.5 max-w-xs">
            {contact[col.id].slice(0, 3).map((tag, tagIndex) => (
              <Badge key={`${tag}-${tagIndex}`} variant="secondary">
                {tag}
              </Badge>
            ))}
            {contact[col.id].length > 3 && <Badge variant="outline">+{contact[col.id].length - 3}</Badge>}
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
          return <span className="text-muted-foreground text-sm">-</span>
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
          return <span className="text-muted-foreground text-sm">-</span>
        }
        return (
          <a
            href={`mailto:${contact[col.id]}`}
            className="text-sm text-foreground hover:text-primary hover:underline transition-colors font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            {contact[col.id]}
          </a>
        )

      case "phone":
        if (!contact[col.id]) {
          return <span className="text-muted-foreground text-sm">-</span>
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
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
              {contact[col.id].charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-foreground">{contact[col.id]}</span>
          </div>
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
          return <span className="text-muted-foreground text-sm">-</span>
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
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 p-16">
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
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b">
              {visibleColumnsData.map((col) => (
                <th
                  key={col.id}
                  className={`px-4 py-3 text-left text-sm font-medium text-foreground ${col.width || ""} ${
                    col.sortable ? "cursor-pointer hover:bg-muted transition-colors select-none" : ""
                  }`}
                  onClick={() => col.sortable && handleSort(col.id)}
                >
                  <div className="flex items-center gap-2">
                    {col.icon && <col.icon size={14} className="text-muted-foreground" />}
                    <span>{col.label}</span>
                    {col.sortable && sortColumn === col.id && (
                      <div className="ml-1">
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
          <tbody className="divide-y">
            {contacts.map((contact, index) => (
              <tr
                key={contact.contactId || index}
                className="hover:bg-muted/50 transition-colors duration-150 cursor-pointer group"
              >
                {visibleColumnsData.map((col) => (
                  <td key={col.id} className="px-4 py-3 align-top">
                    {renderCellContent(contact, col)}
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            {stat.subtitle && <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>}
          </CardContent>
        </Card>
      ))}
      {metaData && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Source Breakdown</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <p>GHL: {metaData.ghl_contacts_count}</p>
              <p>Meta: {metaData.meta_leads_count}</p>
              <p>Hot Prospector: {metaData.hotprospector_leads_count}</p>
            </div>
          </CardContent>
        </Card>
      )}
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
      <div className="min-h-dvh flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-semibold text-muted-foreground">Loading contacts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-8 p-4 md:p-8">
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
            <Button variant="outline" onClick={() => router.push("/clients")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">All Contacts</h1>
              <p className="text-sm text-muted-foreground mt-1">View all contacts from GHL, Meta, and Hot Prospector</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => fetchContacts()} className="gap-2">
              Refresh Contacts
            </Button>
          </div>
        </div>

        <DashboardStats contacts={contacts} filteredContacts={filteredAndSortedContacts} metaData={metaData} />

        {/* Filters Section */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters</span>
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2">
                      Active
                    </Badge>
                  )}
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8 gap-2">
                    <X className="h-3 w-3" />
                    Clear All
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
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
                </div>

                {/* Source Filter */}
                <Select value={selectedSource} onValueChange={setSelectedSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {sources.map(source => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Type Filter */}
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {types.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Date Range Filter */}
                <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 Days</SelectItem>
                    <SelectItem value="month">Last 30 Days</SelectItem>
                    <SelectItem value="year">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 p-4 rounded-lg border bg-card">
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Contact List</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredAndSortedContacts.length} {filteredAndSortedContacts.length === 1 ? "contact" : "contacts"} found
                {hasActiveFilters && ` (filtered from ${contacts.length})`}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-transparent">
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
          </div>
        </div>

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