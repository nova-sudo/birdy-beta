"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { useAgencies, usePlatformStats } from "@/lib/admin-api";
import AdminStatStrip from "@/components/admin/AdminStatStrip";
import AgenciesTable from "@/components/admin/AgenciesTable";
import ConversationViewer from "@/components/admin/ConversationViewer";
import UserConversationsDialog from "@/components/admin/UserConversationsDialog";

export default function AdminAgenciesPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounce the agency search so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: agenciesData, isLoading: agenciesLoading } = useAgencies(search);
  const { data: statsData, isLoading: statsLoading } = usePlatformStats();

  // Conversation review dialogs
  const [chatsAgency, setChatsAgency] = useState(null); // owner whose session list is open
  const [sessionId, setSessionId] = useState(null); // open conversation thread

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1F1B33]">Agency owners</h2>
          <p className="text-sm text-muted-foreground">
            Every agency on Birdy, with impersonation and conversation review.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search agencies or owners…"
            aria-label="Search agencies or owners"
            className="h-9 w-full rounded-full border border-input bg-white pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
      </div>

      <AdminStatStrip kpis={statsData?.kpis} loading={statsLoading} />

      <AgenciesTable
        agencies={agenciesData?.agencies}
        loading={agenciesLoading}
        onViewChats={setChatsAgency}
      />

      <UserConversationsDialog
        agency={chatsAgency}
        onOpenSession={(sid) => setSessionId(sid)}
        onClose={() => setChatsAgency(null)}
      />
      <ConversationViewer sessionId={sessionId} onClose={() => setSessionId(null)} />
    </div>
  );
}
