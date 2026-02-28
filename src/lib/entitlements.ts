//src/lib/entitlements.ts
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type Entitlements = {
  tier: "basic" | "plus";
  status: "trialing" | "active" | "canceled" | "past_due" | "inactive";
  trial_until: string | null;
  effective_tier: "basic" | "plus";
  in_trial: boolean;
  generation_limit_per_week: number;
  calories_enabled: boolean;
  allowed_styles: string[];
};

export async function fetchEntitlements(): Promise<Entitlements | null> {
  const supabase = createSupabaseBrowserClient();
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return null;

  const res = await fetch("/api/entitlements", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;
  const json = await res.json();
  return json.entitlements ?? null;
}