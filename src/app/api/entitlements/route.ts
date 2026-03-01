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

function isActiveLike(status: Status, now: Date, currentPeriodEnd?: string | null, trialUntil?: string | null) {
  if (status === "active") {
    if (!currentPeriodEnd) return true;
    return new Date(currentPeriodEnd).getTime() > now.getTime();
  }
  if (status === "trialing") {
    if (!trialUntil) return false;
    return new Date(trialUntil).getTime() > now.getTime();
  }
  return false;
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

    const { data: subRow, error: subErr } = await supabase
      .from("subscriptions")
      .select("plan,status,current_period_end,trial_until,stripe_customer_id,stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (subErr) {
      return NextResponse.json({ error: subErr.message }, { status: 500 });
    }

    // ak nič nemá -> paywall
    if (!subRow) {
      const limits = planLimits("basic");
      return NextResponse.json({
        plan: "basic",
        status: "inactive",
        can_generate: false,
        weekly_limit: limits.weekly_limit,
        used: 0,
        remaining: limits.weekly_limit,
        calories_enabled: limits.calories_enabled,
        allowed_styles: limits.allowed_styles,
        trial_until: null,
        current_period_end: null,
        has_stripe_link: false,
      });
    }

    const plan: Plan = (subRow.plan as Plan) || "basic";
    const status: Status = (subRow.status as Status) || "inactive";
    const current_period_end = subRow.current_period_end ?? null;
    const trial_until = subRow.trial_until ?? null;

    const has_stripe_link = !!(subRow.stripe_customer_id || subRow.stripe_subscription_id);

    const limits = planLimits(plan);
    const activeLike = isActiveLike(status, now, current_period_end, trial_until);

    const can_generate = activeLike && has_stripe_link;

    // usage (voliteľné)
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
      trial_until,
      current_period_end,
      has_stripe_link,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}