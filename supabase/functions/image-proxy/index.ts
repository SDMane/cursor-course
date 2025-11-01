// Image proxy function to handle OpenAI Azure blob URLs
// This helps with CORS issues and provides better error handling

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import "../_shared/types.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Cache-Control": "public, max-age=3600", // Cache for 1 hour
};

export function handleCors(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Validate request method
    if (req.method !== "GET") {
      return new Response(JSON.stringify({
        success: false,
        error: `Method ${req.method} not allowed`
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Allow": "GET, OPTIONS"
        },
      });
    }

    // Get the image URL from query parameters
    const url = new URL(req.url);
    const imageUrl = url.searchParams.get('url');
    
    if (!imageUrl) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing 'url' parameter"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // Validate that it's an allowed image URL (OpenAI Azure blob or placeholder for testing)
    const allowedDomains = [
      'oaidalleapiprodscus.blob.core.windows.net',
      'via.placeholder.com',
      'picsum.photos'
    ];
    
    const isAllowedUrl = allowedDomains.some(domain => imageUrl.includes(domain));
    
    if (!isAllowedUrl) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid image URL domain"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    console.log(`Proxying image request for: ${imageUrl}`);

    // Fetch the image with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const imageResponse = await fetch(imageUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Supabase-Edge-Function/1.0'
        }
      });

      clearTimeout(timeoutId);

      if (!imageResponse.ok) {
        console.error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
        return new Response(JSON.stringify({
          success: false,
          error: "Failed to fetch image"
        }), {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }

      // Get the image data
      const imageBuffer = await imageResponse.arrayBuffer();
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

      // Return the image with proper headers
      return new Response(imageBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Content-Length": imageBuffer.byteLength.toString(),
          "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        },
      });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('Image fetch timeout');
        return new Response(JSON.stringify({
          success: false,
          error: "Image request timed out"
        }), {
          status: 504,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }

      console.error('Image fetch error:', fetchError);
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to fetch image"
      }), {
        status: 502,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

  } catch (error) {
    console.error("Error in image-proxy function:", error);
    
    return new Response(JSON.stringify({
      success: false,
      error: "Internal server error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});

/* To invoke locally:

  1. Run `supabase start`
  2. Make an HTTP request:

  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/image-proxy?url=https://oaidalleapiprodscus.blob.core.windows.net/...'

*/
