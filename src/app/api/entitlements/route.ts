import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Tier = "basic" | "plus";
type Status = "trialing" | "active" | "canceled" | "past_due" | "inactive";

function nowPlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function computeEntitlements(sub: {
  tier: Tier;
  status: Status;
  trial_until: string | null;
}) {
  const now = new Date();
  const trialUntil = sub.trial_until ? new Date(sub.trial_until) : null;
  const inTrial = trialUntil ? trialUntil.getTime() > now.getTime() : false;

  const effectiveTier: Tier = inTrial ? "plus" : sub.tier;

  const generationLimitPerWeek = effectiveTier === "plus" ? 5 : 3;

  const caloriesEnabled = effectiveTier === "plus";

  const allowedStyles = effectiveTier === "plus"
    ? ["lacné", "rychle", "vyvazene", "vegetarianske", "tradicne", "exoticke", "fit"]
    : ["lacné", "rychle", "vyvazene", "vegetarianske"];

  return {
    tier: sub.tier,
    status: sub.status,
    trial_until: sub.trial_until,
    effective_tier: effectiveTier,
    in_trial: inTrial,
    generation_limit_per_week: generationLimitPerWeek,
    calories_enabled: caloriesEnabled,
    allowed_styles: allowedStyles,
  };
}

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
    }

    // auth: prečítame access token z cookies cez Authorization header (posielame z FE)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // zistíme usera z tokenu
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;

    // načítaj subscription
    const { data: existing, error: selErr } = await admin
      .from("subscriptions")
      .select("user_id,tier,status,trial_until,current_period_end")
      .eq("user_id", userId)
      .maybeSingle();

    if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });

    // ak neexistuje, vytvor trial
    if (!existing) {
      const trialUntil = nowPlusDays(14);
      const { data: inserted, error: insErr } = await admin
        .from("subscriptions")
        .insert({
          user_id: userId,
          tier: "basic",
          status: "trialing",
          trial_until: trialUntil,
        })
        .select("user_id,tier,status,trial_until,current_period_end")
        .maybeSingle();

      if (insErr || !inserted) {
        return NextResponse.json({ error: insErr?.message ?? "Insert failed" }, { status: 500 });
      }

      return NextResponse.json({ entitlements: computeEntitlements(inserted as any) }, { status: 200 });
    }

    // ak existuje, len vráť entitlements
    return NextResponse.json({ entitlements: computeEntitlements(existing as any) }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}