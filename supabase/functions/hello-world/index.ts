// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Remove this line since it's not being used:
// import { createClient } from "@supabase/supabase-js";

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
// How to fetch .env keys
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Hello from Functions!");

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Validate request method
    if (req.method !== "POST") {
      throw new Error(`Method ${req.method} not allowed`);
    }

    // Parse request body
    let name = "World";
    try {
      const body = await req.json();
      if (!body) {
        throw new Error("Missing request body");
      }
      if (typeof body.name !== "string") {
        throw new Error("Name must be a string");
      }
      name = body.name;
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error("Invalid JSON in request body");
      }
      throw err;
    }

    const data = { message: `Hello ${name}!` };
    return new Response(JSON.stringify(data), { headers: corsHeaders });
  } catch (error) {
    const errorResponse = {
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
      success: false,
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: corsHeaders,
    });
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/hello-world' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
