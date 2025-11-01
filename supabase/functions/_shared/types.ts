// Shared TypeScript declarations for Supabase Edge Functions
// This file contains common type definitions used across multiple functions

export {};

declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined;
    };
    serve(handler: (req: Request) => Response | Promise<Response>): void;
  };
}



















