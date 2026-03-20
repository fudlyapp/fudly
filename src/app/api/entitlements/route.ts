// src/app/api/entitlements/route.ts
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Plan = "basic" | "plus";
type Status = "inactive" | "trialing" | "active" | "past_due" | "canceled" | "none";

type SubscriptionRow = {
  user_id: string;
  plan: string | null;
  status: string | null;
  current_period_end: string | null;
  trial_until: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

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

function parseDateMs(v?: string | null) {
  if (!v) return null;

  let s = v.trim();

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    s = s.replace(" ", "T");
  }

  if (/[+-]\d{2}$/.test(s)) {
    s = s + ":00";
  }

  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

function normalizePlan(v?: string | null): Plan {
  return v === "plus" ? "plus" : "basic";
}

function normalizeStatus(v?: string | null): Status {
  switch (v) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "inactive":
      return "inactive";
    default:
      return "none";
  }
}

function isActiveLike(
  status: Status,
  now: number,
  currentPeriodEnd?: string | null,
  trialUntil?: string | null
) {
  if (status === "active") {
    const cpe = parseDateMs(currentPeriodEnd);
    if (!cpe) return true;
    return cpe > now;
  }

  if (status === "trialing") {
    const tu = parseDateMs(trialUntil);
    if (!tu) return false;
    return tu > now;
  }

  return false;
}

function noStoreHeaders() {
  return { "Cache-Control": "no-store" };
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 401, headers: noStoreHeaders() }
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: noStoreHeaders() }
      );
    }

    const userId = userRes.user.id;
    const now = Date.now();

    const { data: subRows, error: subErr } = await supabase
      .from("subscriptions")
      .select("user_id,plan,status,current_period_end,trial_until,stripe_customer_id,stripe_subscription_id")
      .eq("user_id", userId);

    if (subErr) {
      return NextResponse.json(
        { error: subErr.message },
        { status: 500, headers: noStoreHeaders() }
      );
    }

    const subRow = (subRows?.[0] ?? null) as SubscriptionRow | null;

    if (!subRow) {
      return NextResponse.json(
        {
          plan: null,
          status: "none" as const,
          active_like: false,
          can_generate: false,
          weekly_limit: 0,
          used: 0,
          remaining: 0,
          calories_enabled: false,
          allowed_styles: [],
          trial_until: null,
          current_period_end: null,
          has_stripe_link: false,
        },
        { headers: noStoreHeaders() }
      );
    }

    const plan = normalizePlan(subRow.plan);
    const status = normalizeStatus(subRow.status);
    const current_period_end = subRow.current_period_end ?? null;
    const trial_until = subRow.trial_until ?? null;
    const has_stripe_link = !!(subRow.stripe_customer_id || subRow.stripe_subscription_id);

    const limits = planLimits(plan);
    const active_like = isActiveLike(status, now, current_period_end, trial_until);
    const can_generate = active_like && has_stripe_link;

    const url = new URL(req.url);
    const week_start = url.searchParams.get("week_start");

    let used = 0;

    if (week_start && /^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
      const { data: usage, error: usageErr } = await supabase
        .from("generation_usage")
        .select("count")
        .eq("user_id", userId)
        .eq("week_start", week_start)
        .maybeSingle();

      if (usageErr) {
        return NextResponse.json(
          { error: usageErr.message },
          { status: 500, headers: noStoreHeaders() }
        );
      }

      used = usage?.count ?? 0;
    }

    const remaining = Math.max(0, limits.weekly_limit - used);

    return NextResponse.json(
      {
        plan,
        status,
        active_like,
        can_generate,
        weekly_limit: limits.weekly_limit,
        used,
        remaining,
        calories_enabled: limits.calories_enabled,
        allowed_styles: limits.allowed_styles,
        trial_until,
        current_period_end,
        has_stripe_link,
      },
      { headers: noStoreHeaders() }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}