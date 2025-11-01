// This is a Supabase Edge Function that runs on Deno, not Node.js
// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import "../_shared/types.ts";
import { createSupabaseClient } from "../_shared/supabase-client.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("NODE_ENV") === 'production' 
    ? Deno.env.get("ALLOWED_ORIGIN") || "https://yourdomain.com"
    : "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
};

export function handleCors(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
}

console.log("Chat Image Function Started!");

// Simple in-memory rate limiting (in production, use Redis or database)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientId);
  
  if (!clientData || now > clientData.resetTime) {
    rateLimitMap.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  clientData.count++;
  return true;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Validate request method
    if (req.method !== "POST") {
      throw new Error(`Method ${req.method} not allowed`);
    }

    // Rate limiting check
    const clientId = req.headers.get("x-forwarded-for") || 
                     req.headers.get("x-real-ip") || 
                     "unknown";
    
    if (!checkRateLimit(clientId)) {
      return new Response(JSON.stringify({
        success: false,
        error: "Rate limit exceeded. Please try again later."
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": "60"
        },
      });
    }

    // Parse and validate request body
    let originalPrompt = "";
    let processedPrompt = "";
    let chatId = "";
    
    try {
      const body = await req.json();
      
      if (!body || typeof body !== 'object') {
        throw new Error("Request body must be a valid JSON object");
      }
      
      if (!body.message || typeof body.message !== "string") {
        throw new Error("Message field is required and must be a string");
      }
      
      originalPrompt = body.message.trim();
      chatId = body.chatId || crypto.randomUUID();
      
      // Input validation
      if (originalPrompt.length > 1000) {
        throw new Error("Prompt too long (max 1000 characters)");
      }
      
      if (originalPrompt.length < 3) {
        throw new Error("Prompt too short (min 3 characters)");
      }
      
      // Process prompt to make it more OpenAI-friendly
      processedPrompt = preprocessPrompt(originalPrompt);
      
      // Basic content filtering (only for obviously inappropriate content)
      const bannedWords = ['explicit', 'pornographic', 'nsfw', 'sexual', 'nude', 'naked'];
      const lowerPrompt = processedPrompt.toLowerCase();
      const containsBannedWord = bannedWords.some(word => lowerPrompt.includes(word));
      
      if (containsBannedWord) {
        throw new Error("Prompt contains inappropriate content");
      }
      
      // Validate chatId format if provided
      if (body.chatId && (typeof body.chatId !== "string" || body.chatId.length > 100)) {
        throw new Error("chatId must be a valid string (max 100 characters)");
      }
      
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
        .insert({ title: originalPrompt.substring(0, 50) })
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
          .insert({ id: chatId, title: originalPrompt.substring(0, 50) })
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
        content: originalPrompt,
        type: "image",
      });

    if (userMessageError) {
      console.error("Error saving user message:", userMessageError);
    }

    // Function to preprocess prompts to be more OpenAI-friendly
    function preprocessPrompt(prompt: string): string {
      let processed = prompt;
      
      // Add "digital art" or "illustration" to make it clearer it's artistic
      if (!processed.toLowerCase().includes('art') && 
          !processed.toLowerCase().includes('illustration') && 
          !processed.toLowerCase().includes('drawing') &&
          !processed.toLowerCase().includes('painting')) {
        processed = `Digital illustration of ${processed}`;
      }
      
      // Replace potentially problematic words with safer alternatives
      const replacements = [
        { from: /\bkill\b/gi, to: 'defeat' },
        { from: /\bdie\b/gi, to: 'rest' },
        { from: /\bdead\b/gi, to: 'sleeping' },
        { from: /\bweapon\b/gi, to: 'tool' },
        { from: /\bgun\b/gi, to: 'device' },
        { from: /\bviolent\b/gi, to: 'energetic' },
        { from: /\bfight\b/gi, to: 'compete' }
      ];
      
      replacements.forEach(replacement => {
        processed = processed.replace(replacement.from, replacement.to);
      });
      
      return processed;
    }

    // Function to generate alternative prompt phrasings
    function generateAlternativePrompts(originalPrompt: string): string[] {
      const alternatives = [
        `Artistic rendering of ${originalPrompt}`,
        `Whimsical illustration showing ${originalPrompt}`,
        `Creative digital art depicting ${originalPrompt}`,
        `Cartoon-style image of ${originalPrompt}`,
        `Fantasy illustration of ${originalPrompt}`
      ];
      
      return alternatives;
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    
    if (!openaiApiKey) {
      console.log("No OpenAI API key found, using mock response");
      
      // Mock response for testing
      const mockResponse = {
        success: true,
        imageUrl: "https://via.placeholder.com/1024x1024/4F46E5/FFFFFF?text=Mock+Image+Generation",
        prompt: originalPrompt,
        processedPrompt: processedPrompt,
        chatId: chatId,
        revisedPrompt: `Mock generation for: ${processedPrompt}`
      };

      return new Response(JSON.stringify(mockResponse), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    console.log("Testing OpenAI Image Generation API...");

    // Function to attempt image generation with retry logic
    async function attemptImageGeneration(promptToTry: string, attempt: number = 1): Promise<Response> {
      console.log(`Attempt ${attempt}: Using prompt: "${promptToTry}"`);
      
      const openaiResponse = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "Supabase-Edge-Function/1.0"
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: promptToTry,
          n: 1,
          size: "1024x1024",
          quality: "standard",
          response_format: "url"
        }),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error(`OpenAI API Error (attempt ${attempt}):`, {
          status: openaiResponse.status,
          statusText: openaiResponse.statusText,
          error: errorText
        });
        
        // Parse the error to provide better user feedback
        let userFriendlyError = "Image generation failed";
        let shouldRetry = false;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error?.code === "content_policy_violation") {
            shouldRetry = attempt < 3; // Try up to 3 times
            if (shouldRetry) {
              console.log("Content policy violation, trying alternative prompt...");
              const alternatives = generateAlternativePrompts(originalPrompt);
              if (attempt <= alternatives.length) {
                return await attemptImageGeneration(alternatives[attempt - 1], attempt + 1);
              }
            }
            userFriendlyError = `I apologize, but OpenAI's safety system rejected the prompt "${originalPrompt}". This sometimes happens with innocent requests. Please try rephrasing your request or using different words to describe what you want to see.`;
          } else if (errorData.error?.code === "rate_limit_exceeded") {
            userFriendlyError = "OpenAI rate limit exceeded. Please try again later.";
          } else if (errorData.error?.message) {
            userFriendlyError = errorData.error.message;
          }
        } catch (parseError) {
          userFriendlyError = "Image generation service temporarily unavailable";
        }
        
        // Return error response
        return new Response(JSON.stringify({
          success: false,
          error: userFriendlyError,
          originalPrompt: originalPrompt,
          attemptsUsed: attempt
        }), {
          status: openaiResponse.status >= 500 ? 502 : 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }

      // Success case
      const openaiData = await openaiResponse.json();
      
      // Validate OpenAI response structure
      if (!openaiData.data || !Array.isArray(openaiData.data) || openaiData.data.length === 0) {
        console.error("Invalid OpenAI response structure:", openaiData);
        return new Response(JSON.stringify({
          success: false,
          error: "Invalid response from image generation service"
        }), {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }

      console.log(`OpenAI Image Generation successful on attempt ${attempt}!`);

      // Save assistant message with image to database
      const imageUrl = openaiData.data[0].url;
      const revisedPrompt = openaiData.data[0].revised_prompt || promptToTry;
      
      const { error: assistantMessageError } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          role: "assistant",
          content: revisedPrompt,
          type: "image",
          image_url: imageUrl,
        });

      if (assistantMessageError) {
        console.error("Error saving assistant message:", assistantMessageError);
      }

      // Return successful response
      return new Response(JSON.stringify({
        success: true,
        imageUrl: imageUrl,
        prompt: originalPrompt,
        processedPrompt: promptToTry,
        chatId: chatId,
        revisedPrompt: revisedPrompt,
        attemptsUsed: attempt
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // Start the image generation process
    return await attemptImageGeneration(processedPrompt);

  } catch (error) {
    // Log error details for debugging (but don't expose sensitive info to client)
    console.error("Error in chat-image function:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    // Return sanitized error message to client
    const errorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    };
    
    // Determine appropriate status code
    const statusCode = error instanceof Error && error.message.includes("not allowed") ? 405 :
                      error instanceof Error && error.message.includes("too long") ? 400 :
                      error instanceof Error && error.message.includes("inappropriate") ? 400 :
                      500;
    
    return new Response(JSON.stringify(errorResponse), {
      status: statusCode,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/chat-image' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"message":"A beautiful sunset over mountains"}'

*/