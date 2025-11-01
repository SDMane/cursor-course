// Get chat history from database
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createSupabaseClient } from "../_shared/supabase-client.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function handleCors(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
}

console.log("Get Chat History Function Started!");

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Validate request method
    if (req.method !== "GET" && req.method !== "POST") {
      throw new Error(`Method ${req.method} not allowed`);
    }

    // Initialize Supabase client
    const supabase = createSupabaseClient();

    // Get chat ID from query params or body
    const url = new URL(req.url);
    let chatId = url.searchParams.get("chatId");

    if (!chatId && req.method === "POST") {
      const body = await req.json();
      chatId = body.chatId;
    }

    if (chatId) {
      // Get specific chat session with messages
      const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (messagesError) {
        throw messagesError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          chatId,
          messages: messages || [],
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      // Get all chat sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from("chat_sessions")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(50);

      if (sessionsError) {
        throw sessionsError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          sessions: sessions || [],
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error) {
    console.error("Error fetching chat history:", error);
    const errorResponse = {
      error: error instanceof Error ? error.message : "An unknown error occurred",
      success: false,
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});

