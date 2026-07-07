"use client";

import { V2Gate } from "@/app/v2/components/V2Gate";
import { ChatWindow } from "@/app/v2/components/ChatWindow";

// A logged-out visitor (shared link, expired session) gets the landing
// page with its signup CTA instead of a raw 401 error banner. V2 is
// admin-gated while it bakes -- everyone else keeps V1.
export default function ChatPage() {
  return (
    <V2Gate>
      <ChatWindow />
    </V2Gate>
  );
}
