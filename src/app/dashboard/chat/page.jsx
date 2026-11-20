import { Suspense } from "react";
import { AgencyChat } from "@/components/agency/chat/agency-chat";

// Agency Ops' Chat tab. It reads the client and the conversation to open from the address.
export default function AgencyChatPage() {
  return (
    <Suspense fallback={null}>
      <AgencyChat />
    </Suspense>
  );
}
