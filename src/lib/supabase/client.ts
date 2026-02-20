import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Keď by to náhodou chýbalo, radšej uvidíš jasnú chybu (nie “nekonečné načítavam…”)
  if (!url || !anon) {
    throw new Error(
      "Chýbajú env pre Supabase. Skontroluj NEXT_PUBLIC_SUPABASE_URL a NEXT_PUBLIC_SUPABASE_ANON_KEY (lokálne aj vo Vercel)."
    );
  }

  return createBrowserClient(url, anon);
}