// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import "../_shared/types.ts";
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

console.log("Fresh Chat Text Function Started!");

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
    let message = "Hello";
    let chatId = "";
    try {
      const body = await req.json();
      if (!body) {
        throw new Error("Missing request body");
      }
      if (typeof body.message !== "string") {
        throw new Error("Message must be a string");
      }
      message = body.message;
      chatId = body.chatId || crypto.randomUUID();
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error("Invalid JSON in request body");
      }
      throw err;
    }

    // Initialize Supabase client
    const supabase = createSupabaseClient();

    // Create or get chat session
    if (!chatId) {
      // Create new chat session
      const { data: newSession, error: sessionError } = await supabase
        .from("chat_sessions")
        .insert({ title: message.substring(0, 50) })
        .select()
        .single();

      if (sessionError) {
        console.error("Error creating chat session:", sessionError);
        // If session creation fails, generate a new UUID and continue
        chatId = crypto.randomUUID();
      } else if (newSession) {
        chatId = newSession.id;
      }
    } else {
      // Check if chat session exists, if not create it
      const { data: existingSession, error: checkError } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("id", chatId)
        .single();

      if (checkError || !existingSession) {
        console.log("Chat session not found, creating new one:", chatId);
        const { data: newSession, error: sessionError } = await supabase
          .from("chat_sessions")
          .insert({ id: chatId, title: message.substring(0, 50) })
          .select()
          .single();

        if (sessionError) {
          console.error("Error creating chat session:", sessionError);
        }
      } else {
        // Update existing chat session timestamp
        const { error: updateError } = await supabase
          .from("chat_sessions")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", chatId);

        if (updateError) {
          console.error("Error updating chat session:", updateError);
        }
      }
    }

    // Save user message to database
    const { error: userMessageError } = await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        role: "user",
        content: message,
        type: "text",
      });

    if (userMessageError) {
      console.error("Error saving user message:", userMessageError);
    }

    // Check if OpenAI API key is available
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    
    if (!openaiApiKey) {
      // Mock response when no API key is available
      const mockResponse = `No OpenAI API key found. Mock response for: "${message}". Please set OPENAI_API_KEY environment variable.`;
      
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const words = mockResponse.split(' ');
            for (const word of words) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: word + ' ' })}\n\n`));
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Test OpenAI API key with direct HTTP request
    try {
      console.log("Testing OpenAI API key...");
      
      // Add timeout and better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "Supabase-Edge-Function/1.0"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: message,
            },
          ],
          stream: true,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        throw new Error(`OpenAI API Error: ${openaiResponse.status} ${openaiResponse.statusText} - ${errorText}`);
      }

      console.log("OpenAI API key is working! Streaming response...");

      // Create readable stream for response - IMMEDIATE FORWARDING
      let accumulatedResponse = "";
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const reader = openaiResponse.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Decode the chunk immediately
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    
                    if (data === '[DONE]') {
                      // Save complete assistant response to database
                      if (accumulatedResponse) {
                        const { error: assistantMessageError } = await supabase
                          .from("messages")
                          .insert({
                            chat_id: chatId,
                            role: "assistant",
                            content: accumulatedResponse,
                            type: "text",
                          });

                        if (assistantMessageError) {
                          console.error("Error saving assistant message:", assistantMessageError);
                        }
                      }
                      
                      controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
                      controller.close();
                      return;
                    }
                    
                    if (data) {
                      try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        
                        if (content) {
                          // Accumulate response content
                          accumulatedResponse += content;
                          // IMMEDIATELY forward each token as it arrives
                          console.log(`Forwarding token: "${content}"`);
                          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
                        }
                      } catch (e) {
                        // Skip invalid JSON
                        console.log(`Skipping invalid JSON: ${data}`);
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error("Stream error:", error);
            controller.error(error);
          }
        },
      });

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });

    } catch (openaiError) {
      console.error("OpenAI API Error:", openaiError);
      
      // Detect specific error types and provide better user feedback
      let errorMessage = openaiError.message;
      let userFriendlyMessage = "";
      
      if (errorMessage.includes("dns error") || errorMessage.includes("failed to lookup address")) {
        userFriendlyMessage = `Network connectivity issue detected. This might be a temporary DNS problem or network configuration issue. Please try again in a moment.`;
        console.log("DNS/Network error detected:", errorMessage);
      } else if (errorMessage.includes("timeout") || errorMessage.includes("AbortError")) {
        userFriendlyMessage = `Request timed out. The OpenAI API is taking longer than expected to respond. Please try again.`;
        console.log("Timeout error detected:", errorMessage);
      } else if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
        userFriendlyMessage = `API key authentication failed. Please check your OpenAI API key configuration.`;
        console.log("Authentication error detected:", errorMessage);
      } else {
        userFriendlyMessage = `OpenAI API temporarily unavailable. Please try again later.`;
        console.log("General API error:", errorMessage);
      }
      
      // Fallback to mock response if OpenAI fails
      const fallbackResponse = `${userFriendlyMessage} For now, here's a helpful response about your question: "${message}".`;
      
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const words = fallbackResponse.split(' ');
            for (const word of words) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: word + ' ' })}\n\n`));
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }
  } catch (error) {
    const errorResponse = {
      error: error instanceof Error ? error.message : "An unknown error occurred",
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

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/chat-text' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"message":"Hello World"}'

*/