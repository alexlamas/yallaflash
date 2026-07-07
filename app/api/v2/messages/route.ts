import { NextResponse } from "next/server";
import { getApiAuth } from "@/utils/supabase/api";
import { errorMessage, validateRequest } from "@/app/api/utils";
import type { Widget } from "@/app/v2/lib/types";

// Persists a client-composed assistant message (photo-extraction previews,
// pack lists, word pickers) so flow-critical widgets survive a reload
// instead of living only in client state.

type PersistRequest = {
  conversationId: string;
  content?: string;
  widgets?: Widget[];
};

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getApiAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const data = await req.json();
    if (!validateRequest<PersistRequest>(data, ["conversationId"])) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }
    const { conversationId } = data;
    const content = typeof data.content === "string" ? data.content : "";
    const widgets = Array.isArray(data.widgets) ? data.widgets : [];

    const { data: conversation, error: convError } = await supabase
      .from("v2_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();
    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const { data: message, error: insertError } = await supabase
      .from("v2_messages")
      .insert({ conversation_id: conversationId, role: "assistant", content, widgets })
      .select("*")
      .single();
    if (insertError) throw insertError;

    return NextResponse.json({ message });
  } catch (error) {
    console.error("[v2/messages]", error);
    return NextResponse.json({ error: `Saving the message failed: ${errorMessage(error)}` }, { status: 500 });
  }
}
