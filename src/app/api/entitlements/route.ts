// src/app/api/entitlements/route.ts
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Plan = "basic" | "plus";
type Status = "inactive" | "trialing" | "active" | "past_due" | "canceled";

function planLimits(plan: Plan) {
  if (plan === "plus") {
    return {
      weekly_limit: 5,
      calories_enabled: true,
      allowed_styles: ["lacné", "rychle", "vyvazene", "vegetarianske", "fit", "tradicne", "exoticke"],
    };
  }
  return {
    weekly_limit: 3,
    calories_enabled: false,
    allowed_styles: ["lacné", "rychle", "vyvazene", "vegetarianske"],
  };
}

/**
 * Aktívne je:
 * - active: buď bez period_end, alebo period_end v budúcnosti
 * - trialing: trial_end v budúcnosti
 */
function isActiveLike(status: Status, now: Date, currentPeriodEnd?: string | null, trialEnd?: string | null) {
  if (status === "active") {
    if (!currentPeriodEnd) return true;
    return new Date(currentPeriodEnd).getTime() > now.getTime();
  }
  if (status === "trialing") {
    if (!trialEnd) return false;
    return new Date(trialEnd).getTime() > now.getTime();
  }
  return false;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const supabase = createSupabaseAdminClient();

    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = userRes.user.id;
    const now = new Date();

    // 1) načítaj subscription, ak nie je -> urob fallback trial 14 dní
    const { data: subRow, error: subErr } = await supabase
      .from("subscriptions")
      .select("plan,status,current_period_end,trial_end")
      .eq("user_id", userId)
      .maybeSingle();

    // Ak tabuľka ešte neexistuje alebo je problém, nezhodíme appku.
    // Fallback: trial 14 dní od dnes.
    const safeNoRowTrialEnd = addDays(now, 14);

    const plan: Plan = (subRow?.plan as Plan) || "basic";

    // Dôležité: ak nie je subRow, nedávaj inactive – daj trialing (aby appka fungovala bez Stripe)
    const status: Status = (subRow?.status as Status) || "trialing";

    const current_period_end = subRow?.current_period_end ?? null;
    const trial_end = subRow?.trial_end ?? (subRow ? null : safeNoRowTrialEnd);

    const limits = planLimits(plan);

    const can_generate = isActiveLike(status, now, current_period_end, trial_end);

    // 2) usage pre week_start (ak príde v query)
    const url = new URL(req.url);
    const week_start = url.searchParams.get("week_start");

    let used = 0;
    if (week_start && /^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
      const { data: usage } = await supabase
        .from("generation_usage")
        .select("count")
        .eq("user_id", userId)
        .eq("week_start", week_start)
        .maybeSingle();

      used = usage?.count ?? 0;
    }

    const remaining = Math.max(0, limits.weekly_limit - used);

    return NextResponse.json({
      plan,
      status,
      can_generate,
      weekly_limit: limits.weekly_limit,
      used,
      remaining,
      calories_enabled: limits.calories_enabled,
      allowed_styles: limits.allowed_styles,

      // extra info pre UI (užitočné na pricing obrazovke)
      trial_end,
      current_period_end,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}