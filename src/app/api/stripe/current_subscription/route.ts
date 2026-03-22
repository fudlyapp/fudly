// src/app/api/stripe/current_subscription/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

function parseDateIsoFromUnix(unix?: number | null) {
  return unix ? new Date(unix * 1000).toISOString() : null;
}

function planFromPriceId(priceId: string | null): "basic" | "plus" {
  return priceId === process.env.STRIPE_PRICE_PLUS ? "plus" : "basic";
}

function normalizeStripeStatus(status: string): string {
  if (status === "unpaid") return "past_due";
  return status;
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

function isActiveLike(
  status: string,
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

  if (status === "past_due") {
    const cpe = parseDateMs(currentPeriodEnd);
    if (!cpe) return true;
    return cpe > now;
  }

  return false;
}

function planLimits(plan: "basic" | "plus") {
  if (plan === "plus") {
    return {
      weekly_limit: 5,
      calories_enabled: true,
      allowed_styles: ["lacné", "rychle", "vyvazene", "vegetarianske", "veganske", "fit", "tradicne", "exoticke"],
    };
  }

  return {
    weekly_limit: 3,
    calories_enabled: false,
    allowed_styles: ["lacné", "rychle", "vyvazene", "vegetarianske"],
  };
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const authClient = createSupabaseAdminClient();
    const { data: userRes, error: userErr } = await authClient.auth.getUser(token);

    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = userRes.user;
    const supabase = createSupabaseAdminClient();

    const { data: row, error: rowErr } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (rowErr) {
      return NextResponse.json({ error: rowErr.message }, { status: 500 });
    }

    if (!row?.stripe_customer_id) {
      return NextResponse.json({
        debug_user_id: user.id,
        debug_email: user.email ?? null,
        plan: null,
        status: "none",
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
      });
    }

    const subs = await stripe.subscriptions.list({
      customer: row.stripe_customer_id,
      status: "all",
      limit: 20,
    });

    const sub =
      subs.data.find((s) => ["active", "trialing", "past_due", "unpaid"].includes(s.status)) ??
      subs.data[0] ??
      null;

    if (!sub) {
      return NextResponse.json({
        debug_user_id: user.id,
        debug_email: user.email ?? null,
        plan: null,
        status: "none",
        active_like: false,
        can_generate: false,
        weekly_limit: 0,
        used: 0,
        remaining: 0,
        calories_enabled: false,
        allowed_styles: [],
        trial_until: null,
        current_period_end: null,
        has_stripe_link: !!row.stripe_customer_id,
      });
    }

    const priceId = sub.items.data[0]?.price?.id ?? null;
    const plan = planFromPriceId(priceId);
    const status = normalizeStripeStatus(sub.status);

    const trial_until = parseDateIsoFromUnix(sub.trial_end ?? null);
    const current_period_end = parseDateIsoFromUnix((sub as any).current_period_end ?? null);

    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

    const { error: upsertErr } = await supabase.from("subscriptions").upsert(
      {
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        plan,
        status,
        trial_until,
        current_period_end,
      },
      { onConflict: "user_id" }
    );

    if (upsertErr) {
      return NextResponse.json(
        {
          error: upsertErr.message,
          debug_user_id: user.id,
          debug_email: user.email ?? null,
          debug_plan: plan,
          debug_status: status,
          debug_customer_id: customerId,
          debug_subscription_id: sub.id,
        },
        { status: 500 }
      );
    }

    // ✅ po zápise si row z DB ešte raz prečítaj a vráť DB truth
    const { data: freshRow, error: freshErr } = await supabase
      .from("subscriptions")
      .select("plan,status,trial_until,current_period_end,stripe_customer_id,stripe_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (freshErr) {
      return NextResponse.json(
        {
          error: freshErr.message,
          debug_user_id: user.id,
          debug_email: user.email ?? null,
        },
        { status: 500 }
      );
    }

    const finalPlan = (freshRow?.plan === "plus" ? "plus" : "basic") as "basic" | "plus";
    const finalStatus = (freshRow?.status ?? "none") as string;
    const finalTrialUntil = freshRow?.trial_until ?? null;
    const finalCurrentPeriodEnd = freshRow?.current_period_end ?? null;
    const hasStripeLink = !!(freshRow?.stripe_customer_id || freshRow?.stripe_subscription_id);

    const now = Date.now();
    const active_like = isActiveLike(finalStatus, now, finalCurrentPeriodEnd, finalTrialUntil);
    const limits = planLimits(finalPlan);

    return NextResponse.json({
      debug_user_id: user.id,
      debug_email: user.email ?? null,
      plan: finalPlan,
      status: finalStatus,
      active_like,
      can_generate: active_like && hasStripeLink,
      weekly_limit: limits.weekly_limit,
      used: 0,
      remaining: limits.weekly_limit,
      calories_enabled: limits.calories_enabled,
      allowed_styles: limits.allowed_styles,
      trial_until: finalTrialUntil,
      current_period_end: finalCurrentPeriodEnd,
      has_stripe_link: hasStripeLink,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}