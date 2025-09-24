// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
      
      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
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
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        throw new Error(`OpenAI API Error: ${openaiResponse.status} ${openaiResponse.statusText} - ${errorText}`);
      }

      console.log("OpenAI API key is working! Streaming response...");

      // Create readable stream for response - IMMEDIATE FORWARDING
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
                      controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
                      controller.close();
                      return;
                    }
                    
                    if (data) {
                      try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        
                        if (content) {
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
      
      // Fallback to mock response if OpenAI fails
      const fallbackResponse = `OpenAI API Error: ${openaiError.message}. Using fallback response for: "${message}".`;
      
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