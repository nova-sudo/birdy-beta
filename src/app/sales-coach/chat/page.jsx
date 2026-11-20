import { Suspense } from "react";
import { AgencyChat } from "@/components/agency/chat/agency-chat";

// Sales Coach's Chat tab. It reads the client and the conversation to open from the address.
export default function SalesCoachChatPage() {
  return (
    <Suspense fallback={null}>
      <AgencyChat section="coach" />
    </Suspense>
  );
}
