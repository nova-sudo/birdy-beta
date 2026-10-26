"use client";

import { useState, useEffect } from "react";
import { useAgencies, usePlatformStats } from "@/lib/admin-api";
import { ErrorState, SearchInput, Surface } from "@/components/ds";
import AdminHeader from "@/components/admin/AdminHeader";
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

  const {
    data: agenciesData,
    error: agenciesError,
    isLoading: agenciesLoading,
    mutate: refetchAgencies,
  } = useAgencies(search);
  const { data: statsData, isLoading: statsLoading } = usePlatformStats();

  // Conversation review dialogs
  const [chatsAgency, setChatsAgency] = useState(null); // owner whose session list is open
  const [sessionId, setSessionId] = useState(null); // open conversation thread

  return (
    <div className="flex flex-col gap-5">
      <AdminHeader
        title="Agency owners"
        description="Every agency on Birdy, with impersonation and conversation review."
      />

      <AdminStatStrip kpis={statsData?.kpis} loading={statsLoading} />

      {agenciesError && !agenciesData ? (
        <Surface>
          <ErrorState
            title="Couldn't load agencies"
            description="The request failed. The figures above may still be right."
            onRetry={() => refetchAgencies()}
          />
        </Surface>
      ) : (
        <AgenciesTable
          agencies={agenciesData?.agencies}
          loading={agenciesLoading}
          onViewChats={setChatsAgency}
          onDeleted={refetchAgencies}
          toolbar={
            <SearchInput
              value={searchInput}
              onChange={setSearchInput}
              debounceMs={0}
              placeholder="Search agencies or owners…"
              aria-label="Search agencies or owners"
              className="sm:w-72"
            />
          }
        />
      )}

      <UserConversationsDialog
        agency={chatsAgency}
        onOpenSession={(sid) => setSessionId(sid)}
        onClose={() => setChatsAgency(null)}
      />
      <ConversationViewer sessionId={sessionId} onClose={() => setSessionId(null)} />
    </div>
  );
}
