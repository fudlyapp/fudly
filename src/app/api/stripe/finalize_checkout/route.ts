// src/app/api/stripe/finalize_checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

type Body = {
  session_id?: string;
};

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
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) s = s.replace(" ", "T");
  if (/[+-]\d{2}$/.test(s)) s = s + ":00";

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

    const body = (await req.json().catch(() => null)) as Body | null;
    const sessionId = body?.session_id?.trim();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (!session) {
      return NextResponse.json({ error: "Checkout session not found" }, { status: 404 });
    }

    const sessionUserId = session.client_reference_id ?? session.metadata?.user_id ?? null;

    if (!sessionUserId || sessionUserId !== user.id) {
      return NextResponse.json(
        {
          error: "Session does not belong to this user",
          debug_user_id: user.id,
          debug_session_user_id: sessionUserId,
          debug_session_id: sessionId,
        },
        { status: 403 }
      );
    }

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? null;

    let subscriptionId: string | null = null;
    let status = "inactive";
    let plan: "basic" | "plus" = "basic";
    let trial_until: string | null = null;
    let current_period_end: string | null = null;

    const expandedSub = session.subscription;

    if (expandedSub && typeof expandedSub !== "string") {
      subscriptionId = expandedSub.id;
      status = normalizeStripeStatus(expandedSub.status);

      const priceId = expandedSub.items.data[0]?.price?.id ?? null;
      plan = planFromPriceId(priceId);

      const trialUntilUnix = expandedSub.trial_end ?? null;
      const currentPeriodEndUnix = (expandedSub as any).current_period_end ?? null;

      trial_until = trialUntilUnix
        ? new Date(trialUntilUnix * 1000).toISOString()
        : null;

      current_period_end = currentPeriodEndUnix
        ? new Date(currentPeriodEndUnix * 1000).toISOString()
        : null;
    } else if (typeof expandedSub === "string") {
      const sub = await stripe.subscriptions.retrieve(expandedSub);

      subscriptionId = sub.id;
      status = normalizeStripeStatus(sub.status);

      const priceId = sub.items.data[0]?.price?.id ?? null;
      plan = planFromPriceId(priceId);

      const trialUntilUnix = sub.trial_end ?? null;
      const currentPeriodEndUnix = (sub as any).current_period_end ?? null;

      trial_until = trialUntilUnix
        ? new Date(trialUntilUnix * 1000).toISOString()
        : null;

      current_period_end = currentPeriodEndUnix
        ? new Date(currentPeriodEndUnix * 1000).toISOString()
        : null;
    } else {
      return NextResponse.json(
        {
          error: "Session has no subscription",
          debug_session_id: sessionId,
          debug_user_id: user.id,
          debug_customer_id: customerId,
        },
        { status: 400 }
      );
    }

    const { error: upsertErr } = await supabase.from("subscriptions").upsert(
      {
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
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
          debug_session_id: sessionId,
          debug_customer_id: customerId,
          debug_subscription_id: subscriptionId,
          debug_plan: plan,
          debug_status: status,
        },
        { status: 500 }
      );
    }

    const now = Date.now();
    const active_like = isActiveLike(status, now, current_period_end, trial_until);
    const limits = planLimits(plan);

    return NextResponse.json(
      {
        debug_user_id: user.id,
        debug_email: user.email ?? null,
        plan,
        status,
        active_like,
        can_generate: active_like && !!customerId,
        weekly_limit: limits.weekly_limit,
        used: 0,
        remaining: limits.weekly_limit,
        calories_enabled: limits.calories_enabled,
        allowed_styles: limits.allowed_styles,
        trial_until,
        current_period_end,
        has_stripe_link: !!customerId,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}