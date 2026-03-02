// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  // eslint-disable-next-line no-var
  var __fudlySupabaseClient: SupabaseClient | undefined;
}

/**
 * SSR-safe Supabase client.
 *
 * - v prehliadači: použije @supabase/ssr createBrowserClient (persist session, cookies/localStorage handling)
 * - na serveri: vytvorí "plain" supabase-js klienta (bez browser storage),
 *   aby Next prerender/build nikdy nepadol
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  // Singleton
  if (globalThis.__fudlySupabaseClient) return globalThis.__fudlySupabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "Chýbajú env pre Supabase. Skontroluj NEXT_PUBLIC_SUPABASE_URL a NEXT_PUBLIC_SUPABASE_ANON_KEY (lokálne aj vo Vercel)."
    );
  }

  const isBrowser = typeof window !== "undefined";

  globalThis.__fudlySupabaseClient = isBrowser
    ? createBrowserClient(url, anon)
    : createClient(url, anon, {
        auth: {
          // na serveri nechceme localStorage/cookies z browseru
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

  return globalThis.__fudlySupabaseClient;
}