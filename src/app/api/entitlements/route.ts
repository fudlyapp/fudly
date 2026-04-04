import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

type Plan = "basic" | "plus";
type Status = "inactive" | "trialing" | "active" | "past_due" | "canceled" | "none";

function planLimits(plan: Plan) {
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

  if (status === "past_due") {
    const cpe = parseDateMs(currentPeriodEnd);
    if (!cpe) return true;
    return cpe > now;
  }

  return false;
}

function normalizeStripeStatus(status: string): Status {
  if (status === "unpaid") return "past_due";

  switch (status) {
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

function planFromPriceId(priceId: string | null): Plan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PLUS) return "plus";
  if (priceId === process.env.STRIPE_PRICE_BASIC) return "basic";
  return null;
}

function toIsoFromUnix(unix?: number | null) {
  return unix ? new Date(unix * 1000).toISOString() : null;
}

function noStoreHeaders() {
  return { "Cache-Control": "no-store" };
}

async function getStoredStripeCustomerId(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
) {
  const { data: row, error } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return row?.stripe_customer_id ?? null;
}

async function listCandidateCustomerIds(
  storedCustomerId: string | null,
  userId: string,
  userEmail: string | null
) {
  const ids: string[] = [];

  if (storedCustomerId) ids.push(storedCustomerId);

  if (!userEmail) return ids;

  const customers = await stripe.customers.list({
    email: userEmail,
    limit: 20,
  });

  const preferred = customers.data
    .filter((c) => c.metadata?.user_id === userId)
    .map((c) => c.id);

  const fallback = customers.data.map((c) => c.id);

  for (const id of [...preferred, ...fallback]) {
    if (!ids.includes(id)) ids.push(id);
  }

  return ids;
}

async function getCanonicalStripeSubscription(customerId: string) {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });

  return (
    subs.data.find((s) => ["active", "trialing", "past_due", "unpaid"].includes(s.status)) ??
    null
  );
}

async function findBestCustomerAndSubscription(
  storedCustomerId: string | null,
  userId: string,
  userEmail: string | null
) {
  const candidateIds = await listCandidateCustomerIds(storedCustomerId, userId, userEmail);

  let firstExistingCustomerId: string | null = null;

  for (const customerId of candidateIds) {
    if (!firstExistingCustomerId) firstExistingCustomerId = customerId;

    const sub = await getCanonicalStripeSubscription(customerId);
    if (sub) {
      return {
        customerId,
        subscription: sub,
      };
    }
  }

  return {
    customerId: firstExistingCustomerId,
    subscription: null,
  };
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

    const authClient = createSupabaseAdminClient();
    const { data: userRes, error: userErr } = await authClient.auth.getUser(token);

    if (userErr || !userRes?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: noStoreHeaders() }
      );
    }

    const userId = userRes.user.id;
    const userEmail = userRes.user.email ?? null;
    const now = Date.now();

    const supabase = createSupabaseAdminClient();

    const storedCustomerId = await getStoredStripeCustomerId(supabase, userId);

    const found = await findBestCustomerAndSubscription(storedCustomerId, userId, userEmail);

    if (!found.customerId) {
      return NextResponse.json(
        {
          debug_user_id: userId,
          debug_email: userEmail,
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

    if (!found.subscription) {
      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: found.customerId,
          stripe_subscription_id: null,
          plan: null,
          status: "none",
          trial_until: null,
          current_period_end: null,
        },
        { onConflict: "user_id" }
      );

      return NextResponse.json(
        {
          debug_user_id: userId,
          debug_email: userEmail,
          debug_customer_id: found.customerId,
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
          has_stripe_link: true,
        },
        { headers: noStoreHeaders() }
      );
    }

    const sub = found.subscription;
    const customerId = found.customerId;

    const priceId = sub.items.data[0]?.price?.id ?? null;
    const plan = planFromPriceId(priceId);
    const status = normalizeStripeStatus(sub.status);

    const trial_until = toIsoFromUnix(sub.trial_end ?? null);
    const current_period_end = toIsoFromUnix((sub as any).current_period_end ?? null);

    await supabase.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        plan,
        status,
        trial_until,
        current_period_end,
      },
      { onConflict: "user_id" }
    );

    if (!plan) {
      return NextResponse.json(
        {
          debug_user_id: userId,
          debug_email: userEmail,
          debug_customer_id: customerId,
          debug_price_id: priceId,
          debug_subscription_id: sub.id,
          plan: null,
          status,
          active_like: false,
          can_generate: false,
          weekly_limit: 0,
          used: 0,
          remaining: 0,
          calories_enabled: false,
          allowed_styles: [],
          trial_until,
          current_period_end,
          has_stripe_link: true,
        },
        { headers: noStoreHeaders() }
      );
    }

    const limits = planLimits(plan);
    const active_like = isActiveLike(status, now, current_period_end, trial_until);
    const can_generate = active_like && !!customerId;

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
          {
            error: usageErr.message,
            debug_user_id: userId,
            debug_email: userEmail,
          },
          { status: 500, headers: noStoreHeaders() }
        );
      }

      used = usage?.count ?? 0;
    }

    const remaining = Math.max(0, limits.weekly_limit - used);

    return NextResponse.json(
      {
        debug_user_id: userId,
        debug_email: userEmail,
        debug_customer_id: customerId,
        debug_subscription_id: sub.id,
        debug_price_id: priceId,
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
        has_stripe_link: true,
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