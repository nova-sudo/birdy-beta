"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

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
  { id: "website", label: "Website", defaultVisible: true, icon: Globe, sortable: true, width: "min-w-[200px]" },
  { id: "address1", label: "Address", defaultVisible: true, icon: MapPin, sortable: true, width: "min-w-[200px]" },
  { id: "country", label: "Country", defaultVisible: false, sortable: true, width: "min-w-[120px]" },
]

const ContactsTable = ({ contacts, visibleColumns }) => {
  const [sortColumn, setSortColumn] = useState("")
  const [sortDirection, setSortDirection] = useState("asc")

  const handleSort = (columnId) => {
    const newDirection = sortColumn === columnId && sortDirection === "asc" ? "desc" : "asc"
    setSortColumn(columnId)
    setSortDirection(newDirection)
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
        if (!contact[col.id]) {
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
        if (!contact[col.id]) {
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
          Get started by adding your first contact or check back later.
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
                key={contact.id || index}
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

const DashboardStats = ({ contacts }) => {
  const totalContacts = contacts.length
  const contactsWithEmail = contacts.filter((c) => c.email).length
  const contactsWithPhone = contacts.filter((c) => c.phone).length
  const contactsWithWebsite = contacts.filter((c) => c.website).length

  const stats = [
    {
      title: "Total Contacts",
      value: totalContacts,
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
      title: "With Website",
      value: contactsWithWebsite,
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
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function ContactPage() {
  const params = useParams()
  const router = useRouter()
  const locationId = params.locationId

  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [visibleColumns, setVisibleColumns] = useState(
    contactColumns.filter((col) => col.defaultVisible).map((col) => col.id),
  )

  const fetchContacts = async () => {
    setLoading(true)
    try {
      const isGhl = locationId.startsWith("ghl-")
      const isMeta = locationId.startsWith("meta-")

      if (!isGhl && !isMeta) {
        console.error("[v0] Invalid locationId format:", locationId)
        setContacts([])
        setLoading(false)
        return
      }

      const actualId = locationId.replace(/^(ghl-|meta-)/, "")

      let response
      if (isGhl) {
        response = await fetch(`http://localhost:5000/api/location/${actualId}/contacts?limit=100`, {
          credentials: "include",
        })
      } else {
        response = await fetch(`http://localhost:5000/api/facebook/adaccounts/${actualId}/leads`, {
          credentials: "include",
        })
      }

      if (response.status === 401) {
        console.error("[v0] Unauthorized - redirecting to login")
        router.push("/login")
        return
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch contacts: ${response.status}`)
      }

      const data = await response.json()

      console.log("[v0] API Response:", JSON.stringify(data, null, 2))

      let contactsData = []
      if (isGhl) {
        contactsData = data.contacts || []
        contactsData = contactsData.map((contact) => ({
          ...contact,
          contactName:
            contact.contactName ||
            contact.name ||
            (contact.firstName && contact.lastName
              ? `${contact.firstName} ${contact.lastName}`.trim()
              : contact.firstName || contact.lastName || ""),
          phone: contact.phone || contact.phoneNumber || "",
          email: contact.email || "",
        }))
      } else {
        contactsData = data.data || []
        contactsData = contactsData.map((lead) => ({
          id: lead.id,
          contactName: lead.full_name || "",
          email: lead.email || "",
          phone: lead.phone_number || "",
          source: lead.platform || "Meta",
          dateAdded: lead.created_time || "",
          tags: [],
          contactType: "Lead",
          website: "",
          address1: "",
          country: "",
        }))
      }

      if (contactsData.length === 0) {
        console.log("[v0] No contacts found for this client")
        setContacts([])
        return
      }

      setContacts(contactsData)
      console.log(`[v0] Successfully loaded ${contactsData.length} contacts`)
    } catch (error) {
      console.error("[v0] Error fetching contacts:", error)
      setContacts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContacts()
  }, [locationId])

  const toggleColumn = (columnId) => {
    setVisibleColumns((current) =>
      current.includes(columnId) ? current.filter((id) => id !== columnId) : [...current, columnId],
    )
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-semibold text-muted-foreground">Loading contacts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background rounded-t-2xl ring-1 ring-purple-100 mx-auto max-w-7xl">
      <div className="flex flex-col gap-8 p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push("/clients")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Contact Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage and view all your contacts</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => fetchContacts()} className="gap-2">
              Refresh Contacts
            </Button>
          </div>
        </div>

        <DashboardStats contacts={contacts} />

        <div className="flex flex-col gap-4 p-4 rounded-lg border bg-card">
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Contact List</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {contacts.length} {contacts.length === 1 ? "contact" : "contacts"} found
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

        <ContactsTable contacts={contacts} visibleColumns={visibleColumns} />
      </div>
    </div>
  )
}
