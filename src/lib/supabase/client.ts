// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

function _createSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "Chýbajú env pre Supabase. Skontroluj NEXT_PUBLIC_SUPABASE_URL a NEXT_PUBLIC_SUPABASE_ANON_KEY (lokálne aj vo Vercel)."
    );
  }

  return createBrowserClient(url, anon);
}

// ✅ nový názov (odporúčam používať všade)
export const createSupabaseBrowserClient = _createSupabaseBrowserClient;
