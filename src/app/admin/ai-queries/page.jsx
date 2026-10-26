"use client";

import { useState } from "react";
import { useAiQueries } from "@/lib/admin-api";
import AdminHeader from "@/components/admin/AdminHeader";
import AiQueriesPanel from "@/components/admin/AiQueriesPanel";
import ConversationViewer from "@/components/admin/ConversationViewer";

export default function AdminAiQueriesPage() {
  const { data: aiData, error: aiError, isLoading: aiLoading, mutate: refetchAi } = useAiQueries(7);
  const [sessionId, setSessionId] = useState(null); // open conversation thread

  return (
    <div className="flex flex-col gap-5">
      <AdminHeader
        title="AI queries"
        description="What owners ask Birdy about their data over the last 7 days."
      />

      <AiQueriesPanel
        data={aiData}
        loading={aiLoading}
        error={aiError}
        onRetry={() => refetchAi()}
        onOpenConversation={setSessionId}
      />
      <ConversationViewer sessionId={sessionId} onClose={() => setSessionId(null)} />
    </div>
  );
}
