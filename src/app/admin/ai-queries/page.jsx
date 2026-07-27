"use client";

import { useState } from "react";
import { useAiQueries } from "@/lib/admin-api";
import AiQueriesPanel from "@/components/admin/AiQueriesPanel";
import ConversationViewer from "@/components/admin/ConversationViewer";

export default function AdminAiQueriesPage() {
  const { data: aiData, isLoading: aiLoading } = useAiQueries(7);
  const [sessionId, setSessionId] = useState(null); // open conversation thread

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-[#1F1B33]">AI queries</h2>
        <p className="text-sm text-muted-foreground">
          What owners ask Birdy about their data over the last 7 days.
        </p>
      </div>

      <AiQueriesPanel data={aiData} loading={aiLoading} onOpenConversation={setSessionId} />
      <ConversationViewer sessionId={sessionId} onClose={() => setSessionId(null)} />
    </div>
  );
}
