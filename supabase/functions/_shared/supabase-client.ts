// Shared Supabase client for Edge Functions
import { createClient } from "jsr:@supabase/supabase-js@2";

export function createSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase credentials not found in environment variables");
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Database types
export interface ChatSession {
  id: string;
  created_at: string;
  updated_at: string;
  title: string | null;
}

export interface Message {
  id: string;
  created_at: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  type: "text" | "image";
  image_url: string | null;
}

