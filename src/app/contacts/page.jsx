"use client"
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react"
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
  TrendingUp,
  DollarSign,
  Target,
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
import metaa from "../../../public/meta-icon-DH8jUhnM.png";
import { Progress } from "@/components/ui/progress"

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
          <div
            className="truncate px-2"            
            title={contact[col.id]}                   
          >
            <span className="text-sm font-medium text-foreground">
              {contact[col.id]}
            </span>
          </div>
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
    <div className="border bg-card overflow-hidden rounded-md">
      <style jsx>{`
        .fixed-column-even {
          text-align: left;
          position: sticky;
          left: 0;
          background: white;
          z-index: 50;
          min-width: 243px;
          font-weight: 600;
        }
        .fixed-column-odd {
          text-align: left;
          position: sticky;
          left: 0;
          background: #F4F3F9;
          z-index: 50;
          min-width: 243px;
          font-weight: 600;
        }
        .fixed-header {
          position: sticky;
          left: 0;
          z-index: 50;
          background: white;
          min-width: 150px;
          width: full;
        }
        .table-container {
          position: relative;
          overflow: auto
        }
      `}</style>
      <div className="overflow-x-auto rounded-md">
        <table className="text-sm w-full table-auto rounded-md">
          <thead className="top-0 z-40">
            <tr className="transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted h-12 bg-muted/50">
              {visibleColumnsData.map((col) => (
                <th
                  key={col.id}
                  className={`h-12 font-semibold bg-white text-gray-900/78 select-none cursor-default ${
                    col.id === "contactName"
                      ? "fixed-header"
                      : "min-w-[135px] whitespace-nowrap"
                  }`}
                  onClick={() => col.sortable && handleSort(col.id)}
                >
                  <div className="flex items-center border border-2 border-l-0 border-t-0 border-b-0 px-2 border-[#e4e4e7] h-full  justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-1">{col.label}</span>
                      {col.sortable && sortColumn === col.id && (
                        <span>
                          {sortDirection === "asc" ? (
                            <ChevronUp size={14} className="text-foreground" />
                          ) : (
                            <ChevronDown size={14} className="text-foreground" />
                          )}
                        </span>
                      )}
                    </div>
                    {col.icons && (
                      <img
                        src={col.icons.src}
                        alt=""
                        className="w-4 h-4 text-muted-foreground"
                      />
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
                className={`hover:bg-muted/50 cursor-pointer transition-colors ${
                  index % 2 === 0 ? "bg-[#F4F3F9]" : "bg-white"
                }`}
              >
                {visibleColumnsData.map((col) => (
                  <td
                    key={col.id}
                    className={`text-foreground truncate ${
                      col.id === "contactName"
                        ? index % 2 === 0
                          ? "fixed-column-odd"
                          : "fixed-column-even"
                        : ""
                    }`}
                  >
                    <div
                      className={
                        col.id === "contactName"
                          ? "py-5 px-4  border border-2 border-l-0 border-t-0 border-b-0  border-[#e4e4e7]"
                          : ""
                      }
                    >
                      <span>{renderCellContent(contact, col)}</span>
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
    {
      title: "Total Contacts",
      value: filteredTotal,
      subtitle: totalContacts !== filteredTotal ? `of ${totalContacts}` : null,
      icon: Users,
    },
    {
      title: "With Opportunities",
      value: contactsWithOpportunities,
      icon: Target,
    },
    {
      title: "Total Lead Value",
      value: `$${totalLeadValue.toLocaleString()}`,
      icon: DollarSign,
    },
    {
      title: "With Email",
      value: contactsWithEmail,
      icon: Mail,
    },
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
  const [metaData, setMetaData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(13)
  const [cursors, setCursors] = useState([null])
  const [currentCursorIndex, setCurrentCursorIndex] = useState(0)
  const [visibleColumns, setVisibleColumns] = useState(
    contactColumns.filter((col) => col.defaultVisible).map((col) => col.id)
  )

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSource, setSelectedSource] = useState("all")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedDateRange, setSelectedDateRange] = useState("all")
  const [selectedOpportunityStatus, setSelectedOpportunityStatus] = useState("all")
  const [sortColumn, setSortColumn] = useState("")
  const [sortDirection, setSortDirection] = useState("asc")
  const [clientGroups, setClientGroups] = useState([])
  const [selectedClientGroup, setSelectedClientGroup] = useState("all")
  
  // Fetch client groups once on mount
  useEffect(() => {
    const fetchClientGroups = async () => {
      try {
        const response = await fetch(`https://birdy-backend.vercel.app/api/client-groups`, {
          credentials: "include",
        })
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

  // Fetch webhooks once on mount
  useEffect(() => {
    const fetchWebhooks = async () => {
      try {
        const webhooksResponse = await fetch(`https://birdy-backend.vercel.app/api/webhook-data?limit=1000`, {
          credentials: "include",
        })

        if (webhooksResponse.ok) {
          const webhooksData = await webhooksResponse.json()
          setWebhookData(webhooksData.data || [])
        }
      } catch (error) {
        console.error("Error fetching webhooks:", error)
      }
    }
    fetchWebhooks()
  }, [])

  const enrichContactsWithWebhooks = (contacts) => {
    const webhookByContactId = new Map()
    const webhookByEmail = new Map()
    
    webhookData.forEach(webhook => {
      const contactId = webhook.contact_id
      const email = webhook.data?.email
      
      if (contactId) {
        webhookByContactId.set(contactId, webhook.data)
      }
      
      if (email && typeof email === 'string' && email.trim() && !email.startsWith('no_email_')) {
        const normalizedEmail = email.trim().toLowerCase()
        webhookByEmail.set(normalizedEmail, webhook.data)
      }
    })

    return contacts.map(contact => {
      let webhookInfo = webhookByContactId.get(contact.contactId)
      
      if (!webhookInfo && contact.email) {
        const normalizedEmail = contact.email.trim().toLowerCase()
        if (normalizedEmail && !normalizedEmail.startsWith('no_email_')) {
          webhookInfo = webhookByEmail.get(normalizedEmail)
        }
      }
      
      if (webhookInfo) {
        return {
          ...contact,
          opportunityStatus: webhookInfo.status,
          pipelineStage: webhookInfo.pipleline_stage || webhookInfo.pipeline_stage,
          leadValue: webhookInfo.lead_value,
          opportunityName: webhookInfo.opportunity_name,
          opportunitySource: webhookInfo.opportunity_source || webhookInfo.source,
        }
      }
      
      return contact
    })
  }

  const fetchContacts = async (cursor = null, direction = 'next') => {
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

      let url = `https://birdy-backend.vercel.app/api/contacts/ghl-paginated?groups=${groupsParam}`
      if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`
      }

      const contactsResponse = await fetch(url, {
        credentials: "include",
      })

      if (!contactsResponse.ok) {
        throw new Error(`Failed to fetch contacts: ${contactsResponse.status}`)
      }

      const contactsData = await contactsResponse.json()
      
      const enrichedContacts = enrichContactsWithWebhooks(contactsData.contacts || [])

      setContacts(enrichedContacts)
      setMetaData(contactsData.meta || { total_contacts: 0, has_next: false, has_prev: false })

      if (direction === 'next' && contactsData.meta?.next_cursor) {
        const newCursors = [...cursors.slice(0, currentCursorIndex + 1), contactsData.meta.next_cursor]
        setCursors(newCursors)
      }

    } catch (error) {
      console.error("Error fetching contacts:", error)
      setError(error.message)
      setContacts([])
      setMetaData(null)
    } finally {
      setLoading(false)
    }
  }

  // Fetch contacts when cursor or group changes, but only after data is loaded
  useEffect(() => {
    if (clientGroups.length > 0) {
      const cursor = cursors[currentCursorIndex]
      fetchContacts(cursor)
    }
  }, [currentCursorIndex, selectedClientGroup, clientGroups.length])

  useEffect(() => {
    const intervals = [33, 50, 66, 80, 90];
    let step = 0;

    const timer = setInterval(() => {
      setProgress(intervals[step]);
      step += 1;
      if (step >= intervals.length) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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

  const opportunityStatuses = useMemo(() => {
    const statuses = [...new Set(contacts.map(c => c.opportunityStatus).filter(Boolean))]
    return statuses.sort()
  }, [contacts])

  const isSingleSource = sources.length === 1
  const noSources = sources.length === 0 && metaData && metaData.total_contacts === 0

  const filteredAndSortedContacts = useMemo(() => {
    let filtered = [...contacts]

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
          contact.opportunityName?.toLowerCase().includes(query) ||
          contact.pipelineStage?.toLowerCase().includes(query) ||
          contact.tags?.some(tag => tag.toLowerCase().includes(query))
        )
      })
    }

    if (selectedSource !== "all") {
      filtered = filtered.filter(contact => contact.source?.includes(selectedSource))
    }

    if (selectedType !== "all") {
      filtered = filtered.filter(contact => {
        const type = contact.contactType || contact.type
        return type === selectedType
      })
    }

    if (selectedOpportunityStatus !== "all") {
      filtered = filtered.filter(contact => contact.opportunityStatus === selectedOpportunityStatus)
    }

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

    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal = a[sortColumn]
        let bVal = b[sortColumn]

        if (sortColumn === "dateAdded") {
          aVal = aVal ? new Date(aVal).getTime() : 0
          bVal = bVal ? new Date(bVal).getTime() : 0
        } else if (sortColumn === "leadValue") {
          aVal = aVal || 0
          bVal = bVal || 0
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
  }, [contacts, searchQuery, selectedSource, selectedType, selectedOpportunityStatus, selectedDateRange, sortColumn, sortDirection])

  const toggleColumn = (columnId) => {
    setVisibleColumns((current) =>
      current.includes(columnId) ? current.filter((id) => id !== columnId) : [...current, columnId]
    )
  }

  const clearAllFilters = () => {
    setSearchQuery("")
    setSelectedSource("all")
    setSelectedType("all")
    setSelectedOpportunityStatus("all")
    setSelectedDateRange("all")
    setSelectedClientGroup("all")
    setSortColumn("")
    setSortDirection("asc")
  }

  const hasActiveFilters = searchQuery || selectedSource !== "all" || selectedType !== "all" || 
    selectedOpportunityStatus !== "all" || selectedDateRange !== "all" || selectedClientGroup !== "all"

  if (loading) {
    return (
      <div className="min-h-dvh w-full flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <div className="flex flex-col items-center gap-8 w-full max-w-md px-6">
          <div className="w-16 h-16 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <style>{`
                  @keyframes fly {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-8px); }
                  }
                  @keyframes wingFlap {
                    0%, 100% { transform: rotateZ(0deg); }
                    50% { transform: rotateZ(15deg); }
                  }
                  .bird-body {
                    animation: fly 2s ease-in-out infinite;
                  }
                  .bird-wing-left {
                    animation: wingFlap 0.6s ease-in-out infinite;
                    transform-origin: 35px 40px;
                  }
                  .bird-wing-right {
                    animation: wingFlap 0.6s ease-in-out infinite;
                    transform-origin: 65px 40px;
                  }
                `}</style>
              </defs>
              <g className="bird-body">
                <circle cx="50" cy="45" r="12" fill="currentColor" className="text-purple-700" />
                <circle cx="50" cy="32" r="10" fill="currentColor" className="text-purple-700" />
                <circle cx="53" cy="30" r="2" fill="white" />
                <polygon points="60,30 65,29 60,31" fill="currentColor" className="text-purple-700" />
                <polygon points="38,50 28,55 30,48" fill="currentColor" className="text-purple-700/70" />
              </g>
              <g className="bird-wing-left">
                <ellipse cx="40" cy="42" rx="8" ry="14" fill="currentColor" className="text-purple-700/80" />
              </g>
              <g className="bird-wing-right">
                <ellipse cx="60" cy="42" rx="8" ry="14" fill="currentColor" className="text-purple-700/80" />
              </g>
            </svg>
          </div>

          <div className="flex flex-col gap-3 text-center">
            <h2 className="text-2xl font-bold text-foreground">Loading your contacts</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Preparing your data. This should only take a moment.
            </p>
          </div>

          <div className="w-full flex flex-col gap-2">
            <Progress value={progress} className="w-full h-2" showLabel={false} />
            <p className="text-xs text-muted-foreground text-center font-medium">{Math.round(progress)}% complete</p>
          </div>

          <div className="flex gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse"
              style={{ animationDelay: "0.2s" }}
            />
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-primary/20 animate-pulse"
              style={{ animationDelay: "0.4s" }}
            />
          </div>
        </div>
      </div>
    )
  }

  const handlePreviousPage = () => {
    if (currentCursorIndex > 0) {
      setCurrentCursorIndex(prev => prev - 1)
    }
  }

  const handleNextPage = () => {
    if (metaData?.has_next) {
      setCurrentCursorIndex(prev => prev + 1)
    }
  }

  return (
    <div className="mx-auto w-full">
      <div className="flex flex-col gap-8">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
 
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Lead Hub</h1>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border padding-4px rounded-lg py-1 px-1">
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white rounded-lg h-10 px-3 placeholder:text-left placeholder:text-muted-foreground flex items-center"
            />
            <Select value={selectedClientGroup} onValueChange={setSelectedClientGroup}>
              <SelectTrigger className="gap-2 hover:bg-purple-100/75 bg-white font-semibold h-10">
                <Building className="h-4 w-4" />
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Groups</SelectItem>
                {clientGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}

            <Select value={selectedOpportunityStatus} onValueChange={setSelectedOpportunityStatus}>
              <SelectTrigger className="bg-white font-semibold h-10">
                <SelectValue placeholder="All Opportunities" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Opportunities</SelectItem>
                {opportunityStatuses.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-10 bg-white hover:bg-purple-100/75 font-semibold">
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

            <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
              <SelectTrigger className="gap-2 hover:bg-purple-100/75 h-10 bg-white font-semibold">
                <CiCalendar />
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

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-10"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        <DashboardStats
          className="bg-white"
          contacts={contacts}
          filteredContacts={filteredAndSortedContacts}
          metaData={metaData}
        />

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

        <div className="flex items-center justify-center">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentCursorIndex === 0}
              className="hover:bg-purple-200 gap-2"
            >
              <ChevronLeft size={14} className="text-foreground" />Previous
            </Button>

            <span className="text-sm font-medium gap-2">
              Page {currentCursorIndex + 1}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextPage}
              disabled={!metaData?.has_next}
              className="hover:bg-purple-200 gap-2"
            >
              Next<ChevronRight size={14} className="text-foreground" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}