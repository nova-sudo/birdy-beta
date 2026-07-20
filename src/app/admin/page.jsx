"use client"

import { useState, useEffect } from "react"
import { Search, Shield } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useAgencies, usePlatformStats, useAiQueries } from "@/lib/admin-api"
import AdminStatStrip from "@/components/admin/AdminStatStrip"
import AgenciesTable from "@/components/admin/AgenciesTable"
import AiQueriesPanel from "@/components/admin/AiQueriesPanel"
import StatsPanel from "@/components/admin/StatsPanel"
import ConversationViewer from "@/components/admin/ConversationViewer"
import UserConversationsDialog from "@/components/admin/UserConversationsDialog"

export default function AdminPage() {
  const [tab, setTab] = useState("agencies")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")

  // Debounce the agency search so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data: agenciesData, isLoading: agenciesLoading } = useAgencies(search)
  const { data: statsData, isLoading: statsLoading } = usePlatformStats()
  const { data: aiData, isLoading: aiLoading } = useAiQueries(7)

  // Conversation review dialogs
  const [chatsAgency, setChatsAgency] = useState(null)     // owner whose session list is open
  const [sessionId, setSessionId] = useState(null)          // open conversation thread

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-purple-600 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Admin</h1>
              <span className="text-[10px] font-bold uppercase tracking-wide text-purple-600 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5">Internal</span>
            </div>
            <p className="text-sm text-muted-foreground">Agencies, AI usage, and platform health at a glance.</p>
          </div>
        </div>

        {tab === "agencies" && (
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search agencies or owners…"
              className="w-full h-9 pl-9 pr-3 text-sm rounded-full bg-white border border-input focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
            />
          </div>
        )}
      </div>

      {/* Stat strip */}
      <AdminStatStrip kpis={statsData?.kpis} loading={statsLoading} />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList>
          <TabsTrigger value="agencies">Agencies</TabsTrigger>
          <TabsTrigger value="ai">AI queries</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="agencies">
          <AgenciesTable
            agencies={agenciesData?.agencies}
            loading={agenciesLoading}
            onViewChats={setChatsAgency}
          />
        </TabsContent>

        <TabsContent value="ai">
          <AiQueriesPanel data={aiData} loading={aiLoading} onOpenConversation={setSessionId} />
        </TabsContent>

        <TabsContent value="stats">
          <StatsPanel data={statsData} loading={statsLoading} />
        </TabsContent>
      </Tabs>

      {/* Conversation review */}
      <UserConversationsDialog
        agency={chatsAgency}
        onOpenSession={(sid) => setSessionId(sid)}
        onClose={() => setChatsAgency(null)}
      />
      <ConversationViewer sessionId={sessionId} onClose={() => setSessionId(null)} />
    </div>
  )
}
