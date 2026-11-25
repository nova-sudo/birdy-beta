import { Suspense } from "react";
import { AgencyChat } from "@/components/agency/chat/agency-chat";

// Marketing Guru's Chat tab. It reads the client and the conversation to open from the address.
export default function MediaBuyerChatPage() {
  return (
    <Suspense fallback={null}>
      <AgencyChat section="buyer" />
    </Suspense>
  );
}
