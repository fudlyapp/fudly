// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

declare global {
  // eslint-disable-next-line no-var
  var __fudlySupabaseBrowserClient: SupabaseClient | undefined;
}

export function createSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("createSupabaseBrowserClient() môže byť použité iba v prehliadači (client components).");
  }

  if (globalThis.__fudlySupabaseBrowserClient) return globalThis.__fudlySupabaseBrowserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "Chýbajú env pre Supabase. Skontroluj NEXT_PUBLIC_SUPABASE_URL a NEXT_PUBLIC_SUPABASE_ANON_KEY (lokálne aj vo Vercel)."
    );
  }

  globalThis.__fudlySupabaseBrowserClient = createBrowserClient(url, anon);
  return globalThis.__fudlySupabaseBrowserClient;
}